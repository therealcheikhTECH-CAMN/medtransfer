from django.utils import timezone
from django.db.models import Q
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied

from care_management.models import PriseEnCharge
from emergencies.models import AutorisationUrgence
from audit.models import enregistrer_journal


class MedicalRecordAccessService:
    """
    Service centralisé de contrôle d'accès aux dossiers médicaux et aux opérations cliniques
    dans MEDTRANSFER.

    Principe fondamental (Refus par défaut) :
    Un médecin ne dispose pas d'un accès clinique à un patient du seul fait de son rôle.
    Il doit disposer d'une autorisation réelle, active et vérifiable côté backend :
    - Soit une PriseEnCharge ordinaire active (`statut='ACTIF'`, `type_prise_en_charge='ORDINAIRE'`)
      dans son établissement dont il est le médecin responsable.
    - Soit une AutorisationUrgence valide, active et non expirée (`statut='ACTIVE'`, `date_expiration > now`)
      accordée à ce médecin dans son établissement pour ce patient précis.
    """

    LEVEL_IDENTITY = 'IDENTITY'
    LEVEL_READ = 'READ'
    LEVEL_WRITE = 'WRITE'
    LEVEL_ORDINARY_CONSULTATION = 'ORDINARY_CONSULTATION'
    LEVEL_EMERGENCY = 'EMERGENCY'

    @classmethod
    def is_user_valid_professional(cls, user):
        """
        Vérifie :
        1. Utilisateur authentifié.
        2. Compte actif et validé (`statut_validation == 'APPROVED'`, `is_active`, `is_actif`).
        3. Établissement défini et actif (sauf administrateur technique sur son périmètre système).
        """
        if not (user and user.is_authenticated):
            return False
        if not (user.is_active and getattr(user, 'is_actif', True)):
            return False
        if getattr(user, 'statut_validation', 'APPROVED') != 'APPROVED':
            return False
        if not user.is_admin_user:
            etab = getattr(user, 'etablissement', None)
            if not etab or not getattr(etab, 'is_active', True):
                return False
        return True

    @classmethod
    def is_active_approved_doctor(cls, user):
        """Vérifie que l'utilisateur est un médecin actif, approuvé et rattaché à un établissement actif."""
        return bool(cls.is_user_valid_professional(user) and user.role == 'MEDECIN')

    @classmethod
    def is_active_approved_receptionist(cls, user):
        """Vérifie que l'utilisateur est un agent d'accueil actif, approuvé et rattaché à un établissement actif."""
        return bool(cls.is_user_valid_professional(user) and user.role == 'AGENT')

    @classmethod
    def expire_outdated_emergency_authorizations(
        cls, patient=None, patient_id=None, user=None, medecin_id=None, request=None
    ):
        """
        Marque automatiquement comme 'EXPIREE' toute AutorisationUrgence dont la date d'expiration est dépassée
        et journalise l'expiration dans JournalAcces.
        """
        now = timezone.now()
        qs = AutorisationUrgence.objects.filter(statut='ACTIVE', date_expiration__lte=now)
        resolved_patient_id = patient_id if patient_id is not None else (
            patient.id if hasattr(patient, 'id') else patient
        )
        resolved_medecin_id = medecin_id if medecin_id is not None else (
            user.id if user and getattr(user, 'is_authenticated', False) else None
        )
        if resolved_patient_id is not None:
            qs = qs.filter(patient_id=resolved_patient_id)
        if resolved_medecin_id is not None:
            qs = qs.filter(medecin_id=resolved_medecin_id)

        for auth_urg in qs.select_related('medecin', 'etablissement'):
            auth_urg.verifier_expiration(request=request)

    @classmethod
    def get_active_ordinary_care_for_doctor(cls, user, patient_id):
        """
        Retourne la PriseEnCharge ordinaire active autorisant ce médecin sur ce patient,
        ou None si aucune prise en charge valide ne correspond.
        Prend en compte les prises en charge explicitement assignées ou transférées à l'établissement sans médecin désigné.
        """
        if not cls.is_active_approved_doctor(user) or not patient_id:
            return None

        # 1. Prise en charge où le médecin est explicitement désigné responsable
        pec = (
            PriseEnCharge.objects.filter(
                patient_id=patient_id,
                etablissement_id=user.etablissement_id,
                medecin_responsable_id=user.id,
                statut='ACTIF',
                type_prise_en_charge='ORDINAIRE',
            )
            .select_related('etablissement', 'medecin_responsable', 'patient')
            .first()
        )
        if pec:
            return pec

        # 2. Prise en charge active ouverte au sein de l'établissement sans médecin assigné (ex: suite à transfert accepté par l'accueil)
        return (
            PriseEnCharge.objects.filter(
                patient_id=patient_id,
                etablissement_id=user.etablissement_id,
                medecin_responsable__isnull=True,
                statut='ACTIF',
                type_prise_en_charge='ORDINAIRE',
            )
            .select_related('etablissement', 'medecin_responsable', 'patient')
            .first()
        )

    @classmethod
    def get_valid_emergency_authorization_for_doctor(cls, user, patient_id, require_clinical_write=False, request=None):
        """
        Retourne l'AutorisationUrgence active et non expirée accordée à ce médecin pour ce patient,
        ou None si aucune autorisation valide n'existe.
        """
        if not cls.is_active_approved_doctor(user) or not patient_id:
            return None

        cls.expire_outdated_emergency_authorizations(
            patient_id=patient_id,
            medecin_id=user.id,
            request=request,
        )

        now = timezone.now()
        qs = AutorisationUrgence.objects.filter(
            patient_id=patient_id,
            medecin_id=user.id,
            etablissement_id=user.etablissement_id,
            statut='ACTIVE',
            date_expiration__gt=now,
        ).select_related('etablissement', 'medecin', 'patient')

        if require_clinical_write:
            qs = qs.filter(niveau_acces='INTERVENTION_CLINIQUE')

        return qs.first()

    @classmethod
    def evaluate_access(cls, user, patient_id, level=LEVEL_READ, request=None):
        """
        Évalue de manière complète les droits d'accès d'un utilisateur sur le dossier d'un patient donné.
        """
        if not cls.is_user_valid_professional(user):
            return {
                'allowed': False,
                'mode': None,
                'prise_en_charge': None,
                'autorisation_urgence': None,
                'can_write_clinical': False,
                'can_create_ordinary_consultation': False,
                'reason': "Compte professionnel inactif, suspendu, non approuvé ou établissement invalide.",
            }

        if level == cls.LEVEL_IDENTITY:
            if user.role in ('MEDECIN', 'AGENT'):
                return {
                    'allowed': True,
                    'mode': 'ADMINISTRATIVE_IDENTITY',
                    'prise_en_charge': None,
                    'autorisation_urgence': None,
                    'can_write_clinical': False,
                    'can_create_ordinary_consultation': False,
                    'reason': "Accès administratif d'identification autorisé.",
                }
            return {
                'allowed': False,
                'mode': None,
                'prise_en_charge': None,
                'autorisation_urgence': None,
                'can_write_clinical': False,
                'can_create_ordinary_consultation': False,
                'reason': "Ce rôle n'est pas autorisé à accéder au référentiel d'identification des patients.",
            }

        if not cls.is_active_approved_doctor(user):
            # Droits de supervision institutionnelle en lecture seule pour le Directeur d'établissement
            if getattr(user, 'role', None) == 'DIRECTEUR' and level == cls.LEVEL_READ and user.etablissement_id:
                has_pec = PriseEnCharge.objects.filter(patient_id=patient_id, etablissement_id=user.etablissement_id).exists()
                from care_management.models import Transfert
                has_transfer = Transfert.objects.filter(
                    Q(etablissement_origine_id=user.etablissement_id) | Q(etablissement_destination_id=user.etablissement_id),
                    patient_id=patient_id
                ).exists()
                from patients.models import Patient
                is_creator = Patient.objects.filter(id=patient_id, etablissement_creation_id=user.etablissement_id).exists()

                if has_pec or has_transfer or is_creator:
                    return {
                        'allowed': True,
                        'mode': 'DIRECTOR_OVERSIGHT',
                        'prise_en_charge': None,
                        'autorisation_urgence': None,
                        'can_write_clinical': False,
                        'can_create_ordinary_consultation': False,
                        'reason': "Accès en lecture autorisé au titre de la direction et supervision institutionnelle de l'établissement.",
                    }
                return {
                    'allowed': False,
                    'mode': None,
                    'prise_en_charge': None,
                    'autorisation_urgence': None,
                    'can_write_clinical': False,
                    'can_create_ordinary_consultation': False,
                    'reason': "Accès refusé : ce patient n'a aucune prise en charge, transfert ni création associée à votre établissement.",
                }

            return {
                'allowed': False,
                'mode': None,
                'prise_en_charge': None,
                'autorisation_urgence': None,
                'can_write_clinical': False,
                'can_create_ordinary_consultation': False,
                'reason': "Accès refusé : seuls les médecins en exercice habilités peuvent accéder aux données cliniques.",
            }

        # 1. Vérification d'une prise en charge ordinaire active
        pec = cls.get_active_ordinary_care_for_doctor(user, patient_id)
        if pec:
            return {
                'allowed': True,
                'mode': 'ORDINARY_CARE',
                'prise_en_charge': pec,
                'autorisation_urgence': None,
                'can_write_clinical': True,
                'can_create_ordinary_consultation': True,
                'reason': "Accès autorisé au titre de la prise en charge ordinaire active.",
            }

        # 2. Une consultation ordinaire exige obligatoirement une prise en charge ordinaire active
        if level == cls.LEVEL_ORDINARY_CONSULTATION:
            return {
                'allowed': False,
                'mode': None,
                'prise_en_charge': None,
                'autorisation_urgence': None,
                'can_write_clinical': False,
                'can_create_ordinary_consultation': False,
                'reason': (
                    "Action non autorisée : vous devez disposer d'une prise en charge ordinaire active "
                    "pour ce patient dans votre établissement avant de créer une consultation ordinaire."
                ),
            }

        # 3. Vérification d'une autorisation exceptionnelle d'urgence valide
        require_write = level in (cls.LEVEL_WRITE, cls.LEVEL_EMERGENCY)
        auth_urg = cls.get_valid_emergency_authorization_for_doctor(
            user=user,
            patient_id=patient_id,
            require_clinical_write=require_write,
            request=request,
        )
        if auth_urg:
            return {
                'allowed': True,
                'mode': 'EMERGENCY_ACCESS',
                'prise_en_charge': None,
                'autorisation_urgence': auth_urg,
                'can_write_clinical': auth_urg.autorise_modification_clinique,
                'can_create_ordinary_consultation': False,
                'reason': "Accès autorisé au titre d'une autorisation exceptionnelle d'urgence active.",
            }

        # Si le médecin avait une autorisation d'urgence en lecture seule mais tente une écriture
        if require_write:
            read_only_urg = cls.get_valid_emergency_authorization_for_doctor(
                user=user,
                patient_id=patient_id,
                require_clinical_write=False,
                request=request,
            )
            if read_only_urg:
                return {
                    'allowed': False,
                    'mode': None,
                    'prise_en_charge': None,
                    'autorisation_urgence': read_only_urg,
                    'can_write_clinical': False,
                    'can_create_ordinary_consultation': False,
                    'reason': (
                        "Opération clinique refusée : votre autorisation d'urgence actuelle est "
                        "strictement limitée à la lecture seule du dossier médical."
                    ),
                }

        return {
            'allowed': False,
            'mode': None,
            'prise_en_charge': None,
            'autorisation_urgence': None,
            'can_write_clinical': False,
            'can_create_ordinary_consultation': False,
            'reason': (
                "Accès au dossier médical non autorisé. Aucune prise en charge active ne vous donne "
                "actuellement accès à ce dossier."
            ),
        }

    @classmethod
    def require_access(cls, user, patient_id, level=LEVEL_READ, entite_type='DossierMedical', entite_id='', request=None):
        """
        Vérifie l'autorisation et lève une `PermissionDenied` (HTTP 403) tout en journalisant
        la tentative refusée dans `JournalAcces` si les conditions ne sont pas réunies.
        """
        evaluation = cls.evaluate_access(user=user, patient_id=patient_id, level=level, request=request)
        if not evaluation['allowed']:
            if user and user.is_authenticated:
                enregistrer_journal(
                    action='PERMISSION_DENIED',
                    utilisateur=user,
                    etablissement=getattr(user, 'etablissement', None),
                    statut='REFUSE',
                    entite_type=entite_type,
                    entite_id=str(entite_id or patient_id or ''),
                    details={
                        'patient_id': patient_id,
                        'niveau_requis': level,
                        'role': getattr(user, 'role', ''),
                        'motif': evaluation['reason'],
                    },
                    request=request,
                )
            raise PermissionDenied(detail=evaluation['reason'])
        return evaluation

    @classmethod
    def get_authorized_patient_ids_for_doctor(cls, user, require_write=False):
        """
        Retourne l'ensemble des identifiants de patients (`patient_id`) pour lesquels le médecin
        connecté possède actuellement une PriseEnCharge ordinaire active OU une AutorisationUrgence valide.
        """
        if not cls.is_active_approved_doctor(user):
            return set()

        cls.expire_outdated_emergency_authorizations(medecin_id=user.id)
        now = timezone.now()

        pec_patient_ids = set(
            PriseEnCharge.objects.filter(
                etablissement_id=user.etablissement_id,
                statut='ACTIF',
                type_prise_en_charge='ORDINAIRE',
            ).filter(
                Q(medecin_responsable_id=user.id) | Q(medecin_responsable__isnull=True)
            ).values_list('patient_id', flat=True)
        )

        urg_qs = AutorisationUrgence.objects.filter(
            medecin_id=user.id,
            etablissement_id=user.etablissement_id,
            statut='ACTIVE',
            date_expiration__gt=now,
        )
        if require_write:
            urg_qs = urg_qs.filter(niveau_acces='INTERVENTION_CLINIQUE')

        urg_patient_ids = set(urg_qs.values_list('patient_id', flat=True))
        return pec_patient_ids | urg_patient_ids

    @classmethod
    def get_authorized_patient_ids(cls, user, require_write=False):
        return cls.get_authorized_patient_ids_for_doctor(user=user, require_write=require_write)

    @classmethod
    def evaluate(cls, user, patient_or_id, level=LEVEL_READ, action_label='', request=None, log_denied=True, **kwargs):
        from types import SimpleNamespace
        patient_id = patient_or_id.id if hasattr(patient_or_id, 'id') else patient_or_id
        ev = cls.evaluate_access(user=user, patient_id=patient_id, level=level, request=request)
        if not ev['allowed'] and log_denied and user and getattr(user, 'is_authenticated', False):
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=user,
                etablissement=getattr(user, 'etablissement', None),
                statut='REFUSE',
                entite_type='DossierMedical',
                entite_id=str(patient_id or ''),
                details={
                    'patient_id': patient_id,
                    'niveau_requis': level,
                    'action': action_label,
                    'motif': ev['reason'],
                },
                request=request,
            )
        return SimpleNamespace(**ev)


class CanAccessPatientMedicalRecord(permissions.BasePermission):
    """
    Permission centralisée vérifiant :
    - Au niveau vue (`has_permission`) : que l'utilisateur est un médecin actif, approuvé,
      rattaché à un établissement actif.
    - Au niveau objet (`has_object_permission`) : qu'il dispose d'une PriseEnCharge ordinaire active
      ou d'une AutorisationUrgence valide sur le patient rattaché à l'objet clinique.
    """

    def has_permission(self, request, view):
        if not MedicalRecordAccessService.is_user_valid_professional(request.user):
            return False
        if getattr(request.user, 'role', None) == 'MEDECIN':
            return True
        if getattr(request.user, 'role', None) == 'DIRECTEUR' and request.method in permissions.SAFE_METHODS:
            return True
        return False

    def has_object_permission(self, request, view, obj):
        patient_id = self._extract_patient_id(obj)
        if not patient_id:
            return False

        level = (
            MedicalRecordAccessService.LEVEL_READ
            if request.method in permissions.SAFE_METHODS
            else MedicalRecordAccessService.LEVEL_WRITE
        )
        evaluation = MedicalRecordAccessService.evaluate_access(
            user=request.user,
            patient_id=patient_id,
            level=level,
            request=request,
        )
        return evaluation['allowed']

    @staticmethod
    def _extract_patient_id(obj):
        if hasattr(obj, 'patient_id') and obj.patient_id:
            return obj.patient_id
        if hasattr(obj, 'dossier') and obj.dossier is not None:
            return obj.dossier.patient_id
        return None

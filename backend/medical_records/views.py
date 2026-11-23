from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import DossierMedical, Antecedent, Allergie, TraitementActuel, ExamenComplementaire
from .serializers import (
    DossierMedicalDetailSerializer,
    AntecedentSerializer,
    AllergieSerializer,
    TraitementActuelSerializer,
    ExamenComplementaireSerializer,
)
from .access_control import MedicalRecordAccessService
from accounts.permissions import CanAccessMedicalRecord
from audit.models import enregistrer_journal


class DossierMedicalViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Accès sécurisé au dossier médical unique :
    - Strictement réservé aux médecins en exercice actifs et approuvés.
    - Exige obligatoirement une PriseEnCharge ordinaire active (dans l'établissement du médecin
      et sous sa responsabilité) OU une AutorisationUrgence active et non expirée.
    """
    queryset = DossierMedical.objects.all().select_related('patient')
    serializer_class = DossierMedicalDetailSerializer
    permission_classes = [CanAccessMedicalRecord]

    def permission_denied(self, request, message=None, code=None):
        if request.user and request.user.is_authenticated:
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=request.user,
                etablissement=getattr(request.user, 'etablissement', None),
                statut='REFUSE',
                entite_type='DossierMedical',
                details={'motif': message or f"Tentative d'accès non autorisée au dossier clinique par {request.user.role}"},
                request=request,
            )
        super().permission_denied(request, message=message, code=code)

    def get_queryset(self):
        user = self.request.user
        if getattr(user, 'role', None) == 'DIRECTEUR' and user.etablissement_id:
            from care_management.models import PriseEnCharge, Transfert
            from patients.models import Patient
            from django.db.models import Q
            pec_patient_ids = set(PriseEnCharge.objects.filter(etablissement_id=user.etablissement_id).values_list('patient_id', flat=True))
            transfer_patient_ids = set(Transfert.objects.filter(
                Q(etablissement_origine_id=user.etablissement_id) | Q(etablissement_destination_id=user.etablissement_id)
            ).values_list('patient_id', flat=True))
            created_patient_ids = set(Patient.objects.filter(etablissement_creation_id=user.etablissement_id).values_list('id', flat=True))
            authorized_ids = pec_patient_ids | transfer_patient_ids | created_patient_ids
            return DossierMedical.objects.filter(patient_id__in=authorized_ids).select_related('patient')

        authorized_ids = MedicalRecordAccessService.get_authorized_patient_ids_for_doctor(self.request.user)
        return DossierMedical.objects.filter(patient_id__in=authorized_ids).select_related('patient')

    def retrieve(self, request, *args, **kwargs):
        instance = get_object_or_404(DossierMedical.objects.select_related('patient'), pk=kwargs.get('pk'))
        evaluation = MedicalRecordAccessService.require_access(
            user=request.user,
            patient_id=instance.patient_id,
            level=MedicalRecordAccessService.LEVEL_READ,
            entite_type='DossierMedical',
            entite_id=instance.id,
            request=request,
        )
        enregistrer_journal(
            action='VIEW_MEDICAL_RECORD',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='DossierMedical',
            entite_id=instance.id,
            details={
                'patient_id': instance.patient_id,
                'medtransfer_id': instance.patient.medtransfer_id,
                'mode_acces': evaluation['mode'],
            },
            request=request,
        )
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='by-patient/(?P<patient_id>[^/.]+)')
    def get_by_patient(self, request, patient_id=None):
        """
        Récupère le dossier médical unique d'un patient donné par son ID,
        uniquement si le médecin dispose d'une PriseEnCharge active ou d'une AutorisationUrgence valide.
        """
        try:
            dossier = DossierMedical.objects.select_related('patient').get(patient_id=patient_id)
        except (DossierMedical.DoesNotExist, ValueError):
            return Response(
                {'detail': "Dossier médical introuvable pour ce patient."},
                status=status.HTTP_404_NOT_FOUND,
            )

        evaluation = MedicalRecordAccessService.require_access(
            user=request.user,
            patient_id=dossier.patient_id,
            level=MedicalRecordAccessService.LEVEL_READ,
            entite_type='DossierMedical',
            entite_id=dossier.id,
            request=request,
        )

        enregistrer_journal(
            action='VIEW_MEDICAL_RECORD',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='DossierMedical',
            entite_id=dossier.id,
            details={
                'patient_id': dossier.patient_id,
                'medtransfer_id': dossier.patient.medtransfer_id,
                'mode_acces': evaluation['mode'],
            },
            request=request,
        )
        serializer = self.get_serializer(dossier)
        return Response(serializer.data)


class BaseClinicalElementViewSet(viewsets.ModelViewSet):
    """
    Socle sécurisé commun pour les éléments cliniques rattachés à un DossierMedical :
    - Filtrage systématique par les patients autorisés du médecin.
    - Vérification stricte de la relation de soin en lecture (`LEVEL_READ`) et écriture (`LEVEL_WRITE`).
    - Interdiction de réaffecter un élément clinique à un autre dossier.
    - Interdiction de suppression physique (`DELETE`) pour préserver l'intégrité médicolégale.
    """
    permission_classes = [CanAccessMedicalRecord]
    entity_label = 'ElementClinique'
    audit_create_action = None
    audit_update_action = None

    def permission_denied(self, request, message=None, code=None):
        if request.user and request.user.is_authenticated:
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=request.user,
                etablissement=getattr(request.user, 'etablissement', None),
                statut='REFUSE',
                entite_type=self.entity_label,
                details={'motif': message or f"Accès refusé sur {self.entity_label} pour {request.user.role}"},
                request=request,
            )
        super().permission_denied(request, message=message, code=code)

    def _get_base_queryset(self):
        return self.queryset

    def get_queryset(self):
        authorized_ids = MedicalRecordAccessService.get_authorized_patient_ids_for_doctor(self.request.user)
        qs = self._get_base_queryset().filter(dossier__patient_id__in=authorized_ids)
        dossier_id = self.request.query_params.get('dossier')
        if dossier_id:
            qs = qs.filter(dossier_id=dossier_id)
        return qs

    def list(self, request, *args, **kwargs):
        dossier_id = request.query_params.get('dossier')
        if dossier_id:
            dossier = get_object_or_404(DossierMedical, pk=dossier_id)
            MedicalRecordAccessService.require_access(
                user=request.user,
                patient_id=dossier.patient_id,
                level=MedicalRecordAccessService.LEVEL_READ,
                entite_type=self.entity_label,
                entite_id=dossier.id,
                request=request,
            )
        return super().list(request, *args, **kwargs)

    def get_object(self):
        obj = get_object_or_404(self._get_base_queryset().select_related('dossier'), pk=self.kwargs.get('pk'))
        level = (
            MedicalRecordAccessService.LEVEL_READ
            if self.request.method in ('GET', 'HEAD', 'OPTIONS')
            else MedicalRecordAccessService.LEVEL_WRITE
        )
        MedicalRecordAccessService.require_access(
            user=self.request.user,
            patient_id=obj.dossier.patient_id,
            level=level,
            entite_type=self.entity_label,
            entite_id=obj.id,
            request=self.request,
        )
        return obj

    def _verify_write_on_dossier_payload(self, request, existing_instance=None):
        dossier_id = request.data.get('dossier')
        if existing_instance is not None:
            if dossier_id is not None and str(dossier_id) != str(existing_instance.dossier_id):
                enregistrer_journal(
                    action='PERMISSION_DENIED',
                    utilisateur=request.user,
                    etablissement=getattr(request.user, 'etablissement', None),
                    statut='REFUSE',
                    entite_type=self.entity_label,
                    entite_id=existing_instance.id,
                    details={'motif': "Tentative interdite de réaffectation de dossier médical."},
                    request=request,
                )
                raise PermissionDenied("Impossible de réaffecter cet élément clinique à un autre dossier médical.")
            target_dossier = existing_instance.dossier
        else:
            if not dossier_id:
                raise ValidationError({'dossier': "L'identifiant du dossier médical est obligatoire."})
            target_dossier = get_object_or_404(DossierMedical, pk=dossier_id)

        MedicalRecordAccessService.require_access(
            user=request.user,
            patient_id=target_dossier.patient_id,
            level=MedicalRecordAccessService.LEVEL_WRITE,
            entite_type=self.entity_label,
            entite_id=existing_instance.id if existing_instance else target_dossier.id,
            request=request,
        )
        return target_dossier

    def create(self, request, *args, **kwargs):
        self._verify_write_on_dossier_payload(request, existing_instance=None)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._verify_write_on_dossier_payload(request, existing_instance=instance)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        enregistrer_journal(
            action='PERMISSION_DENIED',
            utilisateur=request.user,
            etablissement=getattr(request.user, 'etablissement', None),
            statut='REFUSE',
            entite_type=self.entity_label,
            entite_id=kwargs.get('pk', ''),
            details={'motif': f"Tentative de suppression physique interdite sur {self.entity_label}"},
            request=request,
        )
        raise PermissionDenied(
            f"La suppression physique d'un enregistrement {self.entity_label} est interdite pour garantir la traçabilité médicolégale."
        )


class AntecedentViewSet(BaseClinicalElementViewSet):
    queryset = Antecedent.objects.all().select_related('dossier', 'enregistre_par')
    serializer_class = AntecedentSerializer
    entity_label = 'Antecedent'

    def perform_create(self, serializer):
        instance = serializer.save(enregistre_par=self.request.user)
        enregistrer_journal(
            action='CREATE_ANTECEDENT',
            utilisateur=self.request.user,
            etablissement=getattr(self.request.user, 'etablissement', None),
            statut='SUCCES',
            entite_type='Antecedent',
            entite_id=instance.id,
            details={'patient_id': instance.dossier.patient_id, 'type': instance.type_antecedent},
            request=self.request,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        enregistrer_journal(
            action='UPDATE_ANTECEDENT',
            utilisateur=self.request.user,
            etablissement=getattr(self.request.user, 'etablissement', None),
            statut='SUCCES',
            entite_type='Antecedent',
            entite_id=instance.id,
            details={'patient_id': instance.dossier.patient_id, 'type': instance.type_antecedent},
            request=self.request,
        )


class AllergieViewSet(BaseClinicalElementViewSet):
    queryset = Allergie.objects.all().select_related('dossier', 'enregistre_par')
    serializer_class = AllergieSerializer
    entity_label = 'Allergie'

    def perform_create(self, serializer):
        instance = serializer.save(enregistre_par=self.request.user)
        enregistrer_journal(
            action='CREATE_ALLERGIE',
            utilisateur=self.request.user,
            etablissement=getattr(self.request.user, 'etablissement', None),
            statut='SUCCES',
            entite_type='Allergie',
            entite_id=instance.id,
            details={'patient_id': instance.dossier.patient_id, 'substance': instance.substance},
            request=self.request,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        enregistrer_journal(
            action='UPDATE_ALLERGIE',
            utilisateur=self.request.user,
            etablissement=getattr(self.request.user, 'etablissement', None),
            statut='SUCCES',
            entite_type='Allergie',
            entite_id=instance.id,
            details={'patient_id': instance.dossier.patient_id, 'substance': instance.substance},
            request=self.request,
        )


class TraitementActuelViewSet(BaseClinicalElementViewSet):
    """
    Gestion sécurisée des traitements actuels du dossier médical :
    - Vérifie systématiquement la PriseEnCharge active ou l'AutorisationUrgence valide sur le dossier.
    - Interdit toute lecture transversale des traitements d'autres patients.
    - Interdit toute réaffectation d'un traitement à un autre dossier.
    - Interdit toute suppression physique (`DELETE`).
    - Journalise toutes les créations, modifications, arrêts et refus d'accès.
    """
    queryset = TraitementActuel.objects.all().select_related('dossier', 'prescrit_par', 'modifie_par').order_by('-created_at')
    serializer_class = TraitementActuelSerializer
    entity_label = 'TraitementActuel'

    def perform_create(self, serializer):
        instance = serializer.save(prescrit_par=self.request.user)
        enregistrer_journal(
            action='CREATE_TREATMENT',
            utilisateur=self.request.user,
            etablissement=getattr(self.request.user, 'etablissement', None),
            statut='SUCCES',
            entite_type='TraitementActuel',
            entite_id=instance.id,
            details={
                'patient_id': instance.dossier.patient_id,
                'dossier_id': instance.dossier_id,
                'medicament': instance.medicament,
                'dosage': instance.dosage,
                'posologie': instance.posologie,
            },
            request=self.request,
        )

    def perform_update(self, serializer):
        was_active = serializer.instance.is_actif
        instance = serializer.save(modifie_par=self.request.user)
        audit_action = 'STOP_TREATMENT' if (was_active and not instance.is_actif) else 'UPDATE_TREATMENT'
        enregistrer_journal(
            action=audit_action,
            utilisateur=self.request.user,
            etablissement=getattr(self.request.user, 'etablissement', None),
            statut='SUCCES',
            entite_type='TraitementActuel',
            entite_id=instance.id,
            details={
                'patient_id': instance.dossier.patient_id,
                'dossier_id': instance.dossier_id,
                'medicament': instance.medicament,
                'posologie': instance.posologie,
                'is_actif': instance.is_actif,
            },
            request=self.request,
        )

    @action(detail=True, methods=['post'], url_path='stop')
    def stop_traitement(self, request, pk=None):
        """
        Arrête formellement un traitement actif après vérification stricte
        des droits d'écriture clinique du médecin sur le dossier concerné.
        """
        instance = self.get_object()  # Vérifie LEVEL_WRITE via get_object()
        motif = str(request.data.get('motif_arret') or 'Arrêt médical').strip()
        instance.arreter(medecin=request.user, motif=motif)

        enregistrer_journal(
            action='STOP_TREATMENT',
            utilisateur=request.user,
            etablissement=getattr(request.user, 'etablissement', None),
            statut='SUCCES',
            entite_type='TraitementActuel',
            entite_id=instance.id,
            details={
                'patient_id': instance.dossier.patient_id,
                'dossier_id': instance.dossier_id,
                'medicament': instance.medicament,
                'prescrit_par_id': instance.prescrit_par_id,
                'arrete_par_id': request.user.id,
                'motif_arret': motif,
            },
            request=request,
        )
        return Response(self.get_serializer(instance).data, status=status.HTTP_200_OK)


class ExamenComplementaireViewSet(BaseClinicalElementViewSet):
    queryset = ExamenComplementaire.objects.all().select_related('dossier', 'medecin', 'etablissement')
    serializer_class = ExamenComplementaireSerializer
    entity_label = 'ExamenComplementaire'

    def perform_create(self, serializer):
        etab = self.request.user.etablissement
        instance = serializer.save(medecin=self.request.user, etablissement=etab)
        enregistrer_journal(
            action='CREATE_EXAMEN',
            utilisateur=self.request.user,
            etablissement=etab,
            statut='SUCCES',
            entite_type='ExamenComplementaire',
            entite_id=instance.id,
            details={'patient_id': instance.dossier.patient_id, 'titre': instance.titre},
            request=self.request,
        )

    def perform_update(self, serializer):
        instance = serializer.save()
        enregistrer_journal(
            action='UPDATE_EXAMEN',
            utilisateur=self.request.user,
            etablissement=getattr(self.request.user, 'etablissement', None),
            statut='SUCCES',
            entite_type='ExamenComplementaire',
            entite_id=instance.id,
            details={'patient_id': instance.dossier.patient_id, 'titre': instance.titre},
            request=self.request,
        )

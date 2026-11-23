from rest_framework import serializers
from django.utils import timezone
from .models import Patient, PatientModificationHistory
from medical_records.models import DossierMedical
from establishments.models import Etablissement
from care_management.models import PriseEnCharge
from emergencies.models import AutorisationUrgence


def _compute_doctor_access_status(patient, request):
    user = getattr(request, 'user', None)
    if not user or not getattr(user, 'is_authenticated', False) or getattr(user, 'role', None) != 'MEDECIN':
        return False, None

    pec = patient.prises_en_charge.filter(
        statut='ACTIF',
        type_prise_en_charge='ORDINAIRE',
        etablissement_id=user.etablissement_id,
        medecin_responsable_id=user.id
    ).first()
    if pec:
        return True, 'ORDINARY_CARE'

    auth_urg = AutorisationUrgence.objects.filter(
        patient=patient,
        medecin=user,
        etablissement_id=user.etablissement_id,
        statut='ACTIVE',
        date_expiration__gt=timezone.now()
    ).first()
    if auth_urg:
        return True, 'EMERGENCY_ACCESS'

    return False, None


class PatientListSerializer(serializers.ModelSerializer):
    status_identite_display = serializers.CharField(source='get_status_identite_display', read_only=True)
    etablissement_creation = serializers.SerializerMethodField()
    etablissement_creation_code = serializers.CharField(source='etablissement_creation.code', read_only=True)
    etablissement_creation_nom = serializers.CharField(source='etablissement_creation.nom', read_only=True)
    prise_en_charge_active = serializers.SerializerMethodField()
    acces_clinique_autorise = serializers.SerializerMethodField()
    mode_acces_medecin = serializers.SerializerMethodField()
    is_disponible = serializers.SerializerMethodField()
    est_deja_pris_en_charge = serializers.SerializerMethodField()
    est_suivi_par_moi = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            'id', 'medtransfer_id', 'nom', 'prenom', 'date_naissance',
            'sexe', 'numero_identification_nationale', 'telephone',
            'ville', 'status_identite',
            'status_identite_display', 'is_provisional',
            'etablissement_creation',
            'etablissement_creation_code', 'etablissement_creation_nom',
            'prise_en_charge_active', 'acces_clinique_autorise', 'mode_acces_medecin',
            'is_disponible', 'est_deja_pris_en_charge', 'est_suivi_par_moi',
            'created_at'
        ]

    def get_etablissement_creation(self, obj):
        if obj.etablissement_creation:
            return {
                'id': obj.etablissement_creation.id,
                'code': obj.etablissement_creation.code,
                'nom': obj.etablissement_creation.nom,
                'ville': obj.etablissement_creation.ville
            }
        return None

    def get_prise_en_charge_active(self, obj):
        pec = obj.prises_en_charge.filter(
            statut='ACTIF', type_prise_en_charge='ORDINAIRE'
        ).select_related('etablissement', 'medecin_responsable').first()
        if pec:
            med_nom = f"Dr {pec.medecin_responsable.last_name}" if pec.medecin_responsable else "Non assigné"
            return {
                'id': pec.id,
                'etablissement_id': pec.etablissement.id,
                'etablissement_code': pec.etablissement.code,
                'etablissement_nom': pec.etablissement.nom,
                'medecin_responsable_id': pec.medecin_responsable_id,
                'medecin_nom': med_nom,
                'date_debut': pec.date_debut,
                'type': pec.type_prise_en_charge
            }
        return None

    def get_acces_clinique_autorise(self, obj):
        allowed, _ = _compute_doctor_access_status(obj, self.context.get('request'))
        return allowed

    def get_mode_acces_medecin(self, obj):
        _, mode = _compute_doctor_access_status(obj, self.context.get('request'))
        return mode

    def get_is_disponible(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False) or getattr(user, 'role', None) != 'MEDECIN':
            return False
        pec = obj.prises_en_charge.filter(
            statut='ACTIF', type_prise_en_charge='ORDINAIRE'
        ).select_related('etablissement', 'medecin_responsable').first()
        if not pec:
            return True
        if pec.medecin_responsable is None and pec.etablissement_id == user.etablissement_id:
            return True
        return False

    def get_est_deja_pris_en_charge(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        pec = obj.prises_en_charge.filter(
            statut='ACTIF', type_prise_en_charge='ORDINAIRE'
        ).select_related('medecin_responsable').first()
        if not pec or not pec.medecin_responsable_id:
            return False
        if user and user.is_authenticated and pec.medecin_responsable_id == user.id:
            return False
        return True

    def get_est_suivi_par_moi(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        pec = obj.prises_en_charge.filter(
            statut='ACTIF', type_prise_en_charge='ORDINAIRE'
        ).first()
        return bool(pec and pec.medecin_responsable_id == user.id)


class PatientDetailSerializer(serializers.ModelSerializer):
    status_identite_display = serializers.CharField(source='get_status_identite_display', read_only=True)
    etablissement_creation_details = serializers.SerializerMethodField()
    cree_par_nom = serializers.SerializerMethodField()
    prise_en_charge_active = serializers.SerializerMethodField()
    acces_clinique_autorise = serializers.SerializerMethodField()
    mode_acces_medecin = serializers.SerializerMethodField()
    is_disponible = serializers.SerializerMethodField()
    est_deja_pris_en_charge = serializers.SerializerMethodField()
    est_suivi_par_moi = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            'id', 'medtransfer_id', 'nom', 'prenom', 'date_naissance',
            'sexe', 'numero_identification_nationale', 'telephone',
            'adresse', 'ville', 'groupe_sanguin',
            'personne_contact_nom', 'personne_contact_telephone',
            'status_identite', 'status_identite_display', 'is_provisional',
            'motif_identite_provisoire',
            'etablissement_creation', 'etablissement_creation_details',
            'cree_par', 'cree_par_nom',
            'reconciled_with', 'reconciled_at', 'reconciled_by',
            'prise_en_charge_active', 'acces_clinique_autorise', 'mode_acces_medecin',
            'is_disponible', 'est_deja_pris_en_charge', 'est_suivi_par_moi',
            'created_at', 'updated_at'
        ]

    def get_etablissement_creation_details(self, obj):
        if obj.etablissement_creation:
            return {
                'id': obj.etablissement_creation.id,
                'code': obj.etablissement_creation.code,
                'nom': obj.etablissement_creation.nom,
                'ville': obj.etablissement_creation.ville
            }
        return None

    def get_cree_par_nom(self, obj):
        if obj.cree_par:
            return f"{obj.cree_par.first_name} {obj.cree_par.last_name}".strip() or obj.cree_par.username
        return None

    def get_prise_en_charge_active(self, obj):
        pec = obj.prises_en_charge.filter(
            statut='ACTIF', type_prise_en_charge='ORDINAIRE'
        ).select_related('etablissement', 'medecin_responsable').first()
        if pec:
            med_nom = f"Dr {pec.medecin_responsable.last_name}" if pec.medecin_responsable else "Non assigné"
            return {
                'id': pec.id,
                'etablissement_id': pec.etablissement.id,
                'etablissement_code': pec.etablissement.code,
                'etablissement_nom': pec.etablissement.nom,
                'medecin_responsable_id': pec.medecin_responsable_id,
                'medecin_nom': med_nom,
                'date_debut': pec.date_debut,
                'type': pec.type_prise_en_charge
            }
        return None

    def get_acces_clinique_autorise(self, obj):
        allowed, _ = _compute_doctor_access_status(obj, self.context.get('request'))
        return allowed

    def get_mode_acces_medecin(self, obj):
        _, mode = _compute_doctor_access_status(obj, self.context.get('request'))
        return mode

    def get_is_disponible(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False) or getattr(user, 'role', None) != 'MEDECIN':
            return False
        pec = obj.prises_en_charge.filter(
            statut='ACTIF', type_prise_en_charge='ORDINAIRE'
        ).select_related('etablissement', 'medecin_responsable').first()
        if not pec:
            return True
        if pec.medecin_responsable is None and pec.etablissement_id == user.etablissement_id:
            return True
        return False

    def get_est_deja_pris_en_charge(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        pec = obj.prises_en_charge.filter(
            statut='ACTIF', type_prise_en_charge='ORDINAIRE'
        ).select_related('medecin_responsable').first()
        if not pec or not pec.medecin_responsable_id:
            return False
        if user and user.is_authenticated and pec.medecin_responsable_id == user.id:
            return False
        return True

    def get_est_suivi_par_moi(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return False
        pec = obj.prises_en_charge.filter(
            statut='ACTIF', type_prise_en_charge='ORDINAIRE'
        ).first()
        return bool(pec and pec.medecin_responsable_id == user.id)


class PatientCreateSerializer(serializers.ModelSerializer):
    """
    Création administrative d'un patient.
    Génère automatiquement son dossier médical principal unique.
    """
    class Meta:
        model = Patient
        fields = [
            'nom', 'prenom', 'date_naissance', 'sexe',
            'numero_identification_nationale', 'telephone',
            'adresse', 'ville', 'groupe_sanguin',
            'personne_contact_nom', 'personne_contact_telephone'
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user
        etablissement = user.etablissement
        if not etablissement:
            etablissement = Etablissement.objects.first()

        patient = Patient.objects.create(
            **validated_data,
            etablissement_creation=etablissement,
            cree_par=user,
            status_identite='CONFIRMEE'
        )

        # Création systématique et atomique du dossier médical unique
        DossierMedical.objects.get_or_create(patient=patient)

        # Initialisation systématique de la prise en charge ordinaire active dans l'établissement
        if etablissement:
            medecin_resp = user if getattr(user, 'role', None) == 'MEDECIN' else None
            PriseEnCharge.objects.get_or_create(
                patient=patient,
                statut='ACTIF',
                type_prise_en_charge='ORDINAIRE',
                defaults={
                    'etablissement': etablissement,
                    'medecin_responsable': medecin_resp,
                    'date_debut': timezone.now()
                }
            )

        return patient


class PatientProvisionalCreateSerializer(serializers.ModelSerializer):
    """Création d'une identité provisoire en urgence (A_CONFIRMER)."""
    motif_identite_provisoire = serializers.CharField(required=True)

    class Meta:
        model = Patient
        fields = [
            'nom', 'prenom', 'sexe', 'date_naissance',
            'telephone', 'ville', 'groupe_sanguin',
            'motif_identite_provisoire'
        ]

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user
        etablissement = user.etablissement or Etablissement.objects.first()

        patient = Patient.objects.create(
            **validated_data,
            etablissement_creation=etablissement,
            cree_par=user,
            status_identite='A_CONFIRMER'
        )
        DossierMedical.objects.get_or_create(patient=patient)

        # Initialisation systématique de la prise en charge d'urgence
        if etablissement:
            medecin_resp = user if getattr(user, 'role', None) == 'MEDECIN' else None
            PriseEnCharge.objects.get_or_create(
                patient=patient,
                statut='ACTIF',
                type_prise_en_charge='URGENCE',
                defaults={
                    'etablissement': etablissement,
                    'medecin_responsable': medecin_resp,
                    'date_debut': timezone.now()
                }
            )

        return patient


class PatientReconciliationSerializer(serializers.Serializer):
    """Rapprochement contrôlé d'une fiche provisoire vers une fiche définitive."""
    target_patient_id = serializers.IntegerField(required=True)
    motif = serializers.CharField(required=True)


class PatientModificationHistorySerializer(serializers.ModelSerializer):
    """Historique des corrections administratives apportées à une fiche patient."""
    auteur_nom = serializers.SerializerMethodField()
    etablissement_nom = serializers.SerializerMethodField()

    class Meta:
        model = PatientModificationHistory
        fields = [
            'id', 'patient', 'auteur', 'auteur_nom',
            'etablissement', 'etablissement_nom',
            'date_modification', 'motif', 'champs_modifies'
        ]

    def get_auteur_nom(self, obj):
        if not obj.auteur:
            return "Système"
        return f"{obj.auteur.first_name} {obj.auteur.last_name}".strip() or obj.auteur.username

    def get_etablissement_nom(self, obj):
        return obj.etablissement.nom if obj.etablissement else "—"


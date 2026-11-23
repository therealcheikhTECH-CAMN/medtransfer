from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from .models import InterventionUrgence, AutorisationUrgence
from consultations.models import Consultation
from medical_records.models import DossierMedical
from medical_records.access_control import MedicalRecordAccessService
from patients.models import Patient
from care_management.models import PriseEnCharge
from notifications.models import Notification
from audit.models import enregistrer_journal


class AutorisationUrgenceSerializer(serializers.ModelSerializer):
    etablissement_nom = serializers.CharField(source='etablissement.nom', read_only=True)
    etablissement_code = serializers.CharField(source='etablissement.code', read_only=True)
    medecin_nom = serializers.SerializerMethodField()
    patient_nom = serializers.SerializerMethodField()
    patient_medtransfer_id = serializers.CharField(source='patient.medtransfer_id', read_only=True)
    est_valide = serializers.BooleanField(read_only=True)

    class Meta:
        model = AutorisationUrgence
        fields = [
            'id', 'patient', 'patient_nom', 'patient_medtransfer_id',
            'medecin', 'medecin_nom', 'etablissement', 'etablissement_nom', 'etablissement_code',
            'motif_urgence', 'justification_acces', 'niveau_acces', 'statut',
            'date_debut', 'date_expiration', 'date_revocation',
            'revoquee_par', 'motif_revocation', 'est_valide'
        ]
        read_only_fields = [
            'id', 'medecin', 'etablissement', 'statut',
            'date_debut', 'date_revocation', 'revoquee_par', 'motif_revocation', 'est_valide'
        ]

    def get_medecin_nom(self, obj):
        return f"Dr {obj.medecin.last_name}" if obj.medecin else ""

    def get_patient_nom(self, obj):
        return f"{obj.patient.nom.upper()} {obj.patient.prenom}"


class AutorisationUrgenceRequestSerializer(serializers.Serializer):
    """
    Ouverture préalable d'une autorisation exceptionnelle d'urgence (« Break-Glass »)
    limitée dans le temps et strictement tracée.
    """
    patient_id = serializers.IntegerField(required=True)
    motif_urgence = serializers.CharField(required=True)
    justification_acces = serializers.CharField(required=False, allow_blank=True)
    justification_acces_derogatoire = serializers.CharField(required=False, allow_blank=True)
    niveau_acces = serializers.ChoiceField(
        choices=AutorisationUrgence.NIVEAU_CHOICES,
        default='INTERVENTION_CLINIQUE',
        required=False
    )
    duree_minutes = serializers.IntegerField(required=False, min_value=5)

    def validate(self, attrs):
        motif = (attrs.get('motif_urgence') or '').strip()
        justification = (
            attrs.get('justification_acces')
            or attrs.get('justification_acces_derogatoire')
            or ''
        ).strip()

        if not motif:
            raise serializers.ValidationError({'motif_urgence': "Le motif médical d'urgence est obligatoire."})
        if not justification:
            raise serializers.ValidationError({
                'justification_acces': "La justification dérogatoire détaillant la situation clinique est obligatoire."
            })

        try:
            patient = Patient.objects.get(pk=attrs['patient_id'])
        except Patient.DoesNotExist:
            raise serializers.ValidationError({'patient_id': "Patient introuvable."})

        default_duration = getattr(settings, 'EMERGENCY_ACCESS_DURATION_MINUTES', 120)
        max_duration = getattr(settings, 'EMERGENCY_ACCESS_MAX_DURATION_MINUTES', 240)
        duree = attrs.get('duree_minutes') or default_duration
        if duree > max_duration:
            duree = max_duration

        attrs['motif_urgence'] = motif
        attrs['justification_acces'] = justification
        attrs['duree_minutes'] = duree
        attrs['_patient'] = patient
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user
        etab = user.etablissement
        patient = validated_data['_patient']
        now = timezone.now()

        # Expirer les anciennes autorisations dépassées
        MedicalRecordAccessService.expire_outdated_emergency_authorizations(
            patient=patient, user=user, request=request
        )

        # Révoquer d'éventuelles autorisations actives précédentes du même médecin sur ce patient
        AutorisationUrgence.objects.filter(
            patient=patient,
            medecin=user,
            statut='ACTIVE'
        ).update(
            statut='REVOQUEE',
            date_revocation=now,
            revoquee_par=user,
            motif_revocation="Remplacée par une nouvelle demande d'autorisation d'urgence"
        )

        date_expiration = now + timedelta(minutes=validated_data['duree_minutes'])
        autorisation = AutorisationUrgence.objects.create(
            patient=patient,
            medecin=user,
            etablissement=etab,
            motif_urgence=validated_data['motif_urgence'],
            justification_acces=validated_data['justification_acces'],
            niveau_acces=validated_data.get('niveau_acces', 'INTERVENTION_CLINIQUE'),
            statut='ACTIVE',
            date_expiration=date_expiration
        )

        # Notification vers le médecin responsable et l'établissement détenteur de la prise en charge active
        pec_active = PriseEnCharge.objects.filter(
            patient=patient,
            statut='ACTIF',
            type_prise_en_charge='ORDINAIRE'
        ).select_related('etablissement', 'medecin_responsable').first()

        if pec_active and (pec_active.medecin_responsable_id != user.id or pec_active.etablissement_id != etab.id):
            Notification.objects.create(
                destinataire=pec_active.medecin_responsable,
                etablissement_cible=pec_active.etablissement,
                type_notification='URGENCE_EXTERNE',
                titre=f"Accès d'urgence dérogatoire : {patient.nom.upper()} {patient.prenom}",
                message=(
                    f"Le Dr {user.last_name} ({etab.nom}) a ouvert un accès exceptionnel d'urgence "
                    f"({autorisation.get_niveau_acces_display()}) au dossier médical de votre patient "
                    f"{patient.nom.upper()} {patient.prenom}. "
                    f"Motif : {autorisation.motif_urgence}. Justification : {autorisation.justification_acces}."
                ),
                reference_objet_type='AutorisationUrgence',
                reference_objet_id=str(autorisation.id)
            )

        enregistrer_journal(
            action='EMERGENCY_ACCESS',
            utilisateur=user,
            etablissement=etab,
            statut='SUCCES',
            entite_type='AutorisationUrgence',
            entite_id=autorisation.id,
            details={
                'patient_id': patient.id,
                'autorisation_urgence_id': autorisation.id,
                'niveau_acces': autorisation.niveau_acces,
                'motif_urgence': autorisation.motif_urgence,
                'justification_acces': autorisation.justification_acces,
                'date_expiration': autorisation.date_expiration.isoformat(),
            },
            request=request
        )

        return autorisation


class InterventionUrgenceSerializer(serializers.ModelSerializer):
    etablissement_nom = serializers.CharField(source='etablissement.nom', read_only=True)
    etablissement_code = serializers.CharField(source='etablissement.code', read_only=True)
    medecin_nom = serializers.SerializerMethodField()
    patient_nom = serializers.SerializerMethodField()
    patient_medtransfer_id = serializers.CharField(source='patient.medtransfer_id', read_only=True)

    class Meta:
        model = InterventionUrgence
        fields = '__all__'

    def get_medecin_nom(self, obj):
        return f"Dr {obj.medecin.last_name} ({obj.medecin.specialite})" if obj.medecin else ""

    def get_patient_nom(self, obj):
        return f"{obj.patient.nom.upper()} {obj.patient.prenom}"


class InterventionUrgenceCreateSerializer(serializers.Serializer):
    """
    Enregistrement d'une intervention d'urgence dérogatoire :
    Crée l'acte clinique dans le dossier unique sans altérer la prise en charge d'origine.
    S'appuie sur une AutorisationUrgence active de niveau INTERVENTION_CLINIQUE
    (ou l'ouvre de manière atomique et temporisée si le motif et la justification sont fournis).
    """
    patient_id = serializers.IntegerField(required=True)
    motif_urgence = serializers.CharField(required=True)
    justification_acces_derogatoire = serializers.CharField(required=True)

    # Données cliniques de l'urgence
    observations_cliniques = serializers.CharField(required=True)
    diagnostic = serializers.CharField(required=False, allow_blank=True)
    prescription = serializers.CharField(required=False, allow_blank=True)
    conclusions_recommandations = serializers.CharField(required=False, allow_blank=True)
    constantes = serializers.JSONField(required=False, default=dict)
    operations_traitements = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
        help_text="Optionnel : uniquement si le médecin décide explicitement de poursuivre un traitement dans le dossier médical"
    )

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        try:
            patient = Patient.objects.get(pk=attrs['patient_id'])
        except Patient.DoesNotExist:
            raise serializers.ValidationError({'patient_id': "Patient introuvable."})

        MedicalRecordAccessService.expire_outdated_emergency_authorizations(
            patient=patient, user=user, request=request
        )

        # Si le médecin détient une autorisation d'urgence active mais limitée à LECTURE_SEULE,
        # refuser l'enregistrement d'un acte clinique.
        active_auth = AutorisationUrgence.objects.filter(
            patient=patient,
            medecin=user,
            etablissement=user.etablissement,
            statut='ACTIVE',
            date_expiration__gt=timezone.now()
        ).order_by('-date_debut').first()

        if active_auth and active_auth.niveau_acces == 'LECTURE_SEULE':
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=user,
                etablissement=user.etablissement,
                statut='REFUSE',
                entite_type='InterventionUrgence',
                entite_id=patient.id,
                details={
                    'patient_id': patient.id,
                    'autorisation_urgence_id': active_auth.id,
                    'reason': "Autorisation d'urgence en lecture seule : intervention clinique interdite."
                },
                request=request
            )
            raise PermissionDenied(
                "Votre autorisation d'urgence actuelle est en lecture seule et ne permet pas d'enregistrer une intervention clinique."
            )

        attrs['_patient'] = patient
        attrs['_active_auth'] = active_auth
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        user = request.user
        etab = user.etablissement

        patient = validated_data['_patient']
        active_auth = validated_data.get('_active_auth')
        dossier, _ = DossierMedical.objects.get_or_create(patient=patient)

        # Si aucune autorisation active n'existe encore, créer une AutorisationUrgence temporisée (2h)
        # afin que tout accès d'urgence soit gouverné par une autorisation limitée dans le temps et révocable.
        if not active_auth:
            duration_minutes = getattr(settings, 'EMERGENCY_ACCESS_DURATION_MINUTES', 120)
            active_auth = AutorisationUrgence.objects.create(
                patient=patient,
                medecin=user,
                etablissement=etab,
                motif_urgence=validated_data['motif_urgence'],
                justification_acces=validated_data['justification_acces_derogatoire'],
                niveau_acces='INTERVENTION_CLINIQUE',
                statut='ACTIVE',
                date_expiration=timezone.now() + timedelta(minutes=duration_minutes)
            )

        # 1. Création de la consultation d'urgence rattachée au dossier existant
        consultation = Consultation.objects.create(
            dossier=dossier,
            etablissement=etab,
            medecin=user,
            motif=f"[URGENCE] {validated_data['motif_urgence']}",
            constantes=validated_data.get('constantes', {}),
            observations_cliniques=validated_data['observations_cliniques'],
            diagnostic=validated_data.get('diagnostic', ''),
            prescription=validated_data.get('prescription', ''),
            conclusions_recommandations=validated_data.get('conclusions_recommandations', ''),
            is_emergency=True
        )

        operations_traitements = validated_data.get('operations_traitements') or []
        if operations_traitements:
            from medical_records.models import appliquer_operations_traitements
            appliquer_operations_traitements(
                dossier=dossier,
                operations=operations_traitements,
                user=user,
                consultation=consultation,
                request=request
            )

        # 2. Création de la fiche d'intervention d'urgence rattachée à l'AutorisationUrgence
        intervention = InterventionUrgence.objects.create(
            patient=patient,
            etablissement=etab,
            medecin=user,
            consultation=consultation,
            autorisation_urgence=active_auth,
            motif_urgence=validated_data['motif_urgence'],
            justification_acces_derogatoire=validated_data['justification_acces_derogatoire'],
            notification_envoyee=True
        )

        # 3. Notification vers le médecin responsable / établissement d'origine si le patient y a un suivi actif
        pec_active = PriseEnCharge.objects.filter(
            patient=patient,
            statut='ACTIF',
            type_prise_en_charge='ORDINAIRE'
        ).select_related('etablissement', 'medecin_responsable').first()

        if pec_active and (pec_active.medecin_responsable_id != user.id or pec_active.etablissement_id != etab.id):
            Notification.objects.create(
                destinataire=pec_active.medecin_responsable,
                etablissement_cible=pec_active.etablissement,
                type_notification='URGENCE_EXTERNE',
                titre=f"Intervention d'urgence externe : {patient.nom.upper()} {patient.prenom}",
                message=(
                    f"Votre patient suivi a été pris en charge en urgence à {etab.nom} "
                    f"par le Dr {user.last_name}. Motif : {validated_data['motif_urgence']}. "
                    f"Votre prise en charge de référence reste active."
                ),
                reference_objet_type='InterventionUrgence',
                reference_objet_id=str(intervention.id)
            )

        return intervention

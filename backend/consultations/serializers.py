from rest_framework import serializers
from .models import Consultation, ConsultationRevision


class ConsultationRevisionSerializer(serializers.ModelSerializer):
    auteur_nom = serializers.SerializerMethodField()

    class Meta:
        model = ConsultationRevision
        fields = [
            'id', 'date_modification', 'motif_modification',
            'auteur_nom', 'anciennes_valeurs'
        ]

    def get_auteur_nom(self, obj):
        return f"Dr {obj.auteur_modification.last_name}" if obj.auteur_modification else ""


class ConsultationDetailSerializer(serializers.ModelSerializer):
    etablissement_nom = serializers.CharField(source='etablissement.nom', read_only=True)
    etablissement_code = serializers.CharField(source='etablissement.code', read_only=True)
    medecin_nom = serializers.SerializerMethodField()
    patient_details = serializers.SerializerMethodField()
    revisions = ConsultationRevisionSerializer(many=True, read_only=True)
    traitements_associes = serializers.SerializerMethodField()

    class Meta:
        model = Consultation
        fields = '__all__'

    def get_medecin_nom(self, obj):
        return f"Dr {obj.medecin.last_name} ({obj.medecin.specialite})" if obj.medecin else ""

    def get_patient_details(self, obj):
        p = obj.dossier.patient
        return {
            'id': p.id,
            'medtransfer_id': p.medtransfer_id,
            'nom': p.nom,
            'prenom': p.prenom
        }

    def get_traitements_associes(self, obj):
        from medical_records.serializers import TraitementActuelSerializer
        return TraitementActuelSerializer(obj.traitements_associes.all(), many=True).data


class ConsultationCreateSerializer(serializers.ModelSerializer):
    patient_id = serializers.IntegerField(write_only=True, required=False)
    operations_traitements = serializers.ListField(
        child=serializers.DictField(),
        write_only=True,
        required=False,
        default=list,
        help_text="Actions explicites sur les traitements actuels du dossier médical (ADD, UPDATE, STOP)"
    )

    class Meta:
        model = Consultation
        fields = [
            'id', 'dossier', 'patient_id', 'motif', 'constantes',
            'observations_cliniques', 'diagnostic', 'prescription',
            'conclusions_recommandations', 'examens_demandes', 'is_emergency',
            'operations_traitements'
        ]
        read_only_fields = ['id', 'dossier']

    def create(self, validated_data):
        from medical_records.models import DossierMedical, appliquer_operations_traitements
        from medical_records.access_control import MedicalRecordAccessService

        patient_id = validated_data.pop('patient_id', None)
        operations_traitements = validated_data.pop('operations_traitements', [])
        request = self.context.get('request')
        user = request.user

        dossier = validated_data.get('dossier')
        if not dossier and patient_id:
            dossier = DossierMedical.objects.filter(patient_id=patient_id).select_related('patient').first()
            if not dossier:
                from patients.models import Patient
                if not Patient.objects.filter(pk=patient_id).exists():
                    raise serializers.ValidationError({'patient_id': "Patient introuvable."})
                dossier, _ = DossierMedical.objects.get_or_create(patient_id=patient_id)
            validated_data['dossier'] = dossier

        if not dossier:
            raise serializers.ValidationError({'patient_id': "Le patient ou le dossier médical est requis."})

        if patient_id and dossier.patient_id != int(patient_id):
            raise serializers.ValidationError({'patient_id': "Incohérence entre le patient et le dossier médical."})

        # Vérification stricte de la prise en charge ordinaire active autorisant ce médecin dans cet établissement
        evaluation = MedicalRecordAccessService.require_access(
            user=user,
            patient_id=dossier.patient_id,
            level=MedicalRecordAccessService.LEVEL_ORDINARY_CONSULTATION,
            entite_type='Consultation',
            entite_id=dossier.id,
            request=request,
        )
        pec = evaluation['prise_en_charge']

        validated_data['medecin'] = user
        validated_data['etablissement'] = pec.etablissement
        validated_data['is_emergency'] = False
        consultation = super().create(validated_data)

        if operations_traitements:
            appliquer_operations_traitements(
                dossier=consultation.dossier,
                operations=operations_traitements,
                user=user,
                consultation=consultation,
                request=request
            )

        return consultation


class ConsultationRectificationSerializer(serializers.Serializer):
    """Payload obligatoire pour rectifier une consultation avec justification médicolégale."""
    motif_modification = serializers.CharField(required=True)
    observations_cliniques = serializers.CharField(required=False, allow_blank=True)
    diagnostic = serializers.CharField(required=False, allow_blank=True)
    prescription = serializers.CharField(required=False, allow_blank=True)
    conclusions_recommandations = serializers.CharField(required=False, allow_blank=True)
    examens_demandes = serializers.CharField(required=False, allow_blank=True)
    constantes = serializers.JSONField(required=False)
    operations_traitements = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
        help_text="Actions explicites sur les traitements actuels lors de la rectification (ADD, UPDATE, STOP)"
    )

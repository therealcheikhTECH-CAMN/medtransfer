from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied
from .models import PriseEnCharge, Transfert
from establishments.models import Etablissement
from patients.models import Patient
from audit.models import enregistrer_journal


class PriseEnChargeSerializer(serializers.ModelSerializer):
    etablissement_nom = serializers.CharField(source='etablissement.nom', read_only=True)
    etablissement_code = serializers.CharField(source='etablissement.code', read_only=True)
    medecin_nom = serializers.SerializerMethodField()
    patient_nom = serializers.SerializerMethodField()
    patient_medtransfer_id = serializers.CharField(source='patient.medtransfer_id', read_only=True)
    cloture_par_nom = serializers.SerializerMethodField()

    class Meta:
        model = PriseEnCharge
        fields = '__all__'
        read_only_fields = ['medecin_responsable', 'etablissement', 'date_debut', 'date_fin', 'motif_cloture', 'cloture_par']

    def get_medecin_nom(self, obj):
        return f"Dr {obj.medecin_responsable.last_name}" if obj.medecin_responsable else "Non assigné"

    def get_cloture_par_nom(self, obj):
        return f"Dr {obj.cloture_par.last_name}" if obj.cloture_par else None

    def get_patient_nom(self, obj):
        return f"{obj.patient.nom.upper()} {obj.patient.prenom}"

    def validate(self, attrs):
        patient = attrs.get('patient') or getattr(self.instance, 'patient', None)
        statut = attrs.get('statut', 'ACTIF')
        type_pec = attrs.get('type_prise_en_charge', 'ORDINAIRE')

        if patient and statut == 'ACTIF' and type_pec == 'ORDINAIRE':
            existing = PriseEnCharge.objects.filter(
                patient=patient,
                statut='ACTIF',
                type_prise_en_charge='ORDINAIRE'
            ).select_related('etablissement', 'medecin_responsable')
            if self.instance:
                existing = existing.exclude(pk=self.instance.pk)
            active_pec = existing.first()
            if active_pec:
                med_label = f"Dr {active_pec.medecin_responsable.last_name}" if active_pec.medecin_responsable else "un médecin"
                raise serializers.ValidationError({
                    'detail': (
                        f"Ce patient possède déjà une prise en charge ordinaire active "
                        f"à {active_pec.etablissement.nom} ({med_label}). "
                        f"Une seule prise en charge ordinaire active est autorisée à la fois."
                    )
                })
        return attrs


class TransfertSerializer(serializers.ModelSerializer):
    etablissement_origine_nom = serializers.CharField(source='etablissement_origine.nom', read_only=True)
    etablissement_destination_nom = serializers.CharField(source='etablissement_destination.nom', read_only=True)
    medecin_emetteur_nom = serializers.SerializerMethodField()
    medecin_receveur_nom = serializers.SerializerMethodField()
    agent_receveur_nom = serializers.SerializerMethodField()
    patient_nom = serializers.SerializerMethodField()
    patient_medtransfer_id = serializers.CharField(source='patient.medtransfer_id', read_only=True)

    class Meta:
        model = Transfert
        fields = '__all__'

    def get_medecin_emetteur_nom(self, obj):
        return f"Dr {obj.medecin_emetteur.last_name} ({obj.etablissement_origine.code})" if obj.medecin_emetteur else ""

    def get_medecin_receveur_nom(self, obj):
        return f"Dr {obj.medecin_receveur.last_name} ({obj.etablissement_destination.code})" if obj.medecin_receveur else "En attente d'affectation"

    def get_agent_receveur_nom(self, obj):
        if not obj.agent_receveur:
            return ""
        return f"{obj.agent_receveur.first_name} {obj.agent_receveur.last_name}".strip() or obj.agent_receveur.username

    def get_patient_nom(self, obj):
        return f"{obj.patient.nom.upper()} {obj.patient.prenom}"


class TransfertCreateSerializer(serializers.ModelSerializer):
    patient_id = serializers.IntegerField(write_only=True)
    etablissement_destination_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = Transfert
        fields = [
            'id', 'patient_id', 'etablissement_destination_id',
            'priorite', 'motif_transfert', 'resume_clinique'
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        try:
            patient = Patient.objects.get(pk=attrs['patient_id'])
        except Patient.DoesNotExist:
            raise serializers.ValidationError({'patient_id': "Patient introuvable."})

        try:
            etab_destination = Etablissement.objects.get(pk=attrs['etablissement_destination_id'], is_active=True)
        except Etablissement.DoesNotExist:
            raise serializers.ValidationError({'etablissement_destination_id': "Établissement de destination introuvable ou inactif."})

        if user and user.etablissement_id == etab_destination.id:
            raise serializers.ValidationError({
                'etablissement_destination_id': "L'établissement de destination doit être différent de l'établissement d'origine."
            })

        # Vérification stricte de la prise en charge ordinaire active détenue par le médecin émetteur
        pec_origine = PriseEnCharge.objects.filter(
            patient=patient,
            statut='ACTIF',
            type_prise_en_charge='ORDINAIRE'
        ).first()

        if (
            not pec_origine
            or not user
            or pec_origine.etablissement_id != user.etablissement_id
            or pec_origine.medecin_responsable_id != user.id
        ):
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=user,
                etablissement=getattr(user, 'etablissement', None),
                statut='REFUSE',
                entite_type='Transfert',
                entite_id=patient.id,
                details={
                    'patient_id': patient.id,
                    'action': 'initiate_transfer',
                    'reason': "Le médecin émetteur ne détient pas la prise en charge ordinaire active du patient."
                },
                request=request
            )
            raise PermissionDenied(
                "Vous ne pouvez initier un transfert que pour un patient dont vous assurez actuellement la prise en charge ordinaire active dans votre établissement."
            )

        attrs['_patient'] = patient
        attrs['_etab_destination'] = etab_destination
        attrs['_pec_origine'] = pec_origine
        return attrs

    def create(self, validated_data):
        validated_data.pop('patient_id', None)
        validated_data.pop('etablissement_destination_id', None)
        patient = validated_data.pop('_patient')
        etab_destination = validated_data.pop('_etab_destination')
        pec_origine = validated_data.pop('_pec_origine')
        request = self.context.get('request')
        etab_origine = request.user.etablissement

        transfert = Transfert.objects.create(
            patient=patient,
            prise_en_charge_origine=pec_origine,
            etablissement_origine=etab_origine,
            etablissement_destination=etab_destination,
            medecin_emetteur=request.user,
            **validated_data
        )
        return transfert

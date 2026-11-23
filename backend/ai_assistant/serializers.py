from rest_framework import serializers
from .models import SyntheseIA


class SyntheseIASerializer(serializers.ModelSerializer):
    medecin_demandeur_nom = serializers.SerializerMethodField()
    medecin_decisionnaire_nom = serializers.SerializerMethodField()
    statut_display = serializers.CharField(source='get_statut_display', read_only=True)
    patient_nom = serializers.SerializerMethodField()

    class Meta:
        model = SyntheseIA
        fields = '__all__'

    def get_medecin_demandeur_nom(self, obj):
        return f"Dr {obj.medecin_demandeur.last_name}" if obj.medecin_demandeur else ""

    def get_medecin_decisionnaire_nom(self, obj):
        return f"Dr {obj.medecin_decisionnaire.last_name}" if obj.medecin_decisionnaire else ""

    def get_patient_nom(self, obj):
        return f"{obj.patient.nom.upper()} {obj.patient.prenom}"


class GenerateSummaryRequestSerializer(serializers.Serializer):
    patient_id = serializers.IntegerField(required=True)
    motif_consultation = serializers.CharField(required=True, min_length=3)
    consultation_id = serializers.IntegerField(required=False, allow_null=True)


class ValidationSyntheseSerializer(serializers.Serializer):
    texte_final = serializers.CharField(required=False, allow_blank=True)
    motif = serializers.CharField(required=False, default="Synthèse validée par le praticien")


class RejetSyntheseSerializer(serializers.Serializer):
    motif = serializers.CharField(required=False, default="Synthèse rejetée après révision médicale")

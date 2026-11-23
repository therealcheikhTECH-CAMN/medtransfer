from rest_framework import serializers
from .models import JournalAcces


class JournalAccesSerializer(serializers.ModelSerializer):
    action_display = serializers.CharField(source='get_action_display', read_only=True)
    utilisateur_nom = serializers.SerializerMethodField()
    etablissement_nom = serializers.CharField(source='etablissement.nom', read_only=True)

    class Meta:
        model = JournalAcces
        fields = [
            'id', 'timestamp', 'action', 'action_display', 'statut',
            'utilisateur_nom', 'etablissement_nom', 'entite_type',
            'entite_id', 'details', 'adresse_ip'
        ]

    def get_utilisateur_nom(self, obj):
        if obj.utilisateur:
            return f"{obj.utilisateur.first_name} {obj.utilisateur.last_name} ({obj.utilisateur.username})"
        return "Système / Anonyme"

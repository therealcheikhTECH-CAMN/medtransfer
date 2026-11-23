from rest_framework import serializers
from .models import Etablissement


class EtablissementPublicSerializer(serializers.ModelSerializer):
    """
    Sérialiseur public minimaliste destiné au formulaire d'inscription professionnelle.
    Retourne uniquement les informations nécessaires :
    - id : ID de l'établissement
    - nom : Nom de l'établissement
    - ville : Ville ou localisation
    - is_active : Statut actif ou inactif
    N'expose aucune coordonnée interne ni information confidentielle.
    """
    class Meta:
        model = Etablissement
        fields = ['id', 'nom', 'ville', 'is_active']


class EtablissementSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_etablissement_display', read_only=True)
    nombre_medecins = serializers.SerializerMethodField()
    nombre_lits_indicatif = serializers.SerializerMethodField()
    directeur_details = serializers.SerializerMethodField()

    class Meta:
        model = Etablissement
        fields = [
            'id', 'code', 'nom', 'type_etablissement', 'type_display',
            'region', 'ville', 'adresse', 'telephone', 'email',
            'services_declares', 'site_web', 'description', 'is_active', 'directeur', 'directeur_details',
            'nombre_medecins', 'nombre_lits_indicatif', 'created_at', 'updated_at'
        ]

    def get_directeur_details(self, obj):
        if not obj.directeur:
            return None
        d = obj.directeur
        return {
            'id': d.id,
            'nom_complet': f"{d.first_name} {d.last_name}".strip() or d.username,
            'email': d.email,
            'telephone': d.telephone,
            'matricule_professionnel': d.matricule_professionnel,
            'statut_validation': d.statut_validation,
            'is_active': d.is_active,
        }

    def get_nombre_medecins(self, obj):
        return obj.utilisateurs.filter(role='MEDECIN', is_active=True).count()

    def get_nombre_lits_indicatif(self, obj):
        # Données indicatives issues du référentiel déclaratif des établissements
        return "Non temps-réel (Référentiel indicatif)"

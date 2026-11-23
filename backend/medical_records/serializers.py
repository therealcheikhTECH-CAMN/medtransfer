from rest_framework import serializers
from django.utils import timezone
from .models import DossierMedical, Antecedent, Allergie, TraitementActuel, ExamenComplementaire
from consultations.models import Consultation


class AntecedentSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_antecedent_display', read_only=True)
    enregistre_par_nom = serializers.SerializerMethodField()

    class Meta:
        model = Antecedent
        fields = '__all__'
        read_only_fields = ['enregistre_par', 'created_at']

    def get_enregistre_par_nom(self, obj):
        return f"Dr {obj.enregistre_par.last_name}" if obj.enregistre_par else ""

    def validate(self, attrs):
        if self.instance and 'dossier' in attrs and attrs['dossier'].id != self.instance.dossier_id:
            raise serializers.ValidationError({
                'dossier': "Impossible de réaffecter un antécédent à un autre dossier médical."
            })
        return attrs


class AllergieSerializer(serializers.ModelSerializer):
    severite_display = serializers.CharField(source='get_severite_display', read_only=True)
    enregistre_par_nom = serializers.SerializerMethodField()

    class Meta:
        model = Allergie
        fields = '__all__'
        read_only_fields = ['enregistre_par', 'created_at']

    def get_enregistre_par_nom(self, obj):
        return f"Dr {obj.enregistre_par.last_name}" if obj.enregistre_par else ""

    def validate(self, attrs):
        if self.instance and 'dossier' in attrs and attrs['dossier'].id != self.instance.dossier_id:
            raise serializers.ValidationError({
                'dossier': "Impossible de réaffecter une allergie à un autre dossier médical."
            })
        return attrs


class TraitementActuelSerializer(serializers.ModelSerializer):
    prescrit_par_nom = serializers.SerializerMethodField()
    modifie_par_nom = serializers.SerializerMethodField()
    statut_traitement = serializers.CharField(read_only=True)
    statut_display = serializers.CharField(read_only=True)
    est_en_cours = serializers.BooleanField(read_only=True)

    class Meta:
        model = TraitementActuel
        fields = [
            'id', 'dossier', 'consultation', 'medicament', 'dosage',
            'posologie', 'frequence', 'date_debut', 'date_fin',
            'instructions', 'is_actif', 'est_en_cours',
            'statut_traitement', 'statut_display',
            'motif_arret', 'date_arret',
            'prescrit_par', 'prescrit_par_nom',
            'modifie_par', 'modifie_par_nom',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['prescrit_par', 'modifie_par', 'date_arret', 'created_at', 'updated_at']

    def get_prescrit_par_nom(self, obj):
        return f"Dr {obj.prescrit_par.last_name}" if obj.prescrit_par else ""

    def get_modifie_par_nom(self, obj):
        return f"Dr {obj.modifie_par.last_name}" if obj.modifie_par else ""

    def validate(self, attrs):
        if self.instance and 'dossier' in attrs and attrs['dossier'].id != self.instance.dossier_id:
            raise serializers.ValidationError({
                'dossier': "Impossible de réaffecter un traitement à un autre dossier médical."
            })
        date_debut = attrs.get('date_debut', getattr(self.instance, 'date_debut', None))
        date_fin = attrs.get('date_fin', getattr(self.instance, 'date_fin', None))
        if date_debut and date_fin and date_fin < date_debut:
            raise serializers.ValidationError({
                'date_fin': "La date de fin prévue ne peut pas être antérieure à la date de début."
            })
        return attrs

    def create(self, validated_data):
        if not validated_data.get('date_debut'):
            validated_data['date_debut'] = timezone.now().date()
        return super().create(validated_data)


class ExamenComplementaireSerializer(serializers.ModelSerializer):
    etablissement_nom = serializers.CharField(source='etablissement.nom', read_only=True)
    medecin_nom = serializers.SerializerMethodField()

    class Meta:
        model = ExamenComplementaire
        fields = '__all__'
        read_only_fields = ['medecin', 'etablissement', 'created_at']

    def get_medecin_nom(self, obj):
        return f"Dr {obj.medecin.last_name}" if obj.medecin else ""

    def validate(self, attrs):
        if self.instance and 'dossier' in attrs and attrs['dossier'].id != self.instance.dossier_id:
            raise serializers.ValidationError({
                'dossier': "Impossible de réaffecter un examen à un autre dossier médical."
            })
        return attrs


class ConsultationTimelineSerializer(serializers.ModelSerializer):
    """Représentation chronologique concise d'une consultation pour la timeline du dossier."""
    etablissement_code = serializers.CharField(source='etablissement.code', read_only=True)
    etablissement_nom = serializers.CharField(source='etablissement.nom', read_only=True)
    medecin_nom = serializers.SerializerMethodField()
    nombre_revisions = serializers.SerializerMethodField()
    traitements_associes = TraitementActuelSerializer(many=True, read_only=True)

    class Meta:
        model = Consultation
        fields = [
            'id', 'date_consultation', 'etablissement', 'etablissement_code', 'etablissement_nom',
            'medecin', 'medecin_nom', 'motif', 'constantes', 'observations_cliniques',
            'diagnostic', 'prescription', 'conclusions_recommandations',
            'examens_demandes', 'is_emergency', 'is_amended', 'nombre_revisions',
            'traitements_associes'
        ]

    def get_medecin_nom(self, obj):
        return f"Dr {obj.medecin.last_name} ({obj.medecin.specialite})" if obj.medecin else "Inconnu"

    def get_nombre_revisions(self, obj):
        return obj.revisions.count()


class DossierMedicalDetailSerializer(serializers.ModelSerializer):
    """
    Vue d'ensemble complète du dossier médical unique :
    Antécédents, allergies, traitements actifs (et historique des traitements arrêtés/terminés),
    examens et timeline chronologique des consultations.
    """
    antecedents = AntecedentSerializer(many=True, read_only=True)
    allergies = AllergieSerializer(many=True, read_only=True)
    traitements = serializers.SerializerMethodField()
    traitements_historique = serializers.SerializerMethodField()
    nombre_traitements_actifs = serializers.SerializerMethodField()
    examens = ExamenComplementaireSerializer(many=True, read_only=True)
    consultations = serializers.SerializerMethodField()
    patient_details = serializers.SerializerMethodField()
    contexte_acces = serializers.SerializerMethodField()

    class Meta:
        model = DossierMedical
        fields = [
            'id', 'patient', 'patient_details', 'remarques_importantes',
            'antecedents', 'allergies',
            'traitements', 'traitements_historique', 'nombre_traitements_actifs',
            'examens', 'consultations', 'contexte_acces', 'created_at', 'updated_at'
        ]

    def get_contexte_acces(self, obj):
        request = self.context.get('request')
        if not request or not getattr(request, 'user', None):
            return None
        from .access_control import MedicalRecordAccessService
        ev = MedicalRecordAccessService.evaluate_access(
            user=request.user,
            patient_id=obj.patient_id,
            level=MedicalRecordAccessService.LEVEL_READ,
            request=request,
        )
        auth_urg = ev.get('autorisation_urgence')
        pec = ev.get('prise_en_charge')
        return {
            'mode': ev.get('mode'),
            'can_write_clinical': ev.get('can_write_clinical', False),
            'can_create_ordinary_consultation': ev.get('can_create_ordinary_consultation', False),
            'prise_en_charge_id': pec.id if pec else None,
            'autorisation_urgence_id': auth_urg.id if auth_urg else None,
            'niveau_acces': auth_urg.niveau_acces if auth_urg else None,
            'niveau_acces_urgence': auth_urg.niveau_acces if auth_urg else None,
            'date_expiration': auth_urg.date_expiration if auth_urg else None,
            'date_expiration_urgence': auth_urg.date_expiration if auth_urg else None,
        }

    def _get_all_traitements(self, obj):
        if not hasattr(obj, '_cached_all_traitements'):
            obj._cached_all_traitements = list(
                obj.traitements.all().select_related('prescrit_par', 'modifie_par').order_by('-created_at')
            )
        return obj._cached_all_traitements

    def get_traitements(self, obj):
        """Retourne exclusivement les traitements actuellement en cours (actifs et non échus)."""
        actifs = [t for t in self._get_all_traitements(obj) if t.est_en_cours]
        return TraitementActuelSerializer(actifs, many=True).data

    def get_traitements_historique(self, obj):
        """Retourne les traitements arrêtés ou terminés pour consultation de l'historique thérapeutique."""
        inactifs = [t for t in self._get_all_traitements(obj) if not t.est_en_cours]
        return TraitementActuelSerializer(inactifs, many=True).data

    def get_nombre_traitements_actifs(self, obj):
        return sum(1 for t in self._get_all_traitements(obj) if t.est_en_cours)

    def get_consultations(self, obj):
        # Tri chronologique descendant pour affichage immédiat en timeline
        consultations = obj.consultations.all().select_related('etablissement', 'medecin').prefetch_related('traitements_associes').order_by('-date_consultation')
        return ConsultationTimelineSerializer(consultations, many=True).data

    def get_patient_details(self, obj):
        p = obj.patient
        return {
            'id': p.id,
            'medtransfer_id': p.medtransfer_id,
            'nom': p.nom,
            'prenom': p.prenom,
            'date_naissance': p.date_naissance,
            'sexe': p.sexe,
            'groupe_sanguin': p.groupe_sanguin,
            'status_identite': p.status_identite,
            'is_provisional': p.is_provisional,
            'telephone': p.telephone,
            'ville': p.ville,
            'contact_urgence': f"{p.personne_contact_nom} ({p.personne_contact_telephone})" if p.personne_contact_nom else "Non renseigné"
        }

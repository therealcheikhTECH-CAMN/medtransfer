from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import SyntheseIA
from .serializers import (
    SyntheseIASerializer,
    GenerateSummaryRequestSerializer,
    ValidationSyntheseSerializer,
    RejetSyntheseSerializer,
)
from .services import generer_synthese_medicale
from patients.models import Patient
from consultations.models import Consultation
from accounts.permissions import IsDoctor
from medical_records.access_control import MedicalRecordAccessService
from audit.models import enregistrer_journal


class SyntheseIAViewSet(viewsets.ModelViewSet):
    """
    Module sécurisé d'assistance à la synthèse médicale par IA :
    - Strictement réservé aux médecins en exercice actifs et validés.
    - Toute lecture ou génération exige une PriseEnCharge ordinaire active ou une AutorisationUrgence valide.
    - Toute validation ou rejet exige un droit d'écriture clinique (`LEVEL_WRITE`) sur le patient.
    - Aucun dossier médical non autorisé n'est jamais transmis au service IA.
    """
    queryset = SyntheseIA.objects.all().select_related('patient', 'medecin_demandeur', 'medecin_decisionnaire').order_by('-created_at')
    serializer_class = SyntheseIASerializer
    permission_classes = [IsDoctor]

    def permission_denied(self, request, message=None, code=None):
        if request.user and request.user.is_authenticated:
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=request.user,
                etablissement=getattr(request.user, 'etablissement', None),
                statut='REFUSE',
                entite_type='SyntheseIA',
                details={'motif': message or f"Tentative d'accès non autorisé aux synthèses IA par {request.user.role}"},
                request=request,
            )
        super().permission_denied(request, message=message, code=code)

    def get_queryset(self):
        authorized_ids = MedicalRecordAccessService.get_authorized_patient_ids_for_doctor(self.request.user)
        qs = (
            SyntheseIA.objects.filter(patient_id__in=authorized_ids)
            .select_related('patient', 'medecin_demandeur', 'medecin_decisionnaire')
            .order_by('-created_at')
        )
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

    def list(self, request, *args, **kwargs):
        patient_id = request.query_params.get('patient')
        if patient_id:
            MedicalRecordAccessService.require_access(
                user=request.user,
                patient_id=patient_id,
                level=MedicalRecordAccessService.LEVEL_READ,
                entite_type='SyntheseIA',
                entite_id=patient_id,
                request=request,
            )
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        synthese = get_object_or_404(
            SyntheseIA.objects.select_related('patient', 'medecin_demandeur', 'medecin_decisionnaire'),
            pk=kwargs.get('pk'),
        )
        MedicalRecordAccessService.require_access(
            user=request.user,
            patient_id=synthese.patient_id,
            level=MedicalRecordAccessService.LEVEL_READ,
            entite_type='SyntheseIA',
            entite_id=synthese.id,
            request=request,
        )
        return Response(self.get_serializer(synthese).data)

    def create(self, request, *args, **kwargs):
        raise PermissionDenied("Utilisez l'endpoint dédié /api/ai/summaries/generate/ pour générer une synthèse IA.")

    def update(self, request, *args, **kwargs):
        raise PermissionDenied("La modification directe d'une synthèse IA est interdite. Utilisez /validate/ ou /reject/.")

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        raise PermissionDenied("La suppression physique d'une synthèse IA est interdite.")

    @action(detail=False, methods=['post'], url_path='generate')
    def generate_summary(self, request):
        """
        Déclenche la sélection contrôlée des données et la génération de la synthèse IA,
        uniquement après vérification stricte de l'autorisation du médecin sur ce patient.
        """
        serializer = GenerateSummaryRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        patient_id = serializer.validated_data['patient_id']
        motif = serializer.validated_data['motif_consultation']
        consultation_id = serializer.validated_data.get('consultation_id')

        try:
            patient = Patient.objects.get(pk=patient_id)
        except Patient.DoesNotExist:
            return Response({'detail': "Patient introuvable."}, status=status.HTTP_404_NOT_FOUND)

        # Contrôle d'accès obligatoire AVANT toute récupération ou transmission de données médicales
        MedicalRecordAccessService.require_access(
            user=request.user,
            patient_id=patient.id,
            level=MedicalRecordAccessService.LEVEL_READ,
            entite_type='SyntheseIA',
            entite_id=patient.id,
            request=request,
        )

        consultation = None
        if consultation_id:
            consultation = Consultation.objects.filter(pk=consultation_id, dossier__patient_id=patient.id).first()

        result = generer_synthese_medicale(
            patient_id=patient.id,
            motif_consultation=motif,
            user=request.user,
            request=request,
        )

        synthese = SyntheseIA.objects.create(
            patient=patient,
            consultation=consultation,
            medecin_demandeur=request.user,
            motif_consultation_soumis=motif,
            donnees_transmises=result.get('contexte', {}),
            resume_antecedents=result.get('resume_antecedents', ''),
            historique_pertinent=result.get('historique_pertinent', ''),
            traitements_connus=result.get('traitements_connus', ''),
            allergies_connues=result.get('allergies_connues', ''),
            elements_a_verifier=result.get('elements_a_verifier', ''),
            informations_manquantes=result.get('informations_manquantes', ''),
            synthese_globale=result.get('synthese_globale', ''),
            modele_utilise=result.get('modele_utilise', 'gpt-4o-mini'),
            is_mocked=result.get('is_mocked', False),
            statut='EN_ATTENTE',
        )

        enregistrer_journal(
            action='AI_SUMMARY_REQUEST',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='SyntheseIA',
            entite_id=synthese.id,
            details={'patient_id': patient.id, 'is_mocked': synthese.is_mocked},
            request=request,
        )

        return Response(SyntheseIASerializer(synthese).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='validate')
    def validate_summary(self, request, pk=None):
        """Validation et intégration de la synthèse par un praticien autorisé en écriture sur le patient."""
        synthese = get_object_or_404(SyntheseIA, pk=pk)
        MedicalRecordAccessService.require_access(
            user=request.user,
            patient_id=synthese.patient_id,
            level=MedicalRecordAccessService.LEVEL_WRITE,
            entite_type='SyntheseIA',
            entite_id=synthese.id,
            request=request,
        )

        serializer = ValidationSyntheseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        texte_final = serializer.validated_data.get('texte_final') or synthese.synthese_globale
        motif = serializer.validated_data.get('motif', "Synthèse validée après examen")

        synthese.valider(medecin=request.user, texte_amende=texte_final, motif=motif)

        enregistrer_journal(
            action='AI_SUMMARY_VALIDATE',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='SyntheseIA',
            entite_id=synthese.id,
            details={'patient_id': synthese.patient_id, 'motif': motif},
            request=request,
        )

        return Response(SyntheseIASerializer(synthese).data)

    @action(detail=True, methods=['post'], url_path='reject')
    def reject_summary(self, request, pk=None):
        """Rejet motivé de la synthèse par un praticien autorisé en écriture sur le patient."""
        synthese = get_object_or_404(SyntheseIA, pk=pk)
        MedicalRecordAccessService.require_access(
            user=request.user,
            patient_id=synthese.patient_id,
            level=MedicalRecordAccessService.LEVEL_WRITE,
            entite_type='SyntheseIA',
            entite_id=synthese.id,
            request=request,
        )

        serializer = RejetSyntheseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        motif = serializer.validated_data.get('motif', "Synthèse non retenue")
        synthese.rejeter(medecin=request.user, motif=motif)

        enregistrer_journal(
            action='AI_SUMMARY_REJECT',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='SyntheseIA',
            entite_id=synthese.id,
            details={'patient_id': synthese.patient_id, 'motif': motif},
            request=request,
        )

        return Response(SyntheseIASerializer(synthese).data)

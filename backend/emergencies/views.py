from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import InterventionUrgence, AutorisationUrgence
from .serializers import (
    InterventionUrgenceSerializer,
    InterventionUrgenceCreateSerializer,
    AutorisationUrgenceSerializer,
    AutorisationUrgenceRequestSerializer,
)
from accounts.permissions import IsDoctor
from medical_records.access_control import MedicalRecordAccessService
from audit.models import enregistrer_journal


class InterventionUrgenceViewSet(viewsets.ModelViewSet):
    """
    Gestion sécurisée des autorisations d'urgence (« Break-Glass ») et des interventions d'urgence.
    """
    queryset = InterventionUrgence.objects.all().select_related(
        'patient', 'etablissement', 'medecin', 'consultation', 'autorisation_urgence'
    ).order_by('-date_intervention')
    permission_classes = [IsDoctor]

    def get_serializer_class(self):
        if self.action == 'create':
            return InterventionUrgenceCreateSerializer
        if self.action == 'request_access':
            return AutorisationUrgenceRequestSerializer
        return InterventionUrgenceSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if self.action == 'list':
            authorized_patient_ids = MedicalRecordAccessService.get_authorized_patient_ids(user)
            qs = qs.filter(
                Q(medecin=user) |
                Q(patient_id__in=authorized_patient_ids)
            )
        patient_id = self.request.query_params.get('patient')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        decision = MedicalRecordAccessService.evaluate(
            request.user,
            instance.patient,
            level=MedicalRecordAccessService.LEVEL_READ,
            action_label='view_intervention_urgence',
            request=request,
            log_denied=False
        )
        if not decision.allowed and instance.medecin_id != request.user.id:
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=request.user,
                etablissement=request.user.etablissement,
                statut='REFUSE',
                entite_type='InterventionUrgence',
                entite_id=instance.id,
                details={'patient_id': instance.patient_id, 'reason': "Accès non autorisé à cette intervention d'urgence."},
                request=request
            )
            return Response(
                {'detail': "Vous n'êtes pas autorisé à consulter cette intervention d'urgence."},
                status=status.HTTP_403_FORBIDDEN
            )
        return Response(self.get_serializer(instance).data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        intervention = serializer.save()

        enregistrer_journal(
            action='EMERGENCY_ACCESS',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='InterventionUrgence',
            entite_id=intervention.id,
            details={
                'patient_id': intervention.patient_id,
                'autorisation_urgence_id': intervention.autorisation_urgence_id,
                'motif': intervention.motif_urgence,
                'justification': intervention.justification_acces_derogatoire
            },
            request=request
        )

        return Response(InterventionUrgenceSerializer(intervention).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'], url_path='request-access')
    def request_access(self, request):
        """
        Déclenche explicitement une autorisation exceptionnelle d'urgence (« Break-Glass »)
        limitée dans le temps pour accéder au dossier médical d'un patient.
        """
        serializer = AutorisationUrgenceRequestSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        autorisation = serializer.save()
        return Response(
            AutorisationUrgenceSerializer(autorisation).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=False, methods=['get'], url_path='active-access')
    def active_access(self, request):
        """
        Vérifie si le médecin connecté dispose d'une autorisation d'urgence active pour un patient donné.
        """
        patient_id = request.query_params.get('patient')
        if not patient_id:
            return Response({'detail': "Le paramètre 'patient' est requis."}, status=status.HTTP_400_BAD_REQUEST)

        MedicalRecordAccessService.expire_outdated_emergency_authorizations(
            patient=patient_id, user=request.user, request=request
        )
        auth = AutorisationUrgence.objects.filter(
            patient_id=patient_id,
            medecin=request.user,
            etablissement=request.user.etablissement,
            statut='ACTIVE',
            date_expiration__gt=timezone.now()
        ).order_by('-date_debut').first()

        return Response({
            'has_active_emergency_access': auth is not None,
            'autorisation': AutorisationUrgenceSerializer(auth).data if auth else None
        })

    @action(detail=False, methods=['post'], url_path='revoke-access')
    def revoke_access(self, request):
        """
        Révoque immédiatement l'autorisation d'urgence active d'un médecin pour un patient
        (ou par identifiant d'autorisation).
        """
        autorisation_id = request.data.get('autorisation_id')
        patient_id = request.data.get('patient_id') or request.data.get('patient')
        motif = request.data.get('motif', "Fin de l'intervention d'urgence / révocation manuelle")

        qs = AutorisationUrgence.objects.filter(statut='ACTIVE')
        if autorisation_id:
            qs = qs.filter(pk=autorisation_id)
        elif patient_id:
            qs = qs.filter(patient_id=patient_id, medecin=request.user)
        else:
            return Response(
                {'detail': "Veuillez fournir 'autorisation_id' ou 'patient_id'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        auth = qs.first()
        if not auth:
            return Response(
                {'detail': "Aucune autorisation d'urgence active correspondante n'a été trouvée."},
                status=status.HTTP_404_NOT_FOUND
            )

        # Seul le médecin titulaire ou le médecin responsable de la prise en charge ordinaire peut révoquer
        pec_active = auth.patient.prises_en_charge.filter(
            statut='ACTIF', type_prise_en_charge='ORDINAIRE'
        ).first()
        is_pec_owner = (
            pec_active is not None
            and pec_active.medecin_responsable_id == request.user.id
            and pec_active.etablissement_id == request.user.etablissement_id
        )

        if auth.medecin_id != request.user.id and not is_pec_owner:
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=request.user,
                etablissement=request.user.etablissement,
                statut='REFUSE',
                entite_type='AutorisationUrgence',
                entite_id=auth.id,
                details={'reason': "Tentative non autorisée de révoquer une autorisation d'urgence."},
                request=request
            )
            return Response(
                {'detail': "Vous n'êtes pas autorisé à révoquer cette autorisation d'urgence."},
                status=status.HTTP_403_FORBIDDEN
            )

        auth.revoquer(utilisateur=request.user, motif=motif)

        enregistrer_journal(
            action='EMERGENCY_ACCESS_REVOKED',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='AutorisationUrgence',
            entite_id=auth.id,
            details={
                'patient_id': auth.patient_id,
                'autorisation_urgence_id': auth.id,
                'motif_revocation': motif
            },
            request=request
        )

        return Response({
            'detail': "L'autorisation d'urgence a été révoquée avec succès. L'accès au dossier médical est désormais fermé.",
            'autorisation': AutorisationUrgenceSerializer(auth).data
        })

    def update(self, request, *args, **kwargs):
        enregistrer_journal(
            action='PERMISSION_DENIED',
            utilisateur=request.user,
            etablissement=getattr(request.user, 'etablissement', None),
            statut='REFUSE',
            entite_type='InterventionUrgence',
            entite_id=kwargs.get('pk'),
            details={'reason': "Modification d'une intervention d'urgence interdite."},
            request=request
        )
        return Response(
            {'detail': "La modification d'une intervention d'urgence n'est pas autorisée."},
            status=status.HTTP_403_FORBIDDEN
        )

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        enregistrer_journal(
            action='PERMISSION_DENIED',
            utilisateur=request.user,
            etablissement=getattr(request.user, 'etablissement', None),
            statut='REFUSE',
            entite_type='InterventionUrgence',
            entite_id=kwargs.get('pk'),
            details={'reason': "Suppression d'une intervention d'urgence interdite."},
            request=request
        )
        return Response(
            {'detail': "La suppression d'une intervention d'urgence est interdite."},
            status=status.HTTP_403_FORBIDDEN
        )

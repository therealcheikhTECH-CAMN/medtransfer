from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import Consultation, ConsultationRevision
from .serializers import (
    ConsultationDetailSerializer,
    ConsultationCreateSerializer,
    ConsultationRectificationSerializer,
)
from accounts.permissions import IsDoctorOrDirector
from medical_records.access_control import MedicalRecordAccessService
from audit.models import enregistrer_journal


class ConsultationViewSet(viewsets.ModelViewSet):
    """
    Gestion sécurisée des actes et consultations médicales :
    - Strictement réservé aux médecins en exercice actifs et validés.
    - La création d'une consultation ordinaire exige obligatoirement une PriseEnCharge ordinaire active
      pour ce patient sous la responsabilité du médecin connecté dans son établissement.
    - Toute modification directe (`PUT`, `PATCH`) ou suppression (`DELETE`) est interdite pour empêcher
      tout contournement de l'archivage médicolégal (`ConsultationRevision`).
    - Seul le médecin auteur de la consultation (dans son établissement et disposant d'un accès actif au patient)
      peut rectifier sa propre consultation via `/amend/`.
    """
    queryset = Consultation.objects.all().select_related('dossier__patient', 'etablissement', 'medecin').order_by('-date_consultation')
    permission_classes = [IsDoctorOrDirector]

    def permission_denied(self, request, message=None, code=None):
        if request.user and request.user.is_authenticated:
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=request.user,
                etablissement=getattr(request.user, 'etablissement', None),
                statut='REFUSE',
                entite_type='Consultation',
                details={'motif': message or f"Tentative d'accès non autorisé aux actes médicaux par {request.user.role}"},
                request=request,
            )
        super().permission_denied(request, message=message, code=code)

    def get_queryset(self):
        user = self.request.user
        if getattr(user, 'role', None) == 'DIRECTEUR' and user.etablissement_id:
            return (
                Consultation.objects.filter(etablissement=user.etablissement)
                .select_related('dossier__patient', 'etablissement', 'medecin')
                .order_by('-date_consultation')
            )

        if getattr(user, 'role', None) == 'MEDECIN':
            authorized_ids = MedicalRecordAccessService.get_authorized_patient_ids_for_doctor(user)
            return (
                Consultation.objects.filter(dossier__patient_id__in=authorized_ids)
                .select_related('dossier__patient', 'etablissement', 'medecin')
                .order_by('-date_consultation')
            )

        if user.is_admin_user:
            return Consultation.objects.all().select_related('dossier__patient', 'etablissement', 'medecin').order_by('-date_consultation')

        return Consultation.objects.none()

    def get_serializer_class(self):
        if self.action == 'create':
            return ConsultationCreateSerializer
        return ConsultationDetailSerializer

    def retrieve(self, request, *args, **kwargs):
        consultation = get_object_or_404(
            Consultation.objects.select_related('dossier__patient', 'etablissement', 'medecin'),
            pk=kwargs.get('pk'),
        )
        user = request.user
        if getattr(user, 'role', None) == 'DIRECTEUR':
            if consultation.etablissement_id != user.etablissement_id:
                raise PermissionDenied("Accès refusé : cette consultation a été réalisée dans un autre établissement.")
            return Response(self.get_serializer(consultation).data)

        MedicalRecordAccessService.require_access(
            user=user,
            patient_id=consultation.dossier.patient_id,
            level=MedicalRecordAccessService.LEVEL_READ,
            entite_type='Consultation',
            entite_id=consultation.id,
            request=request,
        )
        serializer = self.get_serializer(consultation)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'MEDECIN':
            raise PermissionDenied("Seul un médecin en exercice peut créer une consultation.")
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        consultation = serializer.save()

        enregistrer_journal(
            action='CREATE_CONSULTATION',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='Consultation',
            entite_id=consultation.id,
            details={
                'patient_id': consultation.dossier.patient_id,
                'diagnostic_renseigne': bool(consultation.diagnostic),
            },
            request=request,
        )

        return Response(ConsultationDetailSerializer(consultation).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        enregistrer_journal(
            action='PERMISSION_DENIED',
            utilisateur=request.user,
            etablissement=getattr(request.user, 'etablissement', None),
            statut='REFUSE',
            entite_type='Consultation',
            entite_id=kwargs.get('pk', ''),
            details={'motif': "Tentative de modification directe d'une consultation sans passer par /amend/"},
            request=request,
        )
        raise PermissionDenied(
            "La modification directe d'une consultation (PUT/PATCH) est interdite. "
            "Toute rectification doit obligatoirement passer par la procédure médicolégale (/amend/)."
        )

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        enregistrer_journal(
            action='PERMISSION_DENIED',
            utilisateur=request.user,
            etablissement=getattr(request.user, 'etablissement', None),
            statut='REFUSE',
            entite_type='Consultation',
            entite_id=kwargs.get('pk', ''),
            details={'motif': "Tentative de suppression physique interdite d'une consultation"},
            request=request,
        )
        raise PermissionDenied(
            "La suppression d'une consultation médicale est strictement interdite pour préserver l'intégrité médicolégale."
        )

    @action(detail=True, methods=['post'], url_path='amend')
    def amend_consultation(self, request, pk=None):
        """
        Rectification médicolégale d'une consultation existante :
        - Vérifie que le médecin connecté dispose d'un accès actif en écriture sur le patient.
        - Vérifie que le médecin connecté est bien l'auteur de la consultation et rattaché au même établissement.
        - Conserve les anciennes valeurs dans ConsultationRevision sans écrasement destructif.
        """
        consultation = get_object_or_404(
            Consultation.objects.select_related('dossier__patient', 'etablissement', 'medecin'),
            pk=pk,
        )

        # 1. Vérifier que le médecin dispose d'une autorisation active d'écriture sur ce patient
        MedicalRecordAccessService.require_access(
            user=request.user,
            patient_id=consultation.dossier.patient_id,
            level=MedicalRecordAccessService.LEVEL_WRITE,
            entite_type='Consultation',
            entite_id=consultation.id,
            request=request,
        )

        # 2. Vérifier la responsabilité du médecin et la cohérence de l'établissement sur cette consultation
        if (
            consultation.medecin_id != request.user.id
            or consultation.etablissement_id != request.user.etablissement_id
        ):
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=request.user,
                etablissement=getattr(request.user, 'etablissement', None),
                statut='REFUSE',
                entite_type='Consultation',
                entite_id=consultation.id,
                details={
                    'patient_id': consultation.dossier.patient_id,
                    'medecin_auteur_id': consultation.medecin_id,
                    'motif': "Tentative de rectification de la consultation d'un confrère.",
                },
                request=request,
            )
            raise PermissionDenied(
                "Rectification refusée : seul le médecin auteur de cette consultation au sein de son établissement "
                "est habilité à la rectifier."
            )

        serializer = ConsultationRectificationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        motif = serializer.validated_data['motif_modification']

        anciennes_valeurs = {
            'observations_cliniques': consultation.observations_cliniques,
            'diagnostic': consultation.diagnostic,
            'prescription': consultation.prescription,
            'conclusions_recommandations': consultation.conclusions_recommandations,
            'examens_demandes': consultation.examens_demandes,
            'constantes': consultation.constantes,
        }

        champs_modifiables = [
            'observations_cliniques', 'diagnostic', 'prescription',
            'conclusions_recommandations', 'examens_demandes', 'constantes'
        ]
        for champ in champs_modifiables:
            if champ in serializer.validated_data:
                setattr(consultation, champ, serializer.validated_data[champ])

        consultation.is_amended = True
        consultation.save()

        ConsultationRevision.objects.create(
            consultation=consultation,
            auteur_modification=request.user,
            motif_modification=motif,
            anciennes_valeurs=anciennes_valeurs,
        )

        operations_traitements = serializer.validated_data.get('operations_traitements') or []
        if operations_traitements:
            from medical_records.models import appliquer_operations_traitements
            appliquer_operations_traitements(
                dossier=consultation.dossier,
                operations=operations_traitements,
                user=request.user,
                consultation=consultation,
                request=request,
            )

        enregistrer_journal(
            action='UPDATE_CONSULTATION',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='Consultation',
            entite_id=consultation.id,
            details={
                'patient_id': consultation.dossier.patient_id,
                'motif_rectification': motif,
            },
            request=request,
        )

        return Response(ConsultationDetailSerializer(consultation).data)

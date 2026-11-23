from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone
from patients.models import Patient
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import PriseEnCharge, Transfert
from .serializers import (
    PriseEnChargeSerializer,
    TransfertSerializer,
    TransfertCreateSerializer
)
from accounts.permissions import IsDoctor, IsActiveProfessionalUser
from medical_records.access_control import MedicalRecordAccessService
from notifications.models import Notification
from audit.models import enregistrer_journal


class PriseEnChargeViewSet(viewsets.ModelViewSet):
    """
    Gestion sécurisée des prises en charge médicales.
    Assure le respect de la règle d'or : une seule prise en charge ordinaire active à la fois.
    """
    queryset = PriseEnCharge.objects.all().select_related(
        'patient', 'etablissement', 'medecin_responsable'
    ).order_by('-date_debut')
    serializer_class = PriseEnChargeSerializer
    permission_classes = [IsActiveProfessionalUser]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Pour les actions sur un objet précis (retrieve, close_care, update, destroy),
        # laisser get_object() trouver l'instance afin de retourner 403 Forbidden (et non 404).
        if self.action == 'list':
            if getattr(user, 'role', None) == 'DIRECTEUR':
                if not user.etablissement_id:
                    return qs.none()
                qs = qs.filter(etablissement_id=user.etablissement_id)
            elif getattr(user, 'role', None) == 'MEDECIN':
                authorized_patient_ids = MedicalRecordAccessService.get_authorized_patient_ids(user)
                qs = qs.filter(
                    Q(medecin_responsable=user, etablissement=user.etablissement) |
                    Q(etablissement=user.etablissement, medecin_responsable__isnull=True) |
                    Q(patient_id__in=authorized_patient_ids)
                )
            elif user.is_admin_user:
                pass
            else:
                if user.etablissement_id:
                    qs = qs.filter(etablissement_id=user.etablissement_id)
                else:
                    return qs.none()

        patient_id = self.request.query_params.get('patient')
        statut = self.request.query_params.get('statut')
        etab_id = self.request.query_params.get('etablissement')
        scope = self.request.query_params.get('scope')

        if scope == 'my_care' and getattr(user, 'role', None) == 'MEDECIN':
            qs = qs.filter(
                medecin_responsable=user,
                etablissement=user.etablissement,
                statut='ACTIF',
                type_prise_en_charge='ORDINAIRE'
            )
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        if statut:
            qs = qs.filter(statut=statut)
        if etab_id:
            qs = qs.filter(etablissement_id=etab_id)
        return qs

    def retrieve(self, request, *args, **kwargs):
        pec = self.get_object()
        user = request.user
        if getattr(user, 'role', None) == 'DIRECTEUR':
            if pec.etablissement_id != user.etablissement_id:
                raise PermissionDenied("Vous ne pouvez consulter que les prises en charge de votre propre établissement.")
            return Response(self.get_serializer(pec).data)

        decision = MedicalRecordAccessService.evaluate(
            request.user,
            pec.patient,
            level=MedicalRecordAccessService.LEVEL_READ,
            action_label='view_prise_en_charge',
            request=request,
            log_Read=False
        )
        if not decision.allowed and (pec.medecin_responsable_id != request.user.id or pec.etablissement_id != request.user.etablissement_id):
            raise PermissionDenied(decision.reason)
        return Response(self.get_serializer(pec).data)

    @action(detail=False, methods=['post'], url_path='take-charge')
    def take_charge(self, request):
        """
        Prise en charge directe d'un patient par le médecin connecté.
        Règles d'exclusivité strictes :
        - Un patient ne peut avoir qu'une seule prise en charge ordinaire active à la fois.
        - Transaction atomique avec select_for_update pour éliminer les courses concurrentes.
        - Si un autre médecin est déjà responsable : HTTP 400 Bad Request avec message explicite.
        - Si une prise en charge ordinaire existe sans médecin assigné dans sa structure : le médecin en devient responsable.
        - Si aucune prise en charge active : création d'une nouvelle prise en charge ordinaire active.
        """
        user = request.user
        if not MedicalRecordAccessService.is_active_approved_doctor(user):
            raise PermissionDenied("Seul un médecin en exercice actif et approuvé peut prendre en charge un patient.")
        if not user.etablissement or not getattr(user.etablissement, 'is_active', True):
            raise PermissionDenied("Votre établissement de rattachement est inactif ou indéfini.")

        raw_patient_id = request.data.get('patient_id') or request.data.get('patient')
        if not raw_patient_id:
            return Response({'detail': "L'identifiant du patient est strictement obligatoire."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            patient = Patient.objects.get(pk=raw_patient_id)
        except Patient.DoesNotExist:
            return Response({'detail': "Patient introuvable."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            # Verrouillage pessimiste atomique sur la prise en charge active du patient
            active_pec = PriseEnCharge.objects.select_for_update().filter(
                patient=patient,
                statut='ACTIF',
                type_prise_en_charge='ORDINAIRE'
            ).select_related('etablissement', 'medecin_responsable').first()

            if active_pec:
                # 1. Le médecin connecté est déjà le responsable
                if active_pec.medecin_responsable_id == user.id:
                    serializer = self.get_serializer(active_pec)
                    return Response(serializer.data, status=status.HTTP_200_OK)

                # 2. Un AUTRE médecin est déjà responsable
                if active_pec.medecin_responsable_id is not None:
                    med_nom = f"Dr {active_pec.medecin_responsable.last_name}"
                    enregistrer_journal(
                        action='PERMISSION_DENIED',
                        utilisateur=user,
                        etablissement=user.etablissement,
                        statut='REFUSE',
                        entite_type='PriseEnCharge',
                        entite_id=active_pec.id,
                        details={
                            'patient_id': patient.id,
                            'reason': f"Tentative de prise en charge d'un patient déjà suivi par {med_nom} à {active_pec.etablissement.nom}."
                        },
                        request=request
                    )
                    return Response(
                        {
                            'detail': (
                                f"Ce patient est déjà pris en charge par {med_nom} ({active_pec.etablissement.nom}). "
                                f"Vous ne pouvez pas remplacer le médecin responsable."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # 3. Prise en charge active sans médecin assigné (créée à l'accueil ou suite à transfert)
                if active_pec.etablissement_id != user.etablissement_id:
                    return Response(
                        {
                            'detail': (
                                f"Ce patient possède une prise en charge ouverte à {active_pec.etablissement.nom}. "
                                f"Un transfert inter-établissements est requis pour le prendre en charge dans votre structure."
                            )
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                active_pec.medecin_responsable = user
                active_pec.date_debut = timezone.now()
                active_pec.save(update_fields=['medecin_responsable', 'date_debut', 'updated_at'])
                pec = active_pec

            else:
                # 4. Aucune prise en charge active : ouverture d'une nouvelle prise en charge
                pec = PriseEnCharge.objects.create(
                    patient=patient,
                    etablissement=user.etablissement,
                    medecin_responsable=user,
                    type_prise_en_charge='ORDINAIRE',
                    statut='ACTIF',
                    date_debut=timezone.now()
                )

            enregistrer_journal(
                action='CARE_OPENED',
                utilisateur=user,
                etablissement=user.etablissement,
                statut='SUCCES',
                entite_type='PriseEnCharge',
                entite_id=pec.id,
                details={
                    'patient_id': patient.id,
                    'patient_nom': f"{patient.nom} {patient.prenom}",
                    'medtransfer_id': patient.medtransfer_id,
                    'medecin_responsable_id': user.id
                },
                request=request
            )

            serializer = self.get_serializer(pec)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

    def create(self, request, *args, **kwargs):
        """
        Création d'une prise en charge via POST /api/care-management/ :
        Utilise la logique atomique et exclusive de take_charge.
        """
        if getattr(request.user, 'role', None) != 'MEDECIN':
            raise PermissionDenied("Seul un médecin en exercice peut ouvrir une prise en charge médicale.")
        return self.take_charge(request)

    @action(detail=True, methods=['post'], url_path='close')
    def close_care(self, request, pk=None):
        """
        Clôture formelle d'une prise en charge ordinaire :
        - Strictement réservée au médecin responsable au sein de son établissement (ou administrateur).
        - Motif de clôture obligatoire.
        - Enregistre date_fin, cloture_par et motif_cloture.
        - Libère le patient pour de nouvelles prises en charge ultérieures.
        """
        pec = self.get_object()
        user = request.user

        is_responsible_doctor = bool(
            pec.medecin_responsable_id == user.id and pec.etablissement_id == user.etablissement_id
        )
        if not (is_responsible_doctor or user.is_admin_user):
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=user,
                etablissement=user.etablissement,
                statut='REFUSE',
                entite_type='PriseEnCharge',
                entite_id=pec.id,
                details={
                    'patient_id': pec.patient_id,
                    'action': 'close_care',
                    'reason': "Tentative de clôture d'une prise en charge appartenant à un autre médecin ou établissement."
                },
                request=request
            )
            return Response(
                {'detail': "Seul le médecin responsable de l'établissement détenteur peut clôturer cette prise en charge."},
                status=status.HTTP_403_FORBIDDEN
            )

        if pec.statut != 'ACTIF':
            return Response(
                {'detail': f"Cette prise en charge n'est pas active (statut : {pec.get_statut_display()})."},
                status=status.HTTP_400_BAD_REQUEST
            )

        motif = (request.data.get('motif') or '').strip()
        if not motif:
            return Response(
                {'detail': "Le motif de clôture de la prise en charge est strictement obligatoire."},
                status=status.HTTP_400_BAD_REQUEST
            )

        pec.cloturer(motif=motif, cloture_par=user)

        enregistrer_journal(
            action='CARE_CLOSED',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='PriseEnCharge',
            entite_id=pec.id,
            details={
                'motif': motif,
                'patient_id': pec.patient_id,
                'cloture_par': user.username
            },
            request=request
        )

        return Response(self.get_serializer(pec).data, status=status.HTTP_200_OK)

    def update(self, request, *args, **kwargs):
        enregistrer_journal(
            action='PERMISSION_DENIED',
            utilisateur=request.user,
            etablissement=getattr(request.user, 'etablissement', None),
            statut='REFUSE',
            entite_type='PriseEnCharge',
            entite_id=kwargs.get('pk'),
            details={'reason': "Modification directe d'une prise en charge interdite."},
            request=request
        )
        return Response(
            {'detail': "La modification directe d'une prise en charge n'est pas autorisée."},
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
            entite_type='PriseEnCharge',
            entite_id=kwargs.get('pk'),
            details={'reason': "Suppression d'une prise en charge interdite."},
            request=request
        )
        return Response(
            {'detail': "La suppression d'une prise en charge est interdite. Utilisez l'action de clôture."},
            status=status.HTTP_403_FORBIDDEN
        )


class TransfertViewSet(viewsets.ModelViewSet):
    """
    Gestion sécurisée du workflow de transfert inter-établissements :
    - L'initiation d'un transfert est réservée aux médecins émetteurs.
    - L'acceptation ou le refus administratif des transferts reçus est effectué par l'agent d'accueil
      de l'établissement destinataire (et non par son directeur).
    - Le directeur peut consulter l'ensemble des transferts entrants et sortants de son établissement.
    """
    queryset = Transfert.objects.all().select_related(
        'patient', 'etablissement_origine', 'etablissement_destination',
        'medecin_emetteur', 'medecin_receveur', 'agent_receveur'
    ).order_by('-date_demande')
    permission_classes = [IsActiveProfessionalUser]

    def get_serializer_class(self):
        if self.action == 'create':
            return TransfertCreateSerializer
        return TransfertSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        user_etab = getattr(user, 'etablissement', None)
        view_mode = self.request.query_params.get('mode')  # 'recus', 'emis', 'all'

        if self.action == 'list':
            if user.is_admin_user:
                pass
            elif not user_etab:
                return qs.none()
            elif getattr(user, 'role', None) == 'AGENT':
                if view_mode == 'emis':
                    qs = qs.filter(etablissement_origine=user_etab)
                else:
                    # Par défaut pour l'agent d'accueil : les demandes reçues par sa structure
                    qs = qs.filter(etablissement_destination=user_etab)
            elif getattr(user, 'role', None) in ('MEDECIN', 'DIRECTEUR'):
                if view_mode == 'recus':
                    qs = qs.filter(etablissement_destination=user_etab)
                elif view_mode == 'emis':
                    qs = qs.filter(etablissement_origine=user_etab)
                else:
                    qs = qs.filter(
                        Q(etablissement_origine=user_etab) |
                        Q(etablissement_destination=user_etab)
                    )
            else:
                return qs.none()

        patient_id = self.request.query_params.get('patient')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)

        statut = self.request.query_params.get('statut')
        if statut:
            qs = qs.filter(statut=statut)

        priorite = self.request.query_params.get('priorite')
        if priorite:
            qs = qs.filter(priorite=priorite)

        return qs

    def retrieve(self, request, *args, **kwargs):
        transfert = self.get_object()
        user = request.user
        if not user.is_admin_user:
            user_etab_id = getattr(user, 'etablissement_id', None)
            if user_etab_id not in (transfert.etablissement_origine_id, transfert.etablissement_destination_id):
                enregistrer_journal(
                    action='PERMISSION_DENIED',
                    utilisateur=user,
                    etablissement=user.etablissement,
                    statut='REFUSE',
                    entite_type='Transfert',
                    entite_id=transfert.id,
                    details={'reason': "Consultation d'un transfert ne concernant pas l'établissement de l'utilisateur."},
                    request=request
                )
                return Response(
                    {'detail': "Accès refusé à ce transfert."},
                    status=status.HTTP_403_FORBIDDEN
                )
        return Response(self.get_serializer(transfert).data)

    def create(self, request, *args, **kwargs):
        if getattr(request.user, 'role', None) != 'MEDECIN':
            raise PermissionDenied("Seul un médecin en exercice peut initier une demande de transfert.")

        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        transfert = serializer.save()

        # Notification automatique créée pour l'établissement de destination
        Notification.objects.create(
            etablissement_cible=transfert.etablissement_destination,
            type_notification='TRANSFERT_DEMANDE',
            titre=f"Demande de transfert : {transfert.patient.nom.upper()} {transfert.patient.prenom}",
            message=f"Le Dr {request.user.last_name} ({transfert.etablissement_origine.code}) sollicite un transfert pour motif : {transfert.motif_transfert[:100]}...",
            reference_objet_type='Transfert',
            reference_objet_id=str(transfert.id)
        )

        enregistrer_journal(
            action='TRANSFER_INITIATE',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='Transfert',
            entite_id=transfert.id,
            details={
                'patient_id': transfert.patient_id,
                'destination': transfert.etablissement_destination.code
            },
            request=request
        )

        return Response(TransfertSerializer(transfert).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='accept')
    def accept_transfer(self, request, pk=None):
        """
        Acceptation formelle du transfert par l'agent d'accueil (ou médecin récepteur)
        de l'établissement récepteur.
        Interdiction formelle au directeur d'établissement d'effectuer l'acceptation administrative.
        """
        transfert = self.get_object()

        if transfert.statut != 'DEMANDE':
            return Response(
                {'detail': "Seul un transfert en attente peut être accepté."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if request.user.etablissement_id != transfert.etablissement_destination_id:
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=request.user,
                etablissement=request.user.etablissement,
                statut='REFUSE',
                entite_type='Transfert',
                entite_id=transfert.id,
                details={
                    'patient_id': transfert.patient_id,
                    'action': 'accept_transfer',
                    'reason': "Tentative d'acceptation d'un transfert par un utilisateur hors établissement de destination."
                },
                request=request
            )
            return Response(
                {'detail': "Seul l'établissement de destination peut accepter ce transfert."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Règle impérative : Le directeur ne doit pas valider administrativement les transferts
        if getattr(request.user, 'role', None) == 'DIRECTEUR':
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=request.user,
                etablissement=request.user.etablissement,
                statut='REFUSE',
                entite_type='Transfert',
                entite_id=transfert.id,
                details={'reason': "Règle métier : l'acceptation administrative incombe à l'agent d'accueil et non au directeur."},
                request=request
            )
            return Response(
                {'detail': "L'acceptation administrative des demandes de transfert doit être effectuée par l'agent d'accueil de l'établissement destinataire, et non par son directeur."},
                status=status.HTTP_403_FORBIDDEN
            )

        motif = request.data.get('motif', "Transfert accepté et patient pris en charge.")

        try:
            nouvelle_pec = transfert.accepter(user_acteur=request.user, motif=motif)
        except DjangoValidationError as e:
            detail = getattr(e, 'message_dict', None) or getattr(e, 'messages', None) or str(e)
            return Response({'detail': detail}, status=status.HTTP_400_BAD_REQUEST)

        # Notification en retour vers le médecin émetteur
        Notification.objects.create(
            destinataire=transfert.medecin_emetteur,
            type_notification='TRANSFERT_ACCEPTE',
            titre=f"Transfert accepté : {transfert.patient.nom.upper()} {transfert.patient.prenom}",
            message=f"La demande de transfert pour {transfert.patient.nom} a été acceptée par l'établissement {transfert.etablissement_destination.nom}.",
            reference_objet_type='Transfert',
            reference_objet_id=str(transfert.id)
        )

        enregistrer_journal(
            action='TRANSFER_ACCEPT',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='Transfert',
            entite_id=transfert.id,
            details={'nouvelle_pec_id': nouvelle_pec.id, 'patient_id': transfert.patient_id, 'acteur_role': request.user.role},
            request=request
        )

        return Response({
            'detail': "Transfert accepté et nouvelle prise en charge ouverte avec succès.",
            'transfert': TransfertSerializer(transfert).data,
            'nouvelle_prise_en_charge': PriseEnChargeSerializer(nouvelle_pec).data
        })

    @action(detail=True, methods=['post'], url_path='reject')
    def reject_transfer(self, request, pk=None):
        """
        Refus motivé du transfert par l'agent d'accueil (ou médecin) de l'établissement récepteur.
        Exige obligatoirement un motif.
        Interdiction formelle au directeur d'établissement d'effectuer le refus administratif.
        """
        transfert = self.get_object()

        if transfert.statut != 'DEMANDE':
            return Response(
                {'detail': "Seul un transfert en attente peut être refusé."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if request.user.etablissement_id != transfert.etablissement_destination_id:
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=request.user,
                etablissement=request.user.etablissement,
                statut='REFUSE',
                entite_type='Transfert',
                entite_id=transfert.id,
                details={
                    'patient_id': transfert.patient_id,
                    'action': 'reject_transfer',
                    'reason': "Tentative de refus d'un transfert par un utilisateur hors établissement de destination."
                },
                request=request
            )
            return Response(
                {'detail': "Seul l'établissement de destination peut refuser ce transfert."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Règle impérative : Le directeur ne doit pas refuser administrativement les transferts
        if getattr(request.user, 'role', None) == 'DIRECTEUR':
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=request.user,
                etablissement=request.user.etablissement,
                statut='REFUSE',
                entite_type='Transfert',
                entite_id=transfert.id,
                details={'reason': "Règle métier : le refus administratif incombe à l'agent d'accueil et non au directeur."},
                request=request
            )
            return Response(
                {'detail': "Le refus administratif des demandes de transfert doit être effectué par l'agent d'accueil de l'établissement destinataire, et non par son directeur."},
                status=status.HTTP_403_FORBIDDEN
            )

        motif = (request.data.get('motif') or '').strip()
        if not motif:
            return Response(
                {'motif': "En cas de refus, un motif obligatoire doit être renseigné."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            transfert.refuser(user_acteur=request.user, motif=motif)
        except DjangoValidationError as e:
            detail = getattr(e, 'message_dict', None) or getattr(e, 'messages', None) or str(e)
            return Response({'detail': detail}, status=status.HTTP_400_BAD_REQUEST)

        Notification.objects.create(
            destinataire=transfert.medecin_emetteur,
            type_notification='TRANSFERT_REFUSE',
            titre=f"Transfert refusé : {transfert.patient.nom.upper()} {transfert.patient.prenom}",
            message=f"Le transfert a été refusé par l'établissement {transfert.etablissement_destination.code}. Motif : {motif}",
            reference_objet_type='Transfert',
            reference_objet_id=str(transfert.id)
        )

        enregistrer_journal(
            action='TRANSFER_REJECT',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='Transfert',
            entite_id=transfert.id,
            details={'motif_refus': motif, 'patient_id': transfert.patient_id, 'acteur_role': request.user.role},
            request=request
        )

        return Response({
            'detail': "Demande de transfert refusée.",
            'transfert': TransfertSerializer(transfert).data
        })

    def update(self, request, *args, **kwargs):
        enregistrer_journal(
            action='PERMISSION_DENIED',
            utilisateur=request.user,
            etablissement=getattr(request.user, 'etablissement', None),
            statut='REFUSE',
            entite_type='Transfert',
            entite_id=kwargs.get('pk'),
            details={'reason': "Modification directe d'un transfert interdite."},
            request=request
        )
        return Response(
            {'detail': "La modification directe d'un transfert n'est pas autorisée."},
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
            entite_type='Transfert',
            entite_id=kwargs.get('pk'),
            details={'reason': "Suppression d'un transfert interdite."},
            request=request
        )
        return Response(
            {'detail': "La suppression d'un transfert est interdite."},
            status=status.HTTP_403_FORBIDDEN
        )

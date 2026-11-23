from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone
from .models import Patient, PatientModificationHistory
from .serializers import (
    PatientListSerializer,
    PatientDetailSerializer,
    PatientCreateSerializer,
    PatientProvisionalCreateSerializer,
    PatientReconciliationSerializer,
    PatientModificationHistorySerializer,
)
from accounts.permissions import IsActiveProfessionalUser
from medical_records.access_control import MedicalRecordAccessService
from care_management.models import Transfert, PriseEnCharge
from audit.models import enregistrer_journal
from core.search_utils import build_multi_token_q


class PatientViewSet(viewsets.ModelViewSet):
    """
    Gestion centralisée des patients dans MEDTRANSFER.
    Expose uniquement l'identification administrative des patients, jamais le contenu clinique.
    """
    queryset = Patient.objects.all().select_related('etablissement_creation', 'cree_par').order_by('-created_at')
    permission_classes = [IsActiveProfessionalUser]

    def get_serializer_class(self):
        if self.action == 'create':
            return PatientCreateSerializer
        if self.action == 'retrieve':
            return PatientDetailSerializer
        return PatientListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        query = self.request.query_params.get('q', '').strip()
        status_identite = self.request.query_params.get('status_identite')
        scope = self.request.query_params.get('scope', '').strip()

        # Côté Administrateur Général :
        # Accès administratif global
        if getattr(user, 'role', None) == 'ADMIN' or getattr(user, 'is_admin_user', False):
            pass

        # Côté Médecin :
        # - Par défaut (sans recherche explicite q), n'afficher que les patients légitimement
        #   suivis par ce médecin ou sous prise en charge active dans son établissement,
        #   sous autorisation d'urgence active, ou en transfert entrant.
        # - Lorsqu'une recherche explicite q est saisie, permettre l'identification administrative
        #   sur le référentiel national (sans jamais exposer le dossier médical).
        elif getattr(user, 'role', None) == 'MEDECIN' and self.action == 'list':
            if scope == 'my_care' or not query:
                authorized_ids = MedicalRecordAccessService.get_authorized_patient_ids(user)
                incoming_transfer_patient_ids = set(
                    Transfert.objects.filter(
                        etablissement_destination=user.etablissement,
                        statut='DEMANDE'
                    ).values_list('patient_id', flat=True)
                ) if user.etablissement_id else set()
                visible_ids = authorized_ids | incoming_transfer_patient_ids
                qs = qs.filter(id__in=visible_ids)

        # Côté Directeur d'établissement :
        # Restreindre la consultation aux patients pris en charge, transférés vers/depuis,
        # ou créés par son établissement.
        elif getattr(user, 'role', None) == 'DIRECTEUR' and self.action == 'list':
            if user.etablissement_id:
                pec_patients = PriseEnCharge.objects.filter(etablissement=user.etablissement).values_list('patient_id', flat=True)
                transfer_patients = Transfert.objects.filter(
                    Q(etablissement_origine=user.etablissement) | Q(etablissement_destination=user.etablissement)
                ).values_list('patient_id', flat=True)
                created_patients = Patient.objects.filter(etablissement_creation=user.etablissement).values_list('id', flat=True)
                visible_ids = set(pec_patients) | set(transfer_patients) | set(created_patients)
                qs = qs.filter(id__in=visible_ids)
            else:
                qs = qs.none()

        # Côté Agent d'accueil :
        # - Par défaut (sans recherche textuelle explicite q et sans scope=='directory'),
        #   restreindre aux patients liés à son établissement (créés, pris en charge, ou transférés).
        # - Lors d'une recherche textuelle explicite q ou si scope == 'directory',
        #   permettre la recherche nationale pour identification et prévention des doublons.
        elif getattr(user, 'role', None) == 'AGENT' and self.action == 'list':
            if not query and scope != 'directory':
                if user.etablissement_id:
                    pec_patients = PriseEnCharge.objects.filter(etablissement=user.etablissement).values_list('patient_id', flat=True)
                    transfer_patients = Transfert.objects.filter(
                        Q(etablissement_origine=user.etablissement) | Q(etablissement_destination=user.etablissement)
                    ).values_list('patient_id', flat=True)
                    created_patients = Patient.objects.filter(etablissement_creation=user.etablissement).values_list('id', flat=True)
                    visible_ids = set(pec_patients) | set(transfer_patients) | set(created_patients)
                    qs = qs.filter(id__in=visible_ids)
                else:
                    qs = qs.none()

        if query:
            patient_search_fields = [
                'medtransfer_id',
                'nom',
                'prenom',
                'numero_identification_nationale',
                'telephone',
                'ville',
            ]
            qs = qs.filter(build_multi_token_q(query, patient_search_fields))

        if status_identite:
            qs = qs.filter(status_identite=status_identite)

        return qs

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        user = request.user

        # Contrôle strict pour le Directeur :
        if getattr(user, 'role', None) == 'DIRECTEUR' and not user.is_admin_user:
            is_creator = instance.etablissement_creation_id == user.etablissement_id
            has_pec = PriseEnCharge.objects.filter(patient=instance, etablissement=user.etablissement).exists()
            has_transfert = Transfert.objects.filter(
                Q(etablissement_origine=user.etablissement) | Q(etablissement_destination=user.etablissement),
                patient=instance
            ).exists()
            if not (is_creator or has_pec or has_transfert):
                enregistrer_journal(
                    action='PERMISSION_DENIED',
                    utilisateur=user,
                    etablissement=user.etablissement,
                    statut='REFUSE',
                    entite_type='Patient',
                    entite_id=instance.id,
                    details={'reason': "Tentative de consultation d'un patient sans lien avec votre établissement."},
                    request=request
                )
                return Response(
                    {'detail': "Accès refusé : ce patient n'a aucun lien de prise en charge avec votre établissement."},
                    status=status.HTTP_403_FORBIDDEN
                )

        enregistrer_journal(
            action='VIEW_PATIENT',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='Patient',
            entite_id=instance.id,
            details={'medtransfer_id': instance.medtransfer_id},
            request=request
        )
        serializer = self.get_serializer(instance, context={'request': request})
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        patient = serializer.save()

        enregistrer_journal(
            action='CREATE_PATIENT',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='Patient',
            entite_id=patient.id,
            details={'medtransfer_id': patient.medtransfer_id},
            request=request
        )

        detail_serializer = PatientDetailSerializer(patient, context={'request': request})
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """
        Correction contrôlée des données administratives et d'identité d'un patient.
        - Exige obligatoirement un motif justificatif.
        - Conserve l'historique complet (ancienne et nouvelle valeur, auteur, date, motif).
        - Interdiction formelle de modifier le medtransfer_id.
        - Préserve intégralement les consultations historiques.
        """
        patient = self.get_object()
        user = request.user

        # Vérification des autorisations
        is_admin = bool(user.is_admin_user)
        is_creator = bool(user.etablissement_id and patient.etablissement_creation_id == user.etablissement_id)
        has_care = bool(user.etablissement_id and PriseEnCharge.objects.filter(patient=patient, etablissement_id=user.etablissement_id).exists())
        has_transfer = bool(user.etablissement_id and Transfert.objects.filter(
            patient=patient,
            etablissement_destination_id=user.etablissement_id,
            statut__in=['DEMANDE', 'ACCEPTE']
        ).exists())

        if not (is_admin or is_creator or has_care or has_transfer):
            enregistrer_journal(
                action='PERMISSION_DENIED',
                utilisateur=user,
                etablissement=user.etablissement,
                statut='REFUSE',
                entite_type='Patient',
                entite_id=patient.id,
                details={'reason': "Tentative de correction administrative par un utilisateur non rattaché au patient."},
                request=request
            )
            return Response(
                {'detail': "Accès refusé : vous n'êtes pas autorisé à modifier les données administratives de ce patient."},
                status=status.HTTP_403_FORBIDDEN
            )

        motif = (request.data.get('motif') or '').strip()
        if not motif:
            return Response(
                {'motif': "Le motif de la correction administrative est strictement obligatoire."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if 'medtransfer_id' in request.data and request.data['medtransfer_id'] != patient.medtransfer_id:
            return Response(
                {'medtransfer_id': "L'identifiant unique MEDTRANSFER est permanent et immuable."},
                status=status.HTTP_400_BAD_REQUEST
            )

        allowed_fields = [
            'nom', 'prenom', 'date_naissance', 'sexe',
            'numero_identification_nationale', 'telephone',
            'adresse', 'ville', 'groupe_sanguin',
            'personne_contact_nom', 'personne_contact_telephone',
        ]

        champs_modifies = {}
        for field in allowed_fields:
            if field in request.data:
                old_val = getattr(patient, field)
                new_val = request.data[field]
                old_str = str(old_val) if old_val is not None else ''
                new_str = str(new_val) if new_val is not None else ''
                if old_str != new_str:
                    champs_modifies[field] = {
                        'ancien': old_str,
                        'nouveau': new_str
                    }
                    setattr(patient, field, new_val)

        if not champs_modifies:
            return Response(
                {'detail': "Aucune modification constatée sur les champs autorisés."},
                status=status.HTTP_400_BAD_REQUEST
            )

        patient.save()

        # Enregistrement dans l'historique médicolégal
        history_entry = PatientModificationHistory.objects.create(
            patient=patient,
            auteur=user,
            etablissement=user.etablissement,
            motif=motif,
            champs_modifies=champs_modifies
        )

        enregistrer_journal(
            action='UPDATE_ADMIN_PATIENT',
            utilisateur=user,
            etablissement=user.etablissement,
            statut='SUCCES',
            entite_type='Patient',
            entite_id=patient.id,
            details={
                'medtransfer_id': patient.medtransfer_id,
                'motif': motif,
                'champs_modifies': list(champs_modifies.keys()),
            },
            request=request
        )

        serializer = PatientDetailSerializer(patient, context={'request': request})
        return Response({
            'message': "Informations administratives du patient corrigées avec succès.",
            'patient': serializer.data,
            'modification_id': history_entry.id
        }, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        return self.update(request, *args, **kwargs)

    @action(detail=True, methods=['get'], url_path='history')
    def history(self, request, pk=None):
        """Renvoie l'historique des modifications administratives de ce patient."""
        patient = self.get_object()
        user = request.user
        is_admin = bool(user.is_admin_user)
        is_creator = bool(user.etablissement_id and patient.etablissement_creation_id == user.etablissement_id)
        has_care = bool(user.etablissement_id and PriseEnCharge.objects.filter(patient=patient, etablissement_id=user.etablissement_id).exists())
        has_transfer = bool(user.etablissement_id and Transfert.objects.filter(patient=patient, etablissement_destination_id=user.etablissement_id).exists())
        if not (is_admin or is_creator or has_care or has_transfer):
            return Response({'detail': "Accès non autorisé à l'historique de ce patient."}, status=status.HTTP_403_FORBIDDEN)

        history_entries = patient.historique_modifications.all().select_related('auteur', 'etablissement').order_by('-date_modification')
        serializer = PatientModificationHistorySerializer(history_entries, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        enregistrer_journal(
            action='PERMISSION_DENIED',
            utilisateur=request.user,
            etablissement=getattr(request.user, 'etablissement', None),
            statut='REFUSE',
            entite_type='Patient',
            entite_id=kwargs.get('pk'),
            details={'reason': "Suppression physique d'un patient interdite."},
            request=request
        )
        return Response(
            {'detail': "La suppression physique d'un patient est strictement interdite dans MEDTRANSFER."},
            status=status.HTTP_403_FORBIDDEN
        )

    @action(detail=False, methods=['post'], url_path='provisional')
    def create_provisional(self, request):
        """Création d'une fiche d'urgence sous statut [IDENTITÉ À CONFIRMER]."""
        serializer = PatientProvisionalCreateSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        patient = serializer.save()

        enregistrer_journal(
            action='CREATE_PROVISIONAL_PATIENT',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='Patient',
            entite_id=patient.id,
            details={'motif': patient.motif_identite_provisoire},
            request=request
        )

        return Response(PatientDetailSerializer(patient, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='check-duplicates')
    def check_duplicates(self, request):
        """
        Détection proactive des doublons avant création :
        Recherche par nom, prénom, NIN ou date de naissance.
        """
        nom = request.query_params.get('nom', '').strip()
        prenom = request.query_params.get('prenom', '').strip()
        nin = request.query_params.get('nin', '').strip()
        date_naissance = request.query_params.get('date_naissance')

        matches = Patient.objects.none()

        if nin:
            matches = matches | Patient.objects.filter(numero_identification_nationale=nin)

        if nom and prenom:
            sub = Patient.objects.filter(nom__iexact=nom, prenom__iexact=prenom)
            if date_naissance:
                sub = sub.filter(date_naissance=date_naissance)
            matches = matches | sub

        matches = matches.distinct()[:5]
        serializer = PatientListSerializer(matches, many=True, context={'request': request})
        return Response({
            'count': matches.count(),
            'has_potential_duplicates': matches.count() > 0,
            'results': serializer.data
        })

    @action(detail=True, methods=['get'], url_path='active-care')
    def get_active_care(self, request, pk=None):
        """
        Vérification de la prise en charge active pour affichage du bandeau d'alerte.
        """
        patient = self.get_object()
        pec = patient.prises_en_charge.filter(
            statut='ACTIF', type_prise_en_charge='ORDINAIRE'
        ).select_related('etablissement', 'medecin_responsable').first()

        user_etab = request.user.etablissement
        is_followed_elsewhere = False
        warning_message = None

        if pec and (
            not user_etab
            or pec.etablissement_id != user_etab.id
            or (request.user.role == 'MEDECIN' and pec.medecin_responsable_id != request.user.id)
        ):
            is_followed_elsewhere = True
            med_label = f"Dr {pec.medecin_responsable.last_name}" if pec.medecin_responsable else "un médecin"
            warning_message = (
                f"Ce patient possède actuellement une prise en charge active "
                f"à {pec.etablissement.nom} ({med_label})."
            )

        allowed, mode = (False, None)
        if request.user.role == 'MEDECIN':
            decision = MedicalRecordAccessService.evaluate(
                request.user, patient, level=MedicalRecordAccessService.LEVEL_READ, log_denied=False
            )
            allowed = decision.allowed
            mode = decision.mode

        return Response({
            'has_active_care': pec is not None,
            'is_followed_elsewhere': is_followed_elsewhere,
            'acces_clinique_autorise': allowed,
            'mode_acces_medecin': mode,
            'warning_message': warning_message,
            'prise_en_charge': {
                'id': pec.id,
                'etablissement_id': pec.etablissement.id,
                'etablissement_nom': pec.etablissement.nom,
                'etablissement_code': pec.etablissement.code,
                'medecin_responsable_id': pec.medecin_responsable_id,
                'medecin_nom': f"Dr {pec.medecin_responsable.last_name}" if pec.medecin_responsable else "Non assigné",
                'date_debut': pec.date_debut,
            } if pec else None
        })

    @action(detail=True, methods=['post'], url_path='reconcile')
    def reconcile(self, request, pk=None):
        """Rapprochement contrôlé d'une fiche provisoire vers une fiche cible."""
        provisional = self.get_object()
        if not provisional.is_provisional:
            return Response(
                {'detail': "Seul un enregistrement sous statut 'IDENTITÉ À CONFIRMER' peut faire l'objet d'un rapprochement."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = PatientReconciliationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        target_id = serializer.validated_data['target_patient_id']
        motif = serializer.validated_data['motif']

        try:
            target = Patient.objects.get(pk=target_id)
        except Patient.DoesNotExist:
            return Response({'detail': "Patient cible introuvable."}, status=status.HTTP_404_NOT_FOUND)

        if target.id == provisional.id:
            return Response({'detail': "Impossible de rapprocher un dossier avec lui-même."}, status=status.HTTP_400_BAD_REQUEST)

        provisional.reconciled_with = target
        provisional.reconciled_at = timezone.now()
        provisional.reconciled_by = request.user
        provisional.status_identite = 'CONFIRMEE'
        provisional.save()

        enregistrer_journal(
            action='RECONCILE_PATIENT',
            utilisateur=request.user,
            etablissement=request.user.etablissement,
            statut='SUCCES',
            entite_type='Patient',
            entite_id=provisional.id,
            details={'target_id': target.id, 'motif': motif},
            request=request
        )

        return Response({
            'detail': "Rapprochement effectué avec succès.",
            'provisional_patient': PatientDetailSerializer(provisional, context={'request': request}).data,
            'target_patient': PatientDetailSerializer(target, context={'request': request}).data
        })

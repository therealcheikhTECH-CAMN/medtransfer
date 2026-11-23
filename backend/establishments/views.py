from django.utils import timezone
from rest_framework import viewsets, permissions, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Etablissement
from .serializers import EtablissementSerializer, EtablissementPublicSerializer
from accounts.permissions import IsAdminUser
from core.search_utils import build_multi_token_q
from audit.models import enregistrer_journal


class EtablissementViewSet(viewsets.ModelViewSet):
    """
    Référentiel des structures de santé et orientation inter-hôpitaux :
    - Consultation publique (sans authentification) des établissements actifs pour l'inscription.
    - Consultation complète pour les professionnels authentifiés.
    - Création, mise à jour, activation/désactivation et attribution de directeur réservées à l'administrateur.
    """
    queryset = Etablissement.objects.all().select_related('directeur').order_by('nom')
    serializer_class = EtablissementSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['nom', 'code', 'ville', 'region', 'services_declares']
    ordering_fields = ['nom', 'ville', 'region', 'type_etablissement']

    def perform_authentication(self, request):
        """
        Sur les endpoints publics de lecture des établissements, ne jamais bloquer
        la requête si un ancien token JWT expiré est présent dans le navigateur.
        """
        if self.action in ['public', 'list', 'directory', 'retrieve']:
            try:
                super().perform_authentication(request)
            except Exception:
                request._not_authenticated()
        else:
            super().perform_authentication(request)

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'toggle_active', 'assign_director']:
            return [IsAdminUser()]
        if self.action in ['public', 'list', 'retrieve', 'directory']:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        if self.action == 'public':
            return EtablissementPublicSerializer
        if self.action in ['list', 'retrieve'] and not (self.request.user and self.request.user.is_authenticated):
            return EtablissementPublicSerializer
        return EtablissementSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        is_admin = bool(user and user.is_authenticated and (getattr(user, 'role', None) == 'ADMIN' or user.is_superuser))

        # Pour toute consultation publique (inscription) ou utilisateur non-admin sans filtre spécifique,
        # retourner exclusivement les établissements actifs (is_active=True).
        is_active_param = self.request.query_params.get('is_active')
        if not is_admin:
            qs = qs.filter(is_active=True)
        else:
            if is_active_param in ('true', '1', 'True'):
                qs = qs.filter(is_active=True)
            elif is_active_param in ('false', '0', 'False'):
                qs = qs.filter(is_active=False)

        region = self.request.query_params.get('region')
        ville = self.request.query_params.get('ville')
        type_etab = self.request.query_params.get('type')
        service = self.request.query_params.get('service')
        query = (self.request.query_params.get('q') or self.request.query_params.get('search') or '').strip()

        if query:
            etab_fields = ['nom', 'code', 'ville', 'region', 'services_declares']
            qs = qs.filter(build_multi_token_q(query, etab_fields))
        if region:
            qs = qs.filter(region__icontains=region)
        if ville:
            qs = qs.filter(ville__icontains=ville)
        if type_etab:
            qs = qs.filter(type_etablissement=type_etab)
        if service:
            qs = qs.filter(services_declares__icontains=service)
        return qs

    def perform_create(self, serializer):
        etab = serializer.save()
        enregistrer_journal(
            action='ESTABLISHMENT_CREATED',
            utilisateur=self.request.user,
            etablissement=etab,
            statut='SUCCES',
            entite_type='Etablissement',
            entite_id=etab.id,
            details={'code': etab.code, 'nom': etab.nom, 'type': etab.type_etablissement},
            request=self.request
        )

    def perform_update(self, serializer):
        etab = serializer.save()
        enregistrer_journal(
            action='ESTABLISHMENT_UPDATED',
            utilisateur=self.request.user,
            etablissement=etab,
            statut='SUCCES',
            entite_type='Etablissement',
            entite_id=etab.id,
            details={'code': etab.code, 'nom': etab.nom, 'is_active': etab.is_active},
            request=self.request
        )

    @action(detail=True, methods=['post'], url_path='toggle-active', permission_classes=[IsAdminUser])
    def toggle_active(self, request, pk=None):
        """Active ou désactive un établissement de santé (seul l'administrateur peut effectuer cette action)."""
        etab = self.get_object()
        new_state = request.data.get('is_active')
        if new_state is None:
            etab.is_active = not etab.is_active
        else:
            etab.is_active = bool(new_state)
        etab.save(update_fields=['is_active', 'updated_at'])

        action_name = 'ESTABLISHMENT_ACTIVATED' if etab.is_active else 'ESTABLISHMENT_DEACTIVATED'
        enregistrer_journal(
            action=action_name,
            utilisateur=request.user,
            etablissement=etab,
            statut='SUCCES',
            entite_type='Etablissement',
            entite_id=etab.id,
            details={'code': etab.code, 'nom': etab.nom, 'is_active': etab.is_active},
            request=request
        )
        return Response(self.get_serializer(etab).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'], url_path='assign-director', permission_classes=[IsAdminUser])
    def assign_director(self, request, pk=None):
        """
        Attribue ou remplace le directeur d'un établissement :
        - Soit en sélectionnant un utilisateur existant (user_id).
        - Soit en créant un nouveau directeur avec ses identifiants.
        """
        from accounts.models import User, UserStatusHistory

        etab = self.get_object()
        user_id = request.data.get('user_id')
        email = (request.data.get('email') or '').strip().lower()
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()
        password = (request.data.get('password') or '').strip()
        matricule = (request.data.get('matricule_professionnel') or '').strip()
        telephone = (request.data.get('telephone') or '').strip()

        old_director = etab.directeur

        if user_id:
            try:
                director_user = User.objects.get(pk=user_id)
            except User.DoesNotExist:
                return Response({'detail': "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)
        elif email:
            director_user = User.objects.filter(email=email).first()
            if not director_user:
                if not password:
                    return Response({'password': "Un mot de passe est obligatoire pour créer le compte du directeur."}, status=status.HTTP_400_BAD_REQUEST)
                username = email.split('@')[0]
                base_username = username
                idx = 1
                while User.objects.filter(username=username).exists():
                    username = f"{base_username}_{idx}"
                    idx += 1
                director_user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    matricule_professionnel=matricule,
                    telephone=telephone,
                    role='DIRECTEUR',
                    etablissement=etab,
                    statut_validation='APPROVED',
                    is_active=True,
                    is_actif=True,
                    validated_by=request.user,
                    validated_at=timezone.now()
                )
                UserStatusHistory.objects.create(
                    user=director_user,
                    changed_by=request.user,
                    ancien_statut='PENDING',
                    nouveau_statut='APPROVED',
                    motif="Création et nomination directe comme Directeur par l'Administrateur Général"
                )
        else:
            return Response(
                {'detail': "Veuillez fournir un identifiant utilisateur (user_id) ou les coordonnées complètes du directeur (email, mot de passe)."},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Mettre à jour l'utilisateur en tant que Directeur de cet établissement
        director_user.role = 'DIRECTEUR'
        director_user.etablissement = etab
        director_user.statut_validation = 'APPROVED'
        director_user.is_active = True
        director_user.is_actif = True
        if first_name:
            director_user.first_name = first_name
        if last_name:
            director_user.last_name = last_name
        if matricule:
            director_user.matricule_professionnel = matricule
        if telephone:
            director_user.telephone = telephone
        director_user.save()

        etab.directeur = director_user
        etab.save(update_fields=['directeur', 'updated_at'])

        action_name = 'DIRECTOR_REPLACED' if old_director and old_director.id != director_user.id else 'DIRECTOR_ASSIGNED'
        enregistrer_journal(
            action=action_name,
            utilisateur=request.user,
            etablissement=etab,
            statut='SUCCES',
            entite_type='Etablissement',
            entite_id=etab.id,
            details={
                'directeur_id': director_user.id,
                'directeur_email': director_user.email,
                'ancien_directeur_id': old_director.id if old_director else None,
            },
            request=request
        )

        return Response(
            {
                'message': f"Le directeur {director_user.first_name} {director_user.last_name} a été officiellement attribué à {etab.nom}.",
                'etablissement': self.get_serializer(etab).data
            },
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'], url_path='public', authentication_classes=[], permission_classes=[permissions.AllowAny])
    def public(self, request):
        """
        Endpoint public sans authentification pour le menu déroulant d'inscription professionnelle.
        Retourne uniquement les établissements actifs avec (id, nom, ville, is_active).
        """
        qs = Etablissement.objects.filter(is_active=True).order_by('nom')
        serializer = EtablissementPublicSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='directory')
    def directory(self, request):
        """Annuaire d'orientation des structures de santé et services déclarés."""
        qs = self.get_queryset()
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)
    @action(detail=False, methods=['get', 'patch', 'put'], url_path='my-establishment', permission_classes=[permissions.IsAuthenticated])
    def my_establishment(self, request):
        """
        Permet au directeur d'un établissement de consulter et modifier les informations
        administratives de son propre établissement sanitaire.
        """
        user = request.user
        if not user.is_authenticated or user.role != 'DIRECTEUR':
            return Response(
                {'detail': "Accès réservé exclusivement aux directeurs d'établissement."},
                status=status.HTTP_403_FORBIDDEN
            )
        if not user.etablissement:
            return Response(
                {'detail': "Aucun établissement n'est rattaché à votre compte directeur."},
                status=status.HTTP_404_NOT_FOUND
            )

        etab = user.etablissement
        if request.method == 'GET':
            serializer = self.get_serializer(etab)
            return Response(serializer.data)

        # Modification sécurisée : filtrer strictement les champs modifiables par le directeur
        # Forbid modifying id, code, is_active, directeur
        allowed_fields = [
            'nom', 'type_etablissement', 'adresse', 'ville', 'region',
            'telephone', 'email', 'services_declares', 'site_web', 'description'
        ]
        update_data = {k: v for k, v in request.data.items() if k in allowed_fields}

        serializer = self.get_serializer(etab, data=update_data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated_etab = serializer.save()

        enregistrer_journal(
            action='DIRECTOR_ESTABLISHMENT_UPDATED',
            utilisateur=user,
            etablissement=updated_etab,
            statut='SUCCES',
            entite_type='Etablissement',
            entite_id=updated_etab.id,
            details={
                'nom': updated_etab.nom,
                'ville': updated_etab.ville,
                'telephone': updated_etab.telephone,
                'email': updated_etab.email
            },
            request=request
        )

        return Response(
            {
                'message': "Les informations administratives de votre établissement ont été mises à jour avec succès.",
                'etablissement': self.get_serializer(updated_etab).data
            },
            status=status.HTTP_200_OK
        )


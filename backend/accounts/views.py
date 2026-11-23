import secrets
import hashlib
from datetime import timedelta
from django.conf import settings
from django.utils import timezone
from rest_framework import generics, viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .models import User, PasswordResetToken, UserStatusHistory
from .serializers import (
    UserSerializer,
    ProfessionalRegistrationSerializer,
    DirectorRegistrationSerializer,
    CustomTokenObtainPairSerializer,
    CustomTokenRefreshSerializer,
    ChangePasswordSerializer,
    PasswordResetRequestSerializer,
    PasswordResetConfirmSerializer,
    UserAdminManageSerializer,
    UserStatusHistorySerializer,
)
from .permissions import IsAdminUser, IsAdminOrDirector
from .emails import send_account_validation_email, send_password_reset_email, send_director_validation_email, send_director_rejection_email
from audit.models import enregistrer_journal
from core.search_utils import build_multi_token_q




class DirectorRegistrationView(generics.CreateAPIView):
    """
    Inscription publique / Demande d'accès d'un Directeur d'établissement.
    Le compte créé reste inactif (statut PENDING) jusqu'à validation par l'Administrateur Général.
    """
    serializer_class = DirectorRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                'message': (
                    "Votre demande d'accès en tant que directeur d'établissement a bien été enregistrée. "
                    "Elle sera examinée par l'administrateur général avant activation de votre compte."
                ),
                'user': UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED
        )

class ProfessionalRegistrationView(generics.CreateAPIView):
    """
    Inscription publique d'un professionnel de santé (Médecin ou Agent d'accueil).
    Le compte créé reste inactif (statut PENDING) jusqu'à la validation par le directeur.
    """
    serializer_class = ProfessionalRegistrationSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {
                'message': (
                    "Votre demande d'inscription a bien été transmise au directeur de votre établissement. "
                    "Votre compte sera activé dès sa validation."
                ),
                'user': UserSerializer(user).data,
            },
            status=status.HTTP_201_CREATED
        )


class CustomTokenObtainPairView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    serializer_class = CustomTokenObtainPairSerializer


class CustomTokenRefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    serializer_class = CustomTokenRefreshSerializer


class CurrentUserView(generics.RetrieveAPIView):
    """Renvoie le profil de l'utilisateur connecté (sans aucun hash de mot de passe)."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    """
    Modification sécurisée du mot de passe après connexion (« Sécurité et mot de passe »).
    Invalide immédiatement les anciens tokens JWT grâce à l'incrémentation de token_version.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        user = request.user
        new_password = serializer.validated_data['new_password']

        user.set_password(new_password)
        user.token_version += 1
        user.password_changed_at = timezone.now()
        user.save(update_fields=['password', 'token_version', 'password_changed_at'])

        enregistrer_journal(
            action='PASSWORD_CHANGED',
            utilisateur=user,
            etablissement=user.etablissement,
            statut='SUCCES',
            entite_type='User',
            entite_id=user.id,
            details={'email': user.email, 'role': user.role},
            request=request
        )

        refresh = CustomTokenObtainPairSerializer.get_token(user)
        return Response(
            {
                'message': "Votre mot de passe a été modifié avec succès.",
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            status=status.HTTP_200_OK
        )


class PasswordResetRequestView(APIView):
    """
    Demande de réinitialisation de mot de passe (« Mot de passe oublié ? »).
    Ne révèle jamais si l'adresse e-mail existe ou non en base de données.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()

        neutral_message = (
            "Si un compte professionnel actif correspond à cette adresse e-mail, "
            "un lien de réinitialisation temporaire et à usage unique vous a été envoyé."
        )

        user = User.objects.filter(
            email__iexact=email,
            statut_validation='APPROVED',
            is_active=True,
            is_actif=True
        ).first()

        if user:
            # Invalider les anciens jetons non utilisés de cet utilisateur
            PasswordResetToken.objects.filter(user=user, is_used=False).update(
                is_used=True,
                used_at=timezone.now()
            )

            raw_token = secrets.token_urlsafe(48)
            token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
            timeout_seconds = getattr(settings, 'PASSWORD_RESET_TIMEOUT', 3600)
            expires_at = timezone.now() + timedelta(seconds=timeout_seconds)

            PasswordResetToken.objects.create(
                user=user,
                token_hash=token_hash,
                expires_at=expires_at
            )

            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
            reset_url = f"{frontend_url}/reset-password?token={raw_token}"

            try:
                send_password_reset_email(user, reset_url)
                enregistrer_journal(
                    action='PASSWORD_RESET_REQUEST',
                    utilisateur=user,
                    etablissement=user.etablissement,
                    statut='SUCCES',
                    entite_type='User',
                    entite_id=user.id,
                    details={'email': user.email},
                    request=request
                )
            except Exception as exc:
                enregistrer_journal(
                    action='PASSWORD_RESET_REQUEST',
                    utilisateur=user,
                    etablissement=user.etablissement,
                    statut='ECHEC',
                    entite_type='User',
                    entite_id=user.id,
                    details={'email': user.email, 'error': str(exc)},
                    request=request
                )

        return Response({'message': neutral_message}, status=status.HTTP_200_OK)


class PasswordResetConfirmView(APIView):
    """
    Réinitialisation effective du mot de passe à l'aide du lien temporaire à usage unique.
    Invalide le jeton de réinitialisation ainsi que tous les tokens JWT antérieurs.
    """
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reset_record = serializer.validated_data['reset_record']
        user = serializer.validated_data['user']
        new_password = serializer.validated_data['new_password']

        reset_record.mark_used()
        # Invalider tout autre jeton de réinitialisation restant pour ce compte
        PasswordResetToken.objects.filter(user=user, is_used=False).update(
            is_used=True,
            used_at=timezone.now()
        )

        user.set_password(new_password)
        user.token_version += 1
        user.password_changed_at = timezone.now()
        user.save(update_fields=['password', 'token_version', 'password_changed_at'])

        enregistrer_journal(
            action='PASSWORD_RESET_CONFIRM',
            utilisateur=user,
            etablissement=user.etablissement,
            statut='SUCCES',
            entite_type='User',
            entite_id=user.id,
            details={'email': user.email},
            request=request
        )

        return Response(
            {'message': "Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter."},
            status=status.HTTP_200_OK
        )


class UserViewSet(viewsets.ModelViewSet):
    """
    Gestion des comptes professionnels et des demandes d'inscription :
    - L'administrateur du site (ADMIN) gère l'ensemble des comptes.
    - Le directeur d'établissement (DIRECTEUR) consulte, valide, refuse ou suspend
      les demandes et comptes des professionnels rattachés à son établissement.
    """
    queryset = User.objects.all().select_related('etablissement', 'validated_by').order_by('-date_joined')
    permission_classes = [IsAdminOrDirector]

    def get_permissions(self):
        if self.action in ['create', 'destroy', 'update', 'partial_update']:
            return [IsAdminUser()]
        return [IsAdminOrDirector()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Si Directeur : restreindre strictement aux professionnels de son établissement
        if user.is_director and not user.is_admin_user:
            if not user.etablissement:
                return qs.none()
            qs = qs.filter(etablissement=user.etablissement).exclude(role='ADMIN')

        statut = self.request.query_params.get('statut_validation')
        role = self.request.query_params.get('role')
        etablissement_id = self.request.query_params.get('etablissement')
        query = (self.request.query_params.get('q') or self.request.query_params.get('search') or '').strip()

        if query:
            user_fields = [
                'username',
                'first_name',
                'last_name',
                'email',
                'matricule_professionnel',
                'specialite',
                'etablissement__nom',
            ]
            qs = qs.filter(build_multi_token_q(query, user_fields))
        if statut:
            qs = qs.filter(statut_validation=statut)
        if role:
            qs = qs.filter(role=role)
        if etablissement_id and user.is_admin_user:
            qs = qs.filter(etablissement_id=etablissement_id)

        return qs

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return UserAdminManageSerializer
        return UserSerializer

    def _check_director_scope(self, request, target_user):
        if request.user.is_director and not request.user.is_admin_user:
            if not request.user.etablissement or target_user.etablissement_id != request.user.etablissement_id:
                return Response(
                    {'detail': "Vous ne pouvez gérer que les demandes de votre propre établissement."},
                    status=status.HTTP_403_FORBIDDEN
                )
            if target_user.role in ('ADMIN', 'DIRECTEUR') and target_user.id != request.user.id:
                return Response(
                    {'detail': "Opération non autorisée sur ce rôle."},
                    status=status.HTTP_403_FORBIDDEN
                )
        return None

    @action(detail=True, methods=['post'], url_path='approve')
    def approve(self, request, pk=None):
        """
        Valide la demande d'inscription d'un professionnel ou d'un directeur :
        - Vérifie les droits (seul un ADMIN peut valider un DIRECTEUR).
        - Enforce la règle stricte : Un établissement ne peut avoir qu'un seul directeur actif à la fois.
        - Si un directeur actif existe déjà, exige une révocation préalable avec motif explicite.
        - Enregistre la décision et active le compte (statut APPROVED).
        - Envoie automatiquement l'e-mail de confirmation adapté (professionnel ou directeur).
        """
        target = self.get_object()
        denied = self._check_director_scope(request, target)
        if denied:
            return denied

        is_director_req = (target.role == 'DIRECTEUR')
        if is_director_req and not request.user.is_admin_user:
            return Response(
                {'detail': "Seul un administrateur général peut valider une demande d'accès Directeur."},
                status=status.HTTP_403_FORBIDDEN
            )

        # Règle d'exclusivité : 1 seul directeur actif par établissement
        if is_director_req and target.etablissement:
            active_directors = User.objects.filter(
                etablissement=target.etablissement,
                role='DIRECTEUR',
                statut_validation='APPROVED',
                is_active=True,
                is_actif=True
            ).exclude(id=target.id)

            current_director = active_directors.first()
            if not current_director and target.etablissement.directeur and target.etablissement.directeur.id != target.id:
                if target.etablissement.directeur.statut_validation == 'APPROVED' and target.etablissement.directeur.is_active:
                    current_director = target.etablissement.directeur

            if current_director:
                replace_current = (
                    request.data.get('replace_current') is True or
                    request.data.get('revoke_current') is True or
                    str(request.data.get('replace_current', '')).lower() in ('true', '1') or
                    str(request.data.get('revoke_current', '')).lower() in ('true', '1')
                )
                if not replace_current:
                    return Response(
                        {
                            'code': 'ACTIVE_DIRECTOR_EXISTS',
                            'detail': (
                                f"Cet établissement possède déjà un directeur actif : "
                                f"{current_director.first_name} {current_director.last_name} ({current_director.email}). "
                                f"La validation de cette demande remplacera le directeur actuel."
                            ),
                            'current_director': {
                                'id': current_director.id,
                                'nom': f"{current_director.first_name} {current_director.last_name}".strip() or current_director.username,
                                'email': current_director.email,
                                'telephone': current_director.telephone,
                            }
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Révocation de l'ancien directeur avec motif obligatoire
                motif_revocation = (request.data.get('motif_revocation') or request.data.get('motif') or '').strip()
                if not motif_revocation:
                    return Response(
                        {'motif_revocation': "Veuillez obligatoirement indiquer le motif de révocation du directeur actuel."},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                old_cur_status = current_director.statut_validation
                current_director.statut_validation = 'DEACTIVATED'
                current_director.is_active = False
                current_director.is_actif = False
                current_director.token_version += 1
                current_director.motif_rejet = f"Révocation par l'administrateur : {motif_revocation}"
                current_director.save(update_fields=[
                    'statut_validation', 'is_active', 'is_actif', 'token_version', 'motif_rejet'
                ])

                UserStatusHistory.objects.create(
                    user=current_director,
                    changed_by=request.user,
                    ancien_statut=old_cur_status,
                    nouveau_statut='DEACTIVATED',
                    motif=f"Remplacement par le nouveau directeur {target.first_name} {target.last_name}. Motif : {motif_revocation}"
                )

                enregistrer_journal(
                    action='DIRECTOR_REVOKED',
                    utilisateur=request.user,
                    etablissement=target.etablissement,
                    statut='SUCCES',
                    entite_type='User',
                    entite_id=current_director.id,
                    details={'motif': motif_revocation, 'replaced_by_id': target.id},
                    request=request
                )

        old_status = target.statut_validation
        target.statut_validation = 'APPROVED'
        target.is_active = True
        target.is_actif = True
        target.validated_by = request.user
        target.validated_at = timezone.now()
        target.motif_rejet = ''
        target.save(update_fields=[
            'statut_validation', 'is_active', 'is_actif',
            'validated_by', 'validated_at', 'motif_rejet'
        ])

        # R rattachement officiel à l'établissement si directeur
        if is_director_req and target.etablissement:
            target.etablissement.directeur = target
            target.etablissement.save(update_fields=['directeur', 'updated_at'])

        action_label = "Validation de l'accès Directeur" if is_director_req else "Validation du compte professionnel"
        UserStatusHistory.objects.create(
            user=target,
            changed_by=request.user,
            ancien_statut=old_status,
            nouveau_statut='APPROVED',
            motif=action_label
        )

        action_log = 'DIRECTOR_APPROVED' if is_director_req else 'USER_APPROVED'
        enregistrer_journal(
            action=action_log,
            utilisateur=request.user,
            etablissement=target.etablissement,
            statut='SUCCES',
            entite_type='User',
            entite_id=target.id,
            details={
                'approved_user_email': target.email,
                'approved_user_role': target.role,
                'etablissement_code': target.etablissement.code if target.etablissement else '',
            },
            request=request
        )

        if is_director_req:
            email_sent, email_error = send_director_validation_email(target, actor=request.user, request=request)
            msg_success = f"La demande de directeur a été validée avec succès pour {target.first_name} {target.last_name}."
        else:
            email_sent, email_error = send_account_validation_email(target, actor=request.user, request=request)
            msg_success = "La demande a été validée avec succès. Le compte est activé et l'e-mail de confirmation a été envoyé au professionnel."

        target.refresh_from_db()

        return Response(
            {
                'status': 'APPROVED',
                'email_sent': email_sent,
                'email_error': email_error,
                'message': msg_success,
                'user': UserSerializer(target).data,
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='resend-validation-email')
    def resend_validation_email(self, request, pk=None):
        """
        Permet de renvoyer l'e-mail de confirmation de validation sans répéter la validation du compte.
        """
        target = self.get_object()
        denied = self._check_director_scope(request, target)
        if denied:
            return denied

        if target.statut_validation != 'APPROVED':
            return Response(
                {'detail': "L'e-mail de validation ne peut être envoyé que pour un compte au statut APPROVED."},
                status=status.HTTP_400_BAD_REQUEST
            )

        email_sent, email_error = send_account_validation_email(target, actor=request.user, request=request)
        target.refresh_from_db()

        if email_sent:
            return Response(
                {
                    'email_sent': True,
                    'email_error': '',
                    'message': "L'e-mail de confirmation a été envoyé avec succès au professionnel.",
                    'user': UserSerializer(target).data,
                },
                status=status.HTTP_200_OK
            )

        return Response(
            {
                'email_sent': False,
                'email_error': email_error,
                'message': f"Échec de l'envoi de l'e-mail de confirmation : {email_error}",
                'user': UserSerializer(target).data,
            },
            status=status.HTTP_502_BAD_GATEWAY
        )

    @action(detail=True, methods=['post'], url_path='reject')
    def reject(self, request, pk=None):
        """
        Refuse une demande d'inscription professionnelle avec un motif obligatoire.
        """
        target = self.get_object()
        denied = self._check_director_scope(request, target)
        if denied:
            return denied

        motif = (request.data.get('motif') or '').strip()
        if not motif:
            return Response(
                {'motif': "Veuillez obligatoirement indiquer le motif du refus."},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = target.statut_validation
        target.statut_validation = 'REJECTED'
        target.is_active = False
        target.is_actif = False
        target.validated_by = request.user
        target.validated_at = timezone.now()
        target.motif_rejet = motif
        target.token_version += 1
        target.save(update_fields=[
            'statut_validation', 'is_active', 'is_actif',
            'validated_by', 'validated_at', 'motif_rejet', 'token_version'
        ])

        UserStatusHistory.objects.create(
            user=target,
            changed_by=request.user,
            ancien_statut=old_status,
            nouveau_statut='REJECTED',
            motif=motif
        )

        is_director_req = (target.role == 'DIRECTEUR')
        if is_director_req and not request.user.is_admin_user:
            return Response(
                {'detail': "Seul un administrateur général peut refuser une demande de directeur."},
                status=status.HTTP_403_FORBIDDEN
            )

        action_log = 'DIRECTOR_REJECTED' if is_director_req else 'USER_REJECTED'
        enregistrer_journal(
            action=action_log,
            utilisateur=request.user,
            etablissement=target.etablissement,
            statut='SUCCES',
            entite_type='User',
            entite_id=target.id,
            details={
                'rejected_user_email': target.email,
                'motif': motif,
            },
            request=request
        )

        email_sent = False
        email_error = ''
        if is_director_req:
            email_sent, email_error = send_director_rejection_email(target, motif=motif, actor=request.user, request=request)

        return Response(
            {
                'status': 'REJECTED',
                'email_sent': email_sent,
                'email_error': email_error,
                'message': "La demande a été refusée avec succès.",
                'user': UserSerializer(target).data,
            },
            status=status.HTTP_200_OK
        )

    
    @action(detail=True, methods=['post'], url_path='revoke-director', permission_classes=[IsAdminUser])
    def revoke_director(self, request, pk=None):
        """
        Révoque immédiatement l'accès d'un directeur en poste par l'Administrateur Général.
        Invalide toutes les sessions et tokens JWT existants sans supprimer le compte ni l'audit.
        """
        if not request.user.is_admin_user:
            return Response(
                {'detail': "Seul un administrateur général peut révoquer un directeur."},
                status=status.HTTP_403_FORBIDDEN
            )

        target = self.get_object()
        if target.role != 'DIRECTEUR':
            return Response(
                {'detail': "Cet utilisateur n'est pas un directeur."},
                status=status.HTTP_400_BAD_REQUEST
            )

        motif = (request.data.get('motif') or '').strip()
        if not motif:
            return Response(
                {'motif': "Veuillez obligatoirement indiquer le motif de révocation du directeur."},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = target.statut_validation
        target.statut_validation = 'DEACTIVATED'
        target.is_active = False
        target.is_actif = False
        target.token_version += 1
        target.motif_rejet = f"Révocation par l'administrateur : {motif}"
        target.save(update_fields=['statut_validation', 'is_active', 'is_actif', 'token_version', 'motif_rejet'])

        if target.etablissement and target.etablissement.directeur_id == target.id:
            target.etablissement.directeur = None
            target.etablissement.save(update_fields=['directeur', 'updated_at'])

        UserStatusHistory.objects.create(
            user=target,
            changed_by=request.user,
            ancien_statut=old_status,
            nouveau_statut='DEACTIVATED',
            motif=f"Révocation du mandat de directeur. Motif : {motif}"
        )

        enregistrer_journal(
            action='DIRECTOR_REVOKED',
            utilisateur=request.user,
            etablissement=target.etablissement,
            statut='SUCCES',
            entite_type='User',
            entite_id=target.id,
            details={'motif': motif},
            request=request
        )

        return Response(
            {
                'status': 'DEACTIVATED',
                'message': f"L'accès directeur de {target.first_name} {target.last_name} a été révoqué avec succès.",
                'user': UserSerializer(target).data,
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='suspend')
    def suspend(self, request, pk=None):
        """
        Suspend un compte professionnel et invalide immédiatement ses sessions/tokens JWT.
        """
        target = self.get_object()
        denied = self._check_director_scope(request, target)
        if denied:
            return denied

        motif = (request.data.get('motif') or 'Compte suspendu par la direction / administration').strip()
        old_status = target.statut_validation

        target.statut_validation = 'SUSPENDED'
        target.is_active = False
        target.is_actif = False
        target.motif_rejet = motif
        target.token_version += 1
        target.save(update_fields=[
            'statut_validation', 'is_active', 'is_actif', 'motif_rejet', 'token_version'
        ])

        UserStatusHistory.objects.create(
            user=target,
            changed_by=request.user,
            ancien_statut=old_status,
            nouveau_statut='SUSPENDED',
            motif=motif
        )

        enregistrer_journal(
            action='USER_SUSPENDED',
            utilisateur=request.user,
            etablissement=target.etablissement,
            statut='SUCCES',
            entite_type='User',
            entite_id=target.id,
            details={
                'suspended_user_email': target.email,
                'motif': motif,
            },
            request=request
        )

        return Response(
            {
                'status': 'SUSPENDED',
                'message': "Le compte professionnel a été suspendu.",
                'user': UserSerializer(target).data,
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='deactivate')
    def deactivate(self, request, pk=None):
        """
        Désactive définitivement un compte professionnel et révoque immédiatement tous ses accès.
        """
        target = self.get_object()
        denied = self._check_director_scope(request, target)
        if denied:
            return denied

        motif = (request.data.get('motif') or "Compte désactivé par l'administration / direction").strip()
        old_status = target.statut_validation

        target.statut_validation = 'DEACTIVATED'
        target.is_active = False
        target.is_actif = False
        target.motif_rejet = motif
        target.token_version += 1
        target.save(update_fields=[
            'statut_validation', 'is_active', 'is_actif', 'motif_rejet', 'token_version'
        ])

        UserStatusHistory.objects.create(
            user=target,
            changed_by=request.user,
            ancien_statut=old_status,
            nouveau_statut='DEACTIVATED',
            motif=motif
        )

        enregistrer_journal(
            action='USER_DEACTIVATED',
            utilisateur=request.user,
            etablissement=target.etablissement,
            statut='SUCCES',
            entite_type='User',
            entite_id=target.id,
            details={
                'deactivated_user_email': target.email,
                'motif': motif,
            },
            request=request
        )

        return Response(
            {
                'status': 'DEACTIVATED',
                'message': "Le compte professionnel a été désactivé.",
                'user': UserSerializer(target).data,
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'], url_path='reactivate')
    def reactivate(self, request, pk=None):
        """
        Réactive un compte suspendu ou désactivé en le replaçant au statut APPROVED.
        """
        target = self.get_object()
        denied = self._check_director_scope(request, target)
        if denied:
            return denied

        motif = (request.data.get('motif') or "Réactivation du compte professionnel").strip()
        old_status = target.statut_validation

        target.statut_validation = 'APPROVED'
        target.is_active = True
        target.is_actif = True
        target.motif_rejet = ''
        target.validated_by = request.user
        target.validated_at = timezone.now()
        target.save(update_fields=[
            'statut_validation', 'is_active', 'is_actif',
            'motif_rejet', 'validated_by', 'validated_at'
        ])

        UserStatusHistory.objects.create(
            user=target,
            changed_by=request.user,
            ancien_statut=old_status,
            nouveau_statut='APPROVED',
            motif=motif
        )

        enregistrer_journal(
            action='USER_REACTIVATED',
            utilisateur=request.user,
            etablissement=target.etablissement,
            statut='SUCCES',
            entite_type='User',
            entite_id=target.id,
            details={'reactivated_user_email': target.email, 'motif': motif},
            request=request
        )

        return Response(
            {
                'status': 'APPROVED',
                'message': "Le compte professionnel a été réactivé.",
                'user': UserSerializer(target).data,
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['get'], url_path='status-history')
    def status_history(self, request, pk=None):
        """
        Renvoie l'historique chronologique de tous les changements de statut de ce professionnel.
        """
        target = self.get_object()
        denied = self._check_director_scope(request, target)
        if denied:
            return denied

        history_qs = target.historique_statuts.all().select_related('changed_by').order_by('-created_at')
        serializer = UserStatusHistorySerializer(history_qs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

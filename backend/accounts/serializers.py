import re
import hashlib
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User, PasswordResetToken, UserStatusHistory
from establishments.models import Etablissement
from notifications.models import Notification
from audit.models import enregistrer_journal


def validate_strong_password(password, user=None):
    """
    Vérifie la robustesse du mot de passe via les validateurs natifs de Django
    et des règles de complexité explicites.
    """
    errors = []
    if len(password or '') < 8:
        errors.append("Le mot de passe doit contenir au moins 8 caractères.")
    if not re.search(r'[A-Za-z]', password or ''):
        errors.append("Le mot de passe doit contenir au moins une lettre.")
    if not re.search(r'[0-9\W_]', password or ''):
        errors.append("Le mot de passe doit contenir au moins un chiffre ou un caractère spécial.")

    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        errors.extend(exc.messages)

    if errors:
        # Déduplication tout en préservant l'ordre
        unique_errors = list(dict.fromkeys(errors))
        raise serializers.ValidationError(unique_errors)


def _generate_unique_username(email, first_name='', last_name=''):
    """Génère un identifiant unique interne à partir de l'adresse e-mail professionnelle."""
    base = re.sub(r'[^a-zA-Z0-9._-]', '_', (email.split('@')[0] if '@' in email else email).lower()).strip('_')
    if not base:
        base = re.sub(r'[^a-zA-Z0-9]', '_', f"{first_name}_{last_name}".lower()).strip('_') or 'pro_user'
    base = base[:120]
    candidate = base
    counter = 1
    while User.objects.filter(username__iexact=candidate).exists():
        candidate = f"{base}_{counter}"
        counter += 1
    return candidate


class EtablissementSimpleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Etablissement
        fields = ['id', 'code', 'nom', 'ville', 'region', 'type_etablissement', 'is_active']


class UserSerializer(serializers.ModelSerializer):
    """
    Sérialiseur de lecture du profil utilisateur.
    N'expose JAMAIS le mot de passe ni le condensat (hash).
    """
    etablissement_details = EtablissementSimpleSerializer(source='etablissement', read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    statut_validation_display = serializers.CharField(source='get_statut_validation_display', read_only=True)
    validated_by_nom = serializers.SerializerMethodField()
    current_active_director = serializers.SerializerMethodField()
    direction_vacante = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'role_display', 'etablissement', 'etablissement_details',
            'matricule_professionnel', 'specialite', 'fonction', 'telephone', 'justificatif',
            'current_active_director', 'direction_vacante',
            'statut_validation', 'statut_validation_display', 'motif_rejet',
            'validated_by', 'validated_by_nom', 'validated_at',
            'email_validation_envoye', 'date_envoi_email_validation', 'erreur_envoi_email',
            'is_actif', 'date_joined', 'password_changed_at',
            'is_doctor', 'is_receptionist', 'is_director', 'is_admin_user'
        ]
        read_only_fields = ['id', 'date_joined', 'password_changed_at']

    def get_validated_by_nom(self, obj):
        if not obj.validated_by:
            return None
        full = f"{obj.validated_by.first_name} {obj.validated_by.last_name}".strip()
        return full or obj.validated_by.username

    def get_current_active_director(self, obj):
        if obj.role == 'DIRECTEUR' and obj.etablissement:
            cur = User.objects.filter(
                etablissement=obj.etablissement,
                role='DIRECTEUR',
                statut_validation='APPROVED',
                is_active=True,
                is_actif=True
            ).exclude(id=obj.id).first()
            if cur:
                return {
                    'id': cur.id,
                    'nom': f"{cur.first_name} {cur.last_name}".strip() or cur.username,
                    'email': cur.email,
                    'telephone': cur.telephone,
                    'fonction': getattr(cur, 'fonction', '') or getattr(cur, 'specialite', ''),
                }
        return None

    def get_direction_vacante(self, obj):
        if obj.role == 'DIRECTEUR' and obj.etablissement:
            return not User.objects.filter(
                etablissement=obj.etablissement,
                role='DIRECTEUR',
                statut_validation='APPROVED',
                is_active=True,
                is_actif=True
            ).exclude(id=obj.id).exists()
        return None




class DirectorRegistrationSerializer(serializers.ModelSerializer):
    """
    Sérialiseur d'inscription publique / demande d'accès pour les Directeurs d'établissement.
    - Vérifie la robustesse du mot de passe et l'exactitude des 2 champs de mot de passe.
    - Hachage sécurisé exclusif Django (PBKDF2).
    - Crée le compte à l'état inactif (statut PENDING) en attente d'examen par l'administrateur général.
    - Enregistre la fonction officielle et l'établissement sanitaire concerné.
    """
    first_name = serializers.CharField(required=True, allow_blank=False, max_length=150)
    last_name = serializers.CharField(required=True, allow_blank=False, max_length=150)
    email = serializers.EmailField(required=True, allow_blank=False)
    telephone = serializers.CharField(required=True, allow_blank=False, max_length=30)
    fonction = serializers.CharField(required=True, allow_blank=False, max_length=150)
    etablissement = serializers.PrimaryKeyRelatedField(
        queryset=Etablissement.objects.filter(is_active=True),
        required=True,
        allow_null=False,
        error_messages={
            'required': "Veuillez sélectionner un établissement de santé.",
            'null': "Veuillez sélectionner un établissement de santé.",
            'does_not_exist': "L'établissement sélectionné est introuvable ou inactif."
        }
    )
    justificatif = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'telephone',
            'fonction', 'etablissement', 'justificatif', 'password',
            'password_confirm', 'statut_validation'
        ]
        read_only_fields = ['id', 'statut_validation']

    def validate_email(self, value):
        email = (value or '').strip().lower()
        if not email:
            raise serializers.ValidationError("L'adresse e-mail professionnelle est obligatoire.")
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Un compte ou une demande existe déjà avec cette adresse e-mail professionnelle.")
        return email

    def validate(self, attrs):
        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')

        if password != password_confirm:
            raise serializers.ValidationError(
                {'password_confirm': "Les deux mots de passe saisis ne correspondent pas."}
            )

        tmp_user = User(
            username='tmp_director',
            email=attrs.get('email', ''),
            first_name=attrs.get('first_name', ''),
            last_name=attrs.get('last_name', '')
        )
        try:
            validate_password(password, user=tmp_user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({'password': list(exc.messages)})

        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm', None)
        password = validated_data.pop('password')
        email = validated_data['email']

        username = _generate_unique_username(
            email,
            validated_data.get('first_name', ''),
            validated_data.get('last_name', '')
        )

        user = User(
            username=username,
            role='DIRECTEUR',
            is_active=False,
            is_actif=False,
            statut_validation='PENDING',
            **validated_data
        )
        user.set_password(password)
        user.save()

        # Notification interne destinée aux administrateurs généraux
        admins = User.objects.filter(role='ADMIN', is_active=True, is_actif=True)
        titre_notif = f"Nouvelle demande d'accès Directeur : {user.first_name} {user.last_name}"
        msg_notif = (
            f"{user.first_name} {user.last_name} ({user.fonction or 'Directeur'}) a soumis une demande "
            f"d'accès Directeur pour {user.etablissement.nom} "
            f"(E-mail : {user.email}, Téléphone : {user.telephone})."
        )
        if admins.exists():
            for admin in admins:
                Notification.objects.create(
                    destinataire=admin,
                    etablissement_cible=user.etablissement,
                    type_notification='INSCRIPTION_DIRECTEUR',
                    titre=titre_notif,
                    message=msg_notif,
                    reference_objet_type='User',
                    reference_objet_id=str(user.id)
                )

        request = self.context.get('request')
        enregistrer_journal(
            action='DIRECTOR_REGISTER_REQUEST',
            utilisateur=user,
            etablissement=user.etablissement,
            statut='SUCCES',
            entite_type='User',
            entite_id=user.id,
            details={
                'email': user.email,
                'role': 'DIRECTEUR',
                'fonction': user.fonction,
                'etablissement_code': user.etablissement.code if user.etablissement else '',
            },
            request=request
        )

        return user

class ProfessionalRegistrationSerializer(serializers.ModelSerializer):
    """
    Sérialiseur d'inscription professionnelle (Médecin ou Agent d'accueil).
    - Vérifie la robustesse du mot de passe et la correspondance des 2 champs.
    - Utilise exclusivement le hachage sécurisé de Django (set_password).
    - Crée le compte à l'état inactif (PENDING) en attente de validation par le directeur.
    """
    first_name = serializers.CharField(required=True, allow_blank=False, max_length=150)
    last_name = serializers.CharField(required=True, allow_blank=False, max_length=150)
    email = serializers.EmailField(required=True, allow_blank=False)
    telephone = serializers.CharField(required=True, allow_blank=False, max_length=30)
    role = serializers.CharField(required=True)
    etablissement = serializers.PrimaryKeyRelatedField(
        queryset=Etablissement.objects.filter(is_active=True),
        required=True,
        allow_null=False,
        error_messages={
            'required': "Veuillez sélectionner un établissement de santé.",
            'null': "Veuillez sélectionner un établissement de santé.",
            'does_not_exist': "L'établissement sélectionné est introuvable ou inactif."
        }
    )
    matricule_professionnel = serializers.CharField(required=False, allow_blank=True, max_length=50)
    specialite = serializers.CharField(required=False, allow_blank=True, max_length=100)
    justificatif = serializers.CharField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    password_confirm = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = [
            'id', 'first_name', 'last_name', 'email', 'telephone',
            'role', 'etablissement', 'matricule_professionnel',
            'specialite', 'justificatif', 'password', 'password_confirm',
            'statut_validation'
        ]
        read_only_fields = ['id', 'statut_validation']

    def validate_email(self, value):
        email = (value or '').strip().lower()
        if not email:
            raise serializers.ValidationError("L'adresse e-mail professionnelle est obligatoire.")
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Un compte ou une demande existe déjà avec cette adresse e-mail professionnelle.")
        return email

    def validate_role(self, value):
        allowed_roles = ('MEDECIN', 'AGENT')
        if value not in allowed_roles:
            raise serializers.ValidationError(
                "Fonction invalide. Seuls un médecin (MEDECIN) ou un agent d'accueil (AGENT) peuvent s'inscrire via ce formulaire."
            )
        return value

    def validate(self, attrs):
        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')

        if password != password_confirm:
            raise serializers.ValidationError({
                'password_confirm': "Les deux champs de mot de passe ne correspondent pas."
            })

        temp_user = User(
            username=attrs.get('email', ''),
            email=attrs.get('email', ''),
            first_name=attrs.get('first_name', ''),
            last_name=attrs.get('last_name', '')
        )
        try:
            validate_strong_password(password, user=temp_user)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({'password': exc.detail})

        return attrs

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data.pop('password_confirm', None)
        email = validated_data['email']
        username = _generate_unique_username(
            email,
            validated_data.get('first_name', ''),
            validated_data.get('last_name', '')
        )

        user = User(
            username=username,
            is_active=False,
            is_actif=False,
            statut_validation='PENDING',
            **validated_data
        )
        # Hachage sécurisé exclusif Django (PBKDF2)
        user.set_password(password)
        user.save()

        # Notification interne destinée au(x) directeur(s) de l'établissement sélectionné (sans mot de passe)
        directeurs = User.objects.filter(
            etablissement=user.etablissement,
            role='DIRECTEUR',
            is_active=True,
            is_actif=True
        )
        titre_notif = f"Nouvelle demande d'inscription : {user.first_name} {user.last_name}"
        msg_notif = (
            f"{user.first_name} {user.last_name} ({user.get_role_display()}) a soumis une demande "
            f"d'inscription professionnelle pour {user.etablissement.nom} "
            f"(E-mail : {user.email}, Matricule : {user.matricule_professionnel or 'Non spécifié'})."
        )
        if directeurs.exists():
            for directeur in directeurs:
                Notification.objects.create(
                    destinataire=directeur,
                    etablissement_cible=user.etablissement,
                    type_notification='INSCRIPTION_PROFESSIONNELLE',
                    titre=titre_notif,
                    message=msg_notif,
                    reference_objet_type='User',
                    reference_objet_id=str(user.id)
                )
        else:
            Notification.objects.create(
                destinataire=None,
                etablissement_cible=user.etablissement,
                type_notification='INSCRIPTION_PROFESSIONNELLE',
                titre=titre_notif,
                message=msg_notif,
                reference_objet_type='User',
                reference_objet_id=str(user.id)
            )

        # Journal d'audit sans aucun mot de passe
        request = self.context.get('request')
        enregistrer_journal(
            action='REGISTER_REQUEST',
            utilisateur=user,
            etablissement=user.etablissement,
            statut='SUCCES',
            entite_type='User',
            entite_id=user.id,
            details={
                'email': user.email,
                'role': user.role,
                'etablissement_code': user.etablissement.code if user.etablissement else '',
                'matricule_professionnel': user.matricule_professionnel,
            },
            request=request
        )

        return user


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Authentification JWT par adresse e-mail professionnelle et mot de passe
    (compatible également avec username pour les scénarios de tests existants).
    Vérifie :
    1. Que le compte existe.
    2. Que le mot de passe est correct.
    3. Que le compte est validé (statut APPROVED).
    4. Que le compte n'est pas suspendu (ni désactivé).
    5. Que l'établissement et le rattachement du compte sont toujours autorisés.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field].required = False
        self.fields['email'] = serializers.CharField(required=False, write_only=True)

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['token_version'] = user.token_version
        token['role'] = user.role
        token['email'] = user.email
        return token

    def validate(self, attrs):
        identifier = (attrs.get('email') or attrs.get(self.username_field) or '').strip()
        password = attrs.get('password') or ''

        if not identifier or not password:
            raise serializers.ValidationError(
                "Veuillez renseigner votre adresse e-mail professionnelle et votre mot de passe."
            )

        # 1. Recherche du compte par e-mail (prioritaire) ou nom d'utilisateur
        user = User.objects.select_related('etablissement').filter(email__iexact=identifier).first()
        if not user:
            user = User.objects.select_related('etablissement').filter(username__iexact=identifier).first()

        request = self.context.get('request')

        # 1 & 2. Vérifier que le compte existe et que le mot de passe est correct
        if not user or not user.check_password(password):
            enregistrer_journal(
                action='LOGIN_FAILED',
                utilisateur=user,
                etablissement=user.etablissement if user else None,
                statut='ECHEC',
                details={'identifier': identifier, 'motif': 'Identifiants invalides'},
                request=request
            )
            raise AuthenticationFailed(
                "Identifiants incorrects. Vérifiez votre adresse e-mail et votre mot de passe."
            )

        # 3. Vérifier que le compte est validé (APPROVED)
        if user.statut_validation == 'PENDING':
            enregistrer_journal(
                action='LOGIN_FAILED',
                utilisateur=user,
                etablissement=user.etablissement,
                statut='REFUSE',
                details={'identifier': identifier, 'motif': 'Compte en attente de validation'},
                request=request
            )
            if user.role == 'DIRECTEUR':
                raise AuthenticationFailed(
                    "Votre demande d'accès en tant que directeur est en attente de validation par l'administrateur général."
                )
            raise AuthenticationFailed(
                "Votre compte est en attente de validation par le directeur de votre établissement."
            )

        if user.statut_validation == 'REJECTED':
            enregistrer_journal(
                action='LOGIN_FAILED',
                utilisateur=user,
                etablissement=user.etablissement,
                statut='REFUSE',
                details={'identifier': identifier, 'motif': 'Demande refusée'},
                request=request
            )
            raise AuthenticationFailed(
                "Votre demande d'inscription a été refusée par le directeur de l'établissement."
            )

        # 4. Vérifier que le compte n'est pas suspendu / désactivé
        if user.statut_validation == 'SUSPENDED' or not user.is_active or not user.is_actif:
            enregistrer_journal(
                action='LOGIN_FAILED',
                utilisateur=user,
                etablissement=user.etablissement,
                statut='REFUSE',
                details={'identifier': identifier, 'motif': 'Compte suspendu ou inactif'},
                request=request
            )
            raise AuthenticationFailed(
                "Votre compte a été suspendu ou désactivé. L'accès à l'application est refusé."
            )

        if user.statut_validation != 'APPROVED':
            enregistrer_journal(
                action='LOGIN_FAILED',
                utilisateur=user,
                etablissement=user.etablissement,
                statut='REFUSE',
                details={'identifier': identifier, 'motif': 'Statut non approuvé'},
                request=request
            )
            raise AuthenticationFailed("Votre compte n'est pas autorisé à se connecter.")

        # 5. Vérifier que l'établissement et le rattachement du compte sont toujours autorisés
        if not user.is_admin_user:
            if not user.etablissement or not user.etablissement.is_active:
                enregistrer_journal(
                    action='LOGIN_FAILED',
                    utilisateur=user,
                    etablissement=user.etablissement,
                    statut='REFUSE',
                    details={'identifier': identifier, 'motif': 'Établissement non autorisé ou inactif'},
                    request=request
                )
                raise AuthenticationFailed(
                    "L'établissement de rattachement de votre compte n'est pas autorisé ou est désactivé."
                )

        self.user = user
        refresh = self.get_token(user)

        # Journaliser la connexion réussie (sans mot de passe)
        enregistrer_journal(
            action='LOGIN',
            utilisateur=user,
            etablissement=user.etablissement,
            statut='SUCCES',
            details={'username': user.username, 'email': user.email, 'role': user.role},
            request=request
        )

        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'role_display': user.get_role_display(),
                'statut_validation': user.statut_validation,
                'etablissement': EtablissementSimpleSerializer(user.etablissement).data if user.etablissement else None,
                'specialite': user.specialite,
                'matricule_professionnel': user.matricule_professionnel,
                'telephone': user.telephone,
                'is_doctor': user.is_doctor,
                'is_receptionist': user.is_receptionist,
                'is_director': user.is_director,
                'is_admin': user.is_admin_user,
            }
        }


class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    """
    Vérifie lors du rafraîchissement d'un token JWT que :
    - Le compte est toujours actif et validé (APPROVED).
    - Le token_version n'a pas été révoqué (ex: suite à un changement de mot de passe).
    """

    def validate(self, attrs):
        refresh = self.token_class(attrs["refresh"])
        user_id = refresh.payload.get("user_id")
        token_version = refresh.payload.get("token_version", 0)

        user = User.objects.select_related('etablissement').filter(id=user_id).first()
        if not user or not user.is_active or not user.is_actif or user.statut_validation != 'APPROVED':
            raise AuthenticationFailed("Ce compte n'est plus actif ou autorisé.", code="user_inactive")

        if not user.is_admin_user and (not user.etablissement or not user.etablissement.is_active):
            raise AuthenticationFailed("Établissement non autorisé.", code="establishment_inactive")

        if token_version != user.token_version:
            raise AuthenticationFailed(
                "Session expirée suite à une modification du mot de passe. Veuillez vous reconnecter.",
                code="token_revoked"
            )

        data = super().validate(attrs)
        return data


class ChangePasswordSerializer(serializers.Serializer):
    """
    Sérialiseur pour la modification du mot de passe après connexion (« Sécurité et mot de passe »).
    """
    current_password = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True)
    new_password_confirm = serializers.CharField(write_only=True, required=True)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Le mot de passe actuel est incorrect.")
        return value

    def validate(self, attrs):
        user = self.context['request'].user
        current_password = attrs.get('current_password')
        new_password = attrs.get('new_password')
        new_password_confirm = attrs.get('new_password_confirm')

        if new_password != new_password_confirm:
            raise serializers.ValidationError({
                'new_password_confirm': "La confirmation du nouveau mot de passe ne correspond pas."
            })

        if current_password and new_password == current_password:
            raise serializers.ValidationError({
                'new_password': "Le nouveau mot de passe doit être différent de votre mot de passe actuel."
            })

        try:
            validate_strong_password(new_password, user=user)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({'new_password': exc.detail})

        return attrs


class PasswordResetRequestSerializer(serializers.Serializer):
    """Demande de lien de réinitialisation de mot de passe."""
    email = serializers.EmailField(required=True)


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Confirmation de réinitialisation du mot de passe avec jeton temporaire à usage unique."""
    token = serializers.CharField(write_only=True, required=True)
    new_password = serializers.CharField(write_only=True, required=True)
    new_password_confirm = serializers.CharField(write_only=True, required=True)

    def validate(self, attrs):
        raw_token = (attrs.get('token') or '').strip()
        new_password = attrs.get('new_password')
        new_password_confirm = attrs.get('new_password_confirm')

        if new_password != new_password_confirm:
            raise serializers.ValidationError({
                'new_password_confirm': "Les deux champs de mot de passe ne correspondent pas."
            })

        token_hash = hashlib.sha256(raw_token.encode('utf-8')).hexdigest()
        reset_record = PasswordResetToken.objects.select_related('user').filter(token_hash=token_hash).first()

        if not reset_record or not reset_record.is_valid():
            raise serializers.ValidationError({
                'token': "Ce lien de réinitialisation est invalide, a déjà été utilisé ou a expiré."
            })

        user = reset_record.user
        try:
            validate_strong_password(new_password, user=user)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({'new_password': exc.detail})

        attrs['reset_record'] = reset_record
        attrs['user'] = user
        return attrs


class UserAdminManageSerializer(serializers.ModelSerializer):
    """Sérialiseur pour la création et mise à jour des comptes par l'administrateur."""
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'password', 'email', 'first_name', 'last_name',
            'role', 'etablissement', 'matricule_professionnel', 'specialite',
            'telephone', 'justificatif', 'statut_validation', 'motif_rejet', 'is_actif'
        ]

    def validate_email(self, value):
        email = (value or '').strip().lower()
        if email:
            qs = User.objects.filter(email__iexact=email)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError("Cette adresse e-mail est déjà utilisée par un autre compte.")
        return email

    def validate_password(self, value):
        if value:
            validate_strong_password(value, user=self.instance)
        return value

    def create(self, validated_data):
        password = validated_data.pop('password', 'Password123!')
        is_actif = validated_data.get('is_actif', True)
        statut_validation = validated_data.pop('statut_validation', 'APPROVED' if is_actif else 'SUSPENDED')
        if not validated_data.get('username') and validated_data.get('email'):
            validated_data['username'] = _generate_unique_username(
                validated_data['email'],
                validated_data.get('first_name', ''),
                validated_data.get('last_name', '')
            )
        user = User(
            is_active=is_actif and (statut_validation == 'APPROVED'),
            statut_validation=statut_validation,
            **validated_data
        )
        user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        is_actif_changed = 'is_actif' in validated_data and validated_data['is_actif'] != instance.is_actif
        statut_changed = 'statut_validation' in validated_data and validated_data['statut_validation'] != instance.statut_validation

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if is_actif_changed and not statut_changed:
            if not instance.is_actif:
                instance.is_active = False
                instance.statut_validation = 'SUSPENDED'
                instance.token_version += 1
            else:
                instance.is_active = True
                instance.statut_validation = 'APPROVED'
        elif statut_changed:
            if instance.statut_validation == 'APPROVED':
                instance.is_active = True
                instance.is_actif = True
            else:
                instance.is_active = False
                instance.is_actif = False
                instance.token_version += 1

        if password:
            instance.set_password(password)
            instance.token_version += 1
            instance.password_changed_at = timezone.now()

        instance.save()
        return instance


class UserStatusHistorySerializer(serializers.ModelSerializer):
    changed_by_nom = serializers.SerializerMethodField()

    class Meta:
        model = UserStatusHistory
        fields = [
            'id', 'user', 'ancien_statut', 'nouveau_statut',
            'motif', 'created_at', 'changed_by', 'changed_by_nom'
        ]

    def get_changed_by_nom(self, obj):
        if not obj.changed_by:
            return "Système"
        return f"{obj.changed_by.first_name} {obj.changed_by.last_name}".strip() or obj.changed_by.username


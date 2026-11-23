from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed


class CustomJWTAuthentication(JWTAuthentication):
    """
    Authentification JWT renforcée pour MEDTRANSFER :
    - Vérifie que le compte est actif et au statut APPROVED.
    - Vérifie que le compte n'est ni en attente, ni refusé, ni suspendu.
    - Vérifie que l'établissement de rattachement est toujours actif/autorisé.
    - Vérifie que la version du jeton (token_version) correspond à celle de l'utilisateur
      afin d'invalider immédiatement les anciens tokens après un changement de mot de passe
      ou une suspension de compte.
    """

    def get_user(self, validated_token):
        user = super().get_user(validated_token)

        if not user.is_active or not user.is_actif or user.statut_validation != 'APPROVED':
            raise AuthenticationFailed(
                "Ce compte n'est pas actif ou n'a pas été validé (en attente, refusé ou suspendu).",
                code="user_inactive"
            )

        if not user.is_admin_user:
            if not user.etablissement or not user.etablissement.is_active:
                raise AuthenticationFailed(
                    "L'établissement de rattachement de ce compte n'est pas autorisé ou est désactivé.",
                    code="establishment_unauthorized"
                )

        token_version = validated_token.get('token_version', 0)
        if token_version != user.token_version:
            raise AuthenticationFailed(
                "Votre session a été invalidée suite à une modification de votre mot de passe ou de vos droits.",
                code="token_revoked"
            )

        return user

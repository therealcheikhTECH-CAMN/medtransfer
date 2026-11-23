import os
import re
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

User = get_user_model()


class Command(BaseCommand):
    help = (
        "Crée de manière sécurisée et idempotente le compte Administrateur Général initial "
        "à partir des variables d'environnement réservées BOOTSTRAP_ADMIN_EMAIL et BOOTSTRAP_ADMIN_PASSWORD."
    )

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Vérification des variables d'initialisation de l'administrateur..."))

        admin_email = os.getenv('BOOTSTRAP_ADMIN_EMAIL', '').strip()
        admin_password = os.getenv('BOOTSTRAP_ADMIN_PASSWORD', '').strip()

        # 1. Vérification de la présence des variables obligatoires
        if not admin_email or not admin_password:
            self.stdout.write(
                self.style.WARNING(
                    "INITIALISATION SUSPENDUE : Les variables d'environnement BOOTSTRAP_ADMIN_EMAIL "
                    "et/ou BOOTSTRAP_ADMIN_PASSWORD ne sont pas définies.\n"
                    "Cette commande ne crée aucun compte tant que vous n'avez pas expressément renseigné ces valeurs."
                )
            )
            return

        # 2. Validation du format de l'adresse e-mail
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, admin_email):
            raise CommandError(f"Le format de l'adresse e-mail BOOTSTRAP_ADMIN_EMAIL ({admin_email}) est invalide.")

        # 3. Vérification de la robustesse du mot de passe
        try:
            validate_password(admin_password)
        except ValidationError as e:
            raise CommandError(f"Le mot de passe fourni ne respecte pas les critères de sécurité Django : {', '.join(e.messages)}")

        # 4. Vérification d'existence préalable (anti-écrasement / idempotence)
        existing_user = User.objects.filter(email__iexact=admin_email).first()
        if existing_user:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Un compte avec l'adresse e-mail « {admin_email} » existe déjà (ID: {existing_user.id}, Rôle: {existing_user.role}). "
                    "Aucun compte n'a été écrasé."
                )
            )
            return

        username = admin_email.split('@')[0].lower()
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}_{counter}"
            counter += 1

        # 5. Création du compte administrateur avec rôle métier ADMIN et privilèges Django
        admin_user = User(
            username=username,
            email=admin_email,
            first_name="Administrateur",
            last_name="Général",
            role="ADMIN",
            statut_validation="APPROVED",
            is_staff=True,
            is_superuser=True,
            is_active=True,
            is_actif=True,
        )
        admin_user.set_password(admin_password)
        admin_user.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Compte Administrateur Général créé avec succès !\n"
                f"- E-mail : {admin_email}\n"
                f"- Identifiant (username) : {username}\n"
                f"- Rôle métier : ADMIN\n"
                f"- Droits système : superuser & staff\n"
                f"Le mot de passe a été haché de manière sécurisée et n'est jamais consigné en clair."
            )
        )

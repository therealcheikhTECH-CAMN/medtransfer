from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone


class User(AbstractUser):
    """
    Modèle utilisateur personnalisé avec gestion des 4 rôles métier de MEDTRANSFER :
    - Administrateur du site (ADMIN)
    - Directeur d'établissement (DIRECTEUR)
    - Agent d'accueil (AGENT)
    - Médecin (MEDECIN)
    """
    ROLE_CHOICES = [
        ('ADMIN', 'Administrateur'),
        ('DIRECTEUR', 'Directeur d\'établissement'),
        ('AGENT', 'Agent d\'accueil'),
        ('MEDECIN', 'Médecin'),
    ]

    STATUT_VALIDATION_CHOICES = [
        ('PENDING', 'En attente de validation'),
        ('APPROVED', 'Validé'),
        ('REJECTED', 'Refusé'),
        ('SUSPENDED', 'Suspendu'),
        ('DEACTIVATED', 'Désactivé'),
    ]

    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='MEDECIN')
    etablissement = models.ForeignKey(
        'establishments.Etablissement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='utilisateurs',
        help_text="Établissement d'affectation de l'utilisateur"
    )
    matricule_professionnel = models.CharField(max_length=50, blank=True, help_text="Numéro d'ordre ou matricule")
    specialite = models.CharField(max_length=100, blank=True, help_text="Ex: Médecine générale, Cardiologie, Urgentiste")
    fonction = models.CharField(max_length=150, blank=True, help_text="Fonction ou titre officiel au sein de l'établissement")
    telephone = models.CharField(max_length=30, blank=True)
    justificatif = models.TextField(blank=True, help_text="Références ou éléments justificatifs professionnels")

    # Cycle de validation et d'activation par le directeur
    statut_validation = models.CharField(
        max_length=20,
        choices=STATUT_VALIDATION_CHOICES,
        default='APPROVED',
        db_index=True,
        help_text="Statut de validation du compte professionnel"
    )
    motif_rejet = models.TextField(blank=True, help_text="Motif du refus ou de la suspension")
    validated_by = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='comptes_valides',
        help_text="Directeur ou administrateur ayant statué sur la demande"
    )
    validated_at = models.DateTimeField(null=True, blank=True)

    # Suivi de l'envoi de l'e-mail de confirmation après validation
    email_validation_envoye = models.BooleanField(default=False)
    date_envoi_email_validation = models.DateTimeField(null=True, blank=True)
    erreur_envoi_email = models.TextField(blank=True)

    # Sécurité des sessions / révocation des tokens JWT lors du changement de mot de passe
    token_version = models.PositiveIntegerField(default=0)
    password_changed_at = models.DateTimeField(null=True, blank=True)

    is_actif = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Utilisateur"
        verbose_name_plural = "Utilisateurs"
        ordering = ['last_name', 'first_name']
        constraints = [
            models.UniqueConstraint(
                fields=['email'],
                condition=~models.Q(email=''),
                name='unique_non_empty_user_email'
            )
        ]

    def __str__(self):
        nom_complet = f"{self.first_name} {self.last_name}".strip() or self.username
        role_label = self.get_role_display()
        etab_str = f" @ {self.etablissement.code}" if self.etablissement else ""
        return f"{nom_complet} ({role_label}{etab_str})"

    @property
    def is_doctor(self):
        return self.role == 'MEDECIN'

    @property
    def is_receptionist(self):
        return self.role == 'AGENT'

    @property
    def is_director(self):
        return self.role == 'DIRECTEUR'

    @property
    def is_admin_user(self):
        return self.role == 'ADMIN' or self.is_superuser

    @property
    def is_approved(self):
        return self.statut_validation == 'APPROVED' and self.is_active and self.is_actif


class PasswordResetToken(models.Model):
    """
    Jeton de réinitialisation de mot de passe sécurisé, temporaire et à usage unique.
    Seul le condensat SHA-256 (token_hash) est stocké en base de données.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens'
    )
    token_hash = models.CharField(max_length=128, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Jeton de réinitialisation de mot de passe"
        verbose_name_plural = "Jetons de réinitialisation de mot de passe"
        ordering = ['-created_at']

    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at

    def mark_used(self):
        self.is_used = True
        self.used_at = timezone.now()
        self.save(update_fields=['is_used', 'used_at'])


class UserStatusHistory(models.Model):
    """
    Historique immuable de tous les changements de statut des professionnels de santé.
    """
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='historique_statuts'
    )
    changed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='statuts_modifies'
    )
    ancien_statut = models.CharField(max_length=20)
    nouveau_statut = models.CharField(max_length=20)
    motif = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Historique de statut utilisateur"
        verbose_name_plural = "Historiques de statuts utilisateurs"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} : {self.ancien_statut} -> {self.nouveau_statut} ({self.created_at.strftime('%d/%m/%Y %H:%M')})"


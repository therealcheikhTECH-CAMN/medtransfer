from django.db import models
from django.conf import settings


class Notification(models.Model):
    """
    Système de notifications internes de MEDTRANSFER.
    Informe les médecins et personnels soignants d'évènements critiques
    (interventions d'urgence sur un patient suivi, demandes de transfert...).
    """
    TYPE_CHOICES = [
        ('URGENCE_EXTERNE', 'Intervention d\'urgence externe'),
        ('TRANSFERT_DEMANDE', 'Demande de transfert reçue'),
        ('TRANSFERT_ACCEPTE', 'Transfert accepté'),
        ('TRANSFERT_REFUSE', 'Transfert refusé'),
        ('NOUVELLE_PRISE_EN_CHARGE', 'Nouvelle prise en charge'),
        ('ALERTE_SECURITE', 'Alerte de sécurité ou audit'),
        ('INSCRIPTION_PROFESSIONNELLE', 'Demande d\'inscription professionnelle'),
        ('COMPTE_VALIDE', 'Validation de compte professionnel'),
    ]

    destinataire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True,
        blank=True,
        help_text="Utilisateur destinataire spécifique"
    )
    etablissement_cible = models.ForeignKey(
        'establishments.Etablissement',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='notifications_service',
        help_text="Tous les médecins de cet établissement sont concernés si destinataire est vide"
    )
    type_notification = models.CharField(max_length=40, choices=TYPE_CHOICES)
    titre = models.CharField(max_length=255)
    message = models.TextField()

    # Références optionnelles vers l'objet concerné
    reference_objet_type = models.CharField(max_length=50, blank=True, help_text="Ex: Transfert, InterventionUrgence, Patient")
    reference_objet_id = models.CharField(max_length=50, blank=True)

    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"
        ordering = ['-created_at']

    def __str__(self):
        lu = "Lu" if self.is_read else "Non lu"
        return f"[{self.get_type_notification_display()}] {self.titre} ({lu})"

    def marquer_comme_lu(self):
        self.is_read = True
        self.save(update_fields=['is_read'])

from datetime import timedelta
from django.db import models
from django.conf import settings
from django.utils import timezone


class AutorisationUrgence(models.Model):
    """
    Autorisation exceptionnelle et temporaire d'accès d'urgence (« Break-Glass »)
    au dossier médical d'un patient qui n'est pas sous la prise en charge ordinaire
    du médecin demandeur.

    RÈGLES MÉTIER ET DE SÉCURITÉ :
    - Distincte de l'acte clinique `InterventionUrgence`.
    - Strictement limitée à un couple (patient, médecin, établissement).
    - Limitée dans le temps (`date_expiration`) et révocable à tout moment (`REVOQUEE`).
    - Permet de distinguer un accès en lecture seule (`LECTURE_SEULE`) d'un accès
      autorisant les actes cliniques d'urgence (`INTERVENTION_CLINIQUE`).
    - À expiration ou révocation, tout accès au dossier et toute opération clinique
      sont immédiatement refusés.
    """
    NIVEAU_CHOICES = [
        ('LECTURE_SEULE', 'Consultation d\'urgence du dossier médical uniquement'),
        ('INTERVENTION_CLINIQUE', 'Consultation et intervention clinique d\'urgence'),
    ]

    STATUT_CHOICES = [
        ('ACTIVE', 'Active'),
        ('EXPIREE', 'Expirée'),
        ('REVOQUEE', 'Révoquée'),
    ]

    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.PROTECT,
        related_name='autorisations_urgence'
    )
    medecin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='autorisations_urgence_accordees'
    )
    etablissement = models.ForeignKey(
        'establishments.Etablissement',
        on_delete=models.PROTECT,
        related_name='autorisations_urgence'
    )
    motif_urgence = models.TextField(
        help_text="Motif médical impérieux justifiant le déverrouillage d'urgence"
    )
    justification_acces = models.TextField(
        help_text="Justification légale et déontologique de l'accès hors prise en charge ordinaire"
    )
    niveau_acces = models.CharField(
        max_length=30,
        choices=NIVEAU_CHOICES,
        default='INTERVENTION_CLINIQUE'
    )
    statut = models.CharField(
        max_length=20,
        choices=STATUT_CHOICES,
        default='ACTIVE',
        db_index=True
    )
    date_debut = models.DateTimeField(default=timezone.now)
    date_expiration = models.DateTimeField(db_index=True)
    date_revocation = models.DateTimeField(null=True, blank=True)
    revoquee_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='autorisations_urgence_revoquees'
    )
    motif_revocation = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Autorisation exceptionnelle d'urgence"
        verbose_name_plural = "Autorisations exceptionnelles d'urgence"
        ordering = ['-date_debut']

    def save(self, *args, **kwargs):
        if not self.date_debut:
            self.date_debut = timezone.now()
        if not self.date_expiration:
            default_minutes = getattr(settings, 'EMERGENCY_ACCESS_DURATION_MINUTES', 120)
            self.date_expiration = self.date_debut + timedelta(minutes=default_minutes)
        super().save(*args, **kwargs)

    @property
    def est_valide(self):
        return bool(self.statut == 'ACTIVE' and timezone.now() < self.date_expiration)

    @property
    def autorise_modification_clinique(self):
        return self.est_valide and self.niveau_acces == 'INTERVENTION_CLINIQUE'

    def verifier_expiration(self, request=None):
        if self.statut == 'ACTIVE' and timezone.now() >= self.date_expiration:
            self.statut = 'EXPIREE'
            self.save(update_fields=['statut'])
            from audit.models import enregistrer_journal
            enregistrer_journal(
                action='EMERGENCY_ACCESS_EXPIRED',
                utilisateur=self.medecin,
                etablissement=self.etablissement,
                statut='SUCCES',
                entite_type='AutorisationUrgence',
                entite_id=self.id,
                details={
                    'patient_id': self.patient_id,
                    'date_expiration': self.date_expiration.isoformat(),
                },
                request=request
            )
            return True
        return False

    def revoquer(self, utilisateur=None, motif="Fin de l'intervention d'urgence"):
        self.statut = 'REVOQUEE'
        self.date_revocation = timezone.now()
        self.revoquee_par = utilisateur
        self.motif_revocation = motif or "Fin de l'intervention d'urgence"
        self.save(update_fields=['statut', 'date_revocation', 'revoquee_par', 'motif_revocation'])

    def __str__(self):
        return f"Autorisation Urgence #{self.id} ({self.statut}) - Patient #{self.patient_id} par Dr {self.medecin.last_name}"


class InterventionUrgence(models.Model):
    """
    Intervention médicale d'urgence réalisée dans un établissement tiers,
    alors que le patient possède éventuellement une prise en charge active ailleurs.
    
    RÈGLES MÉTIER CAPITALES :
    - N'attend JAMAIS la clôture de la prise en charge d'origine.
    - Ne transfère PAS automatiquement la responsabilité médicale de suivi.
    - N'ouvre PAS automatiquement une prise en charge ordinaire dans l'établissement d'urgence.
    - Ne crée JAMAIS de second dossier médical.
    - N'accorde JAMAIS à elle seule un accès permanent au dossier médical : l'accès dépend
      exclusivement d'une `AutorisationUrgence` valide et non expirée (ou d'une `PriseEnCharge` active).
    - Trace rigoureusement la justification et notifie l'équipe de référence.
    """
    autorisation_urgence = models.ForeignKey(
        AutorisationUrgence,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='interventions',
        help_text="Autorisation exceptionnelle temporaire sous laquelle cet acte d'urgence a été réalisé"
    )
    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.PROTECT,
        related_name='interventions_urgence'
    )
    etablissement = models.ForeignKey(
        'establishments.Etablissement',
        on_delete=models.PROTECT,
        related_name='interventions_urgence_realisees'
    )
    medecin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='interventions_urgence_effectuees'
    )
    consultation = models.OneToOneField(
        'consultations.Consultation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='intervention_urgence_associee',
        help_text="Consultation clinique enregistrée pendant l'urgence"
    )
    motif_urgence = models.TextField(
        help_text="Motif clinique d'admission en urgence (ex: polytraumatisme, détresse respiratoire)"
    )
    justification_acces_derogatoire = models.TextField(
        help_text="Justification légale et déontologique de la consultation du dossier d'un patient suivi ailleurs"
    )
    date_intervention = models.DateTimeField(default=timezone.now)
    notification_envoyee = models.BooleanField(
        default=False,
        help_text="Indique si la notification a été émise à l'établissement de suivi habituel"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Intervention d'urgence"
        verbose_name_plural = "Interventions d'urgence"
        ordering = ['-date_intervention']

    def __str__(self):
        return f"Urgence du {self.date_intervention.strftime('%d/%m/%Y %H:%M')} : {self.patient.nom} @ {self.etablissement.code} par Dr {self.medecin.last_name}"

from django.db import models
from django.conf import settings
from django.utils import timezone


class Consultation(models.Model):
    """
    Acte médical enregistré dans le dossier du patient.
    RÈGLE MÉTIER :
    - L'historique des consultations est strictement cumulatif.
    - Une consultation existante n'est jamais écrasée silencieusement.
    - Toute modification donne lieu à une révision traçable et attribuable.
    """
    dossier = models.ForeignKey(
        'medical_records.DossierMedical',
        on_delete=models.PROTECT,
        related_name='consultations'
    )
    etablissement = models.ForeignKey(
        'establishments.Etablissement',
        on_delete=models.PROTECT,
        related_name='consultations_effectuees'
    )
    medecin = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='consultations_effectuees'
    )
    date_consultation = models.DateTimeField(default=timezone.now, db_index=True)

    motif = models.TextField(help_text="Motif de la venue du patient")
    constantes = models.JSONField(
        default=dict,
        blank=True,
        help_text="Tension artérielle, Pouls, Température (°C), Saturation O2 (%), Poids (kg), Glycémie"
    )
    observations_cliniques = models.TextField(help_text="Examen clinique et constatations du médecin")
    diagnostic = models.TextField(blank=True, help_text="Hypothèse ou diagnostic posé par le médecin")
    prescription = models.TextField(blank=True, help_text="Ordonnance, posologies et durée du traitement")
    conclusions_recommandations = models.TextField(blank=True, help_text="Conduite à tenir, conseils au patient")
    examens_demandes = models.TextField(blank=True, help_text="Bilan biologique ou imagerie prescrits")

    is_emergency = models.BooleanField(
        default=False,
        help_text="Indique si la consultation a été réalisée dans un contexte d'urgence"
    )
    is_amended = models.BooleanField(
        default=False,
        help_text="Indique si la consultation a fait l'objet d'une rectification a posteriori"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Consultation"
        verbose_name_plural = "Consultations"
        ordering = ['-date_consultation']

    def __str__(self):
        return f"Consultation du {self.date_consultation.strftime('%d/%m/%Y %H:%M')} - Dr {self.medecin.last_name} ({self.etablissement.code})"


class ConsultationRevision(models.Model):
    """
    Historique des rectifications apportées à une consultation.
    Garantit l'intégrité médicolégale de la trace médicale.
    """
    consultation = models.ForeignKey(
        Consultation,
        on_delete=models.CASCADE,
        related_name='revisions'
    )
    auteur_modification = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    date_modification = models.DateTimeField(auto_now_add=True)
    motif_modification = models.TextField(help_text="Justification médicolégale de la modification")
    anciennes_valeurs = models.JSONField(help_text="Copie intégrale des champs avant modification")

    class Meta:
        verbose_name = "Révision de consultation"
        verbose_name_plural = "Révisions de consultation"
        ordering = ['-date_modification']

    def __str__(self):
        return f"Révision Consultation #{self.consultation_id} par Dr {self.auteur_modification.last_name} le {self.date_modification.strftime('%d/%m/%Y')}"

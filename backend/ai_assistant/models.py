from django.db import models
from django.conf import settings
from django.utils import timezone


class SyntheseIA(models.Model):
    """
    Proposition de synthèse médicale générée par l'assistant IA.
    
    RÈGLES DE SÉCURITÉ :
    - L'IA ne pose aucun diagnostic autonome.
    - L'IA ne prescrit aucun traitement.
    - L'IA n'a aucun accès direct à PostgreSQL ni à l'API frontend.
    - La synthèse reste une simple proposition jusqu'à validation médicale formelle.
    """
    STATUT_CHOICES = [
        ('EN_ATTENTE', 'Proposition en attente d\'évaluation médicale'),
        ('VALIDEE', 'Validée par le médecin (intégrée aux conclusions)'),
        ('REJETEE', 'Rejetée par le médecin'),
    ]

    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.PROTECT,
        related_name='syntheses_ia'
    )
    consultation = models.ForeignKey(
        'consultations.Consultation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='syntheses_ia'
    )
    medecin_demandeur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='syntheses_demandees'
    )

    motif_consultation_soumis = models.TextField(
        help_text="Motif clinique actuel soumis par le médecin pour contextualiser l'analyse"
    )
    donnees_transmises = models.JSONField(
        default=dict,
        help_text="Sélection contrôlée des antécédents, allergies et consultations transmises"
    )

    # Contenu structuré généré
    resume_antecedents = models.TextField(blank=True)
    historique_pertinent = models.TextField(blank=True)
    traitements_connus = models.TextField(blank=True)
    allergies_connues = models.TextField(blank=True)
    elements_a_verifier = models.TextField(blank=True)
    informations_manquantes = models.TextField(blank=True)
    synthese_globale = models.TextField(help_text="Synthèse complète structurée")

    modele_utilise = models.CharField(max_length=100, default='gpt-4o-mini')
    is_mocked = models.BooleanField(
        default=False,
        help_text="Indique si la synthèse a été générée par le moteur local structuré (sans clé OpenAI)"
    )

    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='EN_ATTENTE')
    texte_final_valide = models.TextField(
        blank=True,
        null=True,
        help_text="Texte éventuellement amendé et validé par le praticien"
    )
    medecin_decisionnaire = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='syntheses_decidees'
    )
    date_decision = models.DateTimeField(null=True, blank=True)
    motif_decision = models.TextField(blank=True, null=True, help_text="Justification en cas de rejet ou modification")

    avertissement_legal = models.CharField(
        max_length=255,
        default="Cette synthèse a été générée par une intelligence artificielle. Elle constitue une aide à la lecture et doit être vérifiée par un professionnel de santé."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Synthèse IA"
        verbose_name_plural = "Synthèses IA"
        ordering = ['-created_at']

    def __str__(self):
        return f"Synthèse IA #{self.id} pour {self.patient.nom} ({self.statut})"

    def valider(self, medecin, texte_amende=None, motif="Synthèse validée après examen"):
        self.statut = 'VALIDEE'
        self.medecin_decisionnaire = medecin
        self.texte_final_valide = texte_amende or self.synthese_globale
        self.motif_decision = motif
        self.date_decision = timezone.now()
        self.save()

    def rejeter(self, medecin, motif="Synthèse non pertinente ou erronée"):
        self.statut = 'REJETEE'
        self.medecin_decisionnaire = medecin
        self.motif_decision = motif
        self.date_decision = timezone.now()
        self.save()

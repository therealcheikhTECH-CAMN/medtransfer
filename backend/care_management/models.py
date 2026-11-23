from django.db import models, transaction
from django.conf import settings
from django.utils import timezone
from django.core.exceptions import ValidationError


class PriseEnCharge(models.Model):
    """
    Suivi médical d'un patient par un établissement de santé.
    CONTRAINTE ABSOLUE :
    Un patient ne peut avoir qu'UNE SEULE prise en charge ordinaire active à la fois.
    Protégé par une contrainte d'intégrité partielle au niveau de PostgreSQL et de la base.
    """
    TYPE_CHOICES = [
        ('ORDINAIRE', 'Prise en charge ordinaire (Suivi de référence)'),
        ('URGENCE', 'Prise en charge d\'urgence (Ponctuelle / Exceptionnelle)'),
    ]

    STATUT_CHOICES = [
        ('ACTIF', 'Active'),
        ('CLOTURE', 'Clôturée'),
        ('TRANSFERE', 'Transférée'),
    ]

    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.PROTECT,
        related_name='prises_en_charge'
    )
    etablissement = models.ForeignKey(
        'establishments.Etablissement',
        on_delete=models.PROTECT,
        related_name='prises_en_charge'
    )
    medecin_responsable = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='prises_en_charge_suivies'
    )
    type_prise_en_charge = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        default='ORDINAIRE'
    )
    statut = models.CharField(
        max_length=20,
        choices=STATUT_CHOICES,
        default='ACTIF'
    )
    date_debut = models.DateTimeField(default=timezone.now)
    date_fin = models.DateTimeField(null=True, blank=True)
    motif_cloture = models.TextField(blank=True, null=True)
    cloture_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='prises_en_charge_cloturees',
        help_text="Médecin ou praticien ayant clôturé la prise en charge"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Prise en charge"
        verbose_name_plural = "Prises en charge"
        ordering = ['-date_debut']
        constraints = [
            # Contrainte PostgreSQL / Base de données :
            # Une seule prise en charge ORDINAIRE peut être ACTIF pour un patient donné
            models.UniqueConstraint(
                fields=['patient'],
                condition=models.Q(statut='ACTIF', type_prise_en_charge='ORDINAIRE'),
                name='unique_active_ordinary_care_per_patient'
            )
        ]

    def clean(self):
        super().clean()
        if self.statut == 'ACTIF' and self.type_prise_en_charge == 'ORDINAIRE':
            # Validation préventive applicative
            conflits = PriseEnCharge.objects.filter(
                patient=self.patient,
                statut='ACTIF',
                type_prise_en_charge='ORDINAIRE'
            ).exclude(pk=self.pk)
            if conflits.exists():
                etab_actuel = conflits.first().etablissement.nom
                raise ValidationError(
                    f"Ce patient possède déjà une prise en charge ordinaire active à l'établissement : {etab_actuel}."
                )

    def cloturer(self, motif="Fin de suivi", cloture_par=None):
        self.statut = 'CLOTURE'
        self.date_fin = timezone.now()
        self.motif_cloture = motif
        if cloture_par:
            self.cloture_par = cloture_par
        self.save(update_fields=['statut', 'date_fin', 'motif_cloture', 'cloture_par', 'updated_at'])

    def marquer_transfere(self, motif="Transféré vers un autre établissement"):
        self.statut = 'TRANSFERE'
        self.date_fin = timezone.now()
        self.motif_cloture = motif
        self.save(update_fields=['statut', 'date_fin', 'motif_cloture', 'updated_at'])

    def __str__(self):
        return f"{self.get_type_prise_en_charge_display()} ({self.statut}) - {self.patient.nom} @ {self.etablissement.code}"


class Transfert(models.Model):
    """
    Workflow de transfert inter-établissements.
    Permet de transférer la responsabilité médicale de l'établissement A vers B
    de manière sécurisée, concertée et traçable.
    """
    STATUT_CHOICES = [
        ('DEMANDE', 'Demande en attente'),
        ('ACCEPTE', 'Accepté par l\'établissement de destination'),
        ('REFUSE', 'Refusé'),
        ('ANNULE', 'Annulé par l\'émetteur'),
    ]

    PRIORITE_CHOICES = [
        ('NORMALE', 'Normale'),
        ('HAUTE', 'Haute'),
        ('URGENTE', 'Urgente'),
    ]

    patient = models.ForeignKey(
        'patients.Patient',
        on_delete=models.PROTECT,
        related_name='transferts'
    )
    prise_en_charge_origine = models.ForeignKey(
        PriseEnCharge,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transferts_associes'
    )
    etablissement_origine = models.ForeignKey(
        'establishments.Etablissement',
        on_delete=models.PROTECT,
        related_name='transferts_emis'
    )
    etablissement_destination = models.ForeignKey(
        'establishments.Etablissement',
        on_delete=models.PROTECT,
        related_name='transferts_recus'
    )
    medecin_emetteur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='transferts_demandes'
    )
    medecin_receveur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transferts_traites'
    )
    agent_receveur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='transferts_traites_agent',
        help_text="Agent d'accueil ayant statué sur la demande de transfert"
    )

    priorite = models.CharField(max_length=20, choices=PRIORITE_CHOICES, default='NORMALE')
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='DEMANDE')
    motif_transfert = models.TextField(help_text="Raison médicale motivant le transfert")
    resume_clinique = models.TextField(help_text="Synthèse clinique pour l'équipe réceptrice")

    date_demande = models.DateTimeField(auto_now_add=True)
    date_reponse = models.DateTimeField(null=True, blank=True)
    motif_reponse = models.TextField(blank=True, null=True, help_text="Commentaire d'acceptation ou motif de refus")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Transfert"
        verbose_name_plural = "Transferts"
        ordering = ['-date_demande']

    def __str__(self):
        return f"Transfert #{self.id} : {self.patient.nom} de {self.etablissement_origine.code} vers {self.etablissement_destination.code} ({self.statut})"

    @transaction.atomic
    def accepter(self, user_acteur=None, medecin_receveur=None, motif="Transfert accepté et validé"):
        """
        Validation formelle du transfert par l'agent d'accueil (ou médecin récepteur) :
        1. Clôture de la prise en charge d'origine avec statut 'TRANSFERE'
        2. Ouverture d'une nouvelle prise en charge active dans l'établissement de destination
        3. Mise à jour de l'état du transfert
        """
        if self.statut != 'DEMANDE':
            raise ValidationError("Seul un transfert en attente peut être accepté.")

        acteur = user_acteur or medecin_receveur
        if not acteur:
            raise ValidationError("Un utilisateur acteur ou médecin receveur doit être spécifié.")

        # Verrouillage de la prise en charge active pour éviter toute course concurrente
        pec_actives = PriseEnCharge.objects.select_for_update().filter(
            patient=self.patient,
            statut='ACTIF',
            type_prise_en_charge='ORDINAIRE'
        )
        for pec in pec_actives:
            pec.marquer_transfere(motif=f"Transféré vers {self.etablissement_destination.nom}")

        # Détermination du praticien responsable éventuel
        medecin_responsable = acteur if getattr(acteur, 'role', None) == 'MEDECIN' else None

        # Ouverture de la nouvelle prise en charge à destination
        nouvelle_pec = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etablissement_destination,
            medecin_responsable=medecin_responsable,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF',
            date_debut=timezone.now()
        )

        self.statut = 'ACCEPTE'
        if getattr(acteur, 'role', None) == 'AGENT':
            self.agent_receveur = acteur
        elif getattr(acteur, 'role', None) == 'MEDECIN':
            self.medecin_receveur = acteur
        self.date_reponse = timezone.now()
        self.motif_reponse = motif
        self.save()
        return nouvelle_pec

    def refuser(self, user_acteur=None, medecin_receveur=None, motif=""):
        if self.statut != 'DEMANDE':
            raise ValidationError("Seul un transfert en attente peut être refusé.")
        motif_propre = (motif or "").strip()
        if not motif_propre:
            raise ValidationError("Un motif obligatoire doit être renseigné en cas de refus du transfert.")

        acteur = user_acteur or medecin_receveur
        if not acteur:
            raise ValidationError("Un utilisateur acteur ou médecin receveur doit être spécifié.")

        self.statut = 'REFUSE'
        if getattr(acteur, 'role', None) == 'AGENT':
            self.agent_receveur = acteur
        elif getattr(acteur, 'role', None) == 'MEDECIN':
            self.medecin_receveur = acteur
        self.date_reponse = timezone.now()
        self.motif_reponse = motif_propre
        self.save()

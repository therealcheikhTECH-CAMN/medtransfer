import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


def generate_medtransfer_id():
    """Génère un identifiant unique MedTransfer au format MDT-YYYY-XXXXXX"""
    year = timezone.now().year
    random_part = uuid.uuid4().hex[:6].upper()
    return f"MDT-{year}-{random_part}"


class Patient(models.Model):
    """
    Fiche administrative unique et permanente du patient dans MEDTRANSFER.
    Le patient conserve cet enregistrement quel que soit l'établissement où il se présente.
    """
    SEXE_CHOICES = [
        ('M', 'Masculin'),
        ('F', 'Féminin'),
        ('I', 'Indéterminé / Non renseigné'),
    ]

    STATUS_IDENTITE_CHOICES = [
        ('CONFIRMEE', 'Identité confirmée'),
        ('A_CONFIRMER', 'Identité à confirmer (Provisoire / Urgence)'),
    ]

    GROUPE_SANGUIN_CHOICES = [
        ('A+', 'A+'), ('A-', 'A-'),
        ('B+', 'B+'), ('B-', 'B-'),
        ('AB+', 'AB+'), ('AB-', 'AB-'),
        ('O+', 'O+'), ('O-', 'O-'),
        ('INCONNU', 'Inconnu'),
    ]

    # Identifiant unique national MedTransfer
    medtransfer_id = models.CharField(
        max_length=32,
        unique=True,
        default=generate_medtransfer_id,
        db_index=True,
        help_text="Identifiant permanent MedTransfer unique"
    )

    # État civil
    nom = models.CharField(max_length=100, db_index=True)
    prenom = models.CharField(max_length=100, db_index=True)
    date_naissance = models.DateField(null=True, blank=True, db_index=True)
    sexe = models.CharField(max_length=1, choices=SEXE_CHOICES, default='I')
    numero_identification_nationale = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        db_index=True,
        help_text="Numéro d'identification nationale (NIN / CNI) si disponible"
    )

    # Coordonnées
    telephone = models.CharField(max_length=30, blank=True)
    adresse = models.TextField(blank=True)
    ville = models.CharField(max_length=100, blank=True, default='Ziguinchor')

    # Informations d'urgence de base
    groupe_sanguin = models.CharField(max_length=10, choices=GROUPE_SANGUIN_CHOICES, default='INCONNU')
    personne_contact_nom = models.CharField(max_length=150, blank=True, help_text="Contact d'urgence")
    personne_contact_telephone = models.CharField(max_length=30, blank=True)

    # Traçabilité identité provisoire (Urgence)
    status_identite = models.CharField(
        max_length=20,
        choices=STATUS_IDENTITE_CHOICES,
        default='CONFIRMEE',
        help_text="Indique si l'identité a été formellement vérifiée ou créée en urgence"
    )
    motif_identite_provisoire = models.TextField(
        blank=True,
        null=True,
        help_text="Justification obligatoire en cas d'identité provisoire"
    )

    # Rapprochement contrôlé ultérieur
    reconciled_with = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='fiches_rapprochees',
        help_text="Fiche patient cible lors d'un rapprochement d'identité provisoire"
    )
    reconciled_at = models.DateTimeField(null=True, blank=True)
    reconciled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='rapprochements_effectues'
    )

    # Établissement et auteur de la création
    etablissement_creation = models.ForeignKey(
        'establishments.Etablissement',
        on_delete=models.PROTECT,
        related_name='patients_enregistres'
    )
    cree_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='patients_crees'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Patient"
        verbose_name_plural = "Patients"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['nom', 'prenom']),
            models.Index(fields=['medtransfer_id']),
            models.Index(fields=['numero_identification_nationale']),
        ]

    def __str__(self):
        statut_badge = " [IDENTITÉ À CONFIRMER]" if self.status_identite == 'A_CONFIRMER' else ""
        return f"{self.nom.upper()} {self.prenom} ({self.medtransfer_id}){statut_badge}"

    @property
    def is_provisional(self):
        return self.status_identite == 'A_CONFIRMER'


class PatientModificationHistory(models.Model):
    """
    Historique médicolégal des modifications administratives apportées à la fiche patient.
    Conserve l'ancienne valeur, la nouvelle valeur, l'auteur, la date et le motif obligatoire.
    """
    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name='historique_modifications'
    )
    auteur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='modifications_patients'
    )
    etablissement = models.ForeignKey(
        'establishments.Etablissement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='modifications_patients_effectuees'
    )
    date_modification = models.DateTimeField(auto_now_add=True)
    motif = models.TextField(help_text="Motif obligatoire justifiant la correction administrative")
    champs_modifies = models.JSONField(help_text="Dictionnaire des champs modifiés avec anciennes et nouvelles valeurs")

    class Meta:
        verbose_name = "Historique de modification patient"
        verbose_name_plural = "Historiques de modifications patients"
        ordering = ['-date_modification']

    def __str__(self):
        return f"Modif {self.patient.medtransfer_id} par {self.auteur} le {self.date_modification.strftime('%d/%m/%Y %H:%M')}"


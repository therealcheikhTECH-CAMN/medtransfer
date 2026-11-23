from django.db import models
from django.conf import settings


class Etablissement(models.Model):
    """
    Structure sanitaire enregistrée dans MEDTRANSFER.
    Tous les établissements partagent la même base de données centralisée.
    """
    TYPE_CHOICES = [
        ('HOPITAL_NATIONAL', 'Hôpital National / CHU'),
        ('CENTRE_HOSPITALIER_REGIONAL', 'Centre Hospitalier Régional (CHR)'),
        ('CENTRE_DE_SANTE', 'Centre de Santé'),
        ('POSTE_DE_SANTE', 'Poste de Santé'),
        ('CLINIQUE_PRIVEE', 'Clinique Privée'),
    ]

    code = models.CharField(max_length=20, unique=True, help_text="Code unique de l'établissement (ex: HRZ, CHU-FANN)")
    nom = models.CharField(max_length=255, help_text="Nom officiel de l'établissement")
    type_etablissement = models.CharField(max_length=50, choices=TYPE_CHOICES, default='CENTRE_HOSPITALIER_REGIONAL')
    region = models.CharField(max_length=100, default='Ziguinchor')
    ville = models.CharField(max_length=100)
    adresse = models.CharField(max_length=255, blank=True)
    telephone = models.CharField(max_length=50, blank=True)
    email = models.EmailField(blank=True)
    site_web = models.URLField(max_length=255, blank=True, help_text="Site web officiel")
    description = models.TextField(blank=True, help_text="Présentation générale de l'établissement")
    services_declares = models.TextField(
        blank=True,
        help_text="Services et spécialités déclarés (ex: Urgences 24/7, Cardiologie, Chirurgie, Pédiatrie)"
    )
    is_active = models.BooleanField(default=True)
    directeur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='etablissements_diriges',
        help_text="Directeur officiel affecté à cet établissement"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Établissement"
        verbose_name_plural = "Établissements"
        ordering = ['nom']

    def __str__(self):
        return f"{self.nom} ({self.code}) - {self.ville}"

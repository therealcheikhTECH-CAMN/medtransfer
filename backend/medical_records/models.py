from django.db import models
from django.conf import settings
from django.utils import timezone


class DossierMedical(models.Model):
    """
    Dossier médical unique et centralisé du patient.
    RÈGLE ABSOLUE : un seul et unique dossier médical par patient dans toute l'application.
    Les médecins de tous les établissements consultent et enrichissent ce même dossier.
    """
    patient = models.OneToOneField(
        'patients.Patient',
        on_delete=models.PROTECT,
        related_name='dossier_medical',
        help_text="Patient titulaire unique de ce dossier médical"
    )
    remarques_importantes = models.TextField(
        blank=True,
        help_text="Informations de vigilance immédiate (ex: alertes vitales, conditions particulières)"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Dossier Médical"
        verbose_name_plural = "Dossiers Médicaux"

    def __str__(self):
        return f"Dossier Médical - {self.patient.nom} {self.patient.prenom} ({self.patient.medtransfer_id})"


class Antecedent(models.Model):
    """Antécédents médicaux, chirurgicaux ou familiaux documentés"""
    TYPE_CHOICES = [
        ('MEDICAL', 'Médical'),
        ('CHIRURGICAL', 'Chirurgical'),
        ('FAMILIAL', 'Familial'),
        ('GYNECO_OBSTETRIQUE', 'Gynéco-obstétrique'),
        ('AUTRE', 'Autre'),
    ]

    dossier = models.ForeignKey(DossierMedical, on_delete=models.CASCADE, related_name='antecedents')
    type_antecedent = models.CharField(max_length=30, choices=TYPE_CHOICES, default='MEDICAL')
    description = models.TextField()
    date_diagnostic = models.CharField(max_length=50, blank=True, help_text="Année ou date approximative")
    is_actif = models.BooleanField(default=True, help_text="Pathologie encore active ou résolue")
    enregistre_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Antécédent"
        verbose_name_plural = "Antécédents"
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_type_antecedent_display()} : {self.description[:40]}"


class Allergie(models.Model):
    """Allergies déclarées ou constatées"""
    SEVERITE_CHOICES = [
        ('FAIBLE', 'Faible'),
        ('MODEREE', 'Modérée'),
        ('SEVERE', 'Sévère'),
        ('CRITIQUE', 'Critique (Risque de choc anaphylactique)'),
    ]

    dossier = models.ForeignKey(DossierMedical, on_delete=models.CASCADE, related_name='allergies')
    substance = models.CharField(max_length=150, help_text="Médicament, aliment ou substance allergène")
    severite = models.CharField(max_length=20, choices=SEVERITE_CHOICES, default='MODEREE')
    reaction = models.TextField(blank=True, help_text="Manifestations cliniques (urticaire, oedème...)")
    enregistre_par = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Allergie"
        verbose_name_plural = "Allergies"
        ordering = ['-created_at']

    def __str__(self):
        return f"Allergie : {self.substance} ({self.get_severite_display()})"


class TraitementActuel(models.Model):
    """Traitements en cours et historique thérapeutique structuré du patient"""
    STATUT_DISPLAY_MAP = {
        'ACTIF': 'En cours',
        'TERMINE': 'Terminé',
        'ARRETE': 'Arrêté',
    }

    dossier = models.ForeignKey(DossierMedical, on_delete=models.CASCADE, related_name='traitements')
    consultation = models.ForeignKey(
        'consultations.Consultation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='traitements_associes',
        help_text="Consultation lors de laquelle ce traitement a été initié ou ajusté"
    )
    medicament = models.CharField(max_length=200, help_text="Nom de la molécule ou spécialité")
    dosage = models.CharField(max_length=100, blank=True, default='', help_text="Dosage ou concentration (ex: 10 mg, 500 mg)")
    posologie = models.CharField(max_length=200, help_text="Dose et schéma posologique")
    frequence = models.CharField(max_length=100, blank=True, default='', help_text="Fréquence d'administration (ex: 1 fois/jour, matin et soir)")
    date_debut = models.DateField(null=True, blank=True)
    date_fin = models.DateField(null=True, blank=True)
    instructions = models.TextField(blank=True, default='', help_text="Instructions complémentaires au patient")
    is_actif = models.BooleanField(default=True)
    motif_arret = models.CharField(max_length=255, blank=True, default='', help_text="Motif de l'arrêt du traitement")
    date_arret = models.DateTimeField(null=True, blank=True)
    prescrit_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name='traitements_prescrits'
    )
    modifie_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='traitements_modifies'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Traitement en cours"
        verbose_name_plural = "Traitements en cours"
        ordering = ['-created_at']

    def __str__(self):
        dosage_part = f" {self.dosage}" if self.dosage else ""
        return f"{self.medicament}{dosage_part} - {self.posologie}"

    @property
    def statut_traitement(self):
        if not self.is_actif:
            return 'ARRETE'
        today = timezone.now().date()
        if self.date_fin and self.date_fin < today:
            return 'TERMINE'
        return 'ACTIF'

    @property
    def statut_display(self):
        return self.STATUT_DISPLAY_MAP.get(self.statut_traitement, 'En cours')

    @property
    def est_en_cours(self):
        return self.statut_traitement == 'ACTIF'

    def arreter(self, medecin=None, motif="Arrêt médical"):
        today = timezone.now().date()
        self.is_actif = False
        self.date_arret = timezone.now()
        self.motif_arret = motif or "Arrêt médical"
        if medecin:
            self.modifie_par = medecin
        if not self.date_fin or self.date_fin > today:
            self.date_fin = today
        self.save()


class ExamenComplementaire(models.Model):
    """Comptes rendus d'imagerie, de biologie ou d'explorations fonctionnelles"""
    dossier = models.ForeignKey(DossierMedical, on_delete=models.CASCADE, related_name='examens')
    titre = models.CharField(max_length=200)
    type_examen = models.CharField(max_length=100, help_text="Biologie, Scanner, Échographie, ECG, etc.")
    resultat = models.TextField()
    date_examen = models.DateField()
    etablissement = models.ForeignKey('establishments.Etablissement', on_delete=models.PROTECT)
    medecin = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Examen complémentaire"
        verbose_name_plural = "Examens complémentaires"
        ordering = ['-date_examen']

    def __str__(self):
        return f"{self.type_examen} : {self.titre} ({self.date_examen})"


def appliquer_operations_traitements(dossier, operations, user, consultation=None, request=None):
    """
    Exécute de manière atomique et traçable les décisions explicites du médecin
    concernant les traitements actuels du dossier médical lors d'une consultation
    ou d'une rectification de consultation :
    - 'ADD' : Ajoute un nouveau traitement (ou met à jour sans créer de doublon si déjà associé
              au même médicament actif dans ce dossier ou cette consultation).
    - 'UPDATE' : Met à jour un traitement existant (posologie, dosage, fréquence, dates, instructions).
    - 'STOP' : Arrête un traitement existant en conservant son historique complet.
    - 'NONE' : Ne modifie aucun traitement actuel (prescription ponctuelle uniquement).
    """
    if not operations or not isinstance(operations, list):
        return []

    from audit.models import enregistrer_journal
    today = timezone.now().date()
    resultats = []

    for op in operations:
        if not isinstance(op, dict):
            continue
        action = str(op.get('action') or '').upper().strip()
        if not action or action == 'NONE':
            continue

        traitement_id = op.get('traitement_id') or op.get('id')

        if action == 'ADD':
            medicament = str(op.get('medicament') or '').strip()
            posologie = str(op.get('posologie') or '').strip()
            if not medicament or not posologie:
                continue

            dosage = str(op.get('dosage') or '').strip()
            frequence = str(op.get('frequence') or '').strip()
            instructions = str(op.get('instructions') or '').strip()
            date_debut = op.get('date_debut') or today
            date_fin = op.get('date_fin') or None

            # Prévention des doublons lors de rectifications successives ou d'ajouts répétés
            existing = None
            if traitement_id:
                existing = TraitementActuel.objects.filter(pk=traitement_id, dossier=dossier).first()
            if not existing and consultation:
                existing = TraitementActuel.objects.filter(
                    dossier=dossier,
                    consultation=consultation,
                    medicament__iexact=medicament
                ).first()
            if not existing:
                existing = TraitementActuel.objects.filter(
                    dossier=dossier,
                    is_actif=True,
                    medicament__iexact=medicament
                ).first()

            if existing:
                existing.medicament = medicament
                existing.dosage = dosage
                existing.posologie = posologie
                existing.frequence = frequence
                existing.instructions = instructions
                if op.get('date_debut'):
                    existing.date_debut = date_debut
                if 'date_fin' in op:
                    existing.date_fin = date_fin
                existing.is_actif = True
                existing.motif_arret = ''
                existing.date_arret = None
                existing.modifie_par = user
                if consultation and not existing.consultation_id:
                    existing.consultation = consultation
                existing.save()

                enregistrer_journal(
                    action='UPDATE_TREATMENT',
                    utilisateur=user,
                    etablissement=getattr(user, 'etablissement', None),
                    statut='SUCCES',
                    entite_type='TraitementActuel',
                    entite_id=existing.id,
                    details={
                        'patient_id': dossier.patient_id,
                        'medicament': existing.medicament,
                        'posologie': existing.posologie,
                        'consultation_id': consultation.id if consultation else None,
                    },
                    request=request
                )
                resultats.append(existing)
            else:
                nouveau = TraitementActuel.objects.create(
                    dossier=dossier,
                    consultation=consultation,
                    medicament=medicament,
                    dosage=dosage,
                    posologie=posologie,
                    frequence=frequence,
                    date_debut=date_debut,
                    date_fin=date_fin,
                    instructions=instructions,
                    is_actif=True,
                    prescrit_par=user
                )
                enregistrer_journal(
                    action='CREATE_TREATMENT',
                    utilisateur=user,
                    etablissement=getattr(user, 'etablissement', None),
                    statut='SUCCES',
                    entite_type='TraitementActuel',
                    entite_id=nouveau.id,
                    details={
                        'patient_id': dossier.patient_id,
                        'medicament': nouveau.medicament,
                        'posologie': nouveau.posologie,
                        'consultation_id': consultation.id if consultation else None,
                    },
                    request=request
                )
                resultats.append(nouveau)

        elif action == 'UPDATE':
            if not traitement_id:
                continue
            existing = TraitementActuel.objects.filter(pk=traitement_id, dossier=dossier).first()
            if not existing:
                continue

            for field in ('medicament', 'dosage', 'posologie', 'frequence', 'instructions'):
                if field in op and op[field] is not None:
                    setattr(existing, field, str(op[field]).strip())
            if 'date_debut' in op and op['date_debut']:
                existing.date_debut = op['date_debut']
            if 'date_fin' in op:
                existing.date_fin = op['date_fin'] or None
            if 'is_actif' in op and op['is_actif'] is not None:
                existing.is_actif = bool(op['is_actif'])
            existing.modifie_par = user
            if consultation:
                existing.consultation = consultation
            existing.save()

            enregistrer_journal(
                action='UPDATE_TREATMENT',
                utilisateur=user,
                etablissement=getattr(user, 'etablissement', None),
                statut='SUCCES',
                entite_type='TraitementActuel',
                entite_id=existing.id,
                details={
                    'patient_id': dossier.patient_id,
                    'medicament': existing.medicament,
                    'posologie': existing.posologie,
                    'consultation_id': consultation.id if consultation else None,
                },
                request=request
            )
            resultats.append(existing)

        elif action == 'STOP':
            if not traitement_id:
                continue
            existing = TraitementActuel.objects.filter(pk=traitement_id, dossier=dossier).first()
            if not existing:
                continue

            motif_arret = str(op.get('motif_arret') or 'Arrêt décidé lors de la consultation').strip()
            if consultation:
                existing.consultation = consultation
            existing.arreter(medecin=user, motif=motif_arret)

            enregistrer_journal(
                action='STOP_TREATMENT',
                utilisateur=user,
                etablissement=getattr(user, 'etablissement', None),
                statut='SUCCES',
                entite_type='TraitementActuel',
                entite_id=existing.id,
                details={
                    'patient_id': dossier.patient_id,
                    'medicament': existing.medicament,
                    'motif_arret': motif_arret,
                    'consultation_id': consultation.id if consultation else None,
                },
                request=request
            )
            resultats.append(existing)

    return resultats

from django.db import models
from django.conf import settings
from django.utils import timezone


class JournalAcces(models.Model):
    """
    Système de traçabilité et d'audit légal de MEDTRANSFER.
    Enregistre les accès, consultations sensibles, interventions d'urgence,
    tentatives d'accès non autorisées et modifications critiques.
    """
    ACTION_CHOICES = [
        ('LOGIN', 'Connexion réussie'),
        ('LOGIN_FAILED', 'Échec d\'authentification'),
        ('LOGOUT', 'Déconnexion'),
        ('VIEW_PATIENT', 'Consultation fiche administrative'),
        ('VIEW_MEDICAL_RECORD', 'Consultation dossier médical'),
        ('EMERGENCY_ACCESS', 'Accès dérogatoire d\'urgence'),
        ('CREATE_PATIENT', 'Création fiche patient'),
        ('CREATE_PROVISIONAL_PATIENT', 'Création patient identité provisoire'),
        ('RECONCILE_PATIENT', 'Rapprochement d\'identité provisoire'),
        ('UPDATE_ADMIN_PATIENT', 'Modification données administratives'),
        ('CREATE_CONSULTATION', 'Création d\'une consultation'),
        ('UPDATE_CONSULTATION', 'Rectification d\'une consultation'),
        ('CARE_OPENED', 'Ouverture prise en charge'),
        ('CARE_CLOSED', 'Clôture prise en charge'),
        ('TRANSFER_INITIATE', 'Initiation d\'un transfert'),
        ('TRANSFER_ACCEPT', 'Acceptation d\'un transfert'),
        ('TRANSFER_REJECT', 'Refus d\'un transfert'),
        ('AI_SUMMARY_REQUEST', 'Demande de synthèse IA'),
        ('AI_SUMMARY_VALIDATE', 'Validation synthèse IA'),
        ('AI_SUMMARY_REJECT', 'Rejet synthèse IA'),
        ('PERMISSION_DENIED', 'Tentative d\'accès non autorisée (403)'),
        ('REGISTER_REQUEST', 'Demande d\'inscription professionnelle'),
        ('USER_APPROVED', 'Validation de compte par le directeur'),
        ('USER_REJECTED', 'Refus de demande d\'inscription'),
        ('USER_SUSPENDED', 'Suspension de compte professionnel'),
        ('USER_REACTIVATED', 'Réactivation de compte professionnel'),
        ('USER_DEACTIVATED', 'Désactivation de compte professionnel'),
        ('ESTABLISHMENT_CREATED', 'Création d\'un établissement'),
        ('ESTABLISHMENT_UPDATED', 'Modification d\'un établissement'),
        ('ESTABLISHMENT_ACTIVATED', 'Activation d\'un établissement'),
        ('ESTABLISHMENT_DEACTIVATED', 'Désactivation d\'un établissement'),
        ('DIRECTOR_ASSIGNED', 'Attribution d\'un directeur d\'établissement'),
        ('DIRECTOR_REPLACED', 'Remplacement d\'un directeur d\'établissement'),
        ('VALIDATION_EMAIL_SENT', 'Envoi de l\'e-mail de validation'),
        ('VALIDATION_EMAIL_FAILED', 'Échec d\'envoi de l\'e-mail de validation'),
        ('PASSWORD_CHANGED', 'Modification du mot de passe'),
        ('PASSWORD_RESET_REQUEST', 'Demande de réinitialisation de mot de passe'),
        ('PASSWORD_RESET_CONFIRM', 'Réinitialisation effective du mot de passe'),
        ('CREATE_TREATMENT', 'Ajout d\'un traitement médical'),
        ('UPDATE_TREATMENT', 'Modification d\'un traitement médical'),
        ('STOP_TREATMENT', 'Arrêt d\'un traitement médical'),
        ('EMERGENCY_ACCESS_EXPIRED', 'Expiration d\'un accès dérogatoire d\'urgence'),
        ('EMERGENCY_ACCESS_REVOKED', 'Révocation d\'un accès dérogatoire d\'urgence'),
        ('CREATE_ANTECEDENT', 'Ajout d\'un antécédent médical'),
        ('UPDATE_ANTECEDENT', 'Modification d\'un antécédent médical'),
        ('CREATE_ALLERGIE', 'Ajout d\'une allergie'),
        ('UPDATE_ALLERGIE', 'Modification d\'une allergie'),
        ('CREATE_EXAMEN', 'Ajout d\'un examen complémentaire'),
        ('UPDATE_EXAMEN', 'Modification d\'un examen complémentaire'),
        ('EMAIL_COMPOSER_OPENED', 'Ouverture de la fenêtre de messagerie'),
        ('EMAIL_CLIENT_OPEN_REQUESTED', 'Ouverture du client de messagerie mailto'),
        ('EMAIL_CONTENT_COPIED', 'Copie du contenu de l\'e-mail'),
    ]

    STATUT_CHOICES = [
        ('SUCCES', 'Succès'),
        ('ECHEC', 'Échec'),
        ('REFUSE', 'Refusé / Interdit'),
    ]

    utilisateur = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='journaux_activite'
    )
    etablissement = models.ForeignKey(
        'establishments.Etablissement',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='journaux_audit'
    )
    action = models.CharField(max_length=40, choices=ACTION_CHOICES, db_index=True)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='SUCCES')
    entite_type = models.CharField(max_length=50, blank=True, help_text="Ex: Patient, DossierMedical, Consultation")
    entite_id = models.CharField(max_length=50, blank=True)
    details = models.JSONField(default=dict, blank=True)
    adresse_ip = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    timestamp = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        verbose_name = "Journal d'accès et d'audit"
        verbose_name_plural = "Journaux d'accès et d'audit"
        ordering = ['-timestamp']

    def __str__(self):
        user_name = self.utilisateur.username if self.utilisateur else "Anonyme/Système"
        return f"[{self.timestamp.strftime('%d/%m/%Y %H:%M:%S')}] {user_name} -> {self.get_action_display()} ({self.statut})"


def _sanitize_audit_details(details):
    """Garantit qu'aucun mot de passe, hash ou secret n'est jamais stocké dans les journaux d'audit."""
    if not isinstance(details, dict):
        return {}
    forbidden_keys = {'password', 'password_confirm', 'current_password', 'new_password', 'new_password_confirm', 'old_password', 'mot_de_passe', 'hash', 'secret', 'token'}
    sanitized = {}
    for k, v in details.items():
        if any(fk in str(k).lower() for fk in forbidden_keys):
            continue
        if isinstance(v, dict):
            sanitized[k] = _sanitize_audit_details(v)
        else:
            sanitized[k] = v
    return sanitized


def enregistrer_journal(action, utilisateur=None, etablissement=None, statut='SUCCES', entite_type='', entite_id='', details=None, request=None):
    """
    Fonction utilitaire pour enregistrer un événement d'audit de manière simple et sécurisée.
    """
    adresse_ip = None
    user_agent = ''

    if request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            adresse_ip = x_forwarded_for.split(',')[0].strip()
        else:
            adresse_ip = request.META.get('REMOTE_ADDR')
        user_agent = request.META.get('HTTP_USER_AGENT', '')

        if not utilisateur and request.user.is_authenticated:
            utilisateur = request.user
            if not etablissement and hasattr(request.user, 'etablissement'):
                etablissement = request.user.etablissement

    return JournalAcces.objects.create(
        utilisateur=utilisateur,
        etablissement=etablissement,
        action=action,
        statut=statut,
        entite_type=entite_type,
        entite_id=str(entite_id),
        details=_sanitize_audit_details(details),
        adresse_ip=adresse_ip,
        user_agent=user_agent
    )

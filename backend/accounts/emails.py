from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from audit.models import enregistrer_journal


VALIDATION_EMAIL_SUBJECT = "Votre compte professionnel MEDTRANSFER a été validé"


def build_validation_email_body(user):
    """
    Construit le corps exact de l'e-mail de confirmation après validation par le directeur.
    N'inclut JAMAIS le mot de passe ni son condensat.
    """
    prenom = (user.first_name or user.username).strip()
    email_pro = user.email

    return (
        f"Bonjour {prenom},\n\n"
        f"Votre demande d'inscription à MEDTRANSFER a été validée par le directeur de votre établissement de santé.\n\n"
        f"Vous pouvez désormais vous connecter à la plateforme avec les identifiants que vous avez définis lors de votre inscription.\n\n"
        f"Adresse e-mail : {email_pro}\n\n"
        f"Votre mot de passe est celui que vous avez choisi lors de votre inscription. Pour votre sécurité, il ne figure pas dans cet e-mail.\n\n"
        f"Vous pouvez maintenant accéder à votre espace professionnel MEDTRANSFER.\n\n"
        f"Cordialement,\n"
        f"L'équipe MEDTRANSFER."
    )


def send_account_validation_email(user, actor=None, request=None):
    """
    Envoie véritablement l'e-mail de confirmation après validation du compte via le backend SMTP/Email Django.
    Met à jour l'état d'envoi sur l'utilisateur et journalise le résultat.
    Retourne (success: bool, error_message: str).
    """
    if not user.email:
        err = "Aucune adresse e-mail professionnelle n'est renseignée sur ce compte."
        user.email_validation_envoye = False
        user.erreur_envoi_email = err
        user.save(update_fields=['email_validation_envoye', 'erreur_envoi_email'])
        return False, err

    body = build_validation_email_body(user)

    try:
        sent_count = send_mail(
            subject=VALIDATION_EMAIL_SUBJECT,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'MEDTRANSFER <no-reply@medtransfer.sn>'),
            recipient_list=[user.email],
            fail_silently=False,
        )
        if not sent_count:
            raise RuntimeError("Le serveur d'e-mail n'a confirmé aucun destinataire (0 message envoyé).")

        user.email_validation_envoye = True
        user.date_envoi_email_validation = timezone.now()
        user.erreur_envoi_email = ''
        user.save(update_fields=['email_validation_envoye', 'date_envoi_email_validation', 'erreur_envoi_email'])

        enregistrer_journal(
            action='VALIDATION_EMAIL_SENT',
            utilisateur=actor or user,
            etablissement=user.etablissement,
            statut='SUCCES',
            entite_type='User',
            entite_id=user.id,
            details={'recipient_email': user.email},
            request=request
        )
        return True, ''

    except Exception as exc:
        err_msg = str(exc)
        user.email_validation_envoye = False
        user.erreur_envoi_email = err_msg
        user.save(update_fields=['email_validation_envoye', 'erreur_envoi_email'])

        enregistrer_journal(
            action='VALIDATION_EMAIL_FAILED',
            utilisateur=actor or user,
            etablissement=user.etablissement,
            statut='ECHEC',
            entite_type='User',
            entite_id=user.id,
            details={'recipient_email': user.email, 'error': err_msg},
            request=request
        )
        return False, err_msg


def send_password_reset_email(user, reset_url):
    """
    Envoie l'e-mail contenant le lien sécurisé et temporaire de réinitialisation de mot de passe.
    Ne contient jamais l'ancien mot de passe.
    """
    prenom = (user.first_name or user.username).strip()
    subject = "Réinitialisation de votre mot de passe MEDTRANSFER"
    body = (
        f"Bonjour {prenom},\n\n"
        f"Une demande de réinitialisation de mot de passe a été effectuée pour votre compte professionnel MEDTRANSFER ({user.email}).\n\n"
        f"Pour définir un nouveau mot de passe, veuillez utiliser le lien sécurisé à usage unique ci-dessous :\n\n"
        f"{reset_url}\n\n"
        f"Ce lien est temporaire et à usage unique. Pour votre sécurité, votre ancien mot de passe n'est jamais transmis par e-mail.\n\n"
        f"Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet e-mail.\n\n"
        f"Cordialement,\n"
        f"L'équipe MEDTRANSFER."
    )

    send_mail(
        subject=subject,
        message=body,
        from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'MEDTRANSFER <no-reply@medtransfer.sn>'),
        recipient_list=[user.email],
        fail_silently=False,
    )

DIRECTOR_VALIDATION_SUBJECT = "Validation de votre demande d'accès Directeur — MEDTRANSFER"
DIRECTOR_REJECTION_SUBJECT = "Statut de votre demande d'accès Directeur — MEDTRANSFER"


def build_director_validation_email_body(user):
    """
    Construit l'e-mail de confirmation pour un directeur validé par l'Administrateur Général.
    N'inclut JAMAIS le mot de passe ni son condensat.
    """
    prenom = (user.first_name or user.username).strip()
    nom = (user.last_name or '').strip()
    nom_complet = f"{prenom} {nom}".strip()
    etab_nom = user.etablissement.nom if user.etablissement else "Votre établissement"
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')

    return (
        f"Bonjour {nom_complet},\n\n"
        f"Nous avons le plaisir de vous informer que votre demande d'accès en tant que Directeur "
        f"pour l'établissement « {etab_nom} » a été validée par l'Administrateur Général de MEDTRANSFER.\n\n"
        f"Votre compte est désormais actif avec les droits de direction de cet établissement.\n\n"
        f"Vos identifiants de connexion :\n"
        f"- Identifiant / E-mail professionnel : {user.email}\n"
        f"- Mot de passe : Celui que vous avez défini lors de votre demande (confidentiel et crypté)\n\n"
        f"Vous pouvez vous connecter dès maintenant via le lien sécurisé suivant :\n"
        f"{frontend_url}/login\n\n"
        f"Cordialement,\n"
        f"L'Administration Générale MEDTRANSFER"
    )


def build_director_rejection_email_body(user, motif):
    """
    Construit l'e-mail de notification de refus de la demande de directeur avec motif obligatoire.
    """
    prenom = (user.first_name or user.username).strip()
    nom = (user.last_name or '').strip()
    nom_complet = f"{prenom} {nom}".strip()
    etab_nom = user.etablissement.nom if user.etablissement else "l'établissement demandé"

    return (
        f"Bonjour {nom_complet},\n\n"
        f"Votre demande d'accès en qualité de Directeur pour {etab_nom} a été examinée par l'Administrateur Général.\n\n"
        f"Nous vous informons que cette demande n'a pas été retenue.\n\n"
        f"Motif de la décision :\n"
        f"« {motif} »\n\n"
        f"Pour toute question ou démarche complémentaire, veuillez vous rapprocher de l'Administration Générale.\n\n"
        f"Cordialement,\n"
        f"L'Administration Générale MEDTRANSFER"
    )


def send_director_validation_email(user, actor=None, request=None):
    """
    Envoie l'e-mail de validation au directeur d'établissement.
    Ne bloque jamais la transaction en base en cas d'erreur de serveur de messagerie.
    """
    if not user.email:
        return False, "Aucune adresse e-mail professionnelle renseignée."

    body = build_director_validation_email_body(user)
    try:
        sent_count = send_mail(
            subject=DIRECTOR_VALIDATION_SUBJECT,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'MEDTRANSFER <no-reply@medtransfer.sn>'),
            recipient_list=[user.email],
            fail_silently=False,
        )
        if not sent_count:
            raise RuntimeError("Le serveur d'e-mail n'a confirmé aucun destinataire.")

        user.email_validation_envoye = True
        user.date_envoi_email_validation = timezone.now()
        user.erreur_envoi_email = ''
        user.save(update_fields=['email_validation_envoye', 'date_envoi_email_validation', 'erreur_envoi_email'])

        enregistrer_journal(
            action='DIRECTOR_VALIDATION_EMAIL_SENT',
            utilisateur=actor or user,
            etablissement=user.etablissement,
            statut='SUCCES',
            entite_type='User',
            entite_id=user.id,
            details={'recipient_email': user.email},
            request=request
        )
        return True, ''
    except Exception as exc:
        err_msg = str(exc)
        user.email_validation_envoye = False
        user.erreur_envoi_email = err_msg
        user.save(update_fields=['email_validation_envoye', 'erreur_envoi_email'])

        enregistrer_journal(
            action='DIRECTOR_VALIDATION_EMAIL_FAILED',
            utilisateur=actor or user,
            etablissement=user.etablissement,
            statut='ECHEC',
            entite_type='User',
            entite_id=user.id,
            details={'recipient_email': user.email, 'error': err_msg},
            request=request
        )
        return False, err_msg


def send_director_rejection_email(user, motif, actor=None, request=None):
    """
    Envoie l'e-mail de notification de refus au demandeur de compte directeur.
    """
    if not user.email:
        return False, "Aucune adresse e-mail professionnelle renseignée."

    body = build_director_rejection_email_body(user, motif)
    try:
        send_mail(
            subject=DIRECTOR_REJECTION_SUBJECT,
            message=body,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'MEDTRANSFER <no-reply@medtransfer.sn>'),
            recipient_list=[user.email],
            fail_silently=False,
        )

        enregistrer_journal(
            action='DIRECTOR_REJECTION_EMAIL_SENT',
            utilisateur=actor or user,
            etablissement=user.etablissement,
            statut='SUCCES',
            entite_type='User',
            entite_id=user.id,
            details={'recipient_email': user.email, 'motif': motif},
            request=request
        )
        return True, ''
    except Exception as exc:
        err_msg = str(exc)
        enregistrer_journal(
            action='DIRECTOR_REJECTION_EMAIL_FAILED',
            utilisateur=actor or user,
            etablissement=user.etablissement,
            statut='ECHEC',
            entite_type='User',
            entite_id=user.id,
            details={'recipient_email': user.email, 'error': err_msg, 'motif': motif},
            request=request
        )
        return False, err_msg


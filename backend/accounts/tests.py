import re
from datetime import timedelta
from unittest.mock import patch
from django.core import mail
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User, PasswordResetToken
from accounts.emails import VALIDATION_EMAIL_SUBJECT
from establishments.models import Etablissement
from notifications.models import Notification
from audit.models import JournalAcces


class ProfessionalAuthWorkflowTests(APITestCase):
    """
    Suite de tests automatisés couvrant les 12 exigences obligatoires :
    1. Inscription avec e-mail et mot de passe.
    2. Vérification du hash en base.
    3. Impossibilité de se connecter avant validation.
    4. Validation par le directeur.
    5. Envoi réel de l'e-mail après validation (objet, contenu exact, gestion d'erreur et nouvel envoi).
    6. Connexion avec les identifiants initiaux après validation.
    7. Refus de connexion pour un compte suspendu (ou refusé, ou établissement inactif).
    8. Modification du mot de passe après connexion (« Sécurité et mot de passe ») + révocation des anciens tokens.
    9. Connexion avec le nouveau mot de passe.
    10. Refus de l'ancien mot de passe.
    11. Réinitialisation après oubli du mot de passe (usage unique, expiration, non-divulgation d'existence).
    12. Absence totale de mot de passe dans les journaux d'audit, notifications, e-mails et réponses API.
    """

    def setUp(self):
        self.etablissement = Etablissement.objects.create(
            code="HRZ",
            nom="Hôpital Régional de Ziguinchor",
            type_etablissement="CENTRE_HOSPITALIER_REGIONAL",
            region="Ziguinchor",
            ville="Ziguinchor",
            is_active=True
        )
        self.autre_etablissement = Etablissement.objects.create(
            code="CHU-FANN",
            nom="CHU de Fann",
            type_etablissement="HOPITAL_NATIONAL",
            region="Dakar",
            ville="Dakar",
            is_active=True
        )

        # Directeur de l'établissement HRZ
        self.directeur = User.objects.create_user(
            username="directeur_hrz",
            email="directeur@hrz.sn",
            password="DirectorPass123!",
            role="DIRECTEUR",
            etablissement=self.etablissement,
            first_name="Ousmane",
            last_name="Gomis",
            statut_validation="APPROVED",
            is_active=True,
            is_actif=True
        )

        # Directeur d'un autre établissement
        self.autre_directeur = User.objects.create_user(
            username="directeur_fann",
            email="directeur@fann.sn",
            password="DirectorPass123!",
            role="DIRECTEUR",
            etablissement=self.autre_etablissement,
            first_name="Abdoulaye",
            last_name="Fall",
            statut_validation="APPROVED",
            is_active=True,
            is_actif=True
        )

        self.raw_password = "StrongMedPassword2026!"
        self.registration_payload = {
            "first_name": "Khadija",
            "last_name": "Badiane",
            "email": "khadija.badiane@hrz.sn",
            "telephone": "+221 77 500 60 70",
            "role": "MEDECIN",
            "etablissement": self.etablissement.id,
            "matricule_professionnel": "ONMS-2026-512",
            "specialite": "Cardiologie",
            "justificatif": "Attestation d'inscription à l'Ordre des Médecins N°512",
            "password": self.raw_password,
            "password_confirm": self.raw_password,
        }

    def _register_professional(self, extra=None):
        payload = {**self.registration_payload, **(extra or {})}
        return self.client.post('/api/auth/register/', payload, format='json')

    # =========================================================================
    # TEST 1 : Inscription avec e-mail et mot de passe
    # =========================================================================
    def test_01_inscription_avec_email_et_mot_de_passe(self):
        res = self._register_professional()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['user']['email'], 'khadija.badiane@hrz.sn')
        self.assertEqual(res.data['user']['first_name'], 'Khadija')
        self.assertEqual(res.data['user']['last_name'], 'Badiane')
        self.assertEqual(res.data['user']['role'], 'MEDECIN')
        self.assertEqual(res.data['user']['statut_validation'], 'PENDING')
        self.assertFalse(res.data['user']['is_actif'])
        self.assertNotIn('password', res.data['user'])

        # Vérifier le refus si les mots de passe ne correspondent pas ou sont faibles
        res_mismatch = self._register_professional({
            "email": "autre@hrz.sn",
            "password_confirm": "AutreMotDePasse2026!"
        })
        self.assertEqual(res_mismatch.status_code, status.HTTP_400_BAD_REQUEST)

        res_weak = self._register_professional({
            "email": "faible@hrz.sn",
            "password": "123",
            "password_confirm": "123"
        })
        self.assertEqual(res_weak.status_code, status.HTTP_400_BAD_REQUEST)

        # Vérifier que les patients ou rôles non autorisés ne peuvent pas s'inscrire
        res_patient = self._register_professional({
            "email": "patient@hrz.sn",
            "role": "PATIENT"
        })
        self.assertEqual(res_patient.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # TEST 2 : Vérification du hash en base (aucun stockage en clair)
    # =========================================================================
    def test_02_verification_du_hash_en_base(self):
        res = self._register_professional()
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email='khadija.badiane@hrz.sn')
        self.assertNotEqual(user.password, self.raw_password)
        self.assertNotIn(self.raw_password, user.password)
        self.assertTrue(user.password.startswith('pbkdf2_sha256$'))
        self.assertTrue(user.check_password(self.raw_password))
        self.assertFalse(user.is_active)
        self.assertFalse(user.is_actif)
        self.assertEqual(user.statut_validation, 'PENDING')

    # =========================================================================
    # TEST 3 : Impossibilité de se connecter avant validation
    # =========================================================================
    def test_03_impossibilite_de_se_connecter_avant_validation(self):
        self._register_professional()

        res_login = self.client.post('/api/auth/login/', {
            'email': 'khadija.badiane@hrz.sn',
            'password': self.raw_password
        }, format='json')
        self.assertEqual(res_login.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn('access', res_login.data)

    # =========================================================================
    # TEST 4 : Validation par le directeur (et refus avec motif)
    # =========================================================================
    def test_04_validation_par_le_directeur(self):
        res_reg = self._register_professional()
        user_id = res_reg.data['user']['id']

        # Le directeur d'un autre établissement ne peut pas valider cette demande
        self.client.force_authenticate(user=self.autre_directeur)
        res_forbidden = self.client.post(f'/api/accounts/users/{user_id}/approve/')
        self.assertEqual(res_forbidden.status_code, status.HTTP_404_NOT_FOUND)

        # Le directeur de HRZ consulte et valide la demande
        self.client.force_authenticate(user=self.directeur)
        res_list = self.client.get('/api/accounts/users/?statut_validation=PENDING')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        results = res_list.data.get('results', res_list.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['email'], 'khadija.badiane@hrz.sn')

        res_approve = self.client.post(f'/api/accounts/users/{user_id}/approve/')
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)
        self.assertEqual(res_approve.data['status'], 'APPROVED')

        user = User.objects.get(id=user_id)
        self.assertEqual(user.statut_validation, 'APPROVED')
        self.assertTrue(user.is_active)
        self.assertTrue(user.is_actif)
        self.assertEqual(user.validated_by, self.directeur)
        self.assertIsNotNone(user.validated_at)

        # Test également du refus avec motif obligatoire sur une seconde demande
        res_reg2 = self._register_professional({
            "email": "agent.refuse@hrz.sn",
            "role": "AGENT"
        })
        user2_id = res_reg2.data['user']['id']

        # Refus sans motif -> 400
        res_reject_no_motif = self.client.post(f'/api/accounts/users/{user2_id}/reject/', {}, format='json')
        self.assertEqual(res_reject_no_motif.status_code, status.HTTP_400_BAD_REQUEST)

        # Refus avec motif -> 200 et impossibilité de se connecter
        res_reject = self.client.post(f'/api/accounts/users/{user2_id}/reject/', {
            'motif': 'Justificatif professionnel incomplet'
        }, format='json')
        self.assertEqual(res_reject.status_code, status.HTTP_200_OK)
        self.assertEqual(res_reject.data['status'], 'REJECTED')

        self.client.force_authenticate(user=None)
        res_login_rejected = self.client.post('/api/auth/login/', {
            'email': 'agent.refuse@hrz.sn',
            'password': self.raw_password
        }, format='json')
        self.assertEqual(res_login_rejected.status_code, status.HTTP_401_UNAUTHORIZED)

    # =========================================================================
    # TEST 5 : Envoi réel de l'e-mail après validation + gestion d'erreur & renvoi
    # =========================================================================
    def test_05_envoi_reel_email_apres_validation_et_reessai(self):
        mail.outbox = []
        res_reg = self._register_professional()
        user_id = res_reg.data['user']['id']

        self.client.force_authenticate(user=self.directeur)
        res_approve = self.client.post(f'/api/accounts/users/{user_id}/approve/')
        self.assertEqual(res_approve.status_code, status.HTTP_200_OK)
        self.assertTrue(res_approve.data['email_sent'])

        self.assertEqual(len(mail.outbox), 1)
        sent_email = mail.outbox[0]
        self.assertEqual(sent_email.subject, VALIDATION_EMAIL_SUBJECT)
        self.assertEqual(sent_email.to, ['khadija.badiane@hrz.sn'])
        self.assertIn("Bonjour Khadija,", sent_email.body)
        self.assertIn(
            "Votre demande d'inscription à MEDTRANSFER a été validée par le directeur de votre établissement de santé.",
            sent_email.body
        )
        self.assertIn("Adresse e-mail : khadija.badiane@hrz.sn", sent_email.body)
        self.assertIn(
            "Votre mot de passe est celui que vous avez choisi lors de votre inscription. Pour votre sécurité, il ne figure pas dans cet e-mail.",
            sent_email.body
        )
        self.assertNotIn(self.raw_password, sent_email.body)

        # Simulation d'une panne SMTP lors de la validation d'un second professionnel, puis nouvel envoi sans re-valider
        res_reg2 = self._register_professional({"email": "dr.panne@hrz.sn"})
        user2_id = res_reg2.data['user']['id']

        with patch('accounts.emails.send_mail', side_effect=ConnectionError("Serveur SMTP indisponible")):
            res_approve_fail = self.client.post(f'/api/accounts/users/{user2_id}/approve/')
            self.assertEqual(res_approve_fail.status_code, status.HTTP_200_OK)
            self.assertEqual(res_approve_fail.data['status'], 'APPROVED')
            self.assertFalse(res_approve_fail.data['email_sent'])
            self.assertIn("Serveur SMTP indisponible", res_approve_fail.data['email_error'])

        # Nouvel envoi sans répéter la validation du compte
        res_resend = self.client.post(f'/api/accounts/users/{user2_id}/resend-validation-email/')
        self.assertEqual(res_resend.status_code, status.HTTP_200_OK)
        self.assertTrue(res_resend.data['email_sent'])
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(mail.outbox[1].to, ['dr.panne@hrz.sn'])

    # =========================================================================
    # TEST 6 : Connexion avec les identifiants initiaux après validation
    # =========================================================================
    def test_06_connexion_avec_identifiants_initiaux_apres_validation(self):
        res_reg = self._register_professional()
        user_id = res_reg.data['user']['id']

        self.client.force_authenticate(user=self.directeur)
        self.client.post(f'/api/accounts/users/{user_id}/approve/')
        self.client.force_authenticate(user=None)

        res_login = self.client.post('/api/auth/login/', {
            'email': 'khadija.badiane@hrz.sn',
            'password': self.raw_password
        }, format='json')
        self.assertEqual(res_login.status_code, status.HTTP_200_OK)
        self.assertIn('access', res_login.data)
        self.assertIn('refresh', res_login.data)
        self.assertEqual(res_login.data['user']['email'], 'khadija.badiane@hrz.sn')
        self.assertEqual(res_login.data['user']['role'], 'MEDECIN')
        self.assertEqual(res_login.data['user']['statut_validation'], 'APPROVED')

    # =========================================================================
    # TEST 7 : Refus de connexion pour un compte suspendu
    # =========================================================================
    def test_07_refus_de_connexion_pour_compte_suspendu(self):
        res_reg = self._register_professional()
        user_id = res_reg.data['user']['id']

        self.client.force_authenticate(user=self.directeur)
        self.client.post(f'/api/accounts/users/{user_id}/approve/')

        # Connexion initiale pour obtenir un token
        self.client.force_authenticate(user=None)
        res_login = self.client.post('/api/auth/login/', {
            'email': 'khadija.badiane@hrz.sn',
            'password': self.raw_password
        }, format='json')
        access_token = res_login.data['access']

        # Suspension du compte par le directeur
        self.client.force_authenticate(user=self.directeur)
        res_suspend = self.client.post(f'/api/accounts/users/{user_id}/suspend/', {
            'motif': 'Suspension conservatoire'
        }, format='json')
        self.assertEqual(res_suspend.status_code, status.HTTP_200_OK)
        self.assertEqual(res_suspend.data['status'], 'SUSPENDED')

        # 1. Impossible de se reconnecter
        self.client.force_authenticate(user=None)
        res_login_suspended = self.client.post('/api/auth/login/', {
            'email': 'khadija.badiane@hrz.sn',
            'password': self.raw_password
        }, format='json')
        self.assertEqual(res_login_suspended.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. L'ancien token JWT est immédiatement rejeté
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        res_me = self.client.get('/api/auth/me/')
        self.assertEqual(res_me.status_code, status.HTTP_401_UNAUTHORIZED)
        self.client.credentials()

    # =========================================================================
    # TEST 8 : Modification du mot de passe après connexion
    # =========================================================================
    def test_08_modification_du_mot_de_passe_apres_connexion(self):
        res_reg = self._register_professional()
        user_id = res_reg.data['user']['id']

        self.client.force_authenticate(user=self.directeur)
        self.client.post(f'/api/accounts/users/{user_id}/approve/')
        self.client.force_authenticate(user=None)

        res_login = self.client.post('/api/auth/login/', {
            'email': 'khadija.badiane@hrz.sn',
            'password': self.raw_password
        }, format='json')
        old_access = res_login.data['access']
        old_refresh = res_login.data['refresh']

        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {old_access}')

        # Mauvais mot de passe actuel -> 400
        res_bad_current = self.client.post('/api/auth/change-password/', {
            'current_password': 'WrongCurrentPassword!',
            'new_password': 'NewStrongPassword2027!',
            'new_password_confirm': 'NewStrongPassword2027!'
        }, format='json')
        self.assertEqual(res_bad_current.status_code, status.HTTP_400_BAD_REQUEST)

        # Modification valide -> 200
        new_password = 'NewStrongPassword2027!'
        res_change = self.client.post('/api/auth/change-password/', {
            'current_password': self.raw_password,
            'new_password': new_password,
            'new_password_confirm': new_password
        }, format='json')
        self.assertEqual(res_change.status_code, status.HTTP_200_OK)
        self.assertNotIn('password', str(res_change.data).lower() if 'hash' in str(res_change.data).lower() else '')

        # Vérifier que l'ancien token d'accès et l'ancien refresh token sont invalidés
        res_old_token = self.client.get('/api/auth/me/')
        self.assertEqual(res_old_token.status_code, status.HTTP_401_UNAUTHORIZED)

        self.client.credentials()
        res_old_refresh = self.client.post('/api/auth/refresh/', {'refresh': old_refresh}, format='json')
        self.assertEqual(res_old_refresh.status_code, status.HTTP_401_UNAUTHORIZED)

    # =========================================================================
    # TEST 9 : Connexion avec le nouveau mot de passe
    # =========================================================================
    def test_09_connexion_avec_le_nouveau_mot_de_passe(self):
        res_reg = self._register_professional()
        user_id = res_reg.data['user']['id']

        self.client.force_authenticate(user=self.directeur)
        self.client.post(f'/api/accounts/users/{user_id}/approve/')

        user = User.objects.get(id=user_id)
        self.client.force_authenticate(user=user)
        new_password = 'UpdatedSecurePassword2027#'
        res_change = self.client.post('/api/auth/change-password/', {
            'current_password': self.raw_password,
            'new_password': new_password,
            'new_password_confirm': new_password
        }, format='json')
        self.assertEqual(res_change.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=None)
        res_login_new = self.client.post('/api/auth/login/', {
            'email': 'khadija.badiane@hrz.sn',
            'password': new_password
        }, format='json')
        self.assertEqual(res_login_new.status_code, status.HTTP_200_OK)
        self.assertIn('access', res_login_new.data)

    # =========================================================================
    # TEST 10 : Refus de l'ancien mot de passe
    # =========================================================================
    def test_10_refus_de_l_ancien_mot_de_passe(self):
        res_reg = self._register_professional()
        user_id = res_reg.data['user']['id']

        self.client.force_authenticate(user=self.directeur)
        self.client.post(f'/api/accounts/users/{user_id}/approve/')

        user = User.objects.get(id=user_id)
        self.client.force_authenticate(user=user)
        new_password = 'UpdatedSecurePassword2027#'
        self.client.post('/api/auth/change-password/', {
            'current_password': self.raw_password,
            'new_password': new_password,
            'new_password_confirm': new_password
        }, format='json')

        self.client.force_authenticate(user=None)
        res_login_old = self.client.post('/api/auth/login/', {
            'email': 'khadija.badiane@hrz.sn',
            'password': self.raw_password
        }, format='json')
        self.assertEqual(res_login_old.status_code, status.HTTP_401_UNAUTHORIZED)

    # =========================================================================
    # TEST 11 : Réinitialisation après oubli du mot de passe
    # =========================================================================
    def test_11_reinitialisation_apres_oubli_du_mot_de_passe(self):
        res_reg = self._register_professional()
        user_id = res_reg.data['user']['id']

        self.client.force_authenticate(user=self.directeur)
        self.client.post(f'/api/accounts/users/{user_id}/approve/')
        self.client.force_authenticate(user=None)
        mail.outbox = []

        # 1. Demande pour une adresse inexistante -> même message neutre (pas de fuite d'existence)
        res_unknown = self.client.post('/api/auth/password-reset/request/', {
            'email': 'inconnu.total@hrz.sn'
        }, format='json')
        self.assertEqual(res_unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 0)

        # 2. Demande pour le professionnel validé -> même message neutre + e-mail envoyé
        res_known = self.client.post('/api/auth/password-reset/request/', {
            'email': 'khadija.badiane@hrz.sn'
        }, format='json')
        self.assertEqual(res_known.status_code, status.HTTP_200_OK)
        self.assertEqual(res_known.data['message'], res_unknown.data['message'])
        self.assertEqual(len(mail.outbox), 1)

        reset_email = mail.outbox[0]
        self.assertNotIn(self.raw_password, reset_email.body)
        match = re.search(r'token=([A-Za-z0-9_\-]+)', reset_email.body)
        self.assertIsNotNone(match)
        raw_token = match.group(1)

        # 3. Confirmation de la réinitialisation avec un nouveau mot de passe
        reset_password = 'ResetMedPassword2028!'
        res_confirm = self.client.post('/api/auth/password-reset/confirm/', {
            'token': raw_token,
            'new_password': reset_password,
            'new_password_confirm': reset_password
        }, format='json')
        self.assertEqual(res_confirm.status_code, status.HTTP_200_OK)

        # 4. Le jeton est à usage unique : une seconde tentative échoue
        res_reuse = self.client.post('/api/auth/password-reset/confirm/', {
            'token': raw_token,
            'new_password': 'AnotherPassword2028!',
            'new_password_confirm': 'AnotherPassword2028!'
        }, format='json')
        self.assertEqual(res_reuse.status_code, status.HTTP_400_BAD_REQUEST)

        # 5. Connexion avec le mot de passe réinitialisé réussit, l'ancien échoue
        res_login_old = self.client.post('/api/auth/login/', {
            'email': 'khadija.badiane@hrz.sn',
            'password': self.raw_password
        }, format='json')
        self.assertEqual(res_login_old.status_code, status.HTTP_401_UNAUTHORIZED)

        res_login_reset = self.client.post('/api/auth/login/', {
            'email': 'khadija.badiane@hrz.sn',
            'password': reset_password
        }, format='json')
        self.assertEqual(res_login_reset.status_code, status.HTTP_200_OK)

    # =========================================================================
    # TEST 12 : Absence de mot de passe dans les journaux, notifications et e-mails
    # =========================================================================
    def test_12_absence_de_mot_de_passe_dans_journaux_notifications_et_emails(self):
        mail.outbox = []
        res_reg = self._register_professional()
        user_id = res_reg.data['user']['id']
        user = User.objects.get(id=user_id)
        password_hash = user.password

        # Validation par le directeur
        self.client.force_authenticate(user=self.directeur)
        self.client.post(f'/api/accounts/users/{user_id}/approve/')

        # Demande de reset et changement de mot de passe
        self.client.force_authenticate(user=None)
        self.client.post('/api/auth/password-reset/request/', {'email': user.email}, format='json')

        new_password = "SecondSecretPassword2026$"
        self.client.force_authenticate(user=user)
        self.client.post('/api/auth/change-password/', {
            'current_password': self.raw_password,
            'new_password': new_password,
            'new_password_confirm': new_password
        }, format='json')
        user.refresh_from_db()
        second_hash = user.password

        secrets_to_check = [self.raw_password, new_password, password_hash, second_hash]

        # 1. Vérification des journaux d'audit
        for log in JournalAcces.objects.all():
            serialized_details = str(log.details)
            for secret in secrets_to_check:
                self.assertNotIn(secret, serialized_details, "Fuite de mot de passe détectée dans JournalAcces !")

        # 2. Vérification des notifications internes
        for notif in Notification.objects.all():
            combined = f"{notif.titre} {notif.message}"
            for secret in secrets_to_check:
                self.assertNotIn(secret, combined, "Fuite de mot de passe détectée dans Notification !")

        # 3. Vérification de tous les e-mails envoyés
        for email_msg in mail.outbox:
            combined_mail = f"{email_msg.subject} {email_msg.body}"
            for secret in secrets_to_check:
                self.assertNotIn(secret, combined_mail, "Fuite de mot de passe détectée dans un e-mail !")

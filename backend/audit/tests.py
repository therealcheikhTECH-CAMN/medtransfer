from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from audit.models import JournalAcces
from establishments.models import Etablissement

User = get_user_model()


class EmailActionAuditAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.etablissement = Etablissement.objects.create(
            nom="Hôpital Régional de Ziguinchor",
            code="HRZ-01",
            type_etablissement="CENTRE_HOSPITALIER_REGIONAL",
            region="Ziguinchor",
            ville="Ziguinchor",
            email="direction@hrz.sn",
            is_active=True,
        )
        self.doctor = User.objects.create_user(
            username="dr_sow",
            email="dr.sow@hrz.sn",
            password="Password123!",
            first_name="Abdou",
            last_name="Sow",
            role="MEDECIN",
            etablissement=self.etablissement,
            statut_validation="APPROVED",
            is_active=True,
        )
        self.agent = User.objects.create_user(
            username="agent_diallo",
            email="agent.diallo@hrz.sn",
            password="Password123!",
            first_name="Fatou",
            last_name="Diallo",
            role="AGENT",
            etablissement=self.etablissement,
            statut_validation="APPROVED",
            is_active=True,
        )
        self.director = User.objects.create_user(
            username="dir_diop",
            email="dir.diop@hrz.sn",
            password="Password123!",
            first_name="Moussa",
            last_name="Diop",
            role="DIRECTEUR",
            etablissement=self.etablissement,
            statut_validation="APPROVED",
            is_active=True,
        )
        self.admin = User.objects.create_superuser(
            username="admin_gen",
            email="admin@medtransfer.sn",
            password="AdminPassword123!",
            role="ADMIN",
        )

    def test_unauthenticated_user_cannot_log_email_action(self):
        url = "/api/audit/email-action/"
        response = self.client.post(url, {
            "action": "EMAIL_COMPOSER_OPENED",
            "context": {"recipient_email": "test@hrz.sn"}
        }, format="json")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(JournalAcces.objects.filter(action="EMAIL_COMPOSER_OPENED").count(), 0)

    def test_inactive_user_cannot_log_email_action(self):
        self.doctor.is_active = False
        self.doctor.save()
        self.client.force_authenticate(user=self.doctor)

        url = "/api/audit/email-action/"
        response = self.client.post(url, {
            "action": "EMAIL_COMPOSER_OPENED",
            "context": {"recipient_email": "test@hrz.sn"}
        }, format="json")
        self.assertEqual(response.status_code, 403)

    def test_invalid_action_type_rejected(self):
        self.client.force_authenticate(user=self.doctor)
        url = "/api/audit/email-action/"
        response = self.client.post(url, {
            "action": "FORBIDDEN_HACK_ACTION",
            "context": {"recipient_email": "test@hrz.sn"}
        }, format="json")
        self.assertEqual(response.status_code, 400)

    def test_doctor_can_log_email_action(self):
        self.client.force_authenticate(user=self.doctor)
        url = "/api/audit/email-action/"
        payload = {
            "action": "EMAIL_COMPOSER_OPENED",
            "context": {
                "recipient_email": "reception@hopital.sn",
                "template_key": "TRANSFER_COORDINATION",
                "module": "TRANSFER",
                "entity_type": "transfer",
                "entity_id": "42",
            }
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data.get("status"), "logged")

        log = JournalAcces.objects.filter(action="EMAIL_COMPOSER_OPENED", utilisateur=self.doctor).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.etablissement, self.etablissement)
        self.assertEqual(log.details.get("recipient_email"), "reception@hopital.sn")
        self.assertEqual(log.details.get("template_key"), "TRANSFER_COORDINATION")

    def test_message_body_and_clinical_data_never_stored(self):
        self.client.force_authenticate(user=self.doctor)
        url = "/api/audit/email-action/"
        malicious_payload = {
            "action": "EMAIL_CLIENT_OPEN_REQUESTED",
            "context": {
                "recipient_email": "reception@hopital.sn",
                "template_key": "TRANSFER_COORDINATION",
                "module": "TRANSFER",
                "body": "Patient présentant un traumatisme crânien sévère, traitement par mannitol...",
                "diagnostic": "Traumatisme crânien",
                "notes_confidentielles": "Secret médical à ne jamais enregistrer",
            }
        }
        response = self.client.post(url, malicious_payload, format="json")
        self.assertEqual(response.status_code, 200)

        log = JournalAcces.objects.filter(action="EMAIL_CLIENT_OPEN_REQUESTED", utilisateur=self.doctor).first()
        self.assertIsNotNone(log)
        # Vérification formelle : aucune clé body, diagnostic ou notes confidentielles dans les détails
        self.assertNotIn("body", log.details)
        self.assertNotIn("diagnostic", log.details)
        self.assertNotIn("notes_confidentielles", log.details)
        self.assertNotIn("traumatisme", str(log.details).lower())

    def test_crlf_injection_is_stripped(self):
        self.client.force_authenticate(user=self.agent)
        url = "/api/audit/email-action/"
        payload = {
            "action": "EMAIL_CONTENT_COPIED",
            "context": {
                "recipient_email": "dest@hopital.sn\r\nBcc: evil@hacker.com\nSubject: Injected",
                "template_key": "TRANSFER_LOGISTICS\r\nInjected",
            }
        }
        response = self.client.post(url, payload, format="json")
        self.assertEqual(response.status_code, 200)

        log = JournalAcces.objects.filter(action="EMAIL_CONTENT_COPIED", utilisateur=self.agent).first()
        self.assertIsNotNone(log)
        self.assertNotIn("\r", log.details["recipient_email"])
        self.assertNotIn("\n", log.details["recipient_email"])
        self.assertNotIn("\r", log.details["template_key"])
        self.assertNotIn("\n", log.details["template_key"])

    def test_all_four_roles_can_record_authorized_email_events(self):
        roles = [
            (self.admin, "EMAIL_COMPOSER_OPENED"),
            (self.director, "EMAIL_CLIENT_OPEN_REQUESTED"),
            (self.doctor, "EMAIL_CONTENT_COPIED"),
            (self.agent, "EMAIL_COMPOSER_OPENED"),
        ]
        url = "/api/audit/email-action/"
        for user, action in roles:
            self.client.force_authenticate(user=user)
            resp = self.client.post(url, {"action": action, "context": {}}, format="json")
            self.assertEqual(resp.status_code, 200, f"Role {user.role} failed to post action {action}")

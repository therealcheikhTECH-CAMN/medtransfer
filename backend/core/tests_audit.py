from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from establishments.models import Etablissement
from accounts.models import User
from patients.models import Patient
from medical_records.models import DossierMedical
from consultations.models import Consultation, ConsultationRevision
from care_management.models import PriseEnCharge, Transfert
from ai_assistant.models import SyntheseIA
from notifications.models import Notification

class FinalAuditVerificationTests(TestCase):
    """
    Validation complète des scénarios d'audit :
    - JWT Auth & Refresh
    - Permissions par profil (Admin, Agent, Médecin)
    - Refus d'un transfert
    - Rejet d'une synthèse IA
    - Clôture d'une prise en charge
    - Marquage d'une notification comme lue
    - Consultation des révisions médicales
    - Gestion des établissements et utilisateurs
    - Annuaire d'orientation
    """

    def setUp(self):
        # 1. Établissements
        self.etab_a = Etablissement.objects.create(
            nom="Hôpital Régional de Ziguinchor",
            code="HRZ",
            type_etablissement="CENTRE_HOSPITALIER_REGIONAL",
            region="Ziguinchor",
            ville="Ziguinchor",
            telephone="+221339910001",
            email="contact@hrz.sn",
            services_declares="Urgences, Médecine Interne, Chirurgie"
        )
        self.etab_b = Etablissement.objects.create(
            nom="Centre Hospitalier Universitaire de Fann",
            code="FANN",
            type_etablissement="HOPITAL_NATIONAL",
            region="Dakar",
            ville="Dakar",
            telephone="+221338691818",
            email="contact@fann.sn",
            services_declares="Neurologie, Neurochirurgie, Réanimation"
        )

        # 2. Utilisateurs
        self.admin = User.objects.create_user(
            username="admin_test", password="Password123!",
            role="ADMIN", etablissement=self.etab_a,
            first_name="Admin", last_name="Sys"
        )
        self.agent = User.objects.create_user(
            username="agent_test", password="Password123!",
            role="AGENT", etablissement=self.etab_a,
            first_name="Amina", last_name="Agent"
        )
        self.doctor_a = User.objects.create_user(
            username="doctor_a_test", password="Password123!",
            role="MEDECIN", etablissement=self.etab_a,
            specialite="Médecine Interne", matricule_professionnel="SN-TEST-001",
            first_name="Dr A", last_name="Med"
        )
        self.doctor_b = User.objects.create_user(
            username="doctor_b_test", password="Password123!",
            role="MEDECIN", etablissement=self.etab_b,
            specialite="Neurologie", matricule_professionnel="SN-TEST-002",
            first_name="Dr B", last_name="Med"
        )

        # 3. Patient et dossier
        self.patient = Patient.objects.create(
            nom="DIOP",
            prenom="Moussa",
            sexe="M",
            date_naissance="1984-06-15",
            status_identite="CONFIRMEE",
            groupe_sanguin="O+",
            etablissement_creation=self.etab_a,
            cree_par=self.agent
        )
        self.dossier = DossierMedical.objects.create(
            patient=self.patient,
            remarques_importantes="Allergie documentée à la pénicilline"
        )

        self.client = APIClient()

    def test_01_jwt_auth_and_token_refresh(self):
        """Vérifie l'obtention et le rafraîchissement d'un token JWT"""
        res = self.client.post('/api/auth/login/', {
            'username': 'doctor_a_test',
            'password': 'Password123!'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('access', res.data)
        self.assertIn('refresh', res.data)
        self.assertEqual(res.data['user']['role'], 'MEDECIN')

        # Refresh
        refresh_token = res.data['refresh']
        res_refresh = self.client.post('/api/auth/refresh/', {
            'refresh': refresh_token
        })
        self.assertEqual(res_refresh.status_code, status.HTTP_200_OK)
        self.assertIn('access', res_refresh.data)

    def test_02_refusal_of_transfer(self):
        """Vérifie le workflow complet de refus d'un transfert avec motif"""
        pec = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etab_a,
            medecin_responsable=self.doctor_a,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF'
        )
        transfert = Transfert.objects.create(
            patient=self.patient,
            prise_en_charge_origine=pec,
            etablissement_origine=self.etab_a,
            etablissement_destination=self.etab_b,
            medecin_emetteur=self.doctor_a,
            motif_transfert="Nécessité d'une IRM cérébrale 3T urgente",
            resume_clinique="Patient de 42 ans présentant des céphalées fébriles",
            priorite="URGENTE",
            statut="DEMANDE"
        )

        self.client.force_authenticate(user=self.doctor_b)
        url = f'/api/transfers/{transfert.id}/reject/'
        res = self.client.post(url, {
            'motif': "Capacité de réanimation saturée ce jour à Fann"
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        transfert.refresh_from_db()
        self.assertEqual(transfert.statut, 'REFUSE')
        self.assertEqual(transfert.medecin_receveur, self.doctor_b)
        self.assertIn("saturée", transfert.motif_reponse)

        # Notification générée pour le médecin demandeur
        notif = Notification.objects.filter(destinataire=self.doctor_a).first()
        self.assertIsNotNone(notif)
        self.assertIn("refusé", notif.titre.lower())

    def test_03_rejection_of_ai_summary(self):
        """Vérifie le rejet motivé d'une synthèse générée par l'IA"""
        PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etab_a,
            medecin_responsable=self.doctor_a,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF'
        )
        synthese = SyntheseIA.objects.create(
            patient=self.patient,
            medecin_demandeur=self.doctor_a,
            motif_consultation_soumis="Bilan annuel",
            synthese_globale="Synthèse préliminaire...",
            statut="EN_ATTENTE"
        )
        self.client.force_authenticate(user=self.doctor_a)
        url = f'/api/ai/summaries/{synthese.id}/reject/'
        res = self.client.post(url, {
            'motif': "Omission des antécédents d'ulcère gastrique signalés"
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        synthese.refresh_from_db()
        self.assertEqual(synthese.statut, 'REJETEE')
        self.assertIn("ulcère gastrique", synthese.motif_decision)

    def test_04_closing_care_management(self):
        """Vérifie la clôture formelle d'une prise en charge active"""
        pec = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etab_a,
            medecin_responsable=self.doctor_a,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF'
        )
        self.client.force_authenticate(user=self.doctor_a)
        url = f'/api/care-management/{pec.id}/close/'
        res = self.client.post(url, {
            'motif': 'Guerison complete et sortie autorisee'
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        pec.refresh_from_db()
        self.assertEqual(pec.statut, 'CLOTURE')
        self.assertIsNotNone(pec.date_fin)
        self.assertIn('Guerison', pec.motif_cloture)

    def test_05_notifications_mark_read_and_mark_all(self):
        """Vérifie le marquage unitaire et global des notifications internes"""
        n1 = Notification.objects.create(
            destinataire=self.doctor_a,
            titre="Test Notif 1",
            message="Contenu notif 1",
            is_read=False
        )
        n2 = Notification.objects.create(
            destinataire=self.doctor_a,
            titre="Test Notif 2",
            message="Contenu notif 2",
            is_read=False
        )
        self.client.force_authenticate(user=self.doctor_a)

        # 1. Marquer unitaire
        res1 = self.client.post(f'/api/notifications/{n1.id}/mark-read/')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        n1.refresh_from_db()
        self.assertTrue(n1.is_read)

        # 2. Marquer toutes comme lues
        res_all = self.client.post('/api/notifications/mark-all-read/')
        self.assertEqual(res_all.status_code, status.HTTP_200_OK)
        n2.refresh_from_db()
        self.assertTrue(n2.is_read)

    def test_06_medical_revisions_consultation(self):
        """Vérifie l'historique d'audit des modifications de consultations (rectifications tracées)"""
        PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etab_a,
            medecin_responsable=self.doctor_a,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF'
        )
        consult = Consultation.objects.create(
            dossier=self.dossier,
            etablissement=self.etab_a,
            medecin=self.doctor_a,
            motif="Céphalées modérées",
            diagnostic="Céphalée de tension",
            prescription="Paracétamol 1g",
            observations_cliniques="Patient conscient et orienté"
        )
        # Rectification
        ConsultationRevision.objects.create(
            consultation=consult,
            auteur_modification=self.doctor_a,
            motif_modification="Correction posologie et ajout surveillance TA",
            anciennes_valeurs={
                "diagnostic": "Céphalée de tension",
                "prescription": "Paracétamol 1g"
            }
        )
        consult.diagnostic = "Céphalée hypertensive"
        consult.prescription = "Amlodipine 5mg + Paracétamol"
        consult.is_amended = True
        consult.save()

        self.client.force_authenticate(user=self.doctor_a)
        res = self.client.get(f'/api/consultations/{consult.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('revisions', res.data)
        self.assertEqual(len(res.data['revisions']), 1)
        self.assertEqual(
            res.data['revisions'][0]['motif_modification'],
            "Correction posologie et ajout surveillance TA"
        )

    def test_07_establishments_and_users_management_permissions(self):
        """Vérifie les permissions d'administration et de gestion des établissements"""
        # Admin peut créer un établissement
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.post('/api/establishments/', {
            'nom': 'Centre de Santé de Bignona',
            'code': 'CSB-01',
            'type_etablissement': 'CENTRE_DE_SANTE',
            'region': 'Ziguinchor',
            'ville': 'Bignona',
            'services_declares': 'Urgences, Maternité'
        }, format='json')
        self.assertEqual(res_admin.status_code, status.HTTP_201_CREATED)

        # Agent ou Médecin ne peuvent PAS créer un établissement
        self.client.force_authenticate(user=self.agent)
        res_agent = self.client.post('/api/establishments/', {'nom': 'Tentative Non Autorisée'}, format='json')
        self.assertEqual(res_agent.status_code, status.HTTP_403_FORBIDDEN)

        # Annuaire d'orientation accessible en lecture à tous
        self.client.force_authenticate(user=self.doctor_a)
        res_dir = self.client.get('/api/establishments/directory/')
        self.assertEqual(res_dir.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res_dir.data) >= 2)

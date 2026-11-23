from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from accounts.models import User
from establishments.models import Etablissement
from patients.models import Patient
from medical_records.models import DossierMedical
from consultations.models import Consultation
from care_management.models import PriseEnCharge, Transfert
from audit.models import JournalAcces


class ApiScenariosTestCase(APITestCase):
    """
    Validation automatisée rigoureuse des 7 scénarios imposés par le cahier des charges de MEDTRANSFER.
    """

    def setUp(self):
        # 1. Établissements
        self.hopital_a = Etablissement.objects.create(
            code="HRZ", nom="Hôpital Régional de Ziguinchor", ville="Ziguinchor", region="Ziguinchor"
        )
        self.hopital_b = Etablissement.objects.create(
            code="CHU-FANN", nom="Centre Hospitalier Universitaire de Fann", ville="Dakar", region="Dakar"
        )

        # 2. Utilisateurs
        self.admin = User.objects.create_superuser(
            username="admin_sys", password="Password123!", role="ADMIN", first_name="Admin", last_name="System"
        )
        self.agent_a = User.objects.create_user(
            username="agent_a", password="Password123!", role="AGENT", etablissement=self.hopital_a,
            first_name="Fatou", last_name="Agent"
        )
        self.agent_b = User.objects.create_user(
            username="agent_b", password="Password123!", role="AGENT", etablissement=self.hopital_b,
            first_name="Moussa", last_name="AgentB"
        )
        self.medecin_a = User.objects.create_user(
            username="dr_a", password="Password123!", role="MEDECIN", etablissement=self.hopital_a,
            first_name="Mamadou", last_name="Diallo", specialite="Médecine générale"
        )
        self.medecin_b = User.objects.create_user(
            username="dr_b", password="Password123!", role="MEDECIN", etablissement=self.hopital_b,
            first_name="Aïssatou", last_name="Sow", specialite="Neurologie"
        )

    # =========================================================================
    # SCÉNARIO 1 : Recherche sans duplication entre hôpitaux
    # =========================================================================
    def test_scenario_1_patient_retrouve_sans_duplication(self):
        # L'agent de l'Hôpital A enregistre le patient
        self.client.force_authenticate(user=self.agent_a)
        res_create = self.client.post('/api/patients/', {
            'nom': 'Ndiaye',
            'prenom': 'Abdoulaye',
            'date_naissance': '1990-01-15',
            'sexe': 'M',
            'numero_identification_nationale': '1990199000111',
            'telephone': '+221770001122',
            'ville': 'Ziguinchor'
        })
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        medtransfer_id = res_create.data['medtransfer_id']
        patient_id = res_create.data['id']

        # Le patient se présente ensuite à l'Hôpital B (Dakar)
        # L'agent B effectue une recherche par son NIN ou son Identifiant MedTransfer
        self.client.force_authenticate(user=self.agent_b)
        res_search = self.client.get(f'/api/patients/?q={medtransfer_id}')
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        results = res_search.data['results'] if 'results' in res_search.data else res_search.data
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], patient_id)
        self.assertEqual(results[0]['nom'], 'Ndiaye')

        # Vérification qu'il n'existe qu'un seul patient en base
        self.assertEqual(Patient.objects.filter(numero_identification_nationale='1990199000111').count(), 1)

    # =========================================================================
    # SCÉNARIO 2 : Consultation enregistrée à A, retrouvée par médecin de B
    # =========================================================================
    def test_scenario_2_consultation_cumulative_visible_inter_etablissements(self):
        # Création initiale du patient et ouverture de la prise en charge à A
        patient = Patient.objects.create(
            nom="Diop", prenom="Khady", date_naissance="1982-06-20", sexe="F",
            etablissement_creation=self.hopital_a, cree_par=self.agent_a
        )
        dossier = DossierMedical.objects.create(patient=patient)
        pec_a = PriseEnCharge.objects.create(
            patient=patient, etablissement=self.hopital_a, medecin_responsable=self.medecin_a,
            type_prise_en_charge='ORDINAIRE', statut='ACTIF'
        )

        # Le Dr A (Ziguinchor) enregistre une consultation dans le cadre de sa prise en charge
        self.client.force_authenticate(user=self.medecin_a)
        res_c1 = self.client.post('/api/consultations/', {
            'patient_id': patient.id,
            'motif': 'Douleurs abdominales chroniques',
            'observations_cliniques': 'Palpation douloureuse fosse iliaque droite',
            'diagnostic': 'Suspicion d\'appendicite subaiguë',
            'prescription': 'Antispasmodiques, bilan biologique et échographie'
        })
        self.assertEqual(res_c1.status_code, status.HTTP_201_CREATED)

        # Transfert formel de A vers B (ou ouverture d'autorisation) pour permettre à Dr B d'accéder au dossier
        pec_a.cloturer(motif="Orientation vers CHU Fann")
        PriseEnCharge.objects.create(
            patient=patient, etablissement=self.hopital_b, medecin_responsable=self.medecin_b,
            type_prise_en_charge='ORDINAIRE', statut='ACTIF'
        )

        # Le Dr B (CHU Fann, Dakar) ouvre le dossier du patient désormais sous sa responsabilité
        self.client.force_authenticate(user=self.medecin_b)
        res_dossier = self.client.get(f'/api/medical-records/by-patient/{patient.id}/')
        self.assertEqual(res_dossier.status_code, status.HTTP_200_OK)

        consultations = res_dossier.data['consultations']
        self.assertEqual(len(consultations), 1)
        self.assertEqual(consultations[0]['diagnostic'], "Suspicion d'appendicite subaiguë")
        self.assertEqual(consultations[0]['etablissement_code'], "HRZ")

    # =========================================================================
    # SCÉNARIO 3 : Transfert formel de A vers B avec workflow d'acceptation
    # =========================================================================
    def test_scenario_3_transfert_inter_etablissements(self):
        patient = Patient.objects.create(
            nom="Ba", prenom="Oumar", date_naissance="1975-02-10", sexe="M",
            etablissement_creation=self.hopital_a, cree_par=self.agent_a
        )
        pec_a = PriseEnCharge.objects.create(
            patient=patient, etablissement=self.hopital_a, medecin_responsable=self.medecin_a,
            type_prise_en_charge='ORDINAIRE', statut='ACTIF'
        )

        # 1. Dr A initie un transfert vers l'Hôpital B
        self.client.force_authenticate(user=self.medecin_a)
        res_trans = self.client.post('/api/transfers/', {
            'patient_id': patient.id,
            'etablissement_destination_id': self.hopital_b.id,
            'priorite': 'HAUTE',
            'motif_transfert': 'Prise en charge spécialisée neuro-vasculaire',
            'resume_clinique': 'AVC ischémique avec déficit hémicorporel gauche'
        })
        self.assertEqual(res_trans.status_code, status.HTTP_201_CREATED)
        transfert_id = res_trans.data['id']

        # 2. Dr B (CHU Fann) accepte le transfert
        self.client.force_authenticate(user=self.medecin_b)
        res_accept = self.client.post(f'/api/transfers/{transfert_id}/accept/', {
            'motif': 'Place réservée en unité neurovasculaire'
        })
        self.assertEqual(res_accept.status_code, status.HTTP_200_OK)

        # Vérification des statuts
        pec_a.refresh_from_db()
        self.assertEqual(pec_a.statut, 'TRANSFERE')

        # Vérification qu'une nouvelle prise en charge est active à l'Hôpital B
        pec_b = PriseEnCharge.objects.get(patient=patient, statut='ACTIF')
        self.assertEqual(pec_b.etablissement, self.hopital_b)
        self.assertEqual(pec_b.medecin_responsable, self.medecin_b)

        # Unicité stricte garantie
        self.assertEqual(PriseEnCharge.objects.filter(patient=patient, statut='ACTIF').count(), 1)

    # =========================================================================
    # SCÉNARIO 4 : Urgence à B sans transfert automatique ni clôture de A
    # =========================================================================
    def test_scenario_4_urgence_sans_cloture_ni_transfert_automatique(self):
        patient = Patient.objects.create(
            nom="Sow", prenom="Demba", date_naissance="1995-12-04", sexe="M",
            etablissement_creation=self.hopital_a, cree_par=self.agent_a
        )
        dossier = DossierMedical.objects.create(patient=patient)
        pec_a = PriseEnCharge.objects.create(
            patient=patient, etablissement=self.hopital_a, medecin_responsable=self.medecin_a,
            type_prise_en_charge='ORDINAIRE', statut='ACTIF'
        )

        # Dr B enregistre une intervention d'urgence dérogatoire
        self.client.force_authenticate(user=self.medecin_b)
        res_urg = self.client.post('/api/emergencies/', {
            'patient_id': patient.id,
            'motif_urgence': 'Crise d\'asthme aiguë grave',
            'justification_acces_derogatoire': 'Détresse respiratoire aiguë en déplacement à Dakar',
            'observations_cliniques': 'Polypnée superficielle à 32/min, sibilants diffus',
            'diagnostic': 'Asthme aigu grave',
            'prescription': 'Nébulisation Salbutamol + Ipratropium, Corticothérapie IV'
        })
        self.assertEqual(res_urg.status_code, status.HTTP_201_CREATED)

        # Vérifications fondamentales du cahier des charges :
        pec_a.refresh_from_db()
        self.assertEqual(pec_a.statut, 'ACTIF', "La prise en charge à Ziguinchor NE DOIT PAS être clôturée")
        self.assertEqual(
            PriseEnCharge.objects.filter(patient=patient, etablissement=self.hopital_b, statut='ACTIF').count(),
            0, "Aucune prise en charge ordinaire NE DOIT être ouverte automatiquement à B"
        )
        self.assertEqual(DossierMedical.objects.filter(patient=patient).count(), 1, "Le dossier médical reste UNIQUE")

    # =========================================================================
    # SCÉNARIO 5 : Synthèse IA générée puis validée par le praticien
    # =========================================================================
    def test_scenario_5_synthese_ia_generation_et_validation(self):
        patient = Patient.objects.create(
            nom="Diallo", prenom="Aminata", date_naissance="1980-04-10", sexe="F",
            etablissement_creation=self.hopital_a, cree_par=self.agent_a
        )
        DossierMedical.objects.create(patient=patient)
        PriseEnCharge.objects.create(
            patient=patient, etablissement=self.hopital_a, medecin_responsable=self.medecin_a,
            type_prise_en_charge='ORDINAIRE', statut='ACTIF'
        )

        self.client.force_authenticate(user=self.medecin_a)
        # 1. Génération de la synthèse
        res_gen = self.client.post('/api/ai/summaries/generate/', {
            'patient_id': patient.id,
            'motif_consultation': 'Bilan annuel d\'évaluation cardiovasculaire'
        })
        self.assertEqual(res_gen.status_code, status.HTTP_201_CREATED)
        synthese_id = res_gen.data['id']
        self.assertEqual(res_gen.data['statut'], 'EN_ATTENTE')
        self.assertIn("intelligence artificielle", res_gen.data['avertissement_legal'])

        # 2. Validation par le médecin
        res_val = self.client.post(f'/api/ai/summaries/{synthese_id}/validate/', {
            'texte_final': 'Synthèse validée avec recommandation d\'ECG d\'effort.',
            'motif': 'Revue médicale conforme aux antécédents documentés'
        })
        self.assertEqual(res_val.status_code, status.HTTP_200_OK)
        self.assertEqual(res_val.data['statut'], 'VALIDEE')
        self.assertEqual(res_val.data['medecin_decisionnaire_nom'], f"Dr {self.medecin_a.last_name}")

    # =========================================================================
    # SCÉNARIO 6 : Un agent tente d'enregistrer une consultation -> 403 FORBIDDEN
    # =========================================================================
    def test_scenario_6_agent_interdit_de_modifier_diagnostic(self):
        patient = Patient.objects.create(
            nom="Coly", prenom="Lamine", date_naissance="1992-08-14", sexe="M",
            etablissement_creation=self.hopital_a, cree_par=self.agent_a
        )
        DossierMedical.objects.create(patient=patient)

        # L'agent tente d'appeler l'API de consultation pour poser un diagnostic
        self.client.force_authenticate(user=self.agent_a)
        res = self.client.post('/api/consultations/', {
            'patient_id': patient.id,
            'motif': 'Tentative frauduleuse',
            'observations_cliniques': 'Examen clinique',
            'diagnostic': 'Diagnostic illégal par un agent'
        })

        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        # Vérification de l'enregistrement de l'alerte d'audit
        self.assertTrue(JournalAcces.objects.filter(action='PERMISSION_DENIED', utilisateur=self.agent_a).exists())

    # =========================================================================
    # SCÉNARIO 7 : Utilisateur non médecin tente d'accéder au dossier clinique -> 403
    # =========================================================================
    def test_scenario_7_non_medecin_acces_refuse_dossier_clinique(self):
        patient = Patient.objects.create(
            nom="Faye", prenom="Fatou", date_naissance="1987-03-25", sexe="F",
            etablissement_creation=self.hopital_a, cree_par=self.agent_a
        )
        DossierMedical.objects.create(patient=patient)

        # L'administrateur technique tente d'accéder directement au dossier clinique
        self.client.force_authenticate(user=self.admin)
        res_admin = self.client.get(f'/api/medical-records/by-patient/{patient.id}/')
        self.assertEqual(res_admin.status_code, status.HTTP_403_FORBIDDEN)

        # L'agent d'accueil tente d'accéder directement au dossier clinique
        self.client.force_authenticate(user=self.agent_a)
        res_agent = self.client.get(f'/api/medical-records/by-patient/{patient.id}/')
        self.assertEqual(res_agent.status_code, status.HTTP_403_FORBIDDEN)

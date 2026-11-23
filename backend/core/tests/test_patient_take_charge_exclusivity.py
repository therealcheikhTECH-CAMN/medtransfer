from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from accounts.models import User
from establishments.models import Etablissement
from patients.models import Patient
from medical_records.models import DossierMedical
from consultations.models import Consultation
from care_management.models import PriseEnCharge, Transfert
from emergencies.models import AutorisationUrgence
from audit.models import JournalAcces


class PatientTakeChargeExclusivityTestCase(APITestCase):
    """
    Tests exhaustifs de la refonte du système de prise en charge et de la règle d'exclusivité médicale.
    Couvre les 15 scénarios obligatoires du prompt :
    1. Un médecin peut prendre en charge un patient disponible.
    2. La prise en charge est associée au bon médecin authentifié.
    3. Un deuxième médecin ne peut pas prendre le même patient en charge.
    4. Le bouton est désactivé lorsque le patient est déjà pris en charge (vérification flags API).
    5. Le backend bloque une tentative directe de double prise en charge.
    6. Deux médecins qui prennent le même patient ne peuvent pas créer deux PEC actives.
    7. Un médecin ne peut pas clôturer la prise en charge d'un autre médecin.
    8. Le médecin responsable peut clôturer sa propre prise en charge.
    9. Après clôture, le patient redevient disponible.
    10. Le patient apparaît dans « Mes prises en charge » du médecin responsable.
    11. Le patient n'apparaît pas dans « Mes prises en charge » des autres médecins.
    12. Les accès d'urgence continuent de fonctionner.
    13. Un accès d'urgence ne modifie pas automatiquement le médecin responsable.
    14. Les transferts continuent de respecter les permissions existantes.
    15. L'historique médical est conservé après clôture.
    """

    def setUp(self):
        # Établissement A (Dakar)
        self.etab_a = Etablissement.objects.create(
            code="DAK-ALPHA",
            nom="Hôpital Alpha Dakar",
            ville="Dakar",
            region="Dakar",
            is_active=True,
        )

        # Établissement B (Thiès)
        self.etab_b = Etablissement.objects.create(
            code="THIES-BETA",
            nom="Hôpital Bêta Thiès",
            ville="Thiès",
            region="Thiès",
            is_active=True,
        )

        # Médecin 1 (Dr Diop, Hôpital A)
        self.medecin_1 = User.objects.create_user(
            username="dr_diop",
            password="Password123!",
            role="MEDECIN",
            first_name="Amadou",
            last_name="Diop",
            etablissement=self.etab_a,
            matricule_professionnel="ORD-101",
            statut_validation="APPROVED",
            is_actif=True,
        )

        # Médecin 2 (Dr Fall, Hôpital A)
        self.medecin_2 = User.objects.create_user(
            username="dr_fall",
            password="Password123!",
            role="MEDECIN",
            first_name="Ibrahima",
            last_name="Fall",
            etablissement=self.etab_a,
            matricule_professionnel="ORD-102",
            statut_validation="APPROVED",
            is_actif=True,
        )

        # Médecin 3 (Dr Ndiaye, Hôpital B)
        self.medecin_3 = User.objects.create_user(
            username="dr_ndiaye",
            password="Password123!",
            role="MEDECIN",
            first_name="Fatou",
            last_name="Ndiaye",
            etablissement=self.etab_b,
            matricule_professionnel="ORD-103",
            statut_validation="APPROVED",
            is_actif=True,
        )

        # Agent d'accueil Hôpital A
        self.agent_a = User.objects.create_user(
            username="agent_a",
            password="Password123!",
            role="AGENT",
            first_name="Mariama",
            last_name="Sow",
            etablissement=self.etab_a,
            statut_validation="APPROVED",
            is_actif=True,
        )

        # Patient test
        self.patient = Patient.objects.create(
            nom="Diallo",
            prenom="Moussa",
            date_naissance="1985-06-15",
            sexe="M",
            numero_identification_nationale="185061500001",
            telephone="+221770001122",
            ville="Dakar",
            etablissement_creation=self.etab_a,
            cree_par=self.agent_a,
        )
        self.dossier = DossierMedical.objects.create(patient=self.patient)

    # Scénario 1 & 2 : Un médecin peut prendre en charge un patient disponible & bonne association
    def test_01_medecin_peut_prendre_en_charge_patient_disponible(self):
        """Un médecin peut prendre en charge un patient disponible et devient son médecin responsable."""
        self.client.force_authenticate(user=self.medecin_1)
        res = self.client.post("/api/care-management/take-charge/", {"patient_id": self.patient.id})
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["medecin_responsable"], self.medecin_1.id)
        self.assertEqual(res.data["etablissement"], self.etab_a.id)
        self.assertEqual(res.data["statut"], "ACTIF")

        # Vérification en base
        pec = PriseEnCharge.objects.get(patient=self.patient, statut="ACTIF")
        self.assertEqual(pec.medecin_responsable, self.medecin_1)
        self.assertEqual(pec.etablissement, self.etab_a)

    # Scénario 3 & 5 : Deuxième médecin ne peut pas prendre le même patient & blocage backend
    def test_03_05_deuxieme_medecin_bloque_double_prise_en_charge(self):
        """Un deuxième médecin ne peut pas prendre en charge un patient déjà suivi par un confrère."""
        # Dr Diop prend en charge le patient
        PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etab_a,
            medecin_responsable=self.medecin_1,
            type_prise_en_charge="ORDINAIRE",
            statut="ACTIF",
            date_debut=timezone.now(),
        )

        # Dr Fall tente de prendre en charge le même patient via take-charge
        self.client.force_authenticate(user=self.medecin_2)
        res_take_charge = self.client.post("/api/care-management/take-charge/", {"patient_id": self.patient.id})
        self.assertEqual(res_take_charge.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("déjà pris en charge", res_take_charge.data["detail"])
        self.assertIn("Diop", res_take_charge.data["detail"])

        # Dr Fall tente via POST direct /api/care-management/
        res_post_direct = self.client.post("/api/care-management/", {"patient": self.patient.id})
        self.assertEqual(res_post_direct.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("déjà pris en charge", res_post_direct.data["detail"])

    # Scénario 4 : Flags d'état retournés à l'API patient (bouton désactivé / statut)
    def test_04_flags_disponibilite_et_deja_pris_en_charge_dans_api_patient(self):
        """L'API patient renvoie les flags is_disponible, est_deja_pris_en_charge et est_suivi_par_moi."""
        # 1. Avant prise en charge : patient disponible pour Dr Diop
        self.client.force_authenticate(user=self.medecin_1)
        res_before = self.client.get(f"/api/patients/{self.patient.id}/")
        self.assertEqual(res_before.status_code, status.HTTP_200_OK)
        self.assertTrue(res_before.data["is_disponible"])
        self.assertFalse(res_before.data["est_deja_pris_en_charge"])
        self.assertFalse(res_before.data["est_suivi_par_moi"])

        # 2. Prise en charge par Dr Diop
        PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etab_a,
            medecin_responsable=self.medecin_1,
            type_prise_en_charge="ORDINAIRE",
            statut="ACTIF",
        )

        # Pour Dr Diop : est_suivi_par_moi = True, est_deja_pris_en_charge = False
        res_diop = self.client.get(f"/api/patients/{self.patient.id}/")
        self.assertTrue(res_diop.data["est_suivi_par_moi"])
        self.assertFalse(res_diop.data["est_deja_pris_en_charge"])

        # Pour Dr Fall : est_suivi_par_moi = False, est_deja_pris_en_charge = True, is_disponible = False
        self.client.force_authenticate(user=self.medecin_2)
        res_fall = self.client.get(f"/api/patients/{self.patient.id}/")
        self.assertFalse(res_fall.data["est_suivi_par_moi"])
        self.assertTrue(res_fall.data["est_deja_pris_en_charge"])
        self.assertFalse(res_fall.data["is_disponible"])

    # Scénario 6 : Concurrence et contrainte d'intégrité (une seule PEC ordinaire active)
    def test_06_contrainte_integrite_exclusivite_prise_en_charge(self):
        """La contrainte d'intégrité en base interdit strictement 2 PEC ordinaires actives pour un patient."""
        PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etab_a,
            medecin_responsable=self.medecin_1,
            type_prise_en_charge="ORDINAIRE",
            statut="ACTIF",
        )
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            PriseEnCharge.objects.create(
                patient=self.patient,
                etablissement=self.etab_b,
                medecin_responsable=self.medecin_3,
                type_prise_en_charge="ORDINAIRE",
                statut="ACTIF",
            )

    # Scénario 7 : Un médecin ne peut pas clôturer la PEC d'un autre médecin
    def test_07_medecin_interdit_de_cloturer_pec_autre_confrere(self):
        """Un médecin ne peut pas clôturer la prise en charge d'un autre médecin (HTTP 403)."""
        pec = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etab_a,
            medecin_responsable=self.medecin_1,
            type_prise_en_charge="ORDINAIRE",
            statut="ACTIF",
        )

        self.client.force_authenticate(user=self.medecin_2)
        res = self.client.post(f"/api/care-management/{pec.id}/close/", {"motif": "Tentative non autorisée"})
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        pec.refresh_from_db()
        self.assertEqual(pec.statut, "ACTIF")

    # Scénario 8 & 9 : Clôture par le médecin responsable et libération du patient
    def test_08_09_cloture_par_medecin_responsable_et_reouverture(self):
        """Le médecin responsable clôture sa PEC avec motif, libérant le patient pour un confrère."""
        pec = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etab_a,
            medecin_responsable=self.medecin_1,
            type_prise_en_charge="ORDINAIRE",
            statut="ACTIF",
        )

        # Clôture sans motif refusée
        self.client.force_authenticate(user=self.medecin_1)
        res_empty = self.client.post(f"/api/care-management/{pec.id}/close/", {"motif": ""})
        self.assertEqual(res_empty.status_code, status.HTTP_400_BAD_REQUEST)

        # Clôture avec motif valide
        res_close = self.client.post(f"/api/care-management/{pec.id}/close/", {"motif": "Fin de traitement / Guéri"})
        self.assertEqual(res_close.status_code, status.HTTP_200_OK)
        pec.refresh_from_db()
        self.assertEqual(pec.statut, "CLOTURE")
        self.assertEqual(pec.motif_cloture, "Fin de traitement / Guéri")
        self.assertEqual(pec.cloture_par, self.medecin_1)
        self.assertIsNotNone(pec.date_fin)

        # Le patient redevient disponible pour Dr Fall
        self.client.force_authenticate(user=self.medecin_2)
        res_take2 = self.client.post("/api/care-management/take-charge/", {"patient_id": self.patient.id})
        self.assertEqual(res_take2.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_take2.data["medecin_responsable"], self.medecin_2.id)

    # Scénario 10 & 11 : « Mes prises en charge » filtre strictement par médecin responsable
    def test_10_11_mes_prises_en_charge_filtre_strictement_medecin(self):
        """La rubrique « Mes prises en charge » affiche uniquement les suivis du médecin connecté."""
        pec1 = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etab_a,
            medecin_responsable=self.medecin_1,
            type_prise_en_charge="ORDINAIRE",
            statut="ACTIF",
        )

        # Dr Diop consulte ses prises en charge
        self.client.force_authenticate(user=self.medecin_1)
        res_diop = self.client.get("/api/care-management/?scope=my_care")
        self.assertEqual(res_diop.status_code, status.HTTP_200_OK)
        ids_diop = [item["id"] for item in (res_diop.data.get("results") if isinstance(res_diop.data, dict) else res_diop.data)]
        self.assertIn(pec1.id, ids_diop)

        # Dr Fall consulte ses prises en charge : liste vide
        self.client.force_authenticate(user=self.medecin_2)
        res_fall = self.client.get("/api/care-management/?scope=my_care")
        self.assertEqual(res_fall.status_code, status.HTTP_200_OK)
        ids_fall = [item["id"] for item in (res_fall.data.get("results") if isinstance(res_fall.data, dict) else res_fall.data)]
        self.assertNotIn(pec1.id, ids_fall)

    # Scénario 12 & 13 : Urgence indépendante et ne modifie pas le médecin responsable
    def test_12_13_acces_urgence_conserve_sans_modifier_medecin_responsable(self):
        """L'accès d'urgence fonctionne et ne modifie jamais le médecin responsable de la PEC."""
        pec = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etab_a,
            medecin_responsable=self.medecin_1,
            type_prise_en_charge="ORDINAIRE",
            statut="ACTIF",
        )

        # Dr Fall sollicite un accès d'urgence dérogatoire
        self.client.force_authenticate(user=self.medecin_2)
        res_urg = self.client.post("/api/emergencies/request-access/", {
            "patient_id": self.patient.id,
            "motif_urgence": "Arrêt cardiorespiratoire en salle d'accueil",
            "justification_acces": "Accès vital immédiat",
            "niveau_acces": "INTERVENTION_CLINIQUE",
            "duree_minutes": 60,
        })
        self.assertEqual(res_urg.status_code, status.HTTP_201_CREATED)

        # Vérification : le médecin responsable de la PEC ordinaire reste TOUJOURS Dr Diop
        pec.refresh_from_db()
        self.assertEqual(pec.medecin_responsable, self.medecin_1)
        self.assertEqual(pec.statut, "ACTIF")

    # Scénario 14 : Respect du workflow de transfert
    def test_14_transfert_respecte_regles_et_permet_prise_en_charge_destination(self):
        """Le transfert clôture la PEC d'origine et permet la prise en charge exclusive à destination."""
        pec_origine = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etab_a,
            medecin_responsable=self.medecin_1,
            type_prise_en_charge="ORDINAIRE",
            statut="ACTIF",
        )

        transfert = Transfert.objects.create(
            patient=self.patient,
            prise_en_charge_origine=pec_origine,
            etablissement_origine=self.etab_a,
            etablissement_destination=self.etab_b,
            medecin_emetteur=self.medecin_1,
            statut="DEMANDE",
            motif_transfert="Plateau technique spécialisé requis",
            resume_clinique="Patient nécessitant IRM et réanimation",
        )

        # Acceptation du transfert par l'agent de l'établissement B
        agent_b = User.objects.create_user(
            username="agent_b",
            password="Password123!",
            role="AGENT",
            etablissement=self.etab_b,
            statut_validation="APPROVED",
            is_actif=True,
        )
        self.client.force_authenticate(user=agent_b)
        res_accept = self.client.post(f"/api/transfers/{transfert.id}/accept/", {"motif": "Lit réservé aux soins intensifs"})
        self.assertEqual(res_accept.status_code, status.HTTP_200_OK)

        # L'ancienne PEC est passée à TRANSFERE
        pec_origine.refresh_from_db()
        self.assertEqual(pec_origine.statut, "TRANSFERE")

        # Dr Ndiaye (Hôpital B) peut maintenant prendre le patient en charge
        self.client.force_authenticate(user=self.medecin_3)
        res_take_b = self.client.post("/api/care-management/take-charge/", {"patient_id": self.patient.id})
        self.assertEqual(res_take_b.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res_take_b.data["medecin_responsable"], self.medecin_3.id)
        self.assertEqual(res_take_b.data["etablissement"], self.etab_b.id)

    # Scénario 15 : Conservation intégrale de l'historique médical après clôture
    def test_15_historique_medical_integralement_conserve_apres_cloture(self):
        """Après clôture de la prise en charge, tout l'historique des consultations est préservé."""
        pec = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etab_a,
            medecin_responsable=self.medecin_1,
            type_prise_en_charge="ORDINAIRE",
            statut="ACTIF",
        )

        # Création d'une consultation
        consultation = Consultation.objects.create(
            dossier=self.dossier,
            medecin=self.medecin_1,
            etablissement=self.etab_a,
            motif="Consultation de suivi cardiologique",
            observations_cliniques="Constantes stables, traitement bien toléré.",
            diagnostic="Hypertension artérielle équilibrée",
        )

        # Clôture de la prise en charge
        self.client.force_authenticate(user=self.medecin_1)
        res_close = self.client.post(f"/api/care-management/{pec.id}/close/", {"motif": "Guérison clinique"})
        self.assertEqual(res_close.status_code, status.HTTP_200_OK)

        # Vérification que la consultation est intacte et toujours liée au dossier
        consultation.refresh_from_db()
        self.assertEqual(consultation.motif, "Consultation de suivi cardiologique")
        self.assertEqual(self.dossier.consultations.count(), 1)
        self.assertEqual(self.dossier.patient.id, self.patient.id)

from datetime import timedelta
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status

from establishments.models import Etablissement
from accounts.models import User
from patients.models import Patient
from medical_records.models import (
    DossierMedical,
    TraitementActuel,
    Antecedent,
    Allergie,
    ExamenComplementaire,
)
from consultations.models import Consultation, ConsultationRevision
from care_management.models import PriseEnCharge, Transfert
from emergencies.models import AutorisationUrgence, InterventionUrgence
from ai_assistant.models import SyntheseIA
from notifications.models import Notification
from audit.models import JournalAcces


class OngoingTreatmentsManagementTests(TestCase):
    """
    Suite de tests automatisés validant les 15 scénarios obligatoires
    pour la gestion complète de la rubrique « Traitements en cours ».
    """

    def setUp(self):
        self.etablissement = Etablissement.objects.create(
            nom="Hôpital Abass Ndao",
            code="HAN-TRT",
            type_etablissement="HOPITAL_NATIONAL",
            region="Dakar",
            ville="Dakar",
            telephone="+221338497800",
            email="contact@abassndao.sn",
            services_declares="Médecine Interne, Cardiologie, Urgences",
        )

        self.medecin = User.objects.create_user(
            username="medecin_traitement",
            email="dr.ndiaye@abassndao.sn",
            password="Password123!",
            role="MEDECIN",
            statut_validation="APPROVED",
            is_active=True,
            etablissement=self.etablissement,
            specialite="Cardiologie",
            matricule_professionnel="SN-CARD-101",
            first_name="Mamadou",
            last_name="Ndiaye",
        )

        self.agent = User.objects.create_user(
            username="agent_traitement",
            email="agent.fall@abassndao.sn",
            password="Password123!",
            role="AGENT",
            statut_validation="APPROVED",
            is_active=True,
            etablissement=self.etablissement,
            first_name="Awa",
            last_name="Fall",
        )

        self.patient = Patient.objects.create(
            nom="SOW",
            prenom="Ibrahima",
            sexe="M",
            date_naissance="1975-03-20",
            status_identite="CONFIRMEE",
            groupe_sanguin="A+",
            etablissement_creation=self.etablissement,
            cree_par=self.agent,
        )

        self.dossier = DossierMedical.objects.create(
            patient=self.patient,
            remarques_importantes="Suivi HTA chronique",
        )

        self.pec = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.etablissement,
            medecin_responsable=self.medecin,
            type_prise_en_charge="ORDINAIRE",
            statut="ACTIF",
        )

        self.client = APIClient()
        self.today = timezone.localdate()

    def _get_dossier_payload(self):
        self.client.force_authenticate(user=self.medecin)
        res = self.client.get(f"/api/medical-records/by-patient/{self.patient.id}/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        return res.data

    def test_01_and_02_add_treatment_from_dossier_and_counter_goes_0_to_1(self):
        """
        Scénarios 1 & 2 :
        - Ajouter un traitement depuis un dossier médical.
        - Vérifier que le compteur passe de 0 à 1.
        """
        initial_data = self._get_dossier_payload()
        self.assertEqual(initial_data["nombre_traitements_actifs"], 0)
        self.assertEqual(len(initial_data["traitements"]), 0)

        res = self.client.post(
            "/api/traitements/",
            {
                "dossier": self.dossier.id,
                "medicament": "Amlodipine",
                "dosage": "10 mg",
                "posologie": "1 comprimé par jour",
                "frequence": "Le matin",
                "date_debut": str(self.today),
                "instructions": "Contrôler la tension artérielle",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data["statut_traitement"], "ACTIF")
        self.assertTrue(res.data["est_en_cours"])
        self.assertEqual(res.data["prescrit_par_nom"], "Dr Ndiaye")

        updated_data = self._get_dossier_payload()
        self.assertEqual(updated_data["nombre_traitements_actifs"], 1)
        self.assertEqual(len(updated_data["traitements"]), 1)
        self.assertEqual(updated_data["traitements"][0]["medicament"], "Amlodipine")

    def test_03_add_multiple_treatments_and_verify_counter(self):
        """
        Scénario 3 :
        - Ajouter plusieurs traitements et vérifier le compteur.
        """
        self.client.force_authenticate(user=self.medecin)
        meds = [
            ("Amlodipine", "10 mg", "1 cp/j"),
            ("Metformine", "500 mg", "1 cp 2x/j"),
            ("Atorvastatine", "20 mg", "1 cp le soir"),
        ]
        for med, dosage, poso in meds:
            res = self.client.post(
                "/api/traitements/",
                {
                    "dossier": self.dossier.id,
                    "medicament": med,
                    "dosage": dosage,
                    "posologie": poso,
                    "date_debut": str(self.today),
                },
                format="json",
            )
            self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        data = self._get_dossier_payload()
        self.assertEqual(data["nombre_traitements_actifs"], 3)
        self.assertEqual(len(data["traitements"]), 3)

    def test_04_and_05_modify_treatment_posology_and_counter_coherence(self):
        """
        Scénarios 4 & 5 :
        - Modifier la posologie d'un traitement.
        - Vérifier que le compteur reste cohérent après modification.
        """
        self.client.force_authenticate(user=self.medecin)
        create_res = self.client.post(
            "/api/traitements/",
            {
                "dossier": self.dossier.id,
                "medicament": "Périndopril",
                "dosage": "5 mg",
                "posologie": "1/2 comprimé le matin",
                "date_debut": str(self.today),
            },
            format="json",
        )
        trt_id = create_res.data["id"]

        patch_res = self.client.patch(
            f"/api/traitements/{trt_id}/",
            {
                "dosage": "10 mg",
                "posologie": "1 comprimé entier le matin",
                "instructions": "Adaptation posologique suite au contrôle TA",
            },
            format="json",
        )
        self.assertEqual(patch_res.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_res.data["dosage"], "10 mg")
        self.assertEqual(patch_res.data["posologie"], "1 comprimé entier le matin")
        self.assertEqual(patch_res.data["modifie_par_nom"], "Dr Ndiaye")

        data = self._get_dossier_payload()
        self.assertEqual(data["nombre_traitements_actifs"], 1)
        self.assertEqual(len(data["traitements"]), 1)
        self.assertEqual(data["traitements"][0]["posologie"], "1 comprimé entier le matin")

    def test_06_stop_treatment_and_verify_counter_decreases(self):
        """
        Scénario 6 :
        - Arrêter un traitement et vérifier que le compteur diminue.
        """
        self.client.force_authenticate(user=self.medecin)
        t1 = self.client.post(
            "/api/traitements/",
            {
                "dossier": self.dossier.id,
                "medicament": "Amlodipine",
                "posologie": "1 cp/j",
                "date_debut": str(self.today),
            },
            format="json",
        ).data
        t2 = self.client.post(
            "/api/traitements/",
            {
                "dossier": self.dossier.id,
                "medicament": "Furosémide",
                "posologie": "1 cp le matin",
                "date_debut": str(self.today),
            },
            format="json",
        ).data

        self.assertEqual(self._get_dossier_payload()["nombre_traitements_actifs"], 2)

        stop_res = self.client.post(
            f"/api/traitements/{t2['id']}/stop/",
            {"motif_arret": "Normalisation de la surcharge hydrosodée"},
            format="json",
        )
        self.assertEqual(stop_res.status_code, status.HTTP_200_OK)
        self.assertFalse(stop_res.data["is_actif"])
        self.assertEqual(stop_res.data["statut_traitement"], "ARRETE")
        self.assertFalse(stop_res.data["est_en_cours"])

        data = self._get_dossier_payload()
        self.assertEqual(data["nombre_traitements_actifs"], 1)
        self.assertEqual(len(data["traitements"]), 1)
        self.assertEqual(data["traitements"][0]["id"], t1["id"])
        self.assertEqual(len(data["traitements_historique"]), 1)
        self.assertEqual(data["traitements_historique"][0]["id"], t2["id"])
        self.assertEqual(data["traitements_historique"][0]["statut_traitement"], "ARRETE")

    def test_07_finished_treatment_not_counted_in_active_treatments(self):
        """
        Scénario 7 :
        - Vérifier qu'un traitement terminé (date_fin < aujourd'hui) n'est plus compté dans les traitements actifs.
        """
        TraitementActuel.objects.create(
            dossier=self.dossier,
            medicament="Amoxicilline",
            dosage="1 g",
            posologie="1 cp matin et soir pendant 7 jours",
            date_debut=self.today - timedelta(days=10),
            date_fin=self.today - timedelta(days=3),
            is_actif=True,
            prescrit_par=self.medecin,
        )
        TraitementActuel.objects.create(
            dossier=self.dossier,
            medicament="Amlodipine",
            dosage="5 mg",
            posologie="1 cp/j au long cours",
            date_debut=self.today - timedelta(days=30),
            date_fin=None,
            is_actif=True,
            prescrit_par=self.medecin,
        )

        data = self._get_dossier_payload()
        self.assertEqual(data["nombre_traitements_actifs"], 1)
        self.assertEqual(len(data["traitements"]), 1)
        self.assertEqual(data["traitements"][0]["medicament"], "Amlodipine")
        self.assertEqual(len(data["traitements_historique"]), 1)
        self.assertEqual(data["traitements_historique"][0]["medicament"], "Amoxicilline")
        self.assertEqual(data["traitements_historique"][0]["statut_traitement"], "TERMINE")

    def test_08_consultation_without_ongoing_treatment_does_not_change_counter(self):
        """
        Scénario 8 :
        - Créer une consultation sans traitement en cours et vérifier que le compteur ne change pas.
        """
        self.client.force_authenticate(user=self.medecin)
        res = self.client.post(
            "/api/consultations/",
            {
                "patient_id": self.patient.id,
                "motif": "Céphalées passagères",
                "observations_cliniques": "Examen neurologique normal",
                "diagnostic": "Céphalée de tension ponctuelle",
                "prescription": "Paracétamol 1g si douleur (prise ponctuelle uniquement)",
                "operations_traitements": [],
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        data = self._get_dossier_payload()
        self.assertEqual(data["nombre_traitements_actifs"], 0)
        self.assertEqual(len(data["traitements"]), 0)

    def test_09_consultation_with_explicit_ongoing_treatment_increments_counter(self):
        """
        Scénario 9 :
        - Créer une consultation avec ajout explicite d'un traitement en cours.
        """
        self.client.force_authenticate(user=self.medecin)
        res = self.client.post(
            "/api/consultations/",
            {
                "patient_id": self.patient.id,
                "motif": "Découverte HTA stade 2",
                "observations_cliniques": "TA 165/100 mmHg aux deux bras",
                "diagnostic": "Hypertension artérielle essentielle",
                "prescription": "Lisinopril 20 mg : 1 comprimé par jour le matin",
                "operations_traitements": [
                    {
                        "action": "ADD",
                        "medicament": "Lisinopril",
                        "dosage": "20 mg",
                        "posologie": "1 comprimé par jour",
                        "frequence": "Le matin",
                        "date_debut": str(self.today),
                        "instructions": "Surveillance kaliémie et créatininémie à J15",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        data = self._get_dossier_payload()
        self.assertEqual(data["nombre_traitements_actifs"], 1)
        self.assertEqual(len(data["traitements"]), 1)
        trt = data["traitements"][0]
        self.assertEqual(trt["medicament"], "Lisinopril")
        self.assertEqual(trt["dosage"], "20 mg")
        self.assertEqual(trt["consultation"], res.data["id"])

    def test_10_and_11_amend_consultation_no_duplicates_and_preserves_revisions(self):
        """
        Scénarios 10 & 11 :
        - Rectifier une consultation sans créer de doublon de traitement.
        - Vérifier la conservation des anciennes versions de consultation (ConsultationRevision).
        """
        self.client.force_authenticate(user=self.medecin)
        create_res = self.client.post(
            "/api/consultations/",
            {
                "patient_id": self.patient.id,
                "motif": "Suivi HTA",
                "observations_cliniques": "TA 150/95 mmHg",
                "diagnostic": "HTA insuffisamment contrôlée",
                "prescription": "Amlodipine 5mg : 1 cp/j",
                "operations_traitements": [
                    {
                        "action": "ADD",
                        "medicament": "Amlodipine",
                        "dosage": "5 mg",
                        "posologie": "1 cp/j",
                        "date_debut": str(self.today),
                    }
                ],
            },
            format="json",
        )
        consultation_id = create_res.data["id"]
        self.assertEqual(TraitementActuel.objects.filter(dossier=self.dossier).count(), 1)

        # Rectification 1 : Correction du dosage du même médicament via ADD ou UPDATE -> pas de doublon
        amend_res_1 = self.client.post(
            f"/api/consultations/{consultation_id}/amend/",
            {
                "motif_modification": "Adaptation posologique à 10 mg",
                "prescription": "Amlodipine 10mg : 1 cp/j le matin",
                "operations_traitements": [
                    {
                        "action": "ADD",
                        "medicament": "Amlodipine",
                        "dosage": "10 mg",
                        "posologie": "1 cp/j le matin",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(amend_res_1.status_code, status.HTTP_200_OK)
        self.assertEqual(TraitementActuel.objects.filter(dossier=self.dossier).count(), 1)
        trt = TraitementActuel.objects.get(dossier=self.dossier)
        self.assertEqual(trt.dosage, "10 mg")
        self.assertEqual(trt.posologie, "1 cp/j le matin")

        # Rectification 2 : Correction uniquement du texte d'observations sans toucher aux traitements
        amend_res_2 = self.client.post(
            f"/api/consultations/{consultation_id}/amend/",
            {
                "motif_modification": "Précision auscultation cardiaque",
                "observations_cliniques": "TA 150/95 mmHg, bruits du coeur réguliers sans souffle",
                "operations_traitements": [],
            },
            format="json",
        )
        self.assertEqual(amend_res_2.status_code, status.HTTP_200_OK)
        self.assertEqual(TraitementActuel.objects.filter(dossier=self.dossier).count(), 1)

        # Vérification des archives médicolégales ConsultationRevision
        revisions = ConsultationRevision.objects.filter(consultation_id=consultation_id).order_by("date_modification")
        self.assertEqual(revisions.count(), 2)
        self.assertEqual(revisions[0].anciennes_valeurs["prescription"], "Amlodipine 5mg : 1 cp/j")
        self.assertEqual(revisions[1].anciennes_valeurs["observations_cliniques"], "TA 150/95 mmHg")

    def test_12_emergency_prescription_does_not_automatically_become_ongoing_treatment(self):
        """
        Scénario 12 :
        - Vérifier qu'une prescription d'urgence ponctuelle ne devient pas automatiquement un traitement en cours.
        """
        self.client.force_authenticate(user=self.medecin)
        res = self.client.post(
            "/api/emergencies/",
            {
                "patient_id": self.patient.id,
                "motif_urgence": "Crise hypertensive aiguë aux urgences",
                "justification_acces_derogatoire": "Urgence vitale immédiate",
                "observations_cliniques": "TA 210/120 mmHg",
                "diagnostic": "Poussée hypertensive sévère",
                "prescription": "Nicardipine IVSE 2 mg/h en salle de déchocage",
                "conclusions_recommandations": "Surveillance scopée horaire",
                "constantes": {"ta": "210/120", "fc": "96"},
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)

        data = self._get_dossier_payload()
        self.assertEqual(data["nombre_traitements_actifs"], 0)
        self.assertEqual(len(data["traitements"]), 0)
        self.assertEqual(len(data["consultations"]), 1)
        self.assertTrue(data["consultations"][0]["is_emergency"])

    def test_13_and_14_permissions_and_audit_logs(self):
        """
        Scénarios 13 & 14 :
        - Vérifier qu'un agent d'accueil ne peut ni créer, ni modifier, ni arrêter un traitement.
        - Vérifier les permissions du médecin et l'enregistrement des journaux d'audit.
        """
        # 1. Création par le médecin -> autorisée + audit CREATE_TREATMENT
        self.client.force_authenticate(user=self.medecin)
        create_res = self.client.post(
            "/api/traitements/",
            {
                "dossier": self.dossier.id,
                "medicament": "Bisoprolol",
                "dosage": "5 mg",
                "posologie": "1 cp le matin",
                "date_debut": str(self.today),
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        trt_id = create_res.data["id"]
        self.assertTrue(
            JournalAcces.objects.filter(
                utilisateur=self.medecin,
                action="CREATE_TREATMENT",
                statut="SUCCES",
            ).exists()
        )

        # 2. Tentatives par l'agent d'accueil -> 403 Forbidden sur création, modification et arrêt
        self.client.force_authenticate(user=self.agent)
        agent_create = self.client.post(
            "/api/traitements/",
            {
                "dossier": self.dossier.id,
                "medicament": "FraudeMed",
                "posologie": "1 cp/j",
                "date_debut": str(self.today),
            },
            format="json",
        )
        self.assertEqual(agent_create.status_code, status.HTTP_403_FORBIDDEN)

        agent_patch = self.client.patch(
            f"/api/traitements/{trt_id}/",
            {"posologie": "2 cp/j"},
            format="json",
        )
        self.assertEqual(agent_patch.status_code, status.HTTP_403_FORBIDDEN)

        agent_stop = self.client.post(
            f"/api/traitements/{trt_id}/stop/",
            {"motif_arret": "Tentative non autorisée"},
            format="json",
        )
        self.assertEqual(agent_stop.status_code, status.HTTP_403_FORBIDDEN)

        # 3. Modification et arrêt par le médecin -> autorisés + audits UPDATE_TREATMENT et STOP_TREATMENT
        self.client.force_authenticate(user=self.medecin)
        med_patch = self.client.patch(
            f"/api/traitements/{trt_id}/",
            {"posologie": "1/2 cp le matin"},
            format="json",
        )
        self.assertEqual(med_patch.status_code, status.HTTP_200_OK)
        self.assertTrue(
            JournalAcces.objects.filter(
                utilisateur=self.medecin,
                action="UPDATE_TREATMENT",
                statut="SUCCES",
            ).exists()
        )

        med_stop = self.client.post(
            f"/api/traitements/{trt_id}/stop/",
            {"motif_arret": "Bradycardie sinusale"},
            format="json",
        )
        self.assertEqual(med_stop.status_code, status.HTTP_200_OK)
        self.assertTrue(
            JournalAcces.objects.filter(
                utilisateur=self.medecin,
                action="STOP_TREATMENT",
                statut="SUCCES",
            ).exists()
        )

    def test_15_persistence_after_reload(self):
        """
        Scénario 15 :
        - Vérifier la persistance des traitements après rechargement de la page.
        """
        self.client.force_authenticate(user=self.medecin)
        self.client.post(
            "/api/traitements/",
            {
                "dossier": self.dossier.id,
                "medicament": "Ramipril",
                "dosage": "5 mg",
                "posologie": "1 cp le soir",
                "frequence": "Quotidien",
                "date_debut": str(self.today),
                "instructions": "Traitement au long cours",
            },
            format="json",
        )

        # Simulation d'un nouveau client / rechargement complet de la page dossier médical
        fresh_client = APIClient()
        fresh_client.force_authenticate(user=self.medecin)
        reload_res = fresh_client.get(f"/api/medical-records/by-patient/{self.patient.id}/")
        self.assertEqual(reload_res.status_code, status.HTTP_200_OK)
        self.assertEqual(reload_res.data["nombre_traitements_actifs"], 1)
        self.assertEqual(len(reload_res.data["traitements"]), 1)
        self.assertEqual(reload_res.data["traitements"][0]["medicament"], "Ramipril")
        self.assertEqual(reload_res.data["traitements"][0]["dosage"], "5 mg")
        self.assertEqual(reload_res.data["traitements"][0]["posologie"], "1 cp le soir")


class MedicalRecordSecurityAuthorizationTests(TestCase):
    """
    Suite de tests de sécurité obligatoire (Section 17 — 20 scénarios) :
    Contrôle d'accès médical basé sur les prises en charge, les établissements
    et les autorisations exceptionnelles d'urgence (« Break-Glass »).
    """

    def setUp(self):
        # Établissements A, B et C
        self.etab_a = Etablissement.objects.create(
            nom="Hôpital Régional de Ziguinchor",
            code="SEC-HRZ",
            type_etablissement="CENTRE_HOSPITALIER_REGIONAL",
            region="Ziguinchor",
            ville="Ziguinchor",
            is_active=True,
        )
        self.etab_b = Etablissement.objects.create(
            nom="Hôpital Principal de Dakar",
            code="SEC-HPD",
            type_etablissement="HOPITAL_NATIONAL",
            region="Dakar",
            ville="Dakar",
            is_active=True,
        )
        self.etab_c = Etablissement.objects.create(
            nom="Centre Hospitalier Régional de Saint-Louis",
            code="SEC-CHRSL",
            type_etablissement="CENTRE_HOSPITALIER_REGIONAL",
            region="Saint-Louis",
            ville="Saint-Louis",
            is_active=True,
        )

        # Médecin 1 : Dr Ndiaye dans l'Établissement A (responsable de la prise en charge de P)
        self.dr_ndiaye = User.objects.create_user(
            username="dr_ndiaye_sec",
            email="dr.ndiaye.sec@hrz.sn",
            password="Password123!",
            role="MEDECIN",
            statut_validation="APPROVED",
            is_active=True,
            is_actif=True,
            etablissement=self.etab_a,
            specialite="Cardiologie",
            matricule_professionnel="SN-MED-NDIAYE",
            first_name="Mamadou",
            last_name="Ndiaye",
        )

        # Médecin 2 : Alioune Dione dans l'Établissement B (non autorisé sur P)
        self.alioune_dione = User.objects.create_user(
            username="aliounedione14_sec",
            email="alioune.dione@hpd.sn",
            password="Password123!",
            role="MEDECIN",
            statut_validation="APPROVED",
            is_active=True,
            is_actif=True,
            etablissement=self.etab_b,
            specialite="Médecine Générale",
            matricule_professionnel="SN-MED-DIONE",
            first_name="Alioune",
            last_name="Dione",
        )

        # Médecin 3 : Collègue dans le même établissement A mais non responsable de P
        self.dr_collegue_a = User.objects.create_user(
            username="dr_collegue_a",
            email="dr.collegue@hrz.sn",
            password="Password123!",
            role="MEDECIN",
            statut_validation="APPROVED",
            is_active=True,
            is_actif=True,
            etablissement=self.etab_a,
            specialite="Pédiatrie",
            matricule_professionnel="SN-MED-COL-A",
            first_name="Fatou",
            last_name="Sarr",
        )

        # Médecin 4 : Médecin dans l'Établissement C
        self.dr_etab_c = User.objects.create_user(
            username="dr_etab_c",
            email="dr.c@chrsl.sn",
            password="Password123!",
            role="MEDECIN",
            statut_validation="APPROVED",
            is_active=True,
            is_actif=True,
            etablissement=self.etab_c,
            specialite="Neurologie",
            matricule_professionnel="SN-MED-ETABC",
            first_name="Ousmane",
            last_name="Kane",
        )

        # Patient P pris en charge par Dr Ndiaye dans l'Établissement A
        self.patient_p = Patient.objects.create(
            nom="DIOP",
            prenom="Cheikh",
            sexe="M",
            date_naissance="1972-11-10",
            status_identite="CONFIRMEE",
            groupe_sanguin="O+",
            etablissement_creation=self.etab_a,
            cree_par=self.dr_ndiaye,
        )
        self.dossier_p = DossierMedical.objects.create(
            patient=self.patient_p,
            remarques_importantes="Suivi cardiologique strict",
        )
        self.pec_p = PriseEnCharge.objects.create(
            patient=self.patient_p,
            etablissement=self.etab_a,
            medecin_responsable=self.dr_ndiaye,
            type_prise_en_charge="ORDINAIRE",
            statut="ACTIF",
        )

        # Éléments cliniques initiaux créés par Dr Ndiaye sur le dossier de P
        self.consultation_p = Consultation.objects.create(
            dossier=self.dossier_p,
            etablissement=self.etab_a,
            medecin=self.dr_ndiaye,
            motif="Contrôle HTA",
            observations_cliniques="TA stabilisée à 130/80",
            diagnostic="HTA équilibrée",
            prescription="Amlodipine 10mg",
        )
        self.traitement_p = TraitementActuel.objects.create(
            dossier=self.dossier_p,
            consultation=self.consultation_p,
            medicament="Amlodipine",
            dosage="10 mg",
            posologie="1 cp/j",
            frequence="Matin",
            date_debut=timezone.localdate(),
            prescrit_par=self.dr_ndiaye,
            is_actif=True,
        )
        self.allergie_p = Allergie.objects.create(
            dossier=self.dossier_p,
            substance="Pénicilline",
            severite="SEVERE",
            reaction="Choc anaphylactique",
            enregistre_par=self.dr_ndiaye,
        )
        self.antecedent_p = Antecedent.objects.create(
            dossier=self.dossier_p,
            type_antecedent="MEDICAL",
            description="HTA connue depuis 2018",
            date_diagnostic="2018",
            enregistre_par=self.dr_ndiaye,
        )
        self.examen_p = ExamenComplementaire.objects.create(
            dossier=self.dossier_p,
            titre="Échocardiographie transthoracique",
            type_examen="Échographie",
            date_examen=timezone.localdate(),
            resultat="FEVG conservée à 62%",
            etablissement=self.etab_a,
            medecin=self.dr_ndiaye,
        )
        self.synthese_p = SyntheseIA.objects.create(
            patient=self.patient_p,
            medecin_demandeur=self.dr_ndiaye,
            motif_consultation_soumis="Suivi annuel",
            synthese_globale="Patient hypertendu équilibré sous Amlodipine.",
            statut="EN_ATTENTE",
        )

        self.client = APIClient()

    @staticmethod
    def _items(res):
        return res.data["results"] if isinstance(res.data, dict) and "results" in res.data else res.data

    def test_01_alioune_dione_does_not_see_dr_ndiaye_medical_records(self):
        """1. Alioune Dione ne voit pas les dossiers médicaux de Dr Ndiaye."""
        self.client.force_authenticate(user=self.alioune_dione)
        res_records = self.client.get("/api/medical-records/")
        self.assertEqual(res_records.status_code, status.HTTP_200_OK)
        self.assertEqual(len(self._items(res_records)), 0)

        res_patients_default = self.client.get("/api/patients/")
        self.assertEqual(res_patients_default.status_code, status.HTTP_200_OK)
        self.assertEqual(len(self._items(res_patients_default)), 0)

        # Même un collègue du même établissement A mais non responsable de P ne voit pas le dossier de P
        self.client.force_authenticate(user=self.dr_collegue_a)
        res_col = self.client.get("/api/medical-records/")
        self.assertEqual(len(self._items(res_col)), 0)

    def test_02_by_patient_endpoint_returns_403_for_alioune_dione(self):
        """2. GET /api/medical-records/by-patient/<P>/ par Alioune Dione retourne 403 Forbidden."""
        self.client.force_authenticate(user=self.alioune_dione)
        res = self.client.get(f"/api/medical-records/by-patient/{self.patient_p.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(
            JournalAcces.objects.filter(
                utilisateur=self.alioune_dione,
                action="PERMISSION_DENIED",
                statut="REFUSE",
            ).exists()
        )

    def test_03_direct_medical_record_detail_returns_403_for_alioune_dione(self):
        """3. GET /api/medical-records/<id>/ par Alioune Dione retourne 403 Forbidden."""
        self.client.force_authenticate(user=self.alioune_dione)
        res = self.client.get(f"/api/medical-records/{self.dossier_p.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

        # PATCH/PUT sur le dossier médical également refusé (403 ou 405 ReadOnlyModelViewSet)
        res_patch = self.client.patch(
            f"/api/medical-records/{self.dossier_p.id}/",
            {"remarques_importantes": "Tentative illégale"},
            format="json",
        )
        self.assertIn(
            res_patch.status_code,
            (status.HTTP_403_FORBIDDEN, status.HTTP_405_METHOD_NOT_ALLOWED),
        )

    def test_04_alioune_dione_cannot_create_ordinary_consultation_for_p(self):
        """4. Alioune Dione ne peut pas créer une consultation ordinaire pour P."""
        self.client.force_authenticate(user=self.alioune_dione)
        res = self.client.post(
            "/api/consultations/",
            {
                "patient_id": self.patient_p.id,
                "motif": "Consultation non autorisée",
                "observations_cliniques": "Tentative sans prise en charge",
                "diagnostic": "Aucun",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Consultation.objects.filter(dossier=self.dossier_p).count(), 1)

    def test_05_alioune_dione_cannot_amend_dr_ndiaye_consultation(self):
        """5. Alioune Dione ne peut pas rectifier une consultation de Dr Ndiaye."""
        self.client.force_authenticate(user=self.alioune_dione)
        res = self.client.post(
            f"/api/consultations/{self.consultation_p.id}/amend/",
            {
                "motif_modification": "Tentative de falsification",
                "diagnostic": "Diagnostic altéré",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.consultation_p.refresh_from_db()
        self.assertEqual(self.consultation_p.diagnostic, "HTA équilibrée")
        self.assertFalse(self.consultation_p.is_amended)

        # Même si la prise en charge est transférée plus tard à Alioune Dione,
        # il ne peut toujours pas rectifier la consultation historique écrite par Dr Ndiaye
        self.pec_p.cloturer(motif="Transfert test")
        pec_b = PriseEnCharge.objects.create(
            patient=self.patient_p,
            etablissement=self.etab_b,
            medecin_responsable=self.alioune_dione,
            type_prise_en_charge="ORDINAIRE",
            statut="ACTIF",
        )
        res_after = self.client.post(
            f"/api/consultations/{self.consultation_p.id}/amend/",
            {
                "motif_modification": "Tentative par nouveau médecin sur acte d'autrui",
                "diagnostic": "Diagnostic altéré",
            },
            format="json",
        )
        self.assertEqual(res_after.status_code, status.HTTP_403_FORBIDDEN)
        pec_b.delete()

    def test_06_alioune_dione_cannot_close_patient_p_care(self):
        """6. Alioune Dione ne peut pas clôturer la prise en charge du patient P."""
        self.client.force_authenticate(user=self.alioune_dione)
        res = self.client.post(
            f"/api/care-management/{self.pec_p.id}/close/",
            {"motif": "Tentative de clôture illégitime"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.pec_p.refresh_from_db()
        self.assertEqual(self.pec_p.statut, "ACTIF")

    def test_07_alioune_dione_cannot_add_treatment_for_p(self):
        """7. Alioune Dione ne peut pas ajouter un traitement pour P sans autorisation."""
        self.client.force_authenticate(user=self.alioune_dione)
        res = self.client.post(
            "/api/traitements/",
            {
                "dossier": self.dossier_p.id,
                "medicament": "Bisoprolol",
                "dosage": "5 mg",
                "posologie": "1 cp/j",
                "date_debut": str(timezone.localdate()),
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(TraitementActuel.objects.filter(dossier=self.dossier_p).count(), 1)

    def test_08_alioune_dione_cannot_modify_treatment_of_p(self):
        """8. Alioune Dione ne peut pas modifier un traitement de P."""
        self.client.force_authenticate(user=self.alioune_dione)
        res = self.client.patch(
            f"/api/traitements/{self.traitement_p.id}/",
            {"posologie": "3 cp/j"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.traitement_p.refresh_from_db()
        self.assertEqual(self.traitement_p.posologie, "1 cp/j")

    def test_09_alioune_dione_cannot_stop_treatment_of_p(self):
        """9. Alioune Dione ne peut pas arrêter un traitement de P."""
        self.client.force_authenticate(user=self.alioune_dione)
        res = self.client.post(
            f"/api/traitements/{self.traitement_p.id}/stop/",
            {"motif_arret": "Arrêt non autorisé"},
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.traitement_p.refresh_from_db()
        self.assertTrue(self.traitement_p.is_actif)
        self.assertEqual(self.traitement_p.statut_traitement, "ACTIF")

    def test_10_alioune_dione_and_even_owner_cannot_delete_treatment_of_p(self):
        """10. Alioune Dione (ni aucun médecin) ne peut supprimer physiquement un traitement de P."""
        self.client.force_authenticate(user=self.alioune_dione)
        res = self.client.delete(f"/api/traitements/{self.traitement_p.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(TraitementActuel.objects.filter(pk=self.traitement_p.id).exists())

        self.client.force_authenticate(user=self.dr_ndiaye)
        res_owner = self.client.delete(f"/api/traitements/{self.traitement_p.id}/")
        self.assertEqual(res_owner.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(TraitementActuel.objects.filter(pk=self.traitement_p.id).exists())

    def test_11_alioune_dione_cannot_add_or_modify_allergie_of_p(self):
        """11. Alioune Dione ne peut pas ajouter ou modifier une allergie de P."""
        self.client.force_authenticate(user=self.alioune_dione)
        res_add = self.client.post(
            "/api/allergies/",
            {
                "dossier": self.dossier_p.id,
                "substance": "Aspirine",
                "severite": "MODEREE",
                "reaction": "Urticaire",
            },
            format="json",
        )
        self.assertEqual(res_add.status_code, status.HTTP_403_FORBIDDEN)

        res_patch = self.client.patch(
            f"/api/allergies/{self.allergie_p.id}/",
            {"reaction": "Modifiée illégalement"},
            format="json",
        )
        self.assertEqual(res_patch.status_code, status.HTTP_403_FORBIDDEN)

        res_del = self.client.delete(f"/api/allergies/{self.allergie_p.id}/")
        self.assertEqual(res_del.status_code, status.HTTP_403_FORBIDDEN)

    def test_12_alioune_dione_cannot_add_or_modify_antecedent_of_p(self):
        """12. Alioune Dione ne peut pas ajouter ou modifier un antécédent de P."""
        self.client.force_authenticate(user=self.alioune_dione)
        res_add = self.client.post(
            "/api/antecedents/",
            {
                "dossier": self.dossier_p.id,
                "type_antecedent": "CHIRURGICAL",
                "description": "Appendicectomie",
            },
            format="json",
        )
        self.assertEqual(res_add.status_code, status.HTTP_403_FORBIDDEN)

        res_patch = self.client.patch(
            f"/api/antecedents/{self.antecedent_p.id}/",
            {"description": "Altération"},
            format="json",
        )
        self.assertEqual(res_patch.status_code, status.HTTP_403_FORBIDDEN)

        res_del = self.client.delete(f"/api/antecedents/{self.antecedent_p.id}/")
        self.assertEqual(res_del.status_code, status.HTTP_403_FORBIDDEN)

    def test_13_alioune_dione_cannot_add_or_modify_examen_of_p(self):
        """13. Alioune Dione ne peut pas ajouter ou modifier un examen complémentaire de P."""
        self.client.force_authenticate(user=self.alioune_dione)
        res_add = self.client.post(
            "/api/examens/",
            {
                "dossier": self.dossier_p.id,
                "titre": "Scanner thoracique",
                "type_examen": "Scanner",
                "date_examen": str(timezone.localdate()),
                "resultat": "Normal",
            },
            format="json",
        )
        self.assertEqual(res_add.status_code, status.HTTP_403_FORBIDDEN)

        res_patch = self.client.patch(
            f"/api/examens/{self.examen_p.id}/",
            {"resultat": "Altéré"},
            format="json",
        )
        self.assertEqual(res_patch.status_code, status.HTTP_403_FORBIDDEN)

        res_del = self.client.delete(f"/api/examens/{self.examen_p.id}/")
        self.assertEqual(res_del.status_code, status.HTTP_403_FORBIDDEN)

    def test_14_alioune_dione_cannot_generate_view_validate_or_reject_ai_summary_of_p(self):
        """14. Alioune Dione ne peut pas générer, consulter, valider ou rejeter une synthèse IA de P."""
        self.client.force_authenticate(user=self.alioune_dione)

        res_gen = self.client.post(
            "/api/ai/summaries/generate/",
            {"patient_id": self.patient_p.id, "motif_consultation": "Tentative IA non autorisée"},
            format="json",
        )
        self.assertEqual(res_gen.status_code, status.HTTP_403_FORBIDDEN)

        res_list_filtered = self.client.get(f"/api/ai/summaries/?patient={self.patient_p.id}")
        self.assertEqual(res_list_filtered.status_code, status.HTTP_403_FORBIDDEN)

        res_list_all = self.client.get("/api/ai/summaries/")
        self.assertEqual(res_list_all.status_code, status.HTTP_200_OK)
        self.assertEqual(len(self._items(res_list_all)), 0)

        res_detail = self.client.get(f"/api/ai/summaries/{self.synthese_p.id}/")
        self.assertEqual(res_detail.status_code, status.HTTP_403_FORBIDDEN)

        res_val = self.client.post(
            f"/api/ai/summaries/{self.synthese_p.id}/validate/",
            {"texte_final": "Validation pirate", "motif": "Test"},
            format="json",
        )
        self.assertEqual(res_val.status_code, status.HTTP_403_FORBIDDEN)

        res_rej = self.client.post(
            f"/api/ai/summaries/{self.synthese_p.id}/reject/",
            {"motif": "Rejet pirate"},
            format="json",
        )
        self.assertEqual(res_rej.status_code, status.HTTP_403_FORBIDDEN)
        self.synthese_p.refresh_from_db()
        self.assertEqual(self.synthese_p.statut, "EN_ATTENTE")

    def test_15_alioune_dione_cannot_initiate_transfer_for_p(self):
        """15. Alioune Dione ne peut pas initier un transfert pour P."""
        self.client.force_authenticate(user=self.alioune_dione)
        res = self.client.post(
            "/api/transfers/",
            {
                "patient_id": self.patient_p.id,
                "etablissement_destination_id": self.etab_c.id,
                "priorite": "HAUTE",
                "motif_transfert": "Tentative de transfert sans prise en charge",
                "resume_clinique": "Non autorisé",
            },
            format="json",
        )
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(Transfert.objects.filter(patient=self.patient_p).count(), 0)

    def test_16_doctor_from_establishment_c_cannot_accept_or_reject_transfer_destined_to_b(self):
        """16. Un médecin d'un établissement C ne peut pas accepter ou refuser un transfert destiné à B."""
        self.client.force_authenticate(user=self.dr_ndiaye)
        res_create = self.client.post(
            "/api/transfers/",
            {
                "patient_id": self.patient_p.id,
                "etablissement_destination_id": self.etab_b.id,
                "priorite": "URGENTE",
                "motif_transfert": "Prise en charge spécialisée à Dakar",
                "resume_clinique": "Patient nécessitant plateau technique HPD",
            },
            format="json",
        )
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        transfer_id = res_create.data["id"]

        # Le médecin de l'établissement C tente d'accepter et de refuser le transfert destiné à B
        self.client.force_authenticate(user=self.dr_etab_c)
        res_accept_c = self.client.post(
            f"/api/transfers/{transfer_id}/accept/",
            {"motif": "Tentative d'interception par établissement C"},
            format="json",
        )
        self.assertEqual(res_accept_c.status_code, status.HTTP_403_FORBIDDEN)

        res_reject_c = self.client.post(
            f"/api/transfers/{transfer_id}/reject/",
            {"motif": "Refus illégitime par établissement C"},
            format="json",
        )
        self.assertEqual(res_reject_c.status_code, status.HTTP_403_FORBIDDEN)

        transfert = Transfert.objects.get(pk=transfer_id)
        self.assertEqual(transfert.statut, "DEMANDE")
        self.pec_p.refresh_from_db()
        self.assertEqual(self.pec_p.statut, "ACTIF")

    def test_17_accepted_transfer_switches_access_to_receiving_doctor_in_b_and_closes_a(self):
        """17. Un transfert accepté par B transfère correctement l'accès au médecin récepteur de B et ferme l'accès ordinaire de A."""
        self.client.force_authenticate(user=self.dr_ndiaye)
        res_create = self.client.post(
            "/api/transfers/",
            {
                "patient_id": self.patient_p.id,
                "etablissement_destination_id": self.etab_b.id,
                "priorite": "HAUTE",
                "motif_transfert": "Transfert cardiologie interventionnelle",
                "resume_clinique": "Exploration hémodynamique requise",
            },
            format="json",
        )
        self.assertEqual(res_create.status_code, status.HTTP_201_CREATED)
        transfer_id = res_create.data["id"]

        # Alioune Dione (établissement B) accepte le transfert
        self.client.force_authenticate(user=self.alioune_dione)
        res_accept = self.client.post(
            f"/api/transfers/{transfer_id}/accept/",
            {"motif": "Patient admis à HPD"},
            format="json",
        )
        self.assertEqual(res_accept.status_code, status.HTTP_200_OK)

        # Alioune Dione a désormais accès complet au dossier médical de P
        res_dossier_b = self.client.get(f"/api/medical-records/by-patient/{self.patient_p.id}/")
        self.assertEqual(res_dossier_b.status_code, status.HTTP_200_OK)

        # Dr Ndiaye (établissement A) n'a plus la prise en charge active et perd l'accès ordinaire au dossier de P
        self.pec_p.refresh_from_db()
        self.assertEqual(self.pec_p.statut, "TRANSFERE")
        self.client.force_authenticate(user=self.dr_ndiaye)
        res_dossier_a = self.client.get(f"/api/medical-records/by-patient/{self.patient_p.id}/")
        self.assertEqual(res_dossier_a.status_code, status.HTTP_403_FORBIDDEN)

    def test_18_19_20_emergency_break_glass_authorization_audit_notification_and_expiration_revocation(self):
        """
        18. Alioune Dione peut demander un accès d'urgence motivé à P et consulter le dossier pendant la durée d'autorisation.
        19. L'accès d'urgence d'Alioune Dione est journalisé et génère une notification vers le médecin responsable.
        20. Une fois l'autorisation d'urgence expirée ou révoquée, Alioune Dione perd immédiatement l'accès au dossier médical de P.
        """
        self.client.force_authenticate(user=self.alioune_dione)

        # Avant toute demande d'urgence : accès refusé (403)
        res_before = self.client.get(f"/api/medical-records/by-patient/{self.patient_p.id}/")
        self.assertEqual(res_before.status_code, status.HTTP_403_FORBIDDEN)

        # Scénario 18 : Demande explicite d'autorisation d'urgence (« Break-Glass »)
        res_req = self.client.post(
            "/api/emergencies/request-access/",
            {
                "patient_id": self.patient_p.id,
                "motif_urgence": "Oedème aigu du poumon",
                "justification_acces": "Patient admis aux urgences de Dakar en détresse respiratoire aiguë",
                "niveau_acces": "LECTURE_SEULE",
            },
            format="json",
        )
        self.assertEqual(res_req.status_code, status.HTTP_201_CREATED)
        auth_id = res_req.data["id"]
        self.assertEqual(res_req.data["statut"], "ACTIVE")

        # Pendant la durée de validité, Alioune Dione peut consulter le dossier médical
        res_during = self.client.get(f"/api/medical-records/by-patient/{self.patient_p.id}/")
        self.assertEqual(res_during.status_code, status.HTTP_200_OK)
        self.assertEqual(res_during.data["contexte_acces"]["mode"], "EMERGENCY_ACCESS")
        self.assertEqual(res_during.data["contexte_acces"]["niveau_acces"], "LECTURE_SEULE")

        # En LECTURE_SEULE, il ne peut toujours pas modifier un traitement ni créer une consultation ordinaire
        res_write_denied = self.client.post(
            "/api/traitements/",
            {
                "dossier": self.dossier_p.id,
                "medicament": "Furosémide",
                "posologie": "40mg IV",
                "date_debut": str(timezone.localdate()),
            },
            format="json",
        )
        self.assertEqual(res_write_denied.status_code, status.HTTP_403_FORBIDDEN)

        # Scénario 19 : Vérification du journal d'audit EMERGENCY_ACCESS et de la notification au Dr Ndiaye
        self.assertTrue(
            JournalAcces.objects.filter(
                utilisateur=self.alioune_dione,
                action="EMERGENCY_ACCESS",
                statut="SUCCES",
            ).exists()
        )
        self.assertTrue(
            Notification.objects.filter(
                destinataire=self.dr_ndiaye,
                type_notification="URGENCE_EXTERNE",
            ).exists()
        )

        # Scénario 20a : Révocation explicite -> perte immédiate de l'accès
        res_revoke = self.client.post(
            "/api/emergencies/revoke-access/",
            {"autorisation_id": auth_id, "motif": "Fin de la lecture d'urgence"},
            format="json",
        )
        self.assertEqual(res_revoke.status_code, status.HTTP_200_OK)
        self.assertTrue(
            JournalAcces.objects.filter(
                utilisateur=self.alioune_dione,
                action="EMERGENCY_ACCESS_REVOKED",
                statut="SUCCES",
            ).exists()
        )

        res_after_revoke = self.client.get(f"/api/medical-records/by-patient/{self.patient_p.id}/")
        self.assertEqual(res_after_revoke.status_code, status.HTTP_403_FORBIDDEN)

        # Scénario 20b : Nouvelle autorisation puis expiration temporelle -> perte immédiate de l'accès
        res_req_2 = self.client.post(
            "/api/emergencies/request-access/",
            {
                "patient_id": self.patient_p.id,
                "motif_urgence": "Récidive dyspnéique",
                "justification_acces": "Réévaluation urgente aux urgences",
                "niveau_acces": "INTERVENTION_CLINIQUE",
            },
            format="json",
        )
        self.assertEqual(res_req_2.status_code, status.HTTP_201_CREATED)
        auth_2 = AutorisationUrgence.objects.get(pk=res_req_2.data["id"])

        # Simulation de l'expiration temporelle
        auth_2.date_expiration = timezone.now() - timedelta(minutes=5)
        auth_2.save(update_fields=["date_expiration"])

        res_after_expire = self.client.get(f"/api/medical-records/by-patient/{self.patient_p.id}/")
        self.assertEqual(res_after_expire.status_code, status.HTTP_403_FORBIDDEN)
        auth_2.refresh_from_db()
        self.assertEqual(auth_2.statut, "EXPIREE")
        self.assertTrue(
            JournalAcces.objects.filter(
                action="EMERGENCY_ACCESS_EXPIRED",
                entite_id=auth_2.id,
            ).exists()
        )


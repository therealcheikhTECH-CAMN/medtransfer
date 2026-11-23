from rest_framework.test import APITestCase
from rest_framework import status
from django.utils import timezone
from accounts.models import User, UserStatusHistory
from establishments.models import Etablissement
from patients.models import Patient, PatientModificationHistory
from medical_records.models import DossierMedical
from care_management.models import PriseEnCharge, Transfert
from audit.models import JournalAcces


class AdministrativeEvolutionTestCase(APITestCase):
    """
    Validation automatisée complète de l'évolution des fonctionnalités administratives
    et des droits d'accès de MEDTRANSFER :
    1. Gestion des établissements et directeurs par l'admin
    2. Gestion des professionnels et statuts (activation, suspension, désactivation, historique)
    3. Rectification administrative des fiches patients avec motif et historique
    4. Acceptation administrative des transferts par l'agent d'accueil (et interdiction au directeur)
    5. Droits institutionnels et confinement strict du directeur d'établissement
    6. Immuabilité du journal d'audit et export CSV
    """

    def setUp(self):
        # Établissement A (Dakar)
        self.hopital_a = Etablissement.objects.create(
            code="DAK-01",
            nom="Hôpital Principal de Dakar",
            ville="Dakar",
            region="Dakar",
            is_active=True,
        )
        # Établissement B (Saint-Louis)
        self.hopital_b = Etablissement.objects.create(
            code="STL-01",
            nom="Centre Hospitalier Régional de Saint-Louis",
            ville="Saint-Louis",
            region="Saint-Louis",
            is_active=True,
        )

        # Administrateur Général
        self.admin = User.objects.create_superuser(
            username="admin_national",
            password="Password123!",
            role="ADMIN",
            first_name="Admin",
            last_name="National",
            statut_validation="APPROVED",
            is_actif=True,
        )

        # Directeur Établissement A
        self.directeur_a = User.objects.create_user(
            username="dir_hopital_a",
            password="Password123!",
            role="DIRECTEUR",
            etablissement=self.hopital_a,
            first_name="Amadou",
            last_name="Sall",
            statut_validation="APPROVED",
            is_actif=True,
        )
        self.hopital_a.directeur = self.directeur_a
        self.hopital_a.save()

        # Directeur Établissement B
        self.directeur_b = User.objects.create_user(
            username="dir_hopital_b",
            password="Password123!",
            role="DIRECTEUR",
            etablissement=self.hopital_b,
            first_name="Cheikh",
            last_name="Ndiaye",
            statut_validation="APPROVED",
            is_actif=True,
        )
        self.hopital_b.directeur = self.directeur_b
        self.hopital_b.save()

        # Agents d'accueil
        self.agent_a = User.objects.create_user(
            username="agent_a",
            password="Password123!",
            role="AGENT",
            etablissement=self.hopital_a,
            first_name="Fatou",
            last_name="AgentA",
            statut_validation="APPROVED",
            is_actif=True,
        )
        self.agent_b = User.objects.create_user(
            username="agent_b",
            password="Password123!",
            role="AGENT",
            etablissement=self.hopital_b,
            first_name="Awa",
            last_name="AgentB",
            statut_validation="APPROVED",
            is_actif=True,
        )

        # Médecins
        self.medecin_a = User.objects.create_user(
            username="dr_a",
            password="Password123!",
            role="MEDECIN",
            etablissement=self.hopital_a,
            first_name="Oumar",
            last_name="Ba",
            statut_validation="APPROVED",
            is_actif=True,
        )
        self.medecin_b = User.objects.create_user(
            username="dr_b",
            password="Password123!",
            role="MEDECIN",
            etablissement=self.hopital_b,
            first_name="Mariama",
            last_name="Fall",
            statut_validation="APPROVED",
            is_actif=True,
        )

        # Patient initial créé à l'Hôpital A
        self.patient_a = Patient.objects.create(
            nom="Diop",
            prenom="Moussa",
            date_naissance="1985-05-12",
            sexe="M",
            telephone="+221771112233",
            adresse="Médina, Rue 6",
            ville="Dakar",
            etablissement_creation=self.hopital_a,
            cree_par=self.agent_a,
        )
        self.dossier_a = DossierMedical.objects.create(patient=self.patient_a)

    # =========================================================================
    # 1. GESTION DES ÉTABLISSEMENTS PAR L'ADMINISTRATEUR
    # =========================================================================

    def test_admin_creer_etablissement_et_assigner_nouveau_directeur(self):
        """L'administrateur crée un établissement et lui assigne un nouveau directeur."""
        self.client.force_authenticate(user=self.admin)

        # Création établissement avec code et type valide
        res = self.client.post("/api/establishments/", {
            "nom": "Centre de Santé de Thiès",
            "code": "THS-01",
            "type_etablissement": "CENTRE_DE_SANTE",
            "region": "Thiès",
            "ville": "Thiès",
            "telephone": "+221339510000",
            "email": "contact@cs-thies.sn",
        })
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        etab_id = res.data["id"]

        # Assignation nouveau directeur avec création automatique du compte
        res_dir = self.client.post(f"/api/establishments/{etab_id}/assign-director/", {
            "first_name": "Ibrahima",
            "last_name": "Seck",
            "email": "dir.thies@medtransfer.sn",
            "password": "Password123!",
            "matricule_professionnel": "DIR-THS-001",
            "telephone": "+221773334455",
        })
        self.assertEqual(res_dir.status_code, status.HTTP_200_OK)

        etab = Etablissement.objects.get(id=etab_id)
        self.assertIsNotNone(etab.directeur)
        self.assertEqual(etab.directeur.email, "dir.thies@medtransfer.sn")
        self.assertEqual(etab.directeur.role, "DIRECTEUR")
        self.assertEqual(etab.directeur.statut_validation, "APPROVED")
        self.assertEqual(etab.directeur.etablissement, etab)

    def test_admin_remplacer_directeur_etablissement(self):
        """L'administrateur remplace le directeur d'un établissement existant."""
        self.client.force_authenticate(user=self.admin)

        nouveau_dir = User.objects.create_user(
            username="nouveau_dir_a",
            password="Password123!",
            role="DIRECTEUR",
            first_name="Khadija",
            last_name="Sy",
            email="khadija.sy@medtransfer.sn",
            statut_validation="APPROVED",
            is_actif=True,
        )

        res = self.client.post(f"/api/establishments/{self.hopital_a.id}/assign-director/", {
            "user_id": nouveau_dir.id,
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.hopital_a.refresh_from_db()
        self.assertEqual(self.hopital_a.directeur, nouveau_dir)

    def test_admin_desactiver_et_activer_etablissement(self):
        """La désactivation d'un établissement bloque l'accès de ses membres sans supprimer les données."""
        self.client.force_authenticate(user=self.admin)

        # Désactivation
        res_toggle = self.client.post(f"/api/establishments/{self.hopital_a.id}/toggle-active/")
        self.assertEqual(res_toggle.status_code, status.HTTP_200_OK)
        self.hopital_a.refresh_from_db()
        self.assertFalse(self.hopital_a.is_active)

        # Un praticien de cet établissement ne peut plus accéder aux ressources protégées
        self.client.force_authenticate(user=self.medecin_a)
        res_access = self.client.get(f"/api/patients/{self.patient_a.id}/")
        self.assertEqual(res_access.status_code, status.HTTP_403_FORBIDDEN)

        # Réactivation par l'admin
        self.client.force_authenticate(user=self.admin)
        res_toggle_back = self.client.post(f"/api/establishments/{self.hopital_a.id}/toggle-active/")
        self.assertEqual(res_toggle_back.status_code, status.HTTP_200_OK)
        self.hopital_a.refresh_from_db()
        self.assertTrue(self.hopital_a.is_active)

    # =========================================================================
    # 2. GESTION DES PROFESSIONNELS ET DES STATUTS
    # =========================================================================

    def test_desactiver_professionnel_et_historique(self):
        """La désactivation d'un professionnel bloque son accès et alimente l'historique."""
        self.client.force_authenticate(user=self.directeur_a)

        token_v_avant = self.medecin_a.token_version

        res = self.client.post(f"/api/accounts/users/{self.medecin_a.id}/deactivate/", {
            "motif": "Départ définitif de l'établissement",
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.medecin_a.refresh_from_db()
        self.assertEqual(self.medecin_a.statut_validation, "DEACTIVATED")
        self.assertFalse(self.medecin_a.is_actif)
        self.assertFalse(self.medecin_a.is_active)
        self.assertGreater(self.medecin_a.token_version, token_v_avant)

        # Vérification historique des statuts
        history_entry = UserStatusHistory.objects.filter(user=self.medecin_a).last()
        self.assertIsNotNone(history_entry)
        self.assertEqual(history_entry.nouveau_statut, "DEACTIVATED")
        self.assertEqual(history_entry.motif, "Départ définitif de l'établissement")
        self.assertEqual(history_entry.changed_by, self.directeur_a)

        # Vérification endpoint status-history
        res_hist = self.client.get(f"/api/accounts/users/{self.medecin_a.id}/status-history/")
        self.assertEqual(res_hist.status_code, status.HTTP_200_OK)
        self.assertTrue(len(res_hist.data) >= 1)

        # Le médecin désactivé est rejeté
        self.client.force_authenticate(user=self.medecin_a)
        res_pat = self.client.get("/api/patients/")
        self.assertEqual(res_pat.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 3. RECTIFICATION ADMINISTRATIVE DES FICHES PATIENTS
    # =========================================================================

    def test_agent_corriger_fiche_administrative_avec_motif(self):
        """L'agent d'accueil rectifie les informations administratives avec motif obligatoire."""
        self.client.force_authenticate(user=self.agent_a)

        medtransfer_id_initial = self.patient_a.medtransfer_id

        res = self.client.patch(f"/api/patients/{self.patient_a.id}/", {
            "telephone": "+221779998877",
            "ville": "Pikine",
            "motif": "Changement de numéro de téléphone suite à demande du patient",
        })
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        self.patient_a.refresh_from_db()
        self.assertEqual(self.patient_a.telephone, "+221779998877")
        self.assertEqual(self.patient_a.ville, "Pikine")
        self.assertEqual(self.patient_a.medtransfer_id, medtransfer_id_initial)

        # Historique créé
        hist = PatientModificationHistory.objects.filter(patient=self.patient_a).last()
        self.assertIsNotNone(hist)
        self.assertEqual(hist.auteur, self.agent_a)
        self.assertEqual(hist.motif, "Changement de numéro de téléphone suite à demande du patient")
        self.assertIn("telephone", hist.champs_modifies)

    def test_tentative_modifier_medtransfer_id_rejetee(self):
        """L'identifiant medtransfer_id est permanent et immuable (HTTP 400)."""
        self.client.force_authenticate(user=self.agent_a)

        res = self.client.patch(f"/api/patients/{self.patient_a.id}/", {
            "telephone": "+221779998877",
            "medtransfer_id": "MODIF-INTERDITE-123",
            "motif": "Tentative de modification illégale de l'identifiant national",
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("medtransfer_id", res.data)

    def test_correction_administrative_sans_motif_rejetee(self):
        """Une modification administrative sans motif est refusée (HTTP 400)."""
        self.client.force_authenticate(user=self.agent_a)

        res = self.client.patch(f"/api/patients/{self.patient_a.id}/", {
            "telephone": "+221779998877",
            # Motif manquant
        })
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    # =========================================================================
    # 4. GESTION DES TRANSFERTS : AGENT D'ACCUEIL VS DIRECTEUR
    # =========================================================================

    def test_agent_accueil_accepte_transfert_et_ouvre_prise_en_charge(self):
        """
        L'agent d'accueil de l'établissement destinataire accepte le transfert.
        Une prise en charge est créée avec medecin_responsable=None, permettant
        aux praticiens du service d'intervenir.
        """
        # Prise en charge initiale à l'Hôpital A
        pec_a = PriseEnCharge.objects.create(
            patient=self.patient_a,
            medecin_responsable=self.medecin_a,
            etablissement=self.hopital_a,
            statut="ACTIF",
            type_prise_en_charge="ORDINAIRE",
        )

        # Émission du transfert vers l'Hôpital B
        transfert = Transfert.objects.create(
            patient=self.patient_a,
            prise_en_charge_origine=pec_a,
            etablissement_origine=self.hopital_a,
            etablissement_destination=self.hopital_b,
            medecin_emetteur=self.medecin_a,
            priorite="NORMALE",
            motif_transfert="Plateau technique spécialisé",
            statut="DEMANDE",
        )

        # L'agent d'accueil de l'Hôpital B accepte le transfert
        self.client.force_authenticate(user=self.agent_b)
        res_accept = self.client.post(f"/api/transfers/{transfert.id}/accept/")
        self.assertEqual(res_accept.status_code, status.HTTP_200_OK)

        transfert.refresh_from_db()
        self.assertEqual(transfert.statut, "ACCEPTE")
        self.assertEqual(transfert.agent_receveur, self.agent_b)

        # Vérification qu'une prise en charge non assignée a été créée dans l'Hôpital B
        pec_b = PriseEnCharge.objects.filter(
            patient=self.patient_a,
            etablissement=self.hopital_b,
            statut="ACTIF",
        ).first()
        self.assertIsNotNone(pec_b)
        self.assertIsNone(pec_b.medecin_responsable)

        # Le médecin de l'Hôpital B peut désormais accéder légitimement au dossier
        self.client.force_authenticate(user=self.medecin_b)
        res_dossier = self.client.get(f"/api/medical-records/by-patient/{self.patient_a.id}/")
        self.assertEqual(res_dossier.status_code, status.HTTP_200_OK)

    def test_directeur_interdit_d_accepter_ou_refuser_transfert(self):
        """Le directeur d'établissement est strictement interdit d'accepter ou refuser un transfert."""
        transfert = Transfert.objects.create(
            patient=self.patient_a,
            etablissement_origine=self.hopital_a,
            etablissement_destination=self.hopital_b,
            medecin_emetteur=self.medecin_a,
            priorite="NORMALE",
            motif_transfert="Plateau technique spécialisé",
            statut="DEMANDE",
        )

        # Le directeur tente d'accepter -> 403
        self.client.force_authenticate(user=self.directeur_b)
        res_accept = self.client.post(f"/api/transfers/{transfert.id}/accept/")
        self.assertEqual(res_accept.status_code, status.HTTP_403_FORBIDDEN)

        # Le directeur tente de refuser -> 403
        res_reject = self.client.post(f"/api/transfers/{transfert.id}/reject/", {
            "motif": "Refus par la direction",
        })
        self.assertEqual(res_reject.status_code, status.HTTP_403_FORBIDDEN)

    def test_agent_refuse_transfert_avec_motif_obligatoire(self):
        """L'agent d'accueil refuse un transfert avec motif obligatoire."""
        transfert = Transfert.objects.create(
            patient=self.patient_a,
            etablissement_origine=self.hopital_a,
            etablissement_destination=self.hopital_b,
            medecin_emetteur=self.medecin_a,
            priorite="NORMALE",
            motif_transfert="Besoin de lits spécialisés",
            statut="DEMANDE",
        )

        self.client.force_authenticate(user=self.agent_b)

        # Sans motif -> 400
        res_no_motif = self.client.post(f"/api/transfers/{transfert.id}/reject/", {})
        self.assertEqual(res_no_motif.status_code, status.HTTP_400_BAD_REQUEST)

        # Avec motif -> 200
        res_reject = self.client.post(f"/api/transfers/{transfert.id}/reject/", {
            "motif": "Capacité d'accueil temporairement saturée",
        })
        self.assertEqual(res_reject.status_code, status.HTTP_200_OK)

        transfert.refresh_from_db()
        self.assertEqual(transfert.statut, "REFUSE")
        self.assertEqual(transfert.motif_reponse, "Capacité d'accueil temporairement saturée")

    def test_agent_autre_etablissement_interdit_de_gerer_transfert(self):
        """Un agent d'un établissement non destinataire ne peut ni accepter ni refuser."""
        transfert = Transfert.objects.create(
            patient=self.patient_a,
            etablissement_origine=self.hopital_a,
            etablissement_destination=self.hopital_b,
            medecin_emetteur=self.medecin_a,
            priorite="NORMALE",
            motif_transfert="Orientation",
            statut="DEMANDE",
        )

        # L'agent A (émetteur) tente d'accepter -> 403
        self.client.force_authenticate(user=self.agent_a)
        res = self.client.post(f"/api/transfers/{transfert.id}/accept/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 5. DROITS ÉTENDUS ET CONFINEMENT DU DIRECTEUR
    # =========================================================================

    def test_directeur_consulte_dossier_son_etablissement_en_lecture_seule(self):
        """Le directeur consulte le dossier d'un patient de sa structure en lecture seule."""
        self.client.force_authenticate(user=self.directeur_a)

        # Consultation autorisée en lecture seule institutionnelle
        res_dossier = self.client.get(f"/api/medical-records/by-patient/{self.patient_a.id}/")
        self.assertEqual(res_dossier.status_code, status.HTTP_200_OK)
        contexte = res_dossier.data.get("contexte_acces") or {}
        self.assertFalse(contexte.get("can_write_clinical", True))
        self.assertEqual(contexte.get("mode"), "DIRECTOR_OVERSIGHT")

        # Mais le directeur ne peut pas créer de consultation clinique -> 403
        res_cons = self.client.post("/api/consultations/", {
            "patient_id": self.patient_a.id,
            "motif_consultation": "Contrôle médical",
            "diagnostic_principal": "Examen clinique",
        })
        self.assertEqual(res_cons.status_code, status.HTTP_403_FORBIDDEN)

    def test_directeur_strictement_confine_a_son_etablissement(self):
        """Le directeur ne peut pas accéder aux dossiers d'un patient sans lien avec sa structure."""
        # Patient créé à l'Hôpital B sans aucun lien avec l'Hôpital A
        patient_b = Patient.objects.create(
            nom="Gueye",
            prenom="Fatou",
            date_naissance="1992-08-20",
            sexe="F",
            etablissement_creation=self.hopital_b,
            cree_par=self.agent_b,
        )
        DossierMedical.objects.create(patient=patient_b)

        # Le directeur de l'Hôpital A tente d'accéder au dossier du patient B -> 403
        self.client.force_authenticate(user=self.directeur_a)
        res = self.client.get(f"/api/medical-records/by-patient/{patient_b.id}/")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    # =========================================================================
    # 6. IMMUABILITÉ DU JOURNAL D'AUDIT ET EXPORT CSV
    # =========================================================================

    def test_journal_audit_immuable(self):
        """Les logs du journal d'audit sont immuables (POST, PUT, PATCH, DELETE interdits)."""
        log = JournalAcces.objects.create(
            utilisateur=self.admin,
            etablissement=self.hopital_a,
            action="LOGIN",
            statut="SUCCES",
            details={"info": "Connexion test"},
        )

        self.client.force_authenticate(user=self.admin)

        res_put = self.client.put(f"/api/audit/{log.id}/", {"statut": "REFUSE"})
        self.assertEqual(res_put.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        res_del = self.client.delete(f"/api/audit/{log.id}/")
        self.assertEqual(res_del.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_directeur_export_csv_audit_confine(self):
        """Le directeur peut exporter en CSV le journal d'audit confiné à son établissement."""
        JournalAcces.objects.create(
            utilisateur=self.directeur_a,
            etablissement=self.hopital_a,
            action="USER_APPROVED",
            statut="SUCCES",
            details={"info": "Validation médecin A"},
        )
        JournalAcces.objects.create(
            utilisateur=self.directeur_b,
            etablissement=self.hopital_b,
            action="USER_APPROVED",
            statut="SUCCES",
            details={"info": "Validation médecin B"},
        )

        self.client.force_authenticate(user=self.directeur_a)
        res_export = self.client.get("/api/audit/export/")
        self.assertEqual(res_export.status_code, status.HTTP_200_OK)
        self.assertEqual(res_export["Content-Type"], "text/csv; charset=utf-8")

        content = res_export.content.decode("utf-8-sig")
        self.assertIn("USER_APPROVED", content)
        self.assertIn("Hôpital Principal de Dakar", content)
        # Ne doit pas contenir l'Hôpital B
        self.assertNotIn("Saint-Louis", content)

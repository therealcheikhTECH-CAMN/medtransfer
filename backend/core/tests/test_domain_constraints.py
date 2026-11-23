from django.test import TestCase
from django.db import IntegrityError, transaction
from django.utils import timezone
from accounts.models import User
from establishments.models import Etablissement
from patients.models import Patient
from medical_records.models import DossierMedical, Antecedent, Allergie
from consultations.models import Consultation, ConsultationRevision
from care_management.models import PriseEnCharge, Transfert
from emergencies.models import InterventionUrgence
from ai_assistant.models import SyntheseIA
from notifications.models import Notification
from audit.models import JournalAcces, enregistrer_journal


class DomainConstraintsTestCase(TestCase):
    """
    Validation rigoureuse des contraintes d'intégrité et règles métier de MEDTRANSFER.
    """

    def setUp(self):
        # 1. Création de deux établissements
        self.hopital_a = Etablissement.objects.create(
            code="HRZ",
            nom="Hôpital Régional de Ziguinchor",
            type_etablissement="CENTRE_HOSPITALIER_REGIONAL",
            region="Ziguinchor",
            ville="Ziguinchor",
            services_declares="Urgences, Médecine Interne, Pédiatrie"
        )
        self.hopital_b = Etablissement.objects.create(
            code="CHU-FANN",
            nom="Centre Hospitalier Universitaire de Fann",
            type_etablissement="HOPITAL_NATIONAL",
            region="Dakar",
            ville="Dakar",
            services_declares="Neurologie, Urgences, Maladies Infectieuses"
        )

        # 2. Utilisateurs
        self.admin = User.objects.create_user(
            username="admin_sys",
            password="Password123!",
            role="ADMIN",
            first_name="Admin",
            last_name="Technique"
        )
        self.agent_a = User.objects.create_user(
            username="agent_zig",
            password="Password123!",
            role="AGENT",
            etablissement=self.hopital_a,
            first_name="Fatou",
            last_name="Diop"
        )
        self.medecin_a = User.objects.create_user(
            username="dr_diallo",
            password="Password123!",
            role="MEDECIN",
            etablissement=self.hopital_a,
            matricule_professionnel="MED-SN-001",
            specialite="Médecine générale",
            first_name="Mamadou",
            last_name="Diallo"
        )
        self.medecin_b = User.objects.create_user(
            username="dr_sow",
            password="Password123!",
            role="MEDECIN",
            etablissement=self.hopital_b,
            matricule_professionnel="MED-SN-002",
            specialite="Neurologie",
            first_name="Aïssatou",
            last_name="Sow"
        )

        # 3. Patient et dossier médical
        self.patient = Patient.objects.create(
            nom="Sagna",
            prenom="Ousmane",
            date_naissance="1988-04-12",
            sexe="M",
            numero_identification_nationale="1888198800123",
            telephone="+221771234567",
            ville="Ziguinchor",
            etablissement_creation=self.hopital_a,
            cree_par=self.agent_a,
            status_identite="CONFIRMEE"
        )
        self.dossier = DossierMedical.objects.create(patient=self.patient)

    def test_unicite_dossier_medical_par_patient(self):
        """Contrainte : Un patient ne peut avoir qu'un seul dossier médical principal."""
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                DossierMedical.objects.create(patient=self.patient)

    def test_unicite_prise_en_charge_ordinaire_active(self):
        """
        Contrainte PostgreSQL & Modèle :
        Un patient ne peut avoir qu'UNE SEULE prise en charge ordinaire ACTIF à la fois.
        """
        # Première prise en charge ordinaire à l'hôpital A
        pec1 = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.hopital_a,
            medecin_responsable=self.medecin_a,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF'
        )
        self.assertEqual(pec1.statut, 'ACTIF')

        # Tentative d'ouverture d'une seconde prise en charge ordinaire ACTIF à l'hôpital B
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                PriseEnCharge.objects.create(
                    patient=self.patient,
                    etablissement=self.hopital_b,
                    medecin_responsable=self.medecin_b,
                    type_prise_en_charge='ORDINAIRE',
                    statut='ACTIF'
                )

    def test_prises_en_charge_successives_apres_cloture(self):
        """Une fois l'ancienne prise en charge clôturée, une nouvelle peut être ouverte."""
        pec1 = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.hopital_a,
            medecin_responsable=self.medecin_a,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF'
        )
        pec1.cloturer(motif="Fin de traitement")
        self.assertEqual(pec1.statut, 'CLOTURE')

        # Une nouvelle prise en charge ordinaire peut maintenant être ouverte
        pec2 = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.hopital_b,
            medecin_responsable=self.medecin_b,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF'
        )
        self.assertEqual(pec2.statut, 'ACTIF')
        self.assertEqual(self.patient.prises_en_charge.count(), 2)

    def test_workflow_transfert_inter_etablissements(self):
        """
        Workflow de transfert :
        L'acceptation d'un transfert clôture la PEC d'origine comme 'TRANSFERE'
        et ouvre la nouvelle PEC dans l'établissement cible sans violer la contrainte d'unicité.
        """
        pec_origine = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.hopital_a,
            medecin_responsable=self.medecin_a,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF'
        )

        transfert = Transfert.objects.create(
            patient=self.patient,
            prise_en_charge_origine=pec_origine,
            etablissement_origine=self.hopital_a,
            etablissement_destination=self.hopital_b,
            medecin_emetteur=self.medecin_a,
            priorite='HAUTE',
            motif_transfert="Nécessite plateau technique de neurologie",
            resume_clinique="Céphalées fébriles suspectes de méningo-encéphalite"
        )
        self.assertEqual(transfert.statut, 'DEMANDE')

        # Le médecin de Fann accepte le transfert
        nouvelle_pec = transfert.accepter(medecin_receveur=self.medecin_b, motif="Place disponible en neurologie")

        transfert.refresh_from_db()
        pec_origine.refresh_from_db()

        self.assertEqual(transfert.statut, 'ACCEPTE')
        self.assertEqual(pec_origine.statut, 'TRANSFERE')
        self.assertEqual(nouvelle_pec.statut, 'ACTIF')
        self.assertEqual(nouvelle_pec.etablissement, self.hopital_b)

        # Vérification qu'il n'y a toujours qu'une seule prise en charge active au total
        actives = PriseEnCharge.objects.filter(patient=self.patient, statut='ACTIF')
        self.assertEqual(actives.count(), 1)
        self.assertEqual(actives.first().etablissement, self.hopital_b)

    def test_intervention_urgence_hors_rattachement(self):
        """
        Règle d'or :
        Un patient suivi à l'hôpital A arrive en urgence à l'hôpital B.
        Le médecin de B intervient SANS clôturer la prise en charge de A,
        SANS ouvrir de prise en charge ordinaire à B, et SANS créer de second dossier médical.
        """
        pec_a = PriseEnCharge.objects.create(
            patient=self.patient,
            etablissement=self.hopital_a,
            medecin_responsable=self.medecin_a,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF'
        )

        # Consultation d'urgence à l'hôpital B
        consultation_urg = Consultation.objects.create(
            dossier=self.dossier,
            etablissement=self.hopital_b,
            medecin=self.medecin_b,
            motif="Accident de la voie publique à Dakar",
            observations_cliniques="Traumatisme crânien sans perte de connaissance",
            diagnostic="Contusion crânienne bénigne",
            prescription="Paracétamol 1g x 3/j, surveillance 24h",
            is_emergency=True
        )

        intervention = InterventionUrgence.objects.create(
            patient=self.patient,
            etablissement=self.hopital_b,
            medecin=self.medecin_b,
            consultation=consultation_urg,
            motif_urgence="Traumatisme crânien aigu",
            justification_acces_derogatoire="Patient inconscient sur voie publique, vérification antécédents et allergies",
            notification_envoyee=True
        )

        # Vérifications fondamentales
        pec_a.refresh_from_db()
        self.assertEqual(pec_a.statut, 'ACTIF', "La prise en charge de l'hôpital d'origine doit rester active")
        self.assertEqual(self.dossier.consultations.count(), 1)
        self.assertEqual(self.dossier.patient.id, self.patient.id, "Le dossier médical reste unique")

    def test_historique_consultations_cumulatif_et_revision(self):
        """
        L'historique des consultations est cumulatif.
        Aucune ancienne consultation n'est écrasée.
        Toute rectification conserve les anciennes valeurs.
        """
        c1 = Consultation.objects.create(
            dossier=self.dossier,
            etablissement=self.hopital_a,
            medecin=self.medecin_a,
            motif="Fièvre persistante",
            observations_cliniques="Température 38.8C",
            diagnostic="Paludisme simple présumé",
            prescription="CTA 1 cp x 2/j"
        )

        c2 = Consultation.objects.create(
            dossier=self.dossier,
            etablissement=self.hopital_b,
            medecin=self.medecin_b,
            motif="Contrôle et céphalées",
            observations_cliniques="Température 37.1C",
            diagnostic="Paludisme en voie de guérison",
            prescription="Repos"
        )

        self.assertEqual(self.dossier.consultations.count(), 2)

        # Rectification médicolégale de la consultation c1
        anciennes_valeurs = {
            "diagnostic": c1.diagnostic,
            "prescription": c1.prescription
        }
        c1.diagnostic = "Paludisme à Plasmodium falciparum confirmé par TDR"
        c1.is_amended = True
        c1.save()

        revision = ConsultationRevision.objects.create(
            consultation=c1,
            auteur_modification=self.medecin_a,
            motif_modification="Précision du résultat du TDR reçu du laboratoire",
            anciennes_valeurs=anciennes_valeurs
        )

        self.assertEqual(c1.revisions.count(), 1)
        self.assertEqual(revision.anciennes_valeurs["diagnostic"], "Paludisme simple présumé")

    def test_identite_provisoire_et_rapprochement(self):
        """
        Création d'une fiche d'urgence avec identité provisoire,
        puis rapprochement contrôlé vers le dossier définitif.
        """
        patient_provisoire = Patient.objects.create(
            nom="X",
            prenom="Inconnu_Urgence",
            sexe="I",
            status_identite="A_CONFIRMER",
            motif_identite_provisoire="Patient comateux sans papiers trouvé sur la voie publique",
            etablissement_creation=self.hopital_b,
            cree_par=self.medecin_b
        )
        self.assertTrue(patient_provisoire.is_provisional)
        self.assertEqual(patient_provisoire.status_identite, "A_CONFIRMER")

        # Rapprochement contrôlé vers self.patient
        patient_provisoire.reconciled_with = self.patient
        patient_provisoire.reconciled_at = timezone.now()
        patient_provisoire.reconciled_by = self.medecin_b
        patient_provisoire.status_identite = "CONFIRMEE"
        patient_provisoire.save()

        patient_provisoire.refresh_from_db()
        self.assertEqual(patient_provisoire.reconciled_with, self.patient)
        self.assertFalse(patient_provisoire.is_provisional)

    def test_journalisation_audit(self):
        """Enregistrement d'un log d'audit pour traçabilité médicolégale."""
        journal = enregistrer_journal(
            action="EMERGENCY_ACCESS",
            utilisateur=self.medecin_b,
            etablissement=self.hopital_b,
            statut="SUCCES",
            entite_type="Patient",
            entite_id=self.patient.id,
            details={"motif": "Vérification groupe sanguin avant transfusion"}
        )
        self.assertIsNotNone(journal.id)
        self.assertEqual(journal.action, "EMERGENCY_ACCESS")
        self.assertEqual(journal.statut, "SUCCES")
        self.assertEqual(journal.utilisateur.username, "dr_sow")

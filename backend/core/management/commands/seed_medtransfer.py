from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from accounts.models import User
from establishments.models import Etablissement
from patients.models import Patient
from medical_records.models import DossierMedical, Antecedent, Allergie, TraitementActuel, ExamenComplementaire
from consultations.models import Consultation
from care_management.models import PriseEnCharge, Transfert
from emergencies.models import InterventionUrgence
from ai_assistant.models import SyntheseIA
from notifications.models import Notification
from audit.models import JournalAcces


class Command(BaseCommand):
    help = "Peuple la base de données MEDTRANSFER avec les données initiales des scénarios métier"

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Initialisation du jeu de données initial MEDTRANSFER..."))

        # Nettoyage ordonné préalable
        SyntheseIA.objects.all().delete()
        InterventionUrgence.objects.all().delete()
        Transfert.objects.all().delete()
        PriseEnCharge.objects.all().delete()
        Consultation.objects.all().delete()
        TraitementActuel.objects.all().delete()
        ExamenComplementaire.objects.all().delete()
        Allergie.objects.all().delete()
        Antecedent.objects.all().delete()
        DossierMedical.objects.all().delete()
        Patient.objects.all().delete()
        Notification.objects.all().delete()
        JournalAcces.objects.all().delete()
        User.objects.all().delete()
        Etablissement.objects.all().delete()

        # =========================================================================
        # 1. ÉTABLISSEMENTS DE SANTÉ
        # =========================================================================
        etabs = {
            'HRZ': Etablissement.objects.create(
                code='HRZ',
                nom='Hôpital Régional de Ziguinchor',
                type_etablissement='CENTRE_HOSPITALIER_REGIONAL',
                region='Ziguinchor',
                ville='Ziguinchor',
                adresse='Boulevard des 54m, Quartier Néma',
                telephone='+221 33 991 10 20',
                email='contact@hrz-ziguinchor.sn',
                services_declares='Urgences 24/7, Médecine interne, Chirurgie générale, Pédiatrie, Cardiologie, Maternité'
            ),
            'CHU_FANN': Etablissement.objects.create(
                code='CHU-FANN',
                nom='Centre Hospitalier Universitaire de Fann',
                type_etablissement='HOPITAL_NATIONAL',
                region='Dakar',
                ville='Dakar',
                adresse='Avenue Cheikh Anta Diop, Fann Résidence',
                telephone='+221 33 869 18 18',
                email='secretariat@chu-fann.sn',
                services_declares='Neurologie, Neurochirurgie, Maladies infectieuses, Urgences, Psychiatrie'
            ),
            'HPD': Etablissement.objects.create(
                code='HPD',
                nom='Hôpital Principal de Dakar',
                type_etablissement='HOPITAL_NATIONAL',
                region='Dakar',
                ville='Dakar',
                adresse='1, Avenue Nelson Mandela',
                telephone='+221 33 839 50 50',
                email='direction@hopital-principal.sn',
                services_declares='Service d\'Accueil des Urgences (SAU), Réanimation polyvalente, Traumatologie, Scanner/IRM'
            ),
            'CSB': Etablissement.objects.create(
                code='CSB',
                nom='Centre de Santé de Bignona',
                type_etablissement='CENTRE_DE_SANTE',
                region='Ziguinchor',
                ville='Bignona',
                adresse='Route Nationale 4, Bignona',
                telephone='+221 33 994 12 30',
                email='cs.bignona@sante.sn',
                services_declares='Consultations générales, Soins d\'urgence de base, Maternité, PMI'
            ),
            'CHRSL': Etablissement.objects.create(
                code='CHRSL',
                nom='Centre Hospitalier Régional de Saint-Louis',
                type_etablissement='CENTRE_HOSPITALIER_REGIONAL',
                region='Saint-Louis',
                ville='Saint-Louis',
                adresse='Pointe Nord, Saint-Louis',
                telephone='+221 33 961 10 50',
                email='accueil@ch-saintlouis.sn',
                services_declares='Urgences, Ophtalmologie, Cardiologie, Néphrologie'
            ),
        }
        self.stdout.write(self.style.SUCCESS(f"-> 5 Établissements créés."))

        # =========================================================================
        # 2. UTILISATEURS PAR RÔLE
        # =========================================================================
        # Administrateur technique système
        admin = User.objects.create_superuser(
            username='admin',
            email='admin@medtransfer.sn',
            password='Password123!',
            role='ADMIN',
            first_name='Moussa',
            last_name='Ndiaye',
            telephone='+221 77 100 20 30',
            statut_validation='APPROVED'
        )

        # Directeurs d'établissement
        dir_zig = User.objects.create_user(
            username='directeur_zig',
            email='directeur@hrz.sn',
            password='Password123!',
            role='DIRECTEUR',
            etablissement=etabs['HRZ'],
            first_name='Ousmane',
            last_name='Gomis',
            matricule_professionnel='DIR-HRZ-001',
            telephone='+221 77 110 20 30',
            statut_validation='APPROVED'
        )
        dir_fann = User.objects.create_user(
            username='directeur_fann',
            email='directeur@chu-fann.sn',
            password='Password123!',
            role='DIRECTEUR',
            etablissement=etabs['CHU_FANN'],
            first_name='Abdoulaye',
            last_name='Fall',
            matricule_professionnel='DIR-FANN-001',
            telephone='+221 77 120 30 40',
            statut_validation='APPROVED'
        )
        dir_hpd = User.objects.create_user(
            username='directeur_hpd',
            email='directeur@hpd.sn',
            password='Password123!',
            role='DIRECTEUR',
            etablissement=etabs['HPD'],
            first_name='Ibrahima',
            last_name='Seck',
            matricule_professionnel='DIR-HPD-001',
            telephone='+221 77 130 40 50',
            statut_validation='APPROVED'
        )
        dir_csb = User.objects.create_user(
            username='directeur_csb',
            email='directeur@csb.sn',
            password='Password123!',
            role='DIRECTEUR',
            etablissement=etabs['CSB'],
            first_name='Mariama',
            last_name='Sonko',
            matricule_professionnel='DIR-CSB-001',
            telephone='+221 77 140 50 60',
            statut_validation='APPROVED'
        )

        # Agents d'accueil
        agent_zig = User.objects.create_user(
            username='agent_zig',
            email='fatou.diop@hrz.sn',
            password='Password123!',
            role='AGENT',
            etablissement=etabs['HRZ'],
            first_name='Fatou',
            last_name='Diop',
            matricule_professionnel='AG-HRZ-042',
            telephone='+221 77 234 56 78'
        )
        agent_fann = User.objects.create_user(
            username='agent_fann',
            email='moussa.ba@chu-fann.sn',
            password='Password123!',
            role='AGENT',
            etablissement=etabs['CHU_FANN'],
            first_name='Moussa',
            last_name='Ba',
            matricule_professionnel='AG-FANN-108',
            telephone='+221 77 345 67 89'
        )
        agent_bignona = User.objects.create_user(
            username='agent_bignona',
            email='awa.coly@csb.sn',
            password='Password123!',
            role='AGENT',
            etablissement=etabs['CSB'],
            first_name='Awa',
            last_name='Coly',
            matricule_professionnel='AG-CSB-019',
            telephone='+221 77 456 78 90'
        )

        # Médecins
        dr_diallo = User.objects.create_user(
            username='dr_diallo',
            email='dr.diallo@hrz.sn',
            password='Password123!',
            role='MEDECIN',
            etablissement=etabs['HRZ'],
            first_name='Mamadou',
            last_name='Diallo',
            matricule_professionnel='MED-HRZ-001',
            specialite='Médecine interne & Cardiologie',
            telephone='+221 77 567 89 01'
        )
        dr_sow = User.objects.create_user(
            username='dr_sow',
            email='dr.sow@chu-fann.sn',
            password='Password123!',
            role='MEDECIN',
            etablissement=etabs['CHU_FANN'],
            first_name='Aïssatou',
            last_name='Sow',
            matricule_professionnel='MED-FANN-014',
            specialite='Neurologie clinique',
            telephone='+221 77 678 90 12'
        )
        dr_faye = User.objects.create_user(
            username='dr_faye',
            email='dr.faye@hpd.sn',
            password='Password123!',
            role='MEDECIN',
            etablissement=etabs['HPD'],
            first_name='Cheikh',
            last_name='Faye',
            matricule_professionnel='MED-HPD-099',
            specialite='Médecine d\'urgence & Réanimation',
            telephone='+221 77 789 01 23'
        )
        dr_diatta = User.objects.create_user(
            username='dr_diatta',
            email='dr.diatta@csb.sn',
            password='Password123!',
            role='MEDECIN',
            etablissement=etabs['CSB'],
            first_name='Lamine',
            last_name='Diatta',
            matricule_professionnel='MED-CSB-005',
            specialite='Médecine générale',
            telephone='+221 77 890 12 34'
        )

        # Demande d'inscription en attente de validation par le Directeur HRZ
        User.objects.create_user(
            username='dr_ndao_pending',
            email='dr.ndao@hrz.sn',
            password='Password123!',
            role='MEDECIN',
            etablissement=etabs['HRZ'],
            first_name='Cheikh',
            last_name='Ndao',
            matricule_professionnel='ONMS-2026-884',
            specialite='Pédiatrie',
            telephone='+221 77 901 23 45',
            justificatif='Attestation Ordre National des Médecins du Sénégal N° ONMS-2026-884 & arrêté d\'affectation HRZ.',
            statut_validation='PENDING',
            is_active=False,
            is_actif=False
        )
        self.stdout.write(self.style.SUCCESS(f"-> Utilisateurs créés (1 Admin, 4 Directeurs, 3 Agents, 4 Médecins + 1 demande en attente)."))

        # =========================================================================
        # 3. PATIENTS FICTIFS COUVRANT LES SCÉNARIOS DU CAHIER DES CHARGES
        # =========================================================================
        now = timezone.now()

        # SCÉNARIOS 1 & 2 : Ousmane Sagna (créé à Ziguinchor, retrouvé à Fann sans duplication)
        p1 = Patient.objects.create(
            medtransfer_id='MDT-2026-000101',
            nom='Sagna',
            prenom='Ousmane',
            date_naissance='1985-05-14',
            sexe='M',
            numero_identification_nationale='1985198500412',
            telephone='+221 77 222 33 44',
            adresse='Quartier Lyndiane, Rue 12',
            ville='Ziguinchor',
            groupe_sanguin='O+',
            personne_contact_nom='Mariama Sagna (Épouse)',
            personne_contact_telephone='+221 77 333 44 55',
            status_identite='CONFIRMEE',
            etablissement_creation=etabs['HRZ'],
            cree_par=agent_zig
        )
        d1 = DossierMedical.objects.create(patient=p1, remarques_importantes="Hypertendu connu, observance modérée.")
        Antecedent.objects.create(
            dossier=d1,
            type_antecedent='MEDICAL',
            description='Hypertension artérielle essentielle Stade II diagnostiquée en 2021',
            date_diagnostic='2021',
            is_actif=True,
            enregistre_par=dr_diallo
        )
        Allergie.objects.create(
            dossier=d1,
            substance='Pénicilline',
            severite='SEVERE',
            reaction='Oedème de Quincke et éruption urticarienne aiguë',
            enregistre_par=dr_diallo
        )
        TraitementActuel.objects.create(
            dossier=d1,
            medicament='Amlodipine 10mg',
            posologie='1 comprimé le matin',
            is_actif=True,
            prescrit_par=dr_diallo
        )
        # Prise en charge initiale à HRZ
        pec1 = PriseEnCharge.objects.create(
            patient=p1,
            etablissement=etabs['HRZ'],
            medecin_responsable=dr_diallo,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF',
            date_debut=now - timedelta(days=60)
        )
        # Consultation 1 à Ziguinchor
        c1_1 = Consultation.objects.create(
            dossier=d1,
            etablissement=etabs['HRZ'],
            medecin=dr_diallo,
            date_consultation=now - timedelta(days=60),
            motif='Bilan annuel et équilibre tensionnel',
            constantes={'ta': '155/95', 'fc': 76, 'temp': 36.8, 'poids': 78},
            observations_cliniques='Bon état général. Bruits du coeur réguliers, pas de souffle. Membres inférieurs sans oedème.',
            diagnostic='HTA essentielle modérément équilibrée',
            prescription='Amlodipine 10mg : 1 cp/j le matin. Régime hyposodé.',
            conclusions_recommandations='Contrôle de la tension dans un mois. Prise de sang (créatininémie, ionogramme).'
        )
        # Consultation 2 : Sagna se rend à Dakar (CHU Fann) -> retrouvée par Dr Sow
        c1_2 = Consultation.objects.create(
            dossier=d1,
            etablissement=etabs['CHU_FANN'],
            medecin=dr_sow,
            date_consultation=now - timedelta(days=10),
            motif='Épisodes récents de céphalées frontales pulsatiles avec phosphènes',
            constantes={'ta': '160/100', 'fc': 82, 'temp': 37.0, 'sat': 98},
            observations_cliniques='Examen neurologique sans déficit sensitivomoteur focalisé. Fond d\'oeil : pas d\'oedème papillaire franc.',
            diagnostic='Poussée hypertensive avec céphalées secondaires',
            prescription='Poursuite Amlodipine 10mg + Ajout Ramipril 5mg (1 cp/j). Paracétamol 1g si douleurs.',
            conclusions_recommandations='Auto-mesure tensionnelle matin et soir. Avis cardiologique à Ziguinchor dès retour.'
        )

        # SCÉNARIO 3 : Mariama Badji (Transfert formel de CSB vers HRZ)
        p2 = Patient.objects.create(
            medtransfer_id='MDT-2026-000202',
            nom='Badji',
            prenom='Mariama',
            date_naissance='1992-09-22',
            sexe='F',
            numero_identification_nationale='2992199200331',
            telephone='+221 77 444 55 66',
            adresse='Quartier Guérina',
            ville='Bignona',
            groupe_sanguin='A+',
            personne_contact_nom='Abdou Badji (Frère)',
            personne_contact_telephone='+221 77 555 66 77',
            status_identite='CONFIRMEE',
            etablissement_creation=etabs['CSB'],
            cree_par=agent_bignona
        )
        d2 = DossierMedical.objects.create(patient=p2, remarques_importantes="Diabète gestationnel sous surveillance.")
        pec2_old = PriseEnCharge.objects.create(
            patient=p2,
            etablissement=etabs['CSB'],
            medecin_responsable=dr_diatta,
            type_prise_en_charge='ORDINAIRE',
            statut='TRANSFERE',
            date_debut=now - timedelta(days=20),
            date_fin=now - timedelta(days=2),
            motif_cloture='Transférée vers Hôpital Régional de Ziguinchor pour prise en charge obstétricale spécialisée'
        )
        pec2_new = PriseEnCharge.objects.create(
            patient=p2,
            etablissement=etabs['HRZ'],
            medecin_responsable=dr_diallo,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF',
            date_debut=now - timedelta(days=2)
        )
        transfert2 = Transfert.objects.create(
            patient=p2,
            prise_en_charge_origine=pec2_old,
            etablissement_origine=etabs['CSB'],
            etablissement_destination=etabs['HRZ'],
            medecin_emetteur=dr_diatta,
            medecin_receveur=dr_diallo,
            priorite='HAUTE',
            statut='ACCEPTE',
            motif_transfert='Menace d\'accouchement prématuré à 33 SA avec diabète déséquilibré',
            resume_clinique='Contractions utérines régulières, col modifié. Nécessite tocolyse intraveineuse et corticothérapie maturative.',
            date_reponse=now - timedelta(days=2),
            motif_reponse='Patient acceptée dans le service de gynéco-obstétrique de Ziguinchor.'
        )

        # SCÉNARIO 4 : Ibrahima Sané (Suivi à HRZ, Urgence à l'Hôpital Principal de Dakar sans transfert de suivi)
        p3 = Patient.objects.create(
            medtransfer_id='MDT-2026-000303',
            nom='Sané',
            prenom='Ibrahima',
            date_naissance='1976-11-03',
            sexe='M',
            numero_identification_nationale='1976197600889',
            telephone='+221 77 666 77 88',
            adresse='Quartier Boucotte',
            ville='Ziguinchor',
            groupe_sanguin='B+',
            status_identite='CONFIRMEE',
            etablissement_creation=etabs['HRZ'],
            cree_par=agent_zig
        )
        d3 = DossierMedical.objects.create(patient=p3, remarques_importantes="Insuffisance coronaire stable.")
        Antecedent.objects.create(
            dossier=d3,
            type_antecedent='MEDICAL',
            description='Infarctus du myocarde antérieur en 2022 avec pose de stent',
            date_diagnostic='2022',
            is_actif=True,
            enregistre_par=dr_diallo
        )
        Allergie.objects.create(
            dossier=d3,
            substance='Aspirine (acide acétylsalicylique)',
            severite='CRITIQUE',
            reaction='Ulcère digestif hémorragique documenté en 2023',
            enregistre_par=dr_diallo
        )
        # Prise en charge toujours active à Ziguinchor !
        pec3_active = PriseEnCharge.objects.create(
            patient=p3,
            etablissement=etabs['HRZ'],
            medecin_responsable=dr_diallo,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF',
            date_debut=now - timedelta(days=120)
        )
        # Urgence à Dakar HPD
        c3_urg = Consultation.objects.create(
            dossier=d3,
            etablissement=etabs['HPD'],
            medecin=dr_faye,
            date_consultation=now - timedelta(days=1),
            motif='Douleur thoracique rétro-sternale constrictive survenue lors d\'un déplacement professionnel à Dakar',
            constantes={'ta': '140/85', 'fc': 90, 'temp': 36.9, 'sat': 97, 'troponine': 'Légèrement augmentée (0.04 ng/ml)'},
            observations_cliniques='Patient angoissé, sueurs froides. ECG sans sus-décalage persistant du segment ST. Sous-décalage transitoire V4-V6.',
            diagnostic='Syndrome coronarien aigu sans élévation de ST (SCA ST-) stabilisé',
            prescription='Clopidogrel 75mg (en remplacement de l\'aspirine strictement contre-indiquée), HBPM curative, Dérivés nitrés sublinguaux si besoin.',
            conclusions_recommandations='Hospitalisation SAU 48h puis rapatriement sanitaire programmé vers son cardiologue référent à Ziguinchor.',
            is_emergency=True
        )
        interv3 = InterventionUrgence.objects.create(
            patient=p3,
            etablissement=etabs['HPD'],
            medecin=dr_faye,
            consultation=c3_urg,
            motif_urgence='Syndrome coronarien aigu chez coronaropathe connu',
            justification_acces_derogatoire='Accès dérogatoire SAU : patient en crise angineuse aiguë à Dakar alors que son suivi de référence est à Ziguinchor.',
            notification_envoyee=True
        )
        # Notification générée pour Dr Diallo à Ziguinchor
        Notification.objects.create(
            destinataire=dr_diallo,
            etablissement_cible=etabs['HRZ'],
            type_notification='URGENCE_EXTERNE',
            titre='Intervention d\'urgence externe : Patient Ibrahima Sané',
            message='Votre patient suivi Ibrahima Sané a été admis en urgence à l\'Hôpital Principal de Dakar par Dr Cheikh Faye (SCA ST- stabilisé). L\'allergie à l\'aspirine a été respectée.',
            reference_objet_type='InterventionUrgence',
            reference_objet_id=str(interv3.id)
        )

        # SCÉNARIO 5 : Aminata Ndiaye (Historique complet avec synthèse IA validée)
        p4 = Patient.objects.create(
            medtransfer_id='MDT-2026-000404',
            nom='Ndiaye',
            prenom='Aminata',
            date_naissance='1965-03-18',
            sexe='F',
            numero_identification_nationale='2651965007765',
            telephone='+221 77 111 22 33',
            adresse='Quartier Tilène',
            ville='Ziguinchor',
            groupe_sanguin='AB+',
            status_identite='CONFIRMEE',
            etablissement_creation=etabs['HRZ'],
            cree_par=agent_zig
        )
        d4 = DossierMedical.objects.create(patient=p4, remarques_importantes="Terrain polypathologique : Diabète de type 2 et HTA.")
        Antecedent.objects.create(
            dossier=d4,
            type_antecedent='MEDICAL',
            description='Diabète de type 2 évoluant depuis 15 ans avec néphropathie débutante',
            date_diagnostic='2010',
            enregistre_par=dr_diallo
        )
        Antecedent.objects.create(
            dossier=d4,
            type_antecedent='CHIRURGICAL',
            description='Cholécystectomie par laparoscopie en 2018',
            date_diagnostic='2018',
            enregistre_par=dr_diallo
        )
        Allergie.objects.create(
            dossier=d4,
            substance='Produits de contraste iodés',
            severite='MODEREE',
            reaction='Prurit et érythème cutané diffus',
            enregistre_par=dr_diallo
        )
        TraitementActuel.objects.create(
            dossier=d4,
            medicament='Metformine 1000mg',
            posologie='1 cp matin et soir au cours des repas',
            is_actif=True,
            prescrit_par=dr_diallo
        )
        TraitementActuel.objects.create(
            dossier=d4,
            medicament='Losartan 50mg',
            posologie='1 cp le matin',
            is_actif=True,
            prescrit_par=dr_diallo
        )
        ExamenComplementaire.objects.create(
            dossier=d4,
            titre='Bilan rénal et HbA1c',
            type_examen='Biologie',
            resultat='HbA1c: 7.9%, Clairance créatinine: 58 ml/min, Microalbuminurie positive à 45 mg/24h',
            date_examen=now.date() - timedelta(days=15),
            etablissement=etabs['HRZ'],
            medecin=dr_diallo
        )
        PriseEnCharge.objects.create(
            patient=p4,
            etablissement=etabs['HRZ'],
            medecin_responsable=dr_diallo,
            type_prise_en_charge='ORDINAIRE',
            statut='ACTIF',
            date_debut=now - timedelta(days=365)
        )
        c4 = Consultation.objects.create(
            dossier=d4,
            etablissement=etabs['HRZ'],
            medecin=dr_diallo,
            date_consultation=now - timedelta(days=5),
            motif='Bilan d\'équilibre diabétique et réévaluation de la fonction rénale',
            constantes={'ta': '138/84', 'fc': 74, 'glycemie': '1.82 g/L'},
            observations_cliniques='Pieds diabétiques examinés : sensibilité conservée, pouls pédieux palpés, pas de lésion cutanée.',
            diagnostic='Diabète type 2 sous-optimal avec début d\'altération rénale (Stade 3A)',
            prescription='Poursuite Metformine à posologie adaptée (500mg x 2/j) + introduction inhibiteur SGLT-2 envisagé.',
            conclusions_recommandations='Contrôle biologique dans 3 mois. Éviter tout produit de contraste iodé sans préparation.'
        )
        # Synthèse IA attachée à cette consultation
        SyntheseIA.objects.create(
            patient=p4,
            consultation=c4,
            medecin_demandeur=dr_diallo,
            motif_consultation_soumis='Bilan d\'équilibre diabétique et réévaluation de la fonction rénale',
            resume_antecedents='Patiente de 60 ans avec Diabète de type 2 (15 ans), HTA et antécédent de cholécystectomie.',
            historique_pertinent='Dernier bilan : HbA1c à 7.9% et baisse de clairance à 58 ml/min avec microalbuminurie.',
            traitements_connus='Metformine 1000mg matin/soir, Losartan 50mg/j.',
            allergies_connues='Produits de contraste iodés (réaction cutanée modérée).',
            elements_a_verifier='Adapter la posologie de Metformine selon la fonction rénale ; surveiller la kaliémie sous Losartan ; vigilance si imagerie avec contraste.',
            informations_manquantes='Pas de bilan ophtalmologique (fond d\'oeil) récent renseigné.',
            synthese_globale='Patiente diabétique et hypertendue présentant un déséquilibre glycémique modéré (HbA1c 7.9%) associé à une néphropathie débutante (clairance 58 ml/min). Les traitements actuels nécessitent un ajustement de posologie. L\'allergie documentée aux produits iodés impose une stricte prudence.',
            statut='VALIDEE',
            texte_final_valide='Synthèse revue et validée : adapter Metformine à 1000mg/jour total pour préserver le rein, recommander consultation ophtalmologique.',
            medecin_decisionnaire=dr_diallo,
            date_decision=now - timedelta(days=5),
            motif_decision='Synthèse claire et pertinente par rapport aux données du dossier.',
            is_mocked=True
        )

        # SCÉNARIO IDENTITÉ PROVISOIRE EN URGENCE : Patient Inconnu Voie Publique
        p_provisoire = Patient.objects.create(
            medtransfer_id='MDT-2026-000505',
            nom='Inconnu_Urgence_Dakar',
            prenom='Homme_30ans_Env',
            sexe='M',
            status_identite='A_CONFIRMER',
            motif_identite_provisoire='Patient inconscient retrouvé sur l\'autoroute à péage sans pièce d\'identité ni accompagnant.',
            etablissement_creation=etabs['HPD'],
            cree_par=dr_faye
        )
        d_provisoire = DossierMedical.objects.create(
            patient=p_provisoire,
            remarques_importantes="IDENTITÉ À CONFIRMER - Rapprochement ultérieur obligatoire dès identification."
        )
        Consultation.objects.create(
            dossier=d_provisoire,
            etablissement=etabs['HPD'],
            medecin=dr_faye,
            date_consultation=now - timedelta(hours=6),
            motif='Coma post-traumatique Glasgow 8',
            constantes={'ta': '110/70', 'fc': 105, 'sat': 92, 'gcs': 8},
            observations_cliniques='Polytraumatisme crânio-facial. Intubation orotrachéale en réanimation.',
            diagnostic='Traumatisme crânien grave avec hématome extradural temporo-pariétal gauche',
            prescription='Évacuation chirurgicale immédiate, mannitol 20%, sédation',
            is_emergency=True
        )
        InterventionUrgence.objects.create(
            patient=p_provisoire,
            etablissement=etabs['HPD'],
            medecin=dr_faye,
            motif_urgence='Coma traumatique engagant le pronostic vital',
            justification_acces_derogatoire='Création d\'une fiche provisoire vitale sous régime d\'identité à confirmer.'
        )

        # =========================================================================
        # 4. JOURNAUX D'AUDIT
        # =========================================================================
        JournalAcces.objects.create(
            utilisateur=admin,
            etablissement=None,
            action='LOGIN',
            statut='SUCCES',
            details={'ip': '127.0.0.1', 'note': 'Connexion administrateur système'}
        )
        JournalAcces.objects.create(
            utilisateur=dr_faye,
            etablissement=etabs['HPD'],
            action='EMERGENCY_ACCESS',
            statut='SUCCES',
            entite_type='Patient',
            entite_id=p3.id,
            details={'motif': 'Accès dérogatoire SCA ST- patient suivi à Ziguinchor'}
        )
        JournalAcces.objects.create(
            utilisateur=agent_zig,
            etablissement=etabs['HRZ'],
            action='CREATE_PATIENT',
            statut='SUCCES',
            entite_type='Patient',
            entite_id=p1.id,
            details={'medtransfer_id': p1.medtransfer_id}
        )

        self.stdout.write(self.style.SUCCESS(f"-> 5 Patients et Dossiers créés couvrant tous les scénarios."))
        self.stdout.write(self.style.SUCCESS(f"-> Prises en charge, transferts, urgences et synthèses IA générés."))
        self.stdout.write(self.style.SUCCESS(f"-> Seeding MEDTRANSFER terminé avec succès!"))

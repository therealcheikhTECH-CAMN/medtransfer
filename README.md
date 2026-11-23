# MEDTRANSFER — Plateforme de gestion de l'historique médical et d'orientation des patients.

---

## 1. Présentation Générale

**MEDTRANSFER** est une plateforme web hospitalière sécurisée conçue pour assurer la continuité du suivi médical et l'orientation des patients entre plusieurs structures sanitaires (Hôpitaux nationaux, Centres hospitaliers régionaux, Centres de santé).

### Exigences Architecturales Fondamentales
- **Base PostgreSQL unique et centralisée :** Tous les établissements partagent le même référentiel patient et dossier médical.
- **Un seul dossier médical principal par patient :** Unicité garantie par contrainte d'intégrité en base.
- **Une seule prise en charge ordinaire active par patient :** Contrainte d'unicité partielle au niveau de la base (`UniqueConstraint` sous condition).
- **Historique chronologique cumulatif :** Les consultations ne sont jamais écrasées silencieusement ; toute rectification génère une révision médicolégale tracée.
- **Intervention d'urgence dérogatoire :** Tout médecin habilité peut intervenir en urgence sur un patient suivi dans un autre hôpital sans clôture préalable de son suivi d'origine, sans transfert automatique et sans formalité administrative bloquante.
- **Assistant de Synthèse IA (OpenAI) :** Module d'aide à la lecture de l'historique médical, avec structuration en 6 parties, avertissement légal obligatoire et processus d'évaluation médicale (validation ou rejet).
- **Ségrégation stricte des permissions :** Les données cliniques sont strictement réservées aux médecins ; les agents d'accueil et les administrateurs techniques sont exclus des dossiers cliniques (HTTP 403 Forbidden).
- **Audit et traçabilité :** Enregistrement de tous les accès et opérations sensibles dans un registre d'audit immuable.

---

## 2. Rôles et Comptes de Démonstration (1-Clic)

Le jeu de données synthétiques préconfiguré (`seed_medtransfer`) fournit les comptes de test suivants (mot de passe commun : `Password123!`) :

| Nom d'utilisateur | Rôle | Établissement de Rattachement | Fonctionnalités Clés |
| :--- | :---: | :--- | :--- |
| `dr_diallo` | **Médecin** | Hôpital Régional de Ziguinchor (HRZ) | Dossiers cliniques, consultations, transferts, assistant IA |
| `dr_sow` | **Médecin** | CHU de Fann (Dakar) | Accès à la timeline d'un patient venant de Ziguinchor |
| `dr_faye` | **Médecin** | Hôpital Principal de Dakar (HPD) | Interventions d'urgence dérogatoires (SAU) |
| `agent_zig` | **Agent d'accueil** | Hôpital Régional de Ziguinchor | Recherche anti-doublon, création administrative |
| `agent_fann` | **Agent d'accueil** | CHU de Fann (Dakar) | Recherche du patient créé à Ziguinchor sans duplication |
| `admin` | **Administrateur** | Administration Centrale (Système) | Gestion des comptes, établissements, métriques, journaux d'audit |

---

## 3. Architecture Technique

```
MEDTRANSFER/
├── backend/                        # Backend Python / Django REST Framework
│   ├── config/                     # Configuration globale, JWT, CORS, URLs
│   ├── accounts/                   # Utilisateurs & permissions par rôle
│   ├── establishments/             # Référentiel des structures de santé
│   ├── patients/                   # Fiches administratives & identités provisoires
│   ├── medical_records/            # Dossier médical unique, antécédents, allergies
│   ├── consultations/              # Actes médicaux, timeline & révisions
│   ├── care_management/           # Prises en charge & workflow de transfert
│   ├── emergencies/                # Interventions d'urgence sans verrouillage
│   ├── ai_assistant/               # Synthèse OpenAI sécurisée & mode démo
│   ├── notifications/              # Centre de notifications internes
│   ├── audit/                      # Journalisation médicolégale
│   └── core/management/commands/   # Commande de peuplement `seed_medtransfer`
│
├── frontend/                       # Frontend React (Vite, Tailwind CSS, Lucide)
│   ├── src/
│   │   ├── api/                    # Client Axios avec intercepteur JWT
│   │   ├── components/             # Composants réutilisables (Layout, Sidebar, Modals...)
│   │   ├── contexts/               # AuthContext, NotificationContext
│   │   ├── pages/                  # Pages Admin, Agent, Médecin & Orientation
│   │   ├── routes/                 # Navigation et routes protégées par rôle
│   │   └── services/               # Services API découplés
│   └── package.json
│
├── documentation/
│   └── DESIGN_SYSTEM.md            # Charte graphique SaaS médicale
├── docker-compose.yml              # Déploiement PostgreSQL 16 + Backend
└── .env.example                    # Modèle des variables d'environnement
```

---

## 4. Instructions de Démarrage sous Windows

### Prérequis
- Python 3.12+ (ou Python 3.14)
- Node.js (v18+) et npm
- Git

### 1. Démarrer le Backend Django

```powershell
# 1. Se placer dans le dossier backend
cd c:\Users\hp\Desktop\MedTransfert\backend

# 2. Activer l'environnement virtuel
.\venv\Scripts\Activate.ps1

# 3. Appliquer les migrations
python manage.py migrate

# 4. Charger le jeu de données de démonstration (5 scénarios pré-remplis)
python manage.py seed_medtransfer

# 5. Démarrer le serveur de développement
python manage.py runserver 0.0.0.0:8000
```
*L'API est accessible sur : `http://localhost:8000/api/`*

### 2. Démarrer le Frontend React

Dans un second terminal PowerShell :

```powershell
# 1. Se placer dans le dossier frontend
cd c:\Users\hp\Desktop\MedTransfert\frontend

# 2. Lancer le serveur Vite
npm run dev
```
*L'application web est accessible sur : `http://localhost:5173/`*

---

## 5. Exécution des Tests Automatisés

Le backend intègre une suite complète de **22 tests automatisés** validant l'ensemble des contraintes du modèle de données, les 7 scénarios imposés par le cahier des charges et l'audit médicolégal :

```powershell
cd c:\Users\hp\Desktop\MedTransfert\backend
# Tests des contraintes de domaine et scénarios du cahier des charges (15 tests)
.\venv\Scripts\python manage.py test core.tests

# Tests d'audit : refus transfert, rejet IA, clôture, notifications, révisions (7 tests)
.\venv\Scripts\python manage.py test core.tests_audit
```

### Synthèse des 22 tests validés avec succès (OK) :
1. `test_unicite_dossier_medical_par_patient` : Unicité stricte du dossier médical en base (PostgreSQL OneToOne).
2. `test_unicite_prise_en_charge_ordinaire_active` : Rejet en base de deux prises en charge actives pour un même patient (contrainte partielle UniqueConstraint).
3. `test_prises_en_charge_successives_apres_cloture` : Autorisation après clôture formelle.
4. `test_workflow_transfert_inter_etablissements` : Bascule atomique de responsabilité.
5. `test_intervention_urgence_hors_rattachement` : Maintien du suivi d'origine lors d'un acte vital.
6. `test_historique_consultations_cumulatif_et_revision` : Conservation cumulative sans écrasement.
7. `test_identite_provisoire_et_rapprochement` : Régularisation des identités provisoires.
8. `test_journalisation_audit` : Traçabilité des actions sensibles.
9. `test_scenario_1_patient_retrouve_sans_duplication` : Recherche inter-établissements sans duplication.
10. `test_scenario_2_consultation_cumulative_visible_inter_etablissements` : Partage de timeline médicale.
11. `test_scenario_3_transfert_inter_etablissements` : Workflow de transfert A vers B.
12. `test_scenario_4_urgence_sans_cloture_ni_transfert_automatique` : Urgence sans blocage administratif.
13. `test_scenario_5_synthese_ia_generation_et_validation` : Génération et validation de la synthèse IA.
14. `test_scenario_6_agent_interdit_de_modifier_diagnostic` : Refus HTTP 403 à l'agent tentant de diagnostiquer.
15. `test_scenario_7_non_medecin_acces_refuse_dossier_clinique` : Refus HTTP 403 à l'admin technique tentant de lire les dossiers cliniques.
16. `test_01_jwt_auth_and_token_refresh` : Obtention JWT, structure des tokens et rotation refresh.
17. `test_02_refusal_of_transfer` : Refus formel motivé d'une demande de transfert et notification médecin émetteur.
18. `test_03_rejection_of_ai_summary` : Rejet motivé d'une synthèse proposée par l'assistant IA.
19. `test_04_closing_care_management` : Clôture formelle tracée d'une prise en charge active.
20. `test_05_notifications_mark_read_and_mark_all` : Acquittement unitaire et groupé des alertes internes.
21. `test_06_medical_revisions_consultation` : Traçabilité médicolégale des rectifications apportées aux consultations.
22. `test_07_establishments_and_users_management_permissions` : Contrôle RBAC sur la gestion des structures et annuaire d'orientation.

---

## 6. Parcours Fonctionnel de Démonstration (5 Étapes)

Pour parcourir les fonctionnalités principales de la plateforme, suivez ce déroulement chronologique :

### Étape 1 : Accueil et Recherche Anti-Doublon (Agent d'accueil)
1. Connexion en 1-clic avec le compte `agent_zig` (ou `agent_fann`).
2. Tenter d'enregistrer un patient existant (ex : *Ousmane Sagna*) -> L'alerte de détection de doublon s'affiche en temps réel.
3. Rechercher un patient par NIN ou identifiant MedTransfer -> La fiche administrative unique apparaît sans duplication de dossier.
4. Tentative d'accès à l'URL `/doctor/dashboard` ou `/api/medical-records/` -> Redirection automatique et accès refusé (ségrégation stricte des données).

### Étape 2 : Consultation Clinique et Assistant IA (Médecin Suiveur)
1. Connexion en 1-clic avec `dr_diallo` (Hôpital Régional de Ziguinchor).
2. Ouvrir le dossier médical d'Ousmane Sagna : observer la timeline chronologique, les antécédents, les allergies signalées en rouge.
3. Cliquer sur **Assistant Synthèse IA** : analyser la proposition structurée en 6 parties, les avertissements légaux et le bouton de validation/rejet.
4. Enregistrer une nouvelle consultation avec prise de constantes (TA, Pouls, Glycémie) et ordonnance.

### Étape 3 : Workflow de Transfert Inter-Établissements
1. Toujours avec `dr_diallo`, émettre une demande de transfert vers le **CHU de Fann** (Dakar) pour bilan neurologique approfondi.
2. Déconnexion puis reconnexion en 1-clic avec `dr_sow` (CHU de Fann).
3. Ouvrir le menu **Transferts** : la demande de Ziguinchor est en attente avec notification visuelle.
4. Examiner le dossier, puis **Accepter** le transfert (ou tester le **Refus motivé**).
5. Constater la clôture automatique de la prise en charge à Ziguinchor et l'ouverture de la nouvelle prise en charge active à Dakar.

### Étape 4 : Intervention d'Urgence Dérogatoire
1. Connexion avec `dr_faye` (Hôpital Principal de Dakar - SAU).
2. Le patient *Moussa Diop* (suivi activement à Ziguinchor) arrive aux urgences à Dakar.
3. Activer le mode **Intervention d'Urgence Dérogatoire** : renseigner le motif d'urgence vitale.
4. Enregistrer l'acte d'urgence -> La consultation est inscrite au dossier unique sans clôturer la prise en charge de Ziguinchor et sans bloquer l'admission.
5. Une notification d'urgence externe est envoyée automatiquement au médecin traitant à Ziguinchor.

### Étape 5 : Administration Système et Audit Médicolégal (Administrateur)
1. Connexion en 1-clic avec `admin`.
2. Consulter le tableau de bord global : métriques d'activité, répartition des établissements, graphiques.
3. Ouvrir la page **Journaux d'Audit** : chaque consultation, transfert, accès refusé, synthèse IA et intervention d'urgence y est consignée avec horodatage, utilisateur, adresse IP et statut de l'opération.
4. Vérifier l'impossibilité pour l'administrateur de consulter le détail clinique des patients (garantie du secret médical).

---

## 7. Périmètre Technique et Sécurité

- **Jeu d'initialisation :** Les données chargées par `seed_medtransfer` constituent un jeu d'initialisation destiné aux tests fonctionnels.
- **Rôle de l'IA :** L'assistant OpenAI génère des propositions de synthèse d'aide à la lecture. Il ne pose aucun diagnostic autonome et ne remplace pas le jugement clinique du praticien. En l'absence de clé API OpenAI, le moteur bascule automatiquement vers le moteur local de synthèse structurée.
- **Signature Électronique Avancée :** La signature des actes repose sur l'authentification forte JWT et le matricule professionnel, mais n'intègre pas encore de carte CPS (Carte de Professionnel de Santé) matérielle ni d'infrastructure PKI à clés publiques nationales.
- **Interopérabilité HL7/FHIR :** Les échanges reposent sur des API REST JSON standardisées plutôt que sur des bundles FHIR R4 natifs.

---

## 6. Déploiement avec Docker Compose (PostgreSQL 16)

```bash
docker-compose up -d
```
Le conteneur PostgreSQL initialise la base `medtransfer_db`, exécute les migrations et charge les données synthétiques.

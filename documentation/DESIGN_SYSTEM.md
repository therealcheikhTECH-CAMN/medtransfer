# SYSTÈME DE DESIGN & DIRECTION ARTISTIQUE — MEDTRANSFER

**MEDTRANSFER — Plateforme de gestion de l'historique médical et d'orientation des patients.**

---

## 1. Principes Directeurs et Identité Visuelle

MEDTRANSFER adopte les standards des plateformes de santé numériques les plus avancées :
- **Clarté clinique :** Contraste élevé, réduction de la fatigue oculaire, hiérarchie visuelle stricte.
- **Sobriété et élégance :** Aucune animation tapageuse, transitions subtiles (150-200ms), bordures légères.
- **Sécurité visuelle :** Codes couleur normalisés pour les vigilances vitales, les statuts et les urgences.

---

## 2. Palette Chromatique Officielle

| Token Sémantique | Code HEX | Utilisation dans l'Interface |
| :--- | :---: | :--- |
| `color-medical-dark` | `#123B5D` | Sidebar principale, barre de navigation supérieure, titres majeurs H1 |
| `color-primary-blue` | `#1976D2` | Boutons d'action primaire, liens actifs, onglets sélectionnés, icônes clés |
| `color-light-blue` | `#EAF3FB` | Arrière-plan des éléments actifs, hover d'onglets, badges neutres d'établissement |
| `color-white` | `#FFFFFF` | Cartes, modales, conteneurs principaux, fond de formulaires |
| `color-surface-grey` | `#F4F6F9` | Arrière-plan global de l'application (viewport) |
| `color-text-secondary`| `#64748B` | Textes secondaires, métadonnées, sous-titres, libellés de formulaires |
| `color-status-success`| `#16A34A` | Prises en charge actives, transferts acceptés, synthèses IA validées |
| `color-status-warning`| `#F59E0B` | Alertes de suivi externe, identités à confirmer, transferts en attente |
| `color-status-danger` | `#DC2626` | Accès d'urgence, allergies critiques, erreurs de saisie, rejets |

---

## 3. Typographie et Échelle Modulaire

- **Police principale :** Inter / System UI Font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`)
- **Titres H1 :** `font-bold text-2xl tracking-tight text-[#123B5D]`
- **Titres H2 / Cartes :** `font-semibold text-lg text-[#123B5D]`
- **Texte courant :** `font-normal text-sm text-[#1E293B] leading-relaxed`
- **Labels & Métadonnées :** `font-medium text-xs text-[#64748B] uppercase tracking-wider`
- **Badges :** `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold`

---

## 4. Composants Clés selon les Rôles

### A. Navigation & Barre Supérieure
- **Sidebar :** Logo MEDTRANSFER avec blason médical, indicateur de l'établissement d'affectation (`HRZ - Ziguinchor`), menu contextuel filtré strictement selon le rôle JWT et pied de page institutionnel MEDTRANSFER.
- **Header supérieur :** Titre dynamique de page, centre de notification avec compteur visuel non-lu, badge du rôle (`Médecin`, `Agent`, `Admin`), avatar avec menu déroulant de déconnexion.

### B. Espace Médecin
- **Bandeau d'alerte prise en charge active :** Encadré orange `#F59E0B` discret si le patient est suivi dans un autre hôpital.
- **Timeline chronologique médicale :** Ligne verticale continue reliant les consultations, avec horodatage, badge de l'établissement (ex: `HRZ`, `CHU-FANN`), médecin auteur et motif.
- **Accès dérogatoire d'urgence :** Bouton rouge `#DC2626` ouvrant une modale imposant la saisie de la justification légale avant d'enregistrer l'acte.
- **Panneau Assistant IA :** Interface dédiée avec mention légale obligatoire en en-tête, prévisualisation des 6 sections générées, zone d'édition/amendement du texte et boutons "Valider la synthèse" (vert) et "Rejeter" (gris/rouge).

### C. Espace Agent d'Accueil
- **Recherche multicritères instantanée :** Barre de recherche avec autocomplétion sur l'Identifiant MedTransfer, le nom, le prénom et le NIN.
- **Détecteur de doublons :** Tableau comparatif prévenant la création accidentelle d'un second dossier lors de la saisie d'un nouvel arrivant.
- **Formulaire d'identité provisoire :** Marquage visuel immédiat en orange `[IDENTITÉ À CONFIRMER]` pour les admissions sans papiers d'identité.

### D. Espace Administrateur
- **Métriques clés :** Cartes statistiques modernes avec icônes (Total structures, comptes actifs, transferts, consultations).
- **Journal d'audit :** Tableau sécurisé avec filtrage par type d'action, recherche par utilisateur et détail JSON des opérations.

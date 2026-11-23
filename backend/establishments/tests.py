from rest_framework import status
from rest_framework.test import APITestCase
from establishments.models import Etablissement
from accounts.models import User
from notifications.models import Notification


class RegistrationEstablishmentsTests(APITestCase):
    """
    Vérifications automatisées du chargement public des établissements pour la page d'inscription
    professionnelle et du rattachement Directeur / Établissement :
    1. Accès à la liste des établissements actifs sans authentification.
    2. Filtrage strict des établissements inactifs et exposition minimale des champs (id, nom, ville, is_active).
    3. Comportement lorsque la liste des établissements actifs est vide.
    4. Inscription d'un médecin et d'un agent d'accueil avec l'ID réel de l'établissement.
    5. Réception et visibilité de la demande uniquement par le directeur de l'établissement sélectionné.
    6. Interdiction pour le directeur d'un autre établissement de voir ou valider la demande.
    """

    def setUp(self):
        self.etab_zig = Etablissement.objects.create(
            code="CHRZ",
            nom="Centre Hospitalier Régional de Ziguinchor",
            type_etablissement="CENTRE_HOSPITALIER_REGIONAL",
            region="Ziguinchor",
            ville="Ziguinchor",
            email="secret-interne@chrz.sn",
            telephone="+221339911020",
            is_active=True,
        )
        self.etab_hpd = Etablissement.objects.create(
            code="HPD",
            nom="Hôpital Principal de Dakar",
            type_etablissement="HOPITAL_NATIONAL",
            region="Dakar",
            ville="Dakar",
            is_active=True,
        )
        self.etab_inactif = Etablissement.objects.create(
            code="CLIN-FERMEE",
            nom="Clinique Désactivée Test",
            type_etablissement="CLINIQUE_PRIVEE",
            region="Dakar",
            ville="Dakar",
            is_active=False,
        )

        self.directeur_zig = User.objects.create_user(
            username="dir_zig",
            email="directeur@chrz.sn",
            password="DirectorPassword123!",
            role="DIRECTEUR",
            etablissement=self.etab_zig,
            first_name="Ousmane",
            last_name="Gomis",
            statut_validation="APPROVED",
            is_active=True,
            is_actif=True,
        )
        self.directeur_hpd = User.objects.create_user(
            username="dir_hpd",
            email="directeur@hpd.sn",
            password="DirectorPassword123!",
            role="DIRECTEUR",
            etablissement=self.etab_hpd,
            first_name="Ibrahima",
            last_name="Seck",
            statut_validation="APPROVED",
            is_active=True,
            is_actif=True,
        )

    def test_01_acces_public_liste_etablissements_sans_connexion(self):
        """L'endpoint public retourne uniquement les établissements actifs et les 4 champs attendus."""
        res = self.client.get('/api/establishments/public/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 2)

        noms = [item['nom'] for item in res.data]
        self.assertIn("Centre Hospitalier Régional de Ziguinchor", noms)
        self.assertIn("Hôpital Principal de Dakar", noms)
        self.assertNotIn("Clinique Désactivée Test", noms)

        # Vérification des champs exposés (uniquement id, nom, ville, is_active)
        for item in res.data:
            self.assertEqual(set(item.keys()), {'id', 'nom', 'ville', 'is_active'})
            self.assertTrue(item['is_active'])

        # Même si le navigateur envoie un ancien token JWT invalide, l'endpoint public répond 200 OK
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid_or_expired_jwt_token')
        res_with_stale_token = self.client.get('/api/establishments/public/')
        self.assertEqual(res_with_stale_token.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_with_stale_token.data), 2)
        self.client.credentials()

    def test_02_comportement_liste_etablissements_vide(self):
        """Si aucun établissement actif n'existe en base, l'endpoint public renvoie une liste vide []."""
        Etablissement.objects.all().update(is_active=False)
        res = self.client.get('/api/establishments/public/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data, [])

    def test_03_inscription_medecin_et_agent_avec_id_etablissement_et_isolation_directeur(self):
        """
        Vérifie :
        - L'inscription d'un médecin et d'un agent d'accueil avec l'ID réel de l'établissement.
        - Le refus d'inscription sur un établissement inactif ou inexistant.
        - La visibilité et la validation exclusives par le directeur de l'établissement choisi.
        """
        # 1. Refus si établissement inactif
        res_inactif = self.client.post('/api/auth/register/', {
            "first_name": "Test",
            "last_name": "Inactif",
            "email": "test.inactif@chrz.sn",
            "telephone": "+221770001122",
            "role": "MEDECIN",
            "etablissement": self.etab_inactif.id,
            "password": "StrongPassword2026!",
            "password_confirm": "StrongPassword2026!",
        }, format='json')
        self.assertEqual(res_inactif.status_code, status.HTTP_400_BAD_REQUEST)

        # 2. Inscription d'un médecin sur CHRZ
        res_med = self.client.post('/api/auth/register/', {
            "first_name": "Awa",
            "last_name": "Sagna",
            "email": "awa.sagna@chrz.sn",
            "telephone": "+221771112233",
            "role": "MEDECIN",
            "etablissement": self.etab_zig.id,
            "matricule_professionnel": "ONMS-2026-777",
            "specialite": "Pédiatrie",
            "password": "StrongPassword2026!",
            "password_confirm": "StrongPassword2026!",
        }, format='json')
        self.assertEqual(res_med.status_code, status.HTTP_201_CREATED)
        med_id = res_med.data['user']['id']
        med_user = User.objects.get(id=med_id)
        self.assertEqual(med_user.etablissement_id, self.etab_zig.id)
        self.assertEqual(med_user.role, "MEDECIN")
        self.assertEqual(med_user.statut_validation, "PENDING")

        # 3. Inscription d'un agent d'accueil sur HPD
        res_agent = self.client.post('/api/auth/register/', {
            "first_name": "Moussa",
            "last_name": "Diouf",
            "email": "moussa.diouf@hpd.sn",
            "telephone": "+221772223344",
            "role": "AGENT",
            "etablissement": self.etab_hpd.id,
            "matricule_professionnel": "AG-HPD-055",
            "password": "StrongPassword2026!",
            "password_confirm": "StrongPassword2026!",
        }, format='json')
        self.assertEqual(res_agent.status_code, status.HTTP_201_CREATED)
        agent_id = res_agent.data['user']['id']
        agent_user = User.objects.get(id=agent_id)
        self.assertEqual(agent_user.etablissement_id, self.etab_hpd.id)
        self.assertEqual(agent_user.role, "AGENT")

        # 4. Vérification que chaque directeur reçoit uniquement les demandes de son établissement
        self.assertTrue(
            Notification.objects.filter(
                destinataire=self.directeur_zig,
                reference_objet_id=str(med_id)
            ).exists()
        )
        self.assertFalse(
            Notification.objects.filter(
                destinataire=self.directeur_hpd,
                reference_objet_id=str(med_id)
            ).exists()
        )

        # Le directeur de CHRZ voit uniquement la demande de CHRZ (Dr Awa Sagna) et non celle de HPD
        self.client.force_authenticate(user=self.directeur_zig)
        res_zig_list = self.client.get('/api/accounts/users/?statut_validation=PENDING')
        self.assertEqual(res_zig_list.status_code, status.HTTP_200_OK)
        zig_pending_ids = [u['id'] for u in (res_zig_list.data.get('results') or res_zig_list.data)]
        self.assertIn(med_id, zig_pending_ids)
        self.assertNotIn(agent_id, zig_pending_ids)

        # Le directeur de CHRZ ne peut pas valider la demande de l'agent rattaché à HPD
        res_cross_approve = self.client.post(f'/api/accounts/users/{agent_id}/approve/')
        self.assertIn(res_cross_approve.status_code, (status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN))

        # Le directeur de HPD peut valider la demande de son agent
        self.client.force_authenticate(user=self.directeur_hpd)
        res_hpd_approve = self.client.post(f'/api/accounts/users/{agent_id}/approve/')
        self.assertEqual(res_hpd_approve.status_code, status.HTTP_200_OK)
        agent_user.refresh_from_db()
        self.assertEqual(agent_user.statut_validation, "APPROVED")

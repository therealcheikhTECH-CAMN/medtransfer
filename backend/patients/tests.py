from datetime import date
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from establishments.models import Etablissement
from patients.models import Patient

User = get_user_model()


class PatientInstantSearchAndSecurityTests(APITestCase):
    def setUp(self):
        self.establishment = Etablissement.objects.create(
            nom="Hôpital Abass Ndao",
            type_etablissement="HOPITAL_NATIONAL",
            code="SN-DK-ABASS",
            adresse="Avenue Cheikh Anta Diop",
            ville="Dakar",
            region="Dakar",
            telephone="+221338497800",
            email="contact@abassndao.sn",
            is_active=True,
        )
        self.agent = User.objects.create_user(
            username="agent.accueil",
            email="agent.accueil@abassndao.sn",
            password="SecurePassword123!",
            first_name="Awa",
            last_name="Fall",
            role="AGENT",
            statut_validation="APPROVED",
            is_active=True,
            is_actif=True,
            etablissement=self.establishment,
        )
        self.p1 = Patient.objects.create(
            nom="Ndiaye",
            prenom="Amadou",
            date_naissance=date(1985, 4, 12),
            sexe="M",
            telephone="+221771112233",
            adresse="Médina",
            ville="Dakar",
            cree_par=self.agent,
            etablissement_creation=self.establishment,
        )
        self.p2 = Patient.objects.create(
            nom="Sané",
            prenom="Aïssatou",
            date_naissance=date(1992, 9, 23),
            sexe="F",
            telephone="+221774445566",
            adresse="Boucotte",
            ville="Ziguinchor",
            cree_par=self.agent,
            etablissement_creation=self.establishment,
        )
        self.client.force_authenticate(user=self.agent)

    @staticmethod
    def _results(response):
        return response.data["results"] if isinstance(response.data, dict) else response.data

    def test_search_by_first_name_last_name_and_partial_case_insensitive(self):
        # 1. Recherche par prénom
        res = self.client.get("/api/patients/", {"q": "Amadou"})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        items = self._results(res)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], self.p1.id)

        # 2. Recherche par nom (minuscules)
        res = self.client.get("/api/patients/", {"q": "ndiaye"})
        items = self._results(res)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], self.p1.id)

        # 3. Recherche partielle insensible à la casse (AMA)
        res = self.client.get("/api/patients/", {"q": "AMA"})
        items = self._results(res)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["id"], self.p1.id)

    def test_search_combined_first_and_last_name_both_orders(self):
        # Ordre Prénom Nom
        res_direct = self.client.get("/api/patients/", {"q": "amadou ndiaye"})
        self.assertEqual(res_direct.status_code, status.HTTP_200_OK)
        items_direct = self._results(res_direct)
        self.assertEqual(len(items_direct), 1)
        self.assertEqual(items_direct[0]["id"], self.p1.id)

        # Ordre inverse Nom Prénom
        res_inverse = self.client.get("/api/patients/", {"q": "ndiaye amadou"})
        self.assertEqual(res_inverse.status_code, status.HTTP_200_OK)
        items_inverse = self._results(res_inverse)
        self.assertEqual(len(items_inverse), 1)
        self.assertEqual(items_inverse[0]["id"], self.p1.id)

    def test_search_authorized_ville_and_empty_result(self):
        # Ville autorisée dans les critères
        res_ville = self.client.get("/api/patients/", {"q": "ziguinchor"})
        items_ville = self._results(res_ville)
        self.assertEqual(len(items_ville), 1)
        self.assertEqual(items_ville[0]["id"], self.p2.id)

        # Texte inexistant
        res_none = self.client.get("/api/patients/", {"q": "texte inexistant"})
        self.assertEqual(res_none.status_code, status.HTTP_200_OK)
        self.assertEqual(self._results(res_none), [])

        # Effacement de la recherche -> liste complète restaurée
        res_all = self.client.get("/api/patients/", {"q": ""})
        self.assertEqual(len(self._results(res_all)), 2)

    def test_search_accent_insensitive_and_diacritics(self):
        # Recherche 'sane' sans accent -> trouve 'Sané'
        res_sane = self.client.get("/api/patients/", {"q": "sane"})
        self.assertEqual(res_sane.status_code, status.HTTP_200_OK)
        items_sane = self._results(res_sane)
        self.assertEqual(len(items_sane), 1)
        self.assertEqual(items_sane[0]["id"], self.p2.id)

        # Recherche 'aissatou' sans tréma -> trouve 'Aïssatou'
        res_aissatou = self.client.get("/api/patients/", {"q": "aissatou"})
        self.assertEqual(res_aissatou.status_code, status.HTTP_200_OK)
        items_aissatou = self._results(res_aissatou)
        self.assertEqual(len(items_aissatou), 1)
        self.assertEqual(items_aissatou[0]["id"], self.p2.id)

        # Recherche multi-mots 'aissatou sane' sans accents
        res_multi = self.client.get("/api/patients/", {"q": "aissatou sane"})
        self.assertEqual(res_multi.status_code, status.HTTP_200_OK)
        items_multi = self._results(res_multi)
        self.assertEqual(len(items_multi), 1)
        self.assertEqual(items_multi[0]["id"], self.p2.id)

    def test_agent_permissions_and_patient_creation_no_regression(self):
        # Aucune donnée médicale exposée dans la liste des patients
        res = self.client.get("/api/patients/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        for item in self._results(res):
            self.assertNotIn("consultations", item)
            self.assertNotIn("diagnostic", item)
            self.assertNotIn("traitement", item)

        # Accès refusé aux dossiers médicaux et consultations pour l'agent d'accueil
        res_records = self.client.get("/api/medical-records/")
        self.assertEqual(res_records.status_code, status.HTTP_403_FORBIDDEN)
        res_consults = self.client.get("/api/consultations/")
        self.assertEqual(res_consults.status_code, status.HTTP_403_FORBIDDEN)

        # Création de patient et détection de doublons fonctionnelles
        dup_res = self.client.get(
            "/api/patients/check-duplicates/",
            {
                "nom": "Ndiaye",
                "prenom": "Amadou",
                "date_naissance": "1985-04-12",
            },
        )
        self.assertEqual(dup_res.status_code, status.HTTP_200_OK)
        self.assertTrue(dup_res.data["has_potential_duplicates"])

        create_res = self.client.post(
            "/api/patients/",
            {
                "nom": "Diop",
                "prenom": "Moussa",
                "date_naissance": "1990-01-15",
                "sexe": "M",
                "telephone": "+221778889900",
                "adresse": "Plateau",
                "ville": "Dakar",
            },
            format="json",
        )
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        self.assertTrue(create_res.data["medtransfer_id"].startswith("MDT-"))

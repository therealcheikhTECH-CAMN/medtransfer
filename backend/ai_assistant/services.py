import json
from django.conf import settings
from patients.models import Patient
from medical_records.models import DossierMedical


def preparer_contexte_clinique(patient_id, motif_consultation):
    """
    Sélection rigoureuse et contrôlée des données cliniques côté backend
    avant transmission au modèle de langage.
    """
    patient = Patient.objects.get(pk=patient_id)
    dossier = DossierMedical.objects.filter(patient=patient).first()

    contexte = {
        'patient': {
            'medtransfer_id': patient.medtransfer_id,
            'sexe': patient.get_sexe_display(),
            'age_ans': (settings.TIME_ZONE and patient.date_naissance) and (2026 - patient.date_naissance.year) if patient.date_naissance else "Inconnu",
            'groupe_sanguin': patient.groupe_sanguin,
            'statut_identite': patient.get_status_identite_display()
        },
        'motif_consultation_actuelle': motif_consultation,
        'antecedents': [],
        'allergies': [],
        'traitements_en_cours': [],
        'consultations_recentes': [],
        'examens_disponibles': []
    }

    if dossier:
        for ant in dossier.antecedents.filter(is_actif=True):
            contexte['antecedents'].append({
                'type': ant.get_type_antecedent_display(),
                'description': ant.description,
                'date': ant.date_diagnostic
            })

        for allg in dossier.allergies.all():
            contexte['allergies'].append({
                'substance': allg.substance,
                'severite': allg.get_severite_display(),
                'reaction': allg.reaction
            })

        for trt in dossier.traitements.filter(is_actif=True):
            if trt.est_en_cours:
                med_label = f"{trt.medicament} {trt.dosage}".strip()
                contexte['traitements_en_cours'].append({
                    'medicament': med_label,
                    'posologie': trt.posologie
                })

        for c in dossier.consultations.order_by('-date_consultation')[:5]:
            contexte['consultations_recentes'].append({
                'date': c.date_consultation.strftime('%d/%m/%Y'),
                'etablissement': c.etablissement.nom,
                'motif': c.motif,
                'diagnostic': c.diagnostic or 'Non précisé',
                'prescription': c.prescription or 'Aucune'
            })

        for ex in dossier.examens.order_by('-date_examen')[:3]:
            contexte['examens_disponibles'].append({
                'titre': ex.titre,
                'type': ex.type_examen,
                'date': ex.date_examen.strftime('%d/%m/%Y'),
                'resultat': ex.resultat[:150]
            })

    return patient, dossier, contexte


def generer_synthese_medicale(patient_id, motif_consultation, user=None, request=None):
    """
    Orchestration de la synthèse médicale :
    - Vérifie en amont l'autorisation de lecture du médecin sur le dossier médical du patient.
    - Tente un appel réel à l'API OpenAI si une clé est configurée.
    - Bascule vers le moteur local de synthèse clinique structurée si aucune clé n'est fournie.
    """
    if user is not None:
        from medical_records.access_control import MedicalRecordAccessService
        MedicalRecordAccessService.require_access(
            user=user,
            patient_id=patient_id,
            level=MedicalRecordAccessService.LEVEL_READ,
            entite_type='SyntheseIA',
            entite_id=patient_id,
            request=request,
        )
    patient, dossier, contexte = preparer_contexte_clinique(patient_id, motif_consultation)
    api_key = getattr(settings, 'OPENAI_API_KEY', '').strip()

    if api_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)
            system_prompt = (
                "Tu es un assistant médical pour les médecins de MEDTRANSFER. Ton rôle est de synthétiser "
                "l'historique documenté du patient pour préparer la consultation actuelle. "
                "RÈGLES ABSOLUES : "
                "1. Tu ne poses aucun diagnostic définitif. "
                "2. Tu ne rédiges aucune ordonnance. "
                "3. N'invente aucune donnée non présente dans le contexte. "
                "4. Fournis ta réponse sous forme de JSON strict avec les clés : "
                "'resume_antecedents', 'historique_pertinent', 'traitements_connus', "
                "'allergies_connues', 'elements_a_verifier', 'informations_manquantes', 'synthese_globale'."
            )
            response = client.chat.completions.create(
                model=getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini'),
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Voici les données médicales extraites :\n{json.dumps(contexte, ensure_ascii=False)}"}
                ],
                response_format={"type": "json_object"},
                temperature=0.2
            )
            data = json.loads(response.choices[0].message.content)
            data['is_mocked'] = False
            data['modele_utilise'] = getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini')
            data['contexte'] = contexte
            return data
        except Exception as e:
            # En cas d'erreur de quota ou réseau OpenAI, basculer proprement vers le moteur local structuré
            pass

    # =========================================================================
    # Moteur Local de Synthèse Clinique Structurée (Sans clé OpenAI ou en secours)
    # =========================================================================
    antecedents_str = ", ".join([f"{a['type']} ({a['description']})" for a in contexte['antecedents']]) or "Aucun antécédent documenté"
    allergies_str = ", ".join([f"{al['substance']} [{al['severite']}]" for al in contexte['allergies']]) or "Aucune allergie connue renseignée"
    traitements_str = ", ".join([f"{t['medicament']} ({t['posologie']})" for t in contexte['traitements_en_cours']]) or "Aucun traitement régulier documenté"
    consults_str = "; ".join([f"{c['date']} à {c['etablissement']} : {c['motif']} (Diag: {c['diagnostic']})" for c in contexte['consultations_recentes']]) or "Première consultation enregistrée sur la plateforme"

    vigilances = []
    if contexte['allergies']:
        vigilances.append(f"Prudence avec : {allergies_str}")
    if "HTA" in antecedents_str or "Hypertension" in antecedents_str:
        vigilances.append("Surveiller pression artérielle et observance thérapeutique")
    if "Diabète" in antecedents_str:
        vigilances.append("Vigilance fonction rénale, glycémie à jeun et fond d'oeil")
    if not vigilances:
        vigilances.append("Examiner les constantes vitales de base et l'état général")

    manquants = []
    if not contexte['allergies']:
        manquants.append("Rechercher activement d'éventuelles allergies médicamenteuses non renseignées")
    if not contexte['antecedents']:
        manquants.append("Compléter l'interrogatoire sur les antécédents familiaux et chirurgicaux")
    if not contexte['examens_disponibles']:
        manquants.append("Aucun examen biologique ou d'imagerie récent n'est consigné dans le dossier centralisé")

    synthese_globale = (
        f"Patient de {contexte['patient']['age_ans']} ans ({contexte['patient']['sexe']}) consultant pour : '{motif_consultation}'. "
        f"Historique documenté : {antecedents_str}. "
        f"Traitements en cours : {traitements_str}. "
        f"Alertes : {allergies_str}. "
        f"Derniers passages : {consults_str}."
    )

    return {
        'resume_antecedents': antecedents_str,
        'historique_pertinent': consults_str,
        'traitements_connus': traitements_str,
        'allergies_connues': allergies_str,
        'elements_a_verifier': " • ".join(vigilances),
        'informations_manquantes': " • ".join(manquants),
        'synthese_globale': synthese_globale,
        'is_mocked': True,
        'modele_utilise': 'Moteur de Synthèse Clinique Structurée MEDTRANSFER',
        'contexte': contexte
    }

import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { consultationService } from '../../services/consultationService';
import { patientService } from '../../services/patientService';
import { medicalRecordService } from '../../services/medicalRecordService';
import { aiService } from '../../services/aiService';
import { AlertBanner } from '../../components/AlertBanner';
import { SearchablePatientSelect } from '../../components/SearchablePatientSelect';
import { Stethoscope, Sparkles, AlertCircle, ArrowLeft, CheckCircle2, FileText, Pill, Plus, Trash2 } from 'lucide-react';

export const NewConsultationPage = () => {
  const [searchParams] = useSearchParams();
  const patientIdParam = searchParams.get('patient_id');
  const navigate = useNavigate();

  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(patientIdParam || '');
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [activeTreatments, setActiveTreatments] = useState([]);

  const todayIso = new Date().toISOString().slice(0, 10);

  const [formData, setFormData] = useState({
    motif: '',
    observations_cliniques: '',
    diagnostic: '',
    prescription: '',
    conclusions_recommandations: '',
    examens_demandes: '',
    constantes_ta: '',
    constantes_fc: '',
    constantes_temp: '',
    constantes_sat: '',
    constantes_poids: '',
  });

  // Explicit liaison between consultation and TraitementActuel
  const [treatmentMode, setTreatmentMode] = useState('NONE'); // 'NONE' | 'ADD' | 'UPDATE' | 'STOP'
  const [currentTreatmentOp, setCurrentTreatmentOp] = useState({
    traitement_id: '',
    medicament: '',
    dosage: '',
    posologie: '',
    frequence: '',
    date_debut: todayIso,
    date_fin: '',
    instructions: '',
    motif_arret: ''
  });
  const [queuedOperations, setQueuedOperations] = useState([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // AI Assistant in-page integration
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);

  const loadPatientTreatments = async (pId) => {
    if (!pId) {
      setActiveTreatments([]);
      return;
    }
    try {
      const rec = await medicalRecordService.getByPatientId(pId);
      const list = rec?.traitements || [];
      setActiveTreatments(list);
      if (list.length > 0) {
        const first = list[0];
        setCurrentTreatmentOp((prev) => ({
          ...prev,
          traitement_id: String(first.id),
          medicament: first.medicament || '',
          dosage: first.dosage || '',
          posologie: first.posologie || '',
          frequence: first.frequence || '',
          date_debut: first.date_debut || todayIso,
          date_fin: first.date_fin || '',
          instructions: first.instructions || ''
        }));
      }
    } catch (err) {
      setActiveTreatments([]);
    }
  };

  useEffect(() => {
    const fetchPatientData = async () => {
      try {
        if (patientIdParam) {
          const p = await patientService.getById(patientIdParam);
          setSelectedPatient(p);
          if (p.mode_acces_medecin === 'ORDINARY_CARE') {
            await loadPatientTreatments(patientIdParam);
          } else {
            setError(
              "Une consultation ordinaire ne peut être créée que pour un patient disposant d'une prise en charge ordinaire active sous votre responsabilité."
            );
          }
        }
        const list = await patientService.search('', '', 'my_care');
        setPatients((list || []).filter((pt) => !pt.mode_acces_medecin || pt.mode_acces_medecin === 'ORDINARY_CARE'));
      } catch (err) {
        console.error(err);
      }
    };
    fetchPatientData();
  }, [patientIdParam]);

  const handlePatientChange = async (e) => {
    const pId = e.target.value;
    setSelectedPatientId(pId);
    setQueuedOperations([]);
    setTreatmentMode('NONE');
    if (pId) {
      try {
        const p = await patientService.getById(pId);
        setSelectedPatient(p);
        await loadPatientTreatments(pId);
      } catch (err) {
        console.error(err);
      }
    } else {
      setSelectedPatient(null);
      setActiveTreatments([]);
    }
  };

  const handleTreatmentModeChange = (mode) => {
    setTreatmentMode(mode);
    if (mode === 'ADD') {
      setCurrentTreatmentOp({
        traitement_id: '',
        medicament: '',
        dosage: '',
        posologie: '',
        frequence: '',
        date_debut: todayIso,
        date_fin: '',
        instructions: '',
        motif_arret: ''
      });
    } else if ((mode === 'UPDATE' || mode === 'STOP') && activeTreatments.length > 0) {
      const first = activeTreatments[0];
      setCurrentTreatmentOp({
        traitement_id: String(first.id),
        medicament: first.medicament || '',
        dosage: first.dosage || '',
        posologie: first.posologie || '',
        frequence: first.frequence || '',
        date_debut: first.date_debut || todayIso,
        date_fin: first.date_fin || '',
        instructions: first.instructions || '',
        motif_arret: ''
      });
    }
  };

  const buildSingleOpFromForm = () => {
    if (treatmentMode === 'ADD') {
      if (!currentTreatmentOp.medicament.trim() || !currentTreatmentOp.posologie.trim()) {
        return { error: "Veuillez renseigner le nom du médicament et la posologie pour le nouveau traitement en cours." };
      }
      if (
        currentTreatmentOp.date_fin &&
        currentTreatmentOp.date_debut &&
        currentTreatmentOp.date_fin < currentTreatmentOp.date_debut
      ) {
        return { error: "La date de fin du traitement ne peut pas être antérieure à la date de début." };
      }
      return {
        op: {
          action: 'ADD',
          medicament: currentTreatmentOp.medicament.trim(),
          dosage: currentTreatmentOp.dosage.trim(),
          posologie: currentTreatmentOp.posologie.trim(),
          frequence: currentTreatmentOp.frequence.trim(),
          date_debut: currentTreatmentOp.date_debut || todayIso,
          date_fin: currentTreatmentOp.date_fin || null,
          instructions: currentTreatmentOp.instructions.trim()
        }
      };
    }
    if (treatmentMode === 'UPDATE') {
      if (!currentTreatmentOp.traitement_id) {
        return { error: "Veuillez sélectionner le traitement en cours à modifier." };
      }
      if (!currentTreatmentOp.medicament.trim() || !currentTreatmentOp.posologie.trim()) {
        return { error: "Le nom du médicament et la posologie sont requis pour modifier un traitement." };
      }
      return {
        op: {
          action: 'UPDATE',
          traitement_id: Number(currentTreatmentOp.traitement_id),
          medicament: currentTreatmentOp.medicament.trim(),
          dosage: currentTreatmentOp.dosage.trim(),
          posologie: currentTreatmentOp.posologie.trim(),
          frequence: currentTreatmentOp.frequence.trim(),
          date_debut: currentTreatmentOp.date_debut || null,
          date_fin: currentTreatmentOp.date_fin || null,
          instructions: currentTreatmentOp.instructions.trim()
        }
      };
    }
    if (treatmentMode === 'STOP') {
      if (!currentTreatmentOp.traitement_id) {
        return { error: "Veuillez sélectionner le traitement en cours à arrêter." };
      }
      return {
        op: {
          action: 'STOP',
          traitement_id: Number(currentTreatmentOp.traitement_id),
          motif_arret: currentTreatmentOp.motif_arret.trim() || "Arrêté lors de la consultation"
        }
      };
    }
    return { op: null };
  };

  const handleQueueTreatmentOp = () => {
    const { op, error: opErr } = buildSingleOpFromForm();
    if (opErr) {
      setError(opErr);
      return;
    }
    if (op) {
      setError('');
      setQueuedOperations((prev) => [...prev, op]);
      setTreatmentMode('NONE');
    }
  };

  const handleRemoveQueuedOp = (idx) => {
    setQueuedOperations((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerateAI = async () => {
    if (!selectedPatientId || !formData.motif) {
      alert("Veuillez d'abord sélectionner un patient et saisir le motif de consultation.");
      return;
    }

    try {
      setAiGenerating(true);
      const res = await aiService.generateSummary(parseInt(selectedPatientId), formData.motif);
      setAiSummary(res);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la génération de la synthèse IA.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setError("Veuillez sélectionner un patient titulaire du dossier.");
      return;
    }

    const operations_traitements = [...queuedOperations];
    if (treatmentMode !== 'NONE') {
      const { op, error: opErr } = buildSingleOpFromForm();
      if (opErr) {
        setError(opErr);
        return;
      }
      if (op) {
        operations_traitements.push(op);
      }
    }

    try {
      setSubmitting(true);
      setError('');
      await consultationService.create({
        patient_id: parseInt(selectedPatientId),
        motif: formData.motif,
        observations_cliniques: formData.observations_cliniques,
        diagnostic: formData.diagnostic,
        prescription: formData.prescription,
        conclusions_recommandations: formData.conclusions_recommandations,
        examens_demandes: formData.examens_demandes,
        constantes: {
          ta: formData.constantes_ta,
          fc: formData.constantes_fc,
          temp: formData.constantes_temp,
          sat: formData.constantes_sat,
          poids: formData.constantes_poids
        },
        operations_traitements
      });
      navigate(`/doctor/patients/${selectedPatientId}`);
    } catch (err) {
      console.error(err);
      const detail =
        err.response?.data?.detail ||
        "Erreur lors de l'enregistrement de la consultation. Vérifiez que vous détenez bien la prise en charge ordinaire active de ce patient.";
      setError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-50 text-[#1976D2] border border-sky-100 rounded-xl">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#123B5D]">Nouvelle Consultation Médicale</h2>
            <p className="text-xs text-[#64748B]">
              Enregistrement dans l'historique chronologique partagé de MEDTRANSFER.
            </p>
          </div>
        </div>

        {selectedPatient && (
          <div className="hidden sm:block text-right">
            <span className="text-xs font-bold text-[#123B5D] block">
              {selectedPatient.nom.toUpperCase()} {selectedPatient.prenom}
            </span>
            <span className="font-mono text-[10px] text-[#1976D2] font-bold">
              {selectedPatient.medtransfer_id}
            </span>
          </div>
        )}
      </div>

      {error && (
        <AlertBanner type="danger" title="Erreur d'enregistrement" message={error} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form (2 cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-5">
          {/* Patient Selector if not passed */}
          <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider">
              Patient Titulaire du Dossier *
            </label>
            <SearchablePatientSelect
              value={selectedPatientId}
              onChange={handlePatientChange}
              scope="my_care"
              filterFn={(pt) => !pt.mode_acces_medecin || pt.mode_acces_medecin === 'ORDINARY_CARE'}
              placeholder="Rechercher par nom, prénom ou identifiant MEDTRANSFER..."
              required
            />
          </div>

          {/* Consultation Core Form */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Motif de consultation *
              </label>
              <input
                type="text"
                name="motif"
                value={formData.motif}
                onChange={handleChange}
                required
                placeholder="ex: Céphalées frontales pulsatiles avec poussée hypertensive"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
              />
            </div>

            {/* Constantes vitales */}
            <div>
              <span className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-2">
                Constantes Vitales
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Tension (TA)</label>
                  <input
                    type="text"
                    name="constantes_ta"
                    value={formData.constantes_ta}
                    onChange={handleChange}
                    placeholder="150/90"
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Pouls (FC)</label>
                  <input
                    type="text"
                    name="constantes_fc"
                    value={formData.constantes_fc}
                    onChange={handleChange}
                    placeholder="78 bpm"
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Température</label>
                  <input
                    type="text"
                    name="constantes_temp"
                    value={formData.constantes_temp}
                    onChange={handleChange}
                    placeholder="37.0 °C"
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Sat. O2</label>
                  <input
                    type="text"
                    name="constantes_sat"
                    value={formData.constantes_sat}
                    onChange={handleChange}
                    placeholder="98 %"
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Poids</label>
                  <input
                    type="text"
                    name="constantes_poids"
                    value={formData.constantes_poids}
                    onChange={handleChange}
                    placeholder="75 kg"
                    className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Clinical observations */}
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Observations Cliniques & Examen Physique *
              </label>
              <textarea
                name="observations_cliniques"
                value={formData.observations_cliniques}
                onChange={handleChange}
                required
                rows={4}
                placeholder="Détaillez l'examen clinique, auscultation, palpation..."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none leading-relaxed"
              />
            </div>

            {/* Diagnostic & Prescription */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Hypothèse / Diagnostic Médical
                </label>
                <textarea
                  name="diagnostic"
                  value={formData.diagnostic}
                  onChange={handleChange}
                  rows={3}
                  placeholder="ex: Céphalées secondaires à une poussée hypertensive"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Prescription Médicamenteuse & Posologie (compte-rendu de consultation)
                </label>
                <textarea
                  name="prescription"
                  value={formData.prescription}
                  onChange={handleChange}
                  rows={3}
                  placeholder="ex: Amlodipine 10mg : 1 cp/j le matin"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                />
              </div>
            </div>

            {/* Liaison explicite avec la rubrique « Traitements en cours » */}
            <div className="p-4 rounded-xl bg-teal-50/40 border border-teal-200/80 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Pill className="w-4 h-4 text-[#009688]" />
                  <span className="font-bold text-[#123B5D] uppercase text-[10px] tracking-wider">
                    Impact sur les « Traitements en cours » du dossier médical
                  </span>
                </div>
                <span className="text-[10px] font-medium text-slate-500">
                  {activeTreatments.length} traitement{activeTreatments.length > 1 ? 's' : ''} actif{activeTreatments.length > 1 ? 's' : ''} actuellement
                </span>
              </div>

              <div>
                <select
                  value={treatmentMode}
                  onChange={(e) => handleTreatmentModeChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-xs font-medium text-slate-700"
                >
                  <option value="NONE">
                    Prescription ponctuelle sans changement des traitements en cours
                  </option>
                  <option value="ADD">
                    Introduire un nouveau traitement en cours dans le dossier médical
                  </option>
                  {activeTreatments.length > 0 && (
                    <>
                      <option value="UPDATE">
                        Modifier un traitement en cours existant
                      </option>
                      <option value="STOP">
                        Arrêter un traitement en cours existant
                      </option>
                    </>
                  )}
                </select>
              </div>

              {(treatmentMode === 'UPDATE' || treatmentMode === 'STOP') && activeTreatments.length > 0 && (
                <div>
                  <label className="block font-semibold text-slate-700 text-[11px] mb-1">
                    Traitement en cours concerné *
                  </label>
                  <select
                    value={currentTreatmentOp.traitement_id}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const found = activeTreatments.find((t) => String(t.id) === String(selectedId));
                      setCurrentTreatmentOp({
                        ...currentTreatmentOp,
                        traitement_id: selectedId,
                        medicament: found?.medicament || '',
                        dosage: found?.dosage || '',
                        posologie: found?.posologie || '',
                        frequence: found?.frequence || '',
                        date_debut: found?.date_debut || todayIso,
                        date_fin: found?.date_fin || '',
                        instructions: found?.instructions || ''
                      });
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg outline-none text-xs"
                  >
                    {activeTreatments.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.medicament} {t.dosage ? `(${t.dosage})` : ''} — {t.posologie}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(treatmentMode === 'ADD' || treatmentMode === 'UPDATE') && (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
                        Nom du médicament *
                      </label>
                      <input
                        type="text"
                        value={currentTreatmentOp.medicament}
                        onChange={(e) => setCurrentTreatmentOp({ ...currentTreatmentOp, medicament: e.target.value })}
                        placeholder="Ex: Amlodipine"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
                        Dosage
                      </label>
                      <input
                        type="text"
                        value={currentTreatmentOp.dosage}
                        onChange={(e) => setCurrentTreatmentOp({ ...currentTreatmentOp, dosage: e.target.value })}
                        placeholder="Ex: 10 mg"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
                        Posologie *
                      </label>
                      <input
                        type="text"
                        value={currentTreatmentOp.posologie}
                        onChange={(e) => setCurrentTreatmentOp({ ...currentTreatmentOp, posologie: e.target.value })}
                        placeholder="Ex: 1 comprimé par jour"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
                        Fréquence
                      </label>
                      <input
                        type="text"
                        value={currentTreatmentOp.frequence}
                        onChange={(e) => setCurrentTreatmentOp({ ...currentTreatmentOp, frequence: e.target.value })}
                        placeholder="Ex: Le matin"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
                        Date de début *
                      </label>
                      <input
                        type="date"
                        value={currentTreatmentOp.date_debut}
                        onChange={(e) => setCurrentTreatmentOp({ ...currentTreatmentOp, date_debut: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
                        Date de fin (optionnelle)
                      </label>
                      <input
                        type="date"
                        value={currentTreatmentOp.date_fin}
                        onChange={(e) => setCurrentTreatmentOp({ ...currentTreatmentOp, date_fin: e.target.value })}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
                      Instructions / Observations (optionnel)
                    </label>
                    <input
                      type="text"
                      value={currentTreatmentOp.instructions}
                      onChange={(e) => setCurrentTreatmentOp({ ...currentTreatmentOp, instructions: e.target.value })}
                      placeholder="Ex: Contrôle tensionnel dans 15 jours"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>
                </div>
              )}

              {treatmentMode === 'STOP' && (
                <div>
                  <label className="block font-semibold text-slate-700 text-[10px] uppercase mb-1">
                    Motif de l'arrêt du traitement
                  </label>
                  <input
                    type="text"
                    value={currentTreatmentOp.motif_arret}
                    onChange={(e) => setCurrentTreatmentOp({ ...currentTreatmentOp, motif_arret: e.target.value })}
                    placeholder="Ex: Fin de cure ou remplacement thérapeutique"
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              )}

              {treatmentMode !== 'NONE' && (
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleQueueTreatmentOp}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-teal-300 text-[#009688] hover:bg-teal-50 font-semibold text-[11px]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Valider et ajouter une autre opération sur les traitements
                  </button>
                </div>
              )}

              {queuedOperations.length > 0 && (
                <div className="pt-2 border-t border-teal-200/70 space-y-1.5">
                  <span className="block text-[10px] font-bold uppercase text-teal-900">
                    Opérations programmées sur les traitements en cours ({queuedOperations.length}) :
                  </span>
                  {queuedOperations.map((op, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-white border border-teal-200 text-[11px]"
                    >
                      <div>
                        <span className="font-bold text-[#009688] mr-1.5">
                          [{op.action === 'ADD' ? 'AJOUT' : op.action === 'UPDATE' ? 'MODIFICATION' : 'ARRÊT'}]
                        </span>
                        <span className="font-semibold text-slate-800">
                          {op.medicament || `Traitement #${op.traitement_id}`}
                        </span>
                        {op.posologie && <span className="text-slate-600"> — {op.posologie}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveQueuedOp(idx)}
                        className="text-rose-600 hover:text-rose-800 p-1"
                        title="Retirer cette opération"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conclusions & Examens */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Conclusions & Conseils de Conduite
                </label>
                <input
                  type="text"
                  name="conclusions_recommandations"
                  value={formData.conclusions_recommandations}
                  onChange={handleChange}
                  placeholder="ex: Auto-mesure matin et soir, contrôle dans 15 jours"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Examens Complémentaires Prescrits
                </label>
                <input
                  type="text"
                  name="examens_demandes"
                  value={formData.examens_demandes}
                  onChange={handleChange}
                  placeholder="ex: Créatininémie, ECG, Fond d'oeil"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-md disabled:opacity-50"
              >
                <Stethoscope className="w-4 h-4" />
                {submitting ? 'Enregistrement...' : 'Enregistrer la consultation'}
              </button>
            </div>
          </div>
        </form>

        {/* Side Panel: Integrated AI Assistant */}
        <div className="space-y-4">
          <div className="p-5 bg-gradient-to-br from-white to-sky-50/50 rounded-2xl border border-sky-100 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#1976D2]" />
              <h3 className="text-sm font-bold text-[#123B5D]">
                Assistant Médical IA
              </h3>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Générez une synthèse instantanée des antécédents et vigilances médicamenteuses documentées
              pour vous assister dans la consultation.
            </p>

            <button
              type="button"
              onClick={handleGenerateAI}
              disabled={aiGenerating || !formData.motif || !selectedPatientId}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#123B5D] hover:bg-[#0e2c46] rounded-xl shadow-sm disabled:opacity-40 transition-all"
            >
              <Sparkles className="w-4 h-4 text-sky-400" />
              {aiGenerating ? 'Analyse du dossier...' : 'Synthétiser l\'historique'}
            </button>
          </div>

          {aiSummary && (
            <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="font-bold text-[#123B5D] text-xs">Aperçu de la Synthèse</span>
                <span className="text-[10px] text-slate-400 font-mono">gpt-4o-mini</span>
              </div>

              <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-100">
                <span className="font-bold text-rose-900 block text-[10px] uppercase">Allergies connues :</span>
                <p className="text-rose-800 text-[11px]">{aiSummary.allergies_connues || 'Aucune'}</p>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-100">
                <span className="font-bold text-amber-900 block text-[10px] uppercase">Points de vigilance :</span>
                <p className="text-amber-800 text-[11px]">{aiSummary.elements_a_verifier || 'Examiner constantes'}</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-700 block text-[10px] uppercase mb-1">Résumé global :</span>
                <p className="text-slate-800 text-[11px] leading-relaxed">{aiSummary.synthese_globale}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

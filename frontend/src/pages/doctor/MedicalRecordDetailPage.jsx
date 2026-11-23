import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { medicalRecordService } from '../../services/medicalRecordService';
import { patientService } from '../../services/patientService';
import { emergencyService } from '../../services/emergencyService';
import { careService } from '../../services/careService';
import { aiService } from '../../services/aiService';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { AlertBanner } from '../../components/AlertBanner';
import { formatDate, formatDateTime, calculateAge } from '../../utils/formatters';
import {
  FileText,
  AlertTriangle,
  AlertCircle,
  Stethoscope,
  Pill,
  Sparkles,
  ArrowRightLeft,
  Calendar,
  Clock,
  ShieldAlert,
  Plus,
  PlusCircle,
  CheckCircle2,
  CheckSquare,
  XCircle,
  Edit3,
  History,
  Activity
} from 'lucide-react';

export const MedicalRecordDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [dossier, setDossier] = useState(null);
  const [patientIdentity, setPatientIdentity] = useState(null);
  const [activeCare, setActiveCare] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState(null);

  // Clôture de prise en charge State
  const [isCloseCareModalOpen, setIsCloseCareModalOpen] = useState(false);
  const [closeCareMotif, setCloseCareMotif] = useState("Fin de traitement / Patient guéri");
  const [closeCareNotes, setCloseCareNotes] = useState('');
  const [closeCareError, setCloseCareError] = useState('');
  const [closeCareLoading, setCloseCareLoading] = useState(false);

  // Break-Glass Emergency Access Authorization State
  const [isBreakGlassModalOpen, setIsBreakGlassModalOpen] = useState(false);
  const [breakGlassForm, setBreakGlassForm] = useState({
    motif_urgence: '',
    justification_acces: '',
    niveau_acces: 'INTERVENTION_CLINIQUE'
  });
  const [breakGlassSubmitting, setBreakGlassSubmitting] = useState(false);
  const [breakGlassError, setBreakGlassError] = useState('');
  const [initiatingCare, setInitiatingCare] = useState(false);

  // Modals state
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isAntecedentModalOpen, setIsAntecedentModalOpen] = useState(false);
  const [isAllergieModalOpen, setIsAllergieModalOpen] = useState(false);
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [selectedConsultation, setSelectedConsultation] = useState(null);

  // Emergency Form State
  const [emergencyData, setEmergencyData] = useState({
    motif_urgence: '',
    justification_acces_derogatoire: '',
    observations_cliniques: '',
    diagnostic: '',
    prescription: '',
    conclusions_recommandations: '',
    constantes_ta: '',
    constantes_fc: '',
    constantes_temp: '',
    constantes_sat: ''
  });
  const [emergencySubmitting, setEmergencySubmitting] = useState(false);

  // AI Assistant State
  const [aiMotif, setAiMotif] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiEditedText, setAiEditedText] = useState('');
  const [aiActionMessage, setAiActionMessage] = useState('');

  // Quick Add Forms
  const [antecedentForm, setAntecedentForm] = useState({ type_antecedent: 'MEDICAL', description: '', date_diagnostic: '' });
  const [allergieForm, setAllergieForm] = useState({ substance: '', severite: 'SEVERE', reaction: '' });

  // Rectification State
  const [isAmendModalOpen, setIsAmendModalOpen] = useState(false);
  const [amendForm, setAmendForm] = useState({
    motif_modification: '',
    observations_cliniques: '',
    diagnostic: '',
    prescription: '',
    conclusions_recommandations: ''
  });
  const [amendSubmitting, setAmendSubmitting] = useState(false);

  // Revisions detail state
  const [consultationDetails, setConsultationDetails] = useState(null);
  const [loadingRevisions, setLoadingRevisions] = useState(false);

  const handleOpenRevisions = async (c) => {
    setSelectedConsultation(c);
    setIsRevisionModalOpen(true);
    try {
      setLoadingRevisions(true);
      const { consultationService } = await import('../../services/consultationService');
      const res = await consultationService.getById(c.id);
      setConsultationDetails(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRevisions(false);
    }
  };

  const handleOpenAmend = (c) => {
    setSelectedConsultation(c);
    setAmendForm({
      motif_modification: '',
      observations_cliniques: c.observations_cliniques || '',
      diagnostic: c.diagnostic || '',
      prescription: c.prescription || '',
      conclusions_recommandations: c.conclusions_recommandations || ''
    });
    setIsAmendModalOpen(true);
  };

  const handleAmendSubmit = async (e) => {
    e.preventDefault();
    if (!selectedConsultation || !amendForm.motif_modification) return;

    try {
      setAmendSubmitting(true);
      const { consultationService } = await import('../../services/consultationService');
      await consultationService.amend(selectedConsultation.id, amendForm);
      setIsAmendModalOpen(false);
      setSelectedConsultation(null);
      await fetchRecord();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la rectification.");
    } finally {
      setAmendSubmitting(false);
    }
  };

  const fetchRecord = async () => {
    try {
      setLoading(true);
      setError('');
      setErrorCode(null);
      const [careRes, patRes] = await Promise.all([
        patientService.getActiveCare(id).catch(() => null),
        patientService.getById(id).catch(() => null)
      ]);
      if (careRes) setActiveCare(careRes);
      if (patRes) setPatientIdentity(patRes);

      const rec = await medicalRecordService.getByPatientId(id);
      setDossier(rec);
    } catch (err) {
      console.error(err);
      setDossier(null);
      const status = err.response?.status;
      setErrorCode(status);
      if (status === 403) {
        setError(
          "Accès au dossier médical non autorisé. Aucune prise en charge active ne vous donne actuellement accès à ce dossier."
        );
      } else if (status === 404) {
        setError("Dossier médical ou patient introuvable.");
      } else {
        setError("Impossible de charger le dossier médical pour ce patient.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecord();
  }, [id]);

  const handleInitiateOrdinaryCare = async () => {
    try {
      setInitiatingCare(true);
      await careService.takeCharge(parseInt(id, 10));
      await fetchRecord();
    } catch (err) {
      console.error(err);
      const detail =
        err.response?.data?.detail ||
        "Impossible de prendre en charge ce patient.";
      alert(detail);
    } finally {
      setInitiatingCare(false);
    }
  };

  const handleConfirmCloseCare = async (e) => {
    e.preventDefault();
    if (!activeCare?.prise_en_charge?.id) return;
    const motifTrimmed = (closeCareMotif || '').trim();
    if (!motifTrimmed) {
      setCloseCareError("Le motif de clôture est strictement obligatoire.");
      return;
    }
    try {
      setCloseCareLoading(true);
      setCloseCareError('');
      const fullMotif = closeCareNotes.trim()
        ? `${motifTrimmed} — Résumé : ${closeCareNotes.trim()}`
        : motifTrimmed;
      await careService.closePec(activeCare.prise_en_charge.id, fullMotif);
      setIsCloseCareModalOpen(false);
      await fetchRecord();
    } catch (err) {
      console.error(err);
      const detail = err.response?.data?.detail || "Erreur lors de la clôture de la prise en charge.";
      setCloseCareError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setCloseCareLoading(false);
    }
  };

  const handleRequestBreakGlassAccess = async (e) => {
    e.preventDefault();
    setBreakGlassError('');
    if (!breakGlassForm.motif_urgence.trim() || !breakGlassForm.justification_acces.trim()) {
      setBreakGlassError("Veuillez renseigner obligatoirement le motif médical d'urgence et la justification clinique.");
      return;
    }
    try {
      setBreakGlassSubmitting(true);
      await emergencyService.requestAccess({
        patient_id: parseInt(id, 10),
        motif_urgence: breakGlassForm.motif_urgence.trim(),
        justification_acces: breakGlassForm.justification_acces.trim(),
        niveau_acces: breakGlassForm.niveau_acces
      });
      setIsBreakGlassModalOpen(false);
      setBreakGlassForm({
        motif_urgence: '',
        justification_acces: '',
        niveau_acces: 'INTERVENTION_CLINIQUE'
      });
      await fetchRecord();
    } catch (err) {
      console.error(err);
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.motif_urgence?.[0] ||
        err.response?.data?.justification_acces?.[0] ||
        "Impossible d'ouvrir l'autorisation exceptionnelle d'urgence.";
      setBreakGlassError(detail);
    } finally {
      setBreakGlassSubmitting(false);
    }
  };

  const handleRevokeEmergencyAccess = async () => {
    try {
      await emergencyService.revokeAccess({
        patient_id: parseInt(id, 10),
        motif: "Fin de la consultation ou de l'intervention d'urgence"
      });
      await fetchRecord();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la révocation de l'accès d'urgence.");
    }
  };

  const handleEmergencySubmit = async (e) => {
    e.preventDefault();
    try {
      setEmergencySubmitting(true);
      const payload = {
        patient_id: parseInt(id, 10),
        motif_urgence: emergencyData.motif_urgence,
        justification_acces_derogatoire: emergencyData.justification_acces_derogatoire,
        observations_cliniques: emergencyData.observations_cliniques,
        diagnostic: emergencyData.diagnostic,
        prescription: emergencyData.prescription,
        conclusions_recommandations: emergencyData.conclusions_recommandations,
        constantes: {
          ta: emergencyData.constantes_ta,
          fc: emergencyData.constantes_fc,
          temp: emergencyData.constantes_temp,
          sat: emergencyData.constantes_sat
        }
      };
      await emergencyService.createIntervention(payload);
      setIsEmergencyModalOpen(false);
      setEmergencyData({
        motif_urgence: '',
        justification_acces_derogatoire: '',
        observations_cliniques: '',
        diagnostic: '',
        prescription: '',
        conclusions_recommandations: '',
        constantes_ta: '',
        constantes_fc: '',
        constantes_temp: '',
        constantes_sat: ''
      });
      await fetchRecord();
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'enregistrement de l'intervention d'urgence.");
    } finally {
      setEmergencySubmitting(false);
    }
  };

  const handleGenerateAI = async (e) => {
    e.preventDefault();
    if (!aiMotif) return;
    try {
      setAiGenerating(true);
      setAiActionMessage('');
      const res = await aiService.generateSummary(parseInt(id, 10), aiMotif);
      setAiSummary(res);
      setAiEditedText(res.synthese_globale || '');
    } catch (err) {
      console.error(err);
      alert("Erreur lors de la génération de la synthèse IA.");
    } finally {
      setAiGenerating(false);
    }
  };

  const handleValidateAI = async () => {
    if (!aiSummary) return;
    try {
      const res = await aiService.validateSummary(aiSummary.id, aiEditedText, "Synthèse validée par le praticien.");
      setAiSummary(res);
      setAiActionMessage("Synthèse validée et enregistrée avec succès !");
    } catch (err) {
      console.error(err);
    }
  };

  const handleRejectAI = async () => {
    if (!aiSummary) return;
    const motif = window.prompt("Motif du rejet de la synthèse :", "Éléments non pertinents pour la consultation actuelle");
    if (!motif) return;
    try {
      const res = await aiService.rejectSummary(aiSummary.id, motif);
      setAiSummary(res);
      setAiActionMessage("Proposition de synthèse rejetée.");
    } catch (err) {
      console.error(err);
    }
  };

  // Quick Add Handlers
  const handleAddAntecedent = async (e) => {
    e.preventDefault();
    try {
      await medicalRecordService.addAntecedent({ ...antecedentForm, dossier: dossier.id });
      setIsAntecedentModalOpen(false);
      setAntecedentForm({ type_antecedent: 'MEDICAL', description: '', date_diagnostic: '' });
      await fetchRecord();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddAllergie = async (e) => {
    e.preventDefault();
    try {
      await medicalRecordService.addAllergie({ ...allergieForm, dossier: dossier.id });
      setIsAllergieModalOpen(false);
      setAllergieForm({ substance: '', severite: 'SEVERE', reaction: '' });
      await fetchRecord();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <LoadingSkeleton lines={8} />;

  if (error && errorCode === 404) {
    return (
      <div className="space-y-6">
        <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm">
          <FileText className="w-12 h-12 text-slate-400 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-800">Dossier Médical Introuvable</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Le dossier médical demandé pour ce patient n'existe pas ou l'identifiant est invalide.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/doctor/patients')}
            className="px-5 py-2.5 bg-[#1976D2] hover:bg-[#1565C0] text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
          >
            Retour à la liste des patients
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    const canInitiateOrdinaryCare = activeCare && (
      !activeCare.has_active_care ||
      (!activeCare.prise_en_charge?.medecin_responsable_id && activeCare.prise_en_charge?.etablissement_id === user?.etablissement?.id)
    );
    return (
      <div className="space-y-6">
        <div className="p-8 bg-white rounded-2xl border border-rose-200 text-center space-y-5 shadow-sm">
          <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-rose-900">Accès au Dossier Médical Restreint</h3>
            {patientIdentity && (
              <p className="text-sm font-bold text-[#123B5D]">
                Patient : {patientIdentity.nom?.toUpperCase()} {patientIdentity.prenom} ({patientIdentity.medtransfer_id})
              </p>
            )}
            <p className="text-xs text-rose-700 max-w-xl mx-auto leading-relaxed font-medium">
              {error}
            </p>
            {activeCare?.has_active_care && activeCare?.prise_en_charge && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 max-w-lg mx-auto">
                Suivi ordinaire actif détenu par <strong>{activeCare.prise_en_charge.medecin_nom}</strong> à{' '}
                <strong>{activeCare.prise_en_charge.etablissement_nom}</strong>.
              </p>
            )}
            {activeCare && !activeCare.has_active_care && (
              <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 max-w-md mx-auto">
                Ce patient n'a actuellement aucun médecin responsable et est disponible pour une prise en charge.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {canInitiateOrdinaryCare && (
              <button
                type="button"
                disabled={initiatingCare}
                onClick={handleInitiateOrdinaryCare}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                {initiatingCare ? 'Ouverture en cours...' : 'Prendre en charge ce patient'}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setBreakGlassError('');
                setIsBreakGlassModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#DC2626] hover:bg-rose-700 text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
            >
              <ShieldAlert className="w-4 h-4" />
              Demander un accès exceptionnel d'urgence (Break-Glass)
            </button>

            <button
              type="button"
              onClick={() => navigate('/doctor/patients')}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-all"
            >
              Retour à la liste des patients
            </button>
          </div>
        </div>

        {/* MODAL : DEMANDE D'AUTORISATION EXCEPTIONNELLE D'URGENCE (BREAK-GLASS) */}
        <Modal
          isOpen={isBreakGlassModalOpen}
          onClose={() => setIsBreakGlassModalOpen(false)}
          title="Ouverture d'un Accès Exceptionnel d'Urgence (« Break-Glass »)"
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleRequestBreakGlassAccess} className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
              <span className="font-bold block">Protocole médicolégal d'accès dérogatoire :</span>
              <p className="text-[11px] leading-relaxed">
                Cet accès exceptionnel est strictement limité dans le temps (2 heures), intégralement journalisé
                dans l'audit de sécurité et notifié immédiatement au médecin responsable du suivi ordinaire.
              </p>
            </div>

            {breakGlassError && (
              <div className="p-3 rounded-xl bg-rose-100 border border-rose-300 text-rose-900 font-medium">
                {breakGlassError}
              </div>
            )}

            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Motif médical d'urgence *
              </label>
              <input
                type="text"
                required
                value={breakGlassForm.motif_urgence}
                onChange={(e) => setBreakGlassForm({ ...breakGlassForm, motif_urgence: e.target.value })}
                placeholder="ex: Détresse respiratoire aiguë, traumatisme crânien, malaise grave..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Justification dérogatoire détaillée *
              </label>
              <textarea
                rows={3}
                required
                value={breakGlassForm.justification_acces}
                onChange={(e) => setBreakGlassForm({ ...breakGlassForm, justification_acces: e.target.value })}
                placeholder="Précisez les circonstances cliniques imposant l'accès immédiat au dossier médical hors prise en charge ordinaire..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Niveau d'accès requis *
              </label>
              <select
                value={breakGlassForm.niveau_acces}
                onChange={(e) => setBreakGlassForm({ ...breakGlassForm, niveau_acces: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              >
                <option value="INTERVENTION_CLINIQUE">
                  Lecture du dossier & intervention clinique d'urgence
                </option>
                <option value="LECTURE_SEULE">
                  Consultation du dossier en lecture seule uniquement
                </option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBreakGlassModalOpen(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={breakGlassSubmitting}
                className="px-5 py-2 bg-[#DC2626] hover:bg-rose-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50"
              >
                {breakGlassSubmitting ? 'Autorisation en cours...' : "Ouvrir l'accès d'urgence"}
              </button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="space-y-6">
        <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm">
          <FileText className="w-12 h-12 text-slate-400 mx-auto" />
          <div className="space-y-2">
            <h3 className="text-lg font-bold text-slate-800">Dossier Médical Introuvable</h3>
            <p className="text-xs text-slate-600 max-w-md mx-auto">
              Aucun dossier médical n'a pu être chargé pour cet identifiant.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/doctor/patients')}
            className="px-5 py-2.5 bg-[#1976D2] hover:bg-[#1565C0] text-white font-semibold text-xs rounded-xl shadow-sm transition-all"
          >
            Retour à la liste des patients
          </button>
        </div>
      </div>
    );
  }

  const p = dossier?.patient_details || patientIdentity || {};
  const accessMode = dossier?.contexte_acces?.mode || 'ORDINARY_CARE';
  const emergencyLevel = dossier?.contexte_acces?.niveau_acces || null;
  const canWriteClinical =
    accessMode === 'ORDINARY_CARE' ||
    (accessMode === 'EMERGENCY_ACCESS' && emergencyLevel === 'INTERVENTION_CLINIQUE');
  const canCreateOrdinaryConsultation = accessMode === 'ORDINARY_CARE';

  const canInitiateCareFromHeader = !activeCare?.has_active_care || (
    !activeCare.prise_en_charge?.medecin_responsable_id &&
    activeCare.prise_en_charge?.etablissement_id === user?.etablissement?.id
  );

  return (
    <div className="space-y-6">
      {/* BANDEAU D'AUTORISATION D'URGENCE ACTIVE */}
      {accessMode === 'EMERGENCY_ACCESS' && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-start gap-2.5 text-xs">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                Accès exceptionnel d'urgence actif (
                {emergencyLevel === 'LECTURE_SEULE' ? 'Lecture seule' : "Intervention clinique d'urgence"})
              </span>
              <span className="text-[11px] text-rose-800">
                Cet accès dérogatoire est tracé et expire automatiquement le{' '}
                <strong>{formatDateTime(dossier?.contexte_acces?.date_expiration)}</strong>.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRevokeEmergencyAccess}
            className="px-3.5 py-1.5 bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors"
          >
            Fermer / Révoquer l'accès d'urgence
          </button>
        </div>
      )}

      {/* 1. PATIENT HEADER CARD */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-black text-[#123B5D] tracking-tight">
              {p.nom ? p.nom.toUpperCase() : 'PATIENT'} {p.prenom || ''}
            </h2>
            <span className="px-2.5 py-1 bg-sky-50 text-[#1976D2] border border-sky-200 rounded-lg font-mono font-bold text-xs">
              {p.medtransfer_id || ''}
            </span>
            <Badge status={p.status_identite || 'A_CONFIRMER'}>
              {p.status_identite === 'A_CONFIRMER' ? 'Identité à confirmer' : 'Identité confirmée'}
            </Badge>

            {/* Suivi / Prise en charge status badge */}
            {activeCare?.has_active_care ? (
              activeCare.prise_en_charge?.medecin_responsable_id === user?.id ? (
                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Suivi actif par vous
                </span>
              ) : (
                <span
                  className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm"
                  title={`Prise en charge par le Dr ${activeCare.prise_en_charge?.medecin_nom || ''} (${activeCare.prise_en_charge?.etablissement_nom || ''})`}
                >
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  Prise en charge par le Dr {activeCare.prise_en_charge?.medecin_nom || 'Confrère'} ({activeCare.prise_en_charge?.etablissement_nom || 'Établissement'})
                </span>
              )
            ) : (
              <span className="px-2.5 py-1 bg-sky-50 text-sky-700 border border-sky-200 rounded-lg font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-500" />
                Patient disponible
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-slate-600">
            <span><strong>Âge :</strong> {p.date_naissance ? `${calculateAge(p.date_naissance)} (${formatDate(p.date_naissance)})` : '—'}</span>
            <span><strong>Sexe :</strong> {p.sexe === 'M' ? 'Masculin' : p.sexe === 'F' ? 'Féminin' : 'Indéterminé'}</span>
            <span><strong>Groupe :</strong> <strong className="text-rose-700 font-bold">{p.groupe_sanguin || '—'}</strong></span>
            {p.contact_urgence && (
              <span><strong>Contact Urgence :</strong> {p.contact_urgence}</span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {canInitiateCareFromHeader && (
            <button
              type="button"
              disabled={initiatingCare}
              onClick={handleInitiateOrdinaryCare}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
              title="Prendre en charge ce patient"
            >
              <PlusCircle className="w-4 h-4" />
              {initiatingCare ? 'Prise en charge...' : 'Prendre en charge'}
            </button>
          )}

          {canWriteClinical && (
            <button
              onClick={() => setIsEmergencyModalOpen(true)}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#DC2626] hover:bg-rose-700 rounded-xl shadow-sm transition-all"
              title="Enregistrer un acte d'urgence sans formalité bloquante"
            >
              <ShieldAlert className="w-4 h-4" />
              Intervention d'Urgence
            </button>
          )}

          <button
            onClick={() => {
              setIsAIModalOpen(true);
              setAiMotif(dossier?.consultations?.[0]?.motif || "Bilan de santé et synthèse générale");
            }}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#123B5D] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-all"
          >
            <Sparkles className="w-4 h-4 text-[#1976D2]" />
            Assistant IA
          </button>

          {canCreateOrdinaryConsultation && (
            <Link
              to={`/doctor/consultations/new?patient_id=${id}`}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Nouvelle consultation
            </Link>
          )}

          {activeCare?.has_active_care && activeCare?.prise_en_charge?.medecin_responsable_id === user?.id && (
            <button
              type="button"
              onClick={() => {
                setCloseCareMotif("Fin de traitement / Patient guéri");
                setCloseCareNotes("");
                setCloseCareError("");
                setIsCloseCareModalOpen(true);
              }}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all"
              title="Clôturer votre prise en charge médicale"
            >
              <CheckSquare className="w-4 h-4" />
              Clôturer la prise en charge
            </button>
          )}
        </div>
      </div>

      {/* 2. ACTIVE CARE ALERT BANNER IF FOLLOWED ELSEWHERE */}
      {activeCare?.is_followed_elsewhere && (
        <AlertBanner
          type="warning"
          title="Prise en charge active dans un autre établissement"
          message={activeCare.warning_message}
          action={
            <Link
              to={`/doctor/transfers?patient_id=${id}`}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap"
            >
              Initier un transfert
            </Link>
          }
        />
      )}

      {/* 3. CLINICAL CONTEXT GRID : ALLERGIES, ANTECEDENTS, TREATMENTS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Allergies Card */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              Allergies ({dossier.allergies?.length || 0})
            </h3>
            {canWriteClinical && (
              <button
                onClick={() => setIsAllergieModalOpen(true)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                title="Ajouter une allergie"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="space-y-2">
            {!dossier.allergies || dossier.allergies.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Aucune allergie documentée</p>
            ) : (
              dossier.allergies.map(a => (
                <div key={a.id} className="p-2.5 rounded-xl bg-rose-50 border border-rose-200/80 text-xs">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-bold text-rose-900">{a.substance}</span>
                    <Badge status={a.severite}>{a.severite_display}</Badge>
                  </div>
                  {a.reaction && <p className="text-[11px] text-rose-800 leading-tight">{a.reaction}</p>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Antécédents Card */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#123B5D] flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#1976D2]" />
              Antécédents ({dossier.antecedents?.length || 0})
            </h3>
            {canWriteClinical && (
              <button
                onClick={() => setIsAntecedentModalOpen(true)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
                title="Ajouter un antécédent"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {!dossier.antecedents || dossier.antecedents.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Aucun antécédent documenté</p>
            ) : (
              dossier.antecedents.map(ant => (
                <div key={ant.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-semibold text-slate-800">{ant.description}</span>
                    <span className="text-[10px] text-slate-500 font-bold uppercase">{ant.type_display}</span>
                  </div>
                  {ant.date_diagnostic && <span className="text-[10px] text-slate-400">Année : {ant.date_diagnostic}</span>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Traitements Actuels Card */}
        <div className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
              <Pill className="w-4 h-4 text-emerald-600" />
              Traitements en Cours ({dossier.traitements?.length || 0})
            </h3>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {!dossier.traitements || dossier.traitements.length === 0 ? (
              <p className="text-xs text-slate-400 italic">Aucun traitement régulier documenté</p>
            ) : (
              dossier.traitements.map(t => (
                <div key={t.id} className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs">
                  <span className="font-bold text-emerald-950 block">{t.medicament}</span>
                  <span className="text-[11px] text-emerald-800 block">{t.posologie}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. CHRONOLOGICAL MEDICAL TIMELINE */}
      <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-[#123B5D]">
              Historique Chronologique Médical
            </h3>
            <p className="text-xs text-[#64748B]">
              Continuité cumulative des consultations partagées entre tous les établissements de santé.
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 bg-slate-100 rounded-lg text-slate-700">
            {dossier.consultations?.length || 0} actes médicaux
          </span>
        </div>

        {!dossier.consultations || dossier.consultations.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Aucune consultation enregistrée pour ce patient.
          </div>
        ) : (
          <div className="relative pl-6 space-y-8 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[#1976D2]/30">
            {dossier.consultations.map((c) => (
              <div key={c.id} className="relative">
                {/* Timeline Dot */}
                <div className={`absolute -left-[27px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                  c.is_emergency ? 'bg-rose-600' : 'bg-[#1976D2]'
                }`} />

                {/* Consultation Card */}
                <div className="p-5 rounded-2xl bg-slate-50/60 border border-slate-200/80 hover:bg-slate-50 transition-all text-xs space-y-3">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-200/60">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-[#123B5D] text-sm">
                          {c.motif}
                        </span>
                        {c.is_emergency && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
                            Urgence
                          </span>
                        )}
                        {c.is_amended && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                            Rectifié
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {c.medecin_nom} • <strong>{c.etablissement_nom} ({c.etablissement_code})</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                        {formatDateTime(c.date_consultation)}
                      </span>
                      {canWriteClinical && (!user || c.medecin === user.id) && (
                        <button
                          onClick={() => handleOpenAmend(c)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-[#1976D2] hover:bg-white rounded-lg border border-transparent hover:border-slate-200 inline-flex items-center gap-1 transition-all"
                          title="Rectifier avec traçabilité médicolégale"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Rectifier
                        </button>
                      )}
                      {c.nombre_revisions > 0 && (
                        <button
                          onClick={() => handleOpenRevisions(c)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-[#1976D2] hover:underline inline-flex items-center gap-1"
                        >
                          <History className="w-3.5 h-3.5" />
                          Historique révisions ({c.nombre_revisions})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Constantes vitales if available */}
                  {c.constantes && Object.keys(c.constantes).length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {Object.entries(c.constantes).map(([k, v]) => (
                        <span key={k} className="px-2 py-1 rounded-md bg-white border border-slate-200 font-mono text-[10px] text-slate-700">
                          <strong>{k.toUpperCase()} :</strong> {v}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Clinical observations */}
                  <div className="space-y-1">
                    <span className="font-semibold text-slate-700 uppercase text-[10px] tracking-wider block">Examen & Observations :</span>
                    <p className="text-slate-800 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                      {c.observations_cliniques}
                    </p>
                  </div>

                  {/* Diagnostic & Prescription Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {c.diagnostic && (
                      <div className="p-3 rounded-xl bg-sky-50/60 border border-sky-100">
                        <span className="font-bold text-[#123B5D] uppercase text-[10px] tracking-wider block mb-0.5">Diagnostic :</span>
                        <p className="font-medium text-slate-900">{c.diagnostic}</p>
                      </div>
                    )}
                    {c.prescription && (
                      <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                        <span className="font-bold text-emerald-900 uppercase text-[10px] tracking-wider block mb-0.5">Prescription :</span>
                        <p className="font-medium text-slate-900">{c.prescription}</p>
                      </div>
                    )}
                  </div>

                  {/* Conclusions */}
                  {c.conclusions_recommandations && (
                    <p className="text-[11px] text-slate-600 italic pt-1">
                      <strong>Recommandations :</strong> {c.conclusions_recommandations}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1 : INTERVENTION D'URGENCE (ACCÈS DÉROGATOIRE SANS CLÔTURE) */}
      <Modal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        title="Intervention Médicale d'Urgence Dérogatoire"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleEmergencySubmit} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
            <span className="font-bold block mb-1">Règles médicolégal de l'accès d'urgence :</span>
            <p className="text-[11px] leading-relaxed">
              La prise en charge active d'origine ne sera pas clôturée, aucun transfert automatique n'aura lieu.
              L'acte sera immédiatement consigné au dossier unique et l'équipe de référence sera notifiée.
            </p>
          </div>

          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Motif de l'admission en urgence *
            </label>
            <input
              type="text"
              required
              value={emergencyData.motif_urgence}
              onChange={(e) => setEmergencyData({ ...emergencyData, motif_urgence: e.target.value })}
              placeholder="ex: Syndrome coronarien aigu, polytraumatisme..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Justification obligatoire de l'accès dérogatoire *
            </label>
            <textarea
              required
              rows={2}
              value={emergencyData.justification_acces_derogatoire}
              onChange={(e) => setEmergencyData({ ...emergencyData, justification_acces_derogatoire: e.target.value })}
              placeholder="ex: Patient en détresse vitale admis hors de sa région habituelle de suivi..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Tension (TA)</label>
              <input
                type="text"
                placeholder="140/90"
                value={emergencyData.constantes_ta}
                onChange={(e) => setEmergencyData({ ...emergencyData, constantes_ta: e.target.value })}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Pouls (FC)</label>
              <input
                type="text"
                placeholder="88 bpm"
                value={emergencyData.constantes_fc}
                onChange={(e) => setEmergencyData({ ...emergencyData, constantes_fc: e.target.value })}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Température</label>
              <input
                type="text"
                placeholder="37.2 °C"
                value={emergencyData.constantes_temp}
                onChange={(e) => setEmergencyData({ ...emergencyData, constantes_temp: e.target.value })}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Sat. O2</label>
              <input
                type="text"
                placeholder="98 %"
                value={emergencyData.constantes_sat}
                onChange={(e) => setEmergencyData({ ...emergencyData, constantes_sat: e.target.value })}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Observations cliniques d'urgence *
            </label>
            <textarea
              required
              rows={3}
              value={emergencyData.observations_cliniques}
              onChange={(e) => setEmergencyData({ ...emergencyData, observations_cliniques: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Diagnostic posé
              </label>
              <input
                type="text"
                value={emergencyData.diagnostic}
                onChange={(e) => setEmergencyData({ ...emergencyData, diagnostic: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Prescription d'urgence
              </label>
              <input
                type="text"
                value={emergencyData.prescription}
                onChange={(e) => setEmergencyData({ ...emergencyData, prescription: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsEmergencyModalOpen(false)}
              className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={emergencySubmitting}
              className="px-5 py-2 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm disabled:opacity-50"
            >
              {emergencySubmitting ? 'Enregistrement...' : 'Valider l\'intervention d\'urgence'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2 : ASSISTANT IA & VALIDATION DE SYNTHÈSE */}
      <Modal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        title="Assistant de Synthèse Médicale IA"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          {/* Mandatory Legal Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              <strong>Avertissement médicolégal :</strong> Cette synthèse a été générée par une intelligence artificielle.
              Elle constitue une aide à la lecture et <u>doit être vérifiée et validée</u> par un professionnel de santé.
            </p>
          </div>

          {aiActionMessage && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {aiActionMessage}
            </div>
          )}

          {/* Prompt Form */}
          <form onSubmit={handleGenerateAI} className="space-y-2">
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider">
              Motif de la consultation actuelle à analyser *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                value={aiMotif}
                onChange={(e) => setAiMotif(e.target.value)}
                placeholder="ex: Céphalées fébriles et bilan d'équilibre"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
              <button
                type="submit"
                disabled={aiGenerating}
                className="px-4 py-2 font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-lg shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {aiGenerating ? 'Analyse...' : 'Générer'}
              </button>
            </div>
          </form>

          {/* AI Result Review Box */}
          {aiSummary && (
            <div className="space-y-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-slate-500">
                  Modèle : <strong>{aiSummary.modele_utilise}</strong>
                  {aiSummary.is_mocked && ' (Synthèse locale assistée)'}
                </span>
                <Badge status={aiSummary.statut}>{aiSummary.statut_display}</Badge>
              </div>

              {/* Structured Sections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="font-bold text-[#123B5D] block mb-0.5">1. Résumé Antécédents :</span>
                  <p className="text-slate-700 text-[11px]">{aiSummary.resume_antecedents}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-rose-50/50 border border-rose-100">
                  <span className="font-bold text-rose-900 block mb-0.5">2. Allergies Connues :</span>
                  <p className="text-rose-800 text-[11px]">{aiSummary.allergies_connues}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100">
                  <span className="font-bold text-emerald-900 block mb-0.5">3. Traitements Connus :</span>
                  <p className="text-emerald-800 text-[11px]">{aiSummary.traitements_connus}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-100">
                  <span className="font-bold text-amber-900 block mb-0.5">4. Vigilances à Vérifier :</span>
                  <p className="text-amber-800 text-[11px]">{aiSummary.elements_a_verifier}</p>
                </div>
              </div>

              {/* Editable Text Area for Doctor */}
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Synthèse Globale (Modifiable par le médecin avant validation) :
                </label>
                <textarea
                  rows={4}
                  value={aiEditedText}
                  onChange={(e) => setAiEditedText(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none leading-relaxed text-xs focus:border-[#1976D2]"
                />
              </div>

              {/* Actions Validation / Rejection */}
              {aiSummary.statut === 'EN_ATTENTE' && (
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={handleRejectAI}
                    className="px-4 py-2 bg-slate-100 hover:bg-rose-50 text-rose-700 font-semibold rounded-lg transition-colors"
                  >
                    Rejeter la proposition
                  </button>
                  <button
                    onClick={handleValidateAI}
                    className="px-5 py-2 bg-[#16A34A] hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Valider et intégrer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* MODAL 3 : AJOUT ANTÉCÉDENT */}
      <Modal
        isOpen={isAntecedentModalOpen}
        onClose={() => setIsAntecedentModalOpen(false)}
        title="Ajouter un Antécédent Médical"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddAntecedent} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Type d'antécédent</label>
            <select
              value={antecedentForm.type_antecedent}
              onChange={(e) => setAntecedentForm({ ...antecedentForm, type_antecedent: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            >
              <option value="MEDICAL">Médical</option>
              <option value="CHIRURGICAL">Chirurgical</option>
              <option value="FAMILIAL">Familial</option>
              <option value="GYNECO_OBSTETRIQUE">Gynéco-obstétrique</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Description *</label>
            <input
              type="text"
              required
              value={antecedentForm.description}
              onChange={(e) => setAntecedentForm({ ...antecedentForm, description: e.target.value })}
              placeholder="ex: Hypertension artérielle Stade 2"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Année / Date</label>
            <input
              type="text"
              value={antecedentForm.date_diagnostic}
              onChange={(e) => setAntecedentForm({ ...antecedentForm, date_diagnostic: e.target.value })}
              placeholder="ex: 2021"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setIsAntecedentModalOpen(false)} className="px-3 py-1.5 text-slate-600">Annuler</button>
            <button type="submit" className="px-4 py-1.5 bg-[#1976D2] text-white font-semibold rounded-lg">Enregistrer</button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4 : AJOUT ALLERGIE */}
      <Modal
        isOpen={isAllergieModalOpen}
        onClose={() => setIsAllergieModalOpen(false)}
        title="Enregistrer une Allergie"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleAddAllergie} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Substance allergène *</label>
            <input
              type="text"
              required
              value={allergieForm.substance}
              onChange={(e) => setAllergieForm({ ...allergieForm, substance: e.target.value })}
              placeholder="ex: Pénicilline, Produits iodés, Arachides"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Sévérité *</label>
            <select
              value={allergieForm.severite}
              onChange={(e) => setAllergieForm({ ...allergieForm, severite: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            >
              <option value="CRITIQUE">Critique (Risque de choc anaphylactique)</option>
              <option value="SEVERE">Sévère (Oedème de Quincke, urticaire géant)</option>
              <option value="MODEREE">Modérée (Prurit, éruption cutanée)</option>
              <option value="FAIBLE">Faible</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Manifestations cliniques</label>
            <input
              type="text"
              value={allergieForm.reaction}
              onChange={(e) => setAllergieForm({ ...allergieForm, reaction: e.target.value })}
              placeholder="ex: Oedème de Quincke documenté"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button type="button" onClick={() => setIsAllergieModalOpen(false)} className="px-3 py-1.5 text-slate-600">Annuler</button>
            <button type="submit" className="px-4 py-1.5 bg-[#DC2626] text-white font-semibold rounded-lg">Enregistrer</button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5 : RECTIFICATION MÉDICOLÉGALE D'UNE CONSULTATION */}
      {selectedConsultation && isAmendModalOpen && (
        <Modal
          isOpen={isAmendModalOpen}
          onClose={() => setIsAmendModalOpen(false)}
          title={`Rectification Médicolégale — Acte du ${formatDateTime(selectedConsultation.date_consultation)}`}
          maxWidth="max-w-xl"
        >
          <form onSubmit={handleAmendSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
              <strong>Principe médicolégal d'intégrité :</strong> L'ancienne version de la consultation ne sera pas effacée.
              Toute modification est consignée dans un registre de révision audité avec votre nom et le motif saisi.
            </div>

            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Motif obligatoire de la rectification *
              </label>
              <textarea
                required
                rows={2}
                value={amendForm.motif_modification}
                onChange={(e) => setAmendForm({ ...amendForm, motif_modification: e.target.value })}
                placeholder="ex: Rectification du diagnostic suite aux résultats reçus du laboratoire de biologie..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Examen & Observations cliniques
              </label>
              <textarea
                rows={3}
                value={amendForm.observations_cliniques}
                onChange={(e) => setAmendForm({ ...amendForm, observations_cliniques: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Diagnostic rectifié
                </label>
                <input
                  type="text"
                  value={amendForm.diagnostic}
                  onChange={(e) => setAmendForm({ ...amendForm, diagnostic: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Prescription rectifiée
                </label>
                <input
                  type="text"
                  value={amendForm.prescription}
                  onChange={(e) => setAmendForm({ ...amendForm, prescription: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAmendModalOpen(false)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={amendSubmitting}
                className="px-5 py-2 font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-lg shadow-sm disabled:opacity-50"
              >
                {amendSubmitting ? 'Enregistrement...' : 'Valider la rectification'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* MODAL 6 : HISTORIQUE DES RÉVISIONS D'UNE CONSULTATION */}
      {selectedConsultation && isRevisionModalOpen && (
        <Modal
          isOpen={isRevisionModalOpen}
          onClose={() => setIsRevisionModalOpen(false)}
          title={`Historique des Révisions — Consultation #${selectedConsultation.id}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            {loadingRevisions ? (
              <LoadingSkeleton lines={4} />
            ) : !consultationDetails?.revisions || consultationDetails.revisions.length === 0 ? (
              <p className="text-center text-slate-400 py-6">Aucune révision enregistrée.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {consultationDetails.revisions.map((rev, i) => (
                  <div key={rev.id || i} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                      <span className="font-bold text-[#123B5D]">
                        Révision par {rev.auteur_nom}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {formatDateTime(rev.date_modification)}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-amber-50/60 border border-amber-200 text-amber-900 text-[11px]">
                      <strong>Motif de modification :</strong> {rev.motif_modification}
                    </div>

                    <div className="space-y-1 pt-1">
                      <span className="font-semibold text-slate-700 block text-[10px] uppercase">Anciennes valeurs archivées :</span>
                      <pre className="p-2.5 rounded-lg bg-white border border-slate-200 font-mono text-[10px] text-slate-600 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(rev.anciennes_valeurs, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsRevisionModalOpen(false)}
                className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 7 : CLÔTURE DE LA PRISE EN CHARGE */}
      <Modal
        isOpen={isCloseCareModalOpen}
        onClose={() => !closeCareLoading && setIsCloseCareModalOpen(false)}
        title="Clôture de la Prise en Charge Médicale"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleConfirmCloseCare} className="space-y-4">
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              La clôture met fin à votre suivi médical de référence pour ce patient. Tout l'historique des consultations est conservé. Le patient redeviendra disponible pour une nouvelle prise en charge ordinaire.
            </span>
          </div>

          {closeCareError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{closeCareError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#123B5D] block">
              Motif obligatoire de clôture <span className="text-rose-600">*</span>
            </label>
            <select
              value={closeCareMotif}
              onChange={(e) => setCloseCareMotif(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#1976D2]"
            >
              <option value="Fin de traitement / Patient guéri">Fin de traitement / Patient guéri</option>
              <option value="Transfert vers un autre établissement">Transfert vers un autre établissement</option>
              <option value="Orientation vers un confrère ou spécialiste">Orientation vers un confrère ou spécialiste</option>
              <option value="Sortie d'hospitalisation autorisée">Sortie d'hospitalisation autorisée</option>
              <option value="Autre motif médical">Autre motif médical</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#123B5D] block">
              Résumé clinique final / Notes de sortie (optionnel)
            </label>
            <textarea
              value={closeCareNotes}
              onChange={(e) => setCloseCareNotes(e.target.value)}
              rows={3}
              placeholder="Évolution finale, recommandations, ordonnance..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1976D2]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={closeCareLoading}
              onClick={() => setIsCloseCareModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={closeCareLoading}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
            >
              <CheckSquare className="w-4 h-4" />
              {closeCareLoading ? 'Clôture en cours...' : 'Confirmer la clôture'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

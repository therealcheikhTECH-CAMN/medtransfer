import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { patientService } from '../../services/patientService';
import { formatDate, calculateAge } from '../../utils/formatters';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import {
  ArrowLeft,
  Printer,
  Edit,
  ShieldCheck,
  AlertTriangle,
  User,
  Phone,
  MapPin,
  Building2,
  Calendar,
  Clock,
  Check,
  AlertCircle,
  FileText,
  HeartPulse,
} from 'lucide-react';

export const PatientIdentificationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Edit Administrative Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editFormData, setEditFormData] = useState({
    nom: '',
    prenom: '',
    date_naissance: '',
    sexe: 'M',
    telephone: '',
    adresse: '',
    ville: '',
    personne_contact_nom: '',
    personne_contact_telephone: '',
    numero_identification_nationale: '',
    groupe_sanguin: '',
    motif: '',
  });

  const fetchPatient = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError('');
      const data = await patientService.getById(id);
      setPatient(data);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
        "Impossible de charger la fiche administrative de ce patient. Vérifiez que l'identifiant est valide."
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPatient();
  }, [fetchPatient]);

  const handlePrint = () => {
    window.print();
  };

  const openEditModal = () => {
    if (!patient) return;
    setEditFormData({
      nom: patient.nom || '',
      prenom: patient.prenom || '',
      date_naissance: patient.date_naissance || '',
      sexe: patient.sexe || 'M',
      telephone: patient.telephone || '',
      adresse: patient.adresse || '',
      ville: patient.ville || '',
      personne_contact_nom: patient.personne_contact_nom || '',
      personne_contact_telephone: patient.personne_contact_telephone || '',
      numero_identification_nationale: patient.numero_identification_nationale || '',
      groupe_sanguin: patient.groupe_sanguin || '',
      motif: '',
    });
    setEditError('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editFormData.motif?.trim()) {
      setEditError("Le motif de la modification administrative est obligatoire.");
      return;
    }

    try {
      setSubmittingEdit(true);
      setEditError('');
      await patientService.correctAdministrative(patient.id, editFormData);
      setIsEditModalOpen(false);
      setSuccessMessage("Les informations administratives ont été modifiées avec succès.");
      await fetchPatient();
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error(err);
      setEditError(
        err.response?.data?.detail ||
        err.response?.data?.motif ||
        "Une erreur est survenue lors de l'enregistrement des modifications."
      );
    } finally {
      setSubmittingEdit(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto py-4">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-2xl border border-red-200 shadow-sm text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-slate-800 mb-2">Fiche administrative indisponible</h2>
        <p className="text-sm text-slate-600 mb-6">{error || "Patient introuvable."}</p>
        <button
          onClick={() => navigate('/agent/search')}
          className="px-5 py-2.5 bg-[#1976D2] hover:bg-[#1565C0] text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2 shadow-sm transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à la recherche
        </button>
      </div>
    );
  }

  const isProvisional = patient.status_identite === 'A_CONFIRMER' || patient.is_provisional;
  const age = calculateAge(patient.date_naissance);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Styles d'impression dédiés */}
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          aside, nav, header, button, .no-print {
            display: none !important;
          }
          .printable-card {
            border: 1px solid #ccc !important;
            box-shadow: none !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* Barre d'action supérieure (masquée à l'impression) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/agent/search')}
            className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 shadow-sm transition-colors"
            title="Retour à la liste des patients"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1976D2]">
              Fiche Administrative Patient (FIAP)
            </span>
            <h1 className="text-xl font-black text-[#123B5D]">
              {patient.nom} {patient.prenom}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={openEditModal}
            className="px-4 py-2.5 bg-white hover:bg-slate-50 text-[#123B5D] text-xs font-semibold rounded-xl border border-slate-200 shadow-sm transition-colors inline-flex items-center gap-2"
          >
            <Edit className="w-4 h-4 text-[#1976D2]" />
            Modifier la fiche
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2.5 bg-[#1976D2] hover:bg-[#1565C0] text-white text-xs font-semibold rounded-xl shadow-sm transition-colors inline-flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimer la fiche
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2.5 shadow-sm no-print">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {/* En-tête officiel imprimable de la FIAP */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm printable-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#123B5D] to-[#1976D2] flex items-center justify-center text-white shadow-md font-black text-xl">
              {patient.nom?.[0] || 'P'}{patient.prenom?.[0] || ''}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-2xl font-black text-[#123B5D]">
                  {patient.nom} {patient.prenom}
                </h2>
                {isProvisional ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    Identité provisoire
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Identité confirmée
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Dossier administratif enregistré sur la plateforme sécurisée MEDTRANSFER
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right bg-sky-50/70 p-3.5 rounded-xl border border-sky-100 w-full sm:w-auto">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
              Identifiant Permanent MEDTRANSFER
            </span>
            <span className="text-lg font-mono font-black text-[#1976D2] tracking-wide block">
              {patient.medtransfer_id}
            </span>
          </div>
        </div>

        {isProvisional && patient.motif_identite_provisoire && (
          <div className="mt-4 p-3.5 bg-amber-50/70 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Motif du statut provisoire :</span>
              <p className="mt-0.5 text-amber-800">{patient.motif_identite_provisoire}</p>
            </div>
          </div>
        )}
      </div>

      {/* Grille de sections administratives (3 Cartes détaillées) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Carte 1 : Identité Civile */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 printable-card">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 bg-blue-50 text-[#1976D2] rounded-xl">
              <User className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#123B5D] uppercase tracking-wide">
              1. Identité Civile
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px] font-semibold">Nom de famille</span>
              <span className="font-bold text-slate-800 text-sm">{patient.nom || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px] font-semibold">Prénom</span>
              <span className="font-bold text-slate-800 text-sm">{patient.prenom || '—'}</span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold">Date de naissance</span>
              <span className="font-semibold text-slate-800">
                {patient.date_naissance ? formatDate(patient.date_naissance) : 'Non renseignée'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px] font-semibold">Âge calculé</span>
              <span className="font-semibold text-slate-800">
                {age !== null ? `${age} ans` : 'Non calculable'}
              </span>
            </div>

            <div>
              <span className="text-slate-400 block text-[11px] font-semibold">Sexe</span>
              <span className="font-semibold text-slate-800">
                {patient.sexe === 'M' ? 'Masculin' : patient.sexe === 'F' ? 'Féminin' : 'Autre / Non spécifié'}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px] font-semibold">Groupe sanguin</span>
              <span className="font-bold text-slate-800">
                {patient.groupe_sanguin && patient.groupe_sanguin !== 'INCONNU' ? (
                  <span className="inline-flex items-center gap-1 text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    <HeartPulse className="w-3 h-3" />
                    {patient.groupe_sanguin}
                  </span>
                ) : (
                  <span className="text-slate-400">Non renseigné</span>
                )}
              </span>
            </div>

            <div className="col-span-2 pt-1 border-t border-slate-50">
              <span className="text-slate-400 block text-[11px] font-semibold">
                Numéro d'Identification Nationale (NIN / CNI)
              </span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {patient.numero_identification_nationale || (
                  <span className="text-slate-400 italic font-normal">Non renseigné</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Carte 2 : Coordonnées & Contact d'urgence */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 printable-card">
          <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Phone className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#123B5D] uppercase tracking-wide">
              2. Coordonnées & Urgence
            </h3>
          </div>

          <div className="space-y-3.5 text-xs">
            <div>
              <span className="text-slate-400 block text-[11px] font-semibold">Téléphone principal</span>
              <span className="font-bold text-slate-800 font-mono text-sm">
                {patient.telephone || 'Non renseigné'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block text-[11px] font-semibold">Ville de résidence</span>
                <span className="font-semibold text-slate-800">{patient.ville || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px] font-semibold">Adresse postale / Quartier</span>
                <span className="font-semibold text-slate-800">{patient.adresse || '—'}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block mb-2">
                Contact en cas d'urgence
              </span>
              <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200/60">
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">Nom du contact</span>
                  <span className="font-bold text-slate-800">
                    {patient.personne_contact_nom || 'Non spécifié'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-semibold">Téléphone d'urgence</span>
                  <span className="font-bold text-slate-800 font-mono">
                    {patient.personne_contact_telephone || 'Non spécifié'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Carte 3 : Enregistrement, Établissement & Traçabilité */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 printable-card">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <Building2 className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-[#123B5D] uppercase tracking-wide">
            3. Enregistrement & Traçabilité Institutionnelle
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1">
              Établissement d'enregistrement
            </span>
            <span className="font-bold text-[#123B5D] text-sm block">
              {patient.etablissement_creation_details?.nom || patient.etablissement_creation_nom || 'Établissement non précisé'}
            </span>
            <span className="text-slate-500 font-mono text-[11px]">
              Code : {patient.etablissement_creation_details?.code || patient.etablissement_creation_code || '—'}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1">
              Enregistré par (Agent d'accueil)
            </span>
            <span className="font-bold text-slate-800 text-sm block">
              {patient.cree_par_nom || 'Agent système'}
            </span>
            <span className="text-slate-400 text-[11px]">Rôle : Accueil & Admissions</span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70">
            <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider mb-1">
              Date & Heure d'enregistrement
            </span>
            <span className="font-bold text-slate-800 text-sm block">
              {patient.created_at ? formatDate(patient.created_at) : '—'}
            </span>
            <span className="text-slate-400 text-[11px]">
              Dernière MAJ : {patient.updated_at ? formatDate(patient.updated_at) : '—'}
            </span>
          </div>
        </div>

        {/* Note de confidentialité & Règle de séparation des données */}
        <div className="mt-3 p-3 bg-slate-100/70 rounded-xl border border-slate-200 text-slate-500 text-[11px] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#1976D2] shrink-0" />
          <span>
            <strong>Règle de confidentialité MEDTRANSFER :</strong> Ce document est exclusivement une fiche administrative d'identification. Conformément au secret médical, les données cliniques, antécédents, observations et prescriptions ne sont pas accessibles dans cet espace.
          </span>
        </div>
      </div>

      {/* Modal d'édition des informations administratives */}
      {isEditModalOpen && (
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => !submittingEdit && setIsEditModalOpen(false)}
          title="Modifier les informations administratives du patient"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4">
            {editError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nom *</label>
                <input
                  type="text"
                  value={editFormData.nom}
                  onChange={(e) => setEditFormData({ ...editFormData, nom: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1976D2]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Prénom *</label>
                <input
                  type="text"
                  value={editFormData.prenom}
                  onChange={(e) => setEditFormData({ ...editFormData, prenom: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1976D2]"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date de naissance *</label>
                <input
                  type="date"
                  value={editFormData.date_naissance}
                  onChange={(e) => setEditFormData({ ...editFormData, date_naissance: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1976D2]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Sexe *</label>
                <select
                  value={editFormData.sexe}
                  onChange={(e) => setEditFormData({ ...editFormData, sexe: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1976D2]"
                  required
                >
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">NIN / CNI</label>
                <input
                  type="text"
                  value={editFormData.numero_identification_nationale}
                  onChange={(e) => setEditFormData({ ...editFormData, numero_identification_nationale: e.target.value })}
                  placeholder="Ex: 1234567890123"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1976D2]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Groupe sanguin</label>
                <select
                  value={editFormData.groupe_sanguin}
                  onChange={(e) => setEditFormData({ ...editFormData, groupe_sanguin: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1976D2]"
                >
                  <option value="">Sélectionner</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="INCONNU">Inconnu</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone *</label>
                <input
                  type="text"
                  value={editFormData.telephone}
                  onChange={(e) => setEditFormData({ ...editFormData, telephone: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1976D2]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Ville</label>
                <input
                  type="text"
                  value={editFormData.ville}
                  onChange={(e) => setEditFormData({ ...editFormData, ville: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1976D2]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Adresse complète</label>
              <input
                type="text"
                value={editFormData.adresse}
                onChange={(e) => setEditFormData({ ...editFormData, adresse: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1976D2]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nom contact urgence</label>
                <input
                  type="text"
                  value={editFormData.personne_contact_nom}
                  onChange={(e) => setEditFormData({ ...editFormData, personne_contact_nom: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1976D2]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone contact urgence</label>
                <input
                  type="text"
                  value={editFormData.personne_contact_telephone}
                  onChange={(e) => setEditFormData({ ...editFormData, personne_contact_telephone: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1976D2]"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motif obligatoire de la modification *
              </label>
              <textarea
                value={editFormData.motif}
                onChange={(e) => setEditFormData({ ...editFormData, motif: e.target.value })}
                placeholder="Ex: Rectification de l'orthographe du nom ou changement de numéro de téléphone..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-[#1976D2] resize-none h-16"
                required
              />
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                disabled={submittingEdit}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submittingEdit}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
              >
                {submittingEdit ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Enregistrer les modifications
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

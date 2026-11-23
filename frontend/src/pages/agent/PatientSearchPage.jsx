import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { patientService } from '../../services/patientService';
import { GlobalSearch } from '../../components/GlobalSearch';
import { SearchablePatientSelect } from '../../components/SearchablePatientSelect';
import { normalizeSearchText, matchesSearchText } from '../../utils/searchUtils';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { formatDate, calculateAge } from '../../utils/formatters';
import {
  Eye,
  GitMerge,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  AlertCircle,
  Edit,
  History,
  Lock,
  Search,
} from 'lucide-react';

/**
 * Filtre localement et instantanément une liste de patients (utilitaire réexporté pour rétrocompatibilité).
 */
export const filterPatientsInstant = (patients = [], rawQuery = '', statusFilter = '') => {
  return patients.filter((p) => {
    if (statusFilter && p.status_identite !== statusFilter) {
      return false;
    }
    if (!rawQuery) return true;
    return matchesSearchText(p, rawQuery, [
      'nom',
      'prenom',
      'medtransfer_id',
      'numero_identification_nationale',
      'telephone',
      'ville',
    ]);
  });
};

export const PatientSearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') || '';

  const [query, setQuery] = useState(urlQuery);
  const [statusFilter, setStatusFilter] = useState('');
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);

  // Pagination backend DRF
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  // Reconciliation modal
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [reconcileMotif, setReconcileMotif] = useState('');
  const [reconciling, setReconciling] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Administrative Edit Modal
  const [editModalPatient, setEditModalPatient] = useState(null);
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
  const [submittingEdit, setSubmittingEdit] = useState(false);

  // Modification History Modal
  const [historyModalPatient, setHistoryModalPatient] = useState(null);
  const [modificationHistory, setModificationHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const abortControllerRef = useRef(null);

  const fetchPatients = useCallback(
    async (searchTerm = '', status = '', pageNum = 1) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        setLoading(true);
        const trimmed = (searchTerm || '').trim();
        const res = await patientService.search(
          {
            q: trimmed,
            status_identite: status,
            page: pageNum,
            signal: controller.signal,
          }
        );
        const list = Array.isArray(res) ? res : res.results || [];
        setPatients(list);
        setTotalCount(res.count ?? list.length);
        setHasNext(Boolean(res.next));
        setHasPrev(Boolean(res.previous));
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('Erreur chargement patients agent:', err);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Synchronisation dynamique : réagit immédiatement aux changements de l'URL (?q=...) et du filtre de statut
  useEffect(() => {
    setQuery(urlQuery);
    setPage(1);
    fetchPatients(urlQuery, statusFilter, 1);
  }, [urlQuery, statusFilter, fetchPatients]);

  const handleSearch = (newQuery) => {
    const trimmed = (newQuery || '').trim();
    setQuery(trimmed);
    setPage(1);
    setSearchParams(trimmed ? { q: trimmed } : {});
  };

  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handleClearSearch = () => {
    setQuery('');
    setPage(1);
    setSearchParams({});
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchPatients(query, statusFilter, newPage);
  };

  const handleReconcileSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatient || !targetId || !reconcileMotif) return;

    try {
      setReconciling(true);
      await patientService.reconcile(selectedPatient.id, targetId, reconcileMotif);
      setSuccessMessage('Rapprochement effectué avec succès ! La fiche provisoire a été régularisée.');
      setIsReconcileModalOpen(false);
      setSelectedPatient(null);
      setTargetId('');
      setReconcileMotif('');
      await fetchPatients(query, statusFilter, page);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors du rapprochement : Vérifiez que l'identifiant du patient cible existe.");
    } finally {
      setReconciling(false);
    }
  };

  const handleOpenEdit = (patient) => {
    setEditModalPatient(patient);
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
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editModalPatient || !editFormData.motif.trim()) {
      alert('Le motif de correction est obligatoire.');
      return;
    }

    try {
      setSubmittingEdit(true);
      await patientService.correctAdministrative(editModalPatient.id, {
        nom: editFormData.nom.trim(),
        prenom: editFormData.prenom.trim(),
        date_naissance: editFormData.date_naissance,
        sexe: editFormData.sexe,
        telephone: editFormData.telephone.trim(),
        adresse: editFormData.adresse.trim(),
        ville: editFormData.ville.trim(),
        personne_contact_nom: editFormData.personne_contact_nom.trim(),
        personne_contact_telephone: editFormData.personne_contact_telephone.trim(),
        numero_identification_nationale: editFormData.numero_identification_nationale.trim(),
        groupe_sanguin: editFormData.groupe_sanguin,
        motif: editFormData.motif.trim(),
      });
      setSuccessMessage('Fiche administrative corrigée avec succès. Historique des modifications mis à jour.');
      setEditModalPatient(null);
      await fetchPatients(query, statusFilter, page);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.motif || err.response?.data?.detail || 'Erreur lors de la mise à jour de la fiche.');
    } finally {
      setSubmittingEdit(false);
    }
  };

  const handleOpenHistory = async (patient) => {
    setHistoryModalPatient(patient);
    setLoadingHistory(true);
    setModificationHistory([]);
    try {
      const hist = await patientService.getModificationHistory(patient.id);
      setModificationHistory(Array.isArray(hist) ? hist : []);
    } catch (err) {
      console.error(err);
      alert("Impossible de charger l'historique des modifications.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / 20));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#123B5D]">Recherche Nationale des Patients</h2>
          <p className="text-xs text-[#64748B]">
            Recherche instantanée et complète sur l'ensemble de la base nationale pour vérifier l'identité et éviter tout doublon.
          </p>
        </div>
        <Link
          to="/agent/create-patient"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-sm transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Nouveau Patient
        </Link>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          {successMessage}
        </div>
      )}

      {urlQuery && (
        <div className="flex items-center justify-between p-3.5 bg-sky-50 border border-sky-200 text-[#123B5D] text-xs rounded-xl shadow-sm">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-[#1976D2] shrink-0" />
            <span>
              Filtre actif sur l'identifiant / recherche : <strong>« {urlQuery} »</strong> ({totalCount} résultat{totalCount > 1 ? 's' : ''})
            </span>
          </div>
          <button
            type="button"
            onClick={handleClearSearch}
            className="px-3 py-1.5 bg-white hover:bg-sky-100 text-[#1976D2] font-semibold rounded-lg border border-sky-200 shadow-sm transition-colors text-xs flex items-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Afficher tous les patients de l'établissement
          </button>
        </div>
      )}

      {/* Barre de Recherche Instantanée Commune & Filtre de statut */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm items-center">
        <div className="flex-1 w-full">
          <GlobalSearch
            value={query}
            onSearch={handleSearch}
            onClear={handleClearSearch}
            loading={loading}
            placeholder="Rechercher par nom, prénom, ID MEDTRANSFER, NIN ou téléphone..."
            debounceMs={300}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          aria-label="Filtrer par statut d'identité"
          className="w-full sm:w-64 px-3.5 py-2.5 text-xs text-[#123B5D] bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-[#1976D2] focus:bg-white transition-all shadow-sm"
        >
          <option value="">Tous les statuts d'identité</option>
          <option value="CONFIRMEE">Identités confirmées</option>
          <option value="A_CONFIRMER">Identités à confirmer (Provisoires)</option>
        </select>
      </div>

      {/* Results Table */}
      {loading ? (
        <LoadingSkeleton type="table" lines={5} />
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[#123B5D] font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Identifiant MedTransfer</th>
                <th className="py-3.5 px-4">Patient</th>
                <th className="py-3.5 px-4">Âge / Naissance</th>
                <th className="py-3.5 px-4">NIN / Pièce</th>
                <th className="py-3.5 px-4">Statut Identité</th>
                <th className="py-3.5 px-4">Établissement Enregistreur</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-sm text-[#123B5D] mb-1">Aucun patient trouvé</p>
                    <p className="text-xs text-slate-500">
                      Vérifiez l'orthographe ou créez un nouveau dossier si ce patient consulte pour la première fois.
                    </p>
                    {query && (
                      <button
                        type="button"
                        onClick={handleClearSearch}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1976D2] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        Effacer la recherche
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-[#1976D2]">
                      {p.medtransfer_id}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#123B5D] block">
                        {p.nom.toUpperCase()} {p.prenom}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {p.sexe === 'M' ? 'Masculin' : p.sexe === 'F' ? 'Féminin' : 'Non précisé'} • {p.ville || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-700 block">
                        {calculateAge(p.date_naissance)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {formatDate(p.date_naissance)}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {p.numero_identification_nationale || (
                        <span className="text-slate-400 italic">Non renseigné</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={p.status_identite}>{p.status_identite_display}</Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="font-medium text-[#123B5D] block">
                        {p.etablissement_creation?.nom || p.etablissement_creation_nom || '—'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {p.etablissement_creation?.code || p.etablissement_creation_code || ''}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSelectedPatient(p)}
                          className="p-1.5 text-slate-500 hover:text-[#1976D2] hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                          title="Fiche d'identification administrative"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-slate-200"
                          title="Corriger la fiche administrative"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(p)}
                          className="p-1.5 text-slate-500 hover:text-[#123B5D] hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                          title="Historique des modifications administratives"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        {p.is_provisional && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPatient(p);
                              setIsReconcileModalOpen(true);
                              setTargetId('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-semibold rounded-lg text-xs transition-colors"
                            title="Rapprocher cette identité d'urgence"
                          >
                            <GitMerge className="w-3 h-3" />
                            Rapprocher
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalCount > 20 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Total : <strong className="text-slate-700">{totalCount}</strong> patients (Page {page} sur {totalPages})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasPrev || page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Précédent
                </button>
                <button
                  type="button"
                  disabled={!hasNext || page >= totalPages}
                  onClick={() => handlePageChange(page + 1)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Suivant
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Consultation Administrative */}
      {selectedPatient && !isReconcileModalOpen && (
        <Modal
          isOpen={!!selectedPatient && !isReconcileModalOpen}
          onClose={() => setSelectedPatient(null)}
          title="Fiche d'Identification Administrative Patient"
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-sky-800 block">Identifiant MedTransfer Unique :</span>
                <span className="font-mono font-black text-sm text-[#123B5D]">{selectedPatient.medtransfer_id}</span>
              </div>
              <Badge status={selectedPatient.status_identite}>{selectedPatient.status_identite_display}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Nom & Prénom :</span>
                <span className="font-bold text-slate-800">{selectedPatient.nom} {selectedPatient.prenom}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Date de naissance :</span>
                <span className="font-bold text-slate-800">
                  {formatDate(selectedPatient.date_naissance)} ({calculateAge(selectedPatient.date_naissance)})
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Numéro CNI / NIN :</span>
                <span className="font-mono text-slate-800">{selectedPatient.numero_identification_nationale || 'Non renseigné'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Groupe Sanguin :</span>
                <span className="font-bold text-rose-700">{selectedPatient.groupe_sanguin}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Téléphone :</span>
                <span className="font-mono text-slate-800">{selectedPatient.telephone || 'Non renseigné'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ville :</span>
                <span className="text-slate-800">{selectedPatient.ville || '—'}</span>
              </div>
            </div>

            {selectedPatient.is_provisional && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                <span className="font-bold block mb-0.5">Motif d'identité provisoire :</span>
                <p className="text-[11px] leading-relaxed">
                  {selectedPatient.motif_identite_provisoire || "Admission en urgence sans pièce d'identité"}
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const p = selectedPatient;
                    setSelectedPatient(null);
                    handleOpenEdit(p);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-xs text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
                >
                  <Edit className="w-3.5 h-3.5" />
                  Corriger la fiche
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const p = selectedPatient;
                    setSelectedPatient(null);
                    handleOpenHistory(p);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-xs text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200"
                >
                  <History className="w-3.5 h-3.5" />
                  Historique
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatient(null)}
                className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Correction Administrative */}
      {editModalPatient && (
        <Modal
          isOpen={!!editModalPatient}
          onClose={() => setEditModalPatient(null)}
          title={`Correction Administrative • ${editModalPatient.nom} ${editModalPatient.prenom}`}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
            {/* Medtransfer ID Immutable Notice */}
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-700">
                  Identifiant national MedTransfer :
                </span>
                <span className="font-mono font-bold text-[#1976D2] text-sm">
                  {editModalPatient.medtransfer_id}
                </span>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Immuable & Permanent
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Nom de famille *
                </label>
                <input
                  type="text"
                  value={editFormData.nom}
                  onChange={(e) => setEditFormData({ ...editFormData, nom: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Prénom *
                </label>
                <input
                  type="text"
                  value={editFormData.prenom}
                  onChange={(e) => setEditFormData({ ...editFormData, prenom: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Date de naissance *
                </label>
                <input
                  type="date"
                  value={editFormData.date_naissance}
                  onChange={(e) => setEditFormData({ ...editFormData, date_naissance: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Sexe *
                </label>
                <select
                  value={editFormData.sexe}
                  onChange={(e) => setEditFormData({ ...editFormData, sexe: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                >
                  <option value="M">Masculin (M)</option>
                  <option value="F">Féminin (F)</option>
                  <option value="AUTRE">Autre</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Groupe Sanguin
                </label>
                <select
                  value={editFormData.groupe_sanguin}
                  onChange={(e) => setEditFormData({ ...editFormData, groupe_sanguin: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                >
                  <option value="">Non déterminé</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Numéro CNI / NIN
                </label>
                <input
                  type="text"
                  value={editFormData.numero_identification_nationale}
                  onChange={(e) => setEditFormData({ ...editFormData, numero_identification_nationale: e.target.value })}
                  placeholder="ex: 1234567890123"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={editFormData.telephone}
                  onChange={(e) => setEditFormData({ ...editFormData, telephone: e.target.value })}
                  placeholder="ex: +221 77 000 00 00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Adresse
                </label>
                <input
                  type="text"
                  value={editFormData.adresse}
                  onChange={(e) => setEditFormData({ ...editFormData, adresse: e.target.value })}
                  placeholder="Rue, quartier..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Ville
                </label>
                <input
                  type="text"
                  value={editFormData.ville}
                  onChange={(e) => setEditFormData({ ...editFormData, ville: e.target.value })}
                  placeholder="Dakar, Thiès..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Contact d'urgence (Nom)
                </label>
                <input
                  type="text"
                  value={editFormData.personne_contact_nom}
                  onChange={(e) => setEditFormData({ ...editFormData, personne_contact_nom: e.target.value })}
                  placeholder="Nom du proche"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Contact d'urgence (Tél)
                </label>
                <input
                  type="tel"
                  value={editFormData.personne_contact_telephone}
                  onChange={(e) => setEditFormData({ ...editFormData, personne_contact_telephone: e.target.value })}
                  placeholder="Numéro du proche"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
            </div>

            {/* Motif obligatoire */}
            <div className="pt-2">
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Motif justifiant la rectification *
              </label>
              <textarea
                value={editFormData.motif}
                onChange={(e) => setEditFormData({ ...editFormData, motif: e.target.value })}
                required
                rows={3}
                placeholder="Explication précise (ex: Rectification d'orthographe sur présentation de la CNI originale, mise à jour du numéro de téléphone à la demande du patient)..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditModalPatient(null)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submittingEdit}
                className="px-5 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                {submittingEdit ? 'Enregistrement...' : 'Enregistrer les corrections'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Historique des Modifications */}
      {historyModalPatient && (
        <Modal
          isOpen={!!historyModalPatient}
          onClose={() => setHistoryModalPatient(null)}
          title={`Historique des Modifications Administratives • ${historyModalPatient.nom} ${historyModalPatient.prenom}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            {loadingHistory ? (
              <LoadingSkeleton type="table" lines={3} />
            ) : modificationHistory.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                Aucune modification administrative enregistrée pour ce patient.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[#123B5D] font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Auteur & Structure</th>
                      <th className="py-2.5 px-3">Motif</th>
                      <th className="py-2.5 px-3">Champs Modifiés</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {modificationHistory.map((h) => (
                      <tr key={h.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap align-top">
                          {formatDate(h.date_modification)}
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <span className="font-semibold text-[#123B5D] block">
                            {h.auteur_nom_complet || 'Utilisateur'}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {h.etablissement_nom || 'Établissement inconnu'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-700 align-top max-w-xs">
                          {h.motif}
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          {h.champs_modifies && Object.keys(h.champs_modifies).length > 0 ? (
                            <div className="space-y-1">
                              {Object.entries(h.champs_modifies).map(([k, val]) => (
                                <div key={k} className="text-[11px]">
                                  <span className="font-semibold text-slate-700">{k} : </span>
                                  <span className="line-through text-rose-500">{val.ancien || 'vide'}</span>
                                  <span className="mx-1">→</span>
                                  <span className="font-medium text-emerald-600">{val.nouveau || 'vide'}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Détail non disponible</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setHistoryModalPatient(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Rapprochement Contrôlé avec SearchablePatientSelect */}
      {isReconcileModalOpen && selectedPatient && (
        <Modal
          isOpen={isReconcileModalOpen}
          onClose={() => setIsReconcileModalOpen(false)}
          title="Rapprochement Contrôlé d'une Fiche Provisoire"
          maxWidth="max-w-lg"
        >
          <form onSubmit={handleReconcileSubmit} className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
              <p className="font-semibold mb-1">
                Fiche provisoire à régulariser : {selectedPatient.nom} {selectedPatient.prenom} ({selectedPatient.medtransfer_id})
              </p>
              <p className="text-[11px] text-amber-800">
                L'opération liera cette admission d'urgence vers le dossier définitif retrouvé dans la base nationale.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Dossier patient cible vérifié *
              </label>
              <SearchablePatientSelect
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                scope="directory"
                excludePatientId={selectedPatient.id}
                placeholder="Rechercher le dossier officiel par Nom, Prénom ou ID..."
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Justification et motif du rapprochement *
              </label>
              <textarea
                value={reconcileMotif}
                onChange={(e) => setReconcileMotif(e.target.value)}
                required
                rows={3}
                placeholder="ex: Pièce d'identité officielle présentée par la famille lors du réveil du patient aux urgences."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsReconcileModalOpen(false)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={reconciling || !targetId}
                className="px-5 py-2 font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm disabled:opacity-50"
              >
                {reconciling ? 'Rapprochement...' : 'Valider le rapprochement'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

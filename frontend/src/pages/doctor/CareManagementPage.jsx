import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { careService } from '../../services/careService';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { GlobalSearch } from '../../components/GlobalSearch';
import { formatDateTime, formatDate } from '../../utils/formatters';
import { matchesSearchText } from '../../utils/searchUtils';
import {
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  FilePlus,
  CheckSquare,
  Clock,
  UserCheck,
  Building2,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';

export const CareManagementPage = () => {
  const { user } = useAuth();
  const [cares, setCares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState({ type: '', message: '' });
  const [searchQuery, setSearchQuery] = useState('');

  // Clôture Modal State
  const [selectedCareToClose, setSelectedCareToClose] = useState(null);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closeMotif, setCloseMotif] = useState('Fin de traitement / Patient guéri');
  const [closeNotes, setCloseNotes] = useState('');
  const [closingLoading, setClosingLoading] = useState(false);
  const [closeError, setCloseError] = useState('');

  // Pagination locale si plus de 15 éléments
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const fetchCares = async () => {
    try {
      setLoading(true);
      const list = await careService.getPecList({ statut: 'ACTIF', scope: 'my_care' });
      setCares(Array.isArray(list) ? list : list?.results || []);
    } catch (err) {
      console.error(err);
      setFeedback({
        type: 'error',
        message: 'Impossible de charger vos prises en charge actives.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCares();
  }, []);

  const handleOpenCloseModal = (care) => {
    setSelectedCareToClose(care);
    setCloseMotif('Fin de traitement / Patient guéri');
    setCloseNotes('');
    setCloseError('');
    setIsCloseModalOpen(true);
  };

  const handleConfirmClose = async (e) => {
    e.preventDefault();
    if (!selectedCareToClose) return;

    const trimmedMotif = (closeMotif || '').trim();
    if (!trimmedMotif) {
      setCloseError('Le motif de clôture est strictement obligatoire.');
      return;
    }

    try {
      setClosingLoading(true);
      setCloseError('');
      const fullMotif = closeNotes.trim()
        ? `${trimmedMotif} — Résumé : ${closeNotes.trim()}`
        : trimmedMotif;

      await careService.closePec(selectedCareToClose.id, fullMotif);

      setIsCloseModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Prise en charge de ${selectedCareToClose.patient_nom} clôturée avec succès. Le patient est désormais libéré pour une nouvelle prise en charge.`,
      });
      fetchCares();
      setTimeout(() => setFeedback({ type: '', message: '' }), 6000);
    } catch (err) {
      console.error(err);
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.motif ||
        'Erreur lors de la clôture de la prise en charge.';
      setCloseError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setClosingLoading(false);
    }
  };

  const filteredCares = useMemo(() => {
    if (!searchQuery.trim()) return cares;
    return cares.filter((c) =>
      matchesSearchText(c, searchQuery, [
        'patient_nom',
        'patient_medtransfer_id',
        'etablissement_nom',
        'etablissement_code',
        'medecin_nom',
        'statut',
      ])
    );
  }, [cares, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCares.length / pageSize));
  const paginatedCares = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCares.slice(start, start + pageSize);
  }, [filteredCares, page, pageSize]);

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="w-5 h-5 text-[#1976D2]" />
            <h2 className="text-xl font-bold text-[#123B5D]">
              Mes Prises en Charge Actives
            </h2>
          </div>
          <p className="text-xs text-[#64748B]">
            Dossiers dont vous êtes personnellement le <strong>médecin référent responsable</strong> au sein de {user?.etablissement?.nom || 'votre établissement'}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg shrink-0 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
            {cares.length} suivi{cares.length > 1 ? 's' : ''} actif{cares.length > 1 ? 's' : ''}
          </span>
          <Link
            to="/doctor/patients"
            className="px-3.5 py-1.5 bg-[#1976D2] hover:bg-[#1565C0] text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            Prendre un patient
          </Link>
        </div>
      </div>

      {feedback.message && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          {feedback.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Barre de Recherche Instantanée */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm">
        <GlobalSearch
          value={searchQuery}
          onSearch={(val) => {
            setSearchQuery(val);
            setPage(1);
          }}
          onClear={() => {
            setSearchQuery('');
            setPage(1);
          }}
          placeholder="Filtrer instantanément mes prises en charge par nom de patient, identifiant MEDTRANSFER..."
          debounceMs={0}
        />
      </div>

      {loading ? (
        <LoadingSkeleton type="table" lines={5} />
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[#123B5D] font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Patient</th>
                <th className="py-3 px-4">Identifiant MedTransfer</th>
                <th className="py-3 px-4">Établissement</th>
                <th className="py-3 px-4">Médecin Référent</th>
                <th className="py-3 px-4">Date Début</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4 text-right">Actions Cliniques</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCares.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {searchQuery
                      ? 'Aucune prise en charge active ne correspond à votre filtre.'
                      : "Vous n'avez actuellement aucun patient sous votre prise en charge active. Consultez la liste des dossiers pour prendre en charge un patient disponible."}
                  </td>
                </tr>
              ) : (
                paginatedCares.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#123B5D] text-sm block">
                        {c.patient_nom}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#1976D2] font-bold">
                      {c.patient_medtransfer_id}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {c.etablissement_nom} ({c.etablissement_code})
                    </td>
                    <td className="py-3 px-4 text-emerald-800 font-semibold">
                      {c.medecin_nom} (Vous)
                    </td>
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                      {formatDateTime(c.date_debut)}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px] font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <Link
                          to={`/doctor/patients/${c.patient}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1976D2] hover:bg-[#1565C0] text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
                          title="Consulter le dossier médical complet"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Dossier
                        </Link>
                        <Link
                          to={`/doctor/consultations/new?patient_id=${c.patient}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold rounded-lg transition-all"
                          title="Créer une consultation pour ce suivi"
                        >
                          <FilePlus className="w-3.5 h-3.5" />
                          Consultation
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleOpenCloseModal(c)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg transition-all"
                          title="Clôturer cette prise en charge"
                        >
                          <CheckSquare className="w-3.5 h-3.5" />
                          Clôturer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination locale */}
          {filteredCares.length > pageSize && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-500">
              <span>
                Total : <strong className="text-slate-700">{filteredCares.length}</strong> prises en charge (Page {page} sur {totalPages})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Précédent
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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

      {/* Modal de Clôture de Prise en Charge */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => !closingLoading && setIsCloseModalOpen(false)}
        title="Clôture de la Prise en Charge Médicale"
        maxWidth="max-w-lg"
      >
        {selectedCareToClose && (
          <form onSubmit={handleConfirmClose} className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#123B5D] text-sm">
                  {selectedCareToClose.patient_nom}
                </span>
                <span className="font-mono text-xs font-bold text-[#1976D2] bg-white px-2 py-0.5 rounded border border-blue-200">
                  {selectedCareToClose.patient_medtransfer_id}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Prise en charge débutée le {formatDateTime(selectedCareToClose.date_debut)} à {selectedCareToClose.etablissement_nom}.
              </p>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                La clôture met fin à votre suivi médical de référence pour ce patient. Tout l'historique des consultations est conservé. Le patient redeviendra disponible pour une nouvelle prise en charge ordinaire.
              </span>
            </div>

            {closeError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{closeError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#123B5D] block">
                Motif obligatoire de clôture <span className="text-rose-600">*</span>
              </label>
              <select
                value={closeMotif}
                onChange={(e) => setCloseMotif(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1976D2] bg-white"
                required
              >
                <option value="Fin de traitement / Patient guéri">Fin de traitement / Patient guéri</option>
                <option value="Sortie d'hospitalisation / Stabilisation">Sortie d'hospitalisation / Stabilisation</option>
                <option value="Orientation vers un médecin traitant externe">Orientation vers un médecin traitant externe</option>
                <option value="Sortie contre avis médical">Sortie contre avis médical</option>
                <option value="Décès du patient">Décès du patient</option>
                <option value="Autre motif médical">Autre motif médical</option>
              </select>
            </div>

            {closeMotif === 'Autre motif médical' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#123B5D] block">
                  Précisez le motif <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex : Transfert ambulatoire..."
                  onChange={(e) => setCloseMotif(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1976D2]"
                  required
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#123B5D] block">
                Résumé clinique final / Notes de sortie (optionnel)
              </label>
              <textarea
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                rows={3}
                placeholder="Évolution finale, recommandations de sortie, ordonnance de sortie..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1976D2]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={closingLoading}
                onClick={() => setIsCloseModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={closingLoading}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                <CheckSquare className="w-4 h-4" />
                {closingLoading ? 'Clôture en cours...' : 'Confirmer la clôture'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

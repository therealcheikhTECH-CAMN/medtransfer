import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { patientService } from '../../services/patientService';
import { careService } from '../../services/careService';
import { GlobalSearch } from '../../components/GlobalSearch';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { formatDate, calculateAge } from '../../utils/formatters';
import {
  FolderOpen,
  ShieldAlert,
  UserCheck,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Users,
  ChevronLeft,
  ChevronRight,
  Stethoscope,
  Building2,
  Clock,
  Lock,
} from 'lucide-react';

export const PatientListPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialQ = searchParams.get('q') || '';

  const [query, setQuery] = useState(initialQ);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Modal de confirmation de prise en charge
  const [selectedPatientForCare, setSelectedPatientForCare] = useState(null);
  const [isTakeChargeModalOpen, setIsTakeChargeModalOpen] = useState(false);
  const [takeChargeLoading, setTakeChargeLoading] = useState(false);

  // Pagination DRF
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const abortControllerRef = useRef(null);

  const fetchPatients = useCallback(
    async (searchTerm = '', pageNum = 1) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        setLoading(true);
        const trimmed = searchTerm.trim();
        const scope = trimmed ? 'directory' : 'my_care';

        const res = await patientService.search(
          {
            q: trimmed,
            scope,
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
          console.error('Erreur chargement patients:', err);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Chargement initial
  useEffect(() => {
    fetchPatients(initialQ, 1);
  }, []);

  const handleSearch = (newQuery) => {
    const trimmed = (newQuery || '').trim();
    setQuery(trimmed);
    setPage(1);
    setSearchParams(trimmed ? { q: trimmed } : {});
    fetchPatients(trimmed, 1);
  };

  const handleClear = () => {
    setQuery('');
    setPage(1);
    setSearchParams({});
    fetchPatients('', 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchPatients(query, newPage);
  };

  const handleOpenTakeChargeModal = (patient) => {
    setSelectedPatientForCare(patient);
    setIsTakeChargeModalOpen(true);
  };

  const handleConfirmTakeCharge = async () => {
    if (!selectedPatientForCare) return;

    try {
      setTakeChargeLoading(true);
      setFeedback({ type: '', message: '' });
      await careService.takeCharge(selectedPatientForCare.id);
      setIsTakeChargeModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Prise en charge confirmée avec succès pour ${selectedPatientForCare.nom.toUpperCase()} ${selectedPatientForCare.prenom}. Vous êtes désormais son médecin référent responsable.`,
      });
      fetchPatients(query, page);
      setTimeout(() => setFeedback({ type: '', message: '' }), 6000);
    } catch (err) {
      console.error(err);
      const detail =
        err.response?.data?.detail ||
        "Impossible de finaliser la prise en charge pour ce patient.";
      setFeedback({ type: 'error', message: detail });
      setIsTakeChargeModalOpen(false);
    } finally {
      setTakeChargeLoading(false);
    }
  };

  const isSearchingDirectory = query.trim().length > 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / 20));

  return (
    <div className="space-y-6">
      {/* En-tête avec indicateur de mode */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#123B5D]">
            {isSearchingDirectory
              ? 'Recherche Administrative dans le Référentiel National'
              : 'Mes Patients Pris en Charge & Accès Autorisés'}
          </h2>
          <p className="text-xs text-[#64748B]">
            {isSearchingDirectory
              ? "Recherche instantanée sur le réseau national. Cliquez sur « Prendre en charge » pour devenir le médecin référent d'un patient disponible."
              : "Patients actuellement sous votre responsabilité médicale de référence, en attente de prise en charge ou sous autorisation active."}
          </p>
        </div>
        {isSearchingDirectory && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1976D2] bg-blue-50 hover:bg-blue-100 rounded-xl border border-blue-200 transition-colors shrink-0"
          >
            <Users className="w-3.5 h-3.5" />
            Revenir à mes patients
          </button>
        )}
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

      {/* Barre de Recherche Instantanée Commune */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center">
        <GlobalSearch
          value={query}
          onSearch={handleSearch}
          onClear={handleClear}
          loading={loading}
          placeholder="Rechercher instantanément par Nom, Prénom, ID MEDTRANSFER, NIN ou Téléphone..."
          debounceMs={300}
        />
      </div>

      {/* Tableau des patients */}
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
                <th className="py-3.5 px-4">Prise en Charge Active</th>
                <th className="py-3.5 px-4">Statut Identité</th>
                <th className="py-3.5 px-4 text-right">Action Clinique</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    {isSearchingDirectory
                      ? 'Aucun patient ne correspond à votre recherche.'
                      : "Aucun patient n'est actuellement rattaché à vos prises en charge actives. Tapez directement dans la barre ci-dessus pour rechercher un patient et le prendre en charge."}
                  </td>
                </tr>
              ) : (
                patients.map((p) => {
                  const isFollowedByMe =
                    p.est_suivi_par_moi ||
                    (p.acces_clinique_autorise && p.mode_acces_medecin === 'ORDINARY_CARE') ||
                    (p.prise_en_charge_active && p.prise_en_charge_active.medecin_responsable_id === user?.id);

                  const isAlreadyTakenByOther =
                    p.est_deja_pris_en_charge ||
                    (p.prise_en_charge_active &&
                      p.prise_en_charge_active.medecin_responsable_id &&
                      p.prise_en_charge_active.medecin_responsable_id !== user?.id);

                  const isAvailableForCare =
                    p.is_disponible ||
                    (!p.prise_en_charge_active) ||
                    (p.prise_en_charge_active && !p.prise_en_charge_active.medecin_responsable_id);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-[#1976D2]">
                        {p.medtransfer_id}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-[#123B5D] text-sm block">
                          {p.nom.toUpperCase()} {p.prenom}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          NIN : {p.numero_identification_nationale || 'Non renseigné'} • {p.ville || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-700 block">
                          {calculateAge(p.date_naissance)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDate(p.date_naissance)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isFollowedByMe ? (
                          <div className="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 text-[10px] font-bold">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Suivi actif par vous ({p.prise_en_charge_active?.etablissement_code || user?.etablissement?.code})</span>
                          </div>
                        ) : p.acces_clinique_autorise && p.mode_acces_medecin === 'EMERGENCY_ACCESS' ? (
                          <div className="inline-flex items-center gap-1.5 text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 text-[10px] font-bold">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            <span>Autorisation d'urgence active</span>
                          </div>
                        ) : isAlreadyTakenByOther ? (
                          <div className="inline-flex flex-col text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 text-[10px]">
                            <span className="font-bold flex items-center gap-1">
                              <Lock className="w-3 h-3 text-amber-600" />
                              Déjà pris en charge
                            </span>
                            <span>{p.prise_en_charge_active?.medecin_nom} • {p.prise_en_charge_active?.etablissement_nom}</span>
                          </div>
                        ) : isAvailableForCare ? (
                          <span className="inline-flex items-center gap-1 text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200 text-[10px] font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block"></span>
                            Disponible pour prise en charge
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] italic">
                            Aucune prise en charge active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge status={p.status_identite}>{p.status_identite_display}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isFollowedByMe || (p.acces_clinique_autorise && p.mode_acces_medecin === 'EMERGENCY_ACCESS') ? (
                          <Link
                            to={`/doctor/patients/${p.id}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1976D2] hover:bg-[#1565C0] text-white font-semibold rounded-lg text-xs shadow-sm transition-all"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            Ouvrir le dossier
                          </Link>
                        ) : isAvailableForCare && !isAlreadyTakenByOther ? (
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenTakeChargeModal(p)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1976D2] hover:bg-[#1565C0] text-white font-semibold rounded-lg text-xs shadow-sm transition-all"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              Prendre en charge
                            </button>
                            <Link
                              to={`/doctor/patients/${p.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold rounded-lg text-xs transition-all"
                              title="Accès exceptionnel d'urgence"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Urgence
                            </Link>
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-2">
                            <button
                              type="button"
                              disabled
                              title={`Ce patient est déjà pris en charge par ${p.prise_en_charge_active?.medecin_nom || 'un autre praticien'}.`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-400 font-semibold rounded-lg text-xs border border-slate-200 cursor-not-allowed"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              Prendre en charge
                            </button>
                            <Link
                              to={`/doctor/patients/${p.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-semibold rounded-lg text-xs transition-all"
                              title="Accès exceptionnel d'urgence"
                            >
                              <ShieldAlert className="w-3.5 h-3.5" />
                              Urgence
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
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

      {/* Modal de confirmation de prise en charge */}
      <Modal
        isOpen={isTakeChargeModalOpen}
        onClose={() => !takeChargeLoading && setIsTakeChargeModalOpen(false)}
        title="Confirmation de la Prise en Charge Médicale"
        maxWidth="max-w-lg"
      >
        {selectedPatientForCare && (
          <div className="space-y-4">
            <div className="p-4 bg-sky-50/60 border border-sky-100 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#123B5D] text-sm">
                  {selectedPatientForCare.nom.toUpperCase()} {selectedPatientForCare.prenom}
                </span>
                <span className="font-mono text-xs font-bold text-[#1976D2] bg-white px-2 py-0.5 rounded border border-blue-200">
                  {selectedPatientForCare.medtransfer_id}
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Né(e) le {formatDate(selectedPatientForCare.date_naissance)} ({calculateAge(selectedPatientForCare.date_naissance)})
                {selectedPatientForCare.ville && ` • Résidence : ${selectedPatientForCare.ville}`}
              </p>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-2 leading-relaxed">
              <p className="font-semibold text-[#123B5D] flex items-center gap-1.5">
                <Stethoscope className="w-4 h-4 text-[#1976D2]" />
                Règle d'exclusivité médicale et responsabilité de référence :
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px]">
                <li>Vous devenez le <strong>médecin responsable</strong> du suivi médical de ce patient.</li>
                <li>Votre structure sanitaire (<strong>{user?.etablissement?.nom || 'Votre établissement'}</strong>) est enregistrée comme établissement de référence.</li>
                <li>Le patient sera verrouillé en suivi exclusif : aucun autre médecin ne pourra créer de prise en charge ordinaire active simultanée jusqu'à sa clôture ou son transfert.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                disabled={takeChargeLoading}
                onClick={() => setIsTakeChargeModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={takeChargeLoading}
                onClick={handleConfirmTakeCharge}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                {takeChargeLoading ? 'Enregistrement...' : 'Confirmer la prise en charge'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { userService } from '../../services/userService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { Modal } from '../../components/Modal';
import { Badge } from '../../components/Badge';
import { GlobalSearch } from '../../components/GlobalSearch';
import { formatDateTime } from '../../utils/formatters';
import { EmailComposerModal } from '../../components/email/EmailComposerModal';
import {
  Building2,
  Check,
  X,
  AlertTriangle,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  AlertCircle,
  Phone,
  Mail,
  Briefcase,
  FileText,
  Clock,
  History,
  RotateCcw,
} from 'lucide-react';

export const DirectorRequestsPage = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING'); // Default to pending requests
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Validation Modal (Standard or Replacement)
  const [validateModalUser, setValidateModalUser] = useState(null);
  const [motifRevocation, setMotifRevocation] = useState('');
  const [submittingValidation, setSubmittingValidation] = useState(false);

  // Rejection Modal
  const [rejectModalUser, setRejectModalUser] = useState(null);
  const [rejectMotif, setRejectMotif] = useState('');
  const [submittingRejection, setSubmittingRejection] = useState(false);

  // History Modal
  const [historyModalUser, setHistoryModalUser] = useState(null);
  const [statusHistory, setStatusHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Email Composer Modal State
  const [emailModalConfig, setEmailModalConfig] = useState({
    isOpen: false,
    recipient: '',
    recipientName: '',
    contextCategory: 'ALL',
    contextData: {},
  });

  const handleOpenEmailForCandidate = (cand) => {
    setEmailModalConfig({
      isOpen: true,
      recipient: cand.email || '',
      recipientName: `${cand.first_name || ''} ${cand.last_name || ''}`.trim(),
      contextCategory: 'ALL',
      contextData: {
        recipientName: `${cand.first_name || ''} ${cand.last_name || ''}`.trim(),
        etablissementNom: cand.etablissement_details?.nom || '',
        entityType: 'director_request',
        entityId: cand.id,
      },
    });
  };

  const abortControllerRef = useRef(null);

  const fetchDirectorRequests = useCallback(async (query = '', status = statusFilter, pageNum = 1) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      const params = {
        role: 'DIRECTEUR',
        page: pageNum,
      };
      if (query.trim()) params.q = query.trim();
      if (status !== 'ALL') params.statut_validation = status;

      const res = await userService.getList(params, { signal: controller.signal });
      const list = Array.isArray(res) ? res : res.results || [];
      setRequests(list);
      setTotalCount(res.count ?? list.length);
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error('Erreur chargement demandes directeurs:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchDirectorRequests(searchTerm, statusFilter, page);
  }, [fetchDirectorRequests, searchTerm, statusFilter, page]);

  const handleSearch = (term) => {
    setSearchTerm(term);
    setPage(1);
  };

  const handleStatusFilterChange = (status) => {
    setStatusFilter(status);
    setPage(1);
  };

  // Validation Flow
  const openValidateModal = (reqUser) => {
    setValidateModalUser(reqUser);
    setMotifRevocation('');
    setErrorMessage('');
  };

  const handleConfirmValidation = async (e) => {
    e.preventDefault();
    if (!validateModalUser) return;

    const hasActiveDirector = Boolean(validateModalUser.current_active_director);
    if (hasActiveDirector && !motifRevocation.trim()) {
      setErrorMessage("Le motif de révocation du directeur en poste est obligatoire.");
      return;
    }

    try {
      setSubmittingValidation(true);
      setErrorMessage('');
      setActionLoadingId(validateModalUser.id);

      const payload = hasActiveDirector
        ? { replace_current: true, motif_revocation: motifRevocation.trim() }
        : {};

      const res = await userService.approve(validateModalUser.id, payload);
      setMessage(res.message || "La demande de directeur a été validée avec succès.");
      setValidateModalUser(null);
      await fetchDirectorRequests(searchTerm, statusFilter, page);
      setTimeout(() => setMessage(''), 6000);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.motif_revocation ||
        err.response?.data?.detail ||
        "Impossible de valider cette demande de directeur."
      );
    } finally {
      setSubmittingValidation(false);
      setActionLoadingId(null);
    }
  };

  // Rejection Flow
  const openRejectModal = (reqUser) => {
    setRejectModalUser(reqUser);
    setRejectMotif('');
    setErrorMessage('');
  };

  const handleConfirmRejection = async (e) => {
    e.preventDefault();
    if (!rejectModalUser) return;
    if (!rejectMotif.trim()) {
      setErrorMessage("Le motif de refus est obligatoire.");
      return;
    }

    try {
      setSubmittingRejection(true);
      setErrorMessage('');
      setActionLoadingId(rejectModalUser.id);

      const res = await userService.reject(rejectModalUser.id, rejectMotif.trim());
      setMessage(res.message || "La demande a été refusée avec succès.");
      setRejectModalUser(null);
      await fetchDirectorRequests(searchTerm, statusFilter, page);
      setTimeout(() => setMessage(''), 6000);
    } catch (err) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.motif ||
        err.response?.data?.detail ||
        "Impossible de refuser cette demande."
      );
    } finally {
      setSubmittingRejection(false);
      setActionLoadingId(null);
    }
  };

  // Status History Flow
  const openHistoryModal = async (u) => {
    setHistoryModalUser(u);
    setLoadingHistory(true);
    try {
      const history = await userService.getStatusHistory(u.id);
      setStatusHistory(Array.isArray(history) ? history : []);
    } catch (err) {
      console.error('Erreur chargement historique statut:', err);
      setStatusHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1976D2]">
            Administration Générale & Tutelle
          </span>
          <h1 className="text-2xl font-black text-[#123B5D]">
            Demandes d'inscription des Directeurs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Examinez, validez et révoquez les mandats de direction des établissements sanitaires.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2.5 shadow-sm">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{message}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="font-semibold">{errorMessage}</span>
        </div>
      )}

      {/* Barre d'actions & Filtres */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-80">
          <GlobalSearch
            value={searchTerm}
            onSearch={handleSearch}
            placeholder="Rechercher par nom, email, fonction ou hôpital..."
          />
        </div>

        {/* Filtres par statut */}
        <div className="flex items-center gap-1.5 flex-wrap self-start md:self-auto text-xs">
          {[
            { label: 'En attente', value: 'PENDING', count: requests.filter(r => r.statut_validation === 'PENDING').length },
            { label: 'Validées', value: 'APPROVED' },
            { label: 'Refusées', value: 'REJECTED' },
            { label: 'Toutes les demandes', value: 'ALL' },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => handleStatusFilterChange(item.value)}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                statusFilter === item.value
                  ? 'bg-[#1976D2] text-white shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste des demandes */}
      {loading ? (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <LoadingSkeleton count={3} />
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center shadow-sm space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-700">Aucune demande trouvée</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {statusFilter === 'PENDING'
              ? "Toutes les demandes de direction ont été traitées par l'administrateur."
              : "Aucune demande ne correspond aux critères de recherche actuels."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => {
            const isPending = req.statut_validation === 'PENDING';
            const isApproved = req.statut_validation === 'APPROVED';
            const isRejected = req.statut_validation === 'REJECTED';
            const currentDir = req.current_active_director;

            return (
              <div
                key={req.id}
                className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all space-y-4"
              >
                {/* Ligne 1 : Demandeur & Statut */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1976D2] font-black flex items-center justify-center text-lg border border-blue-100 shrink-0">
                      {req.first_name?.[0] || 'D'}{req.last_name?.[0] || ''}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-[#123B5D]">
                          {req.first_name} {req.last_name}
                        </h3>
                        <Badge
                          variant={
                            isApproved ? 'success' : isPending ? 'warning' : isRejected ? 'danger' : 'neutral'
                          }
                        >
                          {req.statut_validation_display || req.statut_validation}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1 text-[#1976D2] font-semibold">
                          <Briefcase className="w-3.5 h-3.5" />
                          {req.fonction || 'Directeur d\'établissement'}
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {req.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {req.telephone || 'Non renseigné'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions d'administration */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => openHistoryModal(req)}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Consulter l'historique de statut"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEmailForCandidate(req)}
                      className="p-2 text-slate-500 hover:text-[#1976D2] hover:bg-sky-50 rounded-lg transition-colors border border-slate-200"
                      title="Préparer un e-mail à ce candidat (pièces complémentaires...)"
                    >
                      <Mail className="w-4 h-4" />
                    </button>

                    {isPending && (
                      <>
                        <button
                          type="button"
                          onClick={() => openRejectModal(req)}
                          disabled={actionLoadingId === req.id}
                          className="px-3.5 py-2 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Refuser
                        </button>
                        <button
                          type="button"
                          onClick={() => openValidateModal(req)}
                          disabled={actionLoadingId === req.id}
                          className="px-4 py-2 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Valider la demande
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Ligne 2 : Établissement et Statut de Direction */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Établissement concerné */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Établissement sollicité
                    </span>
                    <span className="font-bold text-[#123B5D] text-sm block">
                      {req.etablissement_details?.nom || 'Établissement non rattaché'}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px] block">
                      Code : {req.etablissement_details?.code || '—'} ({req.etablissement_details?.ville || '—'})
                    </span>
                    {req.justificatif && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
                        <strong>Justificatif :</strong> {req.justificatif}
                      </div>
                    )}
                  </div>

                  {/* État de la Direction de l'Établissement */}
                  <div
                    className={`p-3.5 rounded-xl border space-y-1.5 ${
                      currentDir
                        ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                        : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider block">
                      Statut de la direction hospitalière
                    </span>

                    {currentDir ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Direction actuellement pourvue</span>
                        </div>
                        <p className="text-[11px] text-amber-900">
                          Directeur en poste : <strong>{currentDir.nom}</strong> ({currentDir.email})
                        </p>
                        <p className="text-[10px] text-amber-700 italic">
                          Règle de sécurité : La validation de cette nouvelle demande exigera la révocation préalable du mandat du directeur actuel.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Direction vacante</span>
                        </div>
                        <p className="text-[11px] text-emerald-800">
                          Aucun directeur actif n'est actuellement rattaché à cet établissement. La validation activera directement le mandat.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Motif de rejet si rejeté */}
                {isRejected && req.motif_rejet && (
                  <div className="p-3 bg-red-50/70 border border-red-200 text-red-800 text-xs rounded-xl flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Motif officiel du refus :</span>
                      <p className="mt-0.5 text-red-900">{req.motif_rejet}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Validation (Cas A sans conflit vs Cas B avec révocation) */}
      {validateModalUser && (
        <Modal
          isOpen={Boolean(validateModalUser)}
          onClose={() => !submittingValidation && setValidateModalUser(null)}
          title="Validation de la demande d'accès Directeur"
        >
          <form onSubmit={handleConfirmValidation} className="space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
              <span className="text-slate-500 font-medium block">Nouveau directeur :</span>
              <span className="font-bold text-slate-800 text-sm block">
                {validateModalUser.first_name} {validateModalUser.last_name}
              </span>
              <span className="text-slate-500 block">
                Établissement : <strong>{validateModalUser.etablissement_details?.nom}</strong>
              </span>
            </div>

            {/* CAS B : Un directeur actif existe déjà */}
            {validateModalUser.current_active_director ? (
              <div className="space-y-3">
                <div className="p-3.5 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Avertissement : Conflit de direction active</span>
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Cet établissement possède déjà un directeur actif :{' '}
                    <strong>
                      {validateModalUser.current_active_director.nom} ({validateModalUser.current_active_director.email})
                    </strong>
                    . Conformément aux règles MEDTRANSFER, un établissement ne peut avoir qu'un seul directeur actif à la fois.
                  </p>
                  <p className="text-[11px] font-bold text-amber-900">
                    La validation de cette demande révoquera immédiatement les accès du directeur actuel et invalidera ses sessions actives.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Motif obligatoire de révocation du directeur actuel *
                  </label>
                  <textarea
                    value={motifRevocation}
                    onChange={(e) => setMotifRevocation(e.target.value)}
                    rows={3}
                    placeholder="Ex: Remplacement officiel suite à nomination ministérielle ou fin de mandat..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] resize-none"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Ce motif sera consigné dans l'historique immuable et le journal d'audit de sécurité.
                  </p>
                </div>
              </div>
            ) : (
              /* CAS A : Direction vacante */
              <div className="p-3.5 bg-sky-50 border border-sky-200 text-[#123B5D] rounded-xl flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#1976D2] shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed">
                  La direction de cet établissement est actuellement vacante. La validation activera immédiatement le compte directeur et déclenchera l'envoi de l'e-mail de confirmation avec ses identifiants.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setValidateModalUser(null)}
                disabled={submittingValidation}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submittingValidation}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {submittingValidation ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : validateModalUser.current_active_director ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Révoquer l'ancien directeur et valider
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Valider le compte directeur
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal de Refus */}
      {rejectModalUser && (
        <Modal
          isOpen={Boolean(rejectModalUser)}
          onClose={() => !submittingRejection && setRejectModalUser(null)}
          title="Refuser la demande d'accès Directeur"
        >
          <form onSubmit={handleConfirmRejection} className="space-y-4 text-xs">
            {errorMessage && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <p className="text-slate-600">
              Vous vous apprêtez à refuser la demande d'accès directeur de{' '}
              <strong>
                {rejectModalUser.first_name} {rejectModalUser.last_name}
              </strong>{' '}
              pour l'établissement <strong>{rejectModalUser.etablissement_details?.nom}</strong>.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motif obligatoire du refus *
              </label>
              <textarea
                value={rejectMotif}
                onChange={(e) => setRejectMotif(e.target.value)}
                rows={3}
                placeholder="Ex: Justificatif de nomination non conforme, compte non habilité par la tutelle..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-red-500 resize-none"
                required
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Ce motif sera automatiquement transmis par e-mail au demandeur et consigné dans le journal d'audit.
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectModalUser(null)}
                disabled={submittingRejection}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submittingRejection}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                {submittingRejection ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <X className="w-3.5 h-3.5" />
                    Confirmer le refus
                  </>
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal d'historique des statuts */}
      {historyModalUser && (
        <Modal
          isOpen={Boolean(historyModalUser)}
          onClose={() => setHistoryModalUser(null)}
          title={`Historique des statuts — ${historyModalUser.first_name} ${historyModalUser.last_name}`}
        >
          <div className="space-y-4 text-xs">
            {loadingHistory ? (
              <LoadingSkeleton count={2} />
            ) : statusHistory.length === 0 ? (
              <p className="text-slate-500 text-center py-4">Aucun changement de statut enregistré.</p>
            ) : (
              <div className="space-y-3">
                {statusHistory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1"
                  >
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-slate-800">
                        {item.ancien_statut} → {item.nouveau_statut}
                      </span>
                      <span className="text-slate-400 font-mono">
                        {formatDateTime(item.created_at)}
                      </span>
                    </div>
                    {item.motif && (
                      <p className="text-[11px] text-slate-600 italic">Motif : « {item.motif} »</p>
                    )}
                    <span className="text-[10px] text-slate-400 block">
                      Par : {item.changed_by_nom || 'Administrateur'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setHistoryModalUser(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal de composition d'email */}
      <EmailComposerModal
        isOpen={emailModalConfig.isOpen}
        onClose={() => setEmailModalConfig(prev => ({ ...prev, isOpen: false }))}
        initialRecipient={emailModalConfig.recipient}
        initialRecipientName={emailModalConfig.recipientName}
        contextCategory={emailModalConfig.contextCategory}
        contextData={emailModalConfig.contextData}
      />
    </div>
  );
};

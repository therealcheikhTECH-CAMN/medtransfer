import React, { useState, useEffect, useRef, useCallback } from 'react';
import { userService } from '../../services/userService';
import { establishmentService } from '../../services/establishmentService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { Modal } from '../../components/Modal';
import { Badge } from '../../components/Badge';
import { GlobalSearch } from '../../components/GlobalSearch';
import { SearchableEstablishmentSelect } from '../../components/SearchableEstablishmentSelect';
import { formatDateTime } from '../../utils/formatters';
import { EmailComposerModal } from '../../components/email/EmailComposerModal';
import {
  UserPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  History,
  Ban,
  ShieldCheck,
  ShieldAlert,
  UserX,
  UserCheck,
  AlertTriangle,
  RotateCcw,
  Mail,
} from 'lucide-react';

export const UsersManagePage = () => {
  const [users, setUsers] = useState([]);
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Status Action Modals
  const [suspendModalUser, setSuspendModalUser] = useState(null);
  const [suspendMotif, setSuspendMotif] = useState('');
  const [deactivateModalUser, setDeactivateModalUser] = useState(null);
  const [deactivateMotif, setDeactivateMotif] = useState('');
  const [rejectModalUser, setRejectModalUser] = useState(null);
  const [rejectMotif, setRejectMotif] = useState('');

  // Status History Modal
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

  const handleOpenEmailForUser = (targetUser) => {
    setEmailModalConfig({
      isOpen: true,
      recipient: targetUser?.email || '',
      recipientName: `${targetUser?.first_name || ''} ${targetUser?.last_name || ''}`.trim() || targetUser?.username,
      contextCategory: 'ALL',
      contextData: {
        recipientName: `${targetUser?.first_name || ''} ${targetUser?.last_name || ''}`.trim(),
        etablissementNom: targetUser?.etablissement_details?.nom || '',
        entityType: 'user',
        entityId: targetUser?.id,
      },
    });
  };

  const abortControllerRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    first_name: '',
    last_name: '',
    email: '',
    role: 'MEDECIN',
    etablissement: '',
    specialite: '',
    matricule_professionnel: '',
    telephone: '',
    is_actif: true,
  });

  const fetchUsers = useCallback(async (query = '', status = statusFilter, pageNum = 1) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      const params = {
        page: pageNum,
      };
      if (query.trim()) params.q = query.trim();
      if (status !== 'ALL') params.statut_validation = status;

      const res = await userService.getList(params, { signal: controller.signal });
      const list = Array.isArray(res) ? res : res.results || [];
      setUsers(list);
      setTotalCount(res.count ?? list.length);
      setHasNext(Boolean(res.next));
      setHasPrev(Boolean(res.previous));
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error('Erreur chargement utilisateurs:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchEstablishments = async () => {
    try {
      const eList = await establishmentService.getDirectory().then((list) =>
        list.length > 0 ? list : establishmentService.getPublicList()
      );
      setEstablishments(eList || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchUsers('', statusFilter, 1);
    fetchEstablishments();
  }, []);

  const handleSearch = (newQuery) => {
    const trimmed = (newQuery || '').trim();
    setSearchTerm(trimmed);
    setPage(1);
    fetchUsers(trimmed, statusFilter, 1);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setPage(1);
    fetchUsers('', statusFilter, 1);
  };

  const handleStatusFilterChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
    fetchUsers(searchTerm, newStatus, 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchUsers(searchTerm, statusFilter, newPage);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const payload = { ...formData };
      if (!payload.etablissement) payload.etablissement = null;
      await userService.create(payload);
      setMessage('Compte créé avec succès !');
      setIsModalOpen(false);
      setFormData({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        email: '',
        role: 'MEDECIN',
        etablissement: '',
        specialite: '',
        matricule_professionnel: '',
        telephone: '',
        is_actif: true,
      });
      fetchUsers(searchTerm, statusFilter, page);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la création du compte. Vérifiez les champs obligatoires.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (user) => {
    try {
      setActionLoadingId(user.id);
      await userService.approve(user.id);
      setMessage(`Compte de ${user.first_name} ${user.last_name} validé.`);
      fetchUsers(searchTerm, statusFilter, page);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la validation du compte.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReactivate = async (user) => {
    try {
      setActionLoadingId(user.id);
      await userService.reactivate(user.id);
      setMessage(`Compte de ${user.first_name} ${user.last_name} réactivé.`);
      fetchUsers(searchTerm, statusFilter, page);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la réactivation du compte.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmSuspend = async (e) => {
    e.preventDefault();
    if (!suspendModalUser) return;
    try {
      setActionLoadingId(suspendModalUser.id);
      await userService.suspend(suspendModalUser.id, suspendMotif.trim() || 'Suspension administrative');
      setMessage(`Compte de ${suspendModalUser.first_name} ${suspendModalUser.last_name} suspendu.`);
      setSuspendModalUser(null);
      setSuspendMotif('');
      fetchUsers(searchTerm, statusFilter, page);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suspension.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDeactivate = async (e) => {
    e.preventDefault();
    if (!deactivateModalUser) return;
    try {
      setActionLoadingId(deactivateModalUser.id);
      await userService.deactivate(deactivateModalUser.id, deactivateMotif.trim() || 'Désactivation administrative');
      setMessage(`Compte de ${deactivateModalUser.first_name} ${deactivateModalUser.last_name} désactivé.`);
      setDeactivateModalUser(null);
      setDeactivateMotif('');
      fetchUsers(searchTerm, statusFilter, page);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la désactivation.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModalUser || !rejectMotif.trim()) return;
    try {
      setActionLoadingId(rejectModalUser.id);
      await userService.reject(rejectModalUser.id, rejectMotif.trim());
      setMessage(`Demande de ${rejectModalUser.first_name} ${rejectModalUser.last_name} rejetée.`);
      setRejectModalUser(null);
      setRejectMotif('');
      fetchUsers(searchTerm, statusFilter, page);
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error(err);
      alert('Erreur lors du rejet.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenHistory = async (targetUser) => {
    setHistoryModalUser(targetUser);
    setLoadingHistory(true);
    setStatusHistory([]);
    try {
      const hist = await userService.getStatusHistory(targetUser.id);
      setStatusHistory(Array.isArray(hist) ? hist : []);
    } catch (err) {
      console.error(err);
      alert("Impossible de charger l'historique des statuts.");
    } finally {
      setLoadingHistory(false);
    }
  };

  const getStatusBadge = (user) => {
    const s = user.statut_validation;
    if (s === 'APPROVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <UserCheck className="w-3 h-3" /> Validé
        </span>
      );
    }
    if (s === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <AlertTriangle className="w-3 h-3" /> En attente
        </span>
      );
    }
    if (s === 'SUSPENDED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
          <Ban className="w-3 h-3" /> Suspendu
        </span>
      );
    }
    if (s === 'DEACTIVATED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
          <UserX className="w-3 h-3" /> Désactivé
        </span>
      );
    }
    if (s === 'REJECTED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <ShieldAlert className="w-3 h-3" /> Rejeté
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
        {s || 'Inconnu'}
      </span>
    );
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / 20));

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#123B5D]">Gestion des Comptes Professionnels</h2>
          <p className="text-xs text-[#64748B]">Contrôle des accès, statuts d'activité, affectations et historique des habilitations.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-sm transition-all"
        >
          <UserPlus className="w-4 h-4" />
          Créer un utilisateur
        </button>
      </div>

      {message && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          {message}
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'ALL', label: 'Tous les statuts' },
            { key: 'APPROVED', label: 'Validés' },
            { key: 'PENDING', label: 'En attente' },
            { key: 'SUSPENDED', label: 'Suspendus' },
            { key: 'DEACTIVATED', label: 'Désactivés' },
            { key: 'REJECTED', label: 'Rejetés' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleStatusFilterChange(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === tab.key
                  ? 'bg-[#1976D2] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full md:w-80">
          <GlobalSearch
            value={searchTerm}
            onSearch={handleSearch}
            onClear={handleClearSearch}
            loading={loading}
            placeholder="Rechercher par nom, identifiant, matricule..."
            debounceMs={300}
          />
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <LoadingSkeleton type="table" lines={5} />
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[#123B5D] font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Utilisateur</th>
                <th className="py-3.5 px-4">Rôle</th>
                <th className="py-3.5 px-4">Établissement</th>
                <th className="py-3.5 px-4">Spécialité / Matricule</th>
                <th className="py-3.5 px-4">Statut</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-[#123B5D] block">
                        {u.first_name} {u.last_name}
                      </span>
                      <span className="text-[11px] text-slate-400 block font-mono">
                        @{u.username} • {u.email || "Pas d'email"}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={u.role}>{u.role_display || u.role}</Badge>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {u.etablissement_details?.nom ? (
                        <>
                          <span className="block truncate max-w-xs">{u.etablissement_details.nom}</span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {u.etablissement_details.code} ({u.etablissement_details.ville})
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400 italic">Non rattaché (Système)</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-slate-700 block">{u.specialite || '—'}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {u.matricule_professionnel || 'Sans matricule'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {getStatusBadge(u)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                        {/* Historique */}
                        <button
                          type="button"
                          onClick={() => handleOpenHistory(u)}
                          className="p-1.5 text-slate-500 hover:text-[#123B5D] hover:bg-slate-100 rounded-lg border border-slate-200"
                          title="Historique des statuts"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        {u.email && (
                          <button
                            type="button"
                            onClick={() => handleOpenEmailForUser(u)}
                            className="p-1.5 text-slate-500 hover:text-[#1976D2] hover:bg-sky-50 rounded-lg border border-slate-200 transition-colors"
                            title="Préparer un e-mail à cet utilisateur"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Status specific actions */}
                        {u.statut_validation === 'PENDING' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(u)}
                              disabled={actionLoadingId === u.id}
                              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg"
                            >
                              Valider
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectModalUser(u);
                                setRejectMotif('');
                              }}
                              disabled={actionLoadingId === u.id}
                              className="px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg"
                            >
                              Rejeter
                            </button>
                          </>
                        )}

                        {u.statut_validation === 'APPROVED' && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setSuspendModalUser(u);
                                setSuspendMotif('');
                              }}
                              disabled={actionLoadingId === u.id}
                              className="px-2.5 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg"
                            >
                              Suspendre
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeactivateModalUser(u);
                                setDeactivateMotif('');
                              }}
                              disabled={actionLoadingId === u.id}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 rounded-lg"
                            >
                              Désactiver
                            </button>
                          </>
                        )}

                        {u.statut_validation === 'SUSPENDED' && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleReactivate(u)}
                              disabled={actionLoadingId === u.id}
                              className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg inline-flex items-center gap-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Réactiver
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeactivateModalUser(u);
                                setDeactivateMotif('');
                              }}
                              disabled={actionLoadingId === u.id}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 rounded-lg"
                            >
                              Désactiver
                            </button>
                          </>
                        )}

                        {(u.statut_validation === 'DEACTIVATED' || u.statut_validation === 'REJECTED') && (
                          <button
                            type="button"
                            onClick={() => handleReactivate(u)}
                            disabled={actionLoadingId === u.id}
                            className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Réactiver
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
                Total : <strong className="text-slate-700">{totalCount}</strong> comptes (Page {page} sur {totalPages})
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

      {/* Modal Suspendre */}
      <Modal
        isOpen={!!suspendModalUser}
        onClose={() => setSuspendModalUser(null)}
        title="Suspendre le compte professionnel"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmSuspend} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Vous vous apprêtez à suspendre temporairement l'accès de{' '}
            <strong className="text-[#123B5D]">
              {suspendModalUser?.first_name} {suspendModalUser?.last_name}
            </strong>
            . L'utilisateur ne pourra plus s'authentifier jusqu'à réactivation.
          </p>
          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Motif de suspension
            </label>
            <textarea
              value={suspendMotif}
              onChange={(e) => setSuspendMotif(e.target.value)}
              placeholder="Indiquez la raison de la suspension..."
              rows={3}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSuspendModalUser(null)}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={actionLoadingId === suspendModalUser?.id}
              className="px-4 py-1.5 font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
            >
              Confirmer la suspension
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Désactiver */}
      <Modal
        isOpen={!!deactivateModalUser}
        onClose={() => setDeactivateModalUser(null)}
        title="Désactiver définitivement ou prolonger la désactivation"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmDeactivate} className="space-y-4 text-xs">
          <p className="text-slate-600">
            La désactivation révoque immédiatement tous les jetons actifs de{' '}
            <strong className="text-[#123B5D]">
              {deactivateModalUser?.first_name} {deactivateModalUser?.last_name}
            </strong>
            , désactive son compte et bloque tout accès aux dossiers médicaux et endpoints protégés.
          </p>
          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Motif de désactivation *
            </label>
            <textarea
              value={deactivateMotif}
              onChange={(e) => setDeactivateMotif(e.target.value)}
              placeholder="Départ de l'établissement, fin de contrat, motif disciplinaire..."
              required
              rows={3}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDeactivateModalUser(null)}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={actionLoadingId === deactivateModalUser?.id}
              className="px-4 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
            >
              Confirmer la désactivation
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Rejeter */}
      <Modal
        isOpen={!!rejectModalUser}
        onClose={() => setRejectModalUser(null)}
        title="Rejeter la demande d'inscription"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Rejet de la demande pour{' '}
            <strong className="text-[#123B5D]">
              {rejectModalUser?.first_name} {rejectModalUser?.last_name}
            </strong>
            . Un motif est obligatoire.
          </p>
          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Motif du rejet *
            </label>
            <textarea
              value={rejectMotif}
              onChange={(e) => setRejectMotif(e.target.value)}
              placeholder="Justificatifs invalides, matricule introuvable..."
              required
              rows={3}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRejectModalUser(null)}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={actionLoadingId === rejectModalUser?.id}
              className="px-4 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
            >
              Confirmer le rejet
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Historique des Statuts */}
      <Modal
        isOpen={!!historyModalUser}
        onClose={() => setHistoryModalUser(null)}
        title={`Historique des statuts • ${historyModalUser?.first_name} ${historyModalUser?.last_name}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          {loadingHistory ? (
            <LoadingSkeleton type="table" lines={3} />
          ) : statusHistory.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              Aucun changement de statut enregistré pour cet utilisateur.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[#123B5D] font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Auteur</th>
                    <th className="py-2.5 px-3">Transition</th>
                    <th className="py-2.5 px-3">Motif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {statusHistory.map((h) => (
                    <tr key={h.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {formatDateTime(h.created_at)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#123B5D]">
                        {h.changed_by_nom_complet || 'Système'}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="font-mono text-slate-500">{h.ancien_statut || 'INITIAL'}</span>
                        <span className="mx-1 text-slate-400">→</span>
                        <span className="font-mono font-bold text-[#1976D2]">{h.nouveau_statut}</span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={h.motif}>
                        {h.motif || '—'}
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
              onClick={() => setHistoryModalUser(null)}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Fermer
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Création Utilisateur avec SearchableEstablishmentSelect */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Nouveau Compte Professionnel"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Nom d'utilisateur *
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                required
                placeholder="ex: dr_fall"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Mot de passe initial *
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                required
                placeholder="Minimum 8 caractères"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Prénom *
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Nom de famille *
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Rôle Système *
              </label>
              <select
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
              >
                <option value="MEDECIN">Médecin (Accès clinique complet)</option>
                <option value="AGENT">Agent d'accueil (Gestion administrative)</option>
                <option value="DIRECTEUR">Directeur d'établissement (Validation des comptes)</option>
                <option value="ADMIN">Administrateur Technique (Gestion système)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Établissement de rattachement
              </label>
              <SearchableEstablishmentSelect
                establishments={establishments}
                value={formData.etablissement}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, etablissement: e.target.value }))
                }
                allowEmpty={true}
                emptyLabel="-- Aucun (Administration centrale) --"
                required={false}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Spécialité médicale
              </label>
              <input
                type="text"
                name="specialite"
                value={formData.specialite}
                onChange={handleInputChange}
                placeholder="ex: Cardiologie, Urgentiste"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Matricule professionnel
              </label>
              <input
                type="text"
                name="matricule_professionnel"
                value={formData.matricule_professionnel}
                onChange={handleInputChange}
                placeholder="ex: MED-SN-2026-99"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-lg shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Création en cours...' : 'Enregistrer le compte'}
            </button>
          </div>
        </form>
      </Modal>

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

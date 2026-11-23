import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/userService';
import { statsService } from '../../services/statsService';
import { patientService } from '../../services/patientService';
import { careService } from '../../services/careService';
import { consultationService } from '../../services/consultationService';
import { auditService } from '../../services/auditService';
import { StatCard } from '../../components/StatCard';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { Modal } from '../../components/Modal';
import { Badge } from '../../components/Badge';
import { GlobalSearch } from '../../components/GlobalSearch';
import { EmailComposerModal } from '../../components/email/EmailComposerModal';
import { formatDateTime, formatDate, calculateAge } from '../../utils/formatters';
import { matchesSearchText } from '../../utils/searchUtils';
import {
  Building2,
  UserCheck,
  Clock,
  XCircle,
  ShieldAlert,
  Search,
  Check,
  X,
  Mail,
  RefreshCw,
  Eye,
  Ban,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Users,
  ArrowRightLeft,
  Stethoscope,
  ShieldCheck,
  Download,
  RotateCcw,
  UserX,
  History,
  FileText,
  Lock,
} from 'lucide-react';

export const DirectorDashboardPage = () => {
  const { user } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState('professionals'); // 'professionals' | 'patients' | 'transfers' | 'consultations' | 'audit'

  // Global KPIs
  const [stats, setStats] = useState({});
  const [banner, setBanner] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // -------------------------------------------------------------
  // TAB 1: PROFESSIONALS
  // -------------------------------------------------------------
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userStatusFilter, setUserStatusFilter] = useState('ALL');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotalCount, setUserTotalCount] = useState(0);

  // Professional Modals
  const [selectedUser, setSelectedUser] = useState(null);
  const [rejectModalUser, setRejectModalUser] = useState(null);
  const [rejectMotif, setRejectMotif] = useState('');
  const [suspendModalUser, setSuspendModalUser] = useState(null);
  const [suspendMotif, setSuspendMotif] = useState('');
  const [deactivateModalUser, setDeactivateModalUser] = useState(null);
  const [deactivateMotif, setDeactivateMotif] = useState('');
  const [userHistoryModal, setUserHistoryModal] = useState(null);
  const [userStatusHistory, setUserStatusHistory] = useState([]);
  const [loadingUserHistory, setLoadingUserHistory] = useState(false);

  // Email Composer Modal State
  const [emailModalConfig, setEmailModalConfig] = useState({
    isOpen: false,
    recipient: '',
    recipientName: '',
    contextCategory: 'STAFF',
    contextData: {},
  });

  const allowedStaffRecipients = useMemo(() => {
    return (users || [])
      .filter((u) => u.email)
      .map((u) => ({
        email: u.email,
        label: `${u.first_name} ${u.last_name} (${u.role_display || u.role})`,
      }));
  }, [users]);

  const handleOpenEmailModalForUser = (targetUser) => {
    setEmailModalConfig({
      isOpen: true,
      recipient: targetUser?.email || '',
      recipientName: targetUser ? `${targetUser.first_name} ${targetUser.last_name}` : '',
      contextCategory: 'STAFF',
      contextData: {
        recipientName: targetUser ? `${targetUser.first_name} ${targetUser.last_name}` : '',
        etablissementNom: user?.etablissement?.nom || '',
        entityType: 'user',
        entityId: targetUser?.id,
      },
    });
  };

  // -------------------------------------------------------------
  // TAB 2: PATIENTS & PRISES EN CHARGE
  // -------------------------------------------------------------
  const [patients, setPatients] = useState([]);
  const [pecList, setPecList] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [patientSearchTerm, setPatientSearchTerm] = useState('');
  const [selectedPatientDossier, setSelectedPatientDossier] = useState(null);

  // -------------------------------------------------------------
  // TAB 3: DEMANDES DE TRANSFERT
  // -------------------------------------------------------------
  const [transfers, setTransfers] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [transferFilter, setTransferFilter] = useState('ALL');
  const [transferSearchTerm, setTransferSearchTerm] = useState('');
  const [selectedTransfer, setSelectedTransfer] = useState(null);

  // -------------------------------------------------------------
  // TAB 4: CONSULTATIONS & ACTIVITÉS
  // -------------------------------------------------------------
  const [consultations, setConsultations] = useState([]);
  const [loadingConsultations, setLoadingConsultations] = useState(false);
  const [consultationSearchTerm, setConsultationSearchTerm] = useState('');
  const [selectedConsultation, setSelectedConsultation] = useState(null);

  // -------------------------------------------------------------
  // TAB 5: JOURNAL D'AUDIT DE L'ÉTABLISSEMENT
  // -------------------------------------------------------------
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditTotalCount, setAuditTotalCount] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [exportingAudit, setExportingAudit] = useState(false);

  // =============================================================
  // FETCH METHODS
  // =============================================================

  const fetchUsers = useCallback(
    async (query = userSearchTerm, status = userStatusFilter, pageNum = userPage) => {
      try {
        setLoadingUsers(true);
        const params = { page: pageNum };
        if (query.trim()) params.q = query.trim();
        if (status !== 'ALL') params.statut_validation = status;

        const [uList, dashRes] = await Promise.all([
          userService.getList(params),
          statsService.getDashboardStats().catch(() => ({})),
        ]);

        const list = Array.isArray(uList) ? uList : uList.results || [];
        setUsers(list);
        setUserTotalCount(uList.count ?? list.length);
        if (dashRes?.stats) setStats(dashRes.stats);
      } catch (err) {
        console.error('Erreur chargement professionnels:', err);
      } finally {
        setLoadingUsers(false);
      }
    },
    [userSearchTerm, userStatusFilter, userPage]
  );

  const fetchPatientsAndPec = useCallback(async () => {
    try {
      setLoadingPatients(true);
      const [patRes, pecRes] = await Promise.all([
        patientService.search({ scope: 'my_establishment' }),
        careService.getPecList(),
      ]);
      setPatients(Array.isArray(patRes) ? patRes : patRes.results || []);
      setPecList(Array.isArray(pecRes) ? pecRes : pecRes.results || []);
    } catch (err) {
      console.error('Erreur chargement patients/pec:', err);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  const fetchTransfers = useCallback(async () => {
    try {
      setLoadingTransfers(true);
      const res = await careService.getTransfers();
      setTransfers(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error('Erreur chargement transferts:', err);
    } finally {
      setLoadingTransfers(false);
    }
  }, []);

  const fetchConsultations = useCallback(async () => {
    try {
      setLoadingConsultations(true);
      const res = await consultationService.getList();
      setConsultations(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error('Erreur chargement consultations:', err);
    } finally {
      setLoadingConsultations(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(
    async (pageNum = auditPage) => {
      try {
        setLoadingAudit(true);
        const params = { page: pageNum };
        if (auditActionFilter) params.action = auditActionFilter;
        if (auditStartDate) params.date_debut = auditStartDate;
        if (auditEndDate) params.date_fin = auditEndDate;
        if (auditSearchTerm.trim()) params.q = auditSearchTerm.trim();

        const res = await auditService.getLogs(params);
        const list = Array.isArray(res) ? res : res.results || [];
        setAuditLogs(list);
        setAuditTotalCount(res.count ?? list.length);
      } catch (err) {
        console.error('Erreur chargement logs audit:', err);
      } finally {
        setLoadingAudit(false);
      }
    },
    [auditPage, auditActionFilter, auditStartDate, auditEndDate, auditSearchTerm]
  );

  // Initial load
  useEffect(() => {
    fetchUsers('', 'ALL', 1);
  }, []);

  // Fetch when tab changes
  useEffect(() => {
    if (activeMainTab === 'professionals') fetchUsers();
    else if (activeMainTab === 'patients') fetchPatientsAndPec();
    else if (activeMainTab === 'transfers') fetchTransfers();
    else if (activeMainTab === 'consultations') fetchConsultations();
    else if (activeMainTab === 'audit') fetchAuditLogs(1);
  }, [activeMainTab]);

  // =============================================================
  // TAB 1 ACTIONS (PROFESSIONALS)
  // =============================================================

  const handleApprove = async (targetUser) => {
    try {
      setActionLoadingId(targetUser.id);
      setBanner(null);
      const res = await userService.approve(targetUser.id);
      await fetchUsers();
      setBanner({
        type: 'success',
        text: res.message || `Le compte de ${targetUser.first_name} ${targetUser.last_name} a été validé.`,
      });
    } catch (err) {
      console.error(err);
      setBanner({
        type: 'error',
        text: err.response?.data?.detail || 'Erreur lors de la validation.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectMotif.trim() || !rejectModalUser) return;
    try {
      setActionLoadingId(rejectModalUser.id);
      const res = await userService.reject(rejectModalUser.id, rejectMotif.trim());
      setRejectModalUser(null);
      setRejectMotif('');
      await fetchUsers();
      setBanner({
        type: 'success',
        text: res.message || 'La demande a été rejetée avec motif.',
      });
    } catch (err) {
      console.error(err);
      setBanner({
        type: 'error',
        text: err.response?.data?.motif || 'Erreur lors du rejet.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmSuspend = async (e) => {
    e.preventDefault();
    if (!suspendModalUser) return;
    try {
      setActionLoadingId(suspendModalUser.id);
      const res = await userService.suspend(
        suspendModalUser.id,
        suspendMotif.trim() || "Suspension par la direction de l'établissement"
      );
      setSuspendModalUser(null);
      setSuspendMotif('');
      await fetchUsers();
      setBanner({
        type: 'success',
        text: res.message || 'Le compte a été suspendu.',
      });
    } catch (err) {
      console.error(err);
      setBanner({
        type: 'error',
        text: err.response?.data?.detail || 'Erreur lors de la suspension.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDeactivate = async (e) => {
    e.preventDefault();
    if (!deactivateModalUser) return;
    try {
      setActionLoadingId(deactivateModalUser.id);
      const res = await userService.deactivate(
        deactivateModalUser.id,
        deactivateMotif.trim() || "Désactivation par la direction de l'établissement"
      );
      setDeactivateModalUser(null);
      setDeactivateMotif('');
      await fetchUsers();
      setBanner({
        type: 'success',
        text: res.message || 'Le compte a été désactivé et ses sessions révoquées.',
      });
    } catch (err) {
      console.error(err);
      setBanner({
        type: 'error',
        text: err.response?.data?.detail || 'Erreur lors de la désactivation.',
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReactivate = async (targetUser) => {
    try {
      setActionLoadingId(targetUser.id);
      const res = await userService.reactivate(targetUser.id);
      await fetchUsers();
      setBanner({
        type: 'success',
        text: res.message || 'Le compte a été réactivé avec succès.',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleOpenUserHistory = async (targetUser) => {
    setUserHistoryModal(targetUser);
    setLoadingUserHistory(true);
    setUserStatusHistory([]);
    try {
      const hist = await userService.getStatusHistory(targetUser.id);
      setUserStatusHistory(Array.isArray(hist) ? hist : []);
    } catch (err) {
      console.error(err);
      alert("Impossible de charger l'historique des statuts.");
    } finally {
      setLoadingUserHistory(false);
    }
  };

  // =============================================================
  // TAB 5 ACTIONS (AUDIT EXPORT)
  // =============================================================

  const handleExportAuditCsv = async () => {
    try {
      setExportingAudit(true);
      const params = {};
      if (auditActionFilter) params.action = auditActionFilter;
      if (auditStartDate) params.date_debut = auditStartDate;
      if (auditEndDate) params.date_fin = auditEndDate;
      if (auditSearchTerm.trim()) params.q = auditSearchTerm.trim();

      const blob = await auditService.exportCsv(params);
      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_${user?.etablissement?.code || 'etablissement'}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Erreur export CSV:', err);
      alert("Erreur lors de l'export CSV du journal d'audit.");
    } finally {
      setExportingAudit(false);
    }
  };

  // =============================================================
  // FILTERED DATA
  // =============================================================

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.role === 'DIRECTEUR' && u.id === user?.id) return false;
      if (userStatusFilter !== 'ALL' && u.statut_validation !== userStatusFilter) return false;
      if (!userSearchTerm.trim()) return true;
      return matchesSearchText(u, userSearchTerm, [
        'first_name',
        'last_name',
        'email',
        'matricule_professionnel',
        'specialite',
      ]);
    });
  }, [users, user, userStatusFilter, userSearchTerm]);

  const filteredPatients = useMemo(() => {
    if (!patientSearchTerm.trim()) return patients;
    return patients.filter((p) =>
      matchesSearchText(p, patientSearchTerm, [
        'nom',
        'prenom',
        'medtransfer_id',
        'numero_identification_nationale',
        'telephone',
        'ville',
      ])
    );
  }, [patients, patientSearchTerm]);

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      if (transferFilter === 'EMIS' && t.etablissement_origine !== user?.etablissement?.id) return false;
      if (transferFilter === 'RECUS' && t.etablissement_destination !== user?.etablissement?.id) return false;
      if (transferFilter === 'EN_ATTENTE' && t.statut !== 'EN_ATTENTE') return false;
      if (transferFilter === 'ACCEPTE' && t.statut !== 'ACCEPTE') return false;
      if (transferFilter === 'REFUSE' && t.statut !== 'REFUSE') return false;
      if (!transferSearchTerm.trim()) return true;
      return matchesSearchText(t, transferSearchTerm, [
        'patient_nom',
        'patient_medtransfer_id',
        'etablissement_origine_nom',
        'etablissement_destination_nom',
        'motif_transfert',
        'priorite',
      ]);
    });
  }, [transfers, user, transferFilter, transferSearchTerm]);

  const filteredConsultations = useMemo(() => {
    if (!consultationSearchTerm.trim()) return consultations;
    return consultations.filter((c) =>
      matchesSearchText(c, consultationSearchTerm, [
        'patient_nom',
        'patient_medtransfer_id',
        'medecin_nom',
        'diagnostic_principal',
        'motif',
      ])
    );
  }, [consultations, consultationSearchTerm]);

  const pendingCount = users.filter((u) => u.statut_validation === 'PENDING').length;

  return (
    <div className="space-y-6 min-w-0">
      {/* Top Establishment Director Banner */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-[#123B5D] to-indigo-900 rounded-2xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs uppercase font-bold tracking-wider text-sky-300 block">
            Direction Institutionnelle & Supervision Hospitalière
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            {user?.etablissement?.nom || "Direction d'Établissement"}
          </h2>
          <p className="text-xs sm:text-sm text-sky-100 max-w-2xl">
            Supervision exclusive des professionnels, des admissions, des prises en charge et de
            l'audit de votre structure hospitalière.
          </p>
        </div>
        {user?.etablissement && (
          <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xs shrink-0">
            <span className="text-sky-200 block text-[10px] uppercase font-semibold">Structure de rattachement</span>
            <span className="font-bold text-sm font-mono">
              {user.etablissement.code} — {user.etablissement.ville}
            </span>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Demandes en attente"
          value={stats.demandes_en_attente ?? pendingCount}
          subtitle="Habilitations à examiner"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Praticiens Validés"
          value={stats.comptes_valides ?? users.filter((u) => u.statut_validation === 'APPROVED' && u.role !== 'DIRECTEUR').length}
          subtitle="Professionnels habilités"
          icon={UserCheck}
          color="emerald"
        />
        <StatCard
          title="Patients de la structure"
          value={stats.patients_mon_etablissement ?? patients.length}
          subtitle="Pris en charge ou créés"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Transferts enregistrés"
          value={transfers.length}
          subtitle="Flux émis et reçus"
          icon={ArrowRightLeft}
          color="purple"
        />
      </div>

      {/* Feedback Banner */}
      {banner && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {banner.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {[
          { key: 'professionals', label: `Professionnels de santé (${users.length})`, icon: UserCheck },
          { key: 'patients', label: `Patients & Prises en charge (${patients.length})`, icon: Users },
          { key: 'transfers', label: `Transferts (${transfers.length})`, icon: ArrowRightLeft },
          { key: 'consultations', label: `Consultations & Activité (${consultations.length})`, icon: Stethoscope },
          { key: 'audit', label: `Journal d'Audit (${auditTotalCount})`, icon: ShieldCheck },
        ].map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveMainTab(tab.key)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeMainTab === tab.key
                  ? 'bg-[#123B5D] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <IconComponent className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* SECTION 1: PROFESSIONALS TAB                              */}
      {/* ========================================================= */}
      {activeMainTab === 'professionals' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'ALL', label: 'Tous' },
                { key: 'PENDING', label: `En attente (${pendingCount})` },
                { key: 'APPROVED', label: 'Validés' },
                { key: 'SUSPENDED', label: 'Suspendus' },
                { key: 'DEACTIVATED', label: 'Désactivés' },
                { key: 'REJECTED', label: 'Refusés' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => {
                    setUserStatusFilter(t.key);
                    fetchUsers(userSearchTerm, t.key, 1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    userStatusFilter === t.key
                      ? 'bg-[#1976D2] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="w-full md:w-80">
              <GlobalSearch
                value={userSearchTerm}
                onSearch={(q) => {
                  setUserSearchTerm(q);
                  fetchUsers(q, userStatusFilter, 1);
                }}
                onClear={() => {
                  setUserSearchTerm('');
                  fetchUsers('', userStatusFilter, 1);
                }}
                loading={loadingUsers}
                placeholder="Rechercher praticien, e-mail, matricule..."
                debounceMs={300}
              />
            </div>
          </div>

          {loadingUsers ? (
            <LoadingSkeleton type="table" lines={5} />
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[#123B5D] font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Professionnel</th>
                    <th className="py-3.5 px-4">Rôle & Spécialité</th>
                    <th className="py-3.5 px-4">Matricule</th>
                    <th className="py-3.5 px-4">Statut</th>
                    <th className="py-3.5 px-4 text-right">Actions Direction</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-400">
                        Aucun professionnel trouvé dans votre établissement.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-[#123B5D] block">
                            {u.first_name} {u.last_name}
                          </span>
                          <span className="text-[11px] text-slate-400 block font-mono">
                            {u.email}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge status={u.role}>{u.role_display || u.role}</Badge>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            {u.specialite || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-semibold text-slate-700">
                          {u.matricule_professionnel || 'Sans matricule'}
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge status={u.statut_validation}>
                            {u.statut_validation_display || u.statut_validation}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSelectedUser(u)}
                              className="p-1.5 text-slate-500 hover:text-[#123B5D] hover:bg-slate-100 rounded-lg border border-slate-200"
                              title="Détails du compte et justificatifs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenUserHistory(u)}
                              className="p-1.5 text-slate-500 hover:text-[#123B5D] hover:bg-slate-100 rounded-lg border border-slate-200"
                              title="Historique des statuts"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEmailModalForUser(u)}
                              className="p-1.5 text-slate-500 hover:text-[#1976D2] hover:bg-sky-50 rounded-lg border border-slate-200 transition-colors"
                              title="Préparer un e-mail à ce professionnel"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>

                            {u.statut_validation === 'PENDING' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(u)}
                                  disabled={actionLoadingId === u.id}
                                  className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
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
                                  Refuser
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

                            {(u.statut_validation === 'SUSPENDED' || u.statut_validation === 'DEACTIVATED' || u.statut_validation === 'REJECTED') && (
                              <button
                                type="button"
                                onClick={() => handleReactivate(u)}
                                disabled={actionLoadingId === u.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg"
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
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: PATIENTS & PRISES EN CHARGE TAB                */}
      {/* ========================================================= */}
      {activeMainTab === 'patients' && (
        <div className="space-y-6">
          <div className="bg-sky-50 border border-sky-200 p-4 rounded-xl text-xs text-sky-900 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Consultation en lecture seule institutionnelle</strong>
              <span>
                Conformément aux règles déontologiques et de sécurité, la direction dispose d'un accès
                de contrôle administratif et institutionnel sans droit d'acte médical, de prescription
                ou de diagnostic.
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm items-center justify-between">
            <div className="w-full sm:w-96">
              <GlobalSearch
                value={patientSearchTerm}
                onSearch={setPatientSearchTerm}
                onClear={() => setPatientSearchTerm('')}
                loading={loadingPatients}
                placeholder="Rechercher par nom, identifiant, NIN..."
                debounceMs={300}
              />
            </div>
            <span className="text-xs text-slate-500">
              Total : <strong>{filteredPatients.length}</strong> patients rattachés à la structure
            </span>
          </div>

          {loadingPatients ? (
            <LoadingSkeleton type="table" lines={5} />
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[#123B5D] font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Identifiant MedTransfer</th>
                    <th className="py-3.5 px-4">Patient</th>
                    <th className="py-3.5 px-4">Âge / Naissance</th>
                    <th className="py-3.5 px-4">Statut Identité</th>
                    <th className="py-3.5 px-4 text-right">Dossier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPatients.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Aucun patient associé à votre établissement.
                      </td>
                    </tr>
                  ) : (
                    filteredPatients.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#1976D2]">
                          {p.medtransfer_id}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-[#123B5D] block">
                            {p.nom.toUpperCase()} {p.prenom}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {p.sexe === 'M' ? 'Masculin' : 'Féminin'} • {p.ville || '—'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {calculateAge(p.date_naissance)} ({formatDate(p.date_naissance)})
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge status={p.status_identite}>{p.status_identite_display}</Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedPatientDossier(p)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#123B5D] bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-200 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#1976D2]" />
                            Consulter dossier
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 3: TRANSFERS TAB                                  */}
      {/* ========================================================= */}
      {activeMainTab === 'transfers' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <strong className="block font-bold">Règle de gestion des transferts</strong>
              <span>
                L'acceptation ou le refus administratif des demandes de transfert reçues est exclusivement
                réservé aux <strong>agents d'accueil</strong> du bureau des entrées. La direction assure
                le suivi institutionnel et le reporting des flux.
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'ALL', label: 'Tous les transferts' },
                { key: 'RECUS', label: 'Reçus' },
                { key: 'EMIS', label: 'Émis' },
                { key: 'EN_ATTENTE', label: 'En attente' },
                { key: 'ACCEPTE', label: 'Acceptés' },
                { key: 'REFUSE', label: 'Refusés' },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setTransferFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    transferFilter === f.key
                      ? 'bg-[#1976D2] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="w-full md:w-80">
              <GlobalSearch
                value={transferSearchTerm}
                onSearch={setTransferSearchTerm}
                onClear={() => setTransferSearchTerm('')}
                loading={loadingTransfers}
                placeholder="Rechercher patient, établissement, motif..."
                debounceMs={300}
              />
            </div>
          </div>

          {loadingTransfers ? (
            <LoadingSkeleton type="table" lines={5} />
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[#123B5D] font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Sens</th>
                    <th className="py-3.5 px-4">Patient</th>
                    <th className="py-3.5 px-4">Origine / Destination</th>
                    <th className="py-3.5 px-4">Priorité</th>
                    <th className="py-3.5 px-4">Statut</th>
                    <th className="py-3.5 px-4 text-right">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransfers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        Aucun transfert enregistré.
                      </td>
                    </tr>
                  ) : (
                    filteredTransfers.map((t) => {
                      const isIncoming = t.etablissement_destination === user?.etablissement?.id;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                            {formatDateTime(t.created_at)}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                isIncoming
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {isIncoming ? 'Entrant (Reçu)' : 'Sortant (Émis)'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-[#123B5D] block">{t.patient_nom}</span>
                            <span className="font-mono text-[10px] text-slate-400 block">
                              {t.patient_medtransfer_id}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-700">
                            <span className="block">{t.etablissement_origine_nom} → {t.etablissement_destination_nom}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-rose-600 uppercase text-[10px]">{t.priorite}</span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge status={t.statut}>{t.statut_display || t.statut}</Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedTransfer(t)}
                              className="p-1.5 text-slate-500 hover:text-[#123B5D] hover:bg-slate-100 rounded-lg border border-slate-200"
                              title="Voir les détails"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 4: CONSULTATIONS TAB                              */}
      {/* ========================================================= */}
      {activeMainTab === 'consultations' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm items-center justify-between">
            <div className="w-full sm:w-96">
              <GlobalSearch
                value={consultationSearchTerm}
                onSearch={setConsultationSearchTerm}
                onClear={() => setConsultationSearchTerm('')}
                loading={loadingConsultations}
                placeholder="Rechercher par médecin, patient, diagnostic..."
                debounceMs={300}
              />
            </div>
            <span className="text-xs text-slate-500">
              Total : <strong>{filteredConsultations.length}</strong> consultations dans l'établissement
            </span>
          </div>

          {loadingConsultations ? (
            <LoadingSkeleton type="table" lines={5} />
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[#123B5D] font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Praticien</th>
                    <th className="py-3.5 px-4">Patient</th>
                    <th className="py-3.5 px-4">Motif / Diagnostic</th>
                    <th className="py-3.5 px-4 text-right">Détails</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredConsultations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-400">
                        Aucune consultation enregistrée dans l'établissement.
                      </td>
                    </tr>
                  ) : (
                    filteredConsultations.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {formatDateTime(c.date_consultation || c.created_at)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#123B5D]">
                          Dr {c.medecin_nom || c.medecin}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-bold text-slate-800 block">{c.patient_nom || 'Patient'}</span>
                          <span className="font-mono text-[10px] text-slate-400 block">{c.patient_medtransfer_id}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 max-w-xs truncate">
                          {c.diagnostic_principal || c.motif_consultation || 'Consultation standard'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedConsultation(c)}
                            className="p-1.5 text-slate-500 hover:text-[#123B5D] hover:bg-slate-100 rounded-lg border border-slate-200"
                            title="Consulter le résumé"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 5: AUDIT LOGS TAB                                 */}
      {/* ========================================================= */}
      {activeMainTab === 'audit' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-[#123B5D]">Journal d'Audit de l'Établissement</h3>
                <p className="text-xs text-slate-500">
                  Traçabilité immuable des accès et opérations réalisés dans votre établissement.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportAuditCsv}
                disabled={exportingAudit}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                {exportingAudit ? 'Export en cours...' : 'Exporter CSV'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Action</label>
                <select
                  value={auditActionFilter}
                  onChange={(e) => setAuditActionFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                >
                  <option value="">Toutes les actions</option>
                  <option value="CONSULTATION_DOSSIER">Consultation de dossier</option>
                  <option value="ACCES_URGENCE">Accès d'urgence</option>
                  <option value="CREATION_CONSULTATION">Création consultation</option>
                  <option value="CREATION_PATIENT">Création patient</option>
                  <option value="MODIFICATION_PATIENT">Modification patient</option>
                  <option value="PRISE_EN_CHARGE_CREEE">Prise en charge ouverte</option>
                  <option value="TRANSFERT_ACCEPTE">Transfert accepté</option>
                  <option value="TRANSFERT_REFUSE">Transfert refusé</option>
                  <option value="USER_APPROVED">Utilisateur validé</option>
                  <option value="USER_SUSPENDED">Utilisateur suspendu</option>
                  <option value="USER_DEACTIVATED">Utilisateur désactivé</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Date début</label>
                <input
                  type="date"
                  value={auditStartDate}
                  onChange={(e) => setAuditStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Date fin</label>
                <input
                  type="date"
                  value={auditEndDate}
                  onChange={(e) => setAuditEndDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Recherche</label>
                <input
                  type="text"
                  value={auditSearchTerm}
                  onChange={(e) => setAuditSearchTerm(e.target.value)}
                  placeholder="Utilisateur, cible..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
            </div>
          </div>

          {loadingAudit ? (
            <LoadingSkeleton type="table" lines={5} />
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[#123B5D] font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3.5 px-4">Horodatage</th>
                    <th className="py-3.5 px-4">Utilisateur</th>
                    <th className="py-3.5 px-4">Action</th>
                    <th className="py-3.5 px-4">Cible</th>
                    <th className="py-3.5 px-4">Statut</th>
                    <th className="py-3.5 px-4">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        Aucun journal d'audit correspondant aux filtres.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                          {formatDateTime(l.date_action || l.created_at)}
                        </td>
                        <td className="py-2.5 px-4 font-semibold text-[#123B5D]">
                          {l.utilisateur_nom || l.utilisateur_details?.nom_complet || 'Système'}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] font-bold text-sky-800">
                          {l.action_display || l.action}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {l.entite_type} {l.entite_id ? `#${l.entite_id}` : ''}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                              l.statut === 'SUCCES'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {l.statut}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate" title={l.description}>
                          {l.description || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {auditTotalCount > 20 && (
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
                  <span>
                    Total : <strong>{auditTotalCount}</strong> entrées (Page {auditPage} sur {Math.ceil(auditTotalCount / 20)})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={auditPage <= 1}
                      onClick={() => {
                        const p = auditPage - 1;
                        setAuditPage(p);
                        fetchAuditLogs(p);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                    >
                      Précédent
                    </button>
                    <button
                      type="button"
                      disabled={auditPage >= Math.ceil(auditTotalCount / 20)}
                      onClick={() => {
                        const p = auditPage + 1;
                        setAuditPage(p);
                        fetchAuditLogs(p);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ALL MODALS                                                */}
      {/* ========================================================= */}

      {/* Modal Détails Professionnel */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title="Dossier Professionnel & Justificatifs"
        maxWidth="max-w-xl"
      >
        {selectedUser && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Nom complet</span>
                <span className="font-bold text-[#123B5D] text-sm">
                  {selectedUser.first_name} {selectedUser.last_name}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Fonction</span>
                <Badge status={selectedUser.role}>{selectedUser.role_display || selectedUser.role}</Badge>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Adresse e-mail</span>
                <span className="font-mono text-slate-700">{selectedUser.email}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Téléphone</span>
                <span className="text-slate-700">{selectedUser.telephone || '—'}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Matricule pro</span>
                <span className="font-mono font-semibold text-[#123B5D]">
                  {selectedUser.matricule_professionnel || 'Non renseigné'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Spécialité</span>
                <span className="text-slate-700">{selectedUser.specialite || '—'}</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Justificatifs professionnels déclarés
              </span>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                {selectedUser.justificatif || 'Aucun détail complémentaire fourni.'}
              </p>
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleOpenEmailModalForUser(selectedUser)}
                className="px-3.5 py-1.5 font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-lg text-xs flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Contacter par e-mail</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-1.5 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Historique des Statuts Professionnels */}
      <Modal
        isOpen={!!userHistoryModal}
        onClose={() => setUserHistoryModal(null)}
        title={`Historique des statuts • ${userHistoryModal?.first_name} ${userHistoryModal?.last_name}`}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4 text-xs">
          {loadingUserHistory ? (
            <LoadingSkeleton type="table" lines={3} />
          ) : userStatusHistory.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              Aucun changement de statut enregistré.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[#123B5D] font-bold border-b border-slate-200">
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Auteur</th>
                    <th className="py-2 px-3">Statuts</th>
                    <th className="py-2 px-3">Motif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userStatusHistory.map((h) => (
                    <tr key={h.id}>
                      <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                        {formatDateTime(h.created_at)}
                      </td>
                      <td className="py-2 px-3 font-semibold text-[#123B5D]">
                        {h.changed_by_nom_complet || 'Système'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="font-mono text-slate-400">{h.ancien_statut || 'INITIAL'}</span>
                        <span className="mx-1">→</span>
                        <span className="font-mono font-bold text-[#1976D2]">{h.nouveau_statut}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 max-w-xs truncate" title={h.motif}>
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
              onClick={() => setUserHistoryModal(null)}
              className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Fermer
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Refus Utilisateur */}
      <Modal
        isOpen={!!rejectModalUser}
        onClose={() => setRejectModalUser(null)}
        title="Refuser la demande d'inscription"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Indiquez le motif de refus pour{' '}
            <strong className="text-[#123B5D]">
              {rejectModalUser?.first_name} {rejectModalUser?.last_name}
            </strong>
            .
          </p>
          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Motif de refus *
            </label>
            <textarea
              rows={3}
              required
              value={rejectMotif}
              onChange={(e) => setRejectMotif(e.target.value)}
              placeholder="Ex : Matricule non vérifiable auprès de la direction..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-rose-500"
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
              className="px-4 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
            >
              Confirmer le refus
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Suspension Utilisateur */}
      <Modal
        isOpen={!!suspendModalUser}
        onClose={() => setSuspendModalUser(null)}
        title="Suspendre le compte professionnel"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmSuspend} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Suspendre temporairement l'accès de{' '}
            <strong className="text-[#123B5D]">
              {suspendModalUser?.first_name} {suspendModalUser?.last_name}
            </strong>
            .
          </p>
          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Motif de suspension
            </label>
            <textarea
              rows={3}
              value={suspendMotif}
              onChange={(e) => setSuspendMotif(e.target.value)}
              placeholder="Ex : Mesure conservatoire, arrêt de mission..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-amber-500"
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
              className="px-4 py-1.5 font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm"
            >
              Suspendre
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Désactivation Utilisateur */}
      <Modal
        isOpen={!!deactivateModalUser}
        onClose={() => setDeactivateModalUser(null)}
        title="Désactiver le compte professionnel"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmDeactivate} className="space-y-4 text-xs">
          <p className="text-slate-600">
            La désactivation révoque immédiatement tous les jetons actifs de{' '}
            <strong className="text-[#123B5D]">
              {deactivateModalUser?.first_name} {deactivateModalUser?.last_name}
            </strong>{' '}
            et bloque l'accès aux endpoints protégés.
          </p>
          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Motif de désactivation *
            </label>
            <textarea
              rows={3}
              required
              value={deactivateMotif}
              onChange={(e) => setDeactivateMotif(e.target.value)}
              placeholder="Ex : Mutation, fin de contrat d'exercice..."
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-rose-500"
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
              className="px-4 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
            >
              Désactiver
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Dossier Patient Lecture Seule */}
      <Modal
        isOpen={!!selectedPatientDossier}
        onClose={() => setSelectedPatientDossier(null)}
        title={`Dossier Patient • Lecture Seule • ${selectedPatientDossier?.nom} ${selectedPatientDossier?.prenom}`}
        maxWidth="max-w-2xl"
      >
        {selectedPatientDossier && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-sky-800 block">Identifiant MedTransfer Permanent</span>
                <span className="font-mono font-bold text-[#123B5D] text-sm">{selectedPatientDossier.medtransfer_id}</span>
              </div>
              <Badge status={selectedPatientDossier.status_identite}>{selectedPatientDossier.status_identite_display}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Nom & Prénom</span>
                <span className="font-bold text-slate-800">{selectedPatientDossier.nom} {selectedPatientDossier.prenom}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Date de naissance</span>
                <span className="font-bold text-slate-800">{formatDate(selectedPatientDossier.date_naissance)} ({calculateAge(selectedPatientDossier.date_naissance)})</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">NIN / CNI</span>
                <span className="font-mono text-slate-800">{selectedPatientDossier.numero_identification_nationale || 'Non renseigné'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Groupe Sanguin</span>
                <span className="font-bold text-rose-700">{selectedPatientDossier.groupe_sanguin || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Téléphone</span>
                <span className="font-mono text-slate-800">{selectedPatientDossier.telephone || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Ville</span>
                <span className="text-slate-800">{selectedPatientDossier.ville || '—'}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-slate-600 flex items-center gap-2">
              <Lock className="w-4 h-4 text-slate-500 shrink-0" />
              <span>Accès institutionnel : les antécédents médicaux et prescriptions sont protégés par le secret médical.</span>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedPatientDossier(null)}
                className="px-4 py-1.5 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Détails Transfert */}
      <Modal
        isOpen={!!selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        title="Détails du Transfert Hospitalier"
        maxWidth="max-w-xl"
      >
        {selectedTransfer && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Patient</span>
                <span className="font-bold text-[#123B5D] text-sm block">{selectedTransfer.patient_nom}</span>
                <span className="font-mono text-slate-500">{selectedTransfer.patient_medtransfer_id}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Statut & Priorité</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-bold text-rose-600 uppercase">{selectedTransfer.priorite}</span>
                  <Badge status={selectedTransfer.statut}>{selectedTransfer.statut_display || selectedTransfer.statut}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Établissement Émetteur</span>
                <span className="font-medium text-slate-700">{selectedTransfer.etablissement_origine_nom} (Dr {selectedTransfer.medecin_demandeur_nom})</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Établissement Destinataire</span>
                <span className="font-medium text-slate-700">{selectedTransfer.etablissement_destination_nom}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Motif du Transfert</span>
                <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 whitespace-pre-wrap mt-0.5">
                  {selectedTransfer.motif_transfert || 'Non renseigné'}
                </p>
              </div>
              {selectedTransfer.motif_refus && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-900">
                  <span className="font-bold block text-[10px] uppercase text-rose-700">Motif du Refus</span>
                  <p className="mt-0.5">{selectedTransfer.motif_refus}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedTransfer(null)}
                className="px-4 py-1.5 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Consultation Détail */}
      <Modal
        isOpen={!!selectedConsultation}
        onClose={() => setSelectedConsultation(null)}
        title="Consultation Clinique • Lecture Seule"
        maxWidth="max-w-xl"
      >
        {selectedConsultation && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[#123B5D]">Patient : {selectedConsultation.patient_nom}</span>
                <span className="text-slate-500">{formatDateTime(selectedConsultation.date_consultation || selectedConsultation.created_at)}</span>
              </div>
              <span className="text-slate-600 block">Praticien : Dr {selectedConsultation.medecin_nom || selectedConsultation.medecin}</span>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Diagnostic Principal</span>
              <p className="p-3 bg-sky-50 border border-sky-100 rounded-lg font-semibold text-[#123B5D] mt-0.5">
                {selectedConsultation.diagnostic_principal || 'Non renseigné'}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Motif de consultation</span>
              <p className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 whitespace-pre-wrap mt-0.5">
                {selectedConsultation.motif_consultation || 'Consultation de routine'}
              </p>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedConsultation(null)}
                className="px-4 py-1.5 font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de composition d'email */}
      <EmailComposerModal
        isOpen={emailModalConfig.isOpen}
        onClose={() => setEmailModalConfig(prev => ({ ...prev, isOpen: false }))}
        initialRecipient={emailModalConfig.recipient}
        initialRecipientName={emailModalConfig.recipientName}
        allowedRecipients={allowedStaffRecipients}
        contextCategory={emailModalConfig.contextCategory}
        contextData={emailModalConfig.contextData}
      />
    </div>
  );
};

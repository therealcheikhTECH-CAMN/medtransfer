import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { statsService } from '../../services/statsService';
import { careService } from '../../services/careService';
import { StatCard } from '../../components/StatCard';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { Badge } from '../../components/Badge';
import { formatDateTime } from '../../utils/formatters';
import {
  FileText,
  Activity,
  ArrowRightLeft,
  Bell,
  Search,
  AlertTriangle,
  Stethoscope,
  ArrowRight,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export const DoctorDashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await statsService.getDashboardStats();
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleAcceptTransfer = async (transferId) => {
    const motif = window.prompt("Motif d'acceptation du transfert :", "Transfert accepté et lit réservé.");
    if (!motif) return;

    try {
      await careService.acceptTransfer(transferId, motif);
      setActionMessage("Transfert accepté avec succès. La prise en charge a été transférée !");
      fetchDashboard();
      setTimeout(() => setActionMessage(''), 5000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'acceptation du transfert.");
    }
  };

  const handleRejectTransfer = async (transferId) => {
    const motif = window.prompt("Motif de refus :", "Capacité d'accueil insuffisante.");
    if (!motif) return;

    try {
      await careService.rejectTransfer(transferId, motif);
      setActionMessage("Transfert refusé.");
      fetchDashboard();
      setTimeout(() => setActionMessage(''), 5000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors du refus.");
    }
  };

  if (loading) return <LoadingSkeleton lines={6} />;

  const stats = data?.stats || {};
  const consultations = data?.dernieres_consultations || [];
  const transferts = data?.transferts_entrants_urgents || [];

  return (
    <div className="space-y-6 min-w-0">
      {/* Banner */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-[#123B5D] to-[#1976D2] rounded-2xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 min-w-0">
        <div className="min-w-0 flex-1 space-y-1">
          <span className="text-xs uppercase font-bold tracking-wider text-sky-200 block">
            Espace Praticien Hospitalier
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white break-words">
            Tableau de bord Clinique
          </h2>
          <p className="text-xs sm:text-sm text-sky-100 max-w-2xl leading-relaxed">
            Accès aux dossiers partagés, historique chronologique, gestion des transferts et urgences vitales.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 w-full md:w-auto">
          <Link
            to="/doctor/patients"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#123B5D] bg-white hover:bg-slate-50 rounded-xl shadow-sm transition-all flex-1 sm:flex-initial whitespace-nowrap min-h-[40px]"
          >
            <Search className="w-4 h-4 text-[#1976D2] shrink-0" />
            <span>Consulter un dossier</span>
          </Link>
          <Link
            to="/doctor/transfers"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-600 rounded-xl shadow-sm transition-all flex-1 sm:flex-initial whitespace-nowrap min-h-[40px]"
          >
            <ArrowRightLeft className="w-4 h-4 shrink-0" />
            <span>Transferts</span>
          </Link>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="truncate">{actionMessage}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-w-0">
        <StatCard
          title="Mes Consultations"
          value={stats.mes_consultations}
          subtitle="Actes réalisés personnellement"
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Prises en Charge Actives"
          value={stats.prises_en_charge_actives_mon_etab}
          subtitle="Suivis dans mon établissement"
          icon={Activity}
          color="emerald"
        />
        <StatCard
          title="Transferts Reçus en Attente"
          value={stats.transferts_en_attente_recus}
          subtitle="Demandes entrantes à traiter"
          icon={ArrowRightLeft}
          color="amber"
        />
        <StatCard
          title="Alertes & Notifications"
          value={stats.notifications_non_lues}
          subtitle="Urgences et évènements"
          icon={Bell}
          color={stats.notifications_non_lues > 0 ? "rose" : "purple"}
        />
      </div>

      {/* Grid: Pending Transfers + Recent Consultations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incoming Transfers Requiring Action */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#123B5D] uppercase tracking-wider flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-amber-600" />
              Transferts Entrants en Attente
            </h3>
            <Link to="/doctor/transfers" className="text-xs text-[#1976D2] font-semibold hover:underline">
              Voir tout
            </Link>
          </div>

          <div className="space-y-3">
            {transferts.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Aucune demande de transfert en attente de réponse.
              </div>
            ) : (
              transferts.map(t => (
                <div key={t.id} className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#123B5D] text-sm">
                      {t.patient__nom} {t.patient__prenom}
                    </span>
                    <Badge status={t.priorite}>{t.priorite}</Badge>
                  </div>

                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    <strong className="text-slate-800">Établissement émetteur :</strong> {t.etablissement_origine__nom}
                  </p>
                  <p className="text-slate-700 text-[11px] leading-relaxed line-clamp-2">
                    <strong className="text-slate-800">Motif :</strong> {t.motif_transfert}
                  </p>

                  <div className="flex justify-end gap-2 pt-2 border-t border-amber-200/60">
                    <button
                      onClick={() => handleRejectTransfer(t.id)}
                      className="px-3 py-1 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Refuser
                    </button>
                    <button
                      onClick={() => handleAcceptTransfer(t.id)}
                      className="px-3 py-1 bg-[#16A34A] hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Accepter le transfert
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Consultations */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#123B5D] uppercase tracking-wider flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-[#1976D2]" />
              Derniers Actes Médicaux Enregistrés
            </h3>
            <Link to="/doctor/patients" className="text-xs text-[#1976D2] font-semibold hover:underline">
              Rechercher patient
            </Link>
          </div>

          <div className="space-y-3">
            {consultations.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Aucune consultation récente consigneée.
              </div>
            ) : (
              consultations.map(c => (
                <div key={c.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs hover:bg-slate-100/60 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-[#123B5D]">
                      {c.dossier__patient__nom} {c.dossier__patient__prenom}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {formatDateTime(c.date_consultation)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] text-[#1976D2] bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 font-bold">
                      {c.dossier__patient__medtransfer_id}
                    </span>
                    {c.is_emergency && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                        Urgence
                      </span>
                    )}
                  </div>

                  <p className="text-slate-600 text-[11px] truncate">
                    <strong>Motif :</strong> {c.motif}
                  </p>
                  {c.diagnostic && (
                    <p className="text-slate-800 text-[11px] font-medium truncate mt-0.5">
                      <strong>Diagnostic :</strong> {c.diagnostic}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

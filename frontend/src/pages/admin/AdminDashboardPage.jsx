import React, { useState, useEffect } from 'react';
import { statsService } from '../../services/statsService';
import { StatCard } from '../../components/StatCard';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { formatDateTime, getStatusBadgeStyle } from '../../utils/formatters';
import {
  Building2,
  Users,
  UserCheck,
  FileText,
  Activity,
  ArrowRightLeft,
  AlertTriangle,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts';

export const AdminDashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await statsService.getDashboardStats();
        setData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <LoadingSkeleton lines={6} />;

  const stats = data?.stats || {};
  const activite = data?.activite_recente || [];

  // Données synthétiques pour le graphique de répartition
  const chartData = [
    { name: 'Patients', count: stats.total_patients || 0 },
    { name: 'Consultations', count: stats.total_consultations || 0 },
    { name: 'Prises en charge', count: stats.total_prises_en_charge_actives || 0 },
    { name: 'Transferts', count: stats.total_transferts || 0 },
    { name: 'Urgences', count: stats.total_interventions_urgence || 0 },
  ];

  return (
    <div className="space-y-6 min-w-0">
      {/* Top Banner */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-[#123B5D] to-[#1976D2] rounded-2xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 min-w-0">
        <div className="min-w-0 flex-1 space-y-1">
          <span className="text-xs uppercase font-bold tracking-wider text-sky-200 block">
            Supervision Système & Sécurité
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white break-words">
            Tableau de bord Administrateur
          </h2>
          <p className="text-xs sm:text-sm text-sky-100 max-w-2xl leading-relaxed">
            Vue d'ensemble opérationnelle de l'infrastructure centralisée MEDTRANSFER.
            Les données médicales cliniques détaillées sont protégées et isolées.
          </p>
        </div>
        <div className="px-4 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xs text-white shrink-0">
          <span className="text-slate-300 block text-[10px] uppercase font-semibold">Base de données :</span>
          <span className="font-bold">PostgreSQL Centralisée</span>
        </div>
      </div>

      {/* 8 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-w-0">
        <StatCard
          title="Établissements"
          value={stats.total_etablissements}
          subtitle="Structures connectées"
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="Utilisateurs"
          value={stats.total_utilisateurs}
          subtitle="Comptes soignants & agents"
          icon={Users}
          color="purple"
        />
        <StatCard
          title="Patients Centralisés"
          value={stats.total_patients}
          subtitle="Identifiants uniques nationaux"
          icon={UserCheck}
          color="emerald"
        />
        <StatCard
          title="Actes & Consultations"
          value={stats.total_consultations}
          subtitle="Historique cumulé"
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Prises en Charge Actives"
          value={stats.total_prises_en_charge_actives}
          subtitle="Suivis de référence en cours"
          icon={Activity}
          color="emerald"
        />
        <StatCard
          title="Transferts Enregistrés"
          value={stats.total_transferts}
          subtitle="Flux inter-hôpitaux"
          icon={ArrowRightLeft}
          color="amber"
        />
        <StatCard
          title="Interventions Urgence"
          value={stats.total_interventions_urgence}
          subtitle="Accès dérogatoires vitaux"
          icon={AlertTriangle}
          color="rose"
        />
        <StatCard
          title="Événements d'Audit"
          value={stats.total_journaux_audit}
          subtitle="Traçabilité médicolégale"
          icon={ShieldCheck}
          color="purple"
        />
      </div>

      {/* Charts & Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recharts Activity Graph */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#123B5D] uppercase tracking-wider">
                Volume d'Activité Médicale & Administrative
              </h3>
              <span className="text-xs text-[#64748B]">Répartition des entités en base de données</span>
            </div>
            <TrendingUp className="w-5 h-5 text-[#1976D2]" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#123B5D', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  cursor={{ fill: '#F1F5F9' }}
                />
                <Bar dataKey="count" fill="#1976D2" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Audit Activities */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <h3 className="text-sm font-bold text-[#123B5D] uppercase tracking-wider mb-4">
            Dernières Opérations Auditées
          </h3>
          <div className="space-y-3">
            {activite.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">Aucun log récent</p>
            ) : (
              activite.map((item) => (
                <div key={item.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-[#123B5D] truncate">{item.action}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${getStatusBadgeStyle(item.statut)}`}>
                      {item.statut}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>Par : {item.utilisateur__username || 'Système'}</span>
                    <span>{formatDateTime(item.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

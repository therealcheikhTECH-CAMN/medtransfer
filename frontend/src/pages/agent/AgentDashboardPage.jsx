import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { statsService } from '../../services/statsService';
import { StatCard } from '../../components/StatCard';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { formatDateTime } from '../../utils/formatters';
import {
  Users,
  UserPlus,
  Search,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock
} from 'lucide-react';

export const AgentDashboardPage = () => {
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
  const fichesAVerifier = data?.fiches_a_verifier || [];

  return (
    <div className="space-y-6 min-w-0">
      {/* Banner */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-[#123B5D] to-[#1976D2] rounded-2xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 min-w-0">
        <div className="min-w-0 flex-1 space-y-1">
          <span className="text-xs uppercase font-bold tracking-wider text-sky-200 block">
            Bureau des Entrées & Admissions
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white break-words">
            Tableau de bord Accueil
          </h2>
          <p className="text-xs sm:text-sm text-sky-100 max-w-2xl leading-relaxed">
            Recherche centralisée, vérification d'identité, création administrative et prévention des doublons.
          </p>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0 w-full md:w-auto">
          <Link
            to="/agent/search"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#123B5D] bg-white hover:bg-slate-50 rounded-xl shadow-sm transition-all flex-1 sm:flex-initial whitespace-nowrap min-h-[40px]"
          >
            <Search className="w-4 h-4 text-[#1976D2] shrink-0" />
            <span>Rechercher un patient</span>
          </Link>
          <Link
            to="/agent/create-patient"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-600 rounded-xl shadow-sm transition-all flex-1 sm:flex-initial whitespace-nowrap min-h-[40px]"
          >
            <UserPlus className="w-4 h-4 shrink-0" />
            <span>Nouveau patient</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-w-0">
        <StatCard
          title="Patients Enregistrés"
          value={stats.patients_enregistres_total}
          subtitle="Base nationale centralisée"
          icon={Users}
          color="blue"
        />
        <StatCard
          title="Inscriptions Aujourd'hui"
          value={stats.patients_enregistres_aujourdhui}
          subtitle="Admissions du jour"
          icon={Clock}
          color="emerald"
        />
        <StatCard
          title="Identités à Confirmer"
          value={stats.patients_a_confirmer}
          subtitle="Fiches provisoires d'urgence"
          icon={AlertTriangle}
          color="amber"
        />
        <StatCard
          title="Patients de l'Établissement"
          value={stats.patients_mon_etablissement}
          subtitle="Créés dans cette structure"
          icon={Building2}
          color="purple"
        />
      </div>

      {/* Action Prompt & Provisional Records to Verify */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* Quick Instructions */}
        <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-4 min-w-0">
          <h3 className="text-sm font-bold text-[#123B5D] uppercase tracking-wider">
            Règles d'Accueil & Prévention
          </h3>

          <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-100 text-xs text-sky-950 space-y-2.5">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1976D2] shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                <strong>Rechercher systématiquement</strong> le patient par son identifiant MedTransfer, son NIN ou son nom avant toute création.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1976D2] shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                <strong>Ne jamais dupliquer</strong> une fiche pour un patient déjà venu dans un autre hôpital du réseau.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#1976D2] shrink-0 mt-0.5" />
              <span className="leading-relaxed">
                En cas d'admission d'urgence sans pièce d'identité, utiliser l'option <strong>« Identité provisoire »</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* Provisional Records List */}
        <div className="p-5 sm:p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm lg:col-span-2 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-bold text-[#123B5D] uppercase tracking-wider truncate">
                Fiches Provisoires en Attente de Régularisation
              </h3>
              <span className="text-xs text-[#64748B] block truncate">
                Admissions d'urgence nécessitant confirmation de l'état civil
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
              {fichesAVerifier.length} fiches
            </span>
          </div>

          <div className="space-y-3">
            {fichesAVerifier.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                Aucune fiche provisoire en attente. Toutes les identités sont confirmées.
              </div>
            ) : (
              fichesAVerifier.map(p => (
                <div key={p.id} className="p-3.5 sm:p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-[#123B5D] text-sm break-words">
                        {p.nom} {p.prenom}
                      </span>
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded shrink-0">
                        {p.medtransfer_id}
                      </span>
                    </div>
                    <p className="text-amber-900 text-[11px] leading-relaxed break-words">
                      Motif d'urgence : {p.motif_identite_provisoire || 'Non renseigné'}
                    </p>
                    <span className="text-slate-400 text-[10px] block mt-1">
                      Enregistré le {formatDateTime(p.created_at)}
                    </span>
                  </div>

                  <Link
                    to={`/agent/search?q=${p.medtransfer_id}`}
                    className="inline-flex items-center justify-center px-3.5 py-2 bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 rounded-lg font-semibold text-xs whitespace-nowrap transition-colors shrink-0 w-full sm:w-auto text-center"
                  >
                    Examiner & Rapprocher
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

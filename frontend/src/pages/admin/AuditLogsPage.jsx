import React, { useState, useEffect, useCallback, useRef } from 'react';
import { auditService } from '../../services/auditService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { GlobalSearch } from '../../components/GlobalSearch';
import { formatDateTime, getStatusBadgeStyle } from '../../utils/formatters';
import { ShieldCheck } from 'lucide-react';

export const AuditLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const abortControllerRef = useRef(null);

  const fetchLogs = useCallback(
    async (query = '', action = '', statut = '', pageNum = 1) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        setLoading(true);
        const params = { page: pageNum };
        if (query.trim()) params.search = query.trim();
        if (action) params.action = action;
        if (statut) params.statut = statut;

        const res = await auditService.getLogs(params, { signal: controller.signal });
        const items = Array.isArray(res) ? res : res.results || [];
        setLogs(items);
        setTotalCount(res.count ?? items.length);
        setHasNext(Boolean(res.next));
        setHasPrev(Boolean(res.previous));
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchLogs(searchTerm, actionFilter, statutFilter, 1);
  }, [actionFilter, statutFilter]);

  const handleSearch = (newQuery) => {
    const trimmed = (newQuery || '').trim();
    setSearchTerm(trimmed);
    setPage(1);
    fetchLogs(trimmed, actionFilter, statutFilter, 1);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setPage(1);
    fetchLogs('', actionFilter, statutFilter, 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchLogs(searchTerm, actionFilter, statutFilter, newPage);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-5 h-5 text-[#1976D2]" />
            <h2 className="text-xl font-bold text-[#123B5D]">Journaux d'Audit & Traçabilité Médicolégale</h2>
          </div>
          <p className="text-xs text-[#64748B]">
            Registre immuable des accès aux dossiers, interventions d'urgence, transferts et tentatives non autorisées.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold rounded-lg">
            {totalCount} enregistrements audités
          </span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200/80">
        <div className="flex-1">
          <GlobalSearch
            onSearch={handleSearch}
            onClear={handleClearSearch}
            defaultValue={searchTerm}
            loading={loading}
            placeholder="Rechercher par utilisateur, action, entité ou établissement..."
            debounceMs={300}
          />
        </div>

        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
        >
          <option value="">-- Toutes les actions --</option>
          <option value="LOGIN">Connexions</option>
          <option value="VIEW_PATIENT">Consultations Fiches</option>
          <option value="VIEW_MEDICAL_RECORD">Consultations Dossiers Cliniques</option>
          <option value="EMERGENCY_ACCESS">Accès d'Urgence Dérogatoires</option>
          <option value="CREATE_CONSULTATION">Créations d'Actes</option>
          <option value="TRANSFER_INITIATE">Initiations Transfert</option>
          <option value="TRANSFER_ACCEPT">Acceptations Transfert</option>
          <option value="AI_SUMMARY_REQUEST">Demandes Synthèse IA</option>
          <option value="AI_SUMMARY_VALIDATE">Validations IA</option>
          <option value="PERMISSION_DENIED">Accès Rejetés / Interdits (403)</option>
        </select>

        <select
          value={statutFilter}
          onChange={(e) => {
            setStatutFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
        >
          <option value="">-- Tous statuts --</option>
          <option value="SUCCES">Succès</option>
          <option value="REFUSE">Refusé / Interdit</option>
          <option value="ECHEC">Échec</option>
        </select>
      </div>

      {/* Logs Table */}
      {loading ? (
        <LoadingSkeleton type="table" lines={6} />
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[#123B5D] font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Horodatage</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Statut</th>
                <th className="py-3 px-4">Auteur</th>
                <th className="py-3 px-4">Établissement</th>
                <th className="py-3 px-4">Entité Cible</th>
                <th className="py-3 px-4">Détails JSON</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Aucun log correspondant aux filtres
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#123B5D]">
                      {log.action_display || log.action}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadgeStyle(log.statut)}`}>
                        {log.statut}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {log.utilisateur_nom || 'Système'}
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      {log.etablissement_nom || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {log.entite_type ? `${log.entite_type} #${log.entite_id}` : '—'}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-[10px] font-mono text-slate-500 bg-slate-50/50">
                      {JSON.stringify(log.details)}
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
                Total : <strong className="text-slate-700">{totalCount}</strong> logs (Page {page} sur {Math.max(1, Math.ceil(totalCount / 20))})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasPrev || page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  disabled={!hasNext || page >= Math.ceil(totalCount / 20)}
                  onClick={() => handlePageChange(page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

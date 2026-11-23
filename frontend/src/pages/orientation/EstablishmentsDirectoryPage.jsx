import React, { useState, useEffect, useCallback, useRef } from 'react';
import { establishmentService } from '../../services/establishmentService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { AlertBanner } from '../../components/AlertBanner';
import { GlobalSearch } from '../../components/GlobalSearch';
import { EmailComposerModal } from '../../components/email/EmailComposerModal';
import { Building2, MapPin, Phone, Mail } from 'lucide-react';

export const EstablishmentsDirectoryPage = () => {
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  const [emailModalConfig, setEmailModalConfig] = useState({
    isOpen: false,
    recipient: '',
    recipientName: '',
    etablissementNom: '',
    entityId: null,
  });

  const abortControllerRef = useRef(null);

  const fetchEstablishments = useCallback(
    async (query = '', region = '', type = '', pageNum = 1) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        setLoading(true);
        const params = { page: pageNum };
        if (query.trim()) params.q = query.trim();
        if (region) params.region = region;
        if (type) params.type = type;

        const list = await establishmentService.getList(params, { signal: controller.signal });
        const items = Array.isArray(list) ? list : list.results || [];
        setEstablishments(items);
        setTotalCount(list.count ?? items.length);
        setHasNext(Boolean(list.next));
        setHasPrev(Boolean(list.previous));
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
    fetchEstablishments(searchTerm, regionFilter, typeFilter, 1);
  }, [regionFilter, typeFilter]);

  const handleSearch = (newQuery) => {
    const trimmed = (newQuery || '').trim();
    setSearchTerm(trimmed);
    setPage(1);
    fetchEstablishments(trimmed, regionFilter, typeFilter, 1);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setPage(1);
    fetchEstablishments('', regionFilter, typeFilter, 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchEstablishments(searchTerm, regionFilter, typeFilter, newPage);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-[#1976D2]" />
            <h2 className="text-xl font-bold text-[#123B5D]">Annuaire & Orientation des Structures Sanitaires</h2>
          </div>
          <p className="text-xs text-[#64748B]">
            Référentiel des plateaux techniques, spécialités déclarées et coordonnées d'orientation hospitalière.
          </p>
        </div>
      </div>

      {/* Mandatory Disclaimer from Specification */}
      <AlertBanner
        type="info"
        title="Information sur les disponibilités hospitalières"
        message="Les services et spécialités affichés sont issus du référentiel déclaratif des établissements. La présence d'un service ne garantit pas la disponibilité en temps réel de lits d'hospitalisation, d'ambulances ou de personnel de garde."
      />

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200/80">
        <div className="flex-1">
          <GlobalSearch
            onSearch={handleSearch}
            onClear={handleClearSearch}
            defaultValue={searchTerm}
            loading={loading}
            placeholder="Rechercher par nom, ville, code ou spécialité (ex: Urgences, Cardiologie, Scanner)..."
            debounceMs={300}
          />
        </div>

        <select
          value={regionFilter}
          onChange={(e) => {
            setRegionFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
        >
          <option value="">Toutes les régions</option>
          <option value="Ziguinchor">Ziguinchor</option>
          <option value="Dakar">Dakar</option>
          <option value="Saint-Louis">Saint-Louis</option>
          <option value="Thiès">Thiès</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none"
        >
          <option value="">Tous les types</option>
          <option value="HOPITAL_NATIONAL">Hôpital National / CHU</option>
          <option value="CENTRE_HOSPITALIER_REGIONAL">Centre Hospitalier Régional</option>
          <option value="CENTRE_DE_SANTE">Centre de Santé</option>
          <option value="POSTE_DE_SANTE">Poste de Santé</option>
        </select>
      </div>

      {/* Directory Cards */}
      {loading ? (
        <LoadingSkeleton lines={4} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {establishments.length === 0 ? (
              <div className="col-span-2 p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                Aucune structure sanitaire trouvée pour cette recherche.
              </div>
            ) : (
              establishments.map((etab) => (
                <div key={etab.id} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-sky-50 text-[#1976D2] border border-sky-100">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-[#123B5D]">{etab.nom}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded">
                            {etab.code}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">{etab.type_display}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{etab.ville}, Région de {etab.region} {etab.adresse && `• ${etab.adresse}`}</span>
                    </div>
                    {etab.telephone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono text-[11px]">{etab.telephone}</span>
                      </div>
                    )}
                    {etab.email && (
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-50">
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-mono text-slate-700 truncate">{etab.email}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEmailModalConfig({
                            isOpen: true,
                            recipient: etab.email,
                            recipientName: etab.nom,
                            etablissementNom: etab.nom,
                            entityId: etab.id,
                          })}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#1976D2] bg-sky-50 hover:bg-sky-100 border border-sky-200/80 rounded-lg transition-colors shrink-0"
                          title="Préparer un e-mail à cet établissement"
                        >
                          <Mail className="w-3 h-3" />
                          <span>Contacter</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {etab.services_declares && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                      <span className="font-semibold text-slate-700 block mb-1">Services & Plateau Technique Déclarés :</span>
                      <p className="text-slate-600 leading-relaxed">{etab.services_declares}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalCount > 20 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
              <span>
                Total : <strong className="text-slate-700">{totalCount}</strong> établissements (Page {page} sur {Math.max(1, Math.ceil(totalCount / 20))})
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

      {/* Modal de composition d'email */}
      <EmailComposerModal
        isOpen={emailModalConfig.isOpen}
        onClose={() => setEmailModalConfig(prev => ({ ...prev, isOpen: false }))}
        initialRecipient={emailModalConfig.recipient}
        initialRecipientName={emailModalConfig.recipientName}
        contextCategory="ESTABLISHMENT"
        contextData={{
          etablissementNom: emailModalConfig.etablissementNom,
          entityType: 'establishment',
          entityId: emailModalConfig.entityId,
        }}
      />
    </div>
  );
};

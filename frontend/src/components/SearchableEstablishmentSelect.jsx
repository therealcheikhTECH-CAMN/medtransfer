import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Building2,
  Search,
  Check,
  ChevronDown,
  X,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { normalizeSearchText, matchesSearchText } from '../utils/searchUtils';

// Ré-export pour compatibilité ascendante
export { normalizeSearchText };

export const SearchableEstablishmentSelect = ({
  establishments = [],
  value = '',
  onChange,
  name = 'etablissement',
  loading = false,
  error = '',
  onRetry,
  fieldError = '',
  required = true,
  allowEmpty = false,
  emptyLabel = '-- Aucun (Administration centrale) --',
  excludeId = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);

  // Établissement actuellement sélectionné (via son identifiant réel, compatible number, string, object ou event)
  const selectedEstablishment = useMemo(() => {
    if (value === null || value === undefined || value === '') return null;
    let rawId = value;
    if (typeof value === 'object' && value !== null) {
      rawId = value.target?.value ?? value.id ?? value.value ?? '';
    }
    if (rawId === null || rawId === undefined || rawId === '') return null;
    const numericId = Number(rawId);
    if (Number.isNaN(numericId)) return null;
    return establishments.find((e) => Number(e.id) === numericId) || null;
  }, [establishments, value]);

  // Liste éligible (excluant optionnellement un ID, ex: son propre établissement pour un transfert)
  const eligibleEstablishments = useMemo(() => {
    if (!excludeId) return establishments;
    const numericExclude = Number(excludeId);
    return establishments.filter((e) => Number(e.id) !== numericExclude);
  }, [establishments, excludeId]);

  // Filtrage local instantané (insensible à la casse et aux accents, sur nom, ville, code, région)
  const filteredEstablishments = useMemo(() => {
    const list = searchQuery
      ? eligibleEstablishments.filter((etab) =>
          matchesSearchText(etab, searchQuery, [
            'nom',
            'ville',
            'code',
            'region',
            'type_display',
            'type_etablissement',
          ])
        )
      : eligibleEstablishments;

    if (allowEmpty) {
      const emptyMatches =
        !searchQuery ||
        matchesSearchText({ nom: emptyLabel }, searchQuery, ['nom']);
      if (emptyMatches) {
        return [{ id: '', nom: emptyLabel, ville: '', is_empty_option: true }, ...list];
      }
    }
    return list;
  }, [eligibleEstablishments, searchQuery, allowEmpty, emptyLabel]);

  // Réinitialiser l'index surligné quand la recherche change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  // Focus automatique sur la zone de recherche à l'ouverture
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Fermeture automatique lors d'un clic ou toucher à l'extérieur
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Maintenir l'élément surligné au clavier visible dans la liste déroulante
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const highlightedEl = listRef.current.querySelector(
      `[data-option-index="${highlightedIndex}"]`
    );
    if (highlightedEl && typeof highlightedEl.scrollIntoView === 'function') {
      highlightedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const isDisabled = loading || !!error || establishments.length === 0;

  const handleToggleOpen = () => {
    if (isDisabled) return;
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setSearchQuery('');
      }
      return next;
    });
  };

  const handleSelectEstablishment = (etab) => {
    if (!etab) return;
    const etabId = etab.id !== undefined && etab.id !== null ? String(etab.id) : '';
    if (onChange) {
      const syntheticEvent = {
        target: {
          name,
          value: etabId,
        },
        currentTarget: {
          name,
          value: etabId,
        },
      };
      // Appelle onChange avec l'événement synthétique (compatible standard e.target.value)
      // et passe également la valeur brute et l'objet complet pour flexibilité maximale
      onChange(syntheticEvent, etabId, etab);
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClearSearch = (e) => {
    e.stopPropagation();
    setSearchQuery('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (isDisabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredEstablishments.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % filteredEstablishments.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredEstablishments.length > 0) {
        setHighlightedIndex((prev) =>
          prev - 1 < 0 ? filteredEstablishments.length - 1 : prev - 1
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredEstablishments.length > 0 && filteredEstablishments[highlightedIndex]) {
        handleSelectEstablishment(filteredEstablishments[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const renderTriggerLabel = () => {
    if (loading) {
      return 'Chargement des établissements...';
    }
    if (error) {
      return 'Erreur de chargement des établissements';
    }
    if (establishments.length === 0 && !allowEmpty) {
      return 'Aucun établissement disponible';
    }
    if (selectedEstablishment) {
      return `${selectedEstablishment.nom}${
        selectedEstablishment.ville ? ` (${selectedEstablishment.ville})` : ''
      }`;
    }
    if (allowEmpty && (value === '' || value === null || value === undefined)) {
      return emptyLabel;
    }
    return '-- Sélectionner un établissement --';
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Champ caché conservant l'ID réel pour la validation native du formulaire */}
      <input
        type="hidden"
        name={name}
        value={selectedEstablishment ? selectedEstablishment.id : ''}
        required={required}
      />

      {/* Bouton déclencheur principal */}
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Établissement de santé"
        disabled={isDisabled}
        onClick={handleToggleOpen}
        onKeyDown={handleKeyDown}
        className={`w-full pl-9 pr-9 py-2.5 bg-white text-left text-xs rounded-xl border transition-all outline-none flex items-center justify-between ${
          isOpen
            ? 'border-[#1976D2] ring-2 ring-[#1976D2]/20'
            : fieldError
            ? 'border-rose-400 focus:border-rose-500'
            : 'border-slate-200 hover:border-slate-300 focus:border-[#1976D2]'
        } disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed`}
      >
        {loading ? (
          <Loader2 className="absolute w-4 h-4 text-[#1976D2] left-3 top-2.5 animate-spin" />
        ) : (
          <Building2
            className={`absolute w-4 h-4 left-3 top-2.5 ${
              selectedEstablishment ? 'text-[#1976D2]' : 'text-slate-400'
            }`}
          />
        )}

        <span
          className={`truncate block ${
            selectedEstablishment ? 'font-semibold text-[#123B5D]' : 'text-slate-500'
          }`}
        >
          {renderTriggerLabel()}
        </span>

        <span className="absolute right-2.5 top-2.5 flex items-center gap-1">
          {selectedEstablishment && (
            <Check
              className="w-3.5 h-3.5 text-emerald-600 shrink-0"
              aria-label="Établissement sélectionné"
            />
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-[#1976D2]' : ''
            }`}
          />
        </span>
      </button>

      {/* Menu déroulant avec recherche instantanée intégrée */}
      {isOpen && !isDisabled && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Barre de recherche intégrée en haut de la liste */}
          <div className="p-2 bg-slate-50/80 border-b border-slate-200">
            <div className="relative flex items-center">
              <Search className="absolute w-3.5 h-3.5 text-slate-400 left-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Rechercher un établissement ou une ville..."
                aria-label="Rechercher un établissement de santé"
                className="w-full pl-8 pr-8 py-2 bg-white text-xs text-[#123B5D] rounded-lg border border-slate-200 focus:border-[#1976D2] focus:ring-2 focus:ring-[#1976D2]/15 outline-none placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  title="Effacer la recherche"
                  aria-label="Effacer la recherche"
                  className="absolute right-2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Liste filtrée des établissements */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-56 overflow-y-auto divide-y divide-slate-100 py-1"
          >
            {filteredEstablishments.length === 0 ? (
              <li className="px-4 py-6 text-center text-xs text-slate-500 space-y-2">
                <p className="font-semibold text-[#123B5D]">Aucun établissement trouvé</p>
                <p className="text-[11px] text-slate-400">
                  Aucun établissement actif ne correspond à « {searchQuery} ».
                </p>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#1976D2] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    Effacer la recherche
                  </button>
                )}
              </li>
            ) : (
              filteredEstablishments.map((etab, index) => {
                const isSelected = etab.is_empty_option
                  ? !value
                  : selectedEstablishment && Number(selectedEstablishment.id) === Number(etab.id);
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={etab.id || 'empty-opt'}
                    role="option"
                    aria-selected={!!isSelected}
                    data-option-index={index}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectEstablishment(etab);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      handleSelectEstablishment(etab);
                    }}
                    className={`px-3.5 py-2.5 text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? 'bg-blue-50/90 text-[#123B5D] font-semibold'
                        : isHighlighted
                        ? 'bg-slate-100 text-[#123B5D]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[#123B5D]">
                        {etab.nom}
                      </span>
                      {etab.ville && (
                        <span className="block text-[11px] text-slate-500 truncate">
                          {etab.ville}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <Check className="w-4 h-4 text-[#1976D2] shrink-0" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {/* États d'erreur API, liste vide ou erreur de validation du champ */}
      {error && (
        <div className="mt-1.5 flex items-center justify-between gap-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700">
          <span>{error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1 px-2 py-1 font-semibold bg-white border border-rose-200 rounded hover:bg-rose-100 shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              Réessayer
            </button>
          )}
        </div>
      )}

      {!loading && !error && establishments.length === 0 && (
        <p className="text-[11px] text-amber-700 mt-1">
          Aucun établissement de santé actif n'est actuellement enregistré dans la base de données.
        </p>
      )}

      {fieldError && (
        <p className="text-[11px] text-rose-600 mt-1">{fieldError}</p>
      )}
    </div>
  );
};

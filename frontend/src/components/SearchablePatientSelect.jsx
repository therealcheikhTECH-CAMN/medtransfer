import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  User,
  Search,
  Check,
  ChevronDown,
  X,
  Loader2,
  Calendar,
  CreditCard,
  Building2,
  Activity,
} from 'lucide-react';
import { patientService } from '../services/patientService';
import { normalizeSearchText, matchesSearchText } from '../utils/searchUtils';

export const SearchablePatientSelect = ({
  value = '',
  onChange,
  name = 'patient',
  scope = 'my_care',
  filterFn = null,
  excludePatientId = null,
  placeholder = '-- Sélectionner un patient --',
  disabled = false,
  required = false,
  fieldError = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState([]);
  const [selectedPatientObj, setSelectedPatientObj] = useState(null);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef(null);
  const searchInputRef = useRef(null);
  const listRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Charger ou retrouver les informations du patient sélectionné
  useEffect(() => {
    let isMounted = true;
    if (!value) {
      setSelectedPatientObj(null);
      return;
    }

    // Si le patient est déjà dans la liste chargée
    const found = patients.find((p) => Number(p.id) === Number(value));
    if (found) {
      setSelectedPatientObj(found);
      return;
    }

    // Sinon charger ses détails administratifs
    patientService
      .getById(value)
      .then((data) => {
        if (isMounted && data) {
          setSelectedPatientObj(data);
        }
      })
      .catch(() => {
        // En cas d'erreur de chargement silencieuse
      });

    return () => {
      isMounted = false;
    };
  }, [value, patients]);

  // Fonction de recherche backend debouncée
  const fetchPatients = useCallback(
    async (query = '') => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        setLoading(true);
        // Si le scope est my_care et qu'une recherche est tapée, on peut chercher dans my_care
        const res = await patientService.search(query.trim(), '', scope, {
          signal: controller.signal,
        });
        const list = Array.isArray(res) ? res : res.results || [];
        setPatients(list);
      } catch (err) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('Erreur chargement patients dans SearchablePatientSelect:', err);
        }
      } finally {
        setLoading(false);
      }
    },
    [scope]
  );

  // Charger la liste initiale à l'ouverture du menu déroulant
  useEffect(() => {
    if (isOpen) {
      fetchPatients(searchQuery);
    }
  }, [isOpen]);

  // Debounce de recherche quand l'utilisateur tape
  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      fetchPatients(searchQuery);
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, fetchPatients]);

  // Filtrage local complémentaire (ex: filterFn, excludePatientId)
  const filteredPatients = useMemo(() => {
    let result = patients;

    if (excludePatientId) {
      const numExclude = Number(excludePatientId);
      result = result.filter((p) => Number(p.id) !== numExclude);
    }

    if (filterFn) {
      result = result.filter(filterFn);
    }

    // Si on a tapé une requête, on réapplique aussi matchesSearchText localement
    if (searchQuery.trim()) {
      result = result.filter((p) =>
        matchesSearchText(p, searchQuery, [
          'nom',
          'prenom',
          'medtransfer_id',
          'numero_identification_nationale',
          'telephone',
        ])
      );
    }

    return result;
  }, [patients, excludePatientId, filterFn, searchQuery]);

  // Réinitialiser le surlignage au clavier lors d'un changement de résultat
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredPatients.length]);

  // Focus automatique sur le champ de recherche à l'ouverture
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Fermeture lors d'un clic extérieur
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
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

  const handleSelect = (patient) => {
    if (!patient) return;
    setSelectedPatientObj(patient);
    if (onChange) {
      onChange({
        target: {
          name,
          value: String(patient.id),
        },
      });
    }
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClearSelection = (e) => {
    e.stopPropagation();
    setSelectedPatientObj(null);
    if (onChange) {
      onChange({
        target: {
          name,
          value: '',
        },
      });
    }
  };

  const handleKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredPatients.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % filteredPatients.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredPatients.length > 0) {
        setHighlightedIndex((prev) =>
          prev - 1 < 0 ? filteredPatients.length - 1 : prev - 1
        );
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredPatients.length > 0 && filteredPatients[highlightedIndex]) {
        handleSelect(filteredPatients[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Champ caché pour conformité aux formulaires natifs */}
      <input
        type="hidden"
        name={name}
        value={selectedPatientObj ? selectedPatientObj.id : ''}
        required={required}
      />

      {/* Déclencheur Combobox */}
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        className={`w-full pl-9 pr-9 py-2.5 bg-white text-left text-xs rounded-xl border transition-all outline-none flex items-center justify-between ${
          isOpen
            ? 'border-[#1976D2] ring-2 ring-[#1976D2]/20'
            : fieldError
            ? 'border-rose-400 focus:border-rose-500'
            : 'border-slate-200 hover:border-slate-300 focus:border-[#1976D2]'
        } disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed shadow-sm`}
      >
        <User className="absolute w-4 h-4 text-slate-400 left-3 top-3" />

        <div className="min-w-0 flex-1 pr-2">
          {selectedPatientObj ? (
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-[#123B5D]">
                {selectedPatientObj.prenom} {selectedPatientObj.nom}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-blue-50 text-[#1976D2] font-mono font-bold text-[10px] border border-blue-200">
                {selectedPatientObj.medtransfer_id}
              </span>
            </div>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {selectedPatientObj && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClearSelection}
              className="p-1 text-slate-400 hover:text-rose-500 rounded hover:bg-slate-100 transition-colors mr-0.5"
              title="Désélectionner le patient"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              isOpen ? 'rotate-180 text-[#1976D2]' : ''
            }`}
          />
        </div>
      </button>

      {/* Menu déroulant */}
      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 bg-white rounded-xl shadow-xl border border-slate-200/90 overflow-hidden">
          {/* Barre de recherche instantanée interne */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70">
            <div className="relative">
              <Search className="absolute w-3.5 h-3.5 text-slate-400 left-3 top-2.5" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par nom, prénom ou ID..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white rounded-lg border border-slate-200 outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]/20"
              />
              {loading && (
                <Loader2 className="absolute right-2.5 top-2 w-3.5 h-3.5 text-[#1976D2] animate-spin" />
              )}
              {searchQuery && !loading && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Liste des résultats */}
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-60 overflow-y-auto divide-y divide-slate-100 py-1"
          >
            {filteredPatients.length === 0 ? (
              <li className="p-4 text-center text-xs text-slate-400">
                {loading ? 'Recherche en cours...' : 'Aucun patient correspondant'}
              </li>
            ) : (
              filteredPatients.map((patient, index) => {
                const isSelected =
                  selectedPatientObj && Number(selectedPatientObj.id) === Number(patient.id);
                const isHighlighted = index === highlightedIndex;

                return (
                  <li
                    key={patient.id}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    onClick={() => handleSelect(patient)}
                    className={`px-3.5 py-2.5 text-xs cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                      isSelected
                        ? 'bg-blue-50/90 text-[#123B5D] font-semibold'
                        : isHighlighted
                        ? 'bg-slate-100 text-[#123B5D]'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#123B5D]">
                          {patient.prenom} {patient.nom}
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-mono font-bold text-[10px] border border-slate-200">
                          {patient.medtransfer_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-slate-500">
                        {patient.date_naissance && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {patient.date_naissance}
                          </span>
                        )}
                        {patient.numero_identification_nationale && (
                          <span className="flex items-center gap-1 font-mono">
                            <CreditCard className="w-3 h-3 text-slate-400" />
                            {patient.numero_identification_nationale}
                          </span>
                        )}
                        {patient.active_care_etablissement_nom && (
                          <span className="flex items-center gap-1 truncate text-slate-400">
                            <Building2 className="w-3 h-3" />
                            {patient.active_care_etablissement_nom}
                          </span>
                        )}
                      </div>
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

      {fieldError && (
        <p className="mt-1 text-[11px] text-rose-600 font-medium">{fieldError}</p>
      )}
    </div>
  );
};

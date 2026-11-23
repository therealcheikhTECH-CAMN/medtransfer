import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { normalizeSearchText } from '../utils/searchUtils';

export const GlobalSearch = ({
  value: controlledValue,
  defaultValue = '',
  onChange,
  onSearch,
  debounceMs = 300,
  loading = false,
  placeholder = 'Rechercher...',
  className = '',
  autoFocus = false,
  onClear,
  id = 'global-search-input',
  ariaLabel = 'Rechercher dans la liste',
}) => {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(
    isControlled ? controlledValue : defaultValue
  );
  const inputRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Synchronisation si composant contrôlé
  useEffect(() => {
    if (isControlled && controlledValue !== internalValue) {
      setInternalValue(controlledValue || '');
    }
  }, [controlledValue, isControlled]);

  // Nettoyage du timer au démontage
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const triggerSearch = useCallback(
    (query) => {
      if (onSearch) {
        onSearch(query);
      }
    },
    [onSearch]
  );

  const handleInputChange = (e) => {
    const nextVal = e.target.value;
    if (!isControlled) {
      setInternalValue(nextVal);
    }
    if (onChange) {
      onChange(e);
    }

    // Si le champ est entièrement vidé, réinitialiser immédiatement (0 ms)
    if (!nextVal.trim()) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      triggerSearch('');
      return;
    }

    // Sinon déclencher avec debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      triggerSearch(nextVal);
    }, debounceMs);
  };

  const handleClear = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (!isControlled) {
      setInternalValue('');
    }
    if (onChange) {
      onChange({ target: { value: '' } });
    }
    triggerSearch('');
    if (onClear) {
      onClear();
    }
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape' && (internalValue || controlledValue)) {
      e.preventDefault();
      handleClear();
    }
  };

  const currentDisplayValue = isControlled ? controlledValue || '' : internalValue;

  return (
    <div className={`relative flex items-center w-full ${className}`}>
      {/* Icône de recherche ou spinner de chargement */}
      <div className="absolute left-3.5 flex items-center pointer-events-none text-slate-400">
        {loading ? (
          <Loader2 className="w-4 h-4 text-[#1976D2] animate-spin" />
        ) : (
          <Search className="w-4 h-4" />
        )}
      </div>

      {/* Champ de saisie instantané */}
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="searchbox"
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        value={currentDisplayValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full pl-10 pr-9 py-2.5 text-xs bg-white rounded-xl border border-slate-200/90 hover:border-slate-300 focus:border-[#1976D2] focus:ring-2 focus:ring-[#1976D2]/20 outline-none transition-all placeholder:text-slate-400 text-slate-800 shadow-sm"
      />

      {/* Bouton d'effacement rapide */}
      {currentDisplayValue && (
        <button
          type="button"
          onClick={handleClear}
          title="Effacer la recherche (Échap)"
          aria-label="Effacer le texte recherché"
          className="absolute right-2.5 p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

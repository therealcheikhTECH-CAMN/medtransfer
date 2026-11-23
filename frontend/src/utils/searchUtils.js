/**
 * Normalise une chaîne pour une recherche insensible à la casse et tolérante aux accents.
 * Décompose les caractères Unicode, supprime les diacritiques et convertit en minuscules.
 */
export const normalizeSearchText = (text = '') =>
  String(text ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/**
 * Vérifie si un objet correspond à une requête multi-mots (ET logique entre les mots-clés).
 * Chaque mot-clé doit être présent dans au moins un des champs spécifiés.
 *
 * @param {Object} item L'élément à tester
 * @param {string} query La chaîne saisie par l'utilisateur
 * @param {Array<Function|string>} fields Liste de noms de propriétés ou de fonctions extractrices
 * @returns {boolean}
 */
export const matchesSearchText = (item, query, fields = []) => {
  if (!item) return false;
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  // Extraire les valeurs normalisées des champs une seule fois pour cet item
  const normalizedValues = fields.map((f) => {
    if (typeof f === 'function') {
      return normalizeSearchText(f(item));
    }
    return normalizeSearchText(item[f]);
  });

  const combinedString = normalizedValues.join(' ');

  // Chaque token doit matcher soit un champ individuel, soit la chaîne combinée
  return tokens.every((token) => combinedString.includes(token));
};

/**
 * Utilitaire debounce standard avec support d'annulation immédiate.
 */
export const debounce = (func, wait = 300) => {
  let timeoutId = null;

  const debounced = (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      func(...args);
    }, wait);
  };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
};

/**
 * Utilitaires pour la composition et l'encodage sécurisé des liens mailto:
 */

/**
 * Valide le format d'une adresse e-mail selon la norme RFC 5322 simplifiée.
 */
export const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return re.test(email.trim());
};

/**
 * Construit un lien mailto: valide, standard et sécurisé.
 * Utilise encodeURIComponent pour tous les paramètres (accents, retours à la ligne, espaces).
 */
export const buildMailtoUrl = ({ to = '', cc = '', bcc = '', subject = '', body = '' }) => {
  const cleanTo = (to || '').trim().replace(/;/g, ',');
  const params = [];

  if (cc && cc.trim()) {
    const cleanCc = cc.trim().replace(/;/g, ',');
    params.push(`cc=${encodeURIComponent(cleanCc)}`);
  }

  if (bcc && bcc.trim()) {
    const cleanBcc = bcc.trim().replace(/;/g, ',');
    params.push(`bcc=${encodeURIComponent(cleanBcc)}`);
  }

  if (subject && subject.trim()) {
    params.push(`subject=${encodeURIComponent(subject.trim())}`);
  }

  if (body) {
    // Normalisation des sauts de ligne en \r\n standard pour les clients e-mail (RFC 2368 / RFC 6068)
    const normalizedBody = body.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
    params.push(`body=${encodeURIComponent(normalizedBody)}`);
  }

  const queryString = params.length > 0 ? `?${params.join('&')}` : '';
  return `mailto:${encodeURI(cleanTo)}${queryString}`;
};

/**
 * Vérifie si la longueur de l'URL mailto: reste dans les limites sécurisées des navigateurs (~2000 caractères).
 */
export const checkMailtoLength = (url) => {
  const len = url.length;
  // Les navigateurs et clients de messagerie limitent généralement les URLs à ~2000 caractères
  const SAFE_LIMIT = 1900;
  return {
    length: len,
    isSafe: len <= SAFE_LIMIT,
    warning: len > SAFE_LIMIT ? `Le message est long (${len} caractères). Certains clients de messagerie peuvent tronquer les messages dépassant 1900 caractères dans un lien mailto. Nous vous recommandons d'utiliser le bouton « Copier le contenu » pour coller directement le message dans votre messagerie.` : null,
  };
};

/**
 * Copie un texte dans le presse-papier avec solution de repli multi-navigateurs.
 */
export const copyTextToClipboard = async (text) => {
  if (!text) return false;

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback vers l'ancienne méthode ci-dessous
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error('Échec de la copie dans le presse-papier :', err);
    return false;
  }
};

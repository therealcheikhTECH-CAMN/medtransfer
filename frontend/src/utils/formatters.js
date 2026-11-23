export const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return dateStr;
  }
};

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return dateStr;
  }
};

export const calculateAge = (birthDate) => {
  if (!birthDate) return '—';
  try {
    const birth = new Date(birthDate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    return `${age} ans`;
  } catch {
    return '—';
  }
};

export const getStatusBadgeStyle = (status) => {
  switch (status) {
    case 'ACTIF':
    case 'APPROVED':
    case 'CONFIRMEE':
    case 'VALIDEE':
    case 'ACCEPTE':
    case 'SUCCES':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'A_CONFIRMER':
    case 'PENDING':
    case 'EN_ATTENTE':
    case 'DEMANDE':
    case 'TRANSFERE':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'CLOTURE':
      return 'bg-slate-50 text-slate-600 border-slate-200';
    case 'REJETEE':
    case 'REJECTED':
    case 'SUSPENDED':
    case 'REFUSE':
    case 'REFUSE / INTERDIT':
    case 'ECHEC':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'DIRECTEUR':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'ADMIN':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    default:
      return 'bg-blue-50 text-blue-700 border-blue-200';
  }
};

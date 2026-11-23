import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft } from 'lucide-react';

/**
 * Retourne la destination de secours adaptée au rôle et à la page courante
 * en cas d'accès direct sans historique de navigation.
 */
export const getRoleHomeRoute = (role) => {
  if (role === 'ADMIN') return '/admin/dashboard';
  if (role === 'AGENT') return '/agent/dashboard';
  if (role === 'MEDECIN') return '/doctor/dashboard';
  return '/login';
};

export const getSmartFallbackRoute = (pathname, role) => {
  const home = getRoleHomeRoute(role);

  // 1. Espace Médecin
  if (role === 'MEDECIN') {
    if (pathname.startsWith('/doctor/consultations/new')) return '/doctor/patients';
    if (pathname.startsWith('/doctor/patients/')) return '/doctor/patients';
    if (pathname === '/doctor/patients') return home;
    if (pathname === '/doctor/transfers') return home;
    if (pathname === '/doctor/care-management') return home;
    if (pathname === '/orientation/establishments') return home;
    return home;
  }

  // 2. Espace Agent d'accueil
  if (role === 'AGENT') {
    if (pathname === '/agent/create-patient') return '/agent/dashboard';
    if (pathname === '/agent/search') return '/agent/dashboard';
    if (pathname === '/orientation/establishments') return home;
    return home;
  }

  // 3. Espace Administrateur
  if (role === 'ADMIN') {
    if (pathname === '/admin/users') return home;
    if (pathname === '/admin/establishments') return home;
    if (pathname === '/admin/audit') return home;
    if (pathname === '/orientation/establishments') return home;
    return home;
  }

  // 4. Utilisateur non authentifié / Pages publiques
  return '/login';
};

export const BackButton = ({ className = '', customFallback = null, label = 'Retour' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // Enregistrement continu de l'historique de navigation interne dans sessionStorage
  useEffect(() => {
    const current = sessionStorage.getItem('medtransfer_current_path');
    if (current && current !== location.pathname) {
      sessionStorage.setItem('medtransfer_prev_path', current);
    }
    sessionStorage.setItem('medtransfer_current_path', location.pathname);
  }, [location.pathname]);

  const handleBack = () => {
    const role = user?.role;
    const fallback = customFallback || getSmartFallbackRoute(location.pathname, role);
    const homeRoute = getRoleHomeRoute(role);

    // Détection de l'historique interne React Router
    const historyIdx = window.history.state?.idx;
    const prevPath = sessionStorage.getItem('medtransfer_prev_path');

    // 1. Si nous venons d'une page précédente interne qui n'est pas /login : retour naturel (préserve filtres et query params)
    if (historyIdx && historyIdx > 0 && prevPath && prevPath !== '/login' && prevPath !== location.pathname) {
      navigate(-1);
      return;
    }

    // 2. Si nous sommes déjà sur la page racine de notre rôle sans historique antérieur
    if (location.pathname === fallback || location.pathname === homeRoute) {
      // Évite toute boucle de navigation avec /login
      if (historyIdx && historyIdx > 0 && prevPath && prevPath !== '/login') {
        navigate(-1);
      }
      return;
    }

    // 3. Destination de secours intelligente et sécurisée selon le rôle
    navigate(fallback);
  };

  const role = user?.role;
  const isHome = location.pathname === getRoleHomeRoute(role);
  const prevPath = typeof window !== 'undefined' ? sessionStorage.getItem('medtransfer_prev_path') : null;
  const historyIdx = typeof window !== 'undefined' ? window.history.state?.idx : 0;
  const hasValidBackHistory = historyIdx > 0 && prevPath && prevPath !== '/login' && prevPath !== location.pathname;

  return (
    <button
      type="button"
      onClick={handleBack}
      disabled={isHome && !hasValidBackHistory}
      className={`inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-[#123B5D] bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-[#1976D2]/40 rounded-xl shadow-xs hover:shadow-sm transition-all group focus:outline-hidden focus:ring-2 focus:ring-[#1976D2]/20 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-slate-200/90 ${className}`}
      title={isHome && !hasValidBackHistory ? 'Page principale' : 'Retour à la page précédente'}
      aria-label="Retour à la page précédente"
    >
      <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1976D2] group-hover:-translate-x-0.5 group-disabled:translate-x-0 transition-transform shrink-0" />
      <span>{label}</span>
    </button>
  );
};

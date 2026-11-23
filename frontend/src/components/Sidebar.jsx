import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  Users,
  Building2,
  ShieldCheck,
  UserPlus,
  Search,
  FileText,
  ArrowRightLeft,
  Activity,
  LogOut,
  Cross,
  Stethoscope,
  ClipboardList,
  PanelLeftClose,
  Lock,
  UserCheck
} from 'lucide-react';

export const Sidebar = ({ mobileOpen, setMobileOpen, sidebarOpen, setSidebarOpen }) => {
  const { user, isDoctor, isReceptionist, isDirector, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-[#1976D2] text-white shadow-sm'
        : 'text-slate-300 hover:text-white hover:bg-white/10'
    }`;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col w-64 bg-[#123B5D] text-white transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${sidebarOpen ? 'md:translate-x-0' : 'md:-translate-x-full'}`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1976D2] to-sky-400 shadow-md shrink-0">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div className="min-w-0">
              <span className="text-lg font-bold tracking-tight text-white block truncate">
                MEDTRANSFER
              </span>
              <span className="text-[10px] font-semibold tracking-wider text-sky-300 uppercase block truncate">
                Plateforme Médicale
              </span>
            </div>
          </div>

          {/* Quick collapse button */}
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileOpen(false);
              } else {
                setSidebarOpen(false);
              }
            }}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors shrink-0"
            title="Masquer le menu"
            aria-label="Masquer le menu"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        </div>

        {/* User Facility Badge */}
        {user?.etablissement && (
          <div className="px-5 py-3 mx-3 mt-3 rounded-lg bg-white/5 border border-white/10 text-xs">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Établissement rattaché :</span>
            <span className="font-medium text-white truncate block mt-0.5">
              {user.etablissement.nom}
            </span>
            <span className="text-sky-300 text-[11px] font-mono">
              Code : {user.etablissement.code} ({user.etablissement.ville})
            </span>
          </div>
        )}

        {/* Navigation Sections */}
        <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {/* 1. ESPACE ADMINISTRATEUR */}
          {isAdmin && (
            <>
              <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Administration
              </div>
              <NavLink to="/admin/dashboard" className={linkClass} onClick={() => setMobileOpen(false)}>
                <LayoutDashboard className="w-4 h-4" />
                Tableau de bord
              </NavLink>
              <NavLink to="/admin/users" className={linkClass} onClick={() => setMobileOpen(false)}>
                <Users className="w-4 h-4" />
                Gestion Utilisateurs
              </NavLink>
              <NavLink to="/admin/director-requests" className={linkClass} onClick={() => setMobileOpen(false)}>
                <UserCheck className="w-4 h-4" />
                Demandes Directeurs
              </NavLink>
              <NavLink to="/admin/establishments" className={linkClass} onClick={() => setMobileOpen(false)}>
                <Building2 className="w-4 h-4" />
                Établissements
              </NavLink>
              <NavLink to="/admin/audit" className={linkClass} onClick={() => setMobileOpen(false)}>
                <ShieldCheck className="w-4 h-4" />
                Audit & Sécurité
              </NavLink>
            </>
          )}

          {/* 1bis. ESPACE DIRECTEUR D'ÉTABLISSEMENT */}
          {isDirector && (
            <>
              <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Direction Établissement
              </div>
              <NavLink to="/director/dashboard" className={linkClass} onClick={() => setMobileOpen(false)}>
                <LayoutDashboard className="w-4 h-4" />
                Espace Directeur
              </NavLink>
              <NavLink to="/director/my-establishment" className={linkClass} onClick={() => setMobileOpen(false)}>
                <Building2 className="w-4 h-4" />
                Mon établissement
              </NavLink>
              <NavLink to="/orientation/establishments" className={linkClass} onClick={() => setMobileOpen(false)}>
                <Building2 className="w-4 h-4" />
                Annuaire Établissements
              </NavLink>
            </>
          )}

          {/* 2. ESPACE AGENT D'ACCUEIL */}
          {isReceptionist && (
            <>
              <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Accueil & Admissions
              </div>
              <NavLink to="/agent/dashboard" className={linkClass} onClick={() => setMobileOpen(false)}>
                <LayoutDashboard className="w-4 h-4" />
                Tableau de bord
              </NavLink>
              <NavLink to="/agent/search" className={linkClass} onClick={() => setMobileOpen(false)}>
                <Search className="w-4 h-4" />
                Recherche Patients
              </NavLink>
              <NavLink to="/agent/create-patient" className={linkClass} onClick={() => setMobileOpen(false)}>
                <UserPlus className="w-4 h-4" />
                Nouveau Patient
              </NavLink>
              <NavLink to="/agent/transfers" className={linkClass} onClick={() => setMobileOpen(false)}>
                <ArrowRightLeft className="w-4 h-4" />
                Demandes de Transfert
              </NavLink>
              <NavLink to="/orientation/establishments" className={linkClass} onClick={() => setMobileOpen(false)}>
                <Building2 className="w-4 h-4" />
                Annuaire Établissements
              </NavLink>
            </>
          )}

          {/* 3. ESPACE MÉDECIN */}
          {isDoctor && (
            <>
              <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Espace Clinique
              </div>
              <NavLink to="/doctor/dashboard" className={linkClass} onClick={() => setMobileOpen(false)}>
                <LayoutDashboard className="w-4 h-4" />
                Tableau de bord
              </NavLink>
              <NavLink to="/doctor/patients" className={linkClass} onClick={() => setMobileOpen(false)}>
                <Users className="w-4 h-4" />
                Dossiers Patients
              </NavLink>
              <NavLink to="/doctor/transfers" className={linkClass} onClick={() => setMobileOpen(false)}>
                <ArrowRightLeft className="w-4 h-4" />
                Transferts
              </NavLink>
              <NavLink to="/doctor/care-management" className={linkClass} onClick={() => setMobileOpen(false)}>
                <ClipboardList className="w-4 h-4" />
                Prises en charge
              </NavLink>
              <NavLink to="/orientation/establishments" className={linkClass} onClick={() => setMobileOpen(false)}>
                <Building2 className="w-4 h-4" />
                Orientation & Réseau
              </NavLink>
            </>
          )}

          {/* RUBRIQUE SÉCURITÉ ET MOT DE PASSE (TOUS LES PROFESSIONNELS) */}
          <div className="px-3 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Mon Compte
          </div>
          <NavLink to="/security" className={linkClass} onClick={() => setMobileOpen(false)}>
            <Lock className="w-4 h-4" />
            Sécurité et mot de passe
          </NavLink>
        </div>

        {/* Footer Professional Identity & Logout */}
        <div className="p-4 border-t border-white/10 bg-[#0e2c46]">
          <div className="mb-3 px-1 text-[10px] text-slate-400 leading-snug">
            <span className="font-semibold text-slate-200 block">MEDTRANSFER</span>
            Plateforme de gestion de l'historique médical et d'orientation des patients.
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center justify-center w-full gap-2 px-3 py-2 text-xs font-semibold text-rose-200 transition-colors bg-rose-500/10 hover:bg-rose-500/20 rounded-lg border border-rose-500/20"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  );
};

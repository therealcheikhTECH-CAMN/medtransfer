import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BackButton } from './BackButton';

export const Layout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('medtransfer_sidebar_open');
      if (saved !== null) {
        return saved === 'true';
      }
      return typeof window !== 'undefined' ? window.innerWidth >= 768 : true;
    } catch {
      return true;
    }
  });
  const location = useLocation();

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('medtransfer_sidebar_open', String(next));
      } catch {}
      return next;
    });
  };

  // Dynamic Page Title Map
  const getPageTitle = (path) => {
    if (path.includes('/admin/dashboard')) return 'Tableau de bord Administrateur';
    if (path.includes('/admin/users')) return 'Gestion des Comptes & Rôles';
    if (path.includes('/admin/establishments')) return 'Structures Sanitaires Centralisées';
    if (path.includes('/admin/audit')) return 'Journal d\'Audit & Sécurité Médicolégale';
    if (path.includes('/director/dashboard')) return 'Espace Directeur d\'Établissement';
    if (path.includes('/security')) return 'Sécurité et mot de passe';
    if (path.includes('/agent/dashboard')) return 'Tableau de bord Accueil & Admissions';
    if (path.includes('/agent/search')) return 'Recherche Centralisée de Patients';
    if (path.includes('/agent/create-patient')) return 'Enregistrement Patient';
    if (path.includes('/doctor/dashboard')) return 'Tableau de bord Médical';
    if (path.includes('/doctor/patients')) return 'Dossiers Patients & Historique';
    if (path.includes('/doctor/transfers')) return 'Transferts Inter-Établissements';
    if (path.includes('/doctor/care-management')) return 'Prises en Charge Médicales';
    if (path.includes('/orientation/establishments')) return 'Annuaire & Orientation Sanitaire';
    return 'MEDTRANSFER';
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] overflow-x-hidden">
      <Sidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <div
        className={`flex flex-col min-h-screen min-w-0 w-full transition-[padding] duration-300 ease-in-out ${
          sidebarOpen ? 'md:pl-64' : 'md:pl-0'
        }`}
      >
        <Header
          setMobileOpen={setMobileOpen}
          pageTitle={getPageTitle(location.pathname)}
          sidebarOpen={sidebarOpen}
          toggleSidebar={toggleSidebar}
        />

        <main
          className={`flex-1 p-3.5 sm:p-6 w-full mx-auto min-w-0 space-y-4 transition-all duration-300 ${
            sidebarOpen ? 'max-w-7xl' : 'max-w-full sm:px-8'
          }`}
        >
          <div className="flex items-center">
            <BackButton />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

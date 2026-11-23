import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationContext';
import { Menu, Bell, CheckCheck, Shield, Stethoscope, UserCircle, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { formatDateTime } from '../utils/formatters';

export const Header = ({ setMobileOpen, pageTitle, sidebarOpen, toggleSidebar }) => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifs, setShowNotifs] = useState(false);

  const getRoleIcon = () => {
    if (user?.role === 'MEDECIN') return <Stethoscope className="w-3.5 h-3.5 text-blue-600" />;
    if (user?.role === 'ADMIN') return <Shield className="w-3.5 h-3.5 text-emerald-600" />;
    if (user?.role === 'DIRECTEUR') return <Shield className="w-3.5 h-3.5 text-indigo-600" />;
    return <UserCircle className="w-3.5 h-3.5 text-amber-600" />;
  };

  const getRoleBadge = () => {
    if (user?.role === 'MEDECIN') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (user?.role === 'ADMIN') return 'bg-purple-50 text-purple-700 border-purple-200';
    if (user?.role === 'DIRECTEUR') return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 bg-white border-b border-slate-200/80 sm:px-6 transition-all duration-300">
      {/* Left : Hamburger & Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1 mr-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 text-slate-600 rounded-lg md:hidden hover:bg-slate-100 shrink-0 transition-colors"
          title="Ouvrir le menu"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop & Tablet Sidebar Toggle (>= md) */}
        <button
          onClick={toggleSidebar}
          className={`hidden md:inline-flex items-center justify-center p-2 rounded-lg transition-all shrink-0 ${
            sidebarOpen
              ? 'text-slate-500 hover:text-[#123B5D] hover:bg-slate-100'
              : 'text-[#1976D2] bg-blue-50/80 hover:bg-blue-100 hover:text-[#123B5D] ring-1 ring-blue-200/60'
          }`}
          title={sidebarOpen ? "Masquer le menu" : "Afficher le menu"}
          aria-label={sidebarOpen ? "Masquer le menu" : "Afficher le menu"}
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-5 h-5" />
          ) : (
            <PanelLeftOpen className="w-5 h-5" />
          )}
        </button>

        <h1 className="text-base sm:text-lg font-bold text-[#123B5D] tracking-tight truncate">
          {pageTitle || 'Tableau de bord'}
        </h1>
      </div>

      {/* Right : Notifications & Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className={`relative p-2 transition-colors rounded-lg ${
              showNotifs ? 'text-[#1976D2] bg-blue-50' : 'text-slate-500 hover:text-[#123B5D] hover:bg-slate-100'
            }`}
            title="Centre de notifications"
            aria-expanded={showNotifs}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-rose-600 rounded-full animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <>
              {/* Click-outside backdrop to prevent covering main content permanently */}
              <div
                className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px]"
                onClick={() => setShowNotifs(false)}
                aria-hidden="true"
              />

              {/* Ancrage maîtrisé : fixed sur mobile, absolute sur desktop sans déborder */}
              <div className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-full z-50 mt-1.5 w-[calc(100vw-1.5rem)] max-w-sm sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden transform origin-top-right transition-all">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#123B5D]">
                    Notifications ({unreadCount} non lues)
                  </span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="flex items-center gap-1 text-[11px] font-medium text-[#1976D2] hover:underline"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Tout marquer comme lu</span>
                        <span className="sm:hidden">Tout lire</span>
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifs(false)}
                      className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
                      aria-label="Fermer les notifications"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="max-h-[min(380px,calc(100vh-8rem))] overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-400">
                      Aucune notification pour le moment
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          if (!n.is_read) markAsRead(n.id);
                        }}
                        className={`p-3.5 text-xs transition-colors cursor-pointer ${
                          n.is_read ? 'bg-white hover:bg-slate-50' : 'bg-sky-50/60 hover:bg-sky-50 font-medium'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-semibold text-[#123B5D] truncate">{n.titre}</span>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                            {formatDateTime(n.created_at)}
                          </span>
                        </div>
                        <p className="text-slate-600 line-clamp-2 text-[11px] leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Pill */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-[#123B5D] block leading-tight">
              {user ? `${user.first_name} ${user.last_name}`.trim() || user.username : 'Utilisateur'}
            </span>
            <span className="text-[10px] text-slate-500 block">
              {user?.specialite || user?.matricule_professionnel || 'Personnel hospitalier'}
            </span>
          </div>

          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${getRoleBadge()}`}>
            {getRoleIcon()}
            <span>{user?.role_display || user?.role}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

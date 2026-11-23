import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LoadingSkeleton } from '../components/LoadingSkeleton';

export const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F4F6F9]">
        <div className="w-8 h-8 border-4 border-[#1976D2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Redirection sécurisée vers l'espace autorisé
    if (user.role === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
    if (user.role === 'DIRECTEUR') return <Navigate to="/director/dashboard" replace />;
    if (user.role === 'AGENT') return <Navigate to="/agent/dashboard" replace />;
    return <Navigate to="/doctor/dashboard" replace />;
  }

  return <Outlet />;
};

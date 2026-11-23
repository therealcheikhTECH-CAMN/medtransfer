import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ProtectedRoute } from './ProtectedRoute';
import { Layout } from '../components/Layout';

// Public pages
const HomePage = lazy(() => import('../pages/public/HomePage').then(m => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('../pages/public/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('../pages/public/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('../pages/public/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('../pages/public/ResetPasswordPage').then(m => ({ default: m.ResetPasswordPage })));
const DirectorRegisterPage = lazy(() => import('../pages/public/DirectorRegisterPage').then(m => ({ default: m.DirectorRegisterPage })));
const NotFoundPage = lazy(() => import('../pages/public/NotFoundPage').then(m => ({ default: m.NotFoundPage })));

// Admin pages
const AdminDashboardPage = lazy(() => import('../pages/admin/AdminDashboardPage').then(m => ({ default: m.AdminDashboardPage })));
const UsersManagePage = lazy(() => import('../pages/admin/UsersManagePage').then(m => ({ default: m.UsersManagePage })));
const EstablishmentsManagePage = lazy(() => import('../pages/admin/EstablishmentsManagePage').then(m => ({ default: m.EstablishmentsManagePage })));
const AuditLogsPage = lazy(() => import('../pages/admin/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const DirectorRequestsPage = lazy(() => import('../pages/admin/DirectorRequestsPage').then(m => ({ default: m.DirectorRequestsPage })));

// Director pages
const DirectorDashboardPage = lazy(() => import('../pages/director/DirectorDashboardPage').then(m => ({ default: m.DirectorDashboardPage })));
const MyEstablishmentPage = lazy(() => import('../pages/director/MyEstablishmentPage').then(m => ({ default: m.MyEstablishmentPage })));

// Agent pages
const AgentDashboardPage = lazy(() => import('../pages/agent/AgentDashboardPage').then(m => ({ default: m.AgentDashboardPage })));
const PatientSearchPage = lazy(() => import('../pages/agent/PatientSearchPage').then(m => ({ default: m.PatientSearchPage })));
const PatientCreatePage = lazy(() => import('../pages/agent/PatientCreatePage').then(m => ({ default: m.PatientCreatePage })));
const AgentTransfersPage = lazy(() => import('../pages/agent/AgentTransfersPage').then(m => ({ default: m.AgentTransfersPage })));
const PatientIdentificationPage = lazy(() => import('../pages/agent/PatientIdentificationPage').then(m => ({ default: m.PatientIdentificationPage })));

// Doctor pages
const DoctorDashboardPage = lazy(() => import('../pages/doctor/DoctorDashboardPage').then(m => ({ default: m.DoctorDashboardPage })));
const PatientListPage = lazy(() => import('../pages/doctor/PatientListPage').then(m => ({ default: m.PatientListPage })));
const MedicalRecordDetailPage = lazy(() => import('../pages/doctor/MedicalRecordDetailPage').then(m => ({ default: m.MedicalRecordDetailPage })));
const NewConsultationPage = lazy(() => import('../pages/doctor/NewConsultationPage').then(m => ({ default: m.NewConsultationPage })));
const TransfersPage = lazy(() => import('../pages/doctor/TransfersPage').then(m => ({ default: m.TransfersPage })));
const CareManagementPage = lazy(() => import('../pages/doctor/CareManagementPage').then(m => ({ default: m.CareManagementPage })));

// Common & Orientation
const EstablishmentsDirectoryPage = lazy(() => import('../pages/orientation/EstablishmentsDirectoryPage').then(m => ({ default: m.EstablishmentsDirectoryPage })));
const SecurityPasswordPage = lazy(() => import('../pages/common/SecurityPasswordPage').then(m => ({ default: m.SecurityPasswordPage })));

const PageLoader = () => (
  <div className="flex items-center justify-center p-12">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-4 border-[#1976D2] border-t-transparent rounded-full animate-spin" />
      <span className="text-xs font-semibold text-[#123B5D]">Chargement du module...</span>
    </div>
  </div>
);

export const AppRoutes = () => {
  const { user, loading } = useAuth();

  const getHomeRedirect = () => {
    if (!user) return '/login';
    if (user.role === 'ADMIN') return '/admin/dashboard';
    if (user.role === 'DIRECTEUR') return '/director/dashboard';
    if (user.role === 'AGENT') return '/agent/dashboard';
    return '/doctor/dashboard';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F4F6F9]">
        <div className="w-8 h-8 border-4 border-[#1976D2] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={user ? <Navigate to={getHomeRedirect()} replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to={getHomeRedirect()} replace /> : <RegisterPage />} />
        <Route path="/register-director" element={user ? <Navigate to={getHomeRedirect()} replace /> : <DirectorRegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Root redirection based on role */}
        <Route path="/" element={<HomePage />} />

        {/* Protected Layout Area */}
        <Route element={<Layout />}>
          {/* 1. ESPACE ADMINISTRATEUR */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN']} />}>
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<UsersManagePage />} />
            <Route path="/admin/establishments" element={<EstablishmentsManagePage />} />
            <Route path="/admin/audit" element={<AuditLogsPage />} />
            <Route path="/admin/director-requests" element={<DirectorRequestsPage />} />
          </Route>

          {/* 1bis. ESPACE DIRECTEUR D'ÉTABLISSEMENT */}
          <Route element={<ProtectedRoute allowedRoles={['DIRECTEUR']} />}>
            <Route path="/director/dashboard" element={<DirectorDashboardPage />} />
            <Route path="/director/my-establishment" element={<MyEstablishmentPage />} />
          </Route>

          {/* 2. ESPACE AGENT D'ACCUEIL */}
          <Route element={<ProtectedRoute allowedRoles={['AGENT']} />}>
            <Route path="/agent/dashboard" element={<AgentDashboardPage />} />
            <Route path="/agent/search" element={<PatientSearchPage />} />
            <Route path="/agent/create-patient" element={<PatientCreatePage />} />
            <Route path="/agent/transfers" element={<AgentTransfersPage />} />
            <Route path="/agent/patients/:id/identification" element={<PatientIdentificationPage />} />
          </Route>

          {/* 3. ESPACE MÉDECIN */}
          <Route element={<ProtectedRoute allowedRoles={['MEDECIN']} />}>
            <Route path="/doctor/dashboard" element={<DoctorDashboardPage />} />
            <Route path="/doctor/patients" element={<PatientListPage />} />
            <Route path="/doctor/patients/:id" element={<MedicalRecordDetailPage />} />
            <Route path="/doctor/consultations/new" element={<NewConsultationPage />} />
            <Route path="/doctor/transfers" element={<TransfersPage />} />
            <Route path="/doctor/care-management" element={<CareManagementPage />} />
          </Route>

          {/* 4. ORIENTATION, ANNUAIRE & SÉCURITÉ DU MOT DE PASSE (TOUS RÔLES AUTHENTIFIÉS) */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'DIRECTEUR', 'AGENT', 'MEDECIN']} />}>
            <Route path="/orientation/establishments" element={<EstablishmentsDirectoryPage />} />
            <Route path="/patients/:id/identification" element={<PatientIdentificationPage />} />
            <Route path="/security" element={<SecurityPasswordPage />} />
          </Route>
        </Route>

        {/* 404 Catch-All */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
};

import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { BackButton } from '../../components/BackButton';
import { Activity, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Jeton de réinitialisation manquant dans l\'URL.');
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setError('Les deux champs de mot de passe ne correspondent pas.');
      return;
    }

    try {
      setSubmitting(true);
      await authService.confirmPasswordReset({
        token,
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login?reset_success=true'), 2000);
    } catch (err) {
      console.error(err);
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const msg = Object.values(data)
          .map((v) => (Array.isArray(v) ? v.join(' ') : String(v)))
          .join(' ');
        setError(msg || 'Ce lien est invalide, déjà utilisé ou expiré.');
      } else {
        setError('Impossible de réinitialiser le mot de passe.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto">
        <div className="flex items-center justify-between mb-6">
          <BackButton fallback="/login" />
          <Link to="/login" className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#1976D2] text-white shadow">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-lg font-black text-[#123B5D]">MEDTRANSFER</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
          <h1 className="text-xl font-bold text-[#123B5D] mb-1">
            Définir un nouveau mot de passe
          </h1>
          <p className="text-xs text-[#64748B] mb-6">
            Choisissez un nouveau mot de passe robuste d'au moins 8 caractères. Ce lien est à usage unique.
          </p>

          {success ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Votre mot de passe a été réinitialisé avec succès ! Redirection vers la page de connexion...</span>
              </div>
              <Link
                to="/login"
                className="flex items-center justify-center w-full px-4 py-2.5 text-xs font-semibold text-white bg-[#1976D2] rounded-xl"
              >
                Se connecter maintenant
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {error && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1.5">
                  Nouveau mot de passe *
                </label>
                <div className="relative">
                  <Lock className="absolute w-4 h-4 text-slate-400 left-3.5 top-3" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Minimum 8 caractères robustes"
                    className="w-full pl-10 pr-4 py-2.5 bg-white text-sm rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1.5">
                  Confirmation du nouveau mot de passe *
                </label>
                <div className="relative">
                  <Lock className="absolute w-4 h-4 text-slate-400 left-3.5 top-3" />
                  <input
                    type="password"
                    value={newPasswordConfirm}
                    onChange={(e) => setNewPasswordConfirm(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Confirmez le nouveau mot de passe"
                    className="w-full pl-10 pr-4 py-2.5 bg-white text-sm rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                {submitting ? 'Validation en cours...' : 'Enregistrer le nouveau mot de passe'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

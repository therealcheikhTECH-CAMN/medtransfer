import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { authService } from '../../services/authService';
import { Lock, ShieldCheck, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';

export const SecurityPasswordPage = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    setFieldErrors({});

    if (newPassword !== newPasswordConfirm) {
      setFieldErrors({
        new_password_confirm: 'La confirmation du nouveau mot de passe ne correspond pas.',
      });
      return;
    }

    try {
      setSubmitting(true);
      const res = await authService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        new_password_confirm: newPasswordConfirm,
      });

      // Afficher la confirmation uniquement si la modification a réellement réussi
      setSuccessMessage(
        res.message || 'Votre mot de passe a été modifié avec succès. Vos sessions antérieures ont été invalidées.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (err) {
      console.error(err);
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const mapped = {};
        Object.entries(data).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? v.join(' ') : String(v);
        });
        setFieldErrors(mapped);
        setErrorMessage(
          mapped.current_password ||
            mapped.new_password ||
            mapped.new_password_confirm ||
            mapped.detail ||
            'La modification du mot de passe a été refusée.'
        );
      } else {
        setErrorMessage('Impossible de modifier le mot de passe. Veuillez réessayer.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#1976D2]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#123B5D]">Sécurité et mot de passe</h2>
            <p className="text-xs text-[#64748B]">
              Gérez la sécurité de votre compte professionnel ({user?.email || user?.username}).
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-[#1976D2]" />
          <h3 className="text-sm font-bold text-[#123B5D] uppercase tracking-wider">
            Modification du mot de passe
          </h3>
        </div>

        {successMessage && (
          <div className="flex items-start gap-2.5 p-4 mb-5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-start gap-2.5 p-4 mb-5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1.5">
              Mot de passe actuel *
            </label>
            <div className="relative">
              <Lock className="absolute w-4 h-4 text-slate-400 left-3.5 top-3" />
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Saisissez votre mot de passe actuel"
                className="w-full pl-10 pr-4 py-2.5 bg-white text-sm rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
              />
            </div>
            {fieldErrors.current_password && (
              <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.current_password}</p>
            )}
          </div>

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
                placeholder="Minimum 8 caractères (lettres, chiffres ou caractères spéciaux)"
                className="w-full pl-10 pr-4 py-2.5 bg-white text-sm rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
              />
            </div>
            {fieldErrors.new_password && (
              <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.new_password}</p>
            )}
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
                placeholder="Confirmez votre nouveau mot de passe"
                className="w-full pl-10 pr-4 py-2.5 bg-white text-sm rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
              />
            </div>
            {fieldErrors.new_password_confirm && (
              <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.new_password_confirm}</p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {submitting ? 'Mise à jour en cours...' : 'Modifier mon mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

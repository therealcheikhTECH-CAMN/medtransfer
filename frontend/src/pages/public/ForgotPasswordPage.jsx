import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { BackButton } from '../../components/BackButton';
import { Activity, Mail, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedMessage, setSubmittedMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setSubmitting(true);
      const res = await authService.requestPasswordReset(email.trim());
      setSubmittedMessage(
        res.message ||
          'Si un compte professionnel actif correspond à cette adresse e-mail, un lien de réinitialisation temporaire et à usage unique vous a été envoyé.'
      );
    } catch (err) {
      console.error(err);
      setError('Impossible de traiter la demande pour le moment. Veuillez vérifier votre adresse e-mail.');
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
          <div className="flex items-center gap-2.5 mb-2">
            <KeyRound className="w-5 h-5 text-[#1976D2]" />
            <h1 className="text-xl font-bold text-[#123B5D]">Mot de passe oublié ?</h1>
          </div>
          <p className="text-xs text-[#64748B] mb-6">
            Saisissez votre adresse e-mail professionnelle. Vous recevrez un lien sécurisé temporaire à usage unique pour définir un nouveau mot de passe.
          </p>

          {submittedMessage ? (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{submittedMessage}</span>
              </div>
              <Link
                to="/login"
                className="flex items-center justify-center w-full px-4 py-2.5 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl transition-colors"
              >
                Retour à la connexion
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
                  Adresse e-mail professionnelle *
                </label>
                <div className="relative">
                  <Mail className="absolute w-4 h-4 text-slate-400 left-3.5 top-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="prenom.nom@hopital.sn"
                    className="w-full pl-10 pr-4 py-2.5 bg-white text-sm rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-sm transition-colors disabled:opacity-50"
              >
                {submitting ? 'Envoi en cours...' : 'Envoyer le lien de réinitialisation'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

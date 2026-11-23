import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  Activity,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Stethoscope,
  Building2,
  UserPlus,
  Eye,
  EyeOff,
  FileText,
  Users,
  Ambulance,
  CheckCircle2,
} from 'lucide-react';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const sessionExpired = new URLSearchParams(location.search).get('session_expired');
  const passwordResetSuccess = new URLSearchParams(location.search).get('reset_success');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Veuillez renseigner votre adresse e-mail professionnelle et votre mot de passe.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      const user = await login(email, password);

      // Redirection personnalisée selon les 4 rôles métier
      if (user.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else if (user.role === 'DIRECTEUR') {
        navigate('/director/dashboard');
      } else if (user.role === 'AGENT') {
        navigate('/agent/dashboard');
      } else {
        navigate('/doctor/dashboard');
      }
    } catch (err) {
      console.error(err);
      const backendDetail =
        err.response?.data?.detail ||
        (Array.isArray(err.response?.data?.non_field_errors) && err.response.data.non_field_errors[0]);
      if (backendDetail) {
        setError(backendDetail);
      } else if (err.response?.status === 401) {
        setError('Identifiants incorrects ou compte non validé. Vérifiez votre adresse e-mail et votre mot de passe.');
      } else {
        setError('Impossible de se connecter au serveur backend. Vérifiez que Django est actif.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F4F6F9] selection:bg-[#1976D2]/20 selection:text-[#123B5D]">
      {/* =========================================================================
          PANNEAU GAUCHE — IDENTITÉ VISUELLE ET PRÉSENTATION INSTITUTIONNELLE
          Bleu profond, typographie blanche, photographie d'hôpital et motifs médicaux
         ========================================================================= */}
      <div className="relative w-full lg:w-[45%] xl:w-[44%] 2xl:w-[42%] bg-gradient-to-br from-[#0D3150] via-[#123B5D] to-[#075A91] text-white flex flex-col justify-between p-6 sm:p-10 xl:p-12 overflow-hidden shrink-0">
        {/* Halos lumineux d'ambiance */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#1976D2]/25 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 -right-24 w-80 h-80 rounded-full bg-[#21A8E8]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-12 w-96 h-96 rounded-full bg-[#0D3150]/60 blur-3xl pointer-events-none" />

        {/* En-tête : Logo, Nom et Slogan */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex items-center gap-3.5 group">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#1976D2] to-[#21A8E8] shadow-xl shadow-[#1976D2]/30 group-hover:scale-105 transition-transform shrink-0">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-white block">
                MEDTRANSFER
              </span>
              <span className="text-[11px] sm:text-xs font-medium tracking-wide text-sky-200 block max-w-sm leading-tight">
                Plateforme de gestion de l'historique médical et d'orientation des patients.
              </span>
            </div>
          </Link>

          {/* Titre principal & Paragraphe descriptif */}
          <div className="mt-8 lg:mt-12 xl:mt-14 max-w-lg">
            <h1 className="text-2xl sm:text-3xl xl:text-4xl font-extrabold text-white leading-tight tracking-tight">
              Continuité du dossier médical et orientation sécurisée des patients.
            </h1>
            <p className="mt-4 text-xs sm:text-sm text-slate-200/90 leading-relaxed font-normal">
              Une infrastructure centralisée unique reliant les établissements de santé,
              garantissant l'intégrité de l'historique de soins, la gestion des transferts et l'accès d'urgence vital.
            </p>
          </div>
        </div>

        {/* Illustration hospitalière & Motifs graphiques médicaux */}
        <div className="relative z-10 my-6 lg:my-8">
          <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-[#0D3150]/80 max-w-md group">
            {/* Photographie hospitalière locale de haute qualité */}
            <img
              src="/images/hospital-building.jpg"
              alt="Établissement Hospitalier Partenaire MEDTRANSFER"
              className="w-full h-40 sm:h-48 xl:h-52 object-cover object-center group-hover:scale-105 transition-transform duration-700 opacity-90"
            />
            {/* Dégradé pour une intégration naturelle au fond bleu */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0D3150] via-[#0D3150]/30 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#123B5D]/40 via-transparent to-transparent" />

            {/* Tracé ECG lumineux sur l'illustration */}
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none">
              <svg viewBox="0 0 200 40" className="w-32 h-6 text-[#21A8E8] opacity-85" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M0 20 L40 20 L50 20 L55 6 L65 34 L75 10 L85 24 L90 20 L130 20 L135 14 L145 28 L150 20 L200 20" />
              </svg>
              <span className="text-[10px] font-bold text-sky-200 uppercase tracking-wider backdrop-blur-xs px-2 py-0.5 rounded-md bg-black/30 border border-white/15">
                Réseau hospitalier actif
              </span>
            </div>
          </div>

          {/* Symboles médicaux discrets avec transparence adaptée */}
          <div className="grid grid-cols-3 gap-2.5 mt-3 max-w-md">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
              <div className="w-7 h-7 rounded-lg bg-[#1976D2]/60 flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5 text-sky-200" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-white block leading-tight truncate">Dossier unique</span>
                <span className="text-[9px] text-sky-200 block truncate">Temps réel</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
              <div className="w-7 h-7 rounded-lg bg-[#21A8E8]/40 flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-white block leading-tight truncate">Coordination</span>
                <span className="text-[9px] text-sky-200 block truncate">Inter-hôpitaux</span>
              </div>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/40 flex items-center justify-center shrink-0">
                <Ambulance className="w-3.5 h-3.5 text-emerald-200" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-white block leading-tight truncate">Transferts</span>
                <span className="text-[9px] text-emerald-200 block truncate">Priorité vitale</span>
              </div>
            </div>
          </div>
        </div>

        {/* Mention inférieure avec icône de bouclier et ligne cyan décorative */}
        <div className="relative z-10 pt-4 border-t border-white/15">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-[#21A8E8] shrink-0" />
            <span className="text-xs font-semibold text-white">
              Une plateforme au service de la continuité des soins.
            </span>
          </div>
          <div className="h-[2px] w-48 bg-gradient-to-r from-[#21A8E8] via-[#1976D2] to-transparent rounded-full" />
        </div>

        {/* Séparation organique légèrement courbée sur grand écran */}
        <div className="absolute top-0 bottom-0 -right-[1px] w-8 xl:w-12 pointer-events-none hidden lg:block overflow-hidden z-20">
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="w-full h-full text-[#F4F6F9] fill-current"
          >
            <path d="M100,0 C20,25 20,75 100,100 L100,0 Z" />
          </svg>
        </div>
      </div>

      {/* =========================================================================
          PANNEAU DROIT — ESPACE PROFESSIONNEL SÉCURISÉ
          Conteneur blanc spacieux, formulaire de connexion et cartes d'inscription
         ========================================================================= */}
      <div className="w-full lg:w-[55%] xl:w-[56%] 2xl:w-[58%] flex-1 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-10 xl:p-12 overflow-y-auto">
        <div className="w-full max-w-xl bg-white rounded-3xl shadow-xl shadow-slate-200/70 border border-blue-100/90 p-6 sm:p-9 my-auto">
          {/* Barre supérieure : Bouton retour et badge de statut */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-semibold text-[#123B5D] bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-[#1976D2]/40 rounded-xl shadow-xs hover:shadow-sm transition-all group focus:outline-hidden focus:ring-2 focus:ring-[#1976D2]/20 shrink-0 cursor-pointer"
              title="Retour à l'accueil"
              aria-label="Retour à l'accueil"
            >
              <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1976D2] group-hover:-translate-x-0.5 transition-transform shrink-0" />
              <span>Retour</span>
            </button>
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EAF3FB] border border-blue-200/70 text-[11px] font-semibold text-[#1976D2]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1976D2]" />
              <span>Espace certifié & sécurisé</span>
            </div>
          </div>

          {/* En-tête de connexion */}
          <div className="flex items-start gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-50 to-[#EAF3FB] border border-blue-200/80 flex items-center justify-center text-[#1976D2] shrink-0 shadow-xs">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#123B5D] tracking-tight">
                Espace Professionnel Sécurisé
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#64748B]">
                Connectez-vous avec votre adresse e-mail professionnelle et votre mot de passe validé.
              </p>
            </div>
          </div>

          {/* Bandeaux d'information et d'erreur dynamiques */}
          {sessionExpired && (
            <div className="p-3.5 mb-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Votre session a expiré pour des raisons de sécurité. Veuillez vous reconnecter.</span>
            </div>
          )}

          {passwordResetSuccess && (
            <div className="p-3.5 mb-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Votre mot de passe a été réinitialisé avec succès. Vous pouvez maintenant vous connecter.</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-rose-50/90 border border-rose-200/90 text-xs text-rose-800 shadow-xs">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          {/* Formulaire de connexion */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Champ Adresse e-mail professionnelle */}
            <div>
              <label className="block text-[11px] font-bold text-[#123B5D] uppercase tracking-wider mb-1.5">
                ADRESSE E-MAIL PROFESSIONNELLE
              </label>
              <div className="relative">
                <Mail className="absolute w-4 h-4 text-slate-400 left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom.prenom@etablissement.sn"
                  className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-[#EAF3FB]/40 hover:bg-[#EAF3FB]/60 focus:bg-white text-sm text-[#123B5D] rounded-xl border border-blue-200/80 focus:border-[#1976D2] focus:ring-3 focus:ring-[#1976D2]/15 outline-none transition-all placeholder:text-slate-400 font-medium"
                  required
                />
              </div>
            </div>

            {/* Champ Mot de passe avec toggle masquer / afficher */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold text-[#123B5D] uppercase tracking-wider">
                  MOT DE PASSE
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-semibold text-[#1976D2] hover:text-[#1565C0] hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute w-4 h-4 text-slate-400 left-3.5 top-3.5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-2.5 sm:py-3 bg-[#EAF3FB]/40 hover:bg-[#EAF3FB]/60 focus:bg-white text-sm text-[#123B5D] rounded-xl border border-blue-200/80 focus:border-[#1976D2] focus:ring-3 focus:ring-[#1976D2]/15 outline-none transition-all placeholder:text-slate-400 font-medium"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-slate-400 hover:text-[#1976D2] transition-colors p-0.5 rounded-md focus:outline-none"
                  title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Bouton principal de connexion sécurisée */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center w-full gap-2.5 px-6 py-3.5 mt-2 text-sm font-bold text-white transition-all rounded-xl bg-[#1976D2] hover:bg-[#1565C0] shadow-md shadow-[#1976D2]/25 hover:shadow-lg hover:shadow-[#1976D2]/35 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                  <span>Connexion en cours...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Connexion sécurisée</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* =====================================================================
              CARTES D'INSCRIPTION ET DE DEMANDE D'ACCÈS
             ===================================================================== */}
          <div className="mt-6 space-y-3">
            {/* Carte 1 : Inscription des professionnels de santé */}
            <div className="p-4 rounded-2xl bg-white border border-blue-200/80 hover:border-[#1976D2]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#1976D2] shrink-0">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-bold text-[#123B5D] block">
                    Nouveau professionnel de santé ?
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#64748B] block mt-0.5">
                    Médecin ou agent d'accueil, demandez votre accès à MEDTRANSFER.
                  </span>
                </div>
              </div>
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-[#1976D2] bg-[#EAF3FB] hover:bg-blue-100 rounded-xl border border-blue-200 shrink-0 transition-colors self-end sm:self-auto"
              >
                <UserPlus className="w-3.5 h-3.5" />
                S'inscrire
              </Link>
            </div>

            {/* Carte 2 : Demande d'accès directeur d'établissement */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#EAF3FB]/90 to-sky-50/70 border border-blue-200 hover:border-[#1976D2]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center text-[#123B5D] shrink-0 shadow-xs">
                  <Building2 className="w-5 h-5 text-[#1976D2]" />
                </div>
                <div>
                  <span className="text-xs sm:text-sm font-bold text-[#123B5D] block">
                    Vous êtes directeur d'un établissement ?
                  </span>
                  <span className="text-[11px] sm:text-xs text-[#64748B] block mt-0.5">
                    Demandez un accès directeur soumis à validation de l'administrateur général.
                  </span>
                </div>
              </div>
              <Link
                to="/register-director"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-[#123B5D] bg-white hover:bg-slate-50 rounded-xl border border-slate-300 shrink-0 transition-colors shadow-xs self-end sm:self-auto"
              >
                <Building2 className="w-3.5 h-3.5 text-[#1976D2]" />
                Demander un accès directeur
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

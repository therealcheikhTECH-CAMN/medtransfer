import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { establishmentService } from '../../services/establishmentService';
import { BackButton } from '../../components/BackButton';
import { SearchableEstablishmentSelect } from '../../components/SearchableEstablishmentSelect';
import {
  Activity,
  UserPlus,
  Mail,
  Phone,
  Lock,
  Stethoscope,
  FileText,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

export const RegisterPage = () => {
  const [establishments, setEstablishments] = useState([]);
  const [loadingEstabs, setLoadingEstabs] = useState(true);
  const [estabsError, setEstabsError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [registeredUser, setRegisteredUser] = useState(null);

  const [formData, setFormData] = useState({
    last_name: '',
    first_name: '',
    email: '',
    telephone: '',
    role: 'MEDECIN',
    etablissement: '',
    matricule_professionnel: '',
    specialite: '',
    justificatif: '',
    password: '',
    password_confirm: '',
  });

  const loadEstablishments = useCallback(async () => {
    try {
      setLoadingEstabs(true);
      setEstabsError('');
      const list = await establishmentService.getPublicList();
      const activeEstablishments = (Array.isArray(list) ? list : []).filter(
        (e) => e && e.id && e.is_active !== false
      );
      setEstablishments(activeEstablishments);
    } catch (err) {
      console.error(err);
      setEstablishments([]);
      setEstabsError(
        "Impossible de récupérer la liste des établissements de santé. Vérifiez que le serveur backend est accessible."
      );
    } finally {
      setLoadingEstabs(false);
    }
  }, []);

  useEffect(() => {
    loadEstablishments();
  }, [loadEstablishments]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const selectedEstablishmentId = Number(formData.etablissement);
  const hasValidEstablishmentSelected =
    !loadingEstabs &&
    !estabsError &&
    Number.isInteger(selectedEstablishmentId) &&
    selectedEstablishmentId > 0 &&
    establishments.some((e) => Number(e.id) === selectedEstablishmentId);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!hasValidEstablishmentSelected) {
      setFieldErrors({
        etablissement: 'Veuillez sélectionner un établissement de santé valide dans la liste.',
      });
      return;
    }

    if (formData.password !== formData.password_confirm) {
      setFieldErrors({ password_confirm: 'Les deux champs de mot de passe ne correspondent pas.' });
      return;
    }

    try {
      setSubmitting(true);
      const res = await authService.register({
        ...formData,
        etablissement: selectedEstablishmentId,
      });
      setRegisteredUser(res.user);
    } catch (err) {
      console.error(err);
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const mapped = {};
        Object.entries(data).forEach(([k, v]) => {
          mapped[k] = Array.isArray(v) ? v.join(' ') : String(v);
        });
        setFieldErrors(mapped);
        setError(
          mapped.non_field_errors ||
            mapped.detail ||
            'Veuillez corriger les erreurs signalées dans le formulaire.'
        );
      } else {
        setError("Une erreur est survenue lors de l'enregistrement de votre demande.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] py-8 px-4 sm:px-6 lg:px-8 flex flex-col justify-center">
      <div className="max-w-2xl w-full mx-auto">
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
          {registeredUser ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-[#123B5D]">
                Demande d'inscription transmise au directeur
              </h2>
              <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
                Bonjour <strong className="text-[#123B5D]">{registeredUser.first_name} {registeredUser.last_name}</strong>, votre demande d'inscription professionnelle a bien été enregistrée pour l'établissement{' '}
                <strong className="text-[#123B5D]">{registeredUser.etablissement_details?.nom}</strong>.
              </p>
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 max-w-lg mx-auto text-left space-y-1.5">
                <p className="font-bold">Activation soumise à validation :</p>
                <p>
                  Votre compte reste inactif (statut <code className="font-mono font-bold">PENDING</code>) tant que le directeur de votre établissement n'a pas validé votre demande.
                </p>
                <p>
                  Dès validation, vous recevrez un e-mail de confirmation à l'adresse{' '}
                  <strong>{registeredUser.email}</strong> et pourrez vous connecter avec le mot de passe que vous avez défini.
                </p>
              </div>
              <div className="pt-4">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-sm transition-colors"
                >
                  Retourner à la page de connexion
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2.5 mb-1">
                  <UserPlus className="w-5 h-5 text-[#1976D2]" />
                  <h1 className="text-xl font-bold text-[#123B5D]">
                    Inscription Professionnelle
                  </h1>
                </div>
                <p className="text-xs text-[#64748B]">
                  Réservé exclusivement aux médecins et agents d'accueil hospitaliers. Votre compte sera activé après validation par le directeur de votre établissement.
                </p>
              </div>

              <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900">
                <ShieldAlert className="w-4 h-4 text-[#1976D2] shrink-0 mt-0.5" />
                <span>
                  Les patients ne peuvent pas s'inscrire sur la plateforme. Votre mot de passe est chiffré de manière irréversible et n'est jamais communiqué au directeur ni par e-mail.
                </span>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 p-3.5 mb-5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1">
                      Nom *
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      required
                      placeholder="ex: Diallo"
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
                    />
                    {fieldErrors.last_name && (
                      <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.last_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1">
                      Prénom *
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      required
                      placeholder="ex: Mamadou"
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
                    />
                    {fieldErrors.first_name && (
                      <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.first_name}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1">
                      Adresse e-mail professionnelle *
                    </label>
                    <div className="relative">
                      <Mail className="absolute w-4 h-4 text-slate-400 left-3 top-2.5" />
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        placeholder="prenom.nom@hopital.sn"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
                      />
                    </div>
                    {fieldErrors.email && (
                      <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.email}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1">
                      Numéro de téléphone *
                    </label>
                    <div className="relative">
                      <Phone className="absolute w-4 h-4 text-slate-400 left-3 top-2.5" />
                      <input
                        type="tel"
                        name="telephone"
                        value={formData.telephone}
                        onChange={handleChange}
                        required
                        placeholder="+221 77 000 00 00"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
                      />
                    </div>
                    {fieldErrors.telephone && (
                      <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.telephone}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1">
                      Fonction *
                    </label>
                    <div className="relative">
                      <Stethoscope className="absolute w-4 h-4 text-slate-400 left-3 top-2.5" />
                      <select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        required
                        className="w-full pl-9 pr-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
                      >
                        <option value="MEDECIN">Médecin</option>
                        <option value="AGENT">Agent d'accueil</option>
                      </select>
                    </div>
                    {fieldErrors.role && (
                      <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.role}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1">
                      Établissement de santé *
                    </label>
                    <SearchableEstablishmentSelect
                      name="etablissement"
                      establishments={establishments}
                      value={formData.etablissement}
                      onChange={handleChange}
                      loading={loadingEstabs}
                      error={estabsError}
                      onRetry={loadEstablishments}
                      fieldError={fieldErrors.etablissement}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1">
                      Numéro professionnel ou matricule (si applicable)
                    </label>
                    <input
                      type="text"
                      name="matricule_professionnel"
                      value={formData.matricule_professionnel}
                      onChange={handleChange}
                      placeholder="ex: ONMS-2026-104 ou AG-HRZ-012"
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
                    />
                    {fieldErrors.matricule_professionnel && (
                      <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.matricule_professionnel}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1">
                      Spécialité / Service
                    </label>
                    <input
                      type="text"
                      name="specialite"
                      value={formData.specialite}
                      onChange={handleChange}
                      placeholder="ex: Cardiologie, Urgences, Admissions"
                      className="w-full px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1">
                    Justificatifs professionnels (références d'inscription à l'Ordre / arrêté d'affectation)
                  </label>
                  <div className="relative">
                    <FileText className="absolute w-4 h-4 text-slate-400 left-3 top-2.5" />
                    <textarea
                      name="justificatif"
                      rows={2}
                      value={formData.justificatif}
                      onChange={handleChange}
                      placeholder="Précisez vos références professionnelles vérifiables par le directeur de l'établissement..."
                      className="w-full pl-9 pr-3.5 py-2 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1">
                      Mot de passe *
                    </label>
                    <div className="relative">
                      <Lock className="absolute w-4 h-4 text-slate-400 left-3 top-2.5" />
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        minLength={8}
                        placeholder="Min. 8 caractères robustes"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
                      />
                    </div>
                    {fieldErrors.password && (
                      <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.password}</p>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-[#123B5D] uppercase tracking-wider text-[11px] mb-1">
                      Confirmation du mot de passe *
                    </label>
                    <div className="relative">
                      <Lock className="absolute w-4 h-4 text-slate-400 left-3 top-2.5" />
                      <input
                        type="password"
                        name="password_confirm"
                        value={formData.password_confirm}
                        onChange={handleChange}
                        required
                        minLength={8}
                        placeholder="Répétez le mot de passe"
                        className="w-full pl-9 pr-3.5 py-2.5 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] outline-none"
                      />
                    </div>
                    {fieldErrors.password_confirm && (
                      <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.password_confirm}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <Link
                    to="/login"
                    className="text-xs font-semibold text-slate-600 hover:text-[#123B5D]"
                  >
                    Déjà inscrit ? Se connecter
                  </Link>
                  <button
                    type="submit"
                    disabled={submitting || !hasValidEstablishmentSelected}
                    className="inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Transmission en cours...' : "Soumettre ma demande d'inscription"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

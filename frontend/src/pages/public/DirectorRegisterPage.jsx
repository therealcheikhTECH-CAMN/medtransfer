import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import { establishmentService } from '../../services/establishmentService';
import { BackButton } from '../../components/BackButton';
import { SearchableEstablishmentSelect } from '../../components/SearchableEstablishmentSelect';
import {
  Activity,
  Building2,
  Mail,
  Phone,
  Lock,
  FileText,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Briefcase,
  User,
  ArrowRight,
} from 'lucide-react';

export const DirectorRegisterPage = () => {
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
    fonction: '',
    etablissement: '',
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

  const handleEstablishmentChange = (e, directId) => {
    const rawVal = directId !== undefined ? directId : (e && typeof e === 'object' && 'target' in e ? e.target.value : e);
    const selectedId = rawVal ? String(rawVal) : '';
    setFormData((prev) => ({ ...prev, etablissement: selectedId }));
    if (fieldErrors.etablissement) {
      setFieldErrors((prev) => ({ ...prev, etablissement: null }));
    }
  };

  const selectedEstablishmentId = Number(
    typeof formData.etablissement === 'object' && formData.etablissement !== null
      ? (formData.etablissement.target?.value ?? formData.etablissement.id)
      : formData.etablissement
  );
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
        etablissement: "Veuillez sélectionner l'établissement de santé que vous dirigez.",
      });
      return;
    }

    if (!formData.fonction.trim()) {
      setFieldErrors({
        fonction: "Veuillez renseigner votre fonction officielle au sein de l'établissement.",
      });
      return;
    }

    if (formData.password !== formData.password_confirm) {
      setFieldErrors({ password_confirm: "Les deux champs de mot de passe ne correspondent pas." });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        first_name: formData.first_name.trim(),
        last_name: formData.last_name.trim(),
        email: formData.email.trim().toLowerCase(),
        telephone: formData.telephone.trim(),
        fonction: formData.fonction.trim(),
        etablissement: selectedEstablishmentId,
        justificatif: formData.justificatif.trim(),
        password: formData.password,
        password_confirm: formData.password_confirm,
      };

      const res = await authService.registerDirector(payload);
      setRegisteredUser(res.user || payload);
    } catch (err) {
      console.error(err);
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'object' && !Array.isArray(data)) {
          const errors = {};
          Object.keys(data).forEach((key) => {
            const val = data[key];
            errors[key] = Array.isArray(val) ? val.join(' ') : String(val);
          });
          setFieldErrors(errors);
          if (data.detail) {
            setError(data.detail);
          } else if (data.non_field_errors) {
            setError(Array.isArray(data.non_field_errors) ? data.non_field_errors.join(' ') : data.non_field_errors);
          }
        } else {
          setError("Une erreur est survenue lors de l'enregistrement de votre demande.");
        }
      } else {
        setError("Impossible de joindre le serveur. Vérifiez votre connexion.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const selectedEtabObj = establishments.find((e) => Number(e.id) === selectedEstablishmentId);

  return (
    <div className="min-h-screen bg-[#F4F6F9] py-10 px-4 sm:px-6">
      <div className="max-w-2xl mx-auto">
        {/* Navigation retour */}
        <div className="mb-6 flex items-center justify-between">
          <BackButton to="/login" label="Retour à la connexion" />
          <div className="flex items-center gap-2 text-xs font-semibold text-[#123B5D]">
            <Activity className="w-4 h-4 text-[#1976D2]" />
            <span>MEDTRANSFER Direction</span>
          </div>
        </div>

        {registeredUser ? (
          /* Écran de confirmation de la demande de directeur */
          <div className="bg-white p-8 rounded-2xl border border-slate-200/80 shadow-md text-center space-y-6">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                Demande transmise avec succès
              </span>
              <h2 className="text-2xl font-black text-[#123B5D]">
                Demande d'accès Directeur enregistrée
              </h2>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Votre demande a bien été soumise et transmise à l'<strong>Administrateur Général</strong> de MEDTRANSFER.
              </p>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 text-left space-y-3 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Demandeur :</span>
                <span className="font-bold text-slate-800">
                  {registeredUser.first_name} {registeredUser.last_name}
                </span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">E-mail professionnel :</span>
                <span className="font-mono font-bold text-[#1976D2]">{registeredUser.email}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Fonction déclarée :</span>
                <span className="font-bold text-slate-800">{registeredUser.fonction || 'Directeur'}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-200/60">
                <span className="text-slate-500 font-medium">Établissement :</span>
                <span className="font-bold text-[#123B5D]">
                  {selectedEtabObj?.nom || registeredUser.etablissement_details?.nom || 'Établissement sélectionné'}
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-slate-500 font-medium">Statut de la demande :</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                  En attente de validation
                </span>
              </div>
            </div>

            <div className="p-4 bg-sky-50/70 border border-sky-200 text-sky-900 text-xs rounded-xl flex items-start gap-3 text-left">
              <ShieldCheck className="w-5 h-5 text-[#1976D2] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold">Processus de vérification et activation :</span>
                <p className="text-[11px] text-sky-800 leading-relaxed">
                  Conformément à la politique de sécurité, un établissement hospitalier ne peut avoir qu'un seul directeur actif. Dès que l'Administrateur Général aura validé votre demande, un <strong>e-mail de confirmation</strong> vous sera automatiquement envoyé à l'adresse indiquée pour vous permettre de vous connecter.
                </p>
              </div>
            </div>

            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#1976D2] hover:bg-[#1565C0] text-white text-xs font-semibold rounded-xl shadow-md transition-all"
            >
              Retour à la page de connexion
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          /* Formulaire de demande d'accès directeur */
          <div className="bg-white p-7 sm:p-9 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-blue-50 text-[#1976D2] rounded-xl shadow-xs">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#1976D2]">
                    Direction Hospitalière
                  </span>
                  <h1 className="text-xl font-black text-[#123B5D]">
                    Demande d'accès Directeur d'Établissement
                  </h1>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Formulaire officiel de demande de compte directeur. Toute demande est soumise à la vérification et à la validation préalable de l'Administrateur Général.
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Établissement de santé dirigé */}
              <div>
                <label className="block text-xs font-bold text-[#123B5D] mb-1.5">
                  Établissement de santé dirigé *
                </label>
                <SearchableEstablishmentSelect
                  name="etablissement"
                  establishments={establishments}
                  value={formData.etablissement}
                  onChange={handleEstablishmentChange}
                  loading={loadingEstabs}
                  error={estabsError}
                  onRetry={loadEstablishments}
                  fieldError={fieldErrors.etablissement}
                  disabled={loadingEstabs || submitting}
                  placeholder={
                    loadingEstabs
                      ? "Chargement du référentiel des hôpitaux..."
                      : "Rechercher un établissement par nom ou ville..."
                  }
                  required
                />
                {fieldErrors.etablissement && (
                  <p className="mt-1 text-[11px] text-red-600 font-medium">
                    {fieldErrors.etablissement}
                  </p>
                )}
                {estabsError && (
                  <p className="mt-1 text-[11px] text-red-600">{estabsError}</p>
                )}
              </div>

              {/* Identité du directeur */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nom de famille *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleChange}
                      placeholder="Ex: Ndiaye"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                      required
                    />
                  </div>
                  {fieldErrors.last_name && (
                    <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.last_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Prénom *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleChange}
                      placeholder="Ex: Mamadou"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                      required
                    />
                  </div>
                  {fieldErrors.first_name && (
                    <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.first_name}</p>
                  )}
                </div>
              </div>

              {/* Coordonnées professionnelles & Fonction */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Adresse e-mail professionnelle (identifiant unique) *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="directeur@hopital.sn"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                      required
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Numéro de téléphone professionnel *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="tel"
                      name="telephone"
                      value={formData.telephone}
                      onChange={handleChange}
                      placeholder="+221 77 000 00 00"
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                      required
                    />
                  </div>
                  {fieldErrors.telephone && (
                    <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.telephone}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fonction / Titre officiel au sein de l'établissement *
                </label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    name="fonction"
                    value={formData.fonction}
                    onChange={handleChange}
                    placeholder="Ex: Directeur Général, Médecin-Chef de Direction, Directeur Médical..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                    required
                  />
                </div>
                {fieldErrors.fonction && (
                  <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.fonction}</p>
                )}
              </div>

              {/* Justificatif / Document de nomination (optionnel) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Références de nomination ou justificatif professionnel (optionnel)
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    name="justificatif"
                    value={formData.justificatif}
                    onChange={handleChange}
                    placeholder="Ex: Décret de nomination n°2025-XX, arrêté ministériel ou référence officielle"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                  />
                </div>
                {fieldErrors.justificatif && (
                  <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.justificatif}</p>
                )}
              </div>

              {/* Mots de passe */}
              <div className="pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-3">
                  Définition des accès sécurisés
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mot de passe *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                        required
                      />
                    </div>
                    {fieldErrors.password && (
                      <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.password}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Confirmer le mot de passe *
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="password"
                        name="password_confirm"
                        value={formData.password_confirm}
                        onChange={handleChange}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                        required
                      />
                    </div>
                    {fieldErrors.password_confirm && (
                      <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.password_confirm}</p>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Le mot de passe doit comporter au moins 8 caractères et respecter les exigences de sécurité MEDTRANSFER.
                </p>
              </div>

              {/* Bouton de soumission */}
              <button
                type="submit"
                disabled={submitting || loadingEstabs}
                className="w-full py-3 px-4 bg-[#1976D2] hover:bg-[#1565C0] text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Building2 className="w-4 h-4" />
                    Soumettre la demande d'accès Directeur
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

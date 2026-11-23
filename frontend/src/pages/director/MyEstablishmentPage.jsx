import React, { useState, useEffect, useCallback } from 'react';
import { establishmentService } from '../../services/establishmentService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { formatDate } from '../../utils/formatters';
import {
  Building2,
  Lock,
  Check,
  AlertCircle,
  Phone,
  Mail,
  Globe,
  MapPin,
  Save,
  ShieldCheck,
  Info,
  Clock,
  Layers,
} from 'lucide-react';

const TYPE_CHOICES = [
  { value: 'HOPITAL_NATIONAL', label: 'Hôpital National / CHU' },
  { value: 'CENTRE_HOSPITALIER_REGIONAL', label: 'Centre Hospitalier Régional (CHR)' },
  { value: 'CENTRE_DE_SANTE', label: 'Centre de Santé' },
  { value: 'POSTE_DE_SANTE', label: 'Poste de Santé' },
  { value: 'CLINIQUE_PRIVEE', label: 'Clinique Privée' },
];

export const MyEstablishmentPage = () => {
  const [establishment, setEstablishment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  const [formData, setFormData] = useState({
    nom: '',
    type_etablissement: 'CENTRE_HOSPITALIER_REGIONAL',
    region: '',
    ville: '',
    adresse: '',
    telephone: '',
    email: '',
    site_web: '',
    description: '',
    services_declares: '',
  });

  const loadEstablishment = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await establishmentService.getMyEstablishment();
      setEstablishment(data);
      setFormData({
        nom: data.nom || '',
        type_etablissement: data.type_etablissement || 'CENTRE_HOSPITALIER_REGIONAL',
        region: data.region || '',
        ville: data.ville || '',
        adresse: data.adresse || '',
        telephone: data.telephone || '',
        email: data.email || '',
        site_web: data.site_web || '',
        description: data.description || '',
        services_declares: data.services_declares || '',
      });
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.detail ||
        "Impossible de charger la fiche de votre établissement. Vérifiez vos droits d'accès directeur."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEstablishment();
  }, [loadEstablishment]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setSuccessMessage('');

    try {
      setSaving(true);
      const res = await establishmentService.updateMyEstablishment(formData);
      setEstablishment(res.etablissement || res);
      setSuccessMessage(res.message || "Les informations de votre établissement ont été mises à jour avec succès.");
      setTimeout(() => setSuccessMessage(''), 5000);
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
          }
        } else {
          setError("Une erreur est survenue lors de la mise à jour des informations.");
        }
      } else {
        setError("Impossible de contacter le serveur backend.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto py-6">
        <LoadingSkeleton count={3} />
      </div>
    );
  }

  if (error && !establishment) {
    return (
      <div className="max-w-xl mx-auto mt-12 p-8 bg-white rounded-2xl border border-red-200 text-center shadow-sm">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-800 mb-2">Accès restreint</h2>
        <p className="text-xs text-slate-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header Page */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1976D2]">
            Espace Direction Hospitalière
          </span>
          <h1 className="text-2xl font-black text-[#123B5D]">
            Mon Établissement
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Consultez et modifiez les informations administratives et publiques de votre structure sanitaire.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Établissement actif
          </span>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2.5 shadow-sm">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-xs rounded-xl flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Carte d'identité générale de l'établissement */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#123B5D] to-[#1976D2] flex items-center justify-center text-white shadow-md">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-xl font-black text-[#123B5D]">
                  {establishment.nom}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {establishment.type_display || establishment.type_etablissement} — {establishment.ville}, {establishment.region}
              </p>
            </div>
          </div>

          {/* Code Etablissement Verrouillé */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-left sm:text-right w-full sm:w-auto">
            <div className="flex items-center gap-1.5 justify-start sm:justify-end text-slate-400">
              <Lock className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-wider">
                Code Unique (Verrouillé)
              </span>
            </div>
            <span className="text-lg font-mono font-black text-[#123B5D] block mt-0.5">
              {establishment.code}
            </span>
            <span className="text-[10px] text-slate-400 block">
              Identifiant référence système
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs">
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Direction actuelle :</span>
            <span className="font-bold text-slate-800 text-xs block mt-0.5">
              {establishment.directeur_details?.nom_complet || 'Vous-même (Directeur)'}
            </span>
          </div>

          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Médecins rattachés :</span>
            <span className="font-bold text-[#1976D2] text-xs block mt-0.5">
              {establishment.nombre_medecins ?? 0} médecin(s) actif(s)
            </span>
          </div>

          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/60">
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Dernière mise à jour :</span>
            <span className="font-medium text-slate-700 text-xs block mt-0.5">
              {establishment.updated_at ? formatDate(establishment.updated_at) : '—'}
            </span>
          </div>
        </div>
      </div>

      {/* Formulaire de modification */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#123B5D] uppercase tracking-wide">
                Informations administratives & coordonnées
              </h3>
              <p className="text-xs text-slate-500">
                Ces coordonnées sont visibles par les autres établissements dans l'annuaire de transfert.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Info className="w-3.5 h-3.5" />
              <span>Champs modifiables par la direction</span>
            </div>
          </div>

          {/* Nom & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nom officiel de l'établissement *
              </label>
              <input
                type="text"
                name="nom"
                value={formData.nom}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                required
              />
              {fieldErrors.nom && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.nom}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Catégorie d'établissement *
              </label>
              <select
                name="type_etablissement"
                value={formData.type_etablissement}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                required
              >
                {TYPE_CHOICES.map((tc) => (
                  <option key={tc.value} value={tc.value}>
                    {tc.label}
                  </option>
                ))}
              </select>
              {fieldErrors.type_etablissement && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.type_etablissement}</p>
              )}
            </div>
          </div>

          {/* Localisation */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ville *
              </label>
              <input
                type="text"
                name="ville"
                value={formData.ville}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                required
              />
              {fieldErrors.ville && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.ville}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Région administrative *
              </label>
              <input
                type="text"
                name="region"
                value={formData.region}
                onChange={handleChange}
                className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                required
              />
              {fieldErrors.region && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.region}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adresse postale / Quartier
              </label>
              <input
                type="text"
                name="adresse"
                value={formData.adresse}
                onChange={handleChange}
                placeholder="Ex: Route du Fleuve, BP 12"
                className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
              />
              {fieldErrors.adresse && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.adresse}</p>
              )}
            </div>
          </div>

          {/* Contacts & Site Web */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Numéro de téléphone principal *
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleChange}
                  placeholder="+221 33 000 00 00"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                  required
                />
              </div>
              {fieldErrors.telephone && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.telephone}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Adresse e-mail de contact
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="contact@hopital.sn"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Site web officiel
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="url"
                  name="site_web"
                  value={formData.site_web}
                  onChange={handleChange}
                  placeholder="https://www.hopital.sn"
                  className="w-full pl-9 pr-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2]"
                />
              </div>
              {fieldErrors.site_web && (
                <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.site_web}</p>
              )}
            </div>
          </div>

          {/* Description & Services déclarés */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description & Présentation générale de l'établissement
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              placeholder="Présentation générale des capacités d'accueil, missions sanitaires régionales..."
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2] resize-none"
            />
            {fieldErrors.description && (
              <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.description}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Services médicaux et spécialités déclarés
            </label>
            <textarea
              name="services_declares"
              value={formData.services_declares}
              onChange={handleChange}
              rows={3}
              placeholder="Ex: Urgences 24/7, Cardiologie, Chirurgie générale, Maternité, Pédiatrie, Réanimation..."
              className="w-full px-3.5 py-2.5 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-[#1976D2] focus:ring-1 focus:ring-[#1976D2] resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Ces services sont utilisés par le module d'orientation médicale pour les transferts inter-établissements.
            </p>
            {fieldErrors.services_declares && (
              <p className="mt-1 text-[11px] text-red-600 font-medium">{fieldErrors.services_declares}</p>
            )}
          </div>

          {/* Règle de sécurité & Champs système verrouillés */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500 space-y-2">
            <div className="flex items-center gap-2 text-slate-700 font-bold">
              <Lock className="w-4 h-4 text-slate-500" />
              <span>Champs système protégés et verrouillés :</span>
            </div>
            <ul className="list-disc list-inside text-[11px] space-y-1 text-slate-500 ml-1">
              <li>Le <strong>code établissement</strong> ({establishment.code}) ne peut être modifié que par l'Administrateur Général.</li>
              <li>Le <strong>statut d'activation</strong> de l'établissement relève exclusivement de la tutelle administrative centrale.</li>
              <li>Toute modification effectuée sur cette fiche est automatiquement consignée dans le <strong>journal d'audit de sécurité</strong>.</li>
            </ul>
          </div>

          {/* Bouton de sauvegarde */}
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-[#1976D2] hover:bg-[#1565C0] text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Enregistrer les modifications
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

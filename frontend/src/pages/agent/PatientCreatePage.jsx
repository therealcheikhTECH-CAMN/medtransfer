import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { patientService } from '../../services/patientService';
import { AlertBanner } from '../../components/AlertBanner';
import { UserPlus, AlertTriangle, CheckCircle2, Search, ArrowRight, ShieldAlert } from 'lucide-react';

export const PatientCreatePage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    date_naissance: '',
    sexe: 'M',
    numero_identification_nationale: '',
    telephone: '',
    adresse: '',
    ville: 'Ziguinchor',
    groupe_sanguin: 'INCONNU',
    personne_contact_nom: '',
    personne_contact_telephone: '',
    is_provisional: false,
    motif_identite_provisoire: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [createdPatient, setCreatedPatient] = useState(null);
  const [error, setError] = useState('');

  // Détection proactive des doublons avec debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      if ((formData.nom && formData.prenom) || formData.numero_identification_nationale) {
        try {
          const res = await patientService.checkDuplicates({
            nom: formData.nom,
            prenom: formData.prenom,
            nin: formData.numero_identification_nationale,
            date_naissance: formData.date_naissance || undefined
          });
          setDuplicates(res.results || []);
        } catch (err) {
          console.error(err);
        }
      } else {
        setDuplicates([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.nom, formData.prenom, formData.numero_identification_nationale, formData.date_naissance]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.is_provisional && !formData.motif_identite_provisoire.trim()) {
      setError('Le motif est obligatoire pour une identité provisoire en urgence.');
      return;
    }

    try {
      setSubmitting(true);
      let res;
      if (formData.is_provisional) {
        res = await patientService.createProvisional({
          nom: formData.nom || 'Inconnu',
          prenom: formData.prenom || 'Urgence',
          sexe: formData.sexe,
          date_naissance: formData.date_naissance || null,
          telephone: formData.telephone,
          ville: formData.ville,
          groupe_sanguin: formData.groupe_sanguin,
          motif_identite_provisoire: formData.motif_identite_provisoire
        });
      } else {
        res = await patientService.create(formData);
      }
      setCreatedPatient(res);
    } catch (err) {
      console.error(err);
      setError('Erreur lors de l\'enregistrement. Vérifiez les informations saisies.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#123B5D]">Enregistrement d'un Patient</h2>
          <p className="text-xs text-[#64748B]">
            Création de la fiche administrative unique et attribution de l'identifiant MedTransfer national.
          </p>
        </div>
        <Link
          to="/agent/search"
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#1976D2] bg-sky-50 border border-sky-200 rounded-xl hover:bg-sky-100 transition-colors"
        >
          <Search className="w-4 h-4" />
          Vérifier la recherche préalable
        </Link>
      </div>

      {createdPatient ? (
        <div className="p-8 bg-white rounded-2xl border border-emerald-200 shadow-sm text-center space-y-4">
          <div className="flex items-center justify-center w-16 h-16 mx-auto rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-[#123B5D]">Patient Enregistré avec Succès !</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto">
            La fiche administrative et le dossier médical centralisé ont été initialisés dans la base unique.
          </p>

          <div className="inline-block p-4 my-2 rounded-xl bg-slate-50 border border-slate-200 text-left">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Identifiant MedTransfer Permanent :</span>
            <span className="text-xl font-mono font-black text-[#1976D2] block mt-0.5">{createdPatient.medtransfer_id}</span>
            <span className="text-xs font-semibold text-slate-700 block mt-1">
              {createdPatient.nom} {createdPatient.prenom}
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setCreatedPatient(null);
                setFormData({
                  nom: '', prenom: '', date_naissance: '', sexe: 'M',
                  numero_identification_nationale: '', telephone: '',
                  adresse: '', ville: 'Ziguinchor', groupe_sanguin: 'INCONNU',
                  personne_contact_nom: '', personne_contact_telephone: '',
                  is_provisional: false, motif_identite_provisoire: ''
                });
              }}
              className="px-5 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
            >
              Enregistrer un autre patient
            </button>
            <Link
              to="/agent/search"
              className="px-5 py-2.5 text-xs font-semibold text-[#123B5D] bg-sky-50 border border-sky-200 hover:bg-sky-100 rounded-xl flex items-center gap-1.5"
            >
              Voir la liste des patients
            </Link>
            <Link
              to={`/agent/patients/${createdPatient.id}/identification`}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl flex items-center gap-1.5 shadow-sm"
            >
              Consulter la fiche
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <AlertBanner type="danger" title="Erreur de validation" message={error} />
          )}

          {/* Anti-Duplicate Live Alert */}
          {duplicates.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <h4 className="text-xs font-bold uppercase tracking-wider">
                  Attention : Correspondances potentielles détectées ({duplicates.length})
                </h4>
              </div>
              <p className="text-xs text-amber-800">
                Un ou plusieurs patients avec des coordonnées similaires existent déjà dans la base.
                Vérifiez s'il s'agit de la même personne pour éviter de créer un doublon :
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {duplicates.map(d => (
                  <div key={d.id} className="p-2.5 bg-white rounded-lg border border-amber-200 text-xs flex justify-between items-center">
                    <div>
                      <span className="font-bold text-[#123B5D] block">{d.nom} {d.prenom}</span>
                      <span className="font-mono text-[10px] text-slate-500">{d.medtransfer_id} • NIN : {d.numero_identification_nationale || '—'}</span>
                    </div>
                    <Link
                      to={`/agent/patients/${d.id}/identification`}
                      className="px-2 py-1 text-[10px] font-bold text-[#1976D2] bg-sky-50 rounded hover:underline"
                    >
                      Voir
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Provisional Mode Toggle */}
          <div className="p-4 bg-white rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#123B5D] block">
                Mode Urgence / Identité Provisoire
              </span>
              <span className="text-[11px] text-[#64748B] block">
                À cocher si le patient est inconscient ou admis sans pièce d'identité (statut [IDENTITÉ À CONFIRMER]).
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                name="is_provisional"
                checked={formData.is_provisional}
                onChange={handleChange}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {formData.is_provisional && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-900">
                Motif obligatoire de création d'une identité provisoire *
              </label>
              <textarea
                name="motif_identite_provisoire"
                value={formData.motif_identite_provisoire}
                onChange={handleChange}
                required
                rows={2}
                placeholder="ex: Patient comateux victime d'un accident de la circulation, sans papiers."
                className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg outline-none"
              />
            </div>
          )}

          {/* Form Fields */}
          <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-4 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#123B5D] pb-2 border-b border-slate-100">
              État Civil & Coordonnées
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Nom de famille *
                </label>
                <input
                  type="text"
                  name="nom"
                  value={formData.nom}
                  onChange={handleChange}
                  required
                  placeholder="ex: Sagna"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Prénom(s) *
                </label>
                <input
                  type="text"
                  name="prenom"
                  value={formData.prenom}
                  onChange={handleChange}
                  required
                  placeholder="ex: Ousmane"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Date de naissance
                </label>
                <input
                  type="date"
                  name="date_naissance"
                  value={formData.date_naissance}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Sexe *
                </label>
                <select
                  name="sexe"
                  value={formData.sexe}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                >
                  <option value="M">Masculin</option>
                  <option value="F">Féminin</option>
                  <option value="I">Indéterminé</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Groupe Sanguin
                </label>
                <select
                  name="groupe_sanguin"
                  value={formData.groupe_sanguin}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                >
                  <option value="INCONNU">Inconnu</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Numéro CNI / NIN (Identification Nationale)
                </label>
                <input
                  type="text"
                  name="numero_identification_nationale"
                  value={formData.numero_identification_nationale}
                  onChange={handleChange}
                  placeholder="ex: 1985198500412"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2] font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Téléphone du patient
                </label>
                <input
                  type="tel"
                  name="telephone"
                  value={formData.telephone}
                  onChange={handleChange}
                  placeholder="ex: +221 77 123 45 67"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2] font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Ville de résidence
                </label>
                <input
                  type="text"
                  name="ville"
                  value={formData.ville}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Adresse de quartier
                </label>
                <input
                  type="text"
                  name="adresse"
                  value={formData.adresse}
                  onChange={handleChange}
                  placeholder="ex: Quartier Lyndiane, Rue 12"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>
            </div>

            <h3 className="text-xs font-bold uppercase tracking-wider text-[#123B5D] pt-4 pb-2 border-b border-slate-100">
              Personne de Contact d'Urgence
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Nom du contact d'urgence
                </label>
                <input
                  type="text"
                  name="personne_contact_nom"
                  value={formData.personne_contact_nom}
                  onChange={handleChange}
                  placeholder="ex: Mariama Sagna (Épouse)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                  Téléphone du contact d'urgence
                </label>
                <input
                  type="tel"
                  name="personne_contact_telephone"
                  value={formData.personne_contact_telephone}
                  onChange={handleChange}
                  placeholder="ex: +221 77 333 44 55"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2] font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
              <Link
                to="/agent/dashboard"
                className="px-5 py-2.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Annuler
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-md disabled:opacity-50 transition-all"
              >
                <UserPlus className="w-4 h-4" />
                {submitting ? 'Enregistrement...' : 'Créer la fiche patient'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};

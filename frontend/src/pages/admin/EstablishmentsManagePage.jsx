import React, { useState, useEffect, useCallback, useRef } from 'react';
import { establishmentService } from '../../services/establishmentService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { Modal } from '../../components/Modal';
import { GlobalSearch } from '../../components/GlobalSearch';
import { EmailComposerModal } from '../../components/email/EmailComposerModal';
import {
  Building2,
  Plus,
  MapPin,
  Phone,
  Mail,
  Check,
  Edit,
  UserCheck,
  Power,
  AlertTriangle,
  User,
  Shield,
  RefreshCw,
} from 'lucide-react';

export const EstablishmentsManagePage = () => {
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEtab, setEditingEtab] = useState(null);
  const [directorModalEtab, setDirectorModalEtab] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Email Composer Modal State
  const [emailModalConfig, setEmailModalConfig] = useState({
    isOpen: false,
    recipient: '',
    recipientName: '',
    contextCategory: 'ESTABLISHMENT',
    contextData: {},
  });

  const handleOpenEmailForEstablishment = (etab, isDirector = false) => {
    const toEmail = isDirector ? etab.directeur_details?.email : etab.email;
    const toName = isDirector ? etab.directeur_details?.nom_complet : etab.nom;
    setEmailModalConfig({
      isOpen: true,
      recipient: toEmail || '',
      recipientName: toName || '',
      contextCategory: 'ESTABLISHMENT',
      contextData: {
        recipientName: toName || '',
        etablissementNom: etab.nom || '',
        entityType: 'establishment',
        entityId: etab.id,
      },
    });
  };

  const abortControllerRef = useRef(null);

  // Forms
  const [formData, setFormData] = useState({
    code: '',
    nom: '',
    type_etablissement: 'CENTRE_HOSPITALIER_REGIONAL',
    region: 'Ziguinchor',
    ville: 'Ziguinchor',
    adresse: '',
    telephone: '',
    email: '',
    services_declares: '',
    is_active: true,
  });

  const [directorFormData, setDirectorFormData] = useState({
    mode: 'new', // 'new' | 'existing'
    user_id: '',
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    matricule_professionnel: '',
    telephone: '',
  });

  const fetchEstablishments = useCallback(async (query = '', statusChoice = 'all', pageNum = 1) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      setLoading(true);
      const params = { page: pageNum };
      if (query.trim()) params.q = query.trim();
      if (statusChoice === 'active') params.is_active = 'true';
      if (statusChoice === 'inactive') params.is_active = 'false';

      const list = await establishmentService.getList(params, { signal: controller.signal });
      const items = Array.isArray(list) ? list : list.results || [];
      setEstablishments(items);
      setTotalCount(list.count ?? items.length);
      setHasNext(Boolean(list.next));
      setHasPrev(Boolean(list.previous));
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEstablishments(searchTerm, statusFilter, 1);
  }, [statusFilter]);

  const handleSearch = (newQuery) => {
    const trimmed = (newQuery || '').trim();
    setSearchTerm(trimmed);
    setPage(1);
    fetchEstablishments(trimmed, statusFilter, 1);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setPage(1);
    fetchEstablishments('', statusFilter, 1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchEstablishments(searchTerm, statusFilter, newPage);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleDirectorInputChange = (e) => {
    const { name, value } = e.target;
    setDirectorFormData((prev) => ({ ...prev, [name]: value }));
  };

  const showSuccess = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 4000);
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await establishmentService.create(formData);
      showSuccess("Établissement enregistré avec succès !");
      setIsCreateModalOpen(false);
      setFormData({
        code: '',
        nom: '',
        type_etablissement: 'CENTRE_HOSPITALIER_REGIONAL',
        region: 'Ziguinchor',
        ville: 'Ziguinchor',
        adresse: '',
        telephone: '',
        email: '',
        services_declares: '',
        is_active: true,
      });
      fetchEstablishments(searchTerm, statusFilter, page);
    } catch (err) {
      console.error(err);
      showError("Erreur lors de l'enregistrement. Le code établissement doit être unique.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditClick = (etab) => {
    setEditingEtab(etab);
    setFormData({
      code: etab.code || '',
      nom: etab.nom || '',
      type_etablissement: etab.type_etablissement || 'CENTRE_HOSPITALIER_REGIONAL',
      region: etab.region || '',
      ville: etab.ville || '',
      adresse: etab.adresse || '',
      telephone: etab.telephone || '',
      email: etab.email || '',
      services_declares: etab.services_declares || '',
      is_active: etab.is_active !== false,
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingEtab) return;
    try {
      setSubmitting(true);
      await establishmentService.partialUpdate(editingEtab.id, formData);
      showSuccess("Informations de l'établissement mises à jour avec succès !");
      setEditingEtab(null);
      fetchEstablishments(searchTerm, statusFilter, page);
    } catch (err) {
      console.error(err);
      showError("Erreur lors de la mise à jour de l'établissement.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (etab) => {
    const actionLabel = etab.is_active ? 'désactiver' : 'activer';
    const confirmMsg = etab.is_active
      ? `Êtes-vous sûr de vouloir désactiver "${etab.nom}" ? Les données historiques resteront consultables mais aucune nouvelle opération ne sera permise.`
      : `Voulez-vous réactiver "${etab.nom}" ?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      await establishmentService.toggleActive(etab.id, !etab.is_active);
      showSuccess(`L'établissement a été ${etab.is_active ? 'désactivé' : 'activé'} avec succès.`);
      fetchEstablishments(searchTerm, statusFilter, page);
    } catch (err) {
      console.error(err);
      showError(`Erreur lors de la tentative de ${actionLabel} l'établissement.`);
    }
  };

  const handleOpenDirectorModal = (etab) => {
    setDirectorModalEtab(etab);
    setDirectorFormData({
      mode: 'new',
      user_id: '',
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      matricule_professionnel: '',
      telephone: '',
    });
  };

  const handleAssignDirector = async (e) => {
    e.preventDefault();
    if (!directorModalEtab) return;
    try {
      setSubmitting(true);
      const payload = directorFormData.mode === 'existing'
        ? { user_id: directorFormData.user_id }
        : {
            first_name: directorFormData.first_name,
            last_name: directorFormData.last_name,
            email: directorFormData.email,
            password: directorFormData.password,
            matricule_professionnel: directorFormData.matricule_professionnel,
            telephone: directorFormData.telephone,
          };

      const res = await establishmentService.assignDirector(directorModalEtab.id, payload);
      showSuccess(res.message || "Directeur attribué avec succès !");
      setDirectorModalEtab(null);
      fetchEstablishments(searchTerm, statusFilter, page);
    } catch (err) {
      console.error(err);
      const errDetail = err.response?.data?.detail || err.response?.data?.password || "Erreur lors de l'attribution du directeur.";
      showError(errDetail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-[#1976D2]" />
            <h2 className="text-xl font-bold text-[#123B5D]">Gestion des Établissements & Directions</h2>
          </div>
          <p className="text-xs text-[#64748B]">
            Administration centrale des structures sanitaires, nominations des directeurs et contrôle des statuts.
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({
              code: '',
              nom: '',
              type_etablissement: 'CENTRE_HOSPITALIER_REGIONAL',
              region: 'Ziguinchor',
              ville: 'Ziguinchor',
              adresse: '',
              telephone: '',
              email: '',
              services_declares: '',
              is_active: true,
            });
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Ajouter un établissement
        </button>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          {message}
        </div>
      )}
      {errorMessage && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          {errorMessage}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-xl border border-slate-200/80">
        <div className="flex-1">
          <GlobalSearch
            onSearch={handleSearch}
            onClear={handleClearSearch}
            defaultValue={searchTerm}
            loading={loading}
            placeholder="Rechercher par nom d'hôpital, code (ex: HRZ, CHU-FANN), ville ou région..."
            debounceMs={300}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-[#123B5D] text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Tous ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Actifs
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === 'inactive'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Désactivés
          </button>
        </div>
      </div>

      {/* Grid of establishments */}
      {loading ? (
        <LoadingSkeleton lines={4} />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {establishments.length === 0 ? (
              <div className="col-span-2 p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                Aucun établissement de santé correspondant aux critères.
              </div>
            ) : (
              establishments.map((etab) => (
                <div
                  key={etab.id}
                  className={`p-5 bg-white rounded-2xl border transition-all space-y-4 ${
                    etab.is_active
                      ? 'border-slate-200/80 shadow-sm hover:shadow-md'
                      : 'border-rose-200 bg-rose-50/20 opacity-80'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-3 rounded-xl border ${
                          etab.is_active
                            ? 'bg-sky-50 text-[#1976D2] border-sky-100'
                            : 'bg-rose-50 text-rose-600 border-rose-200'
                        }`}
                      >
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-[#123B5D]">{etab.nom}</h3>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                              etab.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            {etab.is_active ? 'Actif' : 'Désactivé'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-mono font-bold rounded">
                            {etab.code}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">{etab.type_display}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleEditClick(etab)}
                        className="p-1.5 text-slate-500 hover:text-[#1976D2] hover:bg-slate-100 rounded-lg transition-colors"
                        title="Modifier les coordonnées"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(etab)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          etab.is_active
                            ? 'text-rose-500 hover:bg-rose-50'
                            : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={etab.is_active ? "Désactiver l'établissement" : "Réactiver l'établissement"}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Director Section */}
                  <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px] uppercase tracking-wider">
                        <Shield className="w-3.5 h-3.5 text-[#1976D2]" />
                        Direction de l'Établissement
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenDirectorModal(etab)}
                        className="text-[11px] font-semibold text-[#1976D2] hover:underline flex items-center gap-1"
                      >
                        <UserCheck className="w-3 h-3" />
                        {etab.directeur_details ? 'Remplacer le directeur' : 'Attribuer un directeur'}
                      </button>
                    </div>

                    {etab.directeur_details ? (
                      <div className="grid grid-cols-2 gap-2 pt-1 text-[11px]">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Nom complet</span>
                          <span className="font-bold text-[#123B5D]">{etab.directeur_details.nom_complet}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">E-mail</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-700 truncate block">{etab.directeur_details.email}</span>
                            {etab.directeur_details.email && (
                              <button
                                type="button"
                                onClick={() => handleOpenEmailForEstablishment(etab, true)}
                                className="p-1 text-slate-400 hover:text-[#1976D2] hover:bg-sky-50 rounded transition-colors shrink-0"
                                title="Contacter le directeur par e-mail"
                              >
                                <Mail className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                        {etab.directeur_details.matricule_professionnel && (
                          <div>
                            <span className="text-slate-400 block text-[10px]">Matricule</span>
                            <span className="font-mono text-slate-700">{etab.directeur_details.matricule_professionnel}</span>
                          </div>
                        )}
                        {etab.directeur_details.telephone && (
                          <div>
                            <span className="text-slate-400 block text-[10px]">Téléphone</span>
                            <span className="font-mono text-slate-700">{etab.directeur_details.telephone}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-700 bg-amber-50/70 p-2 rounded-lg border border-amber-200/60">
                        Aucun directeur officiellement rattaché à cet établissement.
                      </p>
                    )}
                  </div>

                  {/* Details section */}
                  <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{etab.ville}, Région de {etab.region} {etab.adresse && `• ${etab.adresse}`}</span>
                    </div>
                    {etab.telephone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono text-[11px]">{etab.telephone}</span>
                      </div>
                    )}
                    {etab.email && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{etab.email}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenEmailForEstablishment(etab, false)}
                          className="p-1 text-slate-400 hover:text-[#1976D2] hover:bg-sky-50 rounded transition-colors shrink-0"
                          title="Contacter l'établissement par e-mail"
                        >
                          <Mail className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  {etab.services_declares && (
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-[11px]">
                      <span className="font-semibold text-slate-700 block mb-1">Services & Plateaux déclarés :</span>
                      <p className="text-slate-600 leading-relaxed line-clamp-2">{etab.services_declares}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {totalCount > 20 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
              <span>
                Total : <strong className="text-slate-700">{totalCount}</strong> établissements (Page {page} sur {Math.max(1, Math.ceil(totalCount / 20))})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!hasPrev || page <= 1}
                  onClick={() => handlePageChange(page - 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Précédent
                </button>
                <button
                  type="button"
                  disabled={!hasNext || page >= Math.ceil(totalCount / 20)}
                  onClick={() => handlePageChange(page + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Ajout / Modification */}
      <Modal
        isOpen={isCreateModalOpen || !!editingEtab}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingEtab(null);
        }}
        title={editingEtab ? `Modifier l'établissement : ${editingEtab.nom}` : "Ajouter un Établissement Hospitalier"}
        maxWidth="max-w-xl"
      >
        <form onSubmit={editingEtab ? handleUpdate : handleCreate} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Code Unique (ex: HRZ, CHU-FANN) *
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                required
                disabled={!!editingEtab} // Code unique non modifiable pour préserver les identifiants
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none uppercase font-mono disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Type de structure *
              </label>
              <select
                name="type_etablissement"
                value={formData.type_etablissement}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              >
                <option value="HOPITAL_NATIONAL">Hôpital National / CHU</option>
                <option value="CENTRE_HOSPITALIER_REGIONAL">Centre Hospitalier Régional (CHR)</option>
                <option value="CENTRE_DE_SANTE">Centre de Santé</option>
                <option value="POSTE_DE_SANTE">Poste de Santé</option>
                <option value="CLINIQUE_PRIVEE">Clinique Privée</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Nom complet de l'établissement *
            </label>
            <input
              type="text"
              name="nom"
              value={formData.nom}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Région *
              </label>
              <input
                type="text"
                name="region"
                value={formData.region}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Ville *
              </label>
              <input
                type="text"
                name="ville"
                value={formData.ville}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Téléphone
              </label>
              <input
                type="text"
                name="telephone"
                value={formData.telephone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Adresse électronique
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Adresse physique
            </label>
            <input
              type="text"
              name="adresse"
              value={formData.adresse}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Services & Spécialités déclarés
            </label>
            <textarea
              name="services_declares"
              value={formData.services_declares}
              onChange={handleInputChange}
              rows={3}
              placeholder="ex: Urgences 24/7, Cardiologie, Chirurgie générale, Maternité"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            />
          </div>

          {editingEtab && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="is_active_checkbox"
                name="is_active"
                checked={formData.is_active}
                onChange={handleInputChange}
                className="rounded border-slate-300 text-[#1976D2] focus:ring-[#1976D2]"
              />
              <label htmlFor="is_active_checkbox" className="text-xs font-semibold text-[#123B5D]">
                Établissement actif (décocher pour désactiver)
              </label>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsCreateModalOpen(false);
                setEditingEtab(null);
              }}
              className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-lg shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Enregistrement...' : editingEtab ? 'Mettre à jour' : 'Enregistrer la structure'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Nomination / Remplacement du Directeur */}
      <Modal
        isOpen={!!directorModalEtab}
        onClose={() => setDirectorModalEtab(null)}
        title={
          directorModalEtab?.directeur_details
            ? `Remplacer le directeur de : ${directorModalEtab.nom}`
            : `Nommer un directeur pour : ${directorModalEtab?.nom}`
        }
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleAssignDirector} className="space-y-4 text-xs">
          {directorModalEtab?.directeur_details && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px]">
              Directeur actuel : <strong>{directorModalEtab.directeur_details.nom_complet}</strong> ({directorModalEtab.directeur_details.email}). La nomination remplacera officiellement ce directeur.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Prénom du directeur *
              </label>
              <input
                type="text"
                name="first_name"
                value={directorFormData.first_name}
                onChange={handleDirectorInputChange}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Nom du directeur *
              </label>
              <input
                type="text"
                name="last_name"
                value={directorFormData.last_name}
                onChange={handleDirectorInputChange}
                required
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Adresse e-mail professionnelle *
            </label>
            <input
              type="email"
              name="email"
              value={directorFormData.email}
              onChange={handleDirectorInputChange}
              required
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Mot de passe initial *
            </label>
            <input
              type="password"
              name="password"
              value={directorFormData.password}
              onChange={handleDirectorInputChange}
              required
              placeholder="Minimum 8 caractères, majuscule, chiffre..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Matricule professionnel
              </label>
              <input
                type="text"
                name="matricule_professionnel"
                value={directorFormData.matricule_professionnel}
                onChange={handleDirectorInputChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Téléphone
              </label>
              <input
                type="text"
                name="telephone"
                value={directorFormData.telephone}
                onChange={handleDirectorInputChange}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setDirectorModalEtab(null)}
              className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-lg shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Nomination...' : 'Confirmer la nomination'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de composition d'email */}
      <EmailComposerModal
        isOpen={emailModalConfig.isOpen}
        onClose={() => setEmailModalConfig(prev => ({ ...prev, isOpen: false }))}
        initialRecipient={emailModalConfig.recipient}
        initialRecipientName={emailModalConfig.recipientName}
        contextCategory={emailModalConfig.contextCategory}
        contextData={emailModalConfig.contextData}
      />
    </div>
  );
};

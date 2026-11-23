import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { careService } from '../../services/careService';
import { establishmentService } from '../../services/establishmentService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { Modal } from '../../components/Modal';
import { Badge } from '../../components/Badge';
import { GlobalSearch } from '../../components/GlobalSearch';
import { SearchablePatientSelect } from '../../components/SearchablePatientSelect';
import { SearchableEstablishmentSelect } from '../../components/SearchableEstablishmentSelect';
import { formatDateTime } from '../../utils/formatters';
import { matchesSearchText } from '../../utils/searchUtils';
import { EmailComposerModal } from '../../components/email/EmailComposerModal';
import {
  ArrowRightLeft,
  Plus,
  CheckCircle2,
  XCircle,
  Building2,
  Clock,
  Send,
  Inbox,
  AlertTriangle,
  Mail,
} from 'lucide-react';

export const TransfersPage = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patient_id');

  const [activeTab, setActiveTab] = useState('recus'); // 'recus' or 'emis'
  const [transfers, setTransfers] = useState([]);
  const [establishments, setEstablishments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');

  // Email Composer Modal State
  const [emailModalConfig, setEmailModalConfig] = useState({
    isOpen: false,
    recipient: '',
    recipientName: '',
    contextCategory: 'TRANSFER',
    contextData: {},
  });

  const allowedTransferRecipients = useMemo(() => {
    return (establishments || [])
      .filter((e) => e.email)
      .map((e) => ({
        email: e.email,
        label: `${e.nom} (${e.code})`,
      }));
  }, [establishments]);

  const handleOpenEmailForTransfer = (transferItem) => {
    const isReceived = activeTab === 'recus';
    const targetEtabNom = isReceived
      ? transferItem.etablissement_origine_nom
      : transferItem.etablissement_destination_nom;

    const matchedEtab = (establishments || []).find(
      (e) => e.nom && targetEtabNom && e.nom.toLowerCase().trim() === targetEtabNom.toLowerCase().trim()
    );
    const targetEmail = matchedEtab?.email || '';

    setEmailModalConfig({
      isOpen: true,
      recipient: targetEmail,
      recipientName: targetEtabNom || '',
      contextCategory: 'TRANSFER',
      contextData: {
        transfertRef: `TRF-${transferItem.id}`,
        transfertId: transferItem.id,
        etablissementDestinationNom: transferItem.etablissement_destination_nom || '',
        etablissementDestinationCode: matchedEtab?.code || '',
        entityType: 'transfer',
        entityId: transferItem.id,
      },
    });
  };

  // Modal Initiate Transfer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    patient_id: preselectedPatientId || '',
    etablissement_destination_id: '',
    priorite: 'NORMALE',
    motif_transfert: '',
    resume_clinique: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [tList, eList] = await Promise.all([
        careService.getTransfers({ mode: activeTab }),
        establishmentService.getDirectory().then((list) =>
          list.length > 0 ? list : establishmentService.getPublicList()
        ),
      ]);
      setTransfers(tList || []);
      setEstablishments(eList || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    if (preselectedPatientId) {
      setFormData((prev) => ({ ...prev, patient_id: preselectedPatientId }));
      setIsModalOpen(true);
    }
  }, [preselectedPatientId]);

  const handleInitiateTransfer = async (e) => {
    e.preventDefault();
    if (!formData.patient_id) {
      alert('Veuillez sélectionner un patient sous votre prise en charge.');
      return;
    }
    if (!formData.etablissement_destination_id) {
      alert("Veuillez sélectionner l'établissement de destination.");
      return;
    }

    try {
      setSubmitting(true);
      await careService.createTransfer({
        patient_id: parseInt(formData.patient_id),
        etablissement_destination_id: parseInt(formData.etablissement_destination_id),
        priorite: formData.priorite,
        motif_transfert: formData.motif_transfert,
        resume_clinique: formData.resume_clinique,
      });

      setMessage('Demande de transfert émise avec succès !');
      setIsModalOpen(false);
      setFormData({
        patient_id: '',
        etablissement_destination_id: '',
        priorite: 'NORMALE',
        motif_transfert: '',
        resume_clinique: '',
      });
      fetchData();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error(err);
      const detail =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Erreur lors de l'émission du transfert. Assurez-vous d'avoir la prise en charge active du patient.";
      alert(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAccept = async (transferId) => {
    try {
      await careService.acceptTransfer(transferId);
      setMessage('Transfert accepté avec succès. Prise en charge ouverte !');
      fetchData();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'acceptation.");
    }
  };

  const handleReject = async (transferId) => {
    const motif = prompt('Veuillez indiquer le motif du refus :');
    if (!motif) return;

    try {
      await careService.rejectTransfer(transferId, motif);
      setMessage('Transfert refusé.');
      fetchData();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      console.error(err);
      alert('Erreur lors du refus.');
    }
  };

  // Filtrage instantané du tableau des transferts
  const filteredTransfers = useMemo(() => {
    if (!tableSearchQuery.trim()) return transfers;
    return transfers.filter((t) =>
      matchesSearchText(t, tableSearchQuery, [
        'patient_nom',
        'patient_medtransfer_id',
        'etablissement_origine_nom',
        'etablissement_destination_nom',
        'motif_transfert',
        'priorite',
        'statut',
      ])
    );
  }, [transfers, tableSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#123B5D]">Transferts Inter-Hospitaliers</h2>
          <p className="text-xs text-[#64748B]">
            Régulation médicale des flux de patients entre structures du réseau MEDTRANSFER.
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Initier un transfert
        </button>
      </div>

      {message && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {message}
        </div>
      )}

      {/* Tabs & Search Filter */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('recus')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'recus'
                ? 'bg-white text-[#1976D2] shadow-sm'
                : 'text-slate-600 hover:text-[#123B5D]'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Demandes Reçues (Entrants)
          </button>
          <button
            onClick={() => setActiveTab('emis')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'emis'
                ? 'bg-white text-[#1976D2] shadow-sm'
                : 'text-slate-600 hover:text-[#123B5D]'
            }`}
          >
            <Send className="w-4 h-4" />
            Demandes Émises (Sortants)
          </button>
        </div>

        <div className="w-full md:w-80">
          <GlobalSearch
            value={tableSearchQuery}
            onChange={(e) => setTableSearchQuery(e.target.value)}
            onClear={() => setTableSearchQuery('')}
            placeholder="Filtrer par patient, hôpital, motif..."
            debounceMs={0}
          />
        </div>
      </div>

      {/* Transfers List */}
      {loading ? (
        <LoadingSkeleton type="table" lines={5} />
      ) : (
        <div className="space-y-4">
          {filteredTransfers.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
              {tableSearchQuery
                ? 'Aucun transfert ne correspond à votre filtre.'
                : 'Aucun transfert trouvé dans cette catégorie.'}
            </div>
          ) : (
            filteredTransfers.map((t) => (
              <div key={t.id} className="p-5 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-3 border-b border-slate-100">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-[#123B5D] text-sm">
                        {t.patient_nom}
                      </span>
                      <span className="font-mono text-[10px] text-[#1976D2] bg-sky-50 px-2 py-0.5 rounded border border-sky-200 font-bold">
                        {t.patient_medtransfer_id}
                      </span>
                      <Badge status={t.priorite}>{t.priorite}</Badge>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      De : <strong>{t.etablissement_origine_nom}</strong> ➔ Vers : <strong>{t.etablissement_destination_nom}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEmailForTransfer(t)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#1976D2] bg-sky-50 hover:bg-sky-100 border border-sky-200/80 rounded-lg transition-colors"
                      title="Coordonner ce transfert par e-mail avec l'autre structure"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>Coordonner</span>
                    </button>
                    <Badge status={t.statut}>{t.statut}</Badge>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatDateTime(t.date_demande)}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <p className="text-slate-700">
                    <strong>Motif du transfert :</strong> {t.motif_transfert}
                  </p>
                  <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <strong>Synthèse clinique :</strong> {t.resume_clinique}
                  </p>
                  {t.motif_reponse && (
                    <p className="text-[11px] text-slate-600 italic">
                      <strong>Réponse :</strong> {t.motif_reponse} ({formatDateTime(t.date_reponse)})
                    </p>
                  )}
                </div>

                {/* Actions if Received and Pending */}
                {activeTab === 'recus' && t.statut === 'DEMANDE' && (
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => handleReject(t.id)}
                      className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Refuser
                    </button>
                    <button
                      onClick={() => handleAccept(t.id)}
                      className="px-4 py-1.5 bg-[#16A34A] hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Accepter et ouvrir prise en charge
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal Initiate Transfer */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Initier une Demande de Transfert"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleInitiateTransfer} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Patient sous votre prise en charge ordinaire *
            </label>
            <SearchablePatientSelect
              value={formData.patient_id}
              onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
              scope="my_care"
              filterFn={(p) => p.mode_acces_medecin === 'ORDINARY_CARE'}
              placeholder="Rechercher par nom, prénom ou ID MEDTRANSFER..."
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Établissement Récepteur *
              </label>
              <SearchableEstablishmentSelect
                establishments={establishments}
                value={formData.etablissement_destination_id}
                onChange={(e) =>
                  setFormData({ ...formData, etablissement_destination_id: e.target.value })
                }
                excludeId={user?.etablissement?.id}
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
                Degré de Priorité *
              </label>
              <select
                value={formData.priorite}
                onChange={(e) => setFormData({ ...formData, priorite: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              >
                <option value="NORMALE">Normale</option>
                <option value="HAUTE">Haute</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Motif médical du transfert *
            </label>
            <input
              type="text"
              required
              value={formData.motif_transfert}
              onChange={(e) => setFormData({ ...formData, motif_transfert: e.target.value })}
              placeholder="ex: Nécessité de prise en charge en réanimation pédiatrique"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Synthèse clinique et examens joints *
            </label>
            <textarea
              required
              rows={4}
              value={formData.resume_clinique}
              onChange={(e) => setFormData({ ...formData, resume_clinique: e.target.value })}
              placeholder="Résumez l'état du patient, les thérapeutiques administrées et la raison de l'orientation vers ce plateau technique..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Émission...' : 'Émettre la demande de transfert'}
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
        allowedRecipients={allowedTransferRecipients}
        contextCategory={emailModalConfig.contextCategory}
        contextData={emailModalConfig.contextData}
      />
    </div>
  );
};

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { careService } from '../../services/careService';
import { LoadingSkeleton } from '../../components/LoadingSkeleton';
import { Modal } from '../../components/Modal';
import { Badge } from '../../components/Badge';
import { GlobalSearch } from '../../components/GlobalSearch';
import { formatDateTime, formatDate } from '../../utils/formatters';
import { matchesSearchText } from '../../utils/searchUtils';
import { EmailComposerModal } from '../../components/email/EmailComposerModal';
import {
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Building2,
  Clock,
  Eye,
  AlertTriangle,
  User,
  FileText,
  Calendar,
  ShieldCheck,
  Mail,
} from 'lucide-react';

export const AgentTransfersPage = () => {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);

  // Email Composer Modal State
  const [emailModalConfig, setEmailModalConfig] = useState({
    isOpen: false,
    recipient: '',
    recipientName: '',
    contextCategory: 'TRANSFER',
    contextData: {},
  });

  const handleOpenEmailForTransfer = (transferItem) => {
    setEmailModalConfig({
      isOpen: true,
      recipient: '',
      recipientName: transferItem?.etablissement_origine_nom || '',
      contextCategory: 'TRANSFER',
      contextData: {
        transfertRef: `TRF-${transferItem.id}`,
        transfertId: transferItem.id,
        etablissementDestinationNom: user?.etablissement?.nom || '',
        entityType: 'transfer',
        entityId: transferItem.id,
      },
    });
  };

  // Modals
  const [selectedTransfer, setSelectedTransfer] = useState(null);
  const [acceptModalTransfer, setAcceptModalTransfer] = useState(null);
  const [rejectModalTransfer, setRejectModalTransfer] = useState(null);
  const [rejectMotif, setRejectMotif] = useState('');

  const fetchTransfers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await careService.getTransfers({ mode: 'recus' });
      setTransfers(Array.isArray(res) ? res : res.results || []);
    } catch (err) {
      console.error('Erreur chargement des transferts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  const handleConfirmAccept = async () => {
    if (!acceptModalTransfer) return;
    try {
      setActionLoadingId(acceptModalTransfer.id);
      await careService.acceptTransfer(acceptModalTransfer.id);
      setMessage(
        `Demande de transfert pour ${acceptModalTransfer.patient_nom || 'le patient'} acceptée avec succès. La prise en charge est désormais active.`
      );
      setAcceptModalTransfer(null);
      await fetchTransfers();
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || "Erreur lors de l'acceptation du transfert.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectModalTransfer || !rejectMotif.trim()) {
      alert('Le motif de refus est obligatoire.');
      return;
    }
    try {
      setActionLoadingId(rejectModalTransfer.id);
      await careService.rejectTransfer(rejectModalTransfer.id, rejectMotif.trim());
      setMessage(`Demande de transfert pour ${rejectModalTransfer.patient_nom || 'le patient'} refusée.`);
      setRejectModalTransfer(null);
      setRejectMotif('');
      await fetchTransfers();
      setTimeout(() => setMessage(''), 5000);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erreur lors du refus du transfert.');
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      if (statusFilter !== 'ALL' && t.statut !== statusFilter) return false;
      if (!searchQuery.trim()) return true;
      return matchesSearchText(t, searchQuery, [
        'patient_nom',
        'patient_medtransfer_id',
        'etablissement_origine_nom',
        'motif_transfert',
        'priorite',
        'statut',
      ]);
    });
  }, [transfers, statusFilter, searchQuery]);

  const pendingCount = transfers.filter((t) => t.statut === 'EN_ATTENTE').length;

  return (
    <div className="space-y-6 min-w-0">
      {/* Header Banner */}
      <div className="p-5 sm:p-6 bg-gradient-to-r from-[#123B5D] to-[#1976D2] rounded-2xl text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs uppercase font-bold tracking-wider text-sky-200 block">
            Bureau des Entrées & Admissions • Régulation Hospitalière
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight">
            Demandes de Transfert Reçues
          </h2>
          <p className="text-xs sm:text-sm text-sky-100 max-w-2xl">
            Examinez et validez administrativement les demandes d'admission par transfert adressées à{' '}
            <strong>{user?.etablissement?.nom || 'votre établissement'}</strong>. L'acceptation ouvre
            immédiatement la prise en charge pour les médecins du service.
          </p>
        </div>
        {user?.etablissement && (
          <div className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 text-xs shrink-0">
            <span className="text-sky-200 block text-[10px] uppercase font-semibold">Établissement d'accueil</span>
            <span className="font-bold text-sm font-mono">
              {user.etablissement.code} — {user.etablissement.ville}
            </span>
          </div>
        )}
      </div>

      {message && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Filter Tabs & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {[
            { key: 'ALL', label: 'Toutes les demandes' },
            { key: 'EN_ATTENTE', label: `En attente (${pendingCount})` },
            { key: 'ACCEPTE', label: 'Acceptées' },
            { key: 'REFUSE', label: 'Refusées' },
            { key: 'TERMINE', label: 'Clôturées' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                statusFilter === tab.key
                  ? 'bg-[#1976D2] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="w-full md:w-80">
          <GlobalSearch
            value={searchQuery}
            onSearch={setSearchQuery}
            onClear={() => setSearchQuery('')}
            loading={loading}
            placeholder="Rechercher par patient, identifiant, hôpital..."
            debounceMs={300}
          />
        </div>
      </div>

      {/* Transfers Table */}
      {loading ? (
        <LoadingSkeleton type="table" lines={5} />
      ) : (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[#123B5D] font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3.5 px-4">Patient</th>
                <th className="py-3.5 px-4">Établissement Émetteur</th>
                <th className="py-3.5 px-4">Date de Demande</th>
                <th className="py-3.5 px-4">Priorité</th>
                <th className="py-3.5 px-4">Statut</th>
                <th className="py-3.5 px-4">Motif</th>
                <th className="py-3.5 px-4 text-right">Décision d'Admission</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ArrowRightLeft className="w-8 h-8 text-slate-300" />
                      <span>Aucune demande de transfert correspondant aux critères.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-[#123B5D] block">
                        {t.patient_nom || 'Patient non spécifié'}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 block">
                        ID: {t.patient_medtransfer_id || `#${t.patient}`}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-medium text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{t.etablissement_origine_nom || 'Établissement inconnu'}</span>
                      </div>
                      {t.medecin_demandeur_nom && (
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Par Dr {t.medecin_demandeur_nom}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                      {formatDateTime(t.created_at)}
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.priorite === 'URGENTE'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : t.priorite === 'ELEVEE'
                            ? 'bg-orange-50 text-orange-700 border border-orange-200'
                            : 'bg-sky-50 text-sky-700 border border-sky-200'
                        }`}
                      >
                        {t.priorite}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <Badge status={t.statut}>{t.statut_display || t.statut}</Badge>
                      {t.motif_refus && (
                        <span className="text-[10px] text-rose-600 block mt-1 max-w-[160px] truncate" title={t.motif_refus}>
                          Motif refus : {t.motif_refus}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 max-w-xs">
                      <span className="line-clamp-2 text-slate-600" title={t.motif_transfert}>
                        {t.motif_transfert || 'Aucun motif renseigné'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setSelectedTransfer(t)}
                          className="p-1.5 text-slate-500 hover:text-[#123B5D] hover:bg-slate-100 rounded-lg border border-slate-200"
                          title="Consulter le résumé du transfert"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEmailForTransfer(t)}
                          className="p-1.5 text-slate-500 hover:text-[#1976D2] hover:bg-sky-50 rounded-lg border border-slate-200 transition-colors"
                          title="Coordonner la logistique / admissions par e-mail"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>

                        {t.statut === 'EN_ATTENTE' && (
                          <>
                            <button
                              type="button"
                              onClick={() => setAcceptModalTransfer(t)}
                              disabled={actionLoadingId === t.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Accepter
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectModalTransfer(t);
                                setRejectMotif('');
                              }}
                              disabled={actionLoadingId === t.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Refuser
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Détails du Transfert */}
      <Modal
        isOpen={!!selectedTransfer}
        onClose={() => setSelectedTransfer(null)}
        title="Détails de la Demande de Transfert"
        maxWidth="max-w-xl"
      >
        {selectedTransfer && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Patient</span>
                <span className="font-bold text-[#123B5D] text-sm block">
                  {selectedTransfer.patient_nom}
                </span>
                <span className="font-mono text-slate-500 block">
                  Identifiant : {selectedTransfer.patient_medtransfer_id}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Priorité & Statut</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-bold text-rose-600 uppercase">{selectedTransfer.priorite}</span>
                  <Badge status={selectedTransfer.statut}>{selectedTransfer.statut_display || selectedTransfer.statut}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Établissement Émetteur</span>
                <p className="font-semibold text-slate-700 mt-0.5">
                  {selectedTransfer.etablissement_origine_nom}
                  {selectedTransfer.medecin_demandeur_nom && ` — Dr ${selectedTransfer.medecin_demandeur_nom}`}
                </p>
                <span className="text-slate-400 text-[11px] block">
                  Émis le {formatDateTime(selectedTransfer.created_at)}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Motif du Transfert</span>
                <p className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 whitespace-pre-wrap mt-0.5">
                  {selectedTransfer.motif_transfert || 'Non spécifié'}
                </p>
              </div>

              {selectedTransfer.resume_clinique && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Résumé Clinique Succinct</span>
                  <p className="p-3 rounded-lg bg-sky-50/50 border border-sky-100 text-slate-700 whitespace-pre-wrap mt-0.5">
                    {selectedTransfer.resume_clinique}
                  </p>
                </div>
              )}

              {selectedTransfer.motif_refus && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900">
                  <span className="text-[10px] uppercase font-bold text-rose-700 block">Motif du Refus</span>
                  <p className="mt-0.5">{selectedTransfer.motif_refus}</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleOpenEmailForTransfer(selectedTransfer)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Contacter par e-mail</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTransfer(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Confirmation Acceptation */}
      <Modal
        isOpen={!!acceptModalTransfer}
        onClose={() => setAcceptModalTransfer(null)}
        title="Valider l'admission par transfert"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600">
            Confirmez-vous l'admission de{' '}
            <strong className="text-[#123B5D]">
              {acceptModalTransfer?.patient_nom} ({acceptModalTransfer?.patient_medtransfer_id})
            </strong>{' '}
            dans votre établissement ?
          </p>
          <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed">
              Une prise en charge médicale active sera immédiatement ouverte au sein de votre établissement,
              permettant aux praticiens d'accéder au dossier et de débuter les soins.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setAcceptModalTransfer(null)}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirmAccept}
              disabled={actionLoadingId === acceptModalTransfer?.id}
              className="px-4 py-1.5 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
            >
              Confirmer l'acceptation
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Refus Transfert avec Motif Obligatoire */}
      <Modal
        isOpen={!!rejectModalTransfer}
        onClose={() => setRejectModalTransfer(null)}
        title="Refuser la demande de transfert"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleConfirmReject} className="space-y-4 text-xs">
          <p className="text-slate-600">
            Indiquez le motif justifiant le refus d'admission pour{' '}
            <strong className="text-[#123B5D]">
              {rejectModalTransfer?.patient_nom}
            </strong>
            . Ce motif sera consigné et transmis à l'établissement d'origine.
          </p>
          <div>
            <label className="block font-semibold text-[#123B5D] uppercase text-[10px] tracking-wider mb-1">
              Motif du refus *
            </label>
            <textarea
              value={rejectMotif}
              onChange={(e) => setRejectMotif(e.target.value)}
              placeholder="Ex : Capacité d'accueil saturée, service indisponible, orientation inadéquate..."
              required
              rows={3}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-[#1976D2]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setRejectModalTransfer(null)}
              className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={actionLoadingId === rejectModalTransfer?.id}
              className="px-4 py-1.5 font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
            >
              Confirmer le refus
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

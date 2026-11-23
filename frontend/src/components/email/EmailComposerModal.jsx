import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail,
  Copy,
  Check,
  ExternalLink,
  X,
  AlertTriangle,
  Info,
  ShieldCheck,
  User,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  buildMailtoUrl,
  checkMailtoLength,
  copyTextToClipboard,
  isValidEmail,
} from '../../utils/emailUtils';
import {
  getAvailableTemplates,
  logEmailEvent,
} from '../../services/emailComposerService';

export const EmailComposerModal = ({
  isOpen,
  onClose,
  initialRecipient = '',
  initialRecipientName = '',
  allowedRecipients = [],
  contextCategory = 'ALL',
  contextData = {},
}) => {
  const { user } = useAuth();

  const availableTemplates = useMemo(() => {
    return getAvailableTemplates(user?.role || 'AGENT', contextCategory);
  }, [user?.role, contextCategory]);

  const defaultTemplate = availableTemplates[0] || null;

  const [recipient, setRecipient] = useState(initialRecipient || '');
  const [recipientName, setRecipientName] = useState(initialRecipientName || '');
  const [cc, setCc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(defaultTemplate?.id || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [copied, setCopied] = useState(false);
  const [clientRequested, setClientRequested] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Initialisation lors de l'ouverture
  useEffect(() => {
    if (isOpen) {
      const recEmail = initialRecipient || '';
      const recName = initialRecipientName || '';
      setRecipient(recEmail);
      setRecipientName(recName);
      setCc('');
      setShowCc(false);
      setCopied(false);
      setClientRequested(false);
      setErrorMessage('');

      const tpl = availableTemplates[0];
      if (tpl) {
        setSelectedTemplateId(tpl.id);
        const mergedCtx = {
          ...contextData,
          recipientEmail: recEmail,
          recipientName: recName,
        };
        setSubject(tpl.subject(mergedCtx, user));
        setBody(tpl.body(mergedCtx, user));
      } else {
        setSelectedTemplateId('');
        setSubject('');
        setBody('');
      }

      // Traçabilité de l'ouverture de la fenêtre (non bloquant)
      logEmailEvent('EMAIL_COMPOSER_OPENED', {
        recipientEmail: recEmail,
        templateKey: tpl?.id || 'MANUAL',
        module: contextCategory,
        entityType: contextData.entityType || '',
        entityId: contextData.entityId || '',
      });
    }
  }, [isOpen, initialRecipient, initialRecipientName]);

  // Changement de modèle
  const handleTemplateChange = (e) => {
    const templateId = e.target.value;
    setSelectedTemplateId(templateId);

    const tpl = availableTemplates.find((t) => t.id === templateId);
    if (tpl) {
      const mergedCtx = {
        ...contextData,
        recipientEmail: recipient,
        recipientName: recipientName,
      };
      setSubject(tpl.subject(mergedCtx, user));
      setBody(tpl.body(mergedCtx, user));
      setErrorMessage('');
    }
  };

  // Sélection d'un destinataire dans la liste autorisée
  const handleSelectRecipient = (e) => {
    const selectedEmail = e.target.value;
    setRecipient(selectedEmail);
    const found = allowedRecipients.find((r) => (r.email || r) === selectedEmail);
    if (found && typeof found === 'object') {
      const name = found.nom_complet || `${found.first_name || ''} ${found.last_name || ''}`.trim() || found.nom || '';
      setRecipientName(name);
    }
    setErrorMessage('');
  };

  // Construction dynamique du mailto et vérification de la longueur
  const mailtoUrl = useMemo(() => {
    return buildMailtoUrl({
      to: recipient,
      cc,
      subject,
      body,
    });
  }, [recipient, cc, subject, body]);

  const lengthCheck = useMemo(() => {
    return checkMailtoLength(mailtoUrl);
  }, [mailtoUrl]);

  // Action principale : Ouvrir dans la messagerie
  const handleOpenClient = () => {
    setErrorMessage('');

    if (!recipient.trim()) {
      setErrorMessage("Veuillez renseigner l'adresse e-mail du destinataire.");
      return;
    }

    if (!isValidEmail(recipient.trim())) {
      setErrorMessage("Le format de l'adresse e-mail du destinataire est invalide.");
      return;
    }

    if (cc.trim()) {
      const ccList = cc.split(/[,;]/).map((item) => item.trim()).filter(Boolean);
      const invalid = ccList.find((c) => !isValidEmail(c));
      if (invalid) {
        setErrorMessage(`L'adresse e-mail en copie suivante est invalide : "${invalid}".`);
        return;
      }
    }

    // Déclenchement de l'ouverture du client de messagerie
    window.location.href = mailtoUrl;
    setClientRequested(true);

    // Journalisation d'audit technique (sans le contenu textuel)
    logEmailEvent('EMAIL_CLIENT_OPEN_REQUESTED', {
      recipientEmail: recipient,
      templateKey: selectedTemplateId,
      module: contextCategory,
      entityType: contextData.entityType || '',
      entityId: contextData.entityId || '',
    });
  };

  // Action secondaire : Copier le contenu
  const handleCopyContent = async () => {
    const textToCopy = `À : ${recipient}\n` +
      (cc ? `CC : ${cc}\n` : '') +
      `Objet : ${subject}\n\n` +
      `${body}`;

    const success = await copyTextToClipboard(textToCopy);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);

      logEmailEvent('EMAIL_CONTENT_COPIED', {
        recipientEmail: recipient,
        templateKey: selectedTemplateId,
        module: contextCategory,
        entityType: contextData.entityType || '',
        entityId: contextData.entityId || '',
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl my-auto bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* En-tête de la modale */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-[#EAF3FB]/50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1976D2] text-white shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#123B5D]">
                Préparation d'un e-mail professionnel
              </h3>
              <p className="text-xs text-slate-500">
                Ouverture assistée dans votre application de messagerie personnelle
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps de la modale */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs sm:text-sm">
          {/* Notification après ouverture du client */}
          {clientRequested && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-[#1976D2] shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <span className="font-bold block">Votre application de messagerie a été sollicitée.</span>
                Vérifiez la fenêtre de votre client de messagerie (Gmail, Outlook, Thunderbird...). Vous pouvez y modifier librement votre texte avant l'envoi final.
              </div>
            </div>
          )}

          {/* Erreur de validation */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Compte expéditeur indicatif */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-slate-600 font-semibold">
                <User className="w-3.5 h-3.5 text-[#1976D2]" />
                <span>Compte MEDTRANSFER :</span>
                <span className="font-mono text-[#123B5D] font-bold">{user?.email || 'Non renseigné'}</span>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                {user?.role || 'PROFESSIONNEL'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
              <strong>Compte d'envoi réel :</strong> Il dépend exclusivement de votre logiciel ou client de messagerie (ex: Gmail, Outlook). MEDTRANSFER n'impose aucune boîte d'envoi et n'accède à aucun mot de passe de messagerie.
            </p>
          </div>

          {/* 2. Destinataire (À) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#123B5D] uppercase tracking-wider">
                Destinataire (À) *
              </label>
              {!showCc && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="text-xs font-semibold text-[#1976D2] hover:underline cursor-pointer"
                >
                  + Ajouter une copie (CC)
                </button>
              )}
            </div>

            {allowedRecipients.length > 0 ? (
              <div className="space-y-1.5">
                <select
                  value={recipient}
                  onChange={handleSelectRecipient}
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] focus:ring-2 focus:ring-[#1976D2]/15 text-xs sm:text-sm text-slate-800 outline-none"
                >
                  <option value="">-- Sélectionner un contact autorisé --</option>
                  {allowedRecipients.map((c, idx) => {
                    const mail = c.email || c;
                    const label = c.nom_complet || (c.first_name ? `${c.first_name} ${c.last_name || ''} (${c.role || ''})` : c.nom || mail);
                    return (
                      <option key={idx} value={mail}>
                        {label} — {mail}
                      </option>
                    );
                  })}
                </select>
                <input
                  type="email"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="adresse@domaine.sn"
                  className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] focus:ring-2 focus:ring-[#1976D2]/15 text-xs sm:text-sm text-slate-800 outline-none"
                  required
                />
              </div>
            ) : (
              <input
                type="email"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="adresse@domaine.sn"
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] focus:ring-2 focus:ring-[#1976D2]/15 text-xs sm:text-sm text-slate-800 outline-none"
                required
              />
            )}
            {recipientName && (
              <span className="text-[11px] text-slate-500 mt-1 block">
                Contact : <strong className="text-slate-700">{recipientName}</strong>
              </span>
            )}
          </div>

          {/* 3. Copie facultative (CC) */}
          {showCc && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-[#123B5D] uppercase tracking-wider">
                  Copie (CC)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setCc('');
                    setShowCc(false);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Masquer
                </button>
              </div>
              <input
                type="email"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="copie@etablissement.sn"
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] focus:ring-2 focus:ring-[#1976D2]/15 text-xs sm:text-sm text-slate-800 outline-none"
              />
            </div>
          )}

          {/* 4. Sélecteur de modèle */}
          {availableTemplates.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-[#123B5D] uppercase tracking-wider mb-1">
                Modèle de message adapté
              </label>
              <select
                value={selectedTemplateId}
                onChange={handleTemplateChange}
                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] focus:ring-2 focus:ring-[#1976D2]/15 text-xs sm:text-sm text-slate-800 outline-none font-medium"
              >
                {availableTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 5. Objet */}
          <div>
            <label className="block text-xs font-bold text-[#123B5D] uppercase tracking-wider mb-1">
              Objet de l'e-mail *
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Objet du message..."
              className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] focus:ring-2 focus:ring-[#1976D2]/15 text-xs sm:text-sm text-slate-800 outline-none font-medium"
              required
            />
          </div>

          {/* 6. Corps du message */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-[#123B5D] uppercase tracking-wider">
                Corps du message *
              </label>
              <span className="text-[11px] text-slate-400">
                {body.length} caractères
              </span>
            </div>
            <textarea
              rows={7}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-3 bg-white rounded-xl border border-slate-200 focus:border-[#1976D2] focus:ring-2 focus:ring-[#1976D2]/15 text-xs sm:text-sm text-slate-800 outline-none leading-relaxed font-normal"
              placeholder="Rédigez votre message ici..."
              required
            />
          </div>

          {/* Avertissement de longueur mailto si nécessaire */}
          {lengthCheck.warning && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{lengthCheck.warning}</span>
            </div>
          )}

          {/* Rappel déontologique & sécurité des données de santé */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2 text-[11px] text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Règle de confidentialité :</strong> Ne divulguez aucun secret médical (pathologie, résultats, traitements) par e-mail ordinaire. Utilisez uniquement les références de dossiers sécurisées de MEDTRANSFER.
            </span>
          </div>
        </div>

        {/* Pied de la modale avec boutons d'action */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 border-t border-slate-100 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            Annuler
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyContent}
              className="inline-flex items-center justify-center gap-1.5 w-full sm:w-auto px-4 py-2 text-xs font-semibold text-[#123B5D] bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors shadow-2xs cursor-pointer"
              title="Copier l'objet et le message pour les coller dans votre messagerie"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-bold">Copié dans le presse-papier !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copier le contenu</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleOpenClient}
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2 text-xs font-bold text-white bg-[#1976D2] hover:bg-[#1565C0] rounded-xl transition-all shadow-md shadow-[#1976D2]/25 hover:shadow-lg cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Ouvrir dans ma messagerie</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

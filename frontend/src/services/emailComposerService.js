import apiClient from '../api/client';

/**
 * Modèles d'e-mails institutionnels et professionnels de MEDTRANSFER.
 * Respect strict de la déontologie : AUCUNE donnée médicale sensible (diagnostics, antécédents, traitements)
 * n'est jamais injectée dans les messages de messagerie ordinaire non chiffrée.
 */
export const EMAIL_TEMPLATES = {
  // --------------------------------------------------------------------------
  // 1. Modèles Administrateur Général (ADMIN)
  // --------------------------------------------------------------------------
  ADMIN_DIRECTOR_CONTACT: {
    id: 'ADMIN_DIRECTOR_CONTACT',
    name: 'Communication administrative avec la Direction',
    roles: ['ADMIN'],
    subject: (ctx) => `Communication administrative — Établissement ${ctx.etablissementNom || ''} — MEDTRANSFER`,
    body: (ctx, user) => `Bonjour ${ctx.recipientName || 'Monsieur/Madame le Directeur'},\n\n` +
      `Dans le cadre du suivi des activités des établissements hospitaliers affiliés à la plateforme MEDTRANSFER, je vous contacte au sujet de votre établissement (${ctx.etablissementNom || 'votre établissement'}).\n\n` +
      `[Précisez ici l'objet de votre démarche : nomination, audit des accès, conformité réglementaire ou organisation du service]\n\n` +
      `Je vous remercie par avance pour votre retour et reste à votre disposition pour tout échange complémentaire.\n\n` +
      `Cordialement,\n\n` +
      `${user?.first_name || ''} ${user?.last_name || ''}\n` +
      `Administration Générale MEDTRANSFER\n` +
      `contact@medtransfer.sn`,
  },

  ADMIN_DIRECTOR_REQUEST: {
    id: 'ADMIN_DIRECTOR_REQUEST',
    name: 'Demande de pièces complémentaires (Candidature Directeur)',
    roles: ['ADMIN'],
    subject: (ctx) => `Demande de pièces complémentaires — Candidature Direction ${ctx.etablissementNom || ''} — MEDTRANSFER`,
    body: (ctx, user) => `Bonjour ${ctx.recipientName || ''},\n\n` +
      `Nous avons bien reçu votre demande d'accès en qualité de Directeur d'établissement pour « ${ctx.etablissementNom || 'votre structure'} » sur la plateforme MEDTRANSFER.\n\n` +
      `Afin de permettre la validation définitive de votre compte par l'Administration Générale, nous vous remercions de bien vouloir nous transmettre par retour d'e-mail les éléments complémentaires suivants :\n\n` +
      `- [Précisez ici les pièces requises : arrêté de nomination, pièce d'identité officielle, confirmation de mandat...]\n\n` +
      `Dès réception et vérification de ces documents, votre compte sera activé et vous recevrez votre confirmation d'accès.\n\n` +
      `Cordialement,\n\n` +
      `${user?.first_name || ''} ${user?.last_name || ''}\n` +
      `Administration Générale MEDTRANSFER`,
  },

  ADMIN_MAINTENANCE_ANNOUNCEMENT: {
    id: 'ADMIN_MAINTENANCE_ANNOUNCEMENT',
    name: 'Information institutionnelle / Avis technique',
    roles: ['ADMIN'],
    subject: () => `Avis technique et information institutionnelle — Plateforme MEDTRANSFER`,
    body: (ctx, user) => `Bonjour,\n\n` +
      `L'Administration Générale de MEDTRANSFER souhaite porter à votre attention une information importante concernant l'exploitation de la plateforme :\n\n` +
      `[Détaillez ici l'objet de la communication : maintenance programmée, évolution réglementaire, nouvelles fonctionnalités ou consignes de sécurité]\n\n` +
      `Date d'effet / Calendrier : [Précisez la date ou la période concernée]\n\n` +
      `Nous vous remercions pour votre collaboration continue au service de la continuité des soins.\n\n` +
      `Cordialement,\n\n` +
      `${user?.first_name || ''} ${user?.last_name || ''}\n` +
      `Administration Générale MEDTRANSFER`,
  },

  // --------------------------------------------------------------------------
  // 2. Modèles Directeur d'Établissement (DIRECTEUR)
  // --------------------------------------------------------------------------
  DIRECTOR_MEETING_CONVOCATION: {
    id: 'DIRECTOR_MEETING_CONVOCATION',
    name: 'Convocation à une réunion de service / CME',
    roles: ['DIRECTEUR', 'ADMIN'],
    subject: (ctx) => `Convocation : Réunion de coordination — ${ctx.etablissementNom || 'Direction'}`,
    body: (ctx, user) => `Bonjour ${ctx.recipientName || 'Docteur, cher(e) collègue'},\n\n` +
      `Vous êtes convié(e) à participer à une réunion de coordination au sein de notre établissement.\n\n` +
      `Ordre du jour : [Précisez l'ordre du jour ou le sujet de la réunion]\n` +
      `Date : [Indiquez la date, ex: Lundi 1er Décembre 2026]\n` +
      `Heure : [Indiquez l'heure, ex: 10h00]\n` +
      `Lieu / Modalité : [Salle de réunion / visioconférence]\n\n` +
      `Votre présence et votre contribution sont vivement souhaitées.\n\n` +
      `Bien cordialement,\n\n` +
      `${user?.first_name || ''} ${user?.last_name || ''}\n` +
      `Direction — ${user?.etablissement?.nom || ctx.etablissementNom || 'Établissement de santé'}`,
  },

  DIRECTOR_SERVICE_NOTE: {
    id: 'DIRECTOR_SERVICE_NOTE',
    name: 'Note de service interne / Consigne d’organisation',
    roles: ['DIRECTEUR', 'ADMIN'],
    subject: (ctx) => `Note de service interne — ${ctx.etablissementNom || 'Direction de l’établissement'}`,
    body: (ctx, user) => `Bonjour,\n\n` +
      `Veuillez prendre connaissance de la présente note de service relative à l'organisation de nos activités au sein de ${user?.etablissement?.nom || ctx.etablissementNom || 'notre établissement'} :\n\n` +
      `[Détaillez la consigne : protocole d'admission, astreintes médicales, organisation des urgences ou usage de MEDTRANSFER]\n\n` +
      `Cette disposition entre en vigueur à compter du [Date].\n\n` +
      `Je vous remercie pour votre engagement au quotidien.\n\n` +
      `Bien cordialement,\n\n` +
      `${user?.first_name || ''} ${user?.last_name || ''}\n` +
      `Directeur d'établissement`,
  },

  DIRECTOR_REPORT_REQUEST: {
    id: 'DIRECTOR_REPORT_REQUEST',
    name: 'Demande de rapport d’activité ou de transmission',
    roles: ['DIRECTEUR', 'ADMIN'],
    subject: (ctx) => `Demande de rapport d'activité — ${ctx.recipientName || 'Direction'}`,
    body: (ctx, user) => `Bonjour ${ctx.recipientName || ''},\n\n` +
      `Dans le cadre de l'évaluation continue de la prise en charge et de la régulation des soins au sein de notre établissement, je vous saurais gré de bien vouloir me transmettre un rapport d'étape concernant :\n\n` +
      `[Objet : bilan des transferts, activité du service, gestion des urgences ou synthèse organisationnelle]\n\n` +
      `Merci de bien vouloir me faire parvenir ces éléments d'ici le [Date limite souhaitée].\n\n` +
      `Bien cordialement,\n\n` +
      `${user?.first_name || ''} ${user?.last_name || ''}\n` +
      `Direction — ${user?.etablissement?.nom || 'Établissement'}`,
  },

  DIRECTOR_INTER_HOSPITAL: {
    id: 'DIRECTOR_INTER_HOSPITAL',
    name: 'Contact institutionnel inter-hôpitaux',
    roles: ['DIRECTEUR', 'ADMIN'],
    subject: (ctx) => `Coordination inter-établissements — ${user?.etablissement?.code || 'Direction'} / ${ctx.etablissementNom || 'Établissement confrère'}`,
    body: (ctx, user) => `Bonjour Monsieur/Madame le Directeur,\n\n` +
      `En qualité de Directeur de l'établissement « ${user?.etablissement?.nom || 'notre établissement'} », je prends attache avec votre direction au sujet de la coordination inter-hospitalière entre nos structures respectives.\n\n` +
      `[Objet : convention de transfert, capacité d'accueil, filière de soins spécialisée ou coordination d'urgence]\n\n` +
      `Je me tiens à votre entière disposition pour échanger de vive voix ou organiser une séance de travail.\n\n` +
      `Bien confraternellement,\n\n` +
      `${user?.first_name || ''} ${user?.last_name || ''}\n` +
      `Directeur — ${user?.etablissement?.nom || ''}`,
  },

  // --------------------------------------------------------------------------
  // 3. Modèles Coordination Médicale (MEDECIN)
  // --------------------------------------------------------------------------
  TRANSFER_COORDINATION: {
    id: 'TRANSFER_COORDINATION',
    name: 'Alerte et coordination administrative de transfert médical',
    roles: ['MEDECIN', 'AGENT', 'DIRECTEUR', 'ADMIN'],
    subject: (ctx) => `[TRANSFERT MEDTRANSFER] Coordination transfert réf. ${ctx.transfertRef || ctx.transfertId || 'En cours'} — ${ctx.etablissementDestinationCode || ''}`,
    body: (ctx, user) => `Bonjour Cher(e) Confrère,\n\n` +
      `Une demande d'orientation/transfert inter-hospitalier a été émise sur la plateforme MEDTRANSFER depuis notre établissement (${user?.etablissement?.nom || 'Établissement demandeur'}).\n\n` +
      `Informations administratives de référence :\n` +
      `- Numéro de demande : ${ctx.transfertRef || ctx.transfertId || 'Consulter MEDTRANSFER'}\n` +
      `- Structure émettrice : ${user?.etablissement?.nom || ''} (${user?.etablissement?.code || ''})\n` +
      `- Structure réceptrice sollicitée : ${ctx.etablissementDestinationNom || 'Votre établissement'}\n` +
      `- Médecin demandeur : Dr ${user?.first_name || ''} ${user?.last_name || ''}\n\n` +
      `Pour des raisons strictes de secret médical, aucun identifiant de patient, diagnostic ou donnée clinique n'est communiqué dans ce message non chiffré.\n\n` +
      `L'instruction du dossier s'effectue exclusivement sous authentification sécurisée sur la plateforme MEDTRANSFER :\n` +
      `${window.location.origin}/doctor/transfers\n\n` +
      `Merci de bien vouloir vous connecter pour traiter cette demande.\n\n` +
      `Bien confraternellement,\n\n` +
      `Dr ${user?.first_name || ''} ${user?.last_name || ''}\n` +
      `${user?.specialite ? user.specialite + ' — ' : ''}${user?.etablissement?.nom || ''}`,
  },

  EMERGENCY_COORDINATION: {
    id: 'EMERGENCY_COORDINATION',
    name: 'Avis confraternel suite à une prise en charge d’urgence',
    roles: ['MEDECIN', 'DIRECTEUR', 'ADMIN'],
    subject: () => `[URGENCE MEDTRANSFER] Notification confraternelle — Accès d'urgence enregistré`,
    body: (ctx, user) => `Bonjour Cher(e) Confrère,\n\n` +
      `Je vous informe qu'une prise en charge d'urgence a nécessité la consultation d'un dossier partagé de votre patientèle au sein de notre établissement (${user?.etablissement?.nom || 'notre établissement'}).\n\n` +
      `Date de l'admission : ${new Date().toLocaleDateString('fr-FR')}\n\n` +
      `Conformément aux protocoles de traçabilité et aux exigences de confidentialité médicale, aucun identifiant patient ni élément clinique n'est transmis par e-mail en clair. Une alerte sécurisée a été générée sur votre espace professionnel MEDTRANSFER, où l'ensemble des actes et constantes d'urgence sont consultables sous accès authentifié.\n\n` +
      `Lien d'accès sécurisé : ${window.location.origin}/doctor/dashboard\n\n` +
      `Je reste joignable au sein de mon service pour tout échange confraternel de vive voix si nécessaire.\n\n` +
      `Bien confraternellement,\n\n` +
      `Dr ${user?.first_name || ''} ${user?.last_name || ''}\n` +
      `${user?.etablissement?.nom || ''}`,
  },

  // --------------------------------------------------------------------------
  // 4. Modèles Coordination Administrative / Logistique (AGENT)
  // --------------------------------------------------------------------------
  TRANSFER_LOGISTICS: {
    id: 'TRANSFER_LOGISTICS',
    name: 'Coordination logistique d’admission et d’arrivée',
    roles: ['AGENT', 'MEDECIN', 'DIRECTEUR', 'ADMIN'],
    subject: (ctx) => `[LOGISTIQUE TRANSFERT] Coordination logistique réf. ${ctx.transfertRef || ctx.transfertId || ''} — Bureau des Admissions`,
    body: (ctx, user) => `Bonjour,\n\n` +
      `Je vous contacte depuis le service des admissions de ${user?.etablissement?.nom || 'notre établissement'} concernant le suivi organisationnel du transfert référencé ci-dessous sur MEDTRANSFER :\n\n` +
      `- Numéro de référence transfert : ${ctx.transfertRef || ctx.transfertId || 'À consulter sur la plateforme'}\n` +
      `- Mode d'acheminement prévu : [Ambulance médicalisée / Véhicule sanitaire / Transport propre]\n` +
      `- Heure estimée d'arrivée : [Indiquer l'heure prévisionnelle]\n\n` +
      `Rappel déontologique : Afin de respecter le secret professionnel et la protection des données de santé, aucun nom ou identifiant de patient n'est mentionné par e-mail. Veuillez consulter le dossier administratif directement sur la plateforme MEDTRANSFER.\n\n` +
      `Merci de bien vouloir nous confirmer la disponibilité de l'équipe d'accueil.\n\n` +
      `Cordialement,\n\n` +
      `${user?.first_name || ''} ${user?.last_name || ''}\n` +
      `Service des Admissions — ${user?.etablissement?.nom || ''}`,
  },

  // --------------------------------------------------------------------------
  // 5. Modèle Général / Contact Libre
  // --------------------------------------------------------------------------
  GENERAL_CONTACT: {
    id: 'GENERAL_CONTACT',
    name: 'Demande d’information ou contact administratif libre',
    roles: ['ADMIN', 'DIRECTEUR', 'MEDECIN', 'AGENT'],
    subject: (ctx) => `Demande d'information administrative — MEDTRANSFER${ctx.objetContextuel ? ' — ' + ctx.objetContextuel : ''}`,
    body: (ctx, user) => `Bonjour ${ctx.recipientName || ''},\n\n` +
      `Je vous contacte dans le cadre de nos activités professionnelles sur la plateforme MEDTRANSFER.\n\n` +
      `[Détaillez ici votre demande d'ordre organisationnel ou administratif]\n\n` +
      `Avertissement déontologique : Aucun identifiant patient, diagnostic, prescription ou donnée médicale confidentielle ne doit être mentionné dans ce message ordinaire.\n\n` +
      `Je vous remercie par avance pour votre retour.\n\n` +
      `Cordialement,\n\n` +
      `${user?.first_name || ''} ${user?.last_name || ''}\n` +
      `${user?.fonction || user?.specialite || 'Professionnel de santé'}\n` +
      `${user?.etablissement?.nom || 'MEDTRANSFER'}`,
  },
};

/**
 * Retourne la liste des modèles autorisés et pertinents pour l'utilisateur connecté selon son rôle et son contexte.
 */
export const getAvailableTemplates = (userRole, contextCategory = 'ALL') => {
  return Object.values(EMAIL_TEMPLATES).filter((tpl) => {
    // Vérification du rôle
    const roleAllowed = tpl.roles.includes(userRole) || tpl.roles.includes('ALL');
    if (!roleAllowed) return false;

    // Filtrage contextuel optionnel
    if (contextCategory === 'TRANSFER') {
      return ['TRANSFER_COORDINATION', 'TRANSFER_LOGISTICS', 'GENERAL_CONTACT'].includes(tpl.id);
    }
    if (contextCategory === 'EMERGENCY') {
      return ['EMERGENCY_COORDINATION', 'GENERAL_CONTACT'].includes(tpl.id);
    }
    if (contextCategory === 'STAFF') {
      return ['DIRECTOR_MEETING_CONVOCATION', 'DIRECTOR_SERVICE_NOTE', 'DIRECTOR_REPORT_REQUEST', 'GENERAL_CONTACT'].includes(tpl.id);
    }
    if (contextCategory === 'ESTABLISHMENT') {
      return ['ADMIN_DIRECTOR_CONTACT', 'DIRECTOR_INTER_HOSPITAL', 'GENERAL_CONTACT'].includes(tpl.id);
    }
    return true;
  });
};

/**
 * Service de journalisation technique non bloquant (Fire & Forget).
 * Ne stocke JAMAIS le corps ni le contenu textuel complet du message.
 */
export const logEmailEvent = async (action, context = {}) => {
  try {
    await apiClient.post('/audit/email-action/', {
      action,
      context: {
        recipient_email: context.recipientEmail || '',
        template_key: context.templateKey || '',
        module: context.module || 'EmailComposer',
        entity_type: context.entityType || '',
        entity_id: context.entityId || '',
      },
    });
  } catch (err) {
    // La journalisation technique ne doit jamais bloquer l'expérience utilisateur
    console.warn('[Audit Email] Enregistrement d’action non bloquant :', err?.message);
  }
};

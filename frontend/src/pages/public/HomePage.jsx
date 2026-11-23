import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  User,
  ArrowRight,
  PlayCircle,
  Building2,
  FileText,
  Users,
  Share2,
  ArrowRightLeft,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Menu,
  X,
  ChevronRight,
  HeartPulse,
} from 'lucide-react';

export const HomePage = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    if (id === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      const navHeight = 80;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
      window.scrollTo({
        top: elementPosition - navHeight,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F9] text-slate-800 flex flex-col font-sans selection:bg-[#1976D2] selection:text-white">
      {/* ========================================================= */}
      {/* 1. BARRE DE NAVIGATION (NAVBAR)                           */}
      {/* ========================================================= */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-white ${
          scrolled ? 'shadow-md border-b border-slate-200/80 py-3' : 'border-b border-slate-100 py-4'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo + Marque */}
            <button
              type="button"
              onClick={() => scrollToSection('top')}
              className="flex items-center gap-3 text-left group transition-transform focus:outline-none"
            >
              <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#1976D2] to-sky-400 text-white shadow-md group-hover:shadow-lg transition-all">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-xl font-black text-[#123B5D] tracking-tight block">
                  MEDTRANSFER
                </span>
                <span className="text-[10px] font-bold text-[#1976D2] tracking-widest block uppercase">
                  Plateforme Médicale
                </span>
              </div>
            </button>

            {/* Navigation centrale (Desktop) */}
            <nav className="hidden md:flex items-center gap-1 lg:gap-2">
              <button
                type="button"
                onClick={() => scrollToSection('top')}
                className="px-3.5 py-2 text-xs font-bold text-[#123B5D] hover:text-[#1976D2] rounded-lg hover:bg-slate-50 transition-colors"
              >
                Accueil
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('about')}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-[#1976D2] rounded-lg hover:bg-slate-50 transition-colors"
              >
                À propos
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('features')}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-[#1976D2] rounded-lg hover:bg-slate-50 transition-colors"
              >
                Fonctionnalités
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('contact')}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-[#1976D2] rounded-lg hover:bg-slate-50 transition-colors"
              >
                Contact
              </button>
            </nav>

            {/* Action droite (Connexion) */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1976D2] hover:bg-[#1565C0] text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                <User className="w-4 h-4" />
                Se connecter
              </Link>
            </div>

            {/* Bouton Menu Mobile */}
            <div className="flex md:hidden items-center gap-2">
              <Link
                to="/login"
                className="px-3 py-1.5 bg-[#1976D2] text-white text-xs font-bold rounded-lg"
              >
                Connexion
              </Link>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 text-slate-600 hover:text-[#123B5D] hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Ouvrir le menu"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Menu Déroulant Mobile */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 pt-3 pb-5 space-y-2 animate-in fade-in slide-in-from-top-4 duration-200">
            <button
              type="button"
              onClick={() => scrollToSection('top')}
              className="block w-full text-left px-3 py-2 text-sm font-bold text-[#123B5D] rounded-lg hover:bg-slate-50"
            >
              Accueil
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('about')}
              className="block w-full text-left px-3 py-2 text-sm font-semibold text-slate-700 rounded-lg hover:bg-slate-50"
            >
              À propos
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('features')}
              className="block w-full text-left px-3 py-2 text-sm font-semibold text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Fonctionnalités
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('contact')}
              className="block w-full text-left px-3 py-2 text-sm font-semibold text-slate-700 rounded-lg hover:bg-slate-50"
            >
              Contact
            </button>
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1976D2] text-white text-xs font-bold rounded-xl shadow-sm"
              >
                <User className="w-4 h-4" />
                Se connecter
              </Link>
              <Link
                to="/register"
                className="w-full text-center px-4 py-2 text-xs font-semibold text-[#123B5D] bg-slate-100 rounded-xl"
              >
                Inscription Professionnel
              </Link>
              <Link
                to="/register-director"
                className="w-full text-center px-4 py-2 text-xs font-semibold text-sky-800 bg-sky-50 rounded-xl"
              >
                Demande Accès Directeur
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ========================================================= */}
      {/* 2. HERO SECTION — SECTION PRINCIPALE                      */}
      {/* ========================================================= */}
      <section
        id="hero"
        className="relative pt-28 sm:pt-36 pb-12 sm:pb-20 overflow-hidden bg-white"
      >
        {/* Décors d'arrière-plan discrets */}
        <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-gradient-to-br from-[#EAF3FB] to-sky-100/40 rounded-full blur-3xl -z-10 translate-x-1/3 -translate-y-1/4 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-50/50 rounded-full blur-2xl -z-10 -translate-x-1/3 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Colonne gauche (Texte & CTA) */}
            <div className="lg:col-span-7 space-y-6 text-left">
              {/* Petit badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAF3FB] text-[#1976D2] border border-[#1976D2]/20 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-[#1976D2] animate-pulse" />
                Plateforme de santé numérique
              </div>

              {/* Titre principal */}
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[46px] font-black text-[#123B5D] leading-tight tracking-tight">
                La continuité des soins, au cœur de chaque{' '}
                <span className="text-[#1976D2]">parcours de santé</span>.
              </h1>

              {/* Texte de présentation */}
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl">
                MEDTRANSFER est une plateforme numérique de gestion de l'historique médical et
                d'orientation des patients. Elle facilite la coordination entre les établissements
                de santé, sécurise les informations médicales et favorise la continuité des soins à
                travers un système centralisé et intelligent.
              </p>

              {/* Boutons d'action */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
                <Link
                  to="/login"
                  className="px-6 py-3.5 bg-[#1976D2] hover:bg-[#1565C0] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 group active:scale-95"
                >
                  <User className="w-4 h-4" />
                  Se connecter
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                <button
                  type="button"
                  onClick={() => scrollToSection('about')}
                  className="px-6 py-3.5 bg-white hover:bg-slate-50 text-[#123B5D] text-xs sm:text-sm font-bold rounded-xl border border-slate-200 hover:border-slate-300 shadow-xs transition-all flex items-center justify-center gap-2.5 active:scale-95"
                >
                  <PlayCircle className="w-4 h-4 text-[#1976D2]" />
                  Découvrir la plateforme
                </button>
              </div>

              {/* Mini-indicateurs de confiance */}
              <div className="pt-6 border-t border-slate-100 grid grid-cols-3 gap-4 max-w-lg">
                <div>
                  <span className="text-xl sm:text-2xl font-black text-[#123B5D] block">100%</span>
                  <span className="text-[11px] font-semibold text-slate-500">Dossier sécurisé</span>
                </div>
                <div>
                  <span className="text-xl sm:text-2xl font-black text-[#1976D2] block">24/7</span>
                  <span className="text-[11px] font-semibold text-slate-500">Accès urgences</span>
                </div>
                <div>
                  <span className="text-xl sm:text-2xl font-black text-emerald-600 block">Interopérabilité</span>
                  <span className="text-[11px] font-semibold text-slate-500">Inter-hôpitaux</span>
                </div>
              </div>
            </div>

            {/* Colonne droite : Photographie du médecin avec forme courbe & motif ECG */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              {/* Forme courbe bleue décorative en arrière-plan */}
              <div className="absolute -inset-4 sm:-inset-6 bg-gradient-to-tr from-[#1976D2]/15 via-[#EAF3FB] to-transparent rounded-[40px] -rotate-2 -z-10" />

              {/* Conteneur principal de l'image */}
              <div className="relative w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border-4 border-white bg-slate-100">
                <img
                  src="/images/doctor-hero.jpg"
                  alt="Médecin professionnel MEDTRANSFER"
                  className="w-full h-[420px] sm:h-[480px] object-cover object-top hover:scale-102 transition-transform duration-500"
                />

                {/* Motif courbe douce en surimpression basse */}
                <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#123B5D]/80 via-[#123B5D]/30 to-transparent pointer-events-none" />

                {/* Signal médical ECG incrusté */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-white z-10 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-5 h-5 text-sky-300 animate-pulse" />
                    <div>
                      <span className="text-[11px] font-bold block leading-none">Coordination active</span>
                      <span className="text-[9px] text-sky-200">Réseau hospitalier connecté</span>
                    </div>
                  </div>
                  {/* Tracé ECG SVG */}
                  <svg
                    className="w-24 h-6 text-sky-300 stroke-current shrink-0"
                    viewBox="0 0 100 24"
                    fill="none"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M0 12 H25 L32 4 L42 22 L50 7 L58 17 L65 12 H100" />
                  </svg>
                </div>
              </div>

              {/* Badge flottant institutionnel */}
              <div className="absolute -bottom-4 -left-4 sm:bottom-6 sm:-left-6 bg-white p-3.5 rounded-2xl shadow-xl border border-slate-100 flex items-center gap-3 animate-in fade-in duration-700">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-black text-[#123B5D] block">Secret Médical Garanti</span>
                  <span className="text-[10px] text-slate-500 font-medium">Chiffrement & Traçabilité</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. BANDEAU « À PROPOS DE MEDTRANSFER »                    */}
      {/* ========================================================= */}
      <section id="about" className="py-10 sm:py-14 bg-[#F4F6F9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-[#EAF3FB] border border-sky-200/70 rounded-3xl p-6 sm:p-10 shadow-sm relative overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Gauche : Icône + séparateur */}
              <div className="lg:col-span-2 flex items-center lg:justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#1976D2] text-white flex items-center justify-center shadow-md shrink-0">
                  <Building2 className="w-8 h-8" />
                </div>
                {/* Séparateur vertical bleu (visible en desktop) */}
                <div className="hidden lg:block w-px h-24 bg-[#1976D2]/30 shrink-0" />
              </div>

              {/* Centre : Titre & Texte */}
              <div className="lg:col-span-6 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#1976D2]">
                  À propos de MEDTRANSFER
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-[#123B5D] leading-snug">
                  Une nouvelle vision de la coordination médicale
                </h2>
                <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                  MEDTRANSFER vise à améliorer la circulation sécurisée des informations médicales
                  entre les établissements de santé. La plateforme favorise une meilleure coordination
                  des professionnels, facilite l'orientation des patients et contribue à préserver la
                  continuité de leur parcours de soins.
                </p>
              </div>

              {/* Droite : Photographie de l'établissement hospitalier moderne */}
              <div className="lg:col-span-4 flex justify-center lg:justify-end">
                <div className="relative rounded-2xl overflow-hidden shadow-md border-2 border-white w-full max-w-sm h-48 sm:h-52 bg-slate-200">
                  <img
                    src="/images/hospital-building.jpg"
                    alt="Établissement hospitalier moderne partenaire MEDTRANSFER"
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#123B5D]/60 via-transparent to-transparent flex items-end p-3">
                    <span className="text-[11px] font-bold text-white tracking-wide">
                      Réseau hospitalier interconnecté
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. SECTION « NOS FONCTIONNALITÉS »                        */}
      {/* ========================================================= */}
      <section id="features" className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Titre centré avec trait bleu */}
          <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#1976D2] block mb-1">
              Modules & Services
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-[#123B5D]">
              Nos fonctionnalités
            </h2>
            <div className="w-16 h-1 bg-[#1976D2] rounded-full mx-auto mt-3" />
            <p className="text-xs sm:text-sm text-slate-500 mt-4 leading-relaxed">
              Des outils conçus pour répondre précisément aux besoins des médecins, des directeurs
              d'hôpitaux et des équipes d'accueil hospitalières.
            </p>
          </div>

          {/* Grille des 6 Cartes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Carte 1 — Dossier médical centralisé */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md hover:border-[#1976D2]/40 transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#EAF3FB] text-[#1976D2] flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#123B5D] mb-2">
                  Dossier médical centralisé
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Conservation et consultation sécurisée de l'historique médical du patient.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-[#1976D2]">
                <span>Historique unifié</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Carte 2 — Gestion des patients */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md hover:border-[#1976D2]/40 transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#EAF3FB] text-[#1976D2] flex items-center justify-center mb-4">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#123B5D] mb-2">
                  Gestion des patients
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Identification administrative et suivi organisé des patients.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-[#1976D2]">
                <span>Identifiant permanent MT</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Carte 3 — Coordination des établissements */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md hover:border-[#1976D2]/40 transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#EAF3FB] text-[#1976D2] flex items-center justify-center mb-4">
                  <Share2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#123B5D] mb-2">
                  Coordination des établissements
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Mise en relation des établissements de santé autour du parcours du patient.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-[#1976D2]">
                <span>Annuaire partagé</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Carte 4 — Transfert des patients */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md hover:border-[#1976D2]/40 transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#EAF3FB] text-[#1976D2] flex items-center justify-center mb-4">
                  <ArrowRightLeft className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#123B5D] mb-2">
                  Transfert des patients
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Gestion et suivi des transferts inter-établissements.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-[#1976D2]">
                <span>Traçabilité bout en bout</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Carte 5 — Gestion des urgences */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-[#16A34A] flex items-center justify-center mb-4">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#123B5D] mb-2">
                  Gestion des urgences
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Accès exceptionnel et contrôlé aux informations médicales en situation d'urgence.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-[#16A34A]">
                <span>Accès d'urgence 24h</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Carte 6 — Assistant intelligent */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:shadow-md hover:border-sky-300 transition-all duration-200 hover:-translate-y-1 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-xl bg-[#EAF3FB] text-[#1976D2] flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-[#123B5D] mb-2">
                  Assistant intelligent
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Assistance à la synthèse et à l'orientation médicale, avec validation par les professionnels habilités.
                </p>
              </div>
              <div className="mt-5 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-[11px] font-bold text-[#1976D2]">
                <span>Aide à la décision</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. SECTION « NOTRE ENGAGEMENT »                           */}
      {/* ========================================================= */}
      <section className="py-10 sm:py-16 bg-[#F4F6F9]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col lg:flex-row">
            {/* Colonne gauche (Bleu principal) */}
            <div className="bg-[#1976D2] text-white p-8 lg:p-10 flex flex-col justify-center items-center text-center lg:w-80 shrink-0">
              <ShieldCheck className="w-10 h-10 text-white mb-2" />
              <h3 className="text-2xl font-black text-white leading-tight">
                Notre engagement
              </h3>
              <p className="text-xs text-sky-100 mt-2">
                Des principes stricts au service de la santé publique.
              </p>
            </div>

            {/* Colonne droite : 5 engagements avec icônes vertes et séparateurs verticaux fins */}
            <div className="p-6 sm:p-8 flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-6 sm:gap-4 items-center">
              {/* Engagement 1 */}
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-2 md:pr-4 md:border-r border-slate-100">
                <CheckCircle2 className="w-6 h-6 text-[#16A34A] shrink-0" />
                <span className="text-xs font-bold text-[#123B5D]">
                  Sécurité des données médicales
                </span>
              </div>

              {/* Engagement 2 */}
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-2 md:px-4 md:border-r border-slate-100">
                <CheckCircle2 className="w-6 h-6 text-[#16A34A] shrink-0" />
                <span className="text-xs font-bold text-[#123B5D]">
                  Confidentialité des informations
                </span>
              </div>

              {/* Engagement 3 */}
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-2 md:px-4 md:border-r border-slate-100">
                <CheckCircle2 className="w-6 h-6 text-[#16A34A] shrink-0" />
                <span className="text-xs font-bold text-[#123B5D]">
                  Continuité des soins
                </span>
              </div>

              {/* Engagement 4 */}
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-2 md:px-4 md:border-r border-slate-100">
                <CheckCircle2 className="w-6 h-6 text-[#16A34A] shrink-0" />
                <span className="text-xs font-bold text-[#123B5D]">
                  Coordination entre professionnels
                </span>
              </div>

              {/* Engagement 5 */}
              <div className="flex flex-col items-center sm:items-start text-center sm:text-left space-y-2 md:pl-4">
                <CheckCircle2 className="w-6 h-6 text-[#16A34A] shrink-0" />
                <span className="text-xs font-bold text-[#123B5D]">
                  Modernisation du système de santé
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 6. SECTION FINALE — APPEL À L'ACTION (CTA)                */}
      {/* ========================================================= */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-12 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1976D2]">
                Espace Professionnel & Établissements
              </span>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-[#123B5D] leading-snug max-w-xl">
                Ensemble, construisons un parcours de soins plus connecté et plus sécurisé.
              </h2>
            </div>

            <div className="shrink-0 w-full sm:w-auto flex justify-center">
              <Link
                to="/login"
                className="w-full sm:w-auto px-7 py-4 bg-[#16A34A] hover:bg-[#15803D] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 active:scale-95"
              >
                <User className="w-4 h-4" />
                Accéder à mon espace professionnel
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 7. PIED DE PAGE (FOOTER)                                  */}
      {/* ========================================================= */}
      <footer id="contact" className="bg-[#123B5D] text-white pt-16 pb-8 border-t border-[#1976D2]/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/10">
            {/* Colonne 1 : Marque & Description */}
            <div className="md:col-span-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1976D2] to-sky-400 text-white shadow-md">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="text-lg font-black text-white tracking-tight block">
                    MEDTRANSFER
                  </span>
                  <span className="text-[9px] font-semibold tracking-wider text-sky-300 uppercase block">
                    Santé Numérique
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed max-w-sm">
                MEDTRANSFER est la plateforme numérique de gestion de l'historique médical et
                d'orientation des patients, favorisant la coordination inter-établissements et la
                continuité des soins.
              </p>

              <div className="flex items-center gap-2 pt-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-white/10 text-sky-200 border border-white/15">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Système d'information sécurisé
                </span>
              </div>
            </div>

            {/* Colonne 2 : Liens de navigation */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                Navigation
              </h4>
              <ul className="space-y-2 text-xs text-slate-300">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('top')}
                    className="hover:text-white transition-colors"
                  >
                    Accueil
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('about')}
                    className="hover:text-white transition-colors"
                  >
                    À propos
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('features')}
                    className="hover:text-white transition-colors"
                  >
                    Fonctionnalités
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('contact')}
                    className="hover:text-white transition-colors"
                  >
                    Contact
                  </button>
                </li>
              </ul>
            </div>

            {/* Colonne 3 : Accès professionnels & Sécurité */}
            <div className="md:col-span-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-sky-300">
                Espace Professionnel
              </h4>
              <ul className="space-y-2 text-xs text-slate-300">
                <li>
                  <Link to="/login" className="hover:text-white transition-colors flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#1976D2]" />
                    Connexion sécurisée
                  </Link>
                </li>
                <li>
                  <Link to="/register" className="hover:text-white transition-colors flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    Inscription Médecin & Agent
                  </Link>
                </li>
                <li>
                  <Link to="/register-director" className="hover:text-white transition-colors flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    Demande d'accès Directeur
                  </Link>
                </li>
              </ul>

              <div className="pt-3 text-[11px] text-slate-400 leading-relaxed border-t border-white/10">
                <p>
                  Données de santé hébergées en conformité stricte avec les normes de confidentialité et
                  le secret médical professionnel.
                </p>
              </div>
            </div>
          </div>

          {/* Bas de page Copyright */}
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
            <span>
              © 2026 MEDTRANSFER. Tous droits réservés.
            </span>
            <span className="text-[11px] text-slate-400">
              Plateforme institutionnelle de coordination et d'orientation des soins.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Apple,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Globe,
  HardDrive,
  Laptop,
  Moon,
  Play,
  ShieldCheck,
  Sun,
  Terminal,
} from "lucide-react";
import { AtrisShotMark } from "../components/atris-shot-mark";
import { InteractiveShotSandbox } from "../components/interactive-shot-sandbox";
import { BentoFeatures } from "../components/bento-features";
import { FaqSection } from "../components/faq-section";
import { ProductFilmModal } from "../components/product-film-modal";
import { landingCopy, type LandingLocale } from "../lib/landing-copy";

type Platform = "windows-x86_64" | "darwin-aarch64" | "linux-x86_64";
type Theme = "light" | "dark";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "windows-x86_64";
  const value = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  if (value.includes("mac") || value.includes("darwin")) return "darwin-aarch64";
  if (value.includes("linux")) return "linux-x86_64";
  return "windows-x86_64";
}

export default function LandingPage() {
  const [platform, setPlatform] = useState<Platform>("windows-x86_64");
  const [theme, setTheme] = useState<Theme>("dark");
  const [locale, setLocale] = useState<LandingLocale>("tr");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [filmModalOpen, setFilmModalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const languageRef = useRef<HTMLDivElement>(null);
  const copy = landingCopy[locale];

  useEffect(() => {
    setPlatform(detectPlatform());
    const isDark = document.documentElement.classList.contains("dark");
    setTheme(isDark ? "dark" : "light");

    const savedLocale = localStorage.getItem("atrisshot-site-language");
    const nextLocale = savedLocale === "en" ? "en" : "tr";
    setLocale(nextLocale);
    document.documentElement.lang = nextLocale;
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (languageRef.current && !languageRef.current.contains(event.target as Node)) {
        setLanguageOpen(false);
      }
    };
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("atrisshot-site-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  const changeLocale = (next: LandingLocale) => {
    setLocale(next);
    setLanguageOpen(false);
    localStorage.setItem("atrisshot-site-language", next);
    document.documentElement.lang = next;
  };

  const platformLabels = {
    "windows-x86_64": {
      title: "Windows",
      cta: copy.platform.windows,
      detail: copy.platform.windowsDetail,
    },
    "darwin-aarch64": {
      title: "macOS",
      cta: copy.platform.mac,
      detail: copy.platform.macDetail,
    },
    "linux-x86_64": {
      title: "Linux",
      cta: copy.platform.linux,
      detail: copy.platform.linuxDetail,
    },
  } satisfies Record<Platform, { title: string; cta: string; detail: string }>;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground transition-colors duration-200">
      {/* Sinematik Remotion Ürün Filmi Modalı */}
      <ProductFilmModal
        isOpen={filmModalOpen}
        onClose={() => setFilmModalOpen(false)}
        locale={locale}
      />

      {/* ========================================================================= */}
      {/* ÜST GEZİNME ÇUBUĞU (Header)                                               */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & Mark */}
          <a
            href="#"
            className="group flex items-center gap-2.5 transition active:scale-98"
            aria-label="AtrisShot"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <AtrisShotMark className="h-9 w-9 rounded-xl shadow-xs transition-transform duration-300 group-hover:scale-105" />
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-foreground">
                ATRISSHOT
              </span>
              <span className="hidden sm:inline-block rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase text-primary">
                v1.0.1
              </span>
            </div>
          </a>

          {/* Orta Linkler */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
            <a
              href="#studio"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {copy.nav.studio}
            </a>
            <a
              href="#features"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {copy.nav.features}
            </a>
            <a
              href="#workflow"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {copy.nav.workflow}
            </a>
            <a
              href="#privacy"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {copy.nav.privacy}
            </a>
            <a
              href="#faq"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {copy.nav.faq}
            </a>
            <a
              href="#download"
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {copy.nav.download}
            </a>
            <a
              href="https://atrishub.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <span>{copy.nav.hubLink}</span>
            </a>
          </nav>

          {/* Sağ Eylemler: Dil, Tema & İndir Butonu */}
          <div className="flex items-center gap-2">
            {/* Dil Seçici */}
            <div ref={languageRef} className="relative">
              <button
                type="button"
                onClick={() => setLanguageOpen((open) => !open)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-bold text-muted-foreground transition hover:text-foreground hover:bg-muted"
                aria-label={copy.language.label}
                aria-expanded={languageOpen}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{locale.toUpperCase()}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>

              {languageOpen && (
                <div className="absolute right-0 mt-2 w-32 rounded-xl border border-border bg-card p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in duration-150">
                  {(["tr", "en"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => changeLocale(lang)}
                      className={`w-full rounded-lg px-2.5 py-1.5 text-left text-xs font-bold transition ${
                        locale === lang
                          ? "bg-primary/15 text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {copy.language[lang]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tema Geçişi */}
            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:text-foreground hover:bg-muted"
              aria-label={theme === "dark" ? copy.theme.light : copy.theme.dark}
            >
              {!mounted ? (
                <span className="h-4 w-4" />
              ) : theme === "dark" ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-slate-700" />
              )}
            </button>

            {/* Birincil İndir Butonu */}
            <a
              href="#download"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{copy.nav.download}</span>
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* ========================================================================= */}
        {/* BÖLÜM 1: HERO ALANI VE CANLI İNTERAKTİF TUVAL STÜDYOSU                    */}
        {/* ========================================================================= */}
        <section id="hero" className="relative overflow-hidden border-b border-border">
          {/* Izgara ve Radial Glow Arka Plan */}
          <div className="hero-grid absolute inset-0 pointer-events-none opacity-80" />
          <div className="hero-radial-glow absolute inset-0 pointer-events-none" />

          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[1.06fr_1.24fr] lg:items-center">
              {/* Sol Kolon: Başlık, CTA'lar ve Rozetler */}
              <div className="min-w-0">
                {/* Canlı Sinyal Noktası ve Eyebrow */}
                <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse-dot" />
                  <span>{copy.hero.eyebrow}</span>
                </div>

                {/* Ana Başlık */}
                <h1 className="mt-4 text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-[3.25rem]">
                  {copy.hero.title}
                </h1>

                {/* Açıklama */}
                <p className="mt-5 text-sm sm:text-base leading-relaxed text-muted-foreground">
                  {copy.hero.description}
                </p>

                {/* CTA Düğmeleri: Hızlı İndir + Sinematik Tanıtım Filmi */}
                <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3">
                  <a
                    href={
                      platform === "darwin-aarch64"
                        ? "#download"
                        : `/api/releases/download-platform/${platform}`
                    }
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 sm:px-6 text-xs sm:text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/25 transition hover:-translate-y-0.5 hover:bg-primary/90 active:translate-y-0 whitespace-nowrap"
                  >
                    <Download className="h-4 w-4 shrink-0" />
                    <span>{platformLabels[platform].cta}</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setFilmModalOpen(true)}
                    className="group inline-flex h-12 items-center justify-center gap-2.5 rounded-xl border border-border bg-card px-4 sm:px-5 text-xs sm:text-sm font-bold text-foreground shadow-xs transition hover:border-primary/50 hover:bg-muted active:scale-98 whitespace-nowrap"
                  >
                    <div className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition group-hover:scale-110">
                      <Play className="h-2.5 w-2.5 fill-current ml-0.5" />
                    </div>
                    <span>{copy.hero.watchFilm}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-mono text-muted-foreground shrink-0">
                      {copy.hero.filmDuration}
                    </span>
                  </button>
                </div>

                {/* Özellik Rozetleri */}
                <div className="mt-8 grid grid-cols-2 gap-2 text-xs font-semibold text-muted-foreground">
                  {copy.hero.badges.map((badge) => (
                    <div key={badge} className="flex items-center gap-1.5">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{badge}</span>
                    </div>
                  ))}
                </div>

                <p className="mt-5 text-[11px] font-mono text-muted-foreground border-t border-border pt-3">
                  {platformLabels[platform].detail} · {copy.hero.update}
                </p>
              </div>

              {/* Sağ Kolon: Canlı İnteraktif Tuval Stüdyosu */}
              <div id="studio" className="min-w-0 scroll-mt-24">
                <InteractiveShotSandbox locale={locale} />
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* BÖLÜM 2: BENTO GRID VİTRİNİ (5 Çekirdek Masaüstü Gücü)                     */}
        {/* ========================================================================= */}
        <BentoFeatures locale={locale} />

        {/* ========================================================================= */}
        {/* BÖLÜM 3: 3 ADIMLI SÜRTÜNMESİZ İŞ AKIŞI (Workflow)                        */}
        {/* ========================================================================= */}
        <section id="workflow" className="scroll-mt-20 border-t border-border py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
              {copy.workflow.eyebrow}
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">
              {copy.workflow.title}
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {copy.workflow.steps.map((step) => (
              <div
                key={step.num}
                className="relative rounded-2xl border border-border bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xs transition hover:border-primary/40 hover:-translate-y-1"
              >
                <div>
                  <span className="font-mono text-3xl font-black text-primary/40 block">
                    {step.num}
                  </span>
                  <h3 className="mt-4 text-lg font-black">{step.title}</h3>
                  <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {step.desc}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-border/60 pt-4 text-[11px] font-mono text-muted-foreground">
                  <span>AtrisShot Flow</span>
                  <ChevronRight className="h-4 w-4 text-primary" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* BÖLÜM 4: GİZLİLİK VE YEREL MİMARİ (Local-First)                          */}
        {/* ========================================================================= */}
        <section id="privacy" className="scroll-mt-20 border-y border-border bg-card/40 py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto grid gap-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">
                {copy.privacy.eyebrow}
              </p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">
                {copy.privacy.title}
              </h2>
              <p className="mt-4 text-sm sm:text-base leading-relaxed text-muted-foreground">
                {copy.privacy.description}
              </p>

              <div className="mt-6 flex items-center gap-2 text-xs font-mono text-primary font-bold">
                <ShieldCheck className="h-4 w-4" />
                <span>Zero Cloud Storage · Local DPAPI & Keychain Encryption</span>
              </div>
            </div>

            <div className="lg:col-span-7 grid gap-4 sm:grid-cols-3">
              {copy.privacy.cards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-border bg-background p-5 flex flex-col justify-between shadow-xs"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
                    <HardDrive className="h-4 w-4" />
                  </div>
                  <h3 className="mt-4 text-sm font-black">{card.title}</h3>
                  <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                    {card.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* BÖLÜM 5: SIKÇA SORULAN SORULAR (FAQ)                                      */}
        {/* ========================================================================= */}
        <FaqSection locale={locale} />

        {/* ========================================================================= */}
        {/* BÖLÜM 6: İNDİRME VE PLATFORM SÜRÜMLERİ (Download)                         */}
        {/* ========================================================================= */}
        <section id="download" className="scroll-mt-20 py-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto text-center">
          <AtrisShotMark className="mx-auto h-16 w-16 rounded-2xl shadow-lg" />
          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-primary">
            {copy.download.eyebrow}
          </p>
          <h2 className="mt-2 text-3xl sm:text-5xl font-black tracking-tight">
            {copy.download.title}
          </h2>
          <p className="mt-4 max-w-xl mx-auto text-sm sm:text-base text-muted-foreground leading-relaxed">
            {copy.download.description}
          </p>

          {/* 3 Platform Kartı: Windows, macOS ve Linux */}
          <div className="mt-10 grid gap-5 md:grid-cols-3 text-left max-w-5xl mx-auto">
            {/* Windows İndirme Kartı */}
            <a
              href="/api/releases/download-platform/windows-x86_64"
              className="group relative rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Laptop className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-black uppercase text-primary">
                    {copy.download.cardWindows.badge}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-black group-hover:text-primary transition">
                  {copy.download.cardWindows.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {copy.download.cardWindows.version}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {copy.download.cardWindows.type}
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-primary border-t border-border/60 pt-4">
                <Download className="h-3.5 w-3.5" />
                <span>{copy.platform.windows}</span>
              </div>
            </a>

            {/* macOS İndirme Kartı (Yakında) */}
            <div className="group relative rounded-2xl border border-border/80 bg-card/60 p-6 flex flex-col justify-between opacity-90">
              <div>
                <div className="flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground">
                    <Apple className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-primary">
                    {copy.download.cardMac.badge}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-black text-foreground">
                  {copy.download.cardMac.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {copy.download.cardMac.version}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {copy.download.cardMac.type}
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground border-t border-border/60 pt-4">
                <span>{copy.platform.macDetail}</span>
              </div>
            </div>

            {/* Linux İndirme Kartı */}
            <a
              href="/api/releases/download-platform/linux-x86_64"
              className="group relative rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary hover:-translate-y-1 hover:shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Terminal className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-black uppercase text-muted-foreground">
                    {copy.download.cardLinux.badge}
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-black group-hover:text-primary transition">
                  {copy.download.cardLinux.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  {copy.download.cardLinux.version}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {copy.download.cardLinux.type}
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-primary border-t border-border/60 pt-4">
                <Download className="h-3.5 w-3.5" />
                <span>{copy.platform.linux}</span>
              </div>
            </a>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" />
              {copy.download.signedBadge}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-primary" />
              {copy.download.freeBadge}
            </span>
            <a
              href="https://atrishub.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-foreground hover:text-primary transition"
            >
              <span>{copy.download.hubAccountBadge}</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* ALT BİLGİ (Footer - AtrisHub 3 Kolonlu Ekosistem Tasarımı)                */}
      {/* ========================================================================= */}
      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
            {/* Kolon 1: Marka Tanımı ve AtrisHub Girişi */}
            <div className="max-w-sm">
              <a
                href="#"
                className="inline-flex items-center gap-3"
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              >
                <AtrisShotMark className="h-9 w-9 rounded-xl shadow-xs" />
                <span className="text-lg font-semibold tracking-tight text-foreground">
                  AtrisShot
                </span>
              </a>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                {copy.footer.descriptor}
              </p>
              <a
                href="https://atrishub.com/?login=true"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                <span>{copy.footer.accountLabel}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Kolon 2: Atris Ürün Ailesi */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[.15em] text-muted-foreground">
                {copy.footer.productsLabel}
              </p>
              <nav className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3" aria-label={copy.footer.productsLabel}>
                {copy.ecosystemProducts.map((prod) => (
                  <a
                    key={prod.label}
                    href={prod.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground transition hover:text-foreground"
                  >
                    {prod.label}
                  </a>
                ))}
              </nav>
            </div>

            {/* Kolon 3: Sayfa İçi Gezinti ve Bağlantılar */}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[.15em] text-muted-foreground">
                {copy.footer.exploreLabel}
              </p>
              <nav className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3" aria-label={copy.footer.exploreLabel}>
                <a href="#studio" className="text-xs text-muted-foreground transition hover:text-foreground">
                  {copy.nav.studio}
                </a>
                <a href="#features" className="text-xs text-muted-foreground transition hover:text-foreground">
                  {copy.nav.features}
                </a>
                <a href="#workflow" className="text-xs text-muted-foreground transition hover:text-foreground">
                  {copy.nav.workflow}
                </a>
                <a href="#privacy" className="text-xs text-muted-foreground transition hover:text-foreground">
                  {copy.nav.privacy}
                </a>
                <a href="#faq" className="text-xs text-muted-foreground transition hover:text-foreground">
                  {copy.nav.faq}
                </a>
                <a href="#download" className="text-xs text-muted-foreground transition hover:text-foreground">
                  {copy.nav.download}
                </a>
                <a
                  href="https://github.com/merteren97"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  GitHub ↗
                </a>
                <a
                  href="https://www.linkedin.com/in/edip-mert-eren-232627160/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  LinkedIn ↗
                </a>
              </nav>
            </div>
          </div>

          {/* Alt Bilgi Çizgisi */}
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6 text-[10px] text-muted-foreground">
            <p>{copy.footer.rights}</p>
            <p>{copy.footer.builtBy}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

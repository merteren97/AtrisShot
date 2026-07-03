"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy, Crop, Download, Edit3, Globe, History, Laptop, Moon, ShieldCheck, Sun } from "lucide-react";
import { AtrisShotMark } from "../components/atris-shot-mark";
import AtrisShotProductFilm from "../components/atris-shot-product-film";
import { landingCopy, type LandingLocale } from "../lib/landing-copy";

type Platform = "windows-x86_64" | "linux-x86_64";
type Theme = "light" | "dark";

const platformOrder: Platform[] = ["windows-x86_64", "linux-x86_64"];

function detectPlatform(): Platform {
  const value = `${navigator.platform} ${navigator.userAgent}`.toLowerCase();
  return value.includes("linux") ? "linux-x86_64" : "windows-x86_64";
}

export default function LandingPage() {
  const [platform, setPlatform] = useState<Platform>("windows-x86_64");
  const [theme, setTheme] = useState<Theme>("dark");
  const [locale, setLocale] = useState<LandingLocale>("tr");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const languageRef = useRef<HTMLDivElement>(null);
  const copy = landingCopy[locale];

  useEffect(() => {
    setPlatform(detectPlatform());
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    const savedLocale = localStorage.getItem("atrisshot-site-language");
    const nextLocale = savedLocale === "en" ? "en" : "tr";
    setLocale(nextLocale);
    document.documentElement.lang = nextLocale;
    setMounted(true);
  }, []);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (languageRef.current && !languageRef.current.contains(event.target as Node)) setLanguageOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
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
    "windows-x86_64": { title: "Windows", cta: copy.platform.windows, detail: copy.platform.windowsDetail },
    "linux-x86_64": { title: "Linux", cta: copy.platform.linux, detail: copy.platform.linuxDetail },
  } satisfies Record<Platform, { title: string; cta: string; detail: string }>;

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground transition-colors">
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a
            href="#"
            className="group flex items-center gap-3 transition active:scale-[0.98]"
            aria-label="AtrisShot"
            onClick={(event) => {
              event.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <AtrisShotMark className="h-11 w-11 rounded-xl transition-transform duration-300 group-hover:scale-105" />
            <span className="font-black tracking-[0.08em] transition-colors duration-300 group-hover:text-primary">ATRISSHOT</span>
          </a>

          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#workflow" className="transition hover:text-foreground">{copy.nav.workflow}</a>
            <a href="#privacy" className="transition hover:text-foreground">{copy.nav.privacy}</a>
            <a href="#download" className="transition hover:text-foreground">{copy.nav.download}</a>
          </nav>

          <div className="flex items-center gap-2">
            <div ref={languageRef} className="relative" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => setLanguageOpen((open) => !open)}
                className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-xs font-bold text-muted-foreground transition hover:text-foreground"
                aria-label={copy.language.label}
                aria-expanded={languageOpen}
              >
                <Globe className="h-4 w-4" />
                {locale.toUpperCase()}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
              {languageOpen && (
                <div className="absolute right-0 mt-2 w-32 rounded-lg border border-border bg-card p-1.5 shadow-xl">
                  {(["tr", "en"] as const).map((language) => (
                    <button
                      key={language}
                      type="button"
                      onClick={() => changeLocale(language)}
                      className={`w-full rounded-md px-3 py-2 text-left text-xs font-bold transition ${
                        locale === language ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      {copy.language[language]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition hover:text-foreground"
              aria-label={theme === "dark" ? copy.theme.light : copy.theme.dark}
            >
              {!mounted ? <span className="h-4 w-4" /> : theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <a href="#download" className="hidden h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 sm:inline-flex">
              {copy.nav.download} <Download className="h-4 w-4" />
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative border-b border-border">
          <div className="hero-grid absolute inset-0 opacity-70" />
          <div className="hero-glow absolute left-1/2 top-0 h-[520px] w-[760px] -translate-x-1/2 rounded-full blur-3xl" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:items-center lg:py-24">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">{copy.hero.eyebrow}</p>
              <h1 className="mt-4 max-w-3xl text-5xl font-black leading-[0.98] tracking-tight sm:text-6xl">
                {copy.hero.title}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">{copy.hero.description}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href={`/api/releases/download-platform/${platform}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-extrabold text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5 hover:bg-primary/90">
                  <Download className="h-4 w-4" /> {platformLabels[platform].cta}
                </a>
                <a href="#workflow" className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 text-sm font-bold transition hover:bg-accent">
                  {copy.hero.secondary} <ChevronRight className="h-4 w-4" />
                </a>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {copy.highlights.map((item, index) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    {index === 0 ? <Check className="h-3.5 w-3.5 text-primary" /> : index === 1 ? <History className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-primary" />}
                    {item}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{platformLabels[platform].detail} · {copy.hero.update}</p>
            </div>
            <AtrisShotProductFilm locale={locale} />
          </div>
        </section>

        <section id="workflow" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 sm:px-8">
          <div className="grid gap-4 md:grid-cols-4">
            {[Laptop, Crop, Edit3, Copy].map((Icon, index) => (
              <article key={copy.workflow[index][0]} className="rounded-lg border border-border bg-card p-5">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                <h3 className="mt-5 font-extrabold">{copy.workflow[index][0]}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.workflow[index][1]}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="privacy" className="border-y border-border bg-card/40">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">{copy.privacy.eyebrow}</p>
              <h2 className="mt-4 text-4xl font-black tracking-tight">{copy.privacy.title}</h2>
              <p className="mt-5 max-w-xl leading-7 text-muted-foreground">{copy.privacy.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {copy.privacy.cards.map(([title, description]) => (
                <article key={title} className="rounded-lg border border-border bg-background p-5">
                  <h3 className="font-extrabold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="download" className="mx-auto max-w-5xl scroll-mt-24 px-5 py-20 text-center sm:px-8">
          <AtrisShotMark className="mx-auto h-14 w-14 rounded-xl" />
          <h2 className="mt-6 text-4xl font-black tracking-tight">{copy.download.title}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">{copy.download.description}</p>
          <div className="mx-auto mt-9 grid max-w-2xl gap-4 text-left sm:grid-cols-2">
            {platformOrder.map((target) => (
              <a key={target} href={`/api/releases/download-platform/${target}`} className="group rounded-lg border border-border bg-card p-5 transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg">
                <div className="flex items-center justify-between"><Laptop className="h-6 w-6 text-primary" /><Download className="h-4 w-4 text-muted-foreground transition group-hover:text-primary" /></div>
                <h3 className="mt-5 font-extrabold">{platformLabels[target].title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{platformLabels[target].detail}</p>
              </a>
            ))}
          </div>
          <p className="mx-auto mt-5 max-w-xl text-xs leading-5 text-muted-foreground">{copy.platform.macPaused}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> {copy.download.signed}</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> {copy.download.free}</span>
            <a href="https://atrishub.com" className="transition hover:text-foreground">{copy.download.hub}</a>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-2"><AtrisShotMark className="h-7 w-7 rounded-lg" /><span>© {new Date().getFullYear()} AtrisShot</span></div>
          <span>{copy.footer}</span>
        </div>
      </footer>
    </div>
  );
}

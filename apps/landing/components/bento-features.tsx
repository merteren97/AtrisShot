"use client";

import { useState } from "react";
import {
  AppWindow,
  Eye,
  EyeOff,
  FileImage,
  Laptop,
  Lock,
  Monitor,
  MoveUpRight,
  ShieldCheck,
  Terminal,
  WifiOff,
} from "lucide-react";
import type { LandingLocale } from "../lib/landing-copy";
import { landingCopy } from "../lib/landing-copy";

interface BentoFeaturesProps {
  locale: LandingLocale;
}

export function BentoFeatures({ locale }: BentoFeaturesProps) {
  const t = landingCopy[locale].bento;

  // Kart 1: Pencere tespiti simülasyonu
  const [selectedWindow, setSelectedWindow] = useState<number>(0);

  // Kart 2: Blur kaydırıcısı
  const [blurAmount, setBlurAmount] = useState(85);

  // Kart 3: Çift Çıktı Pipeline'ı seçimi
  const [outputFormat, setOutputFormat] = useState<"image" | "path">("image");
  const [copiedBadge, setCopiedBadge] = useState<string | null>(null);

  const copySample = (type: "image" | "path") => {
    setOutputFormat(type);
    const text =
      type === "image"
        ? t.card3.copiedImageToast
        : t.card3.copiedPathToast;
    setCopiedBadge(text);
    setTimeout(() => setCopiedBadge(null), 2400);
  };

  const mockWindows = [
    {
      title: "VS Code — main.rs",
      desc: "Rust Tauri Native",
      bounds: "x: 64, y: 120, w: 1440, h: 960",
      icon: Terminal,
    },
    {
      title: "Browser — AtrisHub Studio",
      desc: "Chromium Viewport",
      bounds: "x: 420, y: 180, w: 1280, h: 840",
      icon: AppWindow,
    },
    {
      title: "Slack — #engineering",
      desc: "Team Workspace",
      bounds: "x: 900, y: 240, w: 1024, h: 720",
      icon: Laptop,
    },
  ];

  const handoffTargets = [
    "GitHub PR",
    "Slack",
    "Discord",
    "Jira",
    "Figma",
    "Claude / Cursor",
  ];

  return (
    <section id="features" className="scroll-mt-20 py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Bölüm Başlığı */}
      <div className="text-center max-w-3xl mx-auto mb-16">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">
          {t.eyebrow}
        </p>
        <h2 className="mt-3 text-3xl sm:text-5xl font-black tracking-tight text-foreground">
          {t.title}
        </h2>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
          {t.subtitle}
        </p>
      </div>

      {/* Asimetrik Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
        {/* KART 1: Manyetik Pencere ve Çoklu Monitör Tespiti (Geniş 8 Kolon) */}
        <div className="md:col-span-2 lg:col-span-8 rounded-3xl border border-border/80 bg-card p-6 sm:p-9 flex flex-col justify-between shadow-xl transition-all duration-300 hover:border-primary/50 relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 rounded-full px-3 py-1">
                {t.card1.tag}
              </span>
              <span className="text-[10px] font-bold text-muted-foreground border border-border bg-muted/30 rounded-full px-2.5 py-0.5 flex items-center gap-1.5">
                <Monitor className="h-3 w-3 text-primary" />
                {t.card1.badgeAdaptive}
              </span>
              <span className="text-[10px] font-bold text-emerald-500 border border-emerald-500/30 bg-emerald-500/10 rounded-full px-2.5 py-0.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                {t.card1.badgeWindowSnap}
              </span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-black text-foreground">
              {t.card1.title}
            </h3>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl">
              {t.card1.desc}
            </p>
          </div>

          {/* İnteraktif Pencere Algılama Sahnesi */}
          <div className="relative z-10 mt-6 rounded-2xl border border-border bg-muted/20 p-4 sm:p-6 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground mb-4">
              <span className="font-mono font-bold flex items-center gap-1.5 text-foreground">
                <Monitor className="h-3.5 w-3.5 text-primary" />
                \\.\DISPLAY1 (3840 × 2160 @ 144Hz · 150% DPI)
              </span>
              <span className="text-[11px] font-semibold text-primary/90 flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {t.card1.interactiveHint}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {mockWindows.map((win, idx) => (
                <button
                  key={win.title}
                  type="button"
                  onClick={() => setSelectedWindow(idx)}
                  className={`relative p-3.5 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                    selectedWindow === idx
                      ? "border-primary bg-primary/10 shadow-md shadow-primary/5 ring-1 ring-primary/40 scale-[1.01]"
                      : "border-border/70 bg-card/70 hover:bg-card hover:border-border"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <win.icon
                      className={`h-4 w-4 ${
                        selectedWindow === idx ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    {selectedWindow === idx ? (
                      <span className="text-[9px] font-mono font-bold text-primary bg-primary/20 px-1.5 py-0.5 rounded">
                        LOCKED
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono text-muted-foreground">CLICK</span>
                    )}
                  </div>
                  <p className="mt-2.5 text-xs font-bold text-foreground truncate">
                    {win.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">{win.desc}</p>
                </button>
              ))}
            </div>

            <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-muted-foreground border-t border-border/60">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-foreground font-semibold">Tauri Native Window Tree</span>
                <span className="text-muted-foreground hidden sm:inline">({t.card1.subtext})</span>
              </div>
              <span className="text-primary font-bold">
                {mockWindows[selectedWindow].bounds}
              </span>
            </div>
          </div>
        </div>

        {/* KART 2: Piksel Düzeyinde Güvenli Sansürleme (Blur) (4 Kolon) */}
        <div className="md:col-span-2 lg:col-span-4 rounded-3xl border border-border/80 bg-card p-6 sm:p-9 flex flex-col justify-between shadow-xl transition-all duration-300 hover:border-primary/50 relative overflow-hidden group">
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 rounded-full px-3 py-1">
                {t.card2.tag}
              </span>
              <span className="text-[10px] font-bold text-primary border border-primary/30 bg-primary/10 rounded-full px-2.5 py-0.5 flex items-center gap-1">
                <Lock className="h-3 w-3" />
                {t.card2.badgeRedacted}
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-black text-foreground">
              {t.card2.title}
            </h3>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              {t.card2.desc}
            </p>
          </div>

          {/* İnteraktif Blur Slider Sahnesi */}
          <div className="relative z-10 mt-6 rounded-2xl border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-muted-foreground">{t.card2.sliderLabel}</span>
              <span className="text-primary font-bold">{blurAmount}% Redacted</span>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-border bg-card p-3 font-mono text-xs shadow-inner">
              <p className="text-muted-foreground text-[10px] flex items-center justify-between">
                <span>production_auth.secret</span>
                <span className="text-[9px] text-amber-500 font-bold">STRICT_CONFIDENTIAL</span>
              </p>
              <div className="relative mt-1.5 py-1">
                <span
                  style={{
                    filter: `blur(${blurAmount * 0.08}px)`,
                    userSelect: "none",
                  }}
                  className="font-bold text-foreground tracking-widest block transition-all"
                >
                  atris_sec_948f102bb04c8f002931aef7
                </span>
                {blurAmount > 45 && (
                  <span className="absolute inset-0 flex items-center justify-center font-black text-[10px] text-primary uppercase tracking-widest bg-primary/15 backdrop-blur-[2px] rounded border border-primary/30 shadow-sm">
                    {t.card2.redactedStamp}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <Eye className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="range"
                min="0"
                max="100"
                value={blurAmount}
                onChange={(e) => setBlurAmount(Number(e.target.value))}
                className="w-full accent-primary cursor-pointer h-1.5 rounded-lg bg-muted"
                aria-label="Blur slider"
              />
              <EyeOff className="h-3.5 w-3.5 text-primary shrink-0" />
            </div>

            <p className="mt-3 text-[10px] text-muted-foreground/90 font-medium text-center">
              {t.card2.safeNote}
            </p>
          </div>
        </div>

        {/* KART 3: Çift Çıktı Pipeline'ı (4 Kolon) */}
        <div className="md:col-span-1 lg:col-span-4 rounded-3xl border border-border/80 bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xl transition-all duration-300 hover:border-primary/50 relative overflow-hidden group">
          <div className="relative z-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 rounded-full px-3 py-1">
              {t.card3.tag}
            </span>
            <h3 className="mt-4 text-xl font-black text-foreground">{t.card3.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {t.card3.desc}
            </p>
          </div>

          <div className="relative z-10 mt-6 space-y-2.5">
            <button
              type="button"
              onClick={() => copySample("image")}
              className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                outputFormat === "image"
                  ? "border-primary bg-primary/15 text-primary shadow-sm"
                  : "border-border/80 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs flex items-center gap-2 text-foreground">
                  <FileImage className="h-4 w-4 text-primary" />
                  {t.card3.tabImageTitle}
                </span>
                <span className="font-mono text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                  image/png
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t.card3.tabImageDesc}
              </p>
            </button>

            <button
              type="button"
              onClick={() => copySample("path")}
              className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                outputFormat === "path"
                  ? "border-primary bg-primary/15 text-primary shadow-sm"
                  : "border-border/80 bg-card/60 text-muted-foreground hover:text-foreground hover:bg-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs flex items-center gap-2 text-foreground">
                  <Terminal className="h-4 w-4 text-primary" />
                  {t.card3.tabPathTitle}
                </span>
                <span className="font-mono text-[10px] font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10">
                  text/uri-list
                </span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t.card3.tabPathDesc}
              </p>
            </button>

            {copiedBadge ? (
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/30 text-center font-mono text-[11px] font-bold text-primary">
                ✓ {copiedBadge}
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-muted/30 border border-border/50 text-center font-mono text-[10px] text-muted-foreground">
                {t.card3.testHint}
              </div>
            )}
          </div>
        </div>

        {/* KART 4: Doğrudan Sürükle-Bırak Handoff (4 Kolon) */}
        <div className="md:col-span-1 lg:col-span-4 rounded-3xl border border-border/80 bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xl transition-all duration-300 hover:border-primary/50 relative overflow-hidden group">
          <div className="relative z-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 rounded-full px-3 py-1">
              {t.card4.tag}
            </span>
            <h3 className="mt-4 text-xl font-black text-foreground">{t.card4.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {t.card4.desc}
            </p>
          </div>

          <div className="relative z-10 mt-6 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <MoveUpRight className="h-5 w-5" />
            </div>

            <p className="mt-3 font-mono text-xs font-bold text-foreground">
              tauri-plugin-drag
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {t.card4.dropHint}
            </p>

            {/* Target Chips */}
            <div className="mt-3.5 pt-3 border-t border-border/50 flex flex-wrap justify-center gap-1.5">
              {handoffTargets.map((target) => (
                <span
                  key={target}
                  className="text-[10px] font-medium text-foreground bg-card/80 border border-border px-2 py-0.5 rounded-md"
                >
                  {target}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* KART 5: %100 Cihaz Üzerinde Enterprise Gizlilik (4 Kolon) */}
        <div className="md:col-span-2 lg:col-span-4 rounded-3xl border border-border/80 bg-card p-6 sm:p-8 flex flex-col justify-between shadow-xl transition-all duration-300 hover:border-primary/50 relative overflow-hidden group">
          <div className="relative z-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary border border-primary/30 bg-primary/10 rounded-full px-3 py-1">
              {t.card5.tag}
            </span>
            <h3 className="mt-4 text-xl font-black text-foreground">{t.card5.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {t.card5.desc}
            </p>
          </div>

          <div className="relative z-10 mt-6 space-y-2">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                <WifiOff className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-foreground">{t.card5.statCloud}</p>
                <p className="text-[10px] text-muted-foreground">{t.card5.statOffline}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 p-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary border border-primary/30">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-foreground">Windows DPAPI & macOS Keychain</p>
                <p className="text-[10px] text-muted-foreground">{t.card5.statDb}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

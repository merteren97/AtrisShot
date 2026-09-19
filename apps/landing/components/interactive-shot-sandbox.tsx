"use client";

import { useState } from "react";
import {
  AppWindow,
  ArrowUpRight,
  Camera,
  Check,
  Code2,
  Copy,
  Crop,
  Eye,
  EyeOff,
  FileImage,
  FolderOpen,
  Laptop,
  Lock,
  Monitor,
  MousePointer2,
  MoveUpRight,
  RotateCcw,
  ShieldCheck,
  Sliders,
  Sparkles,
  Square,
  Terminal,
} from "lucide-react";
import type { LandingLocale } from "../lib/landing-copy";
import { landingCopy } from "../lib/landing-copy";

interface InteractiveShotSandboxProps {
  locale: LandingLocale;
}

type SandboxTab = "snap" | "annotate" | "blur" | "output";

const COLOR_SWATCHES = [
  { name: "amber", hex: "#f59e0b" },
  { name: "sky", hex: "#0ea5e9" },
  { name: "emerald", hex: "#22c55e" },
  { name: "rose", hex: "#ef4444" },
  { name: "white", hex: "#ffffff" },
];

export function InteractiveShotSandbox({ locale }: InteractiveShotSandboxProps) {
  const t = landingCopy[locale].sandbox;

  // Aktif sekme: AtrisHub stili mod seçici
  const [activeTab, setActiveTab] = useState<SandboxTab>("snap");

  // Mod 1 (Snap) Durumları
  const [selectedWindow, setSelectedWindow] = useState<number>(0);

  // Mod 2 (Vektörel Notlar) Durumları
  const [activeColor, setActiveColor] = useState<string>("#f59e0b");
  const [activeAnnotationTool, setActiveAnnotationTool] = useState<"arrow" | "rect">("arrow");

  // Mod 3 (Sansür) Durumları
  const [blurValue, setBlurValue] = useState<number>(80);
  const [isBlurred, setIsBlurred] = useState<boolean>(true);

  // Ortak Bildirim & Flaş Durumları
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [flash, setFlash] = useState<boolean>(false);

  const triggerFlash = (message: string) => {
    setFlash(true);
    setTimeout(() => setFlash(false), 380);
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const copyToClipboard = (type: "image" | "path") => {
    const payload =
      type === "image"
        ? "data:image/png;base64,AtrisShotStudioCapture"
        : "file:///C:/AtrisShot/Screenshots/shot-2026-09-19.png";

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(payload).catch(() => {});
      }
    } catch (_) {}

    triggerFlash(type === "image" ? t.toastImage : t.toastPath);
  };

  const mockWindows = [
    {
      title: "VS Code — auth_session.rs",
      desc: "Rust Tauri Native",
      bounds: "x: 64, y: 120, w: 1440, h: 960",
      icon: Terminal,
    },
    {
      title: "Browser — AtrisHub Cloud",
      desc: "Chromium Viewport",
      bounds: "x: 420, y: 180, w: 1280, h: 840",
      icon: AppWindow,
    },
    {
      title: "Slack — #engineering",
      desc: "Team Workspace",
      bounds: "x: 880, y: 220, w: 1024, h: 720",
      icon: Laptop,
    },
  ];

  return (
    <div className="w-full flex flex-col gap-3 select-none">
      {/* 1. ÜST MOD SEÇİCİ PİLL'LER (AtrisHub Stili) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-2xl border border-border/80 bg-card/90 shadow-sm backdrop-blur-md">
        <button
          type="button"
          onClick={() => setActiveTab("snap")}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "snap"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Crop className="h-3.5 w-3.5" />
          <span>{t.tabSnap}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("annotate")}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "annotate"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
          <span>{t.tabAnnotate}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("blur")}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "blur"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <EyeOff className="h-3.5 w-3.5" />
          <span>{t.tabBlur}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("output")}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "output"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Copy className="h-3.5 w-3.5" />
          <span>{t.tabOutput}</span>
        </button>
      </div>

      {/* 2. ANA STÜDYO PENCERESİ (Spacious Desktop Card) */}
      <div className="relative w-full overflow-hidden rounded-2xl border border-border/90 bg-[#0b100d] shadow-2xl shadow-black/25 flex flex-col">
        {/* Deklanşör Flaş Efekti */}
        {flash && (
          <div className="pointer-events-none absolute inset-0 z-50 bg-white/70 animate-shutter" />
        )}

        {/* Canlı Toast Mesajı */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-primary/50 bg-card/95 px-4 py-2 text-xs font-bold text-foreground shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
            <Check className="h-4 w-4 text-primary" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 2.1 Pencere Başlık Çubuğu */}
        <div className="flex h-11 shrink-0 items-center justify-between border-b border-border/80 bg-muted/30 px-4">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#ef4444] opacity-90" />
            <span className="h-3 w-3 rounded-full bg-[#f59e0b] opacity-90" />
            <span className="h-3 w-3 rounded-full bg-[#22c55e] opacity-90" />
            <span className="ml-2 font-mono text-[11px] font-bold text-muted-foreground">
              {t.windowTitle}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="hidden sm:inline-block font-mono text-[10px] text-muted-foreground border border-border/80 px-2 py-0.5 rounded bg-card/60">
              {t.cropStatus} · DPI 125%
            </span>
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary uppercase">
              {t.freeBadge}
            </span>
          </div>
        </div>

        {/* 2.2 Sekmeye Özel Alt Araç Çubuğu (Geniş, Ferah & Okunabilir) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-card/80 px-4 py-2.5">
          {/* Snap Sekmesi Araçları */}
          {activeTab === "snap" && (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MousePointer2 className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">{t.snapHint}</span>
              </div>
              <button
                type="button"
                onClick={() => triggerFlash(t.toastSnap)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 active:scale-95 cursor-pointer"
              >
                <span>{t.snapButton}</span>
              </button>
            </>
          )}

          {/* Vektörel Notlar Sekmesi Araçları */}
          {activeTab === "annotate" && (
            <>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveAnnotationTool("arrow")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    activeAnnotationTool === "arrow"
                      ? "border border-primary/50 bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span>{t.tools.arrow}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveAnnotationTool("rect")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    activeAnnotationTool === "rect"
                      ? "border border-primary/50 bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>{t.tools.rect}</span>
                </button>
              </div>

              {/* Renk Swatch'ları */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground font-medium mr-1">Renk:</span>
                {COLOR_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.name}
                    type="button"
                    onClick={() => setActiveColor(swatch.hex)}
                    className={`h-4 w-4 rounded-full transition-all cursor-pointer ${
                      activeColor === swatch.hex
                        ? "scale-125 ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "opacity-75 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: swatch.hex }}
                    aria-label={`Color ${swatch.name}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Sansür Sekmesi Araçları */}
          {activeTab === "blur" && (
            <>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {t.blurIntensity}:
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={blurValue}
                  onChange={(e) => setBlurValue(Number(e.target.value))}
                  className="w-36 sm:w-48 accent-primary cursor-pointer h-1.5 rounded-lg bg-muted"
                />
                <span className="text-xs font-mono font-bold text-primary">{blurValue}%</span>
              </div>

              <button
                type="button"
                onClick={() => setIsBlurred((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-bold text-foreground hover:bg-muted cursor-pointer"
              >
                {isBlurred ? <EyeOff className="h-3.5 w-3.5 text-primary" /> : <Eye className="h-3.5 w-3.5" />}
                <span>{isBlurred ? "Sansürü Kaldır" : "Sansürü Uygula"}</span>
              </button>
            </>
          )}

          {/* Çıktı & Handoff Sekmesi Araçları */}
          {activeTab === "output" && (
            <>
              <span className="text-xs font-medium text-muted-foreground">{t.outputHint}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard("image")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>{t.tools.copyImage}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard("path")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-bold text-foreground hover:bg-muted cursor-pointer"
                >
                  <FolderOpen className="h-3.5 w-3.5 text-primary" />
                  <span>{t.tools.copyPath}</span>
                </button>
              </div>
            </>
          )}
        </div>

        {/* 2.3 ANA TUVAL İÇERİĞİ (Geniş, Ferah, Sıkışıklıktan Arındırılmış) */}
        <div className="relative min-h-[300px] sm:min-h-[330px] p-5 sm:p-6 flex flex-col justify-between overflow-hidden">
          {/* ======================================================== */}
          {/* SEKME 1: MANYETİK SNAP VİTRİNİ                           */}
          {/* ======================================================== */}
          {activeTab === "snap" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/60">
                <span className="font-mono flex items-center gap-1.5 text-foreground font-semibold">
                  <Monitor className="h-3.5 w-3.5 text-primary" />
                  \\.\DISPLAY1 (2560 × 1440 @ 144Hz)
                </span>
                <span className="font-mono text-primary font-bold text-[11px]">
                  {mockWindows[selectedWindow].bounds}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {mockWindows.map((win, idx) => (
                  <button
                    key={win.title}
                    type="button"
                    onClick={() => {
                      setSelectedWindow(idx);
                      triggerFlash(`${win.title} manyetik olarak kilitlendi!`);
                    }}
                    className={`relative p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedWindow === idx
                        ? "border-primary bg-primary/10 shadow-lg ring-1 ring-primary/40 scale-[1.02]"
                        : "border-border/70 bg-card/60 hover:bg-card hover:border-border"
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
                    <p className="mt-2.5 text-xs font-bold text-foreground truncate">{win.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{win.desc}</p>
                  </button>
                ))}
              </div>

              {/* Seçili Pencere Yakalama Kutusu */}
              <div className="mt-3 p-3.5 rounded-xl border border-primary/40 bg-primary/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  <span className="font-bold text-foreground">{t.snapBadge}</span>
                  <span className="text-muted-foreground text-[11px] hidden sm:inline">
                    ({mockWindows[selectedWindow].title})
                  </span>
                </div>
                <span className="font-mono text-[11px] text-primary font-bold">1920 × 1080</span>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEKME 2: VEKTÖREL NOTLANDIRMA VİTRİNİ                    */}
          {/* ======================================================== */}
          {activeTab === "annotate" && (
            <div className="relative space-y-3 font-mono text-xs text-muted-foreground">
              <div className="flex items-center justify-between pb-2 border-b border-border/60 text-[11px]">
                <span className="flex items-center gap-1.5 font-bold text-foreground">
                  <Code2 className="h-3.5 w-3.5 text-primary" />
                  {t.codeSnippetTitle}
                </span>
                <span className="text-emerald-500 font-bold">LIVE STAGE</span>
              </div>

              <div className="p-4 rounded-xl border border-border/80 bg-card/60 space-y-2 relative">
                <p className="text-foreground">
                  <span className="text-primary font-bold">export const</span> gatewayService = &#123;
                </p>
                <p className="pl-4">
                  endpoint: <span className="text-emerald-500">&quot;https://api.atris.cloud/v1&quot;</span>,
                </p>
                <p className="pl-4">
                  provider: <span className="text-sky-400">&quot;tauri-v2-native&quot;</span>,
                </p>
                <p className="pl-4">
                  encryptionKey: <span className="text-amber-500">&quot;dpapi_managed_store&quot;</span>,
                </p>
                <p className="text-foreground">&#125;;</p>

                {/* Dinamik Vektörel Ok & Etiket */}
                <div
                  className="absolute right-4 top-4 flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-black shadow-xl backdrop-blur-md transition-all"
                  style={{
                    backgroundColor: activeColor === "#ffffff" ? "#ffffff" : `${activeColor}24`,
                    borderColor: activeColor,
                    borderWidth: 1.5,
                    color: activeColor === "#ffffff" ? "#000000" : activeColor,
                  }}
                >
                  <ArrowUpRight className="h-4 w-4 stroke-[2.5]" style={{ color: activeColor === "#ffffff" ? "#000000" : activeColor }} />
                  <span>{t.annotationLabel}</span>
                </div>

                {/* Dinamik Vektörel Kutu Vurgusu */}
                {activeAnnotationTool === "rect" && (
                  <div
                    className="absolute inset-x-3 bottom-2.5 h-7 rounded-md border-2 border-dashed transition-all pointer-events-none"
                    style={{ borderColor: activeColor }}
                  />
                )}
              </div>

              <p className="text-[11px] text-muted-foreground text-center pt-1">
                {t.annotateHint}
              </p>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEKME 3: AKILLI SANSÜR / BLUR VİTRİNİ                    */}
          {/* ======================================================== */}
          {activeTab === "blur" && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border/80 bg-card/60 font-mono text-xs space-y-3">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b border-border/60 pb-2">
                  <span>production_credentials.json</span>
                  <span className="text-amber-500 font-bold">CONFIDENTIAL</span>
                </div>

                <div className="space-y-1.5">
                  <p className="text-muted-foreground">API_MASTER_SECRET:</p>
                  <div className="relative py-2 px-3 rounded-lg bg-muted/40 border border-border overflow-hidden">
                    <span
                      style={{
                        filter: isBlurred ? `blur(${blurValue * 0.08}px)` : "none",
                        userSelect: "none",
                      }}
                      className="font-bold text-foreground tracking-widest block transition-all"
                    >
                      atris_sec_948f102bb04c8f002931aef70019bc34
                    </span>

                    {isBlurred && blurValue > 40 && (
                      <span className="absolute inset-0 flex items-center justify-center font-black text-[11px] text-primary uppercase tracking-widest bg-primary/15 backdrop-blur-[2px]">
                        <Lock className="h-3.5 w-3.5 mr-1.5" />
                        {t.redactedLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-3 text-xs text-emerald-400">
                <ShieldCheck className="h-5 w-5 shrink-0" />
                <span>{t.blurSafeNote}</span>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* SEKME 4: ÇİFT ÇIKTI VE HANDOFF VİTRİNİ                   */}
          {/* ======================================================== */}
          {activeTab === "output" && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Pipeline 1: Bitmap Panosu */}
                <button
                  type="button"
                  onClick={() => copyToClipboard("image")}
                  className="p-3.5 rounded-xl border border-border bg-card/60 text-left hover:border-primary hover:bg-card transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-2">
                      <FileImage className="h-4 w-4 text-primary" />
                      PNG Bitmap
                    </span>
                    <span className="font-mono text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      image/png
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Figma, Slack veya Discord için doğrudan Ctrl+V yapıştır.
                  </p>
                </button>

                {/* Pipeline 2: Dosya Yolu */}
                <button
                  type="button"
                  onClick={() => copyToClipboard("path")}
                  className="p-3.5 rounded-xl border border-border bg-card/60 text-left hover:border-primary hover:bg-card transition cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-primary" />
                      Local URI
                    </span>
                    <span className="font-mono text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                      text/uri-list
                    </span>
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Cursor, Claude veya Terminal promptuna doğrudan sürükle.
                  </p>
                </button>
              </div>

              {/* Sağ Alt Köşe Önizleme / Handoff Çipi */}
              <div className="p-3 rounded-xl border border-primary/40 bg-card flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-bold text-foreground">{t.cornerStackTitle}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    C:\AtrisShot\shot-01.png
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-primary font-bold text-[11px]">
                  <MoveUpRight className="h-3.5 w-3.5" />
                  <span>Slack · GitHub PR · Figma</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2.4 Alt Bilgi / Canlı Durum Çubuğu */}
        <div className="flex items-center justify-between border-t border-border/80 bg-muted/25 px-4 py-2.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Camera className="h-3.5 w-3.5 text-primary" />
            {t.dragHint}
          </span>
          <span className="font-mono text-[10px] font-bold text-primary">
            {t.interactiveBadge}
          </span>
        </div>
      </div>
    </div>
  );
}

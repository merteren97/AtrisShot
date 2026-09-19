"use client";

import React, { useRef, useEffect } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { AbsoluteFill, Audio, Easing, interpolate, useCurrentFrame } from "remotion";
import {
  ArrowUpRight,
  Check,
  Code2,
  Copy,
  Crop,
  EyeOff,
  FolderOpen,
  Laptop,
  Lock,
  Monitor,
  MousePointer2,
  MoveUpRight,
  ShieldCheck,
  Sparkles,
  Square,
  Terminal,
  Type,
} from "lucide-react";
import type { LandingLocale } from "../lib/landing-copy";
import { landingCopy } from "../lib/landing-copy";

const FPS = 30;
const DURATION = 720; // 24 seconds at 30 fps

function ease(frame: number, input: [number, number], output: [number, number]) {
  return interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

// Renk Swatch'ları
const SWATCHES = ["#f59e0b", "#0ea5e9", "#ef4444", "#22c55e", "#ffffff"];

function ProductFilmComposition({ locale }: { locale: LandingLocale }) {
  const frame = useCurrentFrame();
  const copy = landingCopy[locale].film;

  // 4 Sahne: Her biri 180 frame (6 saniye)
  const scene = Math.min(3, Math.floor(frame / 180));
  const localFrame = frame - scene * 180;
  const enter = ease(localFrame, [0, 22], [0, 1]);
  const progress = interpolate(frame, [0, DURATION - 1], [0, 100]);

  const [eyebrow, title, tag] = copy.scenes[scene];

  // Sahneye göre aktif araç
  const activeTool =
    scene === 0 ? "crop" : scene === 1 ? "arrow" : scene === 2 ? "blur" : "select";

  return (
    <AbsoluteFill className="overflow-hidden bg-[#090d0b] text-white select-none font-sans">
      {/* 24 Saniyelik Slow Ambient Film Müziği */}
      <Audio src="/media/atrisshot-product-theme.wav" volume={0.65} />

      {/* Arka Plan Atmosferi: Derin Obsidian Studio & Ambient Radial Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.14),transparent_50%),radial-gradient(circle_at_80%_90%,rgba(16,185,129,0.10),transparent_50%)]" />
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />

      {/* Üst Bilgi Başlığı (Cinematic Top Bar) */}
      <div className="absolute top-5 left-8 right-8 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg shadow-amber-500/20">
            <Crop className="h-5 w-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-[13px] font-black tracking-widest text-amber-400 uppercase">
              ATRISSHOT
            </span>
            <span className="ml-2 font-mono text-[10px] text-slate-400">
              DESKTOP STUDIO v1.0.11
            </span>
          </div>
        </div>

        {/* Aktif Özellik Rozeti (Dynamic Stage Pill) */}
        <div
          style={{ opacity: enter }}
          className="flex items-center gap-2.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 backdrop-blur-md"
        >
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
          <span className="text-[11px] font-black tracking-wider text-amber-200 uppercase">
            {scene + 1} / 4 · {eyebrow}
          </span>
          <span className="text-[11px] text-slate-400">|</span>
          <span className="text-[11px] font-medium text-slate-200">{tag}</span>
        </div>

        <div className="hidden sm:flex items-center gap-2 font-mono text-[11px] text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Rust · Tauri v2 Native</span>
        </div>
      </div>

      {/* Ana Ekran: Birebir AtrisShot Masaüstü Uygulaması UI'ı */}
      <div className="absolute inset-x-8 top-18 bottom-14 flex items-center justify-center">
        <div className="relative h-full w-full max-w-[1140px] overflow-hidden rounded-2xl border border-white/15 bg-[#0e1411] shadow-2xl shadow-black/80 flex flex-col">
          {/* 1. Uygulama Başlık Çubuğu (Window Titlebar) */}
          <div className="flex h-11 shrink-0 items-center justify-between border-b border-white/10 bg-black/40 px-4">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[#ef4444]" />
              <span className="h-3 w-3 rounded-full bg-[#f59e0b]" />
              <span className="h-3 w-3 rounded-full bg-[#22c55e]" />
              <span className="ml-3 font-mono text-[11px] font-semibold text-slate-300">
                AtrisShot Studio — {scene === 0 ? "display_topology_feed.rs" : "shot_2026_release.png"}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                100% · 2560 × 1440 · 144Hz
              </span>
              <span className="rounded-md bg-amber-400/15 border border-amber-400/30 px-2 py-0.5 text-[10px] font-black text-amber-300 uppercase">
                FREE TIER
              </span>
            </div>
          </div>

          {/* 2. Gerçek AtrisShot Araç Çubuğu (Toolbar) */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 bg-[#121a15] px-4">
            <div className="flex items-center gap-1.5">
              {[
                { id: "select", icon: MousePointer2, label: locale === "tr" ? "Seçim" : "Select" },
                { id: "crop", icon: Crop, label: locale === "tr" ? "Manyetik Kırpma" : "Crop" },
                { id: "arrow", icon: ArrowUpRight, label: locale === "tr" ? "Yön Oku" : "Arrow" },
                { id: "rect", icon: Square, label: locale === "tr" ? "Kutu" : "Box" },
                { id: "blur", icon: EyeOff, label: locale === "tr" ? "Sansür" : "Blur" },
              ].map((tool) => (
                <div
                  key={tool.id}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all ${
                    activeTool === tool.id
                      ? "bg-amber-400/20 text-amber-300 border border-amber-400/40 shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <tool.icon className="h-3.5 w-3.5" />
                  <span>{tool.label}</span>
                </div>
              ))}
            </div>

            {/* Renk Swatch'ları */}
            <div className="flex items-center gap-1.5 px-3 border-l border-r border-white/10">
              {SWATCHES.map((swatch, idx) => (
                <span
                  key={swatch}
                  className={`h-3.5 w-3.5 rounded-full transition-transform ${
                    idx === 0 ? "scale-125 ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900" : "opacity-60"
                  }`}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>

            {/* Çıktı Butonları */}
            <div className="flex items-center gap-2">
              <div
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold border ${
                  scene === 3
                    ? "border-amber-400 bg-amber-400 text-slate-950 shadow-md scale-105"
                    : "border-white/15 bg-white/5 text-slate-300"
                }`}
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{locale === "tr" ? "Resmi Kopyala" : "Copy Image"}</span>
              </div>
              <div className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold border border-white/15 bg-white/5 text-slate-300">
                <FolderOpen className="h-3.5 w-3.5" />
                <span>{locale === "tr" ? "Path" : "Path"}</span>
              </div>
            </div>
          </div>

          {/* 3. Çalışma Alanı / Sahne İçeriği */}
          <div className="relative flex-1 overflow-hidden bg-[#070b09] p-6 font-mono">
            {/* Arka Plan IDE ve Sistem Arayüzü */}
            <div className="space-y-3 text-[12px] leading-relaxed text-slate-400">
              <div className="flex items-center justify-between border-b border-white/10 pb-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-2 text-slate-200">
                  <Terminal className="h-3.5 w-3.5 text-amber-400" />
                  src/runtime/auth_provider.rs — Tauri Native Engine
                </span>
                <span className="text-emerald-400 font-bold">PID: 4892 · 14.2 MB RAM</span>
              </div>

              <p className="text-slate-200">
                <span className="text-amber-400 font-bold">pub struct</span> AuthSessionConfig &#123;
              </p>
              <p className="pl-6">
                pub host_endpoint: <span className="text-emerald-400">&quot;https://api.atrishub.com/v2&quot;</span>,
              </p>
              <p className="pl-6">
                pub storage_adapter: <span className="text-sky-400">&quot;dpapi-encrypted-sqlite&quot;</span>,
              </p>

              {/* Hassas Anahtar Satırı (Sansürlenen Alan) */}
              <div className="flex items-center gap-3 pl-6 py-1">
                <span>pub api_secret_key:</span>
                {scene >= 2 ? (
                  <span className="relative rounded bg-amber-400/20 border border-amber-400/40 px-3 py-0.5 font-bold tracking-widest text-amber-300 backdrop-blur-md">
                    ••••••••••••••••••••••••••••••••
                    <span className="ml-2 rounded bg-amber-400/30 px-1.5 py-0.5 text-[9px] text-amber-200 uppercase">
                      REDACTED
                    </span>
                  </span>
                ) : (
                  <span className="rounded bg-rose-500/20 border border-rose-500/40 px-2.5 py-0.5 text-rose-300 font-bold">
                    &quot;atris_sec_99482910a8bc43f02931aef&quot;
                  </span>
                )}
              </div>

              <p className="pl-6">
                pub telemetry_mode: <span className="text-amber-400 font-semibold">&quot;zero-cloud-leakage&quot;</span>,
              </p>
              <p className="pl-6">
                pub local_offline_cache: <span className="text-emerald-400 font-semibold">true</span>,
              </p>
              <p className="text-slate-200">&#125;</p>
            </div>

            {/* ======================================================== */}
            {/* SAHNE 0 (0s - 6s): Manyetik Pencere Algılama             */}
            {/* ======================================================== */}
            {scene === 0 && (
              <>
                {/* Hareketli İmleç */}
                <div
                  className="absolute pointer-events-none z-20"
                  style={{
                    left: `${ease(localFrame, [10, 80], [75, 42])}%`,
                    top: `${ease(localFrame, [10, 80], [20, 48])}%`,
                  }}
                >
                  <MousePointer2 className="h-6 w-6 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] fill-amber-400 text-slate-950" />
                </div>

                {/* Manyetik Kilitlenme Çerçevesi */}
                <div
                  className="absolute pointer-events-none rounded-xl border-2 border-amber-400 bg-amber-400/[0.04] shadow-[0_0_24px_rgba(245,158,11,0.25)]"
                  style={{
                    left: "14%",
                    top: "16%",
                    width: "74%",
                    height: "72%",
                    opacity: ease(localFrame, [40, 65], [0, 1]),
                  }}
                >
                  {/* Köşe Parantezleri */}
                  <span className="absolute -left-1.5 -top-1.5 h-4 w-4 border-l-2 border-t-2 border-amber-400" />
                  <span className="absolute -right-1.5 -top-1.5 h-4 w-4 border-r-2 border-t-2 border-amber-400" />
                  <span className="absolute -left-1.5 -bottom-1.5 h-4 w-4 border-l-2 border-b-2 border-amber-400" />
                  <span className="absolute -right-1.5 -bottom-1.5 h-4 w-4 border-r-2 border-b-2 border-amber-400" />

                  {/* Rozetler */}
                  <div className="absolute -top-7 left-2 flex items-center gap-2 rounded bg-amber-400 px-2.5 py-0.5 text-[10px] font-black text-slate-950 shadow-md">
                    <span>1920 × 1080 · MANYETİK KİLİTLENME</span>
                  </div>
                  <div className="absolute -bottom-6 right-2 rounded bg-black/80 px-2.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-400/30">
                    Auto-Window Snap: Matched
                  </div>
                </div>

                {/* Deklanşör Flaş Efekti (Frame 130-155) */}
                {localFrame >= 130 && localFrame <= 155 && (
                  <div
                    className="absolute inset-0 z-40 bg-white pointer-events-none"
                    style={{
                      opacity: interpolate(localFrame, [130, 138, 155], [0, 0.75, 0]),
                    }}
                  />
                )}
              </>
            )}

            {/* ======================================================== */}
            {/* SAHNE 1 (6s - 12s): Vektörel Notlar ve Çizim Araçları     */}
            {/* ======================================================== */}
            {scene === 1 && (
              <>
                {/* Vektörel Çizim Kutusu */}
                <div
                  className="absolute pointer-events-none rounded-lg border-2 border-dashed border-amber-400/90 bg-amber-400/[0.04]"
                  style={{
                    left: "18%",
                    top: "22%",
                    width: "65%",
                    height: "56%",
                    opacity: ease(localFrame, [10, 35], [0, 1]),
                  }}
                >
                  <span className="absolute -top-3.5 left-3 rounded bg-amber-400 px-2 py-0.2 text-[10px] font-black text-slate-950 uppercase">
                    {locale === "tr" ? "Önemli Yapılandırma" : "Target Config"}
                  </span>
                </div>

                {/* Animasyonlu Vektörel Ok */}
                <div
                  className="absolute pointer-events-none flex items-center gap-2 rounded-lg border border-amber-400/50 bg-[#0e1612]/95 px-3 py-1.5 shadow-2xl backdrop-blur-md"
                  style={{
                    right: "12%",
                    top: "34%",
                    opacity: ease(localFrame, [35, 60], [0, 1]),
                    transform: `translateY(${ease(localFrame, [35, 60], [15, 0])}px)`,
                  }}
                >
                  <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-[11px] font-bold text-amber-300">
                    {locale === "tr" ? "Canlı API Uç Noktası ↗" : "Live API Endpoint ↗"}
                  </span>
                </div>
              </>
            )}

            {/* ======================================================== */}
            {/* SAHNE 2 (12s - 18s): Kriptografik Pikselasyon & Blur     */}
            {/* ======================================================== */}
            {scene === 2 && (
              <>
                {/* Sansürlenen Alan Vurgusu */}
                <div
                  className="absolute pointer-events-none rounded-lg border-2 border-amber-400 bg-amber-400/10 backdrop-blur-md"
                  style={{
                    left: "22%",
                    top: "40%",
                    width: "56%",
                    height: "14%",
                    opacity: ease(localFrame, [10, 30], [0, 1]),
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center gap-2 text-[11px] font-black uppercase text-amber-300">
                    <Lock className="h-3.5 w-3.5" />
                    <span>{locale === "tr" ? "TERSİNE ÇEVRİLEMEZ SANSÜR · RUST RASTER" : "IRREVERSIBLE REDACTION · RUST ENGINE"}</span>
                  </div>
                </div>

                {/* Güvenlik Onay Kartı */}
                <div
                  className="absolute bottom-6 left-6 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs text-emerald-300 backdrop-blur-md"
                  style={{
                    opacity: ease(localFrame, [45, 70], [0, 1]),
                    transform: `translateY(${ease(localFrame, [45, 70], [10, 0])}px)`,
                  }}
                >
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="font-bold text-white">0 KB Bulut Yüklemesi</p>
                    <p className="text-[10px] text-emerald-400/80 font-sans">
                      {locale === "tr" ? "Yerel diskte Windows DPAPI & Keychain ile şifreli" : "Encrypted on-device via DPAPI & Keychain"}
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ======================================================== */}
            {/* SAHNE 3 (18s - 24s): Çift Çıktı & Sürükle-Bırak Handoff   */}
            {/* ======================================================== */}
            {scene === 3 && (
              <>
                {/* Çift Çıktı Bildirimleri */}
                <div
                  className="absolute top-8 left-8 space-y-2 z-20"
                  style={{
                    opacity: ease(localFrame, [10, 30], [0, 1]),
                    transform: `translateY(${ease(localFrame, [10, 30], [-10, 0])}px)`,
                  }}
                >
                  <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-black/80 px-3.5 py-2 text-xs font-bold text-amber-300 shadow-xl backdrop-blur-md">
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span>image/png panoya kopyalandı</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-black/80 px-3.5 py-2 text-xs font-mono text-slate-300 shadow-xl backdrop-blur-md">
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span>file:///C:/AtrisShot/shot-01.png hazır</span>
                  </div>
                </div>

                {/* Sağ Altta Floating Corner Preview Stack (AtrisShot OverlayPage) */}
                <div
                  className="absolute bottom-4 right-4 w-72 rounded-2xl border border-amber-400/50 bg-[#0d1612]/95 p-4 shadow-2xl backdrop-blur-xl z-20"
                  style={{
                    opacity: ease(localFrame, [20, 45], [0, 1]),
                    transform: `scale(${ease(localFrame, [20, 45], [0.92, 1])})`,
                  }}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="flex items-center gap-2 text-amber-400">
                      <Crop className="h-4 w-4" />
                      AtrisShot Overlay
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">tauri-drag</span>
                  </div>

                  <div className="mt-2.5 rounded-lg border border-white/10 bg-black/50 p-2 text-[10px] font-mono text-slate-300 flex items-center justify-between">
                    <span className="truncate">shot_2026_09_19.png</span>
                    <span className="text-amber-400 font-bold">1.2 MB</span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">
                      {locale === "tr" ? "Sürükle & Bırak:" : "Drag & Handoff:"}
                    </span>
                    <div className="flex items-center gap-1 font-bold text-amber-300">
                      <MoveUpRight className="h-3.5 w-3.5" />
                      <span>Slack · PR · Figma</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Alt Zaman Çizgisi & Ses Bilgisi (Cinematic Bottom Bar) */}
      <div className="absolute bottom-4 left-8 right-8 flex items-center justify-between text-[11px] font-bold text-slate-400">
        <div className="flex items-center gap-3">
          <span className="font-mono text-amber-400">
            {Math.floor(frame / FPS)}s / {DURATION / FPS}s
          </span>
          <span className="text-slate-600">•</span>
          <span>{copy.music}</span>
        </div>

        {/* Canlı İlerleme Çubuğu */}
        <div className="w-80 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-75"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span>{title}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

export default function AtrisShotProductFilm({ locale }: { locale: LandingLocale }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<PlayerRef | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const player = playerRef.current;
    if (!container || !player) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.25) {
          player.play();
        } else {
          player.pause();
        }
      },
      { threshold: [0, 0.25, 0.8] },
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-border/80 bg-card p-1.5 shadow-2xl shadow-black/40"
    >
      <Player
        ref={playerRef}
        component={ProductFilmComposition}
        inputProps={{ locale }}
        durationInFrames={DURATION}
        compositionWidth={1280}
        compositionHeight={720}
        fps={FPS}
        controls
        loop
        autoPlay
        initiallyMuted={false}
        acknowledgeRemotionLicense
        style={{
          width: "100%",
          aspectRatio: "16 / 9",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      />
    </div>
  );
}

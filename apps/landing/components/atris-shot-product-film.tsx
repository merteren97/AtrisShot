"use client";

import React from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { AbsoluteFill, Audio, Easing, interpolate, useCurrentFrame } from "remotion";
import { Check, Clipboard, Copy, Crop, Edit3, FolderOpen, History, Image, MousePointer2, PenLine, Settings, ShieldCheck, SquareDashedMousePointer, Type } from "lucide-react";
import type { LandingLocale } from "../lib/landing-copy";
import { landingCopy } from "../lib/landing-copy";

const FPS = 30;
const DURATION = 720;

function ease(frame: number, input: [number, number], output: [number, number]) {
  return interpolate(frame, input, output, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

function ProductFilmComposition({ locale }: { locale: LandingLocale }) {
  const frame = useCurrentFrame();
  const copy = landingCopy[locale].film;
  const scene = Math.min(3, Math.floor(frame / 180));
  const localFrame = frame - scene * 180;
  const enter = ease(localFrame, [0, 26], [0, 1]);
  const progress = interpolate(frame, [0, DURATION - 1], [0, 100]);
  const [eyebrow, title, tag] = copy.scenes[scene];

  return (
    <AbsoluteFill className="overflow-hidden bg-[#07110d] text-white">
      <Audio src="/media/atrisshot-product-theme.wav" volume={0.32} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_22%,rgba(245,158,11,0.18),transparent_34%),radial-gradient(circle_at_22%_78%,rgba(20,184,166,0.15),transparent_38%)]" />
      <div className="absolute inset-0 opacity-[0.09]" style={{ backgroundImage: "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)", backgroundSize: "52px 52px" }} />

      <div className="relative grid h-full grid-cols-[0.78fr_1.22fr] gap-10 px-14 py-12">
        <section className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-3 rounded-full border border-orange-300/20 bg-orange-300/10 px-5 py-3 text-[19px] font-black text-orange-200">
            <img src="/brand/atris-shot-mark-dark.svg" className="h-8 w-8 rounded-lg" alt="" />
            ATRISSHOT
          </div>
          <div style={{ opacity: enter, transform: `translateY(${interpolate(enter, [0, 1], [26, 0])}px)` }}>
            <p className="mt-12 text-[18px] font-black uppercase tracking-[0.2em] text-orange-300">{eyebrow}</p>
            <h2 className="mt-4 text-[62px] font-black leading-[0.96] tracking-[-0.04em]">{title}</h2>
            <p className="mt-7 text-[24px] leading-[1.45] text-slate-300">{tag}</p>
          </div>
          <div className="mt-auto flex items-center gap-3 text-[15px] font-bold text-slate-500">
            <ShieldCheck className="h-5 w-5 text-orange-300" />
            {copy.footer}
          </div>
        </section>

        <section className="relative flex items-center justify-center">
          <DesktopWindow scene={scene} frame={localFrame} locale={locale} />
          <CaptureOverlay scene={scene} frame={localFrame} locale={locale} />
        </section>
      </div>
      <div className="absolute bottom-7 left-1/2 flex w-[560px] -translate-x-1/2 items-center gap-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">{copy.music}</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-orange-400" style={{ width: `${progress}%` }} />
        </div>
      </div>
    </AbsoluteFill>
  );
}

function DesktopWindow({ scene, frame, locale }: { scene: number; frame: number; locale: LandingLocale }) {
  const t = landingCopy[locale];
  const sidebar = [
    [SquareDashedMousePointer, locale === "tr" ? "Yakalama" : "Capture"],
    [History, locale === "tr" ? "Geçmiş" : "History"],
    [Edit3, locale === "tr" ? "Editör" : "Editor"],
    [Settings, locale === "tr" ? "Ayarlar" : "Settings"],
  ] as const;
  const active = scene === 2 ? 2 : scene === 3 ? 1 : 0;

  return (
    <div className="h-[510px] w-full overflow-hidden rounded-[26px] border border-white/12 bg-[#0d1b15] shadow-2xl shadow-black/60">
      <div className="flex h-12 items-center justify-between border-b border-white/8 px-5">
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ef6f7b]" />
          <span className="h-3 w-3 rounded-full bg-[#e7b95a]" />
          <span className="h-3 w-3 rounded-full bg-[#31d19a]" />
        </div>
        <span className="text-[13px] font-bold text-slate-400">AtrisShot</span>
        <span className="rounded-full bg-orange-400/10 px-3 py-1 text-[11px] font-black text-orange-200">FREE</span>
      </div>
      <div className="grid h-[458px] grid-cols-[158px_1fr]">
        <aside className="border-r border-white/8 bg-[#08120d] p-4">
          <div className="space-y-2">
            {sidebar.map(([Icon, label], index) => (
              <div key={label} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[12px] font-bold ${active === index ? "bg-orange-400/14 text-orange-100" : "text-slate-500"}`}>
                <Icon className="h-4 w-4" />
                {label}
              </div>
            ))}
          </div>
        </aside>
        <div className="p-6">
          {scene <= 1 && <CapturePanel frame={frame} locale={locale} />}
          {scene === 2 && <EditorPanel frame={frame} locale={locale} />}
          {scene === 3 && <HistoryPanel locale={locale} />}
          <div className="mt-5 grid grid-cols-3 gap-3">
            {t.workflow.slice(0, 3).map(([title], index) => (
              <div key={title} className={`rounded-xl border border-white/8 p-3 text-[11px] font-black ${index === scene || (scene === 3 && index === 2) ? "bg-orange-400/10 text-orange-100" : "bg-white/[0.025] text-slate-400"}`}>
                {title}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CapturePanel({ frame, locale }: { frame: number; locale: LandingLocale }) {
  const scan = ease(frame, [18, 110], [8, 84]);
  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[12px] font-black uppercase tracking-[0.14em] text-orange-300">{locale === "tr" ? "Ekran üzerinde seçim" : "On-screen selection"}</p>
          <h3 className="mt-2 text-[27px] font-black">{locale === "tr" ? "Odaklı alan hazır" : "Focused area ready"}</h3>
        </div>
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-400 text-slate-950">
          <Crop className="h-6 w-6" />
        </div>
      </div>
      <div className="relative mt-7 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-[#06100b] p-5">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)", backgroundSize: "34px 34px" }} />
        <div className="relative h-full rounded-xl border-2 border-dashed border-orange-300/80 bg-orange-300/5">
          <div className="absolute left-[15%] top-[22%] h-[48%] w-[58%] rounded-lg border-2 border-sky-300 bg-sky-300/8 shadow-[0_0_0_999px_rgba(0,0,0,0.34)]" />
          <MousePointer2 className="absolute text-white" style={{ left: `${scan}%`, top: `${38 + Math.sin(frame / 8) * 6}%`, width: 24, height: 24 }} />
          <div className="absolute bottom-4 left-4 rounded-full bg-black/55 px-4 py-2 text-[12px] font-bold text-slate-200">
            {locale === "tr" ? "Tıkla veya alan çiz" : "Click or draw region"}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditorPanel({ frame, locale }: { frame: number; locale: LandingLocale }) {
  const arrow = ease(frame, [28, 88], [0, 1]);
  return (
    <div>
      <p className="text-[12px] font-black uppercase tracking-[0.14em] text-orange-300">{locale === "tr" ? "Düzenleme" : "Editing"}</p>
      <h3 className="mt-2 text-[27px] font-black">{locale === "tr" ? "Not ekle, netleştir" : "Annotate and clarify"}</h3>
      <div className="mt-6 grid grid-cols-[150px_1fr] gap-4">
        <div className="space-y-3">
          {[
            [PenLine, locale === "tr" ? "Kalem" : "Pen"],
            [Type, locale === "tr" ? "Metin" : "Text"],
            [Clipboard, "Blur"],
          ].map(([Icon, label], index) => (
            <div key={String(label)} className={`flex items-center gap-3 rounded-xl border border-white/8 px-3 py-3 text-[12px] font-bold ${index === 1 ? "bg-orange-400/12 text-orange-100" : "text-slate-400"}`}>
              <Icon className="h-4 w-4" />
              {String(label)}
            </div>
          ))}
        </div>
        <div className="relative aspect-video rounded-2xl border border-white/10 bg-[#07110d] p-5">
          <div className="h-full rounded-xl border border-white/10 bg-gradient-to-br from-slate-950 to-emerald-950/50" />
          <div className="absolute left-[18%] top-[24%] h-[34%] w-[42%] rounded-lg border-4 border-orange-400" />
          <div className="absolute right-[16%] top-[26%] h-1 rounded-full bg-sky-300" style={{ width: `${70 * arrow}px`, transform: "rotate(-24deg)", transformOrigin: "left center" }} />
          <div className="absolute bottom-[23%] left-[24%] rounded-lg bg-orange-400 px-3 py-2 text-[12px] font-black text-slate-950">
            {locale === "tr" ? "Önemli alan" : "Important area"}
          </div>
        </div>
      </div>
    </div>
  );
}

function HistoryPanel({ locale }: { locale: LandingLocale }) {
  return (
    <div>
      <p className="text-[12px] font-black uppercase tracking-[0.14em] text-orange-300">{locale === "tr" ? "Yerel geçmiş" : "Local history"}</p>
      <h3 className="mt-2 text-[27px] font-black">{locale === "tr" ? "Son görseller elinin altında" : "Recent shots stay within reach"}</h3>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {[0, 1].map((index) => (
          <div key={index} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
            <div className="aspect-video rounded-xl border border-white/10 bg-[#050b08] p-3">
              <div className="h-full rounded-lg border border-orange-300/40 bg-orange-300/5" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[12px] font-black">{index === 0 ? "\\\\.\\DISPLAY1" : locale === "tr" ? "Bölge seçimi" : "Region capture"}</span>
              <Check className="h-4 w-4 text-orange-300" />
            </div>
            <div className="mt-3 flex gap-2 text-slate-400">
              <Copy className="h-4 w-4" />
              <FolderOpen className="h-4 w-4" />
              <Image className="h-4 w-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CaptureOverlay({ scene, frame, locale }: { scene: number; frame: number; locale: LandingLocale }) {
  const show = scene === 1 || scene === 3;
  const scale = show ? 1 + Math.sin(frame / 10) * 0.025 : 0.96;
  const opacity = show ? ease(frame, [0, 24], [0, 1]) : 0.72;

  return (
    <div
      className="absolute -bottom-5 left-1/2 flex w-[340px] -translate-x-1/2 items-center gap-4 rounded-full border border-white/12 bg-[#07110d]/95 px-4 py-3 shadow-2xl backdrop-blur"
      style={{ transform: `translateX(-50%) scale(${scale})`, opacity }}
    >
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-orange-400 text-slate-950">
        {show ? <Copy className="h-5 w-5" /> : <Crop className="h-5 w-5" />}
      </div>
      <div className="flex-1">
        <p className="text-[12px] font-black">{show ? (locale === "tr" ? "Çıktı hazır" : "Output ready") : (locale === "tr" ? "Yakalama bekliyor" : "Capture waiting")}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">{show ? (locale === "tr" ? "Resim veya path" : "Image or path") : "Ctrl + Shift + S"}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((item) => <span key={item} className="h-2 w-2 rounded-full bg-orange-300" />)}
      </div>
    </div>
  );
}

export default function AtrisShotProductFilm({ locale }: { locale: LandingLocale }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const playerRef = React.useRef<PlayerRef | null>(null);

  React.useEffect(() => {
    const container = containerRef.current;
    const player = playerRef.current;
    if (!container || !player) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.35) {
          player.mute();
          player.play();
        } else {
          player.pause();
        }
      },
      { threshold: [0, 0.35, 0.8] },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl shadow-primary/10">
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
        initiallyMuted
        acknowledgeRemotionLicense
        style={{ width: "100%", aspectRatio: "16 / 9", borderRadius: "14px", overflow: "hidden" }}
      />
    </div>
  );
}

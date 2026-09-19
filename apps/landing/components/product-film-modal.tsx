"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { Film, Volume2, X } from "lucide-react";
import type { LandingLocale } from "../lib/landing-copy";
import { landingCopy } from "../lib/landing-copy";

// Remotion oynatıcı JS kodunu ana bundle'dan tamamen ayırarak (code-splitting) sayfa ilk açılış hızını maksimize ediyoruz
const AtrisShotProductFilm = dynamic(() => import("./atris-shot-product-film"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] sm:h-[460px] w-full items-center justify-center bg-black/90 text-xs font-mono text-muted-foreground">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span>Loading cinematic film...</span>
      </div>
    </div>
  ),
});

interface ProductFilmModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: LandingLocale;
}

export function ProductFilmModal({ isOpen, onClose, locale }: ProductFilmModalProps) {
  const t = landingCopy[locale].filmModal;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Modal açıkken arkadaki kaydırmayı kilitle
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="film-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-black/70"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Başlık Çubuğu */}
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
              <Film className="h-4 w-4" />
            </div>
            <div>
              <h3 id="film-modal-title" className="text-sm font-black text-foreground">
                {t.title}
              </h3>
              <p className="text-[11px] text-muted-foreground">{t.description}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dynamic Remotion Player İçeriği */}
        <div className="p-3 sm:p-5 bg-black">
          <AtrisShotProductFilm locale={locale} />
        </div>

        {/* Alt Bilgi Çubuğu */}
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-medium">
            <Volume2 className="h-3.5 w-3.5 text-primary" />
            {t.musicCredit}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border bg-card px-3 py-1 text-xs font-bold text-foreground transition hover:bg-accent"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}

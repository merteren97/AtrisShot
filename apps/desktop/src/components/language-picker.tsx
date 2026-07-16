"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUiPreferences, type Locale } from "@/lib/ui-preferences";

export function LanguagePicker() {
  const { locale, setLocale, t } = useUiPreferences();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const choose = (next: Locale) => {
    setLocale(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-9 rounded-lg bg-card/90"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("language")}
        onClick={() => setOpen((value) => !value)}
      >
        <Globe2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        {locale.toUpperCase()}
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </Button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-36 rounded-lg border bg-card p-1.5 text-card-foreground shadow-xl shadow-black/20">
          <LanguageOption locale="tr" active={locale === "tr"} label={t("turkish")} onChoose={choose} />
          <LanguageOption locale="en" active={locale === "en"} label={t("english")} onChoose={choose} />
        </div>
      )}
    </div>
  );
}

function LanguageOption({ locale, active, label, onChoose }: { locale: Locale; active: boolean; label: string; onChoose: (locale: Locale) => void }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm font-medium transition ${active ? "bg-primary/10 text-primary" : "hover:bg-muted"}`}
      onClick={() => onChoose(locale)}
    >
      {label}
      {active && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
    </button>
  );
}

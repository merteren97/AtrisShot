"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle, MessageSquare } from "lucide-react";
import type { LandingLocale } from "../lib/landing-copy";
import { landingCopy } from "../lib/landing-copy";

interface FaqSectionProps {
  locale: LandingLocale;
}

export function FaqSection({ locale }: FaqSectionProps) {
  const t = landingCopy[locale].faq;
  const [openIndex, setOpenIndex] = useState<number | null>(0); // First item opened by default

  const toggle = (idx: number) => {
    setOpenIndex((current) => (current === idx ? null : idx));
  };

  return (
    <section id="faq" className="scroll-mt-20 py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      {/* Başlık Bölümü */}
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

      {/* Akordeon Listesi */}
      <div className="space-y-4">
        {t.items.map((item, idx) => {
          const isOpen = openIndex === idx;
          const num = String(idx + 1).padStart(2, "0");

          return (
            <div
              key={item.q}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? "border-primary/50 bg-card shadow-lg ring-1 ring-primary/20"
                  : "border-border/80 bg-card/60 hover:border-border hover:bg-card"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                aria-expanded={isOpen}
                className="w-full text-left p-5 sm:p-6 flex items-start justify-between gap-4 cursor-pointer select-none"
              >
                <div className="flex items-start gap-3.5 sm:gap-4">
                  <span
                    className={`font-mono text-xs font-bold px-2 py-0.5 rounded mt-0.5 transition-colors ${
                      isOpen
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {num}
                  </span>
                  <h3
                    className={`text-base sm:text-lg font-bold transition-colors ${
                      isOpen ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {item.q}
                  </h3>
                </div>

                <div
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-transform duration-200 mt-0.5 ${
                    isOpen
                      ? "border-primary text-primary bg-primary/10 rotate-180"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <ChevronDown className="h-4 w-4" />
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-6 sm:px-6 sm:pb-6 pt-0 border-t border-border/40 mt-1">
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed pt-3">
                    {item.a}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Alt Destek / GitHub Çağrısı */}
      <div className="mt-12 rounded-2xl border border-border/80 bg-muted/20 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div className="flex items-center gap-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              {t.contactPrompt}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {locale === "tr"
                ? "Geri bildirimlerinizi dinlemek ve yeni özellikler eklemek için buradayız."
                : "We are here to answer questions, discuss features, and help your team."}
            </p>
          </div>
        </div>

        <a
          href="https://github.com/atris-shot"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-xs font-bold text-foreground hover:border-primary/50 hover:text-primary transition-all shrink-0 shadow-sm"
        >
          <MessageSquare className="h-4 w-4 text-primary" />
          {t.contactLink}
        </a>
      </div>
    </section>
  );
}

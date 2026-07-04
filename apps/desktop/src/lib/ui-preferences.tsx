"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";

export type Locale = "tr" | "en";
export type ThemeMode = "system" | "light" | "dark";

const messages = {
  en: {
    checkingSession: "Verifying Atris session...",
    signInTitle: "Sign in with Atris",
    signInDescription: "Free, Premium, and Admin Atris accounts can use AtrisShot.",
    email: "Email or username",
    password: "Password",
    signIn: "Sign in",
    localPromise: "Fast screenshots, kept on your device.",
    localPromiseDescription:
      "AtrisHub verifies your account. Screenshot files, history, annotations, and paths remain local to this desktop.",
    desktopTagline: "AtrisShot desktop - Local screenshot workflow",
    sessionVault: "Session tokens are stored in the operating-system credential vault.",
    loginFailed: "Login failed.",
    updateAvailable: "AtrisShot update available",
    updateAvailableDescription: "Version {version} is ready to download and install.",
    updateDownloading: "Downloading update...",
    updateInstalling: "Installing update...",
    updateReady: "Update installed",
    updateFailed: "Update could not be completed",
    installUpdate: "Install update",
    restartToUpdate: "Restart AtrisShot",
    dismiss: "Dismiss",
  },
  tr: {
    checkingSession: "Atris oturumu doğrulanıyor...",
    signInTitle: "Atris hesabınla giriş yap",
    signInDescription: "Free, Premium ve Admin Atris hesapları AtrisShot kullanabilir.",
    email: "E-posta veya kullanıcı adı",
    password: "Parola",
    signIn: "Giriş yap",
    localPromise: "Hızlı ekran görüntüleri, cihazında kalır.",
    localPromiseDescription:
      "AtrisHub hesabını doğrular. Ekran görüntüleri, geçmiş, düzenlemeler ve path bilgileri bu masaüstünde yerel kalır.",
    desktopTagline: "AtrisShot masaüstü - Yerel ekran görüntüsü akışı",
    sessionVault: "Oturum belirteçleri işletim sisteminin güvenli kimlik kasasında saklanır.",
    loginFailed: "Giriş başarısız.",
    updateAvailable: "AtrisShot güncellemesi hazır",
    updateAvailableDescription: "{version} sürümü indirilmeye ve kurulmaya hazır.",
    updateDownloading: "Güncelleme indiriliyor...",
    updateInstalling: "Güncelleme kuruluyor...",
    updateReady: "Güncelleme kuruldu",
    updateFailed: "Güncelleme tamamlanamadı",
    installUpdate: "Güncellemeyi kur",
    restartToUpdate: "AtrisShot'u yeniden başlat",
    dismiss: "Kapat",
  },
} as const;

type MessageKey = keyof typeof messages.en;

const UiPreferencesContext = createContext<{
  locale: Locale;
  theme: ThemeMode;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemeMode) => void;
  t: (key: MessageKey) => string;
} | null>(null);

function syncTrayLocale(locale: Locale) {
  if (!isNativeRuntime()) return;
  void nativeRuntime.setTrayLocale(locale).catch(() => undefined);
}

export function UiPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [theme, setThemeState] = useState<ThemeMode>("system");

  useEffect(() => {
    const storedLocale = localStorage.getItem("atrisshot-locale") as Locale | null;
    const storedTheme = localStorage.getItem("atrisshot-theme") as ThemeMode | null;
    const nextLocale = storedLocale === "tr" ? "tr" : "en";
    setLocaleState(nextLocale);
    setThemeState(["system", "light", "dark"].includes(storedTheme || "") ? storedTheme! : "system");
    syncTrayLocale(nextLocale);
  }, []);

  useEffect(() => {
    if (!isNativeRuntime()) return;
    let unlisten: (() => void) | undefined;
    void nativeRuntime.onUiPreferencesChanged((preferences) => {
      if (preferences.locale === "tr" || preferences.locale === "en") {
        localStorage.setItem("atrisshot-locale", preferences.locale);
        setLocaleState(preferences.locale);
      }
      if (["system", "light", "dark"].includes(preferences.theme)) {
        const nextTheme = preferences.theme as ThemeMode;
        localStorage.setItem("atrisshot-theme", nextTheme);
        setThemeState(nextTheme);
      }
    }).then((dispose) => {
      unlisten = dispose;
    });
    return () => unlisten?.();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.lang = locale;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [locale, theme]);

  const value = useMemo(
    () => ({
      locale,
      theme,
      setLocale: (next: Locale) => {
        localStorage.setItem("atrisshot-locale", next);
        setLocaleState(next);
        if (isNativeRuntime()) {
          syncTrayLocale(next);
          void nativeRuntime.emitUiPreferencesChanged({ locale: next, theme });
        }
      },
      setTheme: (next: ThemeMode) => {
        localStorage.setItem("atrisshot-theme", next);
        setThemeState(next);
        if (isNativeRuntime()) void nativeRuntime.emitUiPreferencesChanged({ locale, theme: next });
      },
      t: (key: MessageKey) => messages[locale][key],
    }),
    [locale, theme],
  );

  return <UiPreferencesContext.Provider value={value}>{children}</UiPreferencesContext.Provider>;
}

export function useUiPreferences() {
  const value = useContext(UiPreferencesContext);
  if (!value) throw new Error("UiPreferencesProvider is missing.");
  return value;
}

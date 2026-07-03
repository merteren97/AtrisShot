"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Copy,
  Edit3,
  ExternalLink,
  FolderOpen,
  Image,
  LogOut,
  MoreHorizontal,
  Settings,
  Trash2,
  UserRound,
} from "lucide-react";
import type { ShotHistoryEntry, ShotSettings } from "@atris-shot/shot-core";
import type { ShotSession } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsPanel } from "@/components/settings-panel";
import { DEFAULT_SHOT_SETTINGS } from "@atris-shot/shot-core";
import { loadDesktopSettings } from "@/lib/desktop-settings";
import { clearShotHistory, deleteShotHistoryEntry, loadShotHistory } from "@/lib/shot-history";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";
import { useUiPreferences, type Locale } from "@/lib/ui-preferences";
import { cn } from "@/lib/utils";

const atrisHubUrl = (process.env.NEXT_PUBLIC_ATRIS_HUB_URL || "https://atrishub.com").replace(/\/$/, "");

const workspaceCopy = {
  en: {
    settings: "Settings",
    settingsSubtitle: "Capture, storage, output, appearance",
    recent: "Recent screenshots",
    ready: "Ready",
    editedSaved: "Edited screenshot saved",
    saved: "Screenshot saved",
    fileMissing: "Local file missing",
    packagedOnly: "Open the packaged app to use this action.",
    editorOpened: "Editor opened",
    removed: "Screenshot removed",
    cleared: "History cleared",
    localDataRemoved: "Local data removed",
    history: "History",
    localScreenshots: "local screenshots",
    noScreenshots: "No screenshots yet",
    noScreenshotsDescription: "Use your AtrisShot shortcut to capture your first screenshot.",
    latest: "Selected screenshot",
    edit: "Edit",
    copyPath: "Copy path",
    reveal: "Reveal",
    delete: "Delete",
    dimensions: "Dimensions",
    source: "Source",
    mode: "Mode",
    annotations: "Annotations",
    savedFile: "Saved file",
    dragHint: "Drag the result overlay to place the saved path into text fields, or open the editor for markup.",
    readyTitle: "AtrisShot is ready",
    readyDescription: "Capture with your shortcut, then edit, copy, reveal, and manage recent screenshots from this screen.",
    missingDescription: "This history record exists, but the screenshot file is no longer available on this device.",
    dateUnavailable: "Date unavailable",
    display: "Screen capture",
    region: "Region capture",
    selectedWindow: "Selected window",
    currentScreen: "Current screen",
    noFile: "No file",
    offlineGrace: "Offline grace",
    account: "Account",
    openHub: "Open AtrisHub",
    signOut: "Sign out",
    accountMenu: "Account menu",
    back: "Back to history",
  },
  tr: {
    settings: "Ayarlar",
    settingsSubtitle: "Yakalama, depolama, çıktı ve görünüm",
    recent: "Son ekran görüntüleri",
    ready: "Hazır",
    editedSaved: "Düzenlenen ekran görüntüsü kaydedildi",
    saved: "Ekran görüntüsü kaydedildi",
    fileMissing: "Yerel dosya eksik",
    packagedOnly: "Bu işlem için paketlenmiş masaüstü uygulamasını aç.",
    editorOpened: "Editör açıldı",
    removed: "Ekran görüntüsü kaldırıldı",
    cleared: "Geçmiş temizlendi",
    localDataRemoved: "Yerel veri kaldırıldı",
    history: "Geçmiş",
    localScreenshots: "yerel ekran görüntüsü",
    noScreenshots: "Henüz ekran görüntüsü yok",
    noScreenshotsDescription: "İlk ekran görüntünü almak için AtrisShot kısayolunu kullan.",
    latest: "Seçili ekran görüntüsü",
    edit: "Düzenle",
    copyPath: "Path kopyala",
    reveal: "Klasörde göster",
    delete: "Sil",
    dimensions: "Boyut",
    source: "Kaynak",
    mode: "Tür",
    annotations: "İşaretleme",
    savedFile: "Kaydedilen dosya",
    dragHint: "Kaydedilen path'i metin alanlarına bırakmak için sonuç overlay'ini sürükle veya işaretleme için editörü aç.",
    readyTitle: "AtrisShot hazır",
    readyDescription: "Kısayol ile yakala; sonra bu ekrandan düzenle, kopyala, klasörde göster ve geçmişi yönet.",
    missingDescription: "Bu geçmiş kaydı duruyor, fakat ekran görüntüsü dosyası artık bu cihazda yok.",
    dateUnavailable: "Tarih yok",
    display: "Ekran yakalama",
    region: "Bölge yakalama",
    selectedWindow: "Seçili pencere",
    currentScreen: "Geçerli ekran",
    noFile: "Dosya yok",
    offlineGrace: "Çevrimdışı erişim",
    account: "Hesap",
    openHub: "AtrisHub'ı aç",
    signOut: "Çıkış yap",
    accountMenu: "Hesap menüsü",
    back: "Geçmişe dön",
  },
} as const;

type WorkspaceText = (typeof workspaceCopy)[keyof typeof workspaceCopy];

function useShotDataUrl(path?: string | null) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDataUrl("");
    setFailed(false);
    if (!path || !isNativeRuntime()) return;
    void nativeRuntime
      .readShotDataUrl(path)
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return { dataUrl, failed };
}

function ShotImage({
  path,
  className,
  loading,
}: {
  path?: string | null;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  const { dataUrl, failed } = useShotDataUrl(path);
  if (!path || failed) return <Image className="h-5 w-5 text-muted-foreground" />;
  if (!dataUrl) return <div className="h-full w-full animate-pulse bg-muted" aria-hidden="true" />;
  return <img src={dataUrl} alt="" className={className} loading={loading} draggable={false} />;
}

export function ShotWorkspace({ session, onLogout }: { session: ShotSession; onLogout: () => void }) {
  const { locale } = useUiPreferences();
  const text = workspaceCopy[locale];
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [settings, setSettings] = useState<ShotSettings>(DEFAULT_SHOT_SETTINGS);
  const [historyEntries, setHistoryEntries] = useState<ShotHistoryEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<ShotHistoryEntry | null>(null);
  const [missingEntryIds, setMissingEntryIds] = useState<Set<string>>(() => new Set());
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState<string>(text.ready);
  const [error, setError] = useState("");

  const refreshMissingEntries = useCallback(async (entries: ShotHistoryEntry[]) => {
    if (!isNativeRuntime()) {
      setMissingEntryIds(new Set());
      return;
    }
    const checks = await Promise.all(
      entries.map(async (entry) => {
        const path = entry.editedPath || entry.originalPath;
        const exists = path ? await nativeRuntime.pathExists(path) : false;
        return [entry.id, !exists] as const;
      }),
    );
    setMissingEntryIds(new Set(checks.filter(([, missing]) => missing).map(([id]) => id)));
  }, []);

  const refreshHistory = useCallback(async () => {
    const entries = await loadShotHistory();
    setHistoryEntries(entries);
    void refreshMissingEntries(entries);
    setSelectedEntry((current) => {
      if (current && entries.some((entry) => entry.id === current.id)) return current;
      return entries[0] ?? null;
    });
  }, [refreshMissingEntries]);

  useEffect(() => {
    void loadDesktopSettings().then(setSettings).catch(() => undefined);
    void refreshHistory();
    if (!isNativeRuntime()) return;
    let unlistenShot: (() => void) | undefined;
    void nativeRuntime.onShotCaptured((entry) => {
      setHistoryEntries((current) => {
        const next = [entry, ...current.filter((item) => item.id !== entry.id)];
        void refreshMissingEntries(next);
        return next;
      });
      setSelectedEntry(entry);
      setSettingsOpen(false);
      setStatus(entry.editedPath ? text.editedSaved : text.saved);
    }).then((dispose) => {
      unlistenShot = dispose;
    });
    return () => {
      unlistenShot?.();
    };
  }, [refreshHistory, refreshMissingEntries]);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const close = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) setAccountMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [accountMenuOpen]);

  const openOverlay = async () => {
    setError("");
    if (!isNativeRuntime()) {
      setStatus(text.packagedOnly);
      return;
    }
    await nativeRuntime.showCaptureOverlay();
    setStatus(text.ready);
  };

  const openEditor = async (entry: ShotHistoryEntry) => {
    setSelectedEntry(entry);
    if (missingEntryIds.has(entry.id)) {
      setStatus(text.fileMissing);
      return;
    }
    if (!isNativeRuntime()) {
      setStatus(text.packagedOnly);
      return;
    }
    await nativeRuntime.openEditorWindow(entry.id);
    setStatus(text.editorOpened);
  };

  const deleteHistoryEntry = async (entry: ShotHistoryEntry) => {
    const next = await deleteShotHistoryEntry(entry.id);
    setHistoryEntries(next);
    void refreshMissingEntries(next);
    if (selectedEntry?.id === entry.id) setSelectedEntry(next[0] ?? null);
    setStatus(text.removed);
  };

  const clearHistoryEntries = async () => {
    const next = await clearShotHistory();
    setHistoryEntries(next);
    setMissingEntryIds(new Set());
    setSelectedEntry(null);
    setStatus(text.cleared);
  };

  const handleLocalDataRemoved = useCallback(() => {
    setHistoryEntries([]);
    setMissingEntryIds(new Set());
    setSelectedEntry(null);
    setSettings(DEFAULT_SHOT_SETTINGS);
    setStatus(text.localDataRemoved);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("atrisshot-onboarding-complete");
    }
    onLogout();
  }, [onLogout]);

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
        <div className="flex min-w-0 items-center gap-3">
          {settingsOpen ? (
            <Button type="button" size="icon" variant="ghost" aria-label={text.back} onClick={() => setSettingsOpen(false)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold">{settingsOpen ? text.settings : text.recent}</h1>
            <p className="truncate text-xs text-muted-foreground">{settingsOpen ? text.settingsSubtitle : status}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-full border bg-background/75 p-1 shadow-sm">
          <Button type="button" size="icon" className="h-8 w-8 rounded-full" variant={settingsOpen ? "default" : "ghost"} aria-label="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <AccountMenu
            session={session}
            text={text}
            open={accountMenuOpen}
            menuRef={accountMenuRef}
            onToggle={() => setAccountMenuOpen((open) => !open)}
            onLogout={onLogout}
          />
        </div>
      </header>

      {settingsOpen ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SettingsPanel onSettingsChanged={setSettings} onLocalDataRemoved={handleLocalDataRemoved} />
        </div>
      ) : (
        <HistoryWorkspace
          entries={historyEntries}
          selected={selectedEntry}
          missingEntryIds={missingEntryIds}
          error={error}
          locale={locale}
          text={text}
          onSelect={setSelectedEntry}
          onEdit={(entry) => void openEditor(entry)}
          onCopyPath={(entry) => void copyPath(entry.editedPath || entry.originalPath)}
          onReveal={(entry) => void reveal(entry.editedPath || entry.originalPath)}
          onDelete={(entry) => void deleteHistoryEntry(entry)}
          onClear={() => void clearHistoryEntries()}
        />
      )}
    </main>
  );
}

function HistoryWorkspace({
  entries,
  selected,
  missingEntryIds,
  error,
  locale,
  text,
  onSelect,
  onEdit,
  onCopyPath,
  onReveal,
  onDelete,
  onClear,
}: {
  entries: ShotHistoryEntry[];
  selected: ShotHistoryEntry | null;
  missingEntryIds: Set<string>;
  error: string;
  locale: Locale;
  text: WorkspaceText;
  onSelect: (entry: ShotHistoryEntry) => void;
  onEdit: (entry: ShotHistoryEntry) => void;
  onCopyPath: (entry: ShotHistoryEntry) => void;
  onReveal: (entry: ShotHistoryEntry) => void;
  onDelete: (entry: ShotHistoryEntry) => void;
  onClear: () => void;
}) {
  const selectedMissing = Boolean(selected && missingEntryIds.has(selected.id));
  return (
    <section className="grid min-h-0 flex-1 grid-cols-[244px_1fr] overflow-hidden max-md:grid-cols-1">
      <aside className="min-h-0 border-r bg-card/60">
        <div className="flex h-12 items-center justify-between border-b px-3">
          <div>
            <h2 className="text-sm font-semibold">{text.history}</h2>
            <p className="text-xs text-muted-foreground">{entries.length} {text.localScreenshots}</p>
          </div>
          <Button type="button" size="icon" variant="ghost" aria-label="Clear history" disabled={!entries.length} onClick={onClear}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 h-[calc(100vh-6.5rem)] overflow-y-auto p-2.5 max-md:h-44">
          {entries.length ? (
            <div className="space-y-2">
              {entries.map((entry) => {
                const isMissing = missingEntryIds.has(entry.id);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onSelect(entry)}
                    className={cn(
                      "grid w-full grid-cols-[72px_1fr] gap-3 rounded-lg border bg-background/70 p-2 text-left transition hover:border-primary/40 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected?.id === entry.id && "border-primary bg-accent",
                    )}
                  >
                    <span className="grid aspect-video place-items-center overflow-hidden rounded-md border bg-muted/50">
                      {entry.thumbnailPath && !isMissing ? (
                        <ShotImage path={entry.thumbnailPath} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <Image className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{cleanDisplayName(entry.displayName)}</span>
                      <span className="mt-1 block truncate text-[11px] text-muted-foreground">{formatShotDate(entry.createdAt, entry.id, locale)}</span>
                      <span className="mt-2 flex items-center gap-1">
                        <Badge className="rounded-full px-2 text-[10px]">{modeLabel(entry.mode, text)}</Badge>
                        {isMissing && <Badge className="border-destructive/30 bg-destructive/10 text-destructive">Missing</Badge>}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <Image className="h-9 w-9 text-muted-foreground" />
              <h3 className="mt-4 text-sm font-semibold">{text.noScreenshots}</h3>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{text.noScreenshotsDescription}</p>
            </div>
          )}
        </div>
      </aside>

      <section className="min-h-0 overflow-y-auto p-4">
        {error && <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        {selected ? (
          <div className="mx-auto flex h-full max-w-6xl flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">{text.latest}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{formatShotDate(selected.createdAt, selected.id, locale)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => onEdit(selected)} disabled={selectedMissing}>
                  <Edit3 className="h-4 w-4" /> {text.edit}
                </Button>
                <Button type="button" variant="outline" onClick={() => onCopyPath(selected)}>
                  <Copy className="h-4 w-4" /> {text.copyPath}
                </Button>
                <Button type="button" variant="outline" onClick={() => onReveal(selected)} disabled={selectedMissing}>
                  <FolderOpen className="h-4 w-4" /> {text.reveal}
                </Button>
                <Button type="button" variant="outline" className="border-destructive/30 text-destructive hover:bg-destructive/10" onClick={() => onDelete(selected)}>
                  <Trash2 className="h-4 w-4" /> {text.delete}
                </Button>
              </div>
            </div>

            <Card className="min-h-0 flex-1">
              <CardContent className="grid min-h-[500px] gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <div className="relative flex min-h-[360px] items-center justify-center overflow-hidden rounded-lg border bg-muted/30 p-3">
                  {selectedMissing ? (
                    <div className="text-center">
                      <Image className="mx-auto h-10 w-10 text-muted-foreground" />
                      <h3 className="mt-4 text-sm font-semibold">{text.fileMissing}</h3>
                      <p className="mt-2 max-w-md text-sm text-muted-foreground">{text.missingDescription}</p>
                    </div>
                  ) : (
                    <ShotImage path={selected.editedPath || selected.originalPath} className="max-h-full max-w-full rounded-md border object-contain shadow-xl" loading="eager" />
                  )}
                </div>
                <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <InfoBlock label={text.dimensions} value={`${selected.width} x ${selected.height}`} />
                  <InfoBlock label={text.source} value={cleanDisplayName(selected.displayName, text)} />
                  <InfoBlock label={text.mode} value={modeLabel(selected.mode, text)} />
                  <InfoBlock label={text.annotations} value={`${selected.annotationsCount}`} />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">{text.savedFile}</p>
                    <div className="mt-2 rounded-lg border bg-background p-3">
                      <p className="truncate text-sm font-medium">{pathParts(selected.editedPath || selected.originalPath, text).file}</p>
                      <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">{pathParts(selected.editedPath || selected.originalPath, text).folder}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border bg-muted/25 p-3 text-xs leading-5 text-muted-foreground">
                    {text.dragHint}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md text-center">
              <Image className="mx-auto h-12 w-12 text-muted-foreground" />
              <h2 className="mt-4 text-lg font-semibold">{text.readyTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{text.readyDescription}</p>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function AccountMenu({
  session,
  text,
  open,
  menuRef,
  onToggle,
  onLogout,
}: {
  session: ShotSession;
  text: WorkspaceText;
  open: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onToggle: () => void;
  onLogout: () => void;
}) {
  return (
    <div ref={menuRef} className="relative">
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border bg-popover p-2 text-popover-foreground shadow-xl">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <AccountAvatar session={session} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{session.user?.name || session.user?.username}</p>
              <p className="truncate text-xs text-muted-foreground">{session.user?.email}</p>
            </div>
          </div>
          <div className="my-1 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs">
            <span>{session.offline ? text.offlineGrace : text.account}</span>
            <Badge>{session.membership.plan}</Badge>
          </div>
          <a href={atrisHubUrl} target="_blank" rel="noreferrer" className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent">
            <span>{text.openHub}</span>
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
          <button type="button" className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10" onClick={onLogout}>
            <span>{text.signOut}</span>
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      )}
      <Button type="button" size="icon" className="h-8 w-8 rounded-full" variant="ghost" aria-label={text.accountMenu} aria-expanded={open} onClick={onToggle}>
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}

function AccountAvatar({ session, size = "sm" }: { session: ShotSession; size?: "sm" | "lg" }) {
  const avatarUrl = resolveAvatarUrl(session.user?.avatarUrl);
  const initials = (session.user?.name || session.user?.username || "AS")
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const dimensions = size === "lg" ? "h-10 w-10" : "h-9 w-9";
  if (avatarUrl) {
    return <img src={avatarUrl} alt="" className={`${dimensions} shrink-0 rounded-full border object-cover shadow-sm`} />;
  }
  return (
    <span className={`${dimensions} grid shrink-0 place-items-center rounded-full border bg-primary/10 text-xs font-bold text-primary shadow-sm`}>
      {initials || <UserRound className="h-4 w-4" />}
    </span>
  );
}

function resolveAvatarUrl(avatarUrl?: string | null) {
  if (!avatarUrl) return "";
  if (/^https?:\/\//i.test(avatarUrl)) return avatarUrl;
  return `${atrisHubUrl}${avatarUrl.startsWith("/") ? avatarUrl : `/${avatarUrl}`}`;
}

function formatShotDate(value: string, fallbackId: string | undefined, locale: Locale) {
  const candidates = [value, fallbackId?.split("-")[0]].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const numeric = Number(candidate);
    const date =
      Number.isFinite(numeric) && numeric > 100000000000
        ? new Date(numeric)
        : Number.isFinite(numeric) && numeric > 1000000000
          ? new Date(numeric * 1000)
          : new Date(candidate);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      });
    }
  }
  return workspaceCopy[locale].dateUnavailable;
}

function cleanDisplayName(value: string, text: WorkspaceText = workspaceCopy.en) {
  const normalized = stripWindowsVerbatimPath(value).replace(/^DISPLAY(\d+)$/i, "Display $1");
  if (normalized === "clicked-window" || normalized === "focused-window") return text.selectedWindow;
  return normalized || text.currentScreen;
}

function modeLabel(mode: ShotHistoryEntry["mode"], text: WorkspaceText) {
  return mode === "region" ? text.region : text.display;
}

function pathParts(path: string, text: WorkspaceText = workspaceCopy.en) {
  const cleanPath = stripWindowsVerbatimPath(path);
  const index = Math.max(cleanPath.lastIndexOf("\\"), cleanPath.lastIndexOf("/"));
  if (index < 0) return { file: cleanPath || text.noFile, folder: "" };
  return {
    file: cleanPath.slice(index + 1) || text.noFile,
    folder: cleanPath.slice(0, index) || "",
  };
}

function stripWindowsVerbatimPath(value: string) {
  return value.replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/i, "");
}

async function copyPath(path: string) {
  if (!path) return;
  await nativeRuntime.copyShotPath(path);
}

async function reveal(path: string) {
  if (!path || !isNativeRuntime()) return;
  await nativeRuntime.revealShot(path);
}

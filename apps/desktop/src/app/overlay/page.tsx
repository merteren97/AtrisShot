"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, Copy, Edit3, Image, PanelLeftClose, X } from "lucide-react";
import type { ShotHistoryEntry, ShotSettings } from "@atris-shot/shot-core";
import { DEFAULT_SHOT_SETTINGS } from "@atris-shot/shot-core";
import { Button } from "@/components/ui/button";
import { loadDesktopSettings } from "@/lib/desktop-settings";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";
import { getShotImageDataUrl } from "@/lib/shot-image-cache";
import { useUiPreferences } from "@/lib/ui-preferences";

const MAX_OVERLAY_ENTRIES = 5;
const AUTO_HIDE_DELAY_MS = 4_000;
const POINTER_LEAVE_DELAY_MS = 500;
const DISMISSED_OVERLAY_STORAGE_KEY = "atris-shot.dismissed-overlay-entries";

type PresentationState = "expanded" | "collapsed" | "hidden";

const overlayCopy = {
  en: {
    open: "Open quick preview",
    collapse: "Collapse quick preview",
    copyImage: "Copy image",
    edit: "Edit screenshot",
    dismiss: "Remove from quick preview",
    preview: "Screenshot preview",
  },
  tr: {
    open: "Hızlı önizlemeyi aç",
    collapse: "Hızlı önizlemeyi daralt",
    copyImage: "Görüntüyü kopyala",
    edit: "Ekran görüntüsünü düzenle",
    dismiss: "Hızlı önizlemeden kaldır",
    preview: "Ekran görüntüsü önizlemesi",
  },
} as const;

function readDismissedOverlayIds() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(DISMISSED_OVERLAY_STORAGE_KEY) || "[]");
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((id): id is string => typeof id === "string").slice(-50)
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

function persistDismissedOverlayIds(ids: Set<string>) {
  try {
    window.sessionStorage.setItem(
      DISMISSED_OVERLAY_STORAGE_KEY,
      JSON.stringify(Array.from(ids).slice(-50)),
    );
  } catch {
    // Session storage is a convenience; the in-memory set remains authoritative.
  }
}

function upsertOverlayEntry(
  entries: ShotHistoryEntry[],
  nextEntry: ShotHistoryEntry,
  dismissedIds: Set<string>,
) {
  if (dismissedIds.has(nextEntry.id)) return entries;
  return [nextEntry, ...entries.filter((entry) => entry.id !== nextEntry.id)].slice(0, MAX_OVERLAY_ENTRIES);
}

async function findAvailableOverlayEntries(history: ShotHistoryEntry[]) {
  const candidates = history.slice(0, 25);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  const available = new Array<boolean>(candidates.length).fill(false);
  let nextIndex = 0;
  const checkBatch = async () => {
    while (nextIndex < candidates.length) {
      const index = nextIndex++;
      const entry = candidates[index];
      if (!entry) return;
      available[index] = await nativeRuntime
        .pathExists(entry.editedPath || entry.originalPath)
        .catch(() => false);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(4, Math.max(1, candidates.length)) }, () => checkBatch()),
  );
  return candidates.filter((_, index) => available[index]);
}

export default function OverlayPage() {
  const { locale } = useUiPreferences();
  const text = overlayCopy[locale];
  const [entries, setEntries] = useState<ShotHistoryEntry[]>([]);
  const [settings, setSettings] = useState<ShotSettings>(DEFAULT_SHOT_SETTINGS);
  const [presentation, setPresentation] = useState<PresentationState>("collapsed");
  const [manualPinned, setManualPinned] = useState(false);
  const dismissedEntryIdsRef = useRef<Set<string>>(readDismissedOverlayIds());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const collapsedState = useCallback(
    (): PresentationState => settings.overlayVisibilityMode === "shortcut-only" ? "hidden" : "collapsed",
    [settings.overlayVisibilityMode],
  );

  const scheduleAutoHide = useCallback(() => {
    clearTimer();
    if (settings.overlayVisibilityMode === "always-visible" || manualPinned) return;
    timerRef.current = setTimeout(() => {
      setPresentation(collapsedState());
      timerRef.current = null;
    }, AUTO_HIDE_DELAY_MS);
  }, [clearTimer, collapsedState, manualPinned, settings.overlayVisibilityMode]);

  const revealForCapture = useCallback(() => {
    clearTimer();
    setManualPinned(false);
    setPresentation("expanded");
  }, [clearTimer]);

  const hydrateRecent = useCallback(async () => {
    const history = await nativeRuntime.listShotHistory();
    const dismissedIds = dismissedEntryIdsRef.current;
    const historyIds = new Set(history.map((entry) => entry.id));
    const activeDismissedIds = new Set(Array.from(dismissedIds).filter((id) => historyIds.has(id)));
    if (activeDismissedIds.size !== dismissedIds.size) {
      dismissedIds.clear();
      activeDismissedIds.forEach((id) => dismissedIds.add(id));
      persistDismissedOverlayIds(dismissedIds);
    }
    const availableEntries = await findAvailableOverlayEntries(history);
    setEntries(
      availableEntries
        .filter((entry) => !dismissedIds.has(entry.id))
        .slice(0, MAX_OVERLAY_ENTRIES),
    );
  }, []);

  const dismissEntry = useCallback((id: string) => {
    const dismissedIds = dismissedEntryIdsRef.current;
    dismissedIds.add(id);
    persistDismissedOverlayIds(dismissedIds);
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const reloadSettings = useCallback(() => {
    void loadDesktopSettings().then(setSettings).catch(() => undefined);
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("overlay-window");
    document.body.classList.add("overlay-window");
    reloadSettings();
    void hydrateRecent().catch(() => undefined);

    const disposers: Array<() => void> = [];
    void nativeRuntime.onShotCaptured((next) => {
      if (dismissedEntryIdsRef.current.has(next.id)) return;
      setEntries((current) => upsertOverlayEntry(current, next, dismissedEntryIdsRef.current));
      revealForCapture();
    }).then((dispose) => disposers.push(dispose));
    void nativeRuntime.onResultOverlayOpened(() => {
      void hydrateRecent().catch(() => undefined);
      revealForCapture();
    }).then((dispose) => disposers.push(dispose));
    void nativeRuntime.onResultOverlayToggleRequested(() => {
      clearTimer();
      setPresentation((current) => {
        if (current === "expanded") {
          setManualPinned(false);
          return collapsedState();
        }
        setManualPinned(true);
        return "expanded";
      });
    }).then((dispose) => disposers.push(dispose));
    void nativeRuntime.onDesktopSettingsChanged(reloadSettings).then((dispose) => disposers.push(dispose));

    return () => {
      clearTimer();
      document.documentElement.classList.remove("overlay-window");
      document.body.classList.remove("overlay-window");
      disposers.forEach((dispose) => dispose());
    };
  }, [clearTimer, collapsedState, hydrateRecent, reloadSettings, revealForCapture]);

  useEffect(() => {
    void nativeRuntime
      .setOverlayPresentation(entries.length, entries.length ? presentation : "hidden", settings.overlayCorner)
      .catch(() => undefined);
  }, [entries.length, presentation, settings.overlayCorner]);

  useEffect(() => {
    if (presentation === "expanded" && !manualPinned) scheduleAutoHide();
  }, [manualPinned, presentation, scheduleAutoHide, settings.overlayVisibilityMode]);

  useEffect(() => {
    clearTimer();
    setManualPinned(false);
    setPresentation(settings.overlayVisibilityMode === "always-visible" ? "expanded" : collapsedState());
  }, [clearTimer, collapsedState, settings.overlayVisibilityMode]);

  const collapse = () => {
    clearTimer();
    setManualPinned(false);
    setPresentation(collapsedState());
  };

  if (presentation === "collapsed") {
    const collapsedOnRight = settings.overlayCorner.endsWith("right");
    return (
      <main className="grid min-h-screen place-items-center bg-transparent p-1">
        <button
          type="button"
          aria-label={text.open}
          title={text.open}
          className="group relative grid h-full w-full place-items-center bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onMouseEnter={() => {
            clearTimer();
            setPresentation("expanded");
          }}
          onClick={() => {
            clearTimer();
            setManualPinned(true);
            setPresentation("expanded");
          }}
        >
          <span
            className={`relative flex h-full w-full items-center justify-center overflow-hidden border border-primary/30 bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 transition-all duration-200 group-hover:bg-primary ${collapsedOnRight ? "rounded-l-xl" : "rounded-r-xl"}`}
          >
            <span
              className={`absolute inset-y-2 w-0.5 rounded-full bg-primary-foreground/50 transition-all duration-200 group-hover:inset-y-1 group-hover:w-1 ${collapsedOnRight ? "right-1" : "left-1"}`}
              aria-hidden="true"
            />
            <span
              className={`relative grid h-9 w-3.5 place-items-center rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/25 transition-transform duration-200 group-hover:scale-110 group-hover:bg-primary-foreground/25 ${collapsedOnRight ? "group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"}`}
            >
              {collapsedOnRight ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </span>
          </span>
        </button>
      </main>
    );
  }

  return (
    <main
      className="flex min-h-screen w-full items-end bg-transparent p-2"
      onMouseEnter={clearTimer}
      onMouseLeave={() => {
        if (manualPinned || settings.overlayVisibilityMode === "always-visible") return;
        clearTimer();
        timerRef.current = setTimeout(() => setPresentation(collapsedState()), POINTER_LEAVE_DELAY_MS);
      }}
      onMouseDown={(event) => {
        if (!(event.target as HTMLElement).closest("button,[data-shot-drag]")) void nativeRuntime.startDragging();
      }}
    >
      <div className="flex max-h-full w-full flex-col gap-3 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {entries.map((entry) => (
          <OverlayCard
            key={entry.id}
            entry={entry}
            text={text}
            onCollapse={collapse}
            onDismiss={() => dismissEntry(entry.id)}
          />
        ))}
      </div>
    </main>
  );
}

function OverlayCard({ entry, text, onCollapse, onDismiss }: {
  entry: ShotHistoryEntry;
  text: (typeof overlayCopy)["en"] | (typeof overlayCopy)["tr"];
  onCollapse: () => void;
  onDismiss: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [nativeDragFailed, setNativeDragFailed] = useState(false);
  const shotPath = entry.editedPath || entry.originalPath;
  const displayPath = formatPathForDisplay(shotPath);

  useEffect(() => {
    let cancelled = false;
    setPreviewUrl("");
    void getShotImageDataUrl(shotPath, entry.editRevision, "high").then((url) => {
      if (!cancelled) setPreviewUrl(url);
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [shotPath, entry.editRevision]);

  const requestEdit = async () => {
    await nativeRuntime.openEditorWindow(entry.id);
    await nativeRuntime.hideOverlay();
  };

  const startNativeDrag = (event: MouseEvent<HTMLElement>) => {
    if (!isNativeRuntime() || nativeDragFailed || event.button !== 0 || !previewUrl) return;
    if ((event.target as HTMLElement).closest("button")) return;
    void nativeRuntime.startShotDrag(displayPath, previewUrl)
      .then((result) => {
        if (result === "Dropped") onDismiss();
      })
      .catch(() => setNativeDragFailed(true));
  };

  const startFallbackDrag = (event: DragEvent<HTMLElement>) => {
    if (isNativeRuntime() && !nativeDragFailed) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", displayPath);
  };

  return (
    <article
      data-shot-drag
      draggable={!isNativeRuntime() || nativeDragFailed}
      onMouseDown={startNativeDrag}
      onDragStart={startFallbackDrag}
      onDragEnd={(event) => {
        if (event.dataTransfer.dropEffect !== "none") onDismiss();
      }}
      className="group relative isolate h-40 w-72 shrink-0 cursor-copy overflow-hidden rounded-lg border border-white/15 bg-black/90 shadow-xl shadow-black/30 focus-within:ring-2 focus-within:ring-ring"
      title={displayPath}
    >
      {previewUrl ? (
        <img src={previewUrl} alt={text.preview} className="h-full w-full select-none object-contain" decoding="async" draggable={false} />
      ) : (
        <div className="grid h-full place-items-center rounded-lg bg-muted/75"><Image className="h-7 w-7 text-muted-foreground" /></div>
      )}
      <div className="absolute right-2 top-2 flex gap-1 rounded-full border border-border/60 bg-background/88 p-1 opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={text.copyImage} title={text.copyImage} onClick={() => void nativeRuntime.copyShotImage(entry.id)}><Copy className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={text.edit} title={text.edit} onClick={() => void requestEdit()}><Edit3 className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={text.collapse} title={text.collapse} onClick={onCollapse}><PanelLeftClose className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={text.dismiss} title={text.dismiss} onClick={onDismiss}><X className="h-3.5 w-3.5" /></Button>
      </div>
    </article>
  );
}

function formatPathForDisplay(path: string) {
  if (path.startsWith("\\\\?\\UNC\\")) return `\\\\${path.slice("\\\\?\\UNC\\".length)}`;
  if (path.startsWith("\\\\?\\")) return path.slice("\\\\?\\".length);
  return path;
}

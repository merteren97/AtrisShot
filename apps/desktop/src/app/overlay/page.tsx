"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { Copy, Edit3, Image, PanelLeftClose, PanelLeftOpen, PanelRightOpen, X } from "lucide-react";
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

export default function OverlayPage() {
  const { locale } = useUiPreferences();
  const text = overlayCopy[locale];
  const [entries, setEntries] = useState<ShotHistoryEntry[]>([]);
  const [settings, setSettings] = useState<ShotSettings>(DEFAULT_SHOT_SETTINGS);
  const [presentation, setPresentation] = useState<PresentationState>("hidden");
  const [transitioning, setTransitioning] = useState(false);
  const [manualPinned, setManualPinned] = useState(false);
  const dismissedEntryIdsRef = useRef<Set<string>>(readDismissedOverlayIds());
  const entriesRef = useRef(entries);
  const transitionIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

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

    const disposers: Array<() => void> = [];
    void nativeRuntime.onShotCaptured(({ kind, entry }) => {
      if (dismissedEntryIdsRef.current.has(entry.id)) return;
      setEntries((current) => {
        if (kind === "updated") {
          if (!current.some((item) => item.id === entry.id)) return current;
          return current.map((item) => (item.id === entry.id ? entry : item));
        }
        return upsertOverlayEntry(current, entry, dismissedEntryIdsRef.current);
      });
      revealForCapture();
    }).then((dispose) => disposers.push(dispose));
    void nativeRuntime.onResultOverlayOpened(() => {
      if (entriesRef.current.length > 0) revealForCapture();
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
  }, [clearTimer, collapsedState, reloadSettings, revealForCapture]);

  useEffect(() => {
    const state = entries.length ? presentation : "hidden";
    const transitionId = ++transitionIdRef.current;
    if (state === "hidden") {
      setTransitioning(false);
      void nativeRuntime.setOverlayPresentation(0, "hidden", settings.overlayCorner).catch(() => undefined);
      return;
    }
    setTransitioning(true);
    void nativeRuntime
      .setOverlayPresentation(entries.length, state, settings.overlayCorner)
      .then(() => {
        window.requestAnimationFrame(() => {
          if (transitionId === transitionIdRef.current) setTransitioning(false);
        });
      })
      .catch(() => {
        if (transitionId === transitionIdRef.current) setTransitioning(false);
      });
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

  if (presentation === "hidden") return null;

  if (presentation === "collapsed") {
    const collapsedOnRight = settings.overlayCorner.endsWith("right");
    return (
      <main className={`grid min-h-screen place-items-center bg-transparent p-1 transition-opacity duration-200 ease-out motion-reduce:transition-none ${transitioning ? "pointer-events-none opacity-0" : "opacity-100"}`}>
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
            className={`relative flex h-full w-full items-center justify-center overflow-hidden border border-border/80 bg-card/95 text-foreground shadow-lg shadow-black/20 transition-colors duration-200 group-hover:border-primary/60 group-hover:bg-card ${collapsedOnRight ? "rounded-l-lg" : "rounded-r-lg"}`}
          >
            <span
              className={`absolute inset-y-2 w-0.5 rounded-full bg-primary/75 transition-all duration-200 group-hover:inset-y-1 group-hover:w-1 ${collapsedOnRight ? "right-1" : "left-1"}`}
              aria-hidden="true"
            />
            <span
              className="relative grid h-8 w-7 place-items-center rounded-md bg-muted/80 text-muted-foreground ring-1 ring-border/80 transition-colors duration-200 group-hover:bg-accent group-hover:text-accent-foreground"
            >
              {collapsedOnRight ? <PanelRightOpen className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
            </span>
          </span>
        </button>
      </main>
    );
  }

  return (
    <main
      className={`flex min-h-screen w-full items-end bg-transparent p-2 transition-opacity duration-200 ease-out motion-reduce:transition-none ${transitioning ? "pointer-events-none opacity-0" : "opacity-100"}`}
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

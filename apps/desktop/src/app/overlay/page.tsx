"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { Copy, Edit3, Image, PanelLeftClose, PanelLeftOpen, PanelRightOpen, Trash2, X } from "lucide-react";
import type { ShotHistoryEntry, ShotSettings } from "@atris-shot/shot-core";
import { DEFAULT_SHOT_SETTINGS } from "@atris-shot/shot-core";
import { Button } from "@/components/ui/button";
import { loadDesktopSettings } from "@/lib/desktop-settings";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";
import { getShotImageDataUrl } from "@/lib/shot-image-cache";
import { useUiPreferences } from "@/lib/ui-preferences";

const AUTO_HIDE_DELAY_MS = 4_000;
const POINTER_LEAVE_DELAY_MS = 500;
const SHOT_DRAG_THRESHOLD_PX = 7;
const MAX_OVERLAY_ENTRIES = 5;
const DISMISSED_OVERLAY_STORAGE_KEY = "atris-shot.dismissed-overlay-entries";

type PresentationState = "expanded" | "collapsed" | "hidden";

const overlayCopy = {
  en: {
    open: "Open quick preview",
    collapse: "Collapse quick preview",
    copyImage: "Copy image",
    edit: "Edit screenshot",
    deleteShot: "Delete screenshot permanently",
    dismiss: "Remove from quick preview",
    preview: "Screenshot preview",
  },
  tr: {
    open: "Hızlı önizlemeyi aç",
    collapse: "Hızlı önizlemeyi daralt",
    copyImage: "Görüntüyü kopyala",
    edit: "Ekran görüntüsünü düzenle",
    deleteShot: "Ekran görüntüsünü kalıcı sil",
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

function getAvailableOverlayCapacity(): number {
  if (typeof window === "undefined") return MAX_OVERLAY_ENTRIES;
  const usableHeight = window.screen?.availHeight || window.innerHeight || 900;
  // Card height 175px + gap 12px = 187px; reserve padding and margins
  const calculated = Math.floor((usableHeight - 96 - 16) / 187);
  return Math.min(MAX_OVERLAY_ENTRIES, Math.max(3, calculated));
}

function upsertOverlayEntry(
  entries: ShotHistoryEntry[],
  nextEntry: ShotHistoryEntry,
  dismissedIds: Set<string>,
) {
  if (dismissedIds.has(nextEntry.id)) return entries;
  const maxCapacity = getAvailableOverlayCapacity();
  const withoutCurrent = entries.filter((entry) => entry.id !== nextEntry.id);
  // Add new screenshot to the bottom, pushing older shots upwards
  const updated = [...withoutCurrent, nextEntry];
  return updated.slice(-maxCapacity);
}

export type OverlayPageProps = {
  onPreview?: (entryId: string) => void;
};

export default function OverlayPage({ onPreview }: OverlayPageProps = {}) {
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

  const deleteEntryPermanently = useCallback(async (id: string) => {
    try {
      await nativeRuntime.deleteShot(id);
    } catch {
      // Fallback: dismiss from view
    }
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
    void nativeRuntime.onShotDeleted(({ id }) => {
      setEntries((current) => current.filter((entry) => entry.id !== id));
    }).then((dispose) => disposers.push(dispose));
    void nativeRuntime.onShotHistoryCleared(() => {
      setEntries([]);
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

  const previewEntry = useCallback((entryId: string) => {
    clearTimer();
    setManualPinned(true);
    if (onPreview) {
      onPreview(entryId);
      return;
    }
    void nativeRuntime.openEditorWindow(entryId, "preview").catch(() => {
      setManualPinned(false);
    });
  }, [clearTimer, onPreview]);

  if (presentation === "hidden") return null;

  if (presentation === "collapsed") {
    return (
      <main
        className="fixed inset-0 h-full w-full bg-transparent select-none cursor-default"
        onMouseEnter={() => {
          clearTimer();
          setPresentation("expanded");
        }}
      />
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
      <div className="flex max-h-full w-full flex-col gap-3 justify-end overflow-hidden">
        {entries.map((entry) => (
          <OverlayCard
            key={entry.id}
            entry={entry}
            text={text}
            onCollapse={collapse}
            onDismiss={() => dismissEntry(entry.id)}
            onDelete={() => void deleteEntryPermanently(entry.id)}
            onPreview={previewEntry}
          />
        ))}
      </div>
    </main>
  );
}

function OverlayCard({ entry, text, onCollapse, onDismiss, onDelete, onPreview }: {
  entry: ShotHistoryEntry;
  text: (typeof overlayCopy)["en"] | (typeof overlayCopy)["tr"];
  onCollapse: () => void;
  onDismiss: () => void;
  onDelete: () => void;
  onPreview: (entryId: string) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState("");
  const [nativeDragFailed, setNativeDragFailed] = useState(false);
  const pointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    dragging: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
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

  const startNativeDrag = () => {
    if (!isNativeRuntime() || nativeDragFailed || !previewUrl) return;
    void nativeRuntime.startShotDrag(displayPath, previewUrl)
      .then((result) => {
        if (result === "Dropped") onDismiss();
      })
      .catch(() => setNativeDragFailed(true));
  };

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    suppressClickRef.current = false;
    if (event.button !== 0 || isButtonTarget(event.target)) return;
    pointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
    if (isNativeRuntime() && !nativeDragFailed) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId || pointer.dragging) return;
    const movedX = event.clientX - pointer.startX;
    const movedY = event.clientY - pointer.startY;
    if (Math.hypot(movedX, movedY) < SHOT_DRAG_THRESHOLD_PX) return;
    if (isNativeRuntime() && !nativeDragFailed && !previewUrl) return;
    pointer.dragging = true;
    suppressClickRef.current = true;
    startNativeDrag();
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const pointer = pointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;
    pointerRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onPointerCancel = (event: PointerEvent<HTMLElement>) => {
    onPointerUp(event);
  };

  const onCardClick = (event: MouseEvent<HTMLElement>) => {
    if (isButtonTarget(event.target)) {
      suppressClickRef.current = false;
      return;
    }
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onPreview(entry.id);
  };

  const startFallbackDrag = (event: DragEvent<HTMLElement>) => {
    if (isButtonTarget(event.target)) {
      event.preventDefault();
      return;
    }
    const pointer = pointerRef.current;
    if (
      pointer &&
      Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) < SHOT_DRAG_THRESHOLD_PX
    ) {
      event.preventDefault();
      return;
    }
    if (isNativeRuntime() && !nativeDragFailed) {
      event.preventDefault();
      return;
    }
    suppressClickRef.current = true;
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", displayPath);
  };

  return (
    <article
      data-shot-drag
      draggable={!isNativeRuntime() || nativeDragFailed}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onClick={onCardClick}
      onKeyDown={(event) => {
        if (isButtonTarget(event.target) || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onPreview(entry.id);
      }}
      onDragStart={startFallbackDrag}
      onDragEnd={(event) => {
        if (event.dataTransfer.dropEffect !== "none") onDismiss();
      }}
      role="button"
      tabIndex={0}
      aria-label={text.preview}
      className="group relative isolate h-[175px] w-[250px] shrink-0 cursor-copy overflow-hidden rounded-lg border border-white/15 bg-black/90 shadow-xl shadow-black/30 focus-within:ring-2 focus-within:ring-ring transition-all duration-300 ease-out hover:scale-[1.01] animate-in fade-in slide-in-from-bottom-3"
      title={displayPath}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt={text.preview}
          className="block h-full w-full select-none object-fill object-cover object-center transition-transform duration-300 ease-out group-hover:scale-105"
          decoding="async"
          draggable={false}
        />
      ) : (
        <div className="grid h-full place-items-center rounded-lg bg-muted/75"><Image className="h-7 w-7 text-muted-foreground" /></div>
      )}
      <div className="absolute right-2 top-2 flex gap-1 rounded-full border border-border/60 bg-background/88 p-1 opacity-0 shadow-lg backdrop-blur-md transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={text.copyImage} title={text.copyImage} onClick={() => void nativeRuntime.copyShotImage(entry.id)}><Copy className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label={text.edit} title={text.edit} onClick={() => void requestEdit()}><Edit3 className="h-3.5 w-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" aria-label={text.deleteShot} title={text.deleteShot} onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
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

function isButtonTarget(target: EventTarget | null) {
  return target instanceof Element && target.closest("button") !== null;
}

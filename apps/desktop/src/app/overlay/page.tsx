"use client";

import { useCallback, useEffect, useState, type DragEvent } from "react";
import { Copy, Edit3, Image, X } from "lucide-react";
import type { ShotHistoryEntry } from "@atris-shot/shot-core";
import { Button } from "@/components/ui/button";
import { loadDesktopSettings } from "@/lib/desktop-settings";
import { nativeRuntime } from "@/lib/native-runtime";

const MAX_OVERLAY_ENTRIES = 5;

function upsertOverlayEntry(entries: ShotHistoryEntry[], nextEntry: ShotHistoryEntry) {
  const existingIndex = entries.findIndex((entry) => entry.id === nextEntry.id);
  if (existingIndex >= 0) {
    return entries.map((entry, index) => (index === existingIndex ? nextEntry : entry));
  }
  return [nextEntry, ...entries].slice(0, MAX_OVERLAY_ENTRIES);
}

export default function OverlayPage() {
  const [entries, setEntries] = useState<ShotHistoryEntry[]>([]);

  const refreshLatest = useCallback(() => {
    void nativeRuntime
      .latestShot()
      .then((next) => {
        if (next) setEntries((current) => upsertOverlayEntry(current, next));
      })
      .catch(() => undefined);
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  useEffect(() => {
    document.documentElement.classList.add("overlay-window");
    document.body.classList.add("overlay-window");
    let unlistenShot: (() => void) | undefined;
    let unlistenOpened: (() => void) | undefined;
    void nativeRuntime.onShotCaptured((next) => {
      setEntries((current) => upsertOverlayEntry(current, next));
    }).then((dispose) => {
      unlistenShot = dispose;
    });
    void nativeRuntime.onResultOverlayOpened(refreshLatest).then((dispose) => {
      unlistenOpened = dispose;
    });
    return () => {
      document.documentElement.classList.remove("overlay-window");
      document.body.classList.remove("overlay-window");
      unlistenShot?.();
      unlistenOpened?.();
    };
  }, [refreshLatest]);

  useEffect(() => {
    void loadDesktopSettings()
      .then((settings) => nativeRuntime.setOverlayStackSize(entries.length, settings.overlayCorner))
      .catch(() => {
        if (!entries.length) void nativeRuntime.hideOverlay();
      });
  }, [entries.length]);

  return (
    <main
      data-tauri-drag-region
      className="flex min-h-screen items-end justify-start bg-transparent p-2"
      onMouseDown={(event) => {
        if (!(event.target as HTMLElement).closest("button,[data-path-drag]")) void nativeRuntime.startDragging();
      }}
    >
      <div className="flex w-full flex-col gap-2">
        {entries.map((entry) => (
          <OverlayCard key={entry.id} entry={entry} onDismiss={() => removeEntry(entry.id)} />
        ))}
      </div>
    </main>
  );
}

function OverlayCard({ entry, onDismiss }: { entry: ShotHistoryEntry; onDismiss: () => void }) {
  const [previewUrl, setPreviewUrl] = useState("");
  const shotPath = entry.editedPath || entry.originalPath;
  const displayPath = formatPathForDisplay(shotPath);

  useEffect(() => {
    let cancelled = false;
    setPreviewUrl("");
    void nativeRuntime
      .readShotDataUrl(shotPath)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [shotPath, entry.editRevision]);

  const requestEdit = async () => {
    await nativeRuntime.openEditorWindow(entry.id);
    await nativeRuntime.hideOverlay();
  };

  const startPathDrag = (event: DragEvent<HTMLElement>) => {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", displayPath);
  };

  return (
    <article
      data-path-drag
      draggable
      onDragStart={startPathDrag}
      onDragEnd={onDismiss}
      className="group relative h-28 w-full cursor-copy overflow-hidden rounded-lg border bg-card/94 text-card-foreground shadow-2xl shadow-black/20 backdrop-blur-xl"
      title={displayPath}
    >
      {previewUrl ? (
        <img src={previewUrl} alt="Screenshot preview" className="h-full w-full object-contain" />
      ) : (
        <div className="grid h-full place-items-center bg-muted/60">
          <Image className="h-7 w-7 text-muted-foreground" />
        </div>
      )}
      <div className="absolute right-2 top-2 flex gap-1 rounded-full border bg-background/85 p-1 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Copy path" title="Copy path" onClick={() => void nativeRuntime.copyShotPath(shotPath)}>
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit screenshot" title="Edit screenshot" onClick={() => void requestEdit()}>
          <Edit3 className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Dismiss screenshot" title="Dismiss screenshot" onClick={onDismiss}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </article>
  );
}

function formatPathForDisplay(path: string) {
  if (path.startsWith("\\\\?\\UNC\\")) return `\\\\${path.slice("\\\\?\\UNC\\".length)}`;
  if (path.startsWith("\\\\?\\")) return path.slice("\\\\?\\".length);
  return path;
}

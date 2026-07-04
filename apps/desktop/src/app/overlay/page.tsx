"use client";

import { useEffect, useState, type DragEvent } from "react";
import { Copy, Edit3, Image, X } from "lucide-react";
import type { ShotHistoryEntry } from "@atris-shot/shot-core";
import { Button } from "@/components/ui/button";
import { nativeRuntime } from "@/lib/native-runtime";

export default function OverlayPage() {
  const [entry, setEntry] = useState<ShotHistoryEntry | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const shotPath = entry?.editedPath || entry?.originalPath || "";
  const displayPath = formatPathForDisplay(shotPath);
  const requestEdit = async () => {
    if (!entry) return;
    await nativeRuntime.openEditorWindow(entry.id);
    await nativeRuntime.hideOverlay();
  };

  const startPathDrag = (event: DragEvent<HTMLElement>) => {
    if (!shotPath) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", displayPath);
  };

  useEffect(() => {
    document.documentElement.classList.add("overlay-window");
    document.body.classList.add("overlay-window");
    let unlistenShot: (() => void) | undefined;
    let unlistenOpened: (() => void) | undefined;
    const refreshLatest = () => nativeRuntime.latestShot().then((next) => {
      if (next) setEntry(next);
    }).catch(() => undefined);
    void refreshLatest();
    void nativeRuntime.onShotCaptured((next) => setEntry(next)).then((dispose) => {
      unlistenShot = dispose;
    });
    void nativeRuntime.onResultOverlayOpened(() => {
      void refreshLatest();
    }).then((dispose) => {
      unlistenOpened = dispose;
    });
    return () => {
      document.documentElement.classList.remove("overlay-window");
      document.body.classList.remove("overlay-window");
      unlistenShot?.();
      unlistenOpened?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPreviewUrl("");
    if (!shotPath) return;
    void nativeRuntime
      .readShotDataUrl(shotPath)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [shotPath]);

  return (
    <main
      data-tauri-drag-region
      className="flex min-h-screen items-end justify-start bg-transparent p-2"
      onMouseDown={(event) => {
        if (!(event.target as HTMLElement).closest("button,[data-path-drag]")) void nativeRuntime.startDragging();
      }}
    >
      <div className="group w-full overflow-hidden rounded-lg border bg-card/94 text-card-foreground shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div
          data-path-drag
          draggable={Boolean(entry)}
          onDragStart={startPathDrag}
          className="relative h-28 cursor-copy overflow-hidden border-b bg-muted/60"
          title={shotPath ? "Drag path" : undefined}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <div className="grid h-full place-items-center">
              <Image className="h-7 w-7 text-muted-foreground" />
            </div>
          )}
          <div className="absolute right-2 top-2 flex gap-1 rounded-full border bg-background/80 p-1 opacity-100 shadow-sm backdrop-blur">
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Copy path" disabled={!entry} onClick={() => entry && void nativeRuntime.copyShotPath(entry.editedPath || entry.originalPath)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Edit screenshot" disabled={!entry} onClick={() => void requestEdit()}>
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Hide overlay" onClick={() => void nativeRuntime.hideOverlay()}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2">
          <div
            data-path-drag
            draggable={Boolean(entry)}
            onDragStart={startPathDrag}
            className="grid h-9 w-12 shrink-0 cursor-copy place-items-center overflow-hidden rounded-md border bg-muted/60"
            title={shotPath ? "Drag path" : undefined}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Image className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{entry ? `${entry.width} x ${entry.height}` : "AtrisShot"}</p>
            <p
              data-path-drag
              draggable={Boolean(entry)}
              onDragStart={startPathDrag}
              className="mt-1 cursor-copy truncate text-[11px] text-muted-foreground"
              title={displayPath || undefined}
            >
              {displayPath || "Last screenshot will appear here."}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function formatPathForDisplay(path: string) {
  if (path.startsWith("\\\\?\\UNC\\")) return `\\\\${path.slice("\\\\?\\UNC\\".length)}`;
  if (path.startsWith("\\\\?\\")) return path.slice("\\\\?\\".length);
  return path;
}

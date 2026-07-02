"use client";

import { useEffect, useState, type DragEvent } from "react";
import { Copy, Edit3, Image, X } from "lucide-react";
import type { ShotHistoryEntry } from "@atris-shot/shot-core";
import { Button } from "@/components/ui/button";
import { nativeRuntime } from "@/lib/native-runtime";

export default function OverlayPage() {
  const [entry, setEntry] = useState<ShotHistoryEntry | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const shotPath = entry?.editedPath || entry?.originalPath || "";
  const requestEdit = async () => {
    if (!entry) return;
    await nativeRuntime.emitEditShotRequested(entry);
    await nativeRuntime.openMainWindow();
    await nativeRuntime.hideOverlay();
  };

  const startPathDrag = (event: DragEvent<HTMLElement>) => {
    if (!shotPath) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", shotPath);
  };

  useEffect(() => {
    document.documentElement.classList.add("overlay-window");
    document.body.classList.add("overlay-window");
    let unlistenShot: (() => void) | undefined;
    void nativeRuntime.latestShot().then((next) => {
      if (next) setEntry(next);
    }).catch(() => undefined);
    void nativeRuntime.onShotCaptured((next) => setEntry(next)).then((dispose) => {
      unlistenShot = dispose;
    });
    return () => {
      document.documentElement.classList.remove("overlay-window");
      document.body.classList.remove("overlay-window");
      unlistenShot?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setThumbnailUrl("");
    if (!entry?.thumbnailPath) return;
    void nativeRuntime
      .readShotDataUrl(entry.thumbnailPath)
      .then((url) => {
        if (!cancelled) setThumbnailUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [entry?.thumbnailPath]);

  return (
    <main
      data-tauri-drag-region
      className="flex min-h-screen items-end justify-start bg-transparent p-2"
      onMouseDown={(event) => {
        if (!(event.target as HTMLElement).closest("button,[data-path-drag]")) void nativeRuntime.startDragging();
      }}
    >
      <div className="group w-full rounded-lg border bg-card/92 p-2 text-card-foreground shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="flex items-start gap-2">
          <div
            data-path-drag
            draggable={Boolean(entry)}
            onDragStart={startPathDrag}
            className="grid h-12 w-16 shrink-0 cursor-copy place-items-center overflow-hidden rounded-md border bg-muted/60"
            title={shotPath ? "Drag path" : undefined}
          >
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Image className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{entry ? `${entry.width} x ${entry.height}` : "AtrisShot"}</p>
            <p
              data-path-drag
              draggable={Boolean(entry)}
              onDragStart={startPathDrag}
              className="mt-1 cursor-copy truncate text-[11px] text-muted-foreground"
              title={shotPath || undefined}
            >
              {shotPath || "Last screenshot will appear here."}
            </p>
            <div className="mt-2 flex gap-1 opacity-100">
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
        </div>
      </div>
    </main>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crop, Image, LoaderCircle, X } from "lucide-react";
import type { CaptureRegion, DisplayInfo, ShotSettings } from "@atris-shot/shot-core";
import { Button } from "@/components/ui/button";
import { DEFAULT_SHOT_SETTINGS } from "@atris-shot/shot-core";
import { loadDesktopSettings } from "@/lib/desktop-settings";
import { nativeRuntime } from "@/lib/native-runtime";

type Point = { x: number; y: number };
type DragState = { start: Point; current: Point } | null;

const dragThreshold = 8;

export default function CaptureOverlayPage() {
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [settings, setSettings] = useState<ShotSettings>(DEFAULT_SHOT_SETTINGS);
  const [drag, setDrag] = useState<DragState>(null);
  const [focusTarget, setFocusTarget] = useState<CaptureRegion | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  const pointerStarted = useRef(false);

  useEffect(() => {
    document.documentElement.classList.add("overlay-window");
    document.body.classList.add("overlay-window");
    void nativeRuntime.currentWindowDisplay().then((display) => setDisplays([display])).catch((reason) => setError(String(reason)));
    void nativeRuntime.focusedWindowRegion().then(setFocusTarget).catch(() => undefined);
    void loadDesktopSettings().then(setSettings).catch(() => undefined);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void nativeRuntime.hideCaptureOverlay();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.documentElement.classList.remove("overlay-window");
      document.body.classList.remove("overlay-window");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const bounds = useMemo(() => getVirtualBounds(displays), [displays]);

  const activeDisplay = displays[0];

  const capture = useCallback(
    async (region: CaptureRegion | null, targetDisplay?: DisplayInfo) => {
      const target = targetDisplay || (region ? displays.find((display) => display.id === region.displayId) : activeDisplay);
      if (!target) {
        setError("No display is available.");
        return false;
      }
      setCapturing(true);
      setError("");
      try {
        await nativeRuntime.captureShot({
          mode: region ? "region" : "display",
          displayId: target.id,
          region: region || undefined,
          saveFolder: settings.saveFolder,
          clipboardMode: settings.clipboardMode,
          postCaptureAction: settings.postCaptureAction,
          overlayCorner: settings.overlayCorner,
          includeCursor: settings.includeCursor,
          captureDelayMs: settings.captureDelayMs,
          historyLimit: settings.historyLimit,
        });
        return true;
      } catch (reason) {
        setError(String(reason));
        return false;
      } finally {
        setCapturing(false);
      }
    },
    [activeDisplay, displays, settings],
  );

  const toVirtualPoint = (event: React.PointerEvent<HTMLElement>): Point => ({
    x: Math.round(bounds.x + event.clientX),
    y: Math.round(bounds.y + event.clientY),
  });

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (capturing || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toVirtualPoint(event);
    pointerStarted.current = true;
    setDrag({ start: point, current: point });
  };

  const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
    if (!pointerStarted.current) return;
    const point = toVirtualPoint(event);
    setDrag((current) => (current ? { ...current, current: point } : current));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
    if (!pointerStarted.current || !drag) return;
    pointerStarted.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const current = toVirtualPoint(event);
    const width = Math.abs(current.x - drag.start.x);
    const height = Math.abs(current.y - drag.start.y);
    const clicked = width < dragThreshold && height < dragThreshold;
    setDrag(null);
    if (clicked) {
      void captureClickedWindow(current);
      return;
    }
    const topLeft = { x: Math.min(drag.start.x, current.x), y: Math.min(drag.start.y, current.y) };
    const display = activeDisplay;
    if (!display) return;
    void capture(
      {
        displayId: display.id,
        x: Math.max(display.x, topLeft.x),
        y: Math.max(display.y, topLeft.y),
        width: Math.max(1, Math.min(width, display.x + display.width - Math.max(display.x, topLeft.x))),
        height: Math.max(1, Math.min(height, display.y + display.height - Math.max(display.y, topLeft.y))),
      },
      display,
    );
  };

  const captureClickedWindow = async (point: Point) => {
    const display = activeDisplay;
    if (!display) return;
    setCapturing(true);
    setError("");
    try {
      await nativeRuntime.hideCaptureOverlay();
      await sleep(90);
      const clickedRegion = await nativeRuntime.windowRegionAtPoint(point.x, point.y);
      const region = clickedRegion || focusTarget;
      const captured = await capture(region, display);
      if (!captured) await nativeRuntime.showCaptureOverlay();
    } catch (reason) {
      setError(String(reason));
      setCapturing(false);
      await nativeRuntime.showCaptureOverlay();
    }
  };

  const selection = drag ? rectFromPoints(drag.start, drag.current, bounds) : null;
  const focusRect = focusTarget && activeDisplay ? rectFromRegion(clampRegionToDisplay(focusTarget, activeDisplay), bounds) : null;

  return (
    <main
      className="relative h-screen w-screen cursor-crosshair overflow-hidden bg-black/32 text-white"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,rgba(0,0,0,0.18)_70%)]" />

      {activeDisplay && (
        <div className="pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed border-white/70 bg-white/5">
          <div className="m-3 inline-flex items-center gap-2 rounded-md border border-white/20 bg-black/45 px-3 py-1.5 text-xs font-medium backdrop-blur">
            <Image className="h-3.5 w-3.5" />
            {activeDisplay.name} - {activeDisplay.width} x {activeDisplay.height}
          </div>
        </div>
      )}

      {selection && (
        <div
          className="pointer-events-none absolute rounded-md border-2 border-primary bg-primary/15 shadow-[0_0_0_1px_rgba(255,255,255,0.45)_inset]"
          style={selection}
        >
          <div className="absolute -top-8 left-0 rounded-md bg-black/75 px-2 py-1 text-xs font-semibold backdrop-blur">
            {Math.round(selection.width as number)} x {Math.round(selection.height as number)}
          </div>
        </div>
      )}

      {!selection && focusRect && (
        <div
          className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.32)_inset]"
          style={focusRect}
        >
          <div className="absolute -top-8 left-0 rounded-md bg-black/75 px-2 py-1 text-xs font-semibold backdrop-blur">
            Focused window
          </div>
        </div>
      )}

      <div className="absolute left-1/2 top-5 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-white/15 bg-black/65 px-3 py-2 text-sm shadow-2xl backdrop-blur-xl">
        {capturing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
        <span>{capturing ? "Saving screenshot..." : focusRect ? "Click to capture focused window or drag a region" : "Click to capture this screen or drag a region"}</span>
      </div>

      {error && (
        <div className="absolute bottom-5 left-1/2 max-w-xl -translate-x-1/2 rounded-lg border border-red-300/30 bg-red-950/75 px-4 py-2 text-sm shadow-2xl backdrop-blur-xl">
          {error}
        </div>
      )}

      <Button
        size="icon"
        variant="ghost"
        className="absolute right-5 top-5 h-9 w-9 border border-white/15 bg-black/50 text-white hover:bg-white/15 hover:text-white"
        aria-label="Close capture overlay"
        onClick={() => void nativeRuntime.hideCaptureOverlay()}
      >
        <X className="h-4 w-4" />
      </Button>
    </main>
  );
}

function getVirtualBounds(displays: DisplayInfo[]) {
  if (displays.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const x = Math.min(...displays.map((display) => display.x));
  const y = Math.min(...displays.map((display) => display.y));
  const maxX = Math.max(...displays.map((display) => display.x + display.width));
  const maxY = Math.max(...displays.map((display) => display.y + display.height));
  return { x, y, width: maxX - x, height: maxY - y };
}

function rectFromPoints(start: Point, current: Point, bounds: { x: number; y: number }) {
  const left = Math.min(start.x, current.x) - bounds.x;
  const top = Math.min(start.y, current.y) - bounds.y;
  return {
    left,
    top,
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

function rectFromRegion(region: CaptureRegion, bounds: { x: number; y: number }) {
  return {
    left: region.x - bounds.x,
    top: region.y - bounds.y,
    width: region.width,
    height: region.height,
  };
}

function clampRegionToDisplay(region: CaptureRegion, display: DisplayInfo): CaptureRegion {
  const x = Math.max(display.x, region.x);
  const y = Math.max(display.y, region.y);
  const right = Math.min(display.x + display.width, region.x + region.width);
  const bottom = Math.min(display.y + display.height, region.y + region.height);
  return {
    displayId: display.id,
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Crop, Image, LoaderCircle, MousePointer2, X } from "lucide-react";
import type { CaptureRegion, DisplayInfo, ShotSettings, WindowTarget } from "@atris-shot/shot-core";
import { DEFAULT_SHOT_SETTINGS } from "@atris-shot/shot-core";
import { Button } from "@/components/ui/button";
import { loadDesktopSettings } from "@/lib/desktop-settings";
import { nativeRuntime } from "@/lib/native-runtime";
import { useUiPreferences } from "@/lib/ui-preferences";

type Point = { x: number; y: number };
type DragState = { start: Point; current: Point } | null;

const dragThreshold = 8;
const hoverLookupMs = 120;

const overlayCopy = {
  en: {
    saving: "Saving screenshot...",
    locked: "Window selected. Click to capture, Esc to cancel, or drag a region.",
    hover: "Move over a window, click to capture it, or drag a region.",
    drag: "Release to capture region",
    selected: "Selected window",
    hovered: "Window under cursor",
    displayUnavailable: "No display is available.",
  },
  tr: {
    saving: "Ekran görüntüsü kaydediliyor...",
    locked: "Pencere seçildi. Kaydetmek için Enter, iptal için Esc veya başka pencere seçmek için tıkla.",
    hover: "Pencere üzerinde gez, seçmek için tıkla, kaydetmek için Enter ya da bölge için sürükle.",
    drag: "Bölgeyi yakalamak için bırak",
    selected: "Seçili pencere",
    hovered: "İmleç altındaki pencere",
    displayUnavailable: "Kullanılabilir ekran yok.",
  },
} as const;

export default function CaptureOverlayPage() {
  const { locale } = useUiPreferences();
  const text = overlayCopy[locale];
  const [displays, setDisplays] = useState<DisplayInfo[]>([]);
  const [settings, setSettings] = useState<ShotSettings>(DEFAULT_SHOT_SETTINGS);
  const [drag, setDrag] = useState<DragState>(null);
  const [hoverTarget, setHoverTarget] = useState<WindowTarget | null>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  const pointerStarted = useRef(false);
  const lookupRef = useRef<{ timer: number | null; running: boolean; sequence: number }>({ timer: null, running: false, sequence: 0 });

  const bounds = useMemo(() => getVirtualBounds(displays), [displays]);
  const primaryDisplay = displays.find((display) => display.primary) || displays[0];
  const scale = useMemo(
    () => ({
      x: bounds.width / Math.max(1, viewport.width),
      y: bounds.height / Math.max(1, viewport.height),
    }),
    [bounds.height, bounds.width, viewport.height, viewport.width],
  );
  const selectedRegion = hoverTarget?.region || null;

  const toVirtualPoint = useCallback(
    (event: PointerEvent<HTMLElement>): Point => ({
      x: Math.round(bounds.x + event.clientX * scale.x),
      y: Math.round(bounds.y + event.clientY * scale.y),
    }),
    [bounds.x, bounds.y, scale.x, scale.y],
  );

  const capture = useCallback(
    async (region: CaptureRegion | null, targetDisplay?: DisplayInfo, windowTarget?: WindowTarget | null) => {
      const target =
        targetDisplay ||
        (region ? displayForRegion(displays, region) : null) ||
        primaryDisplay;
      if (!target) {
        setError(text.displayUnavailable);
        return false;
      }
      setCapturing(true);
      setError("");
      try {
        if (windowTarget) {
          await nativeRuntime.captureShot({
            mode: "window",
            displayId: target.id,
            region: windowTarget.region,
            windowId: windowTarget.windowId,
            saveFolder: settings.saveFolder,
            clipboardMode: settings.clipboardMode,
            postCaptureAction: settings.postCaptureAction,
            overlayCorner: settings.overlayCorner,
            includeCursor: settings.includeCursor,
            captureDelayMs: settings.captureDelayMs,
            historyLimit: settings.historyLimit,
          });
          return true;
        }
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
        await nativeRuntime.showCaptureOverlay();
        return false;
      } finally {
        setCapturing(false);
      }
    },
    [displays, primaryDisplay, settings, text.displayUnavailable],
  );

  const updateHoveredWindow = useCallback(
    async () => {
      if (capturing || drag) return;
      lookupRef.current.running = true;
      try {
        const sequence = ++lookupRef.current.sequence;
        const target = await nativeRuntime.windowTargetAtCursor();
        if (sequence === lookupRef.current.sequence) setHoverTarget(target);
      } catch {
        setHoverTarget(null);
      } finally {
        lookupRef.current.running = false;
      }
    },
    [capturing, drag],
  );

  const scheduleHoverLookup = useCallback(
    () => {
      if (lookupRef.current.running || lookupRef.current.timer) return;
      lookupRef.current.timer = window.setTimeout(() => {
        lookupRef.current.timer = null;
        void updateHoveredWindow();
      }, hoverLookupMs);
    },
    [updateHoveredWindow],
  );

  useEffect(() => {
    document.documentElement.classList.add("overlay-window");
    document.body.classList.add("overlay-window");
    const updateViewport = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    updateViewport();
    window.addEventListener("resize", updateViewport);
    void nativeRuntime.listDisplays().then(setDisplays).catch((reason) => setError(String(reason)));
    void loadDesktopSettings().then(setSettings).catch(() => undefined);
    let unlistenOpened: (() => void) | undefined;
    void nativeRuntime.onCaptureOverlayOpened(() => {
      if (lookupRef.current.timer) {
        window.clearTimeout(lookupRef.current.timer);
        lookupRef.current.timer = null;
      }
      lookupRef.current.running = false;
      lookupRef.current.sequence += 1;
      pointerStarted.current = false;
      setDrag(null);
      setHoverTarget(null);
      setError("");
    }).then((dispose) => {
      unlistenOpened = dispose;
    });
    return () => {
      document.documentElement.classList.remove("overlay-window");
      document.body.classList.remove("overlay-window");
      unlistenOpened?.();
      window.removeEventListener("resize", updateViewport);
      if (lookupRef.current.timer) window.clearTimeout(lookupRef.current.timer);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void nativeRuntime.hideCaptureOverlay();
      if (event.key === "Enter" && !capturing) {
        event.preventDefault();
        void capture(
          hoverTarget?.region || null,
          hoverTarget ? displayForRegion(displays, hoverTarget.region) || undefined : primaryDisplay,
          hoverTarget,
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [capture, capturing, displays, hoverTarget, primaryDisplay]);

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (capturing || (event.target as HTMLElement).closest("button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toVirtualPoint(event);
    pointerStarted.current = true;
    setDrag({ start: point, current: point });
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const point = toVirtualPoint(event);
    if (pointerStarted.current) {
      setDrag((current) => (current ? { ...current, current: point } : current));
      return;
    }
    scheduleHoverLookup();
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    if (!pointerStarted.current || !drag) return;
    pointerStarted.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const current = toVirtualPoint(event);
    const width = Math.abs(current.x - drag.start.x);
    const height = Math.abs(current.y - drag.start.y);
    const clicked = width < dragThreshold && height < dragThreshold;
    setDrag(null);
    if (clicked) {
      void nativeRuntime
        .windowTargetAtCursor()
        .then((target) => {
          setHoverTarget(target);
          if (!target) return;
          void capture(target.region, displayForRegion(displays, target.region) || primaryDisplay, target);
        })
        .catch(() => {
          setHoverTarget(null);
        });
      return;
    }
    const topLeft = { x: Math.min(drag.start.x, current.x), y: Math.min(drag.start.y, current.y) };
    const display = displayForPoint(displays, {
      x: topLeft.x + Math.round(width / 2),
      y: topLeft.y + Math.round(height / 2),
    }) || primaryDisplay;
    if (!display) return;
    void capture(
      {
        displayId: display.id,
        x: topLeft.x,
        y: topLeft.y,
        width: Math.max(1, width),
        height: Math.max(1, height),
      },
      display,
    );
  };

  const selection = drag ? rectFromPoints(drag.start, drag.current, bounds, scale) : null;
  const activeRegionRect = selectedRegion ? rectFromRegion(clampRegionToVirtualBounds(selectedRegion, bounds), bounds, scale) : null;
  const activeRegionLabel = text.hovered;

  return (
    <main
      className="relative h-screen w-screen cursor-crosshair overflow-hidden text-white"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <CaptureDimmer rect={selection || activeRegionRect} />

      {primaryDisplay && (
        <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-white/15 bg-black/45 px-3 py-1.5 text-xs font-medium backdrop-blur">
          <div className="inline-flex items-center gap-2">
            <Image className="h-3.5 w-3.5" />
            {displays.length > 1
              ? `${displays.length} screens - ${bounds.width} x ${bounds.height}`
              : `${primaryDisplay.name} - ${primaryDisplay.width} x ${primaryDisplay.height}`}
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

      {!selection && activeRegionRect && (
        <div
          className="pointer-events-none absolute rounded-md border-2 border-dashed border-primary bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.32)_inset]"
          style={activeRegionRect}
        >
          <div className="absolute -top-8 left-0 inline-flex items-center gap-1 rounded-md bg-black/75 px-2 py-1 text-xs font-semibold backdrop-blur">
            <MousePointer2 className="h-3 w-3" />
            {activeRegionLabel}
          </div>
        </div>
      )}

      <div className="absolute left-1/2 top-5 flex max-w-3xl -translate-x-1/2 items-center gap-2 rounded-lg border border-white/15 bg-black/65 px-3 py-2 text-sm shadow-2xl backdrop-blur-xl">
        {capturing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
        <span>{capturing ? text.saving : selection ? text.drag : text.hover}</span>
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

function rectFromPoints(start: Point, current: Point, bounds: { x: number; y: number }, scale: { x: number; y: number }) {
  const left = (Math.min(start.x, current.x) - bounds.x) / scale.x;
  const top = (Math.min(start.y, current.y) - bounds.y) / scale.y;
  return {
    left,
    top,
    width: Math.abs(current.x - start.x) / scale.x,
    height: Math.abs(current.y - start.y) / scale.y,
  };
}

function rectFromRegion(region: CaptureRegion, bounds: { x: number; y: number }, scale: { x: number; y: number }) {
  return {
    left: (region.x - bounds.x) / scale.x,
    top: (region.y - bounds.y) / scale.y,
    width: region.width / scale.x,
    height: region.height / scale.y,
  };
}

function CaptureDimmer({ rect }: { rect: { left: number; top: number; width: number; height: number } | null }) {
  if (!rect) return <div className="pointer-events-none absolute inset-0 bg-black/10" />;
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-0 bg-black/25" style={{ height: rect.top }} />
      <div className="absolute inset-x-0 bottom-0 bg-black/25" style={{ top: rect.top + rect.height }} />
      <div className="absolute left-0 bg-black/25" style={{ top: rect.top, width: rect.left, height: rect.height }} />
      <div className="absolute right-0 bg-black/25" style={{ top: rect.top, left: rect.left + rect.width, height: rect.height }} />
    </div>
  );
}

function clampRegionToVirtualBounds(region: CaptureRegion, bounds: { x: number; y: number; width: number; height: number }): CaptureRegion {
  const x = Math.max(bounds.x, region.x);
  const y = Math.max(bounds.y, region.y);
  const right = Math.min(bounds.x + bounds.width, region.x + region.width);
  const bottom = Math.min(bounds.y + bounds.height, region.y + region.height);
  return {
    displayId: region.displayId,
    x,
    y,
    width: Math.max(1, right - x),
    height: Math.max(1, bottom - y),
  };
}

function displayForPoint(displays: DisplayInfo[], point: Point) {
  return displays.find(
    (display) =>
      point.x >= display.x &&
      point.y >= display.y &&
      point.x < display.x + display.width &&
      point.y < display.y + display.height,
  );
}

function displayForRegion(displays: DisplayInfo[], region: CaptureRegion) {
  return (
    displays.find((display) => display.id === region.displayId) ||
    displayForPoint(displays, {
      x: region.x + Math.round(region.width / 2),
      y: region.y + Math.round(region.height / 2),
    })
  );
}

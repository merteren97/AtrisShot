"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Check, Crop, Image, LoaderCircle, MousePointer2, X } from "lucide-react";
import type { CaptureRegion, DisplayInfo, ShotSettings } from "@atris-shot/shot-core";
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
    locked: "Window selected. Press Enter to save, Esc to cancel, or click another window.",
    hover: "Move over a window, click to select it, press Enter to save, or drag a region.",
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
  const [hoverRegion, setHoverRegion] = useState<CaptureRegion | null>(null);
  const [lockedRegion, setLockedRegion] = useState<CaptureRegion | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState("");
  const pointerStarted = useRef(false);
  const lookupRef = useRef<{ point: Point; timer: number | null; running: boolean }>({ point: { x: 0, y: 0 }, timer: null, running: false });

  const bounds = useMemo(() => getVirtualBounds(displays), [displays]);
  const primaryDisplay = displays.find((display) => display.primary) || displays[0];
  const selectedRegion = lockedRegion || hoverRegion;

  const toVirtualPoint = useCallback(
    (event: PointerEvent<HTMLElement>): Point => ({
      x: Math.round(bounds.x + event.clientX),
      y: Math.round(bounds.y + event.clientY),
    }),
    [bounds.x, bounds.y],
  );

  const capture = useCallback(
    async (region: CaptureRegion | null, targetDisplay?: DisplayInfo) => {
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
        const resolvedRegion = await resolveFreshWindowRegion(region);
        if (region && isWindowRegion(region) && !resolvedRegion) {
          setHoverRegion(null);
          setLockedRegion(null);
          setError(text.displayUnavailable);
          return false;
        }
        await nativeRuntime.captureShot({
          mode: resolvedRegion ? "region" : "display",
          displayId: target.id,
          region: resolvedRegion || undefined,
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
    async (point: Point) => {
      if (capturing || drag) return;
      lookupRef.current.running = true;
      try {
        const region = await nativeRuntime.windowRegionAtPoint(point.x, point.y);
        setHoverRegion((current) => (sameRegion(current, region) ? current : region));
      } catch {
        setHoverRegion(null);
      } finally {
        lookupRef.current.running = false;
      }
    },
    [capturing, drag],
  );

  const scheduleHoverLookup = useCallback(
    (point: Point) => {
      lookupRef.current.point = point;
      if (lookupRef.current.running || lookupRef.current.timer) return;
      lookupRef.current.timer = window.setTimeout(() => {
        lookupRef.current.timer = null;
        void updateHoveredWindow(lookupRef.current.point);
      }, hoverLookupMs);
    },
    [updateHoveredWindow],
  );

  useEffect(() => {
    document.documentElement.classList.add("overlay-window");
    document.body.classList.add("overlay-window");
    void nativeRuntime.listDisplays().then(setDisplays).catch((reason) => setError(String(reason)));
    void loadDesktopSettings().then(setSettings).catch(() => undefined);
    let unlistenOpened: (() => void) | undefined;
    void nativeRuntime.onCaptureOverlayOpened(() => {
      if (lookupRef.current.timer) {
        window.clearTimeout(lookupRef.current.timer);
        lookupRef.current.timer = null;
      }
      lookupRef.current.running = false;
      pointerStarted.current = false;
      setDrag(null);
      setHoverRegion(null);
      setLockedRegion(null);
      setError("");
    }).then((dispose) => {
      unlistenOpened = dispose;
    });
    return () => {
      document.documentElement.classList.remove("overlay-window");
      document.body.classList.remove("overlay-window");
      unlistenOpened?.();
      if (lookupRef.current.timer) window.clearTimeout(lookupRef.current.timer);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void nativeRuntime.hideCaptureOverlay();
      if (event.key === "Enter" && !capturing) {
        event.preventDefault();
        const region = lockedRegion || hoverRegion;
        void capture(region, region ? displayForRegion(displays, region) || undefined : primaryDisplay);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [capture, capturing, displays, hoverRegion, lockedRegion, primaryDisplay]);

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
    scheduleHoverLookup(point);
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
        .windowRegionAtPoint(current.x, current.y)
        .then((region) => {
          setHoverRegion(region);
          setLockedRegion(region);
        })
        .catch(() => {
          setHoverRegion(null);
          setLockedRegion(null);
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
        x: Math.max(display.x, topLeft.x),
        y: Math.max(display.y, topLeft.y),
        width: Math.max(1, Math.min(width, display.x + display.width - Math.max(display.x, topLeft.x))),
        height: Math.max(1, Math.min(height, display.y + display.height - Math.max(display.y, topLeft.y))),
      },
      display,
    );
  };

  const selection = drag ? rectFromPoints(drag.start, drag.current, bounds) : null;
  const activeRegionRect = selectedRegion ? rectFromRegion(clampRegionToVirtualBounds(selectedRegion, bounds), bounds) : null;
  const activeRegionLabel = lockedRegion ? text.selected : text.hovered;

  return (
    <main
      className="relative h-screen w-screen cursor-crosshair overflow-hidden bg-black/36 text-white"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0,rgba(0,0,0,0.2)_72%)]" />

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
          className={`pointer-events-none absolute rounded-md border-2 bg-primary/10 shadow-[0_0_0_1px_rgba(255,255,255,0.32)_inset] ${lockedRegion ? "border-primary" : "border-dashed border-primary"}`}
          style={activeRegionRect}
        >
          <div className="absolute -top-8 left-0 inline-flex items-center gap-1 rounded-md bg-black/75 px-2 py-1 text-xs font-semibold backdrop-blur">
            {lockedRegion ? <Check className="h-3 w-3" /> : <MousePointer2 className="h-3 w-3" />}
            {activeRegionLabel}
          </div>
        </div>
      )}

      <div className="absolute left-1/2 top-5 flex max-w-3xl -translate-x-1/2 items-center gap-2 rounded-lg border border-white/15 bg-black/65 px-3 py-2 text-sm shadow-2xl backdrop-blur-xl">
        {capturing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Crop className="h-4 w-4" />}
        <span>{capturing ? text.saving : selection ? text.drag : lockedRegion ? text.locked : text.hover}</span>
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

function isWindowRegion(region: CaptureRegion) {
  return region.displayId === "clicked-window" || region.displayId === "focused-window";
}

function sameRegion(first: CaptureRegion | null, second: CaptureRegion | null) {
  if (!first || !second) return first === second;
  return first.displayId === second.displayId && first.x === second.x && first.y === second.y && first.width === second.width && first.height === second.height;
}

async function resolveFreshWindowRegion(region: CaptureRegion | null) {
  if (!region) return null;
  if (!isWindowRegion(region)) return region;
  const x = region.x + Math.round(region.width / 2);
  const y = region.y + Math.round(region.height / 2);
  return nativeRuntime.windowRegionAtPoint(x, y);
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

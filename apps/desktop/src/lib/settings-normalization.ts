import type { ShotSettings } from "@atris-shot/shot-core";
import { DEFAULT_SHOT_SETTINGS } from "@atris-shot/shot-core";

const normalizeClipboardMode = (value: unknown): ShotSettings["clipboardMode"] =>
  value === "image" || value === "path" || value === "off" ? value : DEFAULT_SHOT_SETTINGS.clipboardMode;

const normalizeOverlayVisibilityMode = (value: unknown): ShotSettings["overlayVisibilityMode"] =>
  value === "always-visible" || value === "shortcut-only" ? value : DEFAULT_SHOT_SETTINGS.overlayVisibilityMode;

export function normalizeDesktopSettings(stored: Partial<ShotSettings>): ShotSettings {
  return {
    ...DEFAULT_SHOT_SETTINGS,
    ...stored,
    shortcut: stored.shortcut || DEFAULT_SHOT_SETTINGS.shortcut,
    saveFolder: stripWindowsVerbatimPath(stored.saveFolder || ""),
    clipboardMode: normalizeClipboardMode(stored.clipboardMode),
    overlayVisibilityMode: normalizeOverlayVisibilityMode(stored.overlayVisibilityMode),
    overlayShortcut: stored.overlayShortcut || DEFAULT_SHOT_SETTINGS.overlayShortcut,
    historyLimit: Math.max(10, Math.min(1000, Number(stored.historyLimit || DEFAULT_SHOT_SETTINGS.historyLimit))),
    captureDelayMs: Math.max(0, Math.min(10_000, Number(stored.captureDelayMs || DEFAULT_SHOT_SETTINGS.captureDelayMs))),
  };
}

export function stripWindowsVerbatimPath(value: string) {
  return value.replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/i, "");
}

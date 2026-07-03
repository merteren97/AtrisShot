import type { ShotSettings } from "@atris-shot/shot-core";
import { DEFAULT_SHOT_SETTINGS } from "@atris-shot/shot-core";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";

export type { ClipboardMode, OverlayCorner, PostCaptureAction, ShotSettings } from "@atris-shot/shot-core";

const SETTINGS_KEY = "shotSettings";
const normalizeClipboardMode = (value: unknown): ShotSettings["clipboardMode"] =>
  value === "path" || value === "off" ? value : "image";

export async function loadDesktopSettings(): Promise<ShotSettings> {
  const stored = await nativeRuntime.getSetting<Partial<ShotSettings>>(SETTINGS_KEY, {});
  return {
    ...DEFAULT_SHOT_SETTINGS,
    ...stored,
    shortcut: stored.shortcut || DEFAULT_SHOT_SETTINGS.shortcut,
    saveFolder: stripWindowsVerbatimPath(stored.saveFolder || ""),
    clipboardMode: normalizeClipboardMode(stored.clipboardMode),
    historyLimit: Math.max(10, Math.min(500, Number(stored.historyLimit || DEFAULT_SHOT_SETTINGS.historyLimit))),
    captureDelayMs: Math.max(0, Math.min(10_000, Number(stored.captureDelayMs || DEFAULT_SHOT_SETTINGS.captureDelayMs))),
  };
}

export async function saveDesktopSettings(settings: ShotSettings) {
  await nativeRuntime.setSetting(SETTINGS_KEY, { ...settings, saveFolder: stripWindowsVerbatimPath(settings.saveFolder) });
  if (isNativeRuntime()) await nativeRuntime.emitDesktopSettingsChanged();
}

export async function saveDesktopSetting<K extends keyof ShotSettings>(
  key: K,
  value: ShotSettings[K],
) {
  const current = await loadDesktopSettings();
  await saveDesktopSettings({ ...current, [key]: value });
}

function stripWindowsVerbatimPath(value: string) {
  return value.replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/i, "");
}

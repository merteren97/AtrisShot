import type { ShotSettings } from "@atris-shot/shot-core";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";
import { normalizeDesktopSettings, stripWindowsVerbatimPath } from "@/lib/settings-normalization";

export type { ClipboardMode, OverlayCorner, OverlayVisibilityMode, PostCaptureAction, ShotSettings } from "@atris-shot/shot-core";

const SETTINGS_KEY = "shotSettings";
export async function loadDesktopSettings(): Promise<ShotSettings> {
  const stored = await nativeRuntime.getSetting<Partial<ShotSettings>>(SETTINGS_KEY, {});
  return normalizeDesktopSettings(stored);
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

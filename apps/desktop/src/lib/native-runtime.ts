import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { LazyStore } from "@tauri-apps/plugin-store";
import type { CaptureRegion, CaptureRequest, CaptureResult, DisplayInfo, ShotHistoryEntry } from "@atris-shot/shot-core";

export const isNativeRuntime = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const settingsStore = () => (isNativeRuntime() ? new LazyStore("settings.json") : null);

const fallbackDisplays = (): DisplayInfo[] => [
  {
    id: "browser-preview",
    name: "Preview display",
    x: 0,
    y: 0,
    width: typeof window === "undefined" ? 1440 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
    scaleFactor: 1,
    primary: true,
  },
];

export const nativeRuntime = {
  listDisplays: () =>
    isNativeRuntime() ? invoke<DisplayInfo[]>("list_displays") : Promise.resolve(fallbackDisplays()),
  currentWindowDisplay: async (): Promise<DisplayInfo> => {
    if (!isNativeRuntime()) return fallbackDisplays()[0];
    const current = getCurrentWindow();
    const [position, size] = await Promise.all([current.outerPosition(), current.outerSize()]);
    return {
      id: "current-window-display",
      name: "Current screen",
      x: position.x,
      y: position.y,
      width: size.width,
      height: size.height,
      scaleFactor: 1,
      primary: true,
    };
  },
  captureShot: (request: CaptureRequest) =>
    isNativeRuntime()
      ? invoke<CaptureResult>("capture_shot", { request })
      : Promise.reject(new Error("Open the packaged desktop app to capture the screen.")),
  listShotHistory: () =>
    isNativeRuntime() ? invoke<ShotHistoryEntry[]>("list_shot_history") : Promise.resolve([]),
  latestShot: () =>
    isNativeRuntime() ? invoke<ShotHistoryEntry | null>("latest_shot") : Promise.resolve(null),
  deleteShot: (id: string) => invoke<ShotHistoryEntry[]>("delete_shot", { id }),
  clearShotHistory: () => invoke<ShotHistoryEntry[]>("clear_shot_history"),
  revealShot: (path: string) => invoke<void>("reveal_shot", { path }),
  pathExists: (path: string) =>
    isNativeRuntime() ? invoke<boolean>("path_exists", { path }) : Promise.resolve(true),
  focusedWindowRegion: () =>
    isNativeRuntime() ? invoke<CaptureRegion | null>("focused_window_region") : Promise.resolve(null),
  windowRegionAtPoint: (x: number, y: number) =>
    isNativeRuntime()
      ? invoke<CaptureRegion | null>("window_region_at_point", { x: Math.round(x), y: Math.round(y) })
      : Promise.resolve(null),
  readShotDataUrl: (path: string) =>
    isNativeRuntime() ? invoke<string>("read_shot_data_url", { path }) : Promise.resolve(""),
  removeLocalData: () => invoke<void>("remove_local_data"),
  copyShotPath: async (path: string) => {
    if (isNativeRuntime()) {
      await invoke<void>("copy_shot_path", { path });
      return;
    }
    await navigator.clipboard.writeText(path);
  },
  validateSaveFolder: (saveFolder: string) =>
    invoke<string>("validate_save_folder", { saveFolder }),
  openStorageFolder: (saveFolder: string) =>
    invoke<void>("open_storage_folder", { saveFolder }),
  applyAnnotations: (id: string, annotationsJson: string) =>
    invoke<ShotHistoryEntry>("apply_annotations", { id, annotationsJson }),
  saveShortcut: (shortcut: string, previousShortcut?: string) =>
    invoke<string>("save_shortcut", { shortcut, previousShortcut }),
  showOverlay: (overlayCorner?: string) => invoke<void>("show_overlay", { overlayCorner }),
  hideOverlay: () => invoke<void>("hide_overlay"),
  showCaptureOverlay: () => invoke<void>("show_capture_overlay"),
  hideCaptureOverlay: () => invoke<void>("hide_capture_overlay"),
  openMainWindow: () => invoke<void>("open_main_window"),
  startDragging: () => getCurrentWindow().startDragging(),
  emitShotCaptured: (entry: ShotHistoryEntry) => emit("shot-captured", entry),
  onShotCaptured: (callback: (entry: ShotHistoryEntry) => void) =>
    listen<ShotHistoryEntry>("shot-captured", (event) => callback(event.payload)),
  emitEditShotRequested: (entry: ShotHistoryEntry) => emit("edit-shot-requested", entry),
  onEditShotRequested: (callback: (entry: ShotHistoryEntry) => void) =>
    listen<ShotHistoryEntry>("edit-shot-requested", (event) => callback(event.payload)),
  emitDesktopSettingsChanged: () => emit("desktop-settings-changed"),
  onDesktopSettingsChanged: (callback: () => void) =>
    listen("desktop-settings-changed", callback),
  emitUiPreferencesChanged: (preferences: { locale: string; theme: string }) =>
    emit("ui-preferences-changed", preferences),
  setTrayLocale: (locale: string) => invoke<void>("set_tray_locale", { locale }),
  restartApplication: () => invoke<void>("restart_application"),
  onUiPreferencesChanged: (
    callback: (preferences: { locale: string; theme: string }) => void,
  ) =>
    listen<{ locale: string; theme: string }>("ui-preferences-changed", (event) =>
      callback(event.payload),
    ),
  storeSessionToken: (token: string) => invoke<void>("store_session_token", { token }),
  readSessionToken: () => invoke<string | null>("read_session_token"),
  deleteSessionToken: () => invoke<void>("delete_session_token"),
  authorizeProductAccess: (validatedAtMs: number, offline: boolean) =>
    invoke<{ allowed: boolean; offline: boolean; allowedUntilMs: number }>(
      "authorize_product_access",
      { validatedAtMs, offline },
    ),
  revokeProductAccess: () => invoke<void>("revoke_product_access"),
  async copyText(text: string) {
    if (isNativeRuntime()) {
      await writeText(text);
      return;
    }
    await navigator.clipboard.writeText(text);
  },
  async getSetting<T>(key: string, fallback: T): Promise<T> {
    const store = settingsStore();
    if (!store) return fallback;
    const value = await store.get<T>(key);
    return value ?? fallback;
  },
  async setSetting<T>(key: string, value: T) {
    const store = settingsStore();
    if (!store) return;
    await store.set(key, value);
    await store.save();
  },
};

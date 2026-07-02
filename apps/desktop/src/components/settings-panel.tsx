"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Clipboard,
  Clock3,
  FolderOpen,
  Image,
  Keyboard,
  Languages,
  LayoutPanelTop,
  LoaderCircle,
  MapPinned,
  Palette,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import type { ClipboardMode, OverlayCorner, PostCaptureAction, ShotSettings } from "@atris-shot/shot-core";
import { DEFAULT_SHOT_SETTINGS } from "@atris-shot/shot-core";
import { ShortcutRecorder } from "@/components/shortcut-recorder";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadDesktopSettings, saveDesktopSettings } from "@/lib/desktop-settings";
import { isNativeRuntime, nativeRuntime } from "@/lib/native-runtime";
import { useUiPreferences, type Locale, type ThemeMode } from "@/lib/ui-preferences";

const LOCAL_DATA_CONFIRMATION = "RESET ATRISSHOT";

const copy = {
  en: {
    loading: "Loading preferences",
    title: "Settings",
    description: "Configure capture behavior, output, overlay placement, and local history.",
    preferenceSaved: "Preference saved.",
    shortcutUpdated: "Shortcut updated.",
    shortcutError: "Shortcut could not be registered:",
    saveFolderReady: "Save folder is ready.",
    defaultFolderReady: "Default save folder is ready.",
    saveFolderError: "Save folder is not available:",
    storageOpened: "Storage folder opened.",
    openFolderDesktopOnly: "Open folder is available in the packaged desktop app.",
    storageOpenError: "Storage folder could not be opened:",
    appearanceTitle: "Appearance and language",
    appearanceDescription: "Choose the interface language and color mode used by the desktop app and tray menu.",
    language: "Language",
    english: "English",
    turkish: "Turkish",
    theme: "Theme",
    system: "System",
    light: "Light",
    dark: "Dark",
    trayLanguageHint: "The tray right-click menu follows this language.",
    shortcutTitle: "Capture shortcut",
    shortcutDescription: "Register the global shortcut that opens the full-screen capture overlay.",
    recording: "Recording...",
    invalidShortcut: "Invalid shortcut",
    reset: "Reset",
    saveShortcut: "Save shortcut",
    outputTitle: "Output",
    outputDescription: "Choose what happens immediately after a screenshot is saved.",
    clipboard: "Clipboard",
    copyImage: "Copy image",
    copyPath: "Copy path",
    off: "Off",
    afterCapture: "After capture",
    cornerOverlay: "Corner overlay",
    openEditor: "Open editor",
    saveSilently: "Save silently",
    overlayTitle: "Result overlay",
    overlayDescription: "Place the result preview where it will not interrupt your work.",
    position: "Position",
    bottomLeft: "Bottom left",
    bottomRight: "Bottom right",
    topLeft: "Top left",
    topRight: "Top right",
    storageTitle: "Storage",
    storageDescription: "Screenshots are stored locally. Empty folder uses the operating-system app data directory.",
    saveFolder: "Save folder",
    saveFolderPlaceholder: "Default local app data folder",
    validateFolder: "Validate folder",
    useDefault: "Use default",
    openFolder: "Open folder",
    captureDelay: "Capture delay (ms)",
    historyLimit: "History limit",
    cursorTitle: "Cursor capture",
    cursorUnavailable: "The current native capture backend does not include the cursor yet, so this option is kept unavailable instead of saving a setting that would not take effect.",
    unavailable: "Unavailable",
    advancedTitle: "Advanced",
    advancedDescription: "Remove AtrisShot data kept in this device's app-data area.",
    removeLocalDataTitle: "Remove local data",
    removeLocalDataDescription: "Deletes local history, default screenshot cache, thumbnails, saved app settings, and the stored session. Screenshots in a custom save folder are not deleted.",
    removeLocalDataConfirmLabel: `Type ${LOCAL_DATA_CONFIRMATION} to confirm`,
    removeLocalDataConfirmPlaceholder: LOCAL_DATA_CONFIRMATION,
    removeLocalData: "Remove local data",
    removeLocalDataDone: "Local AtrisShot data was removed.",
    removeLocalDataDesktopOnly: "Local data removal is available in the packaged desktop app.",
    removeLocalDataError: "Local data could not be removed:",
  },
  tr: {
    loading: "Tercihler yükleniyor",
    title: "Ayarlar",
    description: "Yakalama davranışını, çıktıyı, overlay konumunu ve yerel geçmişi yapılandır.",
    preferenceSaved: "Tercih kaydedildi.",
    shortcutUpdated: "Kısayol güncellendi.",
    shortcutError: "Kısayol kaydedilemedi:",
    saveFolderReady: "Kaydetme klasörü hazır.",
    defaultFolderReady: "Varsayılan kaydetme klasörü hazır.",
    saveFolderError: "Kaydetme klasörü kullanılamıyor:",
    storageOpened: "Depolama klasörü açıldı.",
    openFolderDesktopOnly: "Klasör açma paketlenmiş masaüstü uygulamasında kullanılabilir.",
    storageOpenError: "Depolama klasörü açılamadı:",
    appearanceTitle: "Görünüm ve dil",
    appearanceDescription: "Masaüstü uygulaması ve tray menüsü için arayüz dilini ve renk modunu seç.",
    language: "Dil",
    english: "İngilizce",
    turkish: "Türkçe",
    theme: "Tema",
    system: "Sistem",
    light: "Açık",
    dark: "Koyu",
    trayLanguageHint: "Tray sağ tık menüsü bu dili takip eder.",
    shortcutTitle: "Yakalama kısayolu",
    shortcutDescription: "Tam ekran seçim overlay'ini açan global kısayolu kaydet.",
    recording: "Kaydediliyor...",
    invalidShortcut: "Geçersiz kısayol",
    reset: "Sıfırla",
    saveShortcut: "Kısayolu kaydet",
    outputTitle: "Çıktı",
    outputDescription: "Ekran görüntüsü kaydedildikten hemen sonra ne olacağını seç.",
    clipboard: "Pano",
    copyImage: "Resmi kopyala",
    copyPath: "Path'i kopyala",
    off: "Kapalı",
    afterCapture: "Yakalama sonrası",
    cornerOverlay: "Köşe overlay'i",
    openEditor: "Editörü aç",
    saveSilently: "Sessiz kaydet",
    overlayTitle: "Sonuç overlay'i",
    overlayDescription: "Sonuç önizlemesini çalışmanı bölmeyecek konuma yerleştir.",
    position: "Konum",
    bottomLeft: "Sol alt",
    bottomRight: "Sağ alt",
    topLeft: "Sol üst",
    topRight: "Sağ üst",
    storageTitle: "Depolama",
    storageDescription: "Ekran görüntüleri yerel olarak saklanır. Boş klasör işletim sisteminin uygulama veri klasörünü kullanır.",
    saveFolder: "Kaydetme klasörü",
    saveFolderPlaceholder: "Varsayılan yerel uygulama veri klasörü",
    validateFolder: "Klasörü doğrula",
    useDefault: "Varsayılanı kullan",
    openFolder: "Klasörü aç",
    captureDelay: "Yakalama gecikmesi (ms)",
    historyLimit: "Geçmiş limiti",
    cursorTitle: "İmleç yakalama",
    cursorUnavailable: "Mevcut native yakalama altyapısı imleci henüz dahil etmiyor; bu yüzden etkisiz kalacak bir ayar kaydetmek yerine bu seçenek kapalı tutuluyor.",
    unavailable: "Kullanılamıyor",
    advancedTitle: "Gelişmiş",
    advancedDescription: "Bu cihazdaki uygulama veri alanında tutulan AtrisShot verilerini kaldır.",
    removeLocalDataTitle: "Yerel verileri kaldır",
    removeLocalDataDescription: "Yerel geçmişi, varsayılan ekran görüntüsü cache'ini, thumbnail'leri, kayıtlı uygulama ayarlarını ve saklanan oturumu siler. Özel kaydetme klasöründeki ekran görüntüleri silinmez.",
    removeLocalDataConfirmLabel: `Onaylamak için ${LOCAL_DATA_CONFIRMATION} yaz`,
    removeLocalDataConfirmPlaceholder: LOCAL_DATA_CONFIRMATION,
    removeLocalData: "Yerel verileri kaldır",
    removeLocalDataDone: "Yerel AtrisShot verileri kaldırıldı.",
    removeLocalDataDesktopOnly: "Yerel veri kaldırma paketlenmiş masaüstü uygulamasında kullanılabilir.",
    removeLocalDataError: "Yerel veriler kaldırılamadı:",
  },
} as const;

export function SettingsPanel({
  onSettingsChanged,
  onLocalDataRemoved,
}: {
  onSettingsChanged: (settings: ShotSettings) => void;
  onLocalDataRemoved: () => void;
}) {
  const { locale, theme, setLocale, setTheme } = useUiPreferences();
  const text = copy[locale];
  const [settings, setSettings] = useState<ShotSettings>(DEFAULT_SHOT_SETTINGS);
  const [shortcutDraft, setShortcutDraft] = useState(DEFAULT_SHOT_SETTINGS.shortcut);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [localDataConfirmation, setLocalDataConfirmation] = useState("");

  useEffect(() => {
    void loadDesktopSettings()
      .then((value) => {
        setSettings(value);
        setShortcutDraft(value.shortcut);
        onSettingsChanged(value);
      })
      .catch((reason) => setError(String(reason)))
      .finally(() => setLoading(false));
  }, [onSettingsChanged]);

  const persist = async (next: ShotSettings, savingKey: string) => {
    setSaving(savingKey);
    setMessage("");
    setError("");
    try {
      await saveDesktopSettings(next);
      setSettings(next);
      onSettingsChanged(next);
      setMessage(text.preferenceSaved);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setSaving("");
    }
  };

  const saveShortcut = async () => {
    setSaving("shortcut");
    setMessage("");
    setError("");
    try {
      const canonical = isNativeRuntime()
        ? await nativeRuntime.saveShortcut(shortcutDraft, settings.shortcut)
        : shortcutDraft;
      const next = { ...settings, shortcut: canonical };
      await saveDesktopSettings(next);
      setSettings(next);
      setShortcutDraft(canonical);
      onSettingsChanged(next);
      setMessage(text.shortcutUpdated);
    } catch (reason) {
      setError(`${text.shortcutError} ${String(reason)}`);
    } finally {
      setSaving("");
    }
  };

  const saveFolder = async (value = settings.saveFolder) => {
    setSaving("saveFolder");
    setMessage("");
    setError("");
    try {
      const normalized = isNativeRuntime() ? await nativeRuntime.validateSaveFolder(value) : value.trim();
      const next = { ...settings, saveFolder: normalized };
      await saveDesktopSettings(next);
      setSettings(next);
      onSettingsChanged(next);
      setMessage(normalized ? text.saveFolderReady : text.defaultFolderReady);
    } catch (reason) {
      setError(`${text.saveFolderError} ${String(reason)}`);
    } finally {
      setSaving("");
    }
  };

  const openStorageFolder = async () => {
    setSaving("openStorageFolder");
    setMessage("");
    setError("");
    try {
      if (isNativeRuntime()) {
        await nativeRuntime.openStorageFolder(settings.saveFolder);
        setMessage(text.storageOpened);
      } else {
        setMessage(text.openFolderDesktopOnly);
      }
    } catch (reason) {
      setError(`${text.storageOpenError} ${String(reason)}`);
    } finally {
      setSaving("");
    }
  };

  const removeLocalData = async () => {
    setSaving("removeLocalData");
    setMessage("");
    setError("");
    try {
      if (!isNativeRuntime()) {
        setMessage(text.removeLocalDataDesktopOnly);
        return;
      }
      await nativeRuntime.removeLocalData();
      setMessage(text.removeLocalDataDone);
      setLocalDataConfirmation("");
      onLocalDataRemoved();
    } catch (reason) {
      setError(`${text.removeLocalDataError} ${String(reason)}`);
    } finally {
      setSaving("");
    }
  };

  const updateLocale = (value: string) => {
    setLocale(value as Locale);
    setError("");
    setMessage(copy[value as Locale].preferenceSaved);
  };

  const updateTheme = (value: string) => {
    setTheme(value as ThemeMode);
    setError("");
    setMessage(text.preferenceSaved);
  };

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> {text.loading}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{text.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{text.description}</p>
      </div>

      {(error || message) && (
        <p className={`rounded-lg border px-3 py-2 text-sm ${error ? "border-destructive/30 bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}>
          {error || message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-4 w-4" />{text.appearanceTitle}</CardTitle>
          <CardDescription>{text.appearanceDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <ChoiceGroup
            label={text.language}
            value={locale}
            options={[
              ["en", text.english],
              ["tr", text.turkish],
            ]}
            onChange={updateLocale}
          />
          <ChoiceGroup
            label={text.theme}
            value={theme}
            options={[
              ["system", text.system],
              ["light", text.light],
              ["dark", text.dark],
            ]}
            onChange={updateTheme}
          />
          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:col-span-2">
            <Languages className="h-4 w-4" />
            <span>{text.trayLanguageHint}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Keyboard className="h-4 w-4" />{text.shortcutTitle}</CardTitle>
          <CardDescription>{text.shortcutDescription}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <ShortcutRecorder
            value={shortcutDraft}
            defaultValue={DEFAULT_SHOT_SETTINGS.shortcut}
            disabled={Boolean(saving)}
            recordingLabel={text.recording}
            invalidLabel={text.invalidShortcut}
            resetLabel={text.reset}
            onChange={setShortcutDraft}
          />
          <Button variant="outline" disabled={saving === "shortcut" || shortcutDraft === settings.shortcut} onClick={() => void saveShortcut()}>
            {saving === "shortcut" && <LoaderCircle className="h-4 w-4 animate-spin" />} {text.saveShortcut}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clipboard className="h-4 w-4" />{text.outputTitle}</CardTitle>
          <CardDescription>{text.outputDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ChoiceGroup
            label={text.clipboard}
            value={settings.clipboardMode}
            options={[
              ["image", text.copyImage],
              ["path", text.copyPath],
              ["off", text.off],
            ]}
            onChange={(value) => void persist({ ...settings, clipboardMode: value as ClipboardMode }, "clipboardMode")}
          />
          <ChoiceGroup
            label={text.afterCapture}
            value={settings.postCaptureAction}
            options={[
              ["corner-overlay", text.cornerOverlay],
              ["open-editor", text.openEditor],
              ["save-silently", text.saveSilently],
            ]}
            onChange={(value) => void persist({ ...settings, postCaptureAction: value as PostCaptureAction }, "postCaptureAction")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutPanelTop className="h-4 w-4" />{text.overlayTitle}</CardTitle>
          <CardDescription>{text.overlayDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChoiceGroup
            label={text.position}
            value={settings.overlayCorner}
            options={[
              ["bottom-left", text.bottomLeft],
              ["bottom-right", text.bottomRight],
              ["top-left", text.topLeft],
              ["top-right", text.topRight],
            ]}
            onChange={(value) => void persist({ ...settings, overlayCorner: value as OverlayCorner }, "overlayCorner")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FolderOpen className="h-4 w-4" />{text.storageTitle}</CardTitle>
          <CardDescription>{text.storageDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-medium sm:col-span-2">
            {text.saveFolder}
            <input
              className="h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
              value={settings.saveFolder}
              placeholder={text.saveFolderPlaceholder}
              onChange={(event) => setSettings({ ...settings, saveFolder: event.target.value })}
              onBlur={(event) => void saveFolder(event.currentTarget.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="button" variant="outline" disabled={saving === "saveFolder"} onClick={() => void saveFolder()}>
              {saving === "saveFolder" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {text.validateFolder}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving === "saveFolder"}
              onClick={() => {
                setSettings({ ...settings, saveFolder: "" });
                void saveFolder("");
              }}
            >
              <RotateCcw className="h-4 w-4" /> {text.useDefault}
            </Button>
            <Button type="button" variant="outline" disabled={saving === "openStorageFolder"} onClick={() => void openStorageFolder()}>
              {saving === "openStorageFolder" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />} {text.openFolder}
            </Button>
          </div>
          <NumberField
            icon={Clock3}
            label={text.captureDelay}
            value={settings.captureDelayMs}
            min={0}
            max={10000}
            onChange={(value) => void persist({ ...settings, captureDelayMs: value }, "captureDelayMs")}
          />
          <NumberField
            icon={Image}
            label={text.historyLimit}
            value={settings.historyLimit}
            min={10}
            max={500}
            onChange={(value) => void persist({ ...settings, historyLimit: value }, "historyLimit")}
          />
          <button
            type="button"
            disabled
            className="flex cursor-not-allowed items-start gap-3 rounded-lg border bg-muted/40 p-4 text-left opacity-80 sm:col-span-2"
          >
            <MapPinned className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="block text-sm font-medium">{text.cursorTitle}</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">{text.cursorUnavailable}</span>
              <span className="mt-2 inline-flex rounded-md border bg-background px-2 py-1 text-[11px] font-medium text-muted-foreground">{text.unavailable}</span>
            </span>
          </button>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />{text.advancedTitle}</CardTitle>
          <CardDescription>{text.advancedDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div>
                <p className="text-sm font-medium">{text.removeLocalDataTitle}</p>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{text.removeLocalDataDescription}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block space-y-2 text-sm font-medium">
                {text.removeLocalDataConfirmLabel}
                <input
                  className="h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
                  value={localDataConfirmation}
                  placeholder={text.removeLocalDataConfirmPlaceholder}
                  onChange={(event) => setLocalDataConfirmation(event.target.value)}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                className="border-destructive/40 text-destructive hover:bg-destructive/10"
                disabled={saving === "removeLocalData" || localDataConfirmation !== LOCAL_DATA_CONFIRMATION}
                onClick={() => void removeLocalData()}
              >
                {saving === "removeLocalData" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} {text.removeLocalData}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ChoiceGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([option, text]) => (
          <Button key={option} type="button" size="sm" variant={value === option ? "default" : "outline"} aria-pressed={value === option} onClick={() => onChange(option)}>
            {text}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}

function NumberField({
  icon: Icon,
  label,
  value,
  min,
  max,
  onChange,
}: {
  icon: typeof Save;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  return (
    <label className="block space-y-2 text-sm font-medium">
      <span className="flex items-center gap-2"><Icon className="h-4 w-4" />{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        className="h-10 w-full rounded-md border bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onChange(Math.max(min, Math.min(max, Number(draft) || min)))}
      />
    </label>
  );
}

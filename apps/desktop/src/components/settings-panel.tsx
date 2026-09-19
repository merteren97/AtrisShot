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
import type { ClipboardMode, OverlayCorner, OverlayVisibilityMode, PostCaptureAction, ShotSettings } from "@atris-shot/shot-core";
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
    description: "Control capture, quick preview, storage, and appearance.",
    generalSection: "General",
    captureSection: "Capture",
    previewSection: "Quick preview",
    storageSection: "Storage",
    advancedSection: "Advanced",
    savingStatus: "Saving...",
    savedStatus: "Saved",
    failedStatus: "Could not save",
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
    appearanceDescription: "Choose the interface language and color mode used by the desktop app and system tray.",
    language: "Language",
    english: "English",
    turkish: "Turkish",
    theme: "Theme",
    system: "System",
    light: "Light",
    dark: "Dark",
    trayLanguageHint: "The system tray menu follows this language.",
    shortcutTitle: "Capture shortcut",
    shortcutDescription: "Register the global shortcut that opens full-screen capture.",
    recording: "Recording...",
    invalidShortcut: "Invalid shortcut",
    reset: "Reset",
    saveShortcut: "Save shortcut",
    outputTitle: "Output",
    outputDescription: "Choose what happens immediately after a screenshot is saved.",
    clipboard: "After-capture clipboard",
    clipboardHint: "Choose whether AtrisShot replaces your current clipboard after a capture.",
    copyImage: "Copy image",
    copyPath: "Copy file path",
    off: "Do not change clipboard",
    afterCapture: "After capture",
    cornerOverlay: "Show quick preview",
    openEditor: "Open editor",
    saveSilently: "Save silently",
    overlayTitle: "Quick preview",
    overlayDescription: "Choose how recent captures appear and how the panel can be recalled.",
    overlayVisibility: "Visibility",
    edgeAutoHide: "Collapse to edge",
    alwaysVisible: "Keep open",
    shortcutOnly: "Shortcut only",
    overlayShortcutTitle: "Quick preview shortcut",
    overlayShortcutDescription: "Toggle the recent-captures panel from anywhere.",
    saveOverlayShortcut: "Save preview shortcut",
    position: "Position",
    bottomLeft: "Bottom left",
    bottomRight: "Bottom right",
    topLeft: "Top left",
    topRight: "Top right",
    storageTitle: "Storage",
    storageDescription: "Screenshots are stored locally. Empty folder uses the operating-system app data directory.",
    saveFolder: "Save folder",
    saveFolderPlaceholder: "Default local app data folder",
    chooseFolder: "Choose folder",
    chooseFolderDesktopOnly: "Folder picker is available in the packaged desktop app.",
    validateFolder: "Validate folder",
    useDefault: "Use default",
    openFolder: "Open folder",
    captureDelay: "Capture delay (ms)",
    historyLimit: "History limit",
    cursorTitle: "Cursor capture",
    cursorUnavailable: "Cursor capture is not supported by the current native backend yet.",
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
    description: "Yakalama, hızlı önizleme, depolama ve görünüm tercihlerini yönet.",
    generalSection: "Genel",
    captureSection: "Yakalama",
    previewSection: "Hızlı önizleme",
    storageSection: "Depolama",
    advancedSection: "Gelişmiş",
    savingStatus: "Kaydediliyor...",
    savedStatus: "Kaydedildi",
    failedStatus: "Kaydedilemedi",
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
    appearanceDescription: "Masaüstü uygulaması ve sistem tepsisi için arayüz dilini ve renk modunu seç.",
    language: "Dil",
    english: "İngilizce",
    turkish: "Türkçe",
    theme: "Tema",
    system: "Sistem",
    light: "Açık",
    dark: "Koyu",
    trayLanguageHint: "Sistem tepsisi menüsü bu dili takip eder.",
    shortcutTitle: "Yakalama kısayolu",
    shortcutDescription: "Tam ekran yakalamayı açan genel kısayolu kaydet.",
    recording: "Kaydediliyor...",
    invalidShortcut: "Geçersiz kısayol",
    reset: "Sıfırla",
    saveShortcut: "Kısayolu kaydet",
    outputTitle: "Çıktı",
    outputDescription: "Ekran görüntüsü kaydedildikten hemen sonra ne olacağını seç.",
    clipboard: "Yakalama sonrası pano",
    clipboardHint: "AtrisShot'ın yakalama sonrasında mevcut pano içeriğini değiştirip değiştirmeyeceğini seç.",
    copyImage: "Görüntüyü kopyala",
    copyPath: "Dosya yolunu kopyala",
    off: "Panoyu değiştirme",
    afterCapture: "Yakalama sonrası",
    cornerOverlay: "Hızlı önizlemeyi göster",
    openEditor: "Editörü aç",
    saveSilently: "Sessiz kaydet",
    overlayTitle: "Hızlı önizleme",
    overlayDescription: "Son çekimlerin nasıl görüneceğini ve panelin nasıl geri çağrılacağını seç.",
    overlayVisibility: "Görünürlük",
    edgeAutoHide: "Kenara daralt",
    alwaysVisible: "Açık tut",
    shortcutOnly: "Yalnız kısayolla göster",
    overlayShortcutTitle: "Hızlı önizleme kısayolu",
    overlayShortcutDescription: "Son çekimler panelini her yerden açıp kapat.",
    saveOverlayShortcut: "Önizleme kısayolunu kaydet",
    position: "Konum",
    bottomLeft: "Sol alt",
    bottomRight: "Sağ alt",
    topLeft: "Sol üst",
    topRight: "Sağ üst",
    storageTitle: "Depolama",
    storageDescription: "Ekran görüntüleri yerel olarak saklanır. Boş klasör işletim sisteminin uygulama veri klasörünü kullanır.",
    saveFolder: "Kaydetme klasörü",
    saveFolderPlaceholder: "Varsayılan yerel uygulama veri klasörü",
    chooseFolder: "Klasör seç",
    chooseFolderDesktopOnly: "Klasör seçici paketlenmiş masaüstü uygulamasında kullanılabilir.",
    validateFolder: "Klasörü doğrula",
    useDefault: "Varsayılanı kullan",
    openFolder: "Klasörü aç",
    captureDelay: "Yakalama gecikmesi (ms)",
    historyLimit: "Geçmiş limiti",
    cursorTitle: "İmleç yakalama",
    cursorUnavailable: "Mevcut yerel yakalama altyapısı imleci henüz dahil etmiyor.",
    unavailable: "Kullanılamıyor",
    advancedTitle: "Gelişmiş",
    advancedDescription: "Bu cihazdaki uygulama veri alanında tutulan AtrisShot verilerini kaldır.",
    removeLocalDataTitle: "Yerel verileri kaldır",
    removeLocalDataDescription: "Yerel geçmişi, varsayılan ekran görüntüsü önbelleğini, küçük önizlemeleri, kayıtlı uygulama ayarlarını ve saklanan oturumu siler. Özel kaydetme klasöründeki ekran görüntüleri silinmez.",
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
  const [overlayShortcutDraft, setOverlayShortcutDraft] = useState(DEFAULT_SHOT_SETTINGS.overlayShortcut);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [localDataConfirmation, setLocalDataConfirmation] = useState("");

  useEffect(() => {
    void loadDesktopSettings()
      .then((value) => {
        const next = { ...value, saveFolder: stripWindowsVerbatimPath(value.saveFolder) };
        setSettings(next);
        setShortcutDraft(next.shortcut);
        setOverlayShortcutDraft(next.overlayShortcut);
        onSettingsChanged(next);
      })
      .catch((reason) => setError(String(reason)))
      .finally(() => setLoading(false));
  }, [onSettingsChanged]);

  const persist = async (next: ShotSettings, savingKey: string) => {
    const normalized = { ...next, saveFolder: stripWindowsVerbatimPath(next.saveFolder) };
    setSaving(savingKey);
    setMessage("");
    setError("");
    try {
      await saveDesktopSettings(normalized);
      if (savingKey === "historyLimit" && isNativeRuntime()) {
        await nativeRuntime.pruneShotHistory(normalized.historyLimit);
      }
      setSettings(normalized);
      onSettingsChanged(normalized);
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

  const saveOverlayShortcut = async () => {
    setSaving("overlayShortcut");
    setMessage("");
    setError("");
    try {
      const canonical = isNativeRuntime()
        ? await nativeRuntime.saveOverlayShortcut(overlayShortcutDraft, settings.overlayShortcut)
        : overlayShortcutDraft;
      const next = { ...settings, overlayShortcut: canonical };
      await saveDesktopSettings(next);
      setSettings(next);
      setOverlayShortcutDraft(canonical);
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
      const normalized = stripWindowsVerbatimPath(isNativeRuntime() ? await nativeRuntime.validateSaveFolder(value) : value.trim());
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

  const chooseSaveFolder = async () => {
    setSaving("chooseSaveFolder");
    setMessage("");
    setError("");
    try {
      if (!isNativeRuntime()) {
        setMessage(text.chooseFolderDesktopOnly);
        return;
      }
      const selected = await nativeRuntime.chooseSaveFolder(settings.saveFolder);
      if (!selected) return;
      const normalized = stripWindowsVerbatimPath(await nativeRuntime.validateSaveFolder(selected));
      const next = { ...settings, saveFolder: normalized };
      await saveDesktopSettings(next);
      setSettings(next);
      onSettingsChanged(next);
      setMessage(text.saveFolderReady);
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

  const sections = [
    { id: "settings-general", label: text.generalSection, icon: Palette },
    { id: "settings-capture", label: text.captureSection, icon: Keyboard },
    { id: "settings-preview", label: text.previewSection, icon: LayoutPanelTop },
    { id: "settings-storage", label: text.storageSection, icon: FolderOpen },
    { id: "settings-advanced", label: text.advancedSection, icon: AlertTriangle },
  ];

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{text.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{text.description}</p>
        </div>
        <div className="min-h-7 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground" role="status" aria-live="polite">
          {saving ? text.savingStatus : error ? text.failedStatus : message ? text.savedStatus : "\u00a0"}
        </div>
      </div>

      {error && (
        <p className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
        <nav className="sticky top-4 hidden rounded-xl border bg-card/70 p-2 lg:block" aria-label={text.title}>
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0 space-y-5">
      <Card id="settings-general" className="scroll-mt-4">
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

      <Card id="settings-capture" className="scroll-mt-4">
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
              ["off", text.off],
              ["image", text.copyImage],
              ["path", text.copyPath],
            ]}
            onChange={(value) => void persist({ ...settings, clipboardMode: value as ClipboardMode }, "clipboardMode")}
          />
          <p className="-mt-3 text-xs leading-5 text-muted-foreground">{text.clipboardHint}</p>
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

      <Card id="settings-preview" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutPanelTop className="h-4 w-4" />{text.overlayTitle}</CardTitle>
          <CardDescription>{text.overlayDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ChoiceGroup
            label={text.overlayVisibility}
            value={settings.overlayVisibilityMode}
            options={[
              ["edge-auto-hide", text.edgeAutoHide],
              ["always-visible", text.alwaysVisible],
              ["shortcut-only", text.shortcutOnly],
            ]}
            onChange={(value) => void persist({ ...settings, overlayVisibilityMode: value as OverlayVisibilityMode }, "overlayVisibilityMode")}
          />
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
          <div className="rounded-lg border bg-muted/20 p-3">
            <div className="mb-3">
              <p className="text-sm font-medium">{text.overlayShortcutTitle}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{text.overlayShortcutDescription}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <ShortcutRecorder
                value={overlayShortcutDraft}
                defaultValue={DEFAULT_SHOT_SETTINGS.overlayShortcut}
                disabled={Boolean(saving)}
                recordingLabel={text.recording}
                invalidLabel={text.invalidShortcut}
                resetLabel={text.reset}
                onChange={setOverlayShortcutDraft}
              />
              <Button variant="outline" disabled={saving === "overlayShortcut" || overlayShortcutDraft === settings.overlayShortcut} onClick={() => void saveOverlayShortcut()}>
                {saving === "overlayShortcut" && <LoaderCircle className="h-4 w-4 animate-spin" />} {text.saveOverlayShortcut}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="settings-storage" className="scroll-mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FolderOpen className="h-4 w-4" />{text.storageTitle}</CardTitle>
          <CardDescription>{text.storageDescription}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-medium sm:col-span-2">
            {text.saveFolder}
            <input
              className="h-10 w-full rounded-md border bg-background px-3 font-mono text-xs font-normal outline-none focus:ring-2 focus:ring-ring"
              value={settings.saveFolder}
              placeholder={text.saveFolderPlaceholder}
              onChange={(event) => setSettings({ ...settings, saveFolder: stripWindowsVerbatimPath(event.target.value) })}
              onBlur={(event) => void saveFolder(event.currentTarget.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button type="button" disabled={saving === "chooseSaveFolder"} onClick={() => void chooseSaveFolder()}>
              {saving === "chooseSaveFolder" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />} {text.chooseFolder}
            </Button>
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
            max={1000}
            onChange={(value) => void persist({ ...settings, historyLimit: value }, "historyLimit")}
          />
        </CardContent>
      </Card>

      <Card id="settings-advanced" className="scroll-mt-4 border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />{text.advancedTitle}</CardTitle>
          <CardDescription>{text.advancedDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/25 p-3 text-left">
            <MapPinned className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{text.cursorTitle}</p>
                <span className="rounded-md border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{text.unavailable}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{text.cursorUnavailable}</p>
            </div>
          </div>

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
      </div>
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

function stripWindowsVerbatimPath(value: string) {
  return value.replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/i, "");
}

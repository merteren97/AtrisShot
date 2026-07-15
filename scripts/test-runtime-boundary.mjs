import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function readFirstExisting(...urls) {
  for (const url of urls) {
    try {
      return await readFile(url, "utf8");
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }
  throw new Error(`None of the expected files exist: ${urls.map((url) => url.pathname).join(", ")}`);
}

const rust = await readFile(
  new URL("../apps/desktop/src-tauri/src/lib.rs", import.meta.url),
  "utf8",
);
const authClient = await readFile(
  new URL("../apps/desktop/src/lib/auth-client.ts", import.meta.url),
  "utf8",
);
const nativeAuth = await readFile(
  new URL("../apps/desktop/src-tauri/src/auth.rs", import.meta.url),
  "utf8",
);
const tauriConfig = JSON.parse(
  await readFile(new URL("../apps/desktop/src-tauri/tauri.conf.json", import.meta.url), "utf8"),
);
const tauriCapability = JSON.parse(
  await readFile(new URL("../apps/desktop/src-tauri/capabilities/default.json", import.meta.url), "utf8"),
);

assert.match(rust, /app_data_dir/);
assert.match(rust, /Shot path must stay inside the AtrisShot data directory/);
assert.match(rust, /access\.require_access\(\)\?/);
assert.match(rust, /show_capture_overlay/);
assert.match(rust, /Screen::all/);
assert.match(rust, /read_shot_data_url/);
assert.match(rust, /fn latest_shot/);
assert.match(rust, /latest_shot,/);
assert.match(rust, /focused_window_region/);
assert.match(rust, /virtual_display_bounds/);
assert.match(rust, /window_region_at_point/);
assert.match(rust, /WindowFromPoint/);
assert.match(rust, /fn draw_ellipse/);
assert.match(rust, /"ellipse" => draw_ellipse/);
assert.doesNotMatch(rust, /"rectangle" \| "ellipse" => draw_rect/);
assert.match(rust, /shortcut_from_settings_json/);
assert.match(rust, /shortcut_from_settings_file/);
assert.match(rust, /display_path/);
assert.match(rust, /register_capture_shortcut\(app\.handle\(\), &startup_shortcut\)/);
assert.match(rust, /"shotSettings"/);
assert.match(rust, /tray_by_id\("main-tray"\)/);
assert.match(rust, /if let Err\(error\) = tray\.build\(app\)/);
assert.doesNotMatch(rust, /ok_or\("AtrisShot tray icon is unavailable\."\)/);
assert.match(rust, /AtrisShot'u Aç/);
assert.match(rust, /Ekran Görüntüsü Al/);
assert.match(rust, /Sonucu Göster/);
assert.match(rust, /Çıkış/);
assert.doesNotMatch(rust, /AÃ|GÃ|Ã‡|Ä±|Å/);
assert.doesNotMatch(rust, /microphone|transcribe_audio|model_path|engine_path|127\.0\.0\.1:0/i);
assert.match(authClient, /\/api\/auth\/me/);
assert.match(authClient, /authorizeProductAccess/);
assert.match(authClient, /24 \* 60 \* 60 \* 1000/);
assert.match(authClient, /hasProductAccess/);
assert.doesNotMatch(authClient, /localStorage\.setItem\([^)]*token/i);
assert.doesNotMatch(authClient, /Premium or Admin/);
assert.match(nativeAuth, /keyring::Entry/);
assert.match(nativeAuth, /com\.atrishub\.shot/);
assert.equal(tauriConfig.app.windows.some((window) => window.label === "overlay"), true);
assert.equal(tauriConfig.app.windows.some((window) => window.label === "capture"), true);
assert.equal(tauriConfig.app.windows.some((window) => window.label === "editor" && window.url === "/editor" && window.visible === false), true);
assert.equal(tauriCapability.windows.includes("editor"), true);
assert.equal(tauriCapability.permissions.includes("dialog:allow-open"), true);
assert.match(JSON.stringify(tauriConfig.plugins.updater.endpoints), /shot\.atrishub\.com/);

const publicServer = await readFile(
  new URL("../services/public-server/src/server.ts", import.meta.url),
  "utf8",
);
const releaseProxy = await readFile(new URL("../services/public-server/src/release-proxy.ts", import.meta.url), "utf8");
const releaseProxyTest = await readFile(new URL("../services/public-server/src/test-release-proxy.ts", import.meta.url), "utf8");
const releaseWorkflow = await readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const deployWorkflow = await readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
const validateWorkflow = await readFile(new URL("../.github/workflows/validate.yml", import.meta.url), "utf8");
const workflowSources = [releaseWorkflow, deployWorkflow, validateWorkflow].join("\n");
assert.match(publicServer, /createReleaseRouter/);
assert.match(publicServer, /trust proxy/);
assert.match(releaseProxy, /resolvePublicBaseUrl/);
assert.match(releaseProxy, /x-forwarded-host/);
assert.match(releaseProxyTest, /localhost env must not leak into production updater metadata/);
assert.doesNotMatch(publicServer, /PrismaClient|JWT_SECRET|component|microphone|transcribe/i);
assert.doesNotMatch(workflowSources, /COMPONENT_|component-production|Release AtrisShot Components|R2_|shot-components|voice-components/i);

const landing = await readFile(new URL("../apps/landing/app/page.tsx", import.meta.url), "utf8");
const landingCopy = await readFile(new URL("../apps/landing/lib/landing-copy.ts", import.meta.url), "utf8");
const landingSources = `${landing}\n${landingCopy}`;
assert.match(landing, /\/api\/releases\/download-platform\//);
for (const target of ["windows-x86_64", "linux-x86_64"]) {
  assert.match(landing, new RegExp(target));
}
assert.match(landingCopy, /macOS packages will return|macOS paketi/);
assert.match(landingSources, /Focused capture|Odaklı yakalama/);
assert.doesNotMatch(landingSources, /Select display|Click a display|select a full display/i);
assert.doesNotMatch(landingSources, /\/api\/auth|nativeRuntime/i);

const nativeRuntime = await readFile(
  new URL("../apps/desktop/src/lib/native-runtime.ts", import.meta.url),
  "utf8",
);
const uiPreferences = await readFile(
  new URL("../apps/desktop/src/lib/ui-preferences.tsx", import.meta.url),
  "utf8",
);
const workspace = await readFile(
  new URL("../apps/desktop/src/components/shot-workspace.tsx", import.meta.url),
  "utf8",
);
const captureOverlay = await readFile(
  new URL("../apps/desktop/src/app/capture-overlay/page.tsx", import.meta.url),
  "utf8",
);
const resultOverlay = await readFile(
  new URL("../apps/desktop/src/app/overlay/page.tsx", import.meta.url),
  "utf8",
);
const editorPage = await readFile(
  new URL("../apps/desktop/src/app/editor/page.tsx", import.meta.url),
  "utf8",
);
const editorWindow = await readFile(
  new URL("../apps/desktop/src/components/shot-editor-window.tsx", import.meta.url),
  "utf8",
);
const settingsPanel = await readFile(
  new URL("../apps/desktop/src/components/settings-panel.tsx", import.meta.url),
  "utf8",
);
assert.match(nativeRuntime, /readShotDataUrl/);
assert.match(nativeRuntime, /latestShot/);
assert.match(nativeRuntime, /focusedWindowRegion/);
assert.match(nativeRuntime, /windowRegionAtPoint/);
assert.match(nativeRuntime, /openEditorWindow/);
assert.match(nativeRuntime, /open_editor_window/);
assert.match(nativeRuntime, /hideEditorWindow/);
assert.match(nativeRuntime, /hide_editor_window/);
assert.match(nativeRuntime, /onEditorShotRequested/);
assert.match(nativeRuntime, /editor-shot-requested/);
assert.match(nativeRuntime, /onCaptureOverlayOpened/);
assert.match(nativeRuntime, /capture-overlay-opened/);
assert.match(nativeRuntime, /onResultOverlayOpened/);
assert.match(nativeRuntime, /result-overlay-opened/);
assert.match(nativeRuntime, /chooseSaveFolder/);
assert.match(nativeRuntime, /@tauri-apps\/plugin-dialog/);
assert.doesNotMatch(nativeRuntime, /convertFileSrc|fileUrl/);
assert.match(workspace, /readShotDataUrl/);
assert.match(workspace, /HistoryWorkspace/);
assert.match(workspace, /Selected screenshot/);
assert.match(workspace, /selectedEntryIds/);
assert.match(workspace, /onDeleteSelected/);
assert.match(workspace, /deleteSelectedHistoryEntries/);
assert.match(workspace, /grid-cols-\[300px_1fr\]/);
assert.match(workspace, /aspect-video w-full/);
assert.match(workspace, /screen: "Screen"/);
assert.match(workspace, /screenPrefix/);
assert.doesNotMatch(workspace, /<Badge className="rounded-full px-2 text-\[10px\]">\{modeLabel\(entry\.mode, text\)\}<\/Badge>/);
assert.doesNotMatch(workspace, /onClear=\{\(\) => void clearHistoryEntries\(\)\}/);
assert.doesNotMatch(workspace, /Open capture overlay|settings\.shortcut\.replaceAll/);
assert.match(workspace, /formatShotDate/);
assert.match(workspace, /Date unavailable/);
assert.match(workspace, /cleanDisplayName/);
assert.match(workspace, /pathParts/);
assert.match(workspace, /modeLabel/);
assert.match(workspace, /openEditorWindow\(entry\.id\)/);
assert.doesNotMatch(workspace, /section: "editor"/);
assert.doesNotMatch(workspace, /setActiveSection\("editor"\)/);
assert.doesNotMatch(workspace, /function CapturePanel|function EditorPanel/);
assert.doesNotMatch(workspace, /Capture display|Display layout|click a display/);
assert.match(resultOverlay, /readShotDataUrl/);
assert.match(resultOverlay, /previewUrl/);
assert.match(resultOverlay, /nativeRuntime\.latestShot\(\)/);
assert.match(resultOverlay, /onResultOverlayOpened/);
assert.match(resultOverlay, /openEditorWindow\(entry\.id\)/);
assert.doesNotMatch(resultOverlay, /emitEditShotRequested|openMainWindow/);
assert.match(resultOverlay, /data-path-drag/);
assert.match(resultOverlay, /dataTransfer\.setData\("text\/plain", displayPath\)/);
assert.match(resultOverlay, /closest\("button,\[data-path-drag\]"\)/);
assert.match(captureOverlay, /windowRegionAtPoint/);
assert.match(captureOverlay, /windowRegionAtPoint\(current\.x, current\.y\)/);
assert.match(captureOverlay, /nativeRuntime\.listDisplays\(\)/);
assert.match(captureOverlay, /displayForRegion/);
assert.match(captureOverlay, /displayForPoint/);
assert.match(captureOverlay, /clampRegionToVirtualBounds/);
assert.match(captureOverlay, /resolveFreshWindowRegion/);
assert.match(captureOverlay, /sameRegion/);
assert.match(captureOverlay, /onCaptureOverlayOpened/);
assert.match(captureOverlay, /hideCaptureOverlay/);
assert.match(captureOverlay, /showCaptureOverlay/);
assert.match(captureOverlay, /lockedRegion/);
assert.match(captureOverlay, /event\.key === "Enter"/);
assert.match(captureOverlay, /Move over a window, click to select it, press Enter to save, or drag a region/);
assert.doesNotMatch(captureOverlay, /setHoverRegion\(region\);\s*setHoverTouched\(false\)|focusedWindowRegion/);
assert.doesNotMatch(captureOverlay, /Click to capture focused window|Click to capture this screen/);
assert.match(uiPreferences, /function syncTrayLocale/);
assert.match(uiPreferences, /setTrayLocale\(locale\)\.catch\(\(\) => undefined\)/);
assert.match(uiPreferences, /Atris oturumu doğrulanıyor/);
assert.match(uiPreferences, /Atris hesabınla giriş yap/);
assert.match(uiPreferences, /Güncellemeyi kur/);
assert.doesNotMatch(uiPreferences, /Ã|Ä|Å|Â|�/);
assert.match(settingsPanel, /Türkçe/);
assert.match(settingsPanel, /Görünüm ve dil/);
assert.match(settingsPanel, /Kaydetme klasörü/);
assert.match(settingsPanel, /chooseSaveFolder/);
assert.match(settingsPanel, /Klasör seç/);
assert.doesNotMatch(settingsPanel, /Ã|Ä|Å|Â|�/);

assert.match(editorPage, /ShotEditorWindow/);
assert.match(editorWindow, /ToolRail/);
assert.match(editorWindow, /ContextToolbar/);
assert.match(editorWindow, /data-editor-inline-text/);
assert.match(editorWindow, /normalizeAnnotations/);
assert.match(editorWindow, /cloneAnnotations/);
assert.match(editorWindow, /undoStack/);
assert.match(editorWindow, /event\.key\.toLowerCase\(\) === "z"/);
assert.match(editorWindow, /event\.key === "Enter"/);
assert.match(editorWindow, /event\.key === "Delete"/);
assert.match(editorWindow, /"resize-start"/);
assert.match(editorWindow, /resizeTextAnnotation/);
assert.match(editorWindow, /distanceToSegment/);
assert.match(editorWindow, /data-editor-hit/);
assert.match(editorWindow, /type EditorTool = "select"/);
assert.match(editorWindow, /useState<EditorTool>\("select"\)/);
assert.match(editorWindow, /MIN_DRAW_DISTANCE/);
assert.match(editorWindow, /pendingDraw/);
assert.match(editorWindow, /annotationsDirty/);
assert.match(editorWindow, /entryLoadToken/);
assert.match(editorWindow, /onDoubleClick=\{isText \? onTextEdit : undefined\}/);
assert.match(editorWindow, /resizeTextBounds/);
assert.match(editorWindow, /setAnnotations\(next\?\.annotations \?\? \[\]\)/);
assert.match(editorWindow, /Pixel size/);
assert.match(editorWindow, /backgroundSize/);
assert.match(editorWindow, /backdropFilter/);
assert.doesNotMatch(editorWindow, /border-2 bg-background\/15/);
assert.doesNotMatch(editorWindow, /isText \? annotation\.text \|\| "Text" : annotation\.tool/);
assert.match(editorWindow, /showOverlay/);
assert.match(editorWindow, /hideEditorWindow/);
assert.match(editorWindow, /readShotDataUrl/);
assert.match(editorWindow, /onEditorShotRequested/);
assert.match(editorWindow, /Click canvas to write/);
assert.match(editorWindow, /formatPathForDisplay/);
assert.match(rust, /fn open_editor_window/);
assert.match(rust, /fn hide_editor_window/);
assert.match(rust, /center_window/);
assert.match(rust, /editor-shot-requested/);
assert.match(rust, /capture-overlay-opened/);
assert.match(rust, /set_focus_target\(None\)/);
assert.match(rust, /virtual_display_bounds\(&display_list\)/);
assert.match(rust, /point_is_inside_rect/);
assert.match(rust, /is_current_process_window/);
assert.match(rust, /hide_internal_windows_for_capture/);
assert.match(rust, /restore_internal_windows_after_capture/);
assert.match(rust, /result-overlay-opened/);
assert.match(rust, /"open-editor" => open_editor_window/);
assert.match(rust, /tauri_plugin_dialog::init/);
assert.match(rust, /tauri_plugin_single_instance::init/);
assert.ok(
  rust.indexOf("tauri_plugin_single_instance::init") <
    rust.indexOf("tauri_plugin_clipboard_manager::init"),
  "single-instance plugin must be registered before other plugins",
);
assert.match(rust, /window\.unminimize\(\)/);
assert.match(rust, /window\.show\(\)/);
assert.match(rust, /window\.set_focus\(\)/);
assert.match(rust, /window\.label\(\), "main" \| "editor"/);
assert.doesNotMatch(rust, /unwrap_or\("NOTE"\)/);
assert.match(rust, /pixelate_region\([\s\S]*annotation\.blur_pixel_size\.unwrap_or\(stroke_width\)/);
assert.match(rust, /annotations: Vec<ShotAnnotation>/);
assert.match(rust, /#\[serde\(default\)\][\s\S]*annotations: Vec<ShotAnnotation>/);
assert.match(rust, /entry\.annotations = annotations/);
assert.match(rust, /edit_revision = entry\.edit_revision\.saturating_add\(1\)/);
assert.match(rust, /blur_pixel_size: Option<u32>/);
assert.match(editorWindow, /editRevision/);
assert.match(editorWindow, /originalPath/);
assert.match(editorWindow, /spacePressed/);
assert.match(editorWindow, /translateAnnotation/);
assert.match(editorWindow, /selectedAnnotationIdRef/);
assert.match(editorWindow, /editInteractionRef/);
assert.match(editorWindow, /pendingDrawRef/);
assert.match(editorWindow, /drawingIdRef/);
assert.match(editorWindow, /data-editor-id/);
assert.match(editorWindow, /event\.detail > 1/);
assert.match(editorWindow, /onLostPointerCapture/);
assert.match(editorWindow, /displayScale/);
assert.match(rust, /stroke_width\.clamp\(4, 48\)/);
assert.match(rust, /shape_stroke_width_changes_rendered_pixels/);
assert.match(rust, /blur_pixel_size_changes_rendered_pixels/);
assert.match(rust, /max_line_width/);
assert.match(rust, /remove_history_entry_files/);
assert.match(rust, /history_entry_file_cleanup_removes_original_edited_and_thumbnail/);

const desktopTheme = await readFile(new URL("../apps/desktop/src/app/globals.css", import.meta.url), "utf8");
const landingTheme = await readFile(new URL("../apps/landing/app/globals.css", import.meta.url), "utf8");
const desktopLayout = await readFile(new URL("../apps/desktop/src/app/layout.tsx", import.meta.url), "utf8");
const landingLayout = await readFile(new URL("../apps/landing/app/layout.tsx", import.meta.url), "utf8");
const desktopManifest = await readFile(new URL("../apps/desktop/public/manifest.webmanifest", import.meta.url), "utf8");
const landingManifest = await readFile(new URL("../apps/landing/public/manifest.webmanifest", import.meta.url), "utf8");
const publicManifest = await readFirstExisting(
  new URL("../services/public-server/public/manifest.webmanifest", import.meta.url),
  new URL("../apps/landing/public/manifest.webmanifest", import.meta.url),
);
const themeSources = [
  desktopTheme,
  landingTheme,
  desktopLayout,
  landingLayout,
  desktopManifest,
  landingManifest,
  publicManifest,
].join("\n");

assert.match(desktopTheme, /--primary:\s*oklch\(0\.74 0\.15 75\)/);
assert.match(desktopTheme, /--accent:\s*oklch\(0\.33 0\.065 161\)/);
assert.match(landingTheme, /--primary:\s*oklch\(0\.74 0\.15 75\)/);
assert.match(landingTheme, /--accent:\s*oklch\(0\.33 0\.065 161\)/);
assert.match(themeSources, /themeColor:\s*"#121916"/);
assert.match(desktopManifest, /"theme_color": "#121916"/);
assert.match(landingManifest, /"theme_color": "#121916"/);
assert.match(publicManifest, /"theme_color": "#121916"/);
assert.doesNotMatch(themeSources, /#090C13|0\.72 0\.16 232|0\.68 0\.16 250|0\.52 0\.18 250|0\.67 0\.17 235/);

console.log("AtrisShot desktop/public runtime boundary checks passed.");

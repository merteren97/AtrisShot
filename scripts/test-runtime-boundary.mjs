import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

assert.match(rust, /app_data_dir/);
assert.match(rust, /Shot path must stay inside the AtrisShot data directory/);
assert.match(rust, /access\.require_access\(\)\?/);
assert.match(rust, /show_capture_overlay/);
assert.match(rust, /Screen::all/);
assert.match(rust, /read_shot_data_url/);
assert.match(rust, /fn latest_shot/);
assert.match(rust, /latest_shot,/);
assert.match(rust, /focused_window_region/);
assert.match(rust, /foreground_window_region/);
assert.match(rust, /window_region_at_point/);
assert.match(rust, /WindowFromPoint/);
assert.match(rust, /fn draw_ellipse/);
assert.match(rust, /"ellipse" => draw_ellipse/);
assert.doesNotMatch(rust, /"rectangle" \| "ellipse" => draw_rect/);
assert.match(rust, /shortcut_from_settings_json/);
assert.match(rust, /shortcut_from_settings_file/);
assert.match(rust, /register_capture_shortcut\(app\.handle\(\), &startup_shortcut\)/);
assert.match(rust, /"shotSettings"/);
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
assert.match(JSON.stringify(tauriConfig.plugins.updater.endpoints), /shot\.atrishub\.com/);

const publicServer = await readFile(
  new URL("../services/public-server/src/server.ts", import.meta.url),
  "utf8",
);
const releaseWorkflow = await readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const deployWorkflow = await readFile(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");
const validateWorkflow = await readFile(new URL("../.github/workflows/validate.yml", import.meta.url), "utf8");
const workflowSources = [releaseWorkflow, deployWorkflow, validateWorkflow].join("\n");
assert.match(publicServer, /createReleaseRouter/);
assert.doesNotMatch(publicServer, /PrismaClient|JWT_SECRET|component|microphone|transcribe/i);
assert.doesNotMatch(workflowSources, /COMPONENT_|component-production|Release AtrisShot Components|R2_|shot-components|voice-components/i);

const landing = await readFile(new URL("../apps/landing/app/page.tsx", import.meta.url), "utf8");
assert.match(landing, /\/api\/releases\/download-platform\//);
for (const target of ["windows-x86_64", "linux-x86_64", "darwin-x86_64", "darwin-aarch64"]) {
  assert.match(landing, new RegExp(target));
}
assert.match(landing, /Focused capture/);
assert.doesNotMatch(landing, /Select display|Click a display|select a full display/i);
assert.doesNotMatch(landing, /\/api\/auth|nativeRuntime|membership/i);

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
const settingsPanel = await readFile(
  new URL("../apps/desktop/src/components/settings-panel.tsx", import.meta.url),
  "utf8",
);
assert.match(nativeRuntime, /readShotDataUrl/);
assert.match(nativeRuntime, /latestShot/);
assert.match(nativeRuntime, /focusedWindowRegion/);
assert.match(nativeRuntime, /windowRegionAtPoint/);
assert.doesNotMatch(nativeRuntime, /convertFileSrc|fileUrl/);
assert.match(workspace, /readShotDataUrl/);
assert.match(workspace, /Capture current screen/);
assert.match(workspace, /Focused capture/);
assert.match(workspace, /\["ellipse", Circle, "Ellipse"\]/);
assert.match(workspace, /\["line", Minus, "Line"\]/);
assert.doesNotMatch(workspace, /Capture display|Display layout|click a display/);
assert.match(resultOverlay, /readShotDataUrl/);
assert.match(resultOverlay, /nativeRuntime\.latestShot\(\)/);
assert.match(resultOverlay, /data-path-drag/);
assert.match(resultOverlay, /dataTransfer\.setData\("text\/plain", shotPath\)/);
assert.match(resultOverlay, /closest\("button,\[data-path-drag\]"\)/);
assert.match(captureOverlay, /focusedWindowRegion/);
assert.match(captureOverlay, /windowRegionAtPoint/);
assert.match(captureOverlay, /hideCaptureOverlay/);
assert.match(captureOverlay, /showCaptureOverlay/);
assert.match(captureOverlay, /Focused window/);
assert.match(uiPreferences, /Atris oturumu doğrulanıyor/);
assert.match(uiPreferences, /Atris hesabınla giriş yap/);
assert.match(uiPreferences, /Güncellemeyi kur/);
assert.doesNotMatch(uiPreferences, /Ã|Ä|Å|Â|�/);
assert.match(settingsPanel, /Türkçe/);
assert.match(settingsPanel, /Görünüm ve dil/);
assert.match(settingsPanel, /Kaydetme klasörü/);
assert.doesNotMatch(settingsPanel, /Ã|Ä|Å|Â|�/);

const desktopTheme = await readFile(new URL("../apps/desktop/src/app/globals.css", import.meta.url), "utf8");
const landingTheme = await readFile(new URL("../apps/landing/app/globals.css", import.meta.url), "utf8");
const desktopLayout = await readFile(new URL("../apps/desktop/src/app/layout.tsx", import.meta.url), "utf8");
const landingLayout = await readFile(new URL("../apps/landing/app/layout.tsx", import.meta.url), "utf8");
const desktopManifest = await readFile(new URL("../apps/desktop/public/manifest.webmanifest", import.meta.url), "utf8");
const landingManifest = await readFile(new URL("../apps/landing/public/manifest.webmanifest", import.meta.url), "utf8");
const publicManifest = await readFile(
  new URL("../services/public-server/public/manifest.webmanifest", import.meta.url),
  "utf8",
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

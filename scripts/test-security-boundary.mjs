import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const exists = async (path) => access(new URL(`../${path}`, import.meta.url)).then(() => true).catch(() => false);

const [
  sessionStore,
  nativeAuth,
  tauriConfigText,
  releaseProxy,
  publicServer,
  validateWorkflow,
  releaseWorkflow,
  gitignore,
  envExample,
  tauriBuild,
  defaultCapabilityText,
  mainUiCapabilityText,
  updaterCapabilityText,
  overlayDragCapabilityText,
  mainCommandsCapabilityText,
  captureCommandsCapabilityText,
  overlayCommandsCapabilityText,
  editorCommandsCapabilityText,
] = await Promise.all([
  read("apps/desktop/src-tauri/src/session_store.rs"),
  read("apps/desktop/src-tauri/src/auth.rs"),
  read("apps/desktop/src-tauri/tauri.conf.json"),
  read("services/public-server/src/release-proxy.ts"),
  read("services/public-server/src/server.ts"),
  read(".github/workflows/validate.yml"),
  read(".github/workflows/release.yml"),
  read(".gitignore"),
  read(".env.example"),
  read("apps/desktop/src-tauri/build.rs"),
  read("apps/desktop/src-tauri/capabilities/default.json"),
  read("apps/desktop/src-tauri/capabilities/main-ui.json"),
  read("apps/desktop/src-tauri/capabilities/updater.json"),
  read("apps/desktop/src-tauri/capabilities/overlay-drag.json"),
  read("apps/desktop/src-tauri/capabilities/main-commands.json"),
  read("apps/desktop/src-tauri/capabilities/capture-commands.json"),
  read("apps/desktop/src-tauri/capabilities/overlay-commands.json"),
  read("apps/desktop/src-tauri/capabilities/editor-commands.json"),
]);

const tauriConfig = JSON.parse(tauriConfigText);
const defaultCapability = JSON.parse(defaultCapabilityText);
const mainUiCapability = JSON.parse(mainUiCapabilityText);
const updaterCapability = JSON.parse(updaterCapabilityText);
const overlayDragCapability = JSON.parse(overlayDragCapabilityText);
const mainCommandsCapability = JSON.parse(mainCommandsCapabilityText);
const captureCommandsCapability = JSON.parse(captureCommandsCapabilityText);
const overlayCommandsCapability = JSON.parse(overlayCommandsCapabilityText);
const editorCommandsCapability = JSON.parse(editorCommandsCapabilityText);

// Session credentials must never fall back to plaintext storage on non-Windows.
assert.match(sessionStore, /#\[cfg\(not\(windows\)\)\][\s\S]*keyring::Entry/);
assert.match(sessionStore, /set_password\(token\)/);
assert.match(sessionStore, /remove_legacy_file\(app\)/);
assert.doesNotMatch(sessionStore, /#\[cfg\(not\(windows\)\)\][^\n]*\n\s*let bytes = token\.as_bytes\(\)\.to_vec\(\)/);
assert.doesNotMatch(nativeAuth, /localStorage|fs::write|token\.as_bytes\(\)\.to_vec\(\)/);

// Tauri production frontend must run with a real CSP; dev-only allowances stay isolated.
assert.ok(tauriConfig.app.security.csp, "production Tauri CSP must be enabled");
assert.equal(tauriConfig.app.security.csp["object-src"], "'none'");
assert.equal(tauriConfig.app.security.csp["base-uri"], "'none'");
assert.match(tauriConfig.app.security.csp["connect-src"], /https:\/\/atrishub\.com/);
assert.doesNotMatch(
  tauriConfig.app.security.csp["connect-src"],
  /http:\/\/localhost(?::|\/)|https:\/\/localhost(?::|\/)|127\.0\.0\.1|ws:/,
);
assert.match(tauriConfig.app.security.devCsp["connect-src"], /http:\/\/127\.0\.0\.1:3000/);
assert.match(tauriConfig.app.security.devCsp["connect-src"], /ws:\/\/localhost:3009/);

// Tauri capabilities must stay least-privilege and window-scoped.
assert.deepEqual(defaultCapability.windows, ["main", "overlay", "capture", "editor"]);
assert.ok(!defaultCapability.permissions.includes("core:default"), "broad core:default must stay disabled");
for (const forbidden of [
  "dialog:allow-open",
  "dialog:allow-ask",
  "clipboard-manager:allow-write-text",
  "updater:default",
  "drag:allow-start-drag",
]) {
  assert.ok(!defaultCapability.permissions.includes(forbidden), `${forbidden} must not be shared by every window`);
}
assert.deepEqual(mainUiCapability.windows, ["main"]);
assert.ok(mainUiCapability.permissions.includes("dialog:allow-open"));
assert.ok(mainUiCapability.permissions.includes("dialog:allow-ask"));
assert.ok(mainUiCapability.permissions.includes("clipboard-manager:allow-write-text"));
assert.deepEqual(updaterCapability.windows, ["main", "editor"]);
assert.deepEqual(overlayDragCapability.windows, ["overlay"]);
assert.deepEqual(overlayDragCapability.permissions.sort(), [
  "core:window:allow-start-dragging",
  "drag:allow-start-drag",
].sort());

// Custom application commands must participate in Tauri's ACL manifest.
assert.match(tauriBuild, /AppManifest::new\(\)\.commands\(APP_COMMANDS\)/);
assert.match(tauriBuild, /"read_shot_data_url"/);
assert.match(tauriBuild, /"store_session_token"/);
assert.deepEqual(mainCommandsCapability.windows, ["main"]);
assert.deepEqual(captureCommandsCapability.windows, ["capture"]);
assert.deepEqual(overlayCommandsCapability.windows, ["overlay"]);
assert.deepEqual(editorCommandsCapability.windows, ["editor"]);

const forbiddenOutsideMain = [
  "allow-store-session-token",
  "allow-read-session-token",
  "allow-delete-session-token",
  "allow-remove-local-data",
  "allow-validate-save-folder",
  "allow-open-storage-folder",
  "allow-reveal-shot",
  "allow-copy-shot-path",
  "allow-delete-shot",
  "allow-delete-shots",
  "allow-clear-shot-history",
];
for (const capability of [captureCommandsCapability, overlayCommandsCapability, editorCommandsCapability]) {
  for (const forbidden of forbiddenOutsideMain) {
    assert.ok(!capability.permissions.includes(forbidden), `${forbidden} must stay main-window-only`);
  }
}
for (const forbidden of [
  "allow-read-shot-data-url",
  "allow-path-exists",
  "allow-list-shot-history",
  "allow-copy-shot-image",
  "allow-apply-annotations",
]) {
  assert.ok(!captureCommandsCapability.permissions.includes(forbidden), `${forbidden} must not be exposed to capture overlay`);
}

// Updater metadata must only use a configured or fixed trusted origin in production.
assert.match(releaseProxy, /normalizeBaseUrl/);
assert.match(releaseProxy, /DEFAULT_PRODUCTION_PUBLIC_BASE_URL = "https:\/\/shot\.atrishub\.com"/);
assert.match(releaseProxy, /isLoopbackBaseUrl\(trimmed\)\) return DEFAULT_PRODUCTION_PUBLIC_BASE_URL/);
assert.match(releaseProxy, /releaseProxyReady/);
assert.doesNotMatch(releaseProxy, /request\.get\("x-forwarded-host"\)/i);
assert.doesNotMatch(releaseProxy, /request\.get\("x-forwarded-proto"\)/i);
assert.match(releaseProxy, /release\?\.assets\?\.some\(\(asset\) => asset\.id === assetId\)/);
assert.match(publicServer, /app\.set\("trust proxy", "loopback"\)/);
assert.match(publicServer, /releaseProxyReady\(\)/);

// Production infrastructure and deployment details belong to the private AtrisHub operations repository.
for (const privateOpsPath of [
  ".github/workflows/deploy.yml",
  "ecosystem.config.cjs",
  "infra/nginx/shot.atrishub.com.conf",
]) {
  assert.equal(
    await exists(privateOpsPath),
    false,
    `${privateOpsPath} must not be tracked in the public AtrisShot repository`,
  );
}

// PR validation and release publishing follow least-privilege defaults.
assert.match(validateWorkflow, /pull_request:[\s\S]*branches:\s*\[main\]/);
assert.match(validateWorkflow, /permissions:\s*\n\s*contents:\s*read/);
assert.match(validateWorkflow, /cargo test --manifest-path apps\/desktop\/src-tauri\/Cargo\.toml/);
assert.match(releaseWorkflow, /permissions:\s*\n\s*contents:\s*read/);
assert.match(releaseWorkflow, /publish:[\s\S]*permissions:\s*\n\s*contents:\s*write/);
assert.match(releaseWorkflow, /github\.actor == 'merteren97'/);
assert.match(releaseWorkflow, /github\.triggering_actor == 'merteren97'/);
assert.match(releaseWorkflow, /github\.ref == 'refs\/heads\/main'/);
assert.equal(
  await exists(".github/workflows/release-windows-self-hosted.yml"),
  false,
  "public-source repository must not retain a permanent self-hosted release workflow",
);

const workflowDirectory = new URL("../.github/workflows/", import.meta.url);
const workflowFiles = (await readdir(workflowDirectory)).filter((name) => /\.ya?ml$/i.test(name));
for (const file of workflowFiles) {
  const workflow = await read(`.github/workflows/${file}`);
  assert.doesNotMatch(workflow, /runs-on:[^\n]*self-hosted/i, `${file} must not target a self-hosted runner`);
  for (const match of workflow.matchAll(/\buses:\s*([^\s#]+)(?:\s*#.*)?$/gm)) {
    const action = match[1];
    assert.match(action, /@[0-9a-f]{40}$/i, `${file} contains an unpinned action: ${action}`);
  }
}

// Public-source hygiene: secrets and local user data remain excluded.
for (const pattern of [/\.env\.\*/, /\*\.pem/, /\*\.p12/, /\*\.pfx/, /screenshots\//, /app-data\//]) {
  assert.match(gitignore, pattern);
}
assert.match(envExample, /Production must set the canonical HTTPS/);
assert.match(envExample, /SHOT_RELEASE_REPO_ACCESS_TOKEN=""/);

console.log("AtrisShot security boundary checks passed.");

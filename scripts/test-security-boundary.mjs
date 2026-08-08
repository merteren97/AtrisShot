import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  sessionStore,
  nativeAuth,
  tauriConfigText,
  releaseProxy,
  publicServer,
  nginx,
  validateWorkflow,
  releaseWorkflow,
  gitignore,
  envExample,
] = await Promise.all([
  read("apps/desktop/src-tauri/src/session_store.rs"),
  read("apps/desktop/src-tauri/src/auth.rs"),
  read("apps/desktop/src-tauri/tauri.conf.json"),
  read("services/public-server/src/release-proxy.ts"),
  read("services/public-server/src/server.ts"),
  read("infra/nginx/shot.atrishub.com.conf"),
  read(".github/workflows/validate.yml"),
  read(".github/workflows/release.yml"),
  read(".gitignore"),
  read(".env.example"),
]);

const tauriConfig = JSON.parse(tauriConfigText);

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
assert.match(nginx, /proxy_set_header Host shot\.atrishub\.com;/);
assert.match(nginx, /proxy_set_header X-Forwarded-Host "";/);
assert.match(nginx, /proxy_set_header X-Forwarded-Proto https;/);

// PR validation and release publishing follow least-privilege defaults.
assert.match(validateWorkflow, /pull_request:[\s\S]*branches:\s*\[main\]/);
assert.match(validateWorkflow, /permissions:\s*\n\s*contents:\s*read/);
assert.match(validateWorkflow, /cargo test --manifest-path apps\/desktop\/src-tauri\/Cargo\.toml/);
assert.match(releaseWorkflow, /permissions:\s*\n\s*contents:\s*read/);
assert.match(releaseWorkflow, /publish:[\s\S]*permissions:\s*\n\s*contents:\s*write/);

// Public-source hygiene: secrets and local user data remain excluded.
for (const pattern of [/\.env\.\*/, /\*\.pem/, /\*\.p12/, /\*\.pfx/, /screenshots\//, /app-data\//]) {
  assert.match(gitignore, pattern);
}
assert.match(envExample, /Production must set the canonical HTTPS/);
assert.match(envExample, /SHOT_RELEASE_REPO_ACCESS_TOKEN=""/);

console.log("AtrisShot security boundary checks passed.");

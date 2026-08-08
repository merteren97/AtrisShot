import assert from "node:assert/strict";
import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const packageJson = JSON.parse(read("package.json"));
const releaseScript = read("scripts/release-windows.mjs");
const hostedWorkflow = read(".github/workflows/release.yml");
const versionScript = read(".github/scripts/apply-release-version.mjs");

assert.equal(packageJson.scripts["release:windows"], "node scripts/release-windows.mjs");
assert.equal(
  fs.existsSync(".github/workflows/release-windows-self-hosted.yml"),
  false,
  "persistent self-hosted release workflow must remain removed from public source",
);
assert.match(releaseScript, /TAURI_SIGNING_PRIVATE_KEY/);
assert.match(releaseScript, /TAURI_CONFIG/);
assert.match(releaseScript, /const tauriCli/);
assert.match(releaseScript, /--config/);
assert.match(releaseScript, /TAURI_UPDATER_PUBLIC_KEY/);
assert.match(releaseScript, /assertLocalTagPointsToHead/);
assert.match(releaseScript, /merge-base/);
assert.match(releaseScript, /--verify-tag/);
assert.match(releaseScript, /--draft=false/);
assert.match(releaseScript, /CARGO_TARGET_DIR/);
assert.match(releaseScript, /path\.basename\(filePath\)\.includes\(version\)/);
assert.match(hostedWorkflow, /workflow_dispatch:/);
assert.match(hostedWorkflow, /github\.actor == 'merteren97'/);
assert.match(hostedWorkflow, /github\.triggering_actor == 'merteren97'/);
assert.match(hostedWorkflow, /uses: Swatinem\/rust-cache@[0-9a-f]{40}\s+# v2/);
assert.match(hostedWorkflow, /npm run tauri:build -w @atris-shot\/desktop/);
assert.match(hostedWorkflow, /compression-level: 0/);
assert.match(hostedWorkflow, /gh release upload \"\$RELEASE_TAG\" \"\$\{RELEASE_ASSETS\[@\]\}/);
assert.doesNotMatch(hostedWorkflow, /xargs -0 -n1 gh release upload/);
assert.match(versionScript, /lock\.packages/);
assert.match(versionScript, /atris-shot/);

console.log("AtrisShot Windows release checks passed.");

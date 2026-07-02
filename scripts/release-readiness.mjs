import fs from "node:fs";

const strict = process.argv.includes("--strict");
const read = (file) => fs.readFileSync(file, "utf8");
const json = (file) => JSON.parse(read(file));
const blockers = [];

const countPendingBetaCells = (markdown) =>
  markdown
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("|") && !line.includes("---"))
    .slice(1)
    .flatMap((line) => line.split("|").slice(2, -1).map((cell) => cell.trim().toLowerCase()))
    .filter((cell) => cell === "pending")
    .length;

const requiredWorkflowTargets = [
  { releaseTarget: "windows-x86_64", rustTarget: "x86_64-pc-windows-msvc" },
  { releaseTarget: "linux-x86_64", rustTarget: "x86_64-unknown-linux-gnu" },
  { releaseTarget: "darwin-x86_64", rustTarget: "x86_64-apple-darwin" },
  { releaseTarget: "darwin-aarch64", rustTarget: "aarch64-apple-darwin" },
];

const rootVersion = json("package.json").version;
const desktopVersion = json("apps/desktop/package.json").version;
const tauri = json("apps/desktop/src-tauri/tauri.conf.json");
const readiness = json("release/readiness.json");
const betaMatrixPath = "docs/beta-test-matrix.md";
const pendingBetaCells = countPendingBetaCells(read(betaMatrixPath));
const releaseWorkflow = read(".github/workflows/release.yml");
const workflowSources = [releaseWorkflow, read(".github/workflows/deploy.yml"), read(".github/workflows/validate.yml")].join("\n");
const cargoVersion = read("apps/desktop/src-tauri/Cargo.toml").match(/^version\s*=\s*"([^"]+)"/m)?.[1];

if (new Set([rootVersion, desktopVersion, tauri.version, cargoVersion]).size !== 1) {
  blockers.push("Root, desktop, Tauri, and Cargo versions are not synchronized.");
}
if (tauri.plugins?.updater?.pubkey?.includes("REPLACE_WITH_")) {
  blockers.push("Production Tauri updater public key is still a placeholder.");
}
if (!Array.isArray(tauri.plugins?.updater?.endpoints) || !tauri.plugins.updater.endpoints.every((value) => value.startsWith("https://"))) {
  blockers.push("Updater endpoints must all use HTTPS.");
}
if (pendingBetaCells > 0) blockers.push(`Closed beta matrix still contains ${pendingBetaCells} pending results.`);
if (readiness.hardeningPhaseOpen !== true) {
  blockers.push("Project plan does not explicitly track the open hardening phase.");
}
const missingWorkflowTargets = requiredWorkflowTargets
  .filter(({ releaseTarget }) => !releaseWorkflow.includes(`releaseTarget: ${releaseTarget}`))
  .map(({ releaseTarget }) => releaseTarget);
if (missingWorkflowTargets.length > 0) {
  blockers.push(`Release workflow is missing target jobs: ${missingWorkflowTargets.join(", ")}.`);
}
const missingRustTargets = requiredWorkflowTargets
  .filter(({ rustTarget }) => !releaseWorkflow.includes(`rustTarget: ${rustTarget}`))
  .map(({ rustTarget }) => rustTarget);
if (missingRustTargets.length > 0) {
  blockers.push(`Release workflow is missing Rust target triples: ${missingRustTargets.join(", ")}.`);
}
if (!releaseWorkflow.includes('npm run tauri:build -- --target "${{ matrix.rustTarget }}"')) {
  blockers.push("Release workflow does not pass the matrix Rust target to Tauri build.");
}
if (!releaseWorkflow.includes("apps/desktop/src-tauri/target/**/release/bundle/**/*.sig")) {
  blockers.push("Release workflow artifact upload does not include target-specific release bundle paths.");
}
if (/COMPONENT_|component-production|Release AtrisShot Components|R2_|shot-components|voice-components/i.test(workflowSources)) {
  blockers.push("AtrisShot workflows must not include AtrisVoice-style component publishing or R2 distribution.");
}

const forbiddenSecretPatterns = [
  /TAURI_SIGNING_PRIVATE_KEY\s*=\s*["'][^-{][^"']+/,
  /SHOT_RELEASE_REPO_ACCESS_TOKEN\s*=\s*["'][^"']+/,
  /APPLE_PASSWORD\s*=\s*["'][^-{][^"']+/,
];
const trackedText = [
  ".env.example",
  ".github/workflows/release.yml",
  ".github/workflows/deploy.yml",
  ".github/workflows/validate.yml",
  "apps/desktop/src-tauri/tauri.conf.json",
].map(read).join("\n");
if (forbiddenSecretPatterns.some((pattern) => pattern.test(trackedText))) {
  blockers.push("A release secret appears to be committed in tracked configuration.");
}

console.log(JSON.stringify({
  ready: blockers.length === 0,
  strict,
  version: rootVersion,
  betaMatrixPath,
  pendingBetaResults: pendingBetaCells,
  blockers,
}, null, 2));

if (strict && blockers.length > 0) process.exitCode = 1;

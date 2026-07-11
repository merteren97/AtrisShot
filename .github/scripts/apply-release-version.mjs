import fs from "node:fs";
const raw = process.argv[2];
if (!raw) throw new Error("Release version is required.");
const normalized = raw.trim().replace(/^version\s*:\s*/i, "");
const version = normalized.replace(/^v/, "");
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`Invalid semantic version: ${raw}`);
const prerelease = version.match(/-(.+?)(?:\+|$)/)?.[1];
if (prerelease && (!/^\d+$/.test(prerelease) || Number(prerelease) > 65535)) {
  throw new Error(
    `Windows MSI requires a numeric prerelease identifier from 0 to 65535; use a version such as v1.0.1-1 instead of ${raw}.`,
  );
}
const updateJson = (file) => {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.version = version;
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};
for (const file of ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/tauri.conf.json"]) updateJson(file);
const lockPath = "package-lock.json";
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
lock.version = version;
if (lock.packages?.[""]) lock.packages[""].version = version;
if (lock.packages?.["apps/desktop"]) lock.packages["apps/desktop"].version = version;
fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
const cargoPath = "apps/desktop/src-tauri/Cargo.toml";
fs.writeFileSync(cargoPath, fs.readFileSync(cargoPath, "utf8").replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`));
const cargoLockPath = "apps/desktop/src-tauri/Cargo.lock";
fs.writeFileSync(
  cargoLockPath,
  fs.readFileSync(cargoLockPath, "utf8").replace(/(name\s*=\s*"atris-shot"\r?\nversion\s*=\s*")[^"]+(")/, `$1${version}$2`),
);

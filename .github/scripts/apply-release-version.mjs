import fs from "node:fs";
const raw = process.argv[2];
if (!raw) throw new Error("Release version is required.");
const normalized = raw.trim().replace(/^version\s*:\s*/i, "");
const version = normalized.replace(/^v/, "");
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) throw new Error(`Invalid semantic version: ${raw}`);
const prerelease = version.match(/-(.+?)(?:\+|$)/)?.[1];
if (prerelease && (!/^\d+$/.test(prerelease) || Number(prerelease) > 65535)) {
  throw new Error(
    `Windows MSI requires a numeric prerelease identifier from 0 to 65535; use a version such as v0.1.0-1 instead of ${raw}.`,
  );
}
const updateJson = (file) => {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.version = version;
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};
for (const file of ["package.json", "apps/desktop/package.json", "apps/desktop/src-tauri/tauri.conf.json"]) updateJson(file);
const cargoPath = "apps/desktop/src-tauri/Cargo.toml";
fs.writeFileSync(cargoPath, fs.readFileSync(cargoPath, "utf8").replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`));

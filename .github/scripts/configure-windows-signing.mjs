import { readFile, writeFile } from "node:fs/promises";

const file = "apps/desktop/src-tauri/tauri.conf.json";
const thumbprint = process.env.WINDOWS_CERTIFICATE_THUMBPRINT?.trim();

if (!thumbprint) {
  throw new Error("WINDOWS_CERTIFICATE_THUMBPRINT is required.");
}

const config = JSON.parse(await readFile(file, "utf8"));
config.bundle.windows = {
  ...(config.bundle.windows || {}),
  certificateThumbprint: thumbprint,
  digestAlgorithm: "sha256",
  timestampUrl: process.env.WINDOWS_TIMESTAMP_URL || "http://timestamp.digicert.com",
};

await writeFile(file, `${JSON.stringify(config, null, 2)}\n`);
console.log(`Configured Windows signing certificate ${thumbprint}.`);

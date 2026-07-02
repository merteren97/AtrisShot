import fs from "node:fs";

const publicKey = process.env.TAURI_UPDATER_PUBLIC_KEY?.trim();
if (!publicKey) throw new Error("TAURI_UPDATER_PUBLIC_KEY is required.");
const file = "apps/desktop/src-tauri/tauri.conf.json";
const config = JSON.parse(fs.readFileSync(file, "utf8"));
config.plugins.updater.pubkey = publicKey;
fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);

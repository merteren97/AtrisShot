import { copyFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const ico = path.join(root, "apps/desktop/src-tauri/icons/icon.ico");
const destinations = [
  "apps/desktop/public/favicon.ico",
  "apps/landing/public/favicon.ico",
  "services/public-server/public/favicon.ico",
];

await Promise.all(
  destinations.map((destination) => copyFile(ico, path.join(root, destination))),
);

console.log("AtrisShot multi-resolution favicon containers synchronized.");

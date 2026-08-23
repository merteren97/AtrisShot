import "./generate-refined-shot-logo.mjs";

import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const finalBrand = path.join(root, "brand-options", "atris-a-shot-refined");

const desktopBrand = path.join(root, "apps/desktop/public/brand");
const landingBrand = path.join(root, "apps/landing/public/brand");
const desktopPublic = path.join(root, "apps/desktop/public");
const landingPublic = path.join(root, "apps/landing/public");
const publicServer = path.join(root, "services/public-server/public");
const publicServerBrand = path.join(publicServer, "brand");
const tauriIcons = path.join(root, "apps/desktop/src-tauri/icons");
const atrisHubPublic = path.resolve(root, "../AtrisHub/public");

await Promise.all([
  desktopBrand,
  landingBrand,
  publicServer,
  publicServerBrand,
  desktopPublic,
  landingPublic,
  tauriIcons,
  atrisHubPublic,
].map((dir) => mkdir(dir, { recursive: true })));

// Application icons stay transparent; the tiled variant remains available in brand-options for previews.
const iconSvg = await readFile(path.join(finalBrand, "atris-shot-refined-mark-dark.svg"), "utf8");
const darkMarkSvg = await readFile(path.join(finalBrand, "atris-shot-refined-mark-dark.svg"), "utf8");
const lightMarkSvg = await readFile(path.join(finalBrand, "atris-shot-refined-mark-light.svg"), "utf8");
const toHubMark = (svg) => svg.replace(
  'width="1024" height="1024" viewBox="0 0 1024 1024"',
  'viewBox="110 120 804 804" preserveAspectRatio="xMidYMid meet"',
);
const hubDarkMarkSvg = toHubMark(darkMarkSvg);
const hubLightMarkSvg = toHubMark(lightMarkSvg);
const serializeSvg = (svg) => `${svg.trim().replace(/[ \t]+$/gm, "")}\n`;

const brandRoots = [desktopBrand, landingBrand, publicServerBrand];

for (const brandRoot of brandRoots) {
  await Promise.all([
    writeFile(path.join(brandRoot, "atris-shot-icon.svg"), serializeSvg(iconSvg)),
    writeFile(path.join(brandRoot, "atris-shot-mark-dark.svg"), serializeSvg(darkMarkSvg)),
    writeFile(path.join(brandRoot, "atris-shot-mark-light.svg"), serializeSvg(lightMarkSvg)),
    writeFile(path.join(brandRoot, "atris-shot-mark-system.svg"), serializeSvg(darkMarkSvg)),
    writeFile(path.join(brandRoot, "atris-shot-mark.svg"), serializeSvg(darkMarkSvg)),
    writeFile(path.join(brandRoot, "atris-shot-pulse.svg"), serializeSvg(darkMarkSvg)),
  ]);
}

await Promise.all([
  writeFile(path.join(atrisHubPublic, "atris-shot-logo.svg"), serializeSvg(hubDarkMarkSvg)),
  writeFile(path.join(atrisHubPublic, "atris-shot-logo-dark.svg"), serializeSvg(hubDarkMarkSvg)),
  writeFile(path.join(atrisHubPublic, "atris-shot-logo-light.svg"), serializeSvg(hubLightMarkSvg)),
  writeFile(path.join(atrisHubPublic, "atris-shot-icon.svg"), serializeSvg(iconSvg)),
]);

const iconBuffer = Buffer.from(iconSvg);
const pngTargets = [
  [desktopPublic, "icon-32.png", 32],
  [desktopPublic, "icon-64.png", 64],
  [desktopPublic, "icon-192.png", 192],
  [desktopPublic, "icon-512.png", 512],
  [desktopPublic, "icon-1024.png", 1024],
  [desktopPublic, "icon-2048.png", 2048],
  [desktopPublic, "apple-touch-icon.png", 180],
  [landingPublic, "icon-32.png", 32],
  [landingPublic, "icon-64.png", 64],
  [landingPublic, "icon-192.png", 192],
  [landingPublic, "icon-512.png", 512],
  [landingPublic, "icon-1024.png", 1024],
  [landingPublic, "icon-2048.png", 2048],
  [landingPublic, "apple-touch-icon.png", 180],
  [publicServer, "icon-32.png", 32],
  [publicServer, "icon-64.png", 64],
  [publicServer, "icon-192.png", 192],
  [publicServer, "icon-512.png", 512],
  [publicServer, "icon-1024.png", 1024],
  [publicServer, "icon-2048.png", 2048],
  [publicServer, "apple-touch-icon.png", 180],
  [tauriIcons, "source-master.png", 2048],
];

for (const [dir, filename, size] of pngTargets) {
  await sharp(iconBuffer, { density: 900 })
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(dir, filename));
}

await writeFile(path.join(tauriIcons, "source.svg"), serializeSvg(iconSvg));
await copyFile(path.join(desktopPublic, "icon-32.png"), path.join(landingPublic, "favicon.png"));
await copyFile(path.join(desktopPublic, "icon-32.png"), path.join(publicServer, "favicon.png"));

console.log("AtrisShot final SVG brand assets distributed to desktop, landing, public server, Tauri, and AtrisHub.");

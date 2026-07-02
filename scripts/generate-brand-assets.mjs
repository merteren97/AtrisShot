import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const sourcePath = path.resolve(root, "../LOGOs/ig_0a3a497afc3155c4016a379f8b03e08191892d7d48cb2c93de.svg");
const source = await readFile(sourcePath, "utf8");

const palettes = {
  light: { foreground: "#0F172A", accent: "#2563EB" },
  dark: { foreground: "#F8FAFC", accent: "#60A5FA" },
  system: { foreground: "#FFFFFF", accent: "#3B82F6" },
};
const iconPalette = { foreground: "#2563EB", accent: "#60A5FA" };

const normalized = source
  .replace(
    /width="1254" height="1254"/,
    'viewBox="218 167 875 875" preserveAspectRatio="xMidYMid meet"',
  )
  .replace(/<\?xml[^>]*>\s*/, "");

const classify = (hex) => {
  const value = hex.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  const spread = Math.max(red, green, blue) - Math.min(red, green, blue);
  if (luminance < 52) return "background";
  if (spread < 34 && luminance > 150) return "foreground";
  return "accent";
};

const themedSvg = (palette) => {
  return normalized.replace(
    /<path\b[^>]*\bfill="(#[0-9A-Fa-f]{6})"[^>]*\/?>/g,
    (pathMarkup, original) => {
      const role = classify(original.toUpperCase());
      if (role === "background") return "";
      return pathMarkup.replace(/fill="#[0-9A-Fa-f]{6}"/, `fill="${palette[role]}"`);
    },
  );
};

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
  publicServerBrand,
  desktopPublic,
  landingPublic,
  publicServer,
  tauriIcons,
  atrisHubPublic,
].map((dir) => mkdir(dir, { recursive: true })));

for (const [name, palette] of Object.entries(palettes)) {
  const svg = themedSvg(palette);
  await writeFile(path.join(desktopBrand, `atris-shot-mark-${name}.svg`), svg);
  await writeFile(path.join(landingBrand, `atris-shot-mark-${name}.svg`), svg);
  await writeFile(path.join(publicServerBrand, `atris-shot-mark-${name}.svg`), svg);
  if (name !== "system") {
    await writeFile(path.join(atrisHubPublic, `atris-shot-logo-${name}.svg`), svg);
  }
  if (name === "system") {
    await writeFile(path.join(desktopBrand, "atris-shot-mark.svg"), svg);
    await writeFile(path.join(landingBrand, "atris-shot-mark.svg"), svg);
    await writeFile(path.join(publicServerBrand, "atris-shot-mark.svg"), svg);
    await writeFile(path.join(desktopBrand, "atris-shot-pulse.svg"), svg);
    await writeFile(path.join(landingBrand, "atris-shot-pulse.svg"), svg);
    await writeFile(path.join(publicServerBrand, "atris-shot-pulse.svg"), svg);
    await writeFile(path.join(atrisHubPublic, "atris-shot-logo.svg"), svg);
  }
}

const universalIconSvg = themedSvg(iconPalette);
await Promise.all([
  writeFile(path.join(desktopBrand, "atris-shot-icon.svg"), universalIconSvg),
  writeFile(path.join(landingBrand, "atris-shot-icon.svg"), universalIconSvg),
  writeFile(path.join(publicServerBrand, "atris-shot-icon.svg"), universalIconSvg),
]);

const iconSvg = Buffer.from(themedSvg(iconPalette));
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
  await sharp(iconSvg, { density: 600 })
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(path.join(dir, filename));
}

await copyFile(path.join(desktopPublic, "icon-32.png"), path.join(landingPublic, "favicon.png"));
await copyFile(path.join(desktopPublic, "icon-32.png"), path.join(publicServer, "favicon.png"));

console.log("AtrisShot compact SVG and high-resolution PNG masters generated.");

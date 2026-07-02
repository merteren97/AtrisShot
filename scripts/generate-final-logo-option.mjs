import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "brand-options");
const hubSourcePath = path.resolve(root, "../AtrisHub/public/atris-hub-logo.svg");
const hubSource = await readFile(hubSourcePath, "utf8");

const mark = hubSource
  .replace('width="100%" height="100%"', 'width="760" height="700"')
  .replace(/#5865F2/g, "#3B82F6")
  .replace(/#00D2FF/g, "#22D3EE");

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <filter id="brand-shadow" x="-20%" y="-20%" width="140%" height="145%">
      <feDropShadow dx="0" dy="26" stdDeviation="24" flood-color="#020617" flood-opacity="0.36"/>
    </filter>
    <filter id="frame-glow" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="bg" x1="112" y1="68" x2="908" y2="936" gradientUnits="userSpaceOnUse">
      <stop stop-color="#071827"/>
      <stop offset="1" stop-color="#101330"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round" filter="url(#frame-glow)">
    <rect x="176" y="204" width="672" height="624" rx="82" stroke="#22D3EE" stroke-width="18" stroke-dasharray="52 34" opacity="0.34"/>
    <path d="M188 318V216h102" stroke="#E0F2FE" stroke-width="18" opacity="0.72"/>
    <path d="M836 318V216H734" stroke="#E0F2FE" stroke-width="18" opacity="0.72"/>
    <path d="M188 714v102h102" stroke="#E0F2FE" stroke-width="18" opacity="0.72"/>
    <path d="M836 714v102H734" stroke="#E0F2FE" stroke-width="18" opacity="0.72"/>
  </g>
  <g transform="translate(132 158) scale(1.0)" filter="url(#brand-shadow)">
    ${mark}
  </g>
</svg>`;

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "final-same-logo-shot-frame.svg"), `${svg.trim()}\n`);
await sharp(Buffer.from(svg), { density: 600 })
  .resize(1024, 1024)
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(path.join(outDir, "final-same-logo-shot-frame.png"));

const metadata = await sharp(path.join(outDir, "final-same-logo-shot-frame.png")).metadata();
console.log(`final-same-logo-shot-frame.png: ${metadata.width}x${metadata.height}`);

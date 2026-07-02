import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "brand-options");
const hubSourcePath = path.resolve(root, "../AtrisHub/public/atris-hub-logo.svg");
const hubSource = await readFile(hubSourcePath, "utf8");

const mark = hubSource
  .replace('width="100%" height="100%"', 'width="780" height="715"')
  .replace(/#5865F2/g, "#3B82F6")
  .replace(/#00D2FF/g, "#22D3EE");

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="background" x1="116" y1="70" x2="908" y2="948" gradientUnits="userSpaceOnUse">
      <stop stop-color="#071827"/>
      <stop offset="0.58" stop-color="#0E1630"/>
      <stop offset="1" stop-color="#092B34"/>
    </linearGradient>
    <radialGradient id="cyan-vignette" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(770 278) rotate(128) scale(520)">
      <stop stop-color="#22D3EE" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#22D3EE" stop-opacity="0"/>
    </radialGradient>
    <filter id="mark-shadow" x="-20%" y="-20%" width="140%" height="145%">
      <feDropShadow dx="0" dy="28" stdDeviation="24" flood-color="#020617" flood-opacity="0.42"/>
    </filter>
    <filter id="line-glow" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="3.2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <clipPath id="soft-square">
      <rect width="1024" height="1024" rx="220"/>
    </clipPath>
  </defs>

  <g clip-path="url(#soft-square)">
    <rect width="1024" height="1024" fill="url(#background)"/>
    <rect width="1024" height="1024" fill="url(#cyan-vignette)"/>

    <g filter="url(#line-glow)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <rect x="188" y="220" width="648" height="584" rx="70" stroke="#22D3EE" stroke-width="16" stroke-dasharray="46 32" opacity="0.22"/>
      <path d="M232 302V232h70" stroke="#22D3EE" stroke-width="22" opacity="0.56"/>
      <path d="M792 302V232h-70" stroke="#22D3EE" stroke-width="22" opacity="0.56"/>
      <path d="M232 722v70h70" stroke="#3B82F6" stroke-width="22" opacity="0.52"/>
      <path d="M792 722v70h-70" stroke="#3B82F6" stroke-width="22" opacity="0.52"/>
      <path d="M286 512h452" stroke="#3B82F6" stroke-width="14" opacity="0.11"/>
      <path d="M512 286v452" stroke="#22D3EE" stroke-width="14" opacity="0.09"/>
    </g>

    <g transform="translate(122 150)" filter="url(#mark-shadow)">
      ${mark}
    </g>

    <g filter="url(#line-glow)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M696 252h96v96" stroke="#22D3EE" stroke-width="18" opacity="0.86"/>
      <path d="M252 696v96h96" stroke="#3B82F6" stroke-width="18" opacity="0.8"/>
      <path d="M724 748h86v-86" stroke="#22D3EE" stroke-width="18" opacity="0.72"/>
    </g>

    <circle cx="812" cy="662" r="16" fill="#22D3EE" opacity="0.88"/>
    <circle cx="252" cy="360" r="12" fill="#3B82F6" opacity="0.74"/>
  </g>
</svg>`;

const refinedSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="background" x1="116" y1="70" x2="908" y2="948" gradientUnits="userSpaceOnUse">
      <stop stop-color="#071827"/>
      <stop offset="0.62" stop-color="#0D1630"/>
      <stop offset="1" stop-color="#082C34"/>
    </linearGradient>
    <radialGradient id="cyan-vignette" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(760 300) rotate(132) scale(500)">
      <stop stop-color="#22D3EE" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#22D3EE" stop-opacity="0"/>
    </radialGradient>
    <filter id="mark-shadow" x="-20%" y="-20%" width="140%" height="145%">
      <feDropShadow dx="0" dy="28" stdDeviation="24" flood-color="#020617" flood-opacity="0.42"/>
    </filter>
    <filter id="line-glow" x="-70%" y="-70%" width="240%" height="240%">
      <feGaussianBlur stdDeviation="2.4" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <clipPath id="soft-square">
      <rect width="1024" height="1024" rx="220"/>
    </clipPath>
  </defs>

  <g clip-path="url(#soft-square)">
    <rect width="1024" height="1024" fill="url(#background)"/>
    <rect width="1024" height="1024" fill="url(#cyan-vignette)"/>

    <g filter="url(#line-glow)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <rect x="194" y="226" width="636" height="574" rx="72" stroke="#22D3EE" stroke-width="14" stroke-dasharray="54 38" opacity="0.2"/>
      <path d="M226 314V226h88" stroke="#22D3EE" stroke-width="20" opacity="0.54"/>
      <path d="M798 314V226h-88" stroke="#22D3EE" stroke-width="20" opacity="0.54"/>
      <path d="M226 710v88h88" stroke="#3B82F6" stroke-width="20" opacity="0.5"/>
      <path d="M798 710v88h-88" stroke="#22D3EE" stroke-width="20" opacity="0.54"/>
    </g>

    <g transform="translate(122 150)" filter="url(#mark-shadow)">
      ${mark}
    </g>

    <g filter="url(#line-glow)" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M700 250h94v94" stroke="#22D3EE" stroke-width="17" opacity="0.84"/>
      <path d="M250 700v94h94" stroke="#3B82F6" stroke-width="17" opacity="0.78"/>
      <path d="M720 748h80v-80" stroke="#22D3EE" stroke-width="17" opacity="0.68"/>
    </g>
  </g>
</svg>`;

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "final-professional-integrated-shot-logo.svg"), `${svg.trim()}\n`);
await sharp(Buffer.from(svg), { density: 600 })
  .resize(1024, 1024)
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(path.join(outDir, "final-professional-integrated-shot-logo.png"));

const metadata = await sharp(path.join(outDir, "final-professional-integrated-shot-logo.png")).metadata();
console.log(`final-professional-integrated-shot-logo.png: ${metadata.width}x${metadata.height}`);

await writeFile(path.join(outDir, "final-professional-integrated-shot-logo-v2.svg"), `${refinedSvg.trim()}\n`);
await sharp(Buffer.from(refinedSvg), { density: 600 })
  .resize(1024, 1024)
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(path.join(outDir, "final-professional-integrated-shot-logo-v2.png"));

const refinedMetadata = await sharp(path.join(outDir, "final-professional-integrated-shot-logo-v2.png")).metadata();
console.log(`final-professional-integrated-shot-logo-v2.png: ${refinedMetadata.width}x${refinedMetadata.height}`);

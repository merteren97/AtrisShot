import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "brand-options");
const hubSourcePath = path.resolve(root, "../AtrisHub/public/atris-hub-logo.svg");
await readFile(hubSourcePath, "utf8");

const defs = `
  <filter id="brand-shadow" x="-20%" y="-20%" width="140%" height="145%">
    <feDropShadow dx="0" dy="26" stdDeviation="24" flood-color="#020617" flood-opacity="0.34"/>
  </filter>
  <filter id="soft-glow" x="-70%" y="-70%" width="240%" height="240%">
    <feGaussianBlur stdDeviation="5" result="blur"/>
    <feMerge>
      <feMergeNode in="blur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
`;

const atrisShotMark = ({ primary, secondary, piece, lineOpacity = 0.18 }) => `
  <g filter="url(#brand-shadow)">
    <path d="M631 176L315 330l118 65-282 450h147l306-486c22-35 27-45 27-86V176Z" fill="url(#main-gradient)"/>
    ${piece}
    <path d="M250 252h524" stroke="${secondary}" stroke-width="18" stroke-linecap="round" opacity="${lineOpacity}"/>
    <path d="M250 772h524" stroke="${primary}" stroke-width="18" stroke-linecap="round" opacity="${lineOpacity}"/>
  </g>
`;

const options = [
  {
    slug: "piece-option-1-crop-slab",
    title: "Crop Slab",
    svg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
        <defs>${defs}<linearGradient id="bg" x1="108" y1="68" x2="918" y2="948" gradientUnits="userSpaceOnUse"><stop stop-color="#071827"/><stop offset="1" stop-color="#101330"/></linearGradient><linearGradient id="main-gradient" x1="230" y1="832" x2="780" y2="188" gradientUnits="userSpaceOnUse"><stop stop-color="#2563EB"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs>
        <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
        ${atrisShotMark({
          primary: "#2563EB",
          secondary: "#22D3EE",
          lineOpacity: 0.14,
          piece: '<path d="M633 430l248 414H488l91-144h103L563 512l70-82Z" fill="#22D3EE"/>',
        })}
        <path d="M714 652h112v112H714z" fill="#071827" opacity="0.9"/>
        <path d="M714 652h112v112H714z" fill="none" stroke="#22D3EE" stroke-width="18"/>
      </svg>`,
  },
  {
    slug: "piece-option-2-selection-cut",
    title: "Selection Cut",
    svg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
        <defs>${defs}<linearGradient id="bg" x1="92" y1="912" x2="922" y2="92" gradientUnits="userSpaceOnUse"><stop stop-color="#08111F"/><stop offset="1" stop-color="#042F2E"/></linearGradient><linearGradient id="main-gradient" x1="190" y1="844" x2="836" y2="182" gradientUnits="userSpaceOnUse"><stop stop-color="#1D4ED8"/><stop offset="1" stop-color="#2DD4BF"/></linearGradient></defs>
        <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
        <rect x="228" y="244" width="568" height="548" rx="52" fill="none" stroke="#2DD4BF" stroke-width="18" stroke-dasharray="42 32" opacity="0.18"/>
        ${atrisShotMark({
          primary: "#1D4ED8",
          secondary: "#2DD4BF",
          lineOpacity: 0.11,
          piece: '<path d="M633 430l248 414H488l96-151 96 56-116-236 69-83Z" fill="#2DD4BF"/>',
        })}
        <path d="M680 748h110v-110" fill="none" stroke="#2DD4BF" stroke-width="24" stroke-linecap="square"/>
      </svg>`,
  },
  {
    slug: "piece-option-3-panel-fold",
    title: "Panel Fold",
    svg: () => `
      <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
        <defs>${defs}<linearGradient id="bg" x1="110" y1="70" x2="920" y2="930" gradientUnits="userSpaceOnUse"><stop stop-color="#0B1020"/><stop offset="0.54" stop-color="#111E36"/><stop offset="1" stop-color="#042F2E"/></linearGradient><linearGradient id="main-gradient" x1="180" y1="842" x2="828" y2="176" gradientUnits="userSpaceOnUse"><stop stop-color="#3B82F6"/><stop offset="1" stop-color="#06B6D4"/></linearGradient></defs>
        <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
        ${atrisShotMark({
          primary: "#3B82F6",
          secondary: "#06B6D4",
          lineOpacity: 0.12,
          piece: '<path d="M633 430l248 414H488l92-146h126l-97-154 24-114Z" fill="#06B6D4"/><path d="M609 544l97 154H580l29-154Z" fill="#0B1020" opacity="0.78"/>',
        })}
        <path d="M704 224h98v30h-68v68h-30V224Z" fill="#06B6D4"/>
        <path d="M224 704h30v68h68v30h-98V704Z" fill="#3B82F6"/>
      </svg>`,
  },
];

await mkdir(outDir, { recursive: true });

for (const option of options) {
  const svg = option.svg();
  const svgPath = path.join(outDir, `${option.slug}.svg`);
  const pngPath = path.join(outDir, `${option.slug}.png`);
  await writeFile(svgPath, `${svg.trim()}\n`);
  await sharp(Buffer.from(svg), { density: 600 })
    .resize(1024, 1024)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(pngPath);
  const metadata = await sharp(pngPath).metadata();
  console.log(`${option.title}: ${metadata.width}x${metadata.height} -> ${pngPath}`);
}

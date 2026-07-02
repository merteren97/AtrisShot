import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "brand-options", "atris-a-shot-refined");

const sourceViewBox = "394 1205 736 675";

const mainShape =
  "M8730 2659 l0 -675 -38 -57 c-21 -31 -56 -86 -77 -122 -40 -68 -48 -81 -192 -305 -49 -77 -109 -173 -132 -213 -24 -41 -84 -136 -134 -212 -51 -76 -119 -182 -152 -235 -33 -53 -90 -143 -126 -199 -37 -57 -85 -134 -108 -172 -23 -38 -70 -113 -104 -166 -34 -53 -113 -177 -176 -275 -113 -177 -193 -303 -265 -418 -21 -33 -91 -143 -155 -245 -167 -263 -337 -533 -495 -786 -28 -43 -89 -140 -137 -214 -47 -75 -96 -155 -108 -178 -12 -23 -30 -48 -41 -54 -11 -7 -20 -17 -20 -23 0 -5 -30 -57 -66 -115 -37 -58 -105 -168 -152 -245 -47 -77 -111 -178 -142 -225 -32 -47 -88 -134 -125 -195 -38 -60 -102 -160 -142 -222 -65 -99 -78 -113 -107 -119 -47 -8 -1383 -1 -1392 8 -4 4 4 25 18 45 14 21 60 94 102 163 43 69 87 139 98 155 11 17 71 113 134 215 62 102 145 235 184 295 181 282 326 511 401 635 46 74 124 198 174 275 50 77 115 181 145 230 29 50 83 135 120 190 58 88 174 273 254 405 15 25 59 95 99 156 40 60 86 131 102 158 112 177 363 572 431 678 35 54 71 112 80 130 9 18 67 110 129 203 157 239 210 328 197 333 -6 2 -48 26 -94 54 -46 28 -126 75 -178 103 -235 129 -301 166 -395 220 -155 91 -222 128 -330 184 -55 29 -101 54 -104 57 -2 2 43 26 100 53 57 27 216 103 353 170 137 66 250 121 252 121 2 0 108 51 236 114 128 62 361 175 518 251 440 212 959 464 1235 599 277 136 295 144 313 145 9 1 12 -140 12 -675z";

const lowerShape =
  "M8860 712 c68 -116 164 -277 214 -357 49 -80 166 -273 261 -430 430 -712 683 -1129 865 -1430 108 -179 231 -381 272 -450 370 -614 472 -784 544 -905 l82 -140 -2410 -3 c-1326 -1 -2413 0 -2415 1 -5 6 450 752 516 847 10 14 26 41 36 60 9 19 63 107 120 195 109 170 451 715 518 827 l40 67 51 -33 c28 -18 92 -54 141 -81 86 -46 597 -335 735 -415 326 -189 665 -378 672 -374 10 6 -102 197 -438 751 -99 164 -270 447 -380 628 -110 182 -207 341 -216 355 -16 24 -14 28 62 145 44 66 113 176 155 245 41 69 106 173 143 231 80 127 149 238 233 377 35 56 65 102 69 102 3 0 61 -96 130 -213z";

const defs = `
  <linearGradient id="tile-bg" x1="128" y1="92" x2="912" y2="932" gradientUnits="userSpaceOnUse">
    <stop stop-color="#0F1915"/>
    <stop offset="0.58" stop-color="#14201B"/>
    <stop offset="1" stop-color="#211B10"/>
  </linearGradient>
  <linearGradient id="accent" x1="740" y1="1320" x2="1118" y2="1874" gradientUnits="userSpaceOnUse">
    <stop stop-color="#F8C04E"/>
    <stop offset="0.54" stop-color="#F5A70D"/>
    <stop offset="1" stop-color="#D97706"/>
  </linearGradient>
  <filter id="soft-shadow" x="-18%" y="-18%" width="136%" height="140%">
    <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#030907" flood-opacity="0.3"/>
  </filter>
  <clipPath id="tile-mask">
    <rect width="1024" height="1024" rx="224"/>
  </clipPath>
`;

const sourceMark = ({ main = "#F8FAFC", accent = "url(#accent)", cue = "#14201B" } = {}) => `
  <svg x="134" y="142" width="756" height="694" viewBox="${sourceViewBox}" preserveAspectRatio="xMidYMid meet" overflow="visible">
    <g transform="translate(0,1559) scale(0.1,-0.1)" stroke="none">
      <path fill="${main}" d="${mainShape}"/>
      <path fill="${accent}" d="${lowerShape}"/>
    </g>
    <g fill="none" stroke="${cue}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.72">
      <path d="M958 1702h42v-42"/>
      <path d="M934 1648h-34v34"/>
    </g>
  </svg>
`;

const tileSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>${defs}</defs>
    <g clip-path="url(#tile-mask)">
      <rect width="1024" height="1024" fill="url(#tile-bg)"/>
      <g filter="url(#soft-shadow)">
        ${sourceMark()}
      </g>
    </g>
  </svg>
`;

const transparentDarkSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>${defs}</defs>
    <g filter="url(#soft-shadow)">
      ${sourceMark()}
    </g>
  </svg>
`;

const transparentLightSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>${defs}</defs>
    <g filter="url(#soft-shadow)">
      ${sourceMark({ main: "#10201A", accent: "#E99A08", cue: "#F8F4EA" })}
    </g>
  </svg>
`;

await mkdir(outDir, { recursive: true });

const assets = [
  ["atris-shot-refined-icon", tileSvg],
  ["atris-shot-refined-mark-dark", transparentDarkSvg],
  ["atris-shot-refined-mark-light", transparentLightSvg],
  ["atris-shot-refined-mark", transparentDarkSvg],
];

for (const [name, svg] of assets) {
  const svgPath = path.join(outDir, `${name}.svg`);
  await writeFile(svgPath, `${svg.trim()}\n`);
  for (const size of [1024, 2048, 4096]) {
    const pngName = size === 1024 ? `${name}.png` : `${name}-${size}.png`;
    await sharp(Buffer.from(svg), { density: 900 })
      .resize(size, size, { fit: "contain" })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(path.join(outDir, pngName));
  }
}

const previewBase = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="2400" height="1000" viewBox="0 0 2400 1000">
    <rect width="2400" height="1000" rx="64" fill="#0B1110"/>
    <rect x="80" y="86" width="820" height="820" rx="96" fill="#121916"/>
    <rect x="980" y="86" width="600" height="820" rx="96" fill="#121916"/>
    <rect x="1660" y="86" width="600" height="820" rx="96" fill="#F7F4EC"/>
    <text x="80" y="958" fill="#D8E0DA" font-size="30" font-family="Segoe UI, Arial" font-weight="700">Icon tile - crop safe</text>
    <text x="980" y="958" fill="#D8E0DA" font-size="30" font-family="Segoe UI, Arial" font-weight="700">Dark mark</text>
    <text x="1660" y="958" fill="#D8E0DA" font-size="30" font-family="Segoe UI, Arial" font-weight="700">Light mark</text>
  </svg>
`);

await sharp(previewBase)
  .composite([
    { input: await sharp(path.join(outDir, "atris-shot-refined-icon.png")).resize(650, 650).png().toBuffer(), left: 165, top: 170 },
    { input: await sharp(path.join(outDir, "atris-shot-refined-mark-dark.png")).resize(510, 510).png().toBuffer(), left: 1025, top: 238 },
    { input: await sharp(path.join(outDir, "atris-shot-refined-mark-light.png")).resize(510, 510).png().toBuffer(), left: 1705, top: 238 },
  ])
  .png({ compressionLevel: 9, adaptiveFiltering: true })
  .toFile(path.join(outDir, "preview.png"));

console.log(`Generated professional AtrisShot logo v2 assets in ${outDir}`);

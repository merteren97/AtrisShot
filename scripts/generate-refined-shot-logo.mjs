import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const outDir = path.join(root, "brand-options", "atris-a-shot-refined");

const mainShape =
  "M8730 2659 l0 -675 -38 -57 c-21 -31 -56 -86 -77 -122 -40 -68 -48 -81 -192 -305 -49 -77 -109 -173 -132 -213 -24 -41 -84 -136 -134 -212 -51 -76 -119 -182 -152 -235 -33 -53 -90 -143 -126 -199 -37 -57 -85 -134 -108 -172 -23 -38 -70 -113 -104 -166 -34 -53 -113 -177 -176 -275 -113 -177 -193 -303 -265 -418 -21 -33 -91 -143 -155 -245 -167 -263 -337 -533 -495 -786 -28 -43 -89 -140 -137 -214 -47 -75 -96 -155 -108 -178 -12 -23 -30 -48 -41 -54 -11 -7 -20 -17 -20 -23 0 -5 -30 -57 -66 -115 -37 -58 -105 -168 -152 -245 -47 -77 -111 -178 -142 -225 -32 -47 -88 -134 -125 -195 -38 -60 -102 -160 -142 -222 -65 -99 -78 -113 -107 -119 -47 -8 -1383 -1 -1392 8 -4 4 4 25 18 45 14 21 60 94 102 163 43 69 87 139 98 155 11 17 71 113 134 215 62 102 145 235 184 295 181 282 326 511 401 635 46 74 124 198 174 275 50 77 115 181 145 230 29 50 83 135 120 190 58 88 174 273 254 405 15 25 59 95 99 156 40 60 86 131 102 158 112 177 363 572 431 678 35 54 71 112 80 130 9 18 67 110 129 203 157 239 210 328 197 333 -6 2 -48 26 -94 54 -46 28 -126 75 -178 103 -235 129 -301 166 -395 220 -155 91 -222 128 -330 184 -55 29 -101 54 -104 57 -2 2 43 26 100 53 57 27 216 103 353 170 137 66 250 121 252 121 2 0 108 51 236 114 128 62 361 175 518 251 440 212 959 464 1235 599 277 136 295 144 313 145 9 1 12 -140 12 -675z";

const markTransform = "translate(134 142.33) scale(1.027173913) translate(-394 -1205)";

const defs = `
  <linearGradient id="capture-accent" x1="764" y1="1468" x2="1090" y2="1756" gradientUnits="userSpaceOnUse">
    <stop stop-color="#FFB547"/>
    <stop offset="0.5" stop-color="#FF7A00"/>
    <stop offset="1" stop-color="#E25500"/>
  </linearGradient>
  <filter id="soft-shadow" x="-18%" y="-18%" width="136%" height="140%">
    <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#030907" flood-opacity="0.3"/>
  </filter>
  <filter id="capture-depth" x="-16%" y="-16%" width="132%" height="132%">
    <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#030907" flood-opacity="0.26"/>
  </filter>
  <clipPath id="tile-mask">
    <rect width="1024" height="1024" rx="224"/>
  </clipPath>
`;

const screenshotSymbol = ({ accent = "url(#capture-accent)" } = {}) => `
  <g fill="none" stroke="${accent}" stroke-linecap="round" stroke-linejoin="round" filter="url(#capture-depth)">
    <path d="M842 1752 v-94 h168" stroke-width="42"/>
    <path d="M1110 1760 v94 h-168" stroke-width="42"/>
  </g>
`;

const sourceMark = ({ main = "#F8FAFC", accent = "url(#capture-accent)" } = {}) => `
  <g class="atris-shot-mark" transform="${markTransform}">
    <g transform="translate(0 1559) scale(0.1 -0.1)" stroke="none">
      <path fill="${main}" d="${mainShape}"/>
    </g>
    ${screenshotSymbol({ accent })}
  </g>
`;

const tileSvg = `
  <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
    <defs>${defs}</defs>
    <g clip-path="url(#tile-mask)">
      <rect width="1024" height="1024" fill="#111A16"/>
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
      ${sourceMark({ main: "#10201A" })}
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

console.log(`Generated professional AtrisShot screenshot-symbol logo assets in ${outDir}`);

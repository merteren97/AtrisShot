import { spawnSync } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const nextCli = path.resolve(process.cwd(), "../../node_modules/next/dist/bin/next");
const result = spawnSync(process.execPath, [nextCli, "build"], {
  cwd: process.cwd(),
  env: { ...process.env, EXPORT_STATIC: "true" },
  stdio: "inherit"
});

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

const exportRoot = path.resolve(process.cwd(), "out");
const staticAssets = ["brand/NotoSans-Regular.ttf", "brand/OFL.txt"];

for (const relativeAsset of staticAssets) {
  const source = path.resolve(process.cwd(), "public", relativeAsset);
  const destination = path.join(exportRoot, relativeAsset);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

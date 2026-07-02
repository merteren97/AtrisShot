import { spawnSync } from "node:child_process";
import path from "node:path";

const nextCli = path.resolve(process.cwd(), "../../node_modules/next/dist/bin/next");
const result = spawnSync(process.execPath, [nextCli, "build"], {
  cwd: process.cwd(),
  env: { ...process.env, EXPORT_STATIC: "true" },
  stdio: "inherit"
});

process.exit(result.status ?? 1);

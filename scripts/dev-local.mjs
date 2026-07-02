import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(npm, ["run", "dev:public"], { stdio: "inherit", shell: false }),
  spawn(npm, ["run", "tauri:dev"], { stdio: "inherit", shell: false }),
];

let closing = false;
const closeAll = (signal = "SIGTERM") => {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
};

for (const child of children) {
  child.on("exit", (code) => {
    if (!closing) {
      closeAll();
      process.exitCode = code ?? 1;
    }
  });
}

process.on("SIGINT", () => closeAll("SIGINT"));
process.on("SIGTERM", () => closeAll("SIGTERM"));

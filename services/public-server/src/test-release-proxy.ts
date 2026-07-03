import express from "express";
import type { AddressInfo } from "node:net";
import { assetPriority, createReleaseRouter, semverCompare } from "./release-proxy.js";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

async function withReleaseServer(fetchImpl: typeof fetch, run: (port: number) => Promise<void>, publicBaseUrl = "https://shot.atrishub.com") {
  const app = express();
  app.set("trust proxy", true);
  app.use("/api/releases", createReleaseRouter({ fetchImpl, publicBaseUrl }));
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    await run((server.address() as AddressInfo).port);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

process.env.SHOT_RELEASE_REPO_OWNER = "atris";
process.env.SHOT_RELEASE_REPO_NAME = "AtrisShot";
const release = {
  tag_name: "v0.2.0",
  published_at: "2026-06-30T00:00:00Z",
  assets: [
    { id: 1, name: "AtrisShot_0.2.0_x64-setup.exe" },
    { id: 2, name: "AtrisShot_0.2.0_x64-setup.exe.sig" },
    { id: 3, name: "AtrisShot_0.2.0_amd64.AppImage.tar.gz" },
    { id: 4, name: "AtrisShot_0.2.0_amd64.AppImage.tar.gz.sig" },
    { id: 5, name: "AtrisShot_0.2.0_amd64.AppImage" },
    { id: 6, name: "AtrisShot_0.2.0_x64.app.tar.gz" },
    { id: 7, name: "AtrisShot_0.2.0_x64.app.tar.gz.sig" },
    { id: 8, name: "AtrisShot_0.2.0_x64.dmg" },
    { id: 9, name: "AtrisShot_0.2.0_aarch64.app.tar.gz" },
    { id: 10, name: "AtrisShot_0.2.0_aarch64.app.tar.gz.sig" },
  ],
};
const fetchImpl: typeof fetch = async (input) => {
  const url = String(input);
  if (url.endsWith("/releases/latest")) return Response.json(release);
  if (url.endsWith("/assets/2")) return new Response("signed-value");
  if (url.endsWith("/assets/4")) return new Response("linux-signed-value");
  if (url.endsWith("/assets/7")) return new Response("macos-signed-value");
  if (url.endsWith("/assets/10")) return new Response("macos-arm-signed-value");
  if (url.endsWith("/assets/1")) return new Response(null, { status: 302, headers: { Location: "https://objects.example/shot.exe" } });
  if (url.endsWith("/assets/3")) return new Response(null, { status: 302, headers: { Location: "https://objects.example/shot.AppImage.tar.gz" } });
  if (url.endsWith("/assets/6")) return new Response(null, { status: 302, headers: { Location: "https://objects.example/shot.app.tar.gz" } });
  return new Response(null, { status: 404 });
};
await withReleaseServer(fetchImpl, async (port) => {
  assert(semverCompare("0.2.0", "0.1.9") > 0, "semver comparison failed");
  assert(semverCompare("0.1.0-4", "0.1.0-3") > 0, "numeric prerelease comparison failed");
  assert(semverCompare("0.1.0", "0.1.0-4") > 0, "stable must be newer than prerelease");
  assert(semverCompare("0.1.0-3", "0.1.0-4") < 0, "older prerelease comparison failed");
  assert(assetPriority("windows-x86_64", "AtrisShot-setup.exe") > assetPriority("windows-x86_64", "AtrisShot.msi"), "Windows setup should be preferred");
  assert(assetPriority("linux-x86_64", "AtrisShot.AppImage.tar.gz") > assetPriority("linux-x86_64", "AtrisShot.AppImage"), "Linux updater archive should be preferred");
  assert(assetPriority("darwin-x86_64", "AtrisShot_0.2.0_x64.app.tar.gz") > assetPriority("darwin-x86_64", "AtrisShot_0.2.0_x64.dmg"), "macOS updater archive should be preferred");
  assert(assetPriority("darwin-aarch64", "AtrisShot_0.2.0_x64.app.tar.gz") === 0, "Apple Silicon must not receive Intel macOS assets");
  assert(assetPriority("darwin-x86_64", "AtrisShot_0.2.0_aarch64.app.tar.gz") === 0, "Intel macOS must not receive Apple Silicon assets");

  const update = await fetch(`http://127.0.0.1:${port}/api/releases/update/windows-x86_64/0.1.0`);
  assert(update.status === 200, "signed update must be returned");
  const body = await update.json();
  assert(body.signature === "signed-value", "signature missing");
  assert(body.url === "https://shot.atrishub.com/api/releases/download/1", "update URL must use the public proxy");

  const linuxUpdate = await fetch(`http://127.0.0.1:${port}/api/releases/update/linux-x86_64/0.1.0`);
  assert(linuxUpdate.status === 200, "signed Linux update must be returned");
  assert((await linuxUpdate.json()).signature === "linux-signed-value", "Linux signature missing");

  const macosUpdate = await fetch(`http://127.0.0.1:${port}/api/releases/update/darwin-x86_64/0.1.0`);
  assert(macosUpdate.status === 200, "signed macOS update must be returned");
  assert((await macosUpdate.json()).signature === "macos-signed-value", "macOS signature missing");

  const macosArmUpdate = await fetch(`http://127.0.0.1:${port}/api/releases/update/darwin-aarch64/0.1.0`);
  assert(macosArmUpdate.status === 200, "signed Apple Silicon macOS update must be returned");
  const macosArmBody = await macosArmUpdate.json();
  assert(macosArmBody.signature === "macos-arm-signed-value", "Apple Silicon macOS signature missing");
  assert(macosArmBody.url === "https://shot.atrishub.com/api/releases/download/9", "Apple Silicon update URL must use the matching architecture asset");

  const current = await fetch(`http://127.0.0.1:${port}/api/releases/update/windows-x86_64/0.2.0`);
  assert(current.status === 204, "current version must return no update");
  const platformDownload = await fetch(`http://127.0.0.1:${port}/api/releases/download-platform/windows-x86_64`, { redirect: "manual" });
  assert(platformDownload.status === 302, "platform download must resolve a release asset");
  assert(platformDownload.headers.get("location") === "/api/releases/download/1", "platform download must use the public proxy");
});

const previousPublicBaseUrl = process.env.SHOT_PUBLIC_BASE_URL;
process.env.SHOT_PUBLIC_BASE_URL = "http://localhost:3008";
await withReleaseServer(fetchImpl, async (port) => {
  const update = await fetch(`http://127.0.0.1:${port}/api/releases/update/windows-x86_64/0.1.0`, {
    headers: {
      "x-forwarded-host": "shot.atrishub.com",
      "x-forwarded-proto": "https",
    },
  });
  assert(update.status === 200, "forwarded production update must be returned");
  const body = await update.json();
  assert(body.url === "https://shot.atrishub.com/api/releases/download/1", "localhost env must not leak into production updater metadata");
}, "");
if (previousPublicBaseUrl === undefined) {
  delete process.env.SHOT_PUBLIC_BASE_URL;
} else {
  process.env.SHOT_PUBLIC_BASE_URL = previousPublicBaseUrl;
}

const unsignedFetch: typeof fetch = async (input) => {
  const url = String(input);
  if (url.endsWith("/releases/latest")) {
    return Response.json({ tag_name: "v0.3.0", assets: [{ id: 30, name: "AtrisShot_0.3.0_amd64.AppImage.tar.gz" }] });
  }
  return new Response(null, { status: 404 });
};
await withReleaseServer(unsignedFetch, async (port) => {
  const update = await fetch(`http://127.0.0.1:${port}/api/releases/update/linux-x86_64/0.2.0`);
  assert(update.status === 204, "unsigned update assets must fail closed");
});

console.log("AtrisShot release proxy tests passed.");

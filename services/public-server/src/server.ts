import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import dotenv from "dotenv";
import { createReleaseRouter, releaseProxyReady } from "./release-proxy.js";

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

const serviceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(serviceRoot, "public");
const app = express();
const port = Number(process.env.PORT || 3008);
const host = process.env.HOST || "127.0.0.1";

app.disable("x-powered-by");
app.set("trust proxy", "loopback");
app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "atris-shot-public" });
});
app.get("/ready", (_request, response) => {
  const ready = releaseProxyReady();
  response.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "configuration-required",
    service: "atris-shot-public",
    releaseProxyConfigured: ready,
  });
});
app.use("/api/releases", createReleaseRouter());
app.use("/api", (_request, response) => {
  response.status(404).json({ error: "Unknown AtrisShot public API route." });
});
app.use(express.static(publicRoot, {
  extensions: ["html"],
  fallthrough: true,
}));
app.get("*", (_request, response) => {
  response.sendFile(path.join(publicRoot, "index.html"));
});

app.listen(port, host, () => {
  console.log(`[AtrisShot Public] Listening on http://${host}:${port}`);
});

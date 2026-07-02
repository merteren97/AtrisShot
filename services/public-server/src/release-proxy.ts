import { Router } from "express";

type Asset = { id: number; name: string };
type Release = { tag_name?: string; body?: string; published_at?: string; assets?: Asset[] };
type Options = { fetchImpl?: typeof fetch; publicBaseUrl?: string };

export function semverCompare(a: string, b: string) {
  const parse = (value: string) => {
    const match = value.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9]+))?/);
    if (!match) return { core: [0, 0, 0], prerelease: null as number | null };
    return {
      core: [Number(match[1]), Number(match[2]), Number(match[3])],
      prerelease: match[4] === undefined ? null : Number(match[4]),
    };
  };
  const first = parse(a); const second = parse(b);
  for (let index = 0; index < 3; index += 1) {
    if (first.core[index] !== second.core[index]) return first.core[index] > second.core[index] ? 1 : -1;
  }
  if (first.prerelease === second.prerelease) return 0;
  if (first.prerelease === null) return 1;
  if (second.prerelease === null) return -1;
  return first.prerelease > second.prerelease ? 1 : -1;
}

export function assetPriority(platform: string, name: string) {
  const value = name.toLowerCase();
  if (value.endsWith(".sig")) return -1;
  if (platform.includes("windows")) return value.endsWith("-setup.exe") ? 40 : value.endsWith(".msi") ? 30 : 0;
  if (platform.includes("darwin-aarch64") && !/(aarch64|arm64)/.test(value)) return 0;
  if (platform.includes("darwin-x86_64") && !/(x64|x86_64|amd64|intel)/.test(value)) return 0;
  if (platform.includes("darwin")) return value.endsWith(".app.tar.gz") ? 40 : value.endsWith(".dmg") ? 20 : 0;
  if (platform.includes("linux")) return value.endsWith(".appimage.tar.gz") ? 40 : value.endsWith(".appimage") ? 30 : value.endsWith(".deb") ? 20 : 0;
  return 0;
}

export function createReleaseRouter(options: Options = {}) {
  const router = Router();
  const fetchImpl = options.fetchImpl || fetch;
  const owner = () => process.env.SHOT_RELEASE_REPO_OWNER;
  const repo = () => process.env.SHOT_RELEASE_REPO_NAME || "AtrisShot";
  const headers = (accept: string) => ({
    Accept: accept,
    "User-Agent": "AtrisShot-Release-Proxy",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(process.env.SHOT_RELEASE_REPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.SHOT_RELEASE_REPO_ACCESS_TOKEN}` } : {}),
  });
  const latest = async () => {
    if (!owner()) return null;
    const response = await fetchImpl(`https://api.github.com/repos/${owner()}/${repo()}/releases/latest`, { headers: headers("application/vnd.github+json") });
    return response.ok ? await response.json() as Release : null;
  };
  router.get("/download/:id", async (request, response) => {
    if (!/^\d+$/.test(request.params.id) || !owner()) return response.status(404).end();
    const upstream = await fetchImpl(`https://api.github.com/repos/${owner()}/${repo()}/releases/assets/${request.params.id}`, { headers: headers("application/octet-stream"), redirect: "manual" });
    const location = upstream.headers.get("location");
    return location ? response.redirect(302, location) : response.status(502).end();
  });
  router.get("/download-platform/:platform", async (request, response) => {
    const release = await latest();
    const asset = release?.assets
      ?.map((candidate) => ({ candidate, priority: assetPriority(request.params.platform, candidate.name) }))
      .filter((entry) => entry.priority > 0)
      .sort((a, b) => b.priority - a.priority)[0]?.candidate;
    if (!asset) return response.status(404).send("AtrisShot release is not available for this platform.");
    return response.redirect(302, `/api/releases/download/${asset.id}`);
  });
  router.get("/update/:platform/:version", async (request, response) => {
    try {
      const release = await latest();
      if (!release?.tag_name || semverCompare(release.tag_name, request.params.version) <= 0) return response.status(204).end();
      const asset = (release.assets || []).map((candidate) => ({ candidate, priority: assetPriority(request.params.platform, candidate.name) })).filter((entry) => entry.priority > 0).sort((a, b) => b.priority - a.priority)[0]?.candidate;
      const signature = asset && release.assets?.find((candidate) => candidate.name === `${asset.name}.sig`);
      if (!asset || !signature) return response.status(204).end();
      const signatureResponse = await fetchImpl(`https://api.github.com/repos/${owner()}/${repo()}/releases/assets/${signature.id}`, { headers: headers("application/octet-stream") });
      const signatureText = signatureResponse.ok ? (await signatureResponse.text()).trim() : "";
      if (!signatureText) return response.status(204).end();
      const base = (options.publicBaseUrl || process.env.SHOT_PUBLIC_BASE_URL || `${request.protocol}://${request.get("host")}`).replace(/\/$/, "");
      return response.json({ version: release.tag_name.replace(/^v/, ""), pub_date: release.published_at, url: `${base}/api/releases/download/${asset.id}`, signature: signatureText, notes: release.body || "" });
    } catch { return response.status(204).end(); }
  });
  return router;
}

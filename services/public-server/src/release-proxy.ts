import { Router, type Request } from "express";

type Asset = { id: number; name: string };
type Release = { tag_name?: string; body?: string; published_at?: string; assets?: Asset[] };
type Options = { fetchImpl?: typeof fetch; publicBaseUrl?: string };

type ReleaseRepository = { owner: string; repo: string };

const GITHUB_REPOSITORY_SEGMENT = /^[A-Za-z0-9_.-]{1,100}$/;

function isLoopbackBaseUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function normalizeBaseUrl(value: string | undefined, allowLoopback: boolean) {
  const trimmed = value?.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    if (url.username || url.password || url.search || url.hash) return "";
    if (url.pathname !== "/" && url.pathname !== "") return "";
    const loopback = isLoopbackBaseUrl(url.toString());
    if (loopback) {
      if (!allowLoopback || !["http:", "https:"].includes(url.protocol)) return "";
    } else if (url.protocol !== "https:") {
      return "";
    }
    return url.origin;
  } catch {
    return "";
  }
}

// Security boundary: x-forwarded-host and x-forwarded-proto are intentionally
// not used to construct public updater URLs. Production requires an explicit,
// canonical SHOT_PUBLIC_BASE_URL; only loopback development can derive Host.
function localRequestBaseUrl(request: Request) {
  const host = request.get("host")?.trim();
  if (!host) return "";
  const candidate = `${request.protocol}://${host}`;
  return isLoopbackBaseUrl(candidate) ? normalizeBaseUrl(candidate, true) : "";
}

export function resolvePublicBaseUrl(request: Request, configuredBaseUrl?: string) {
  const configured = normalizeBaseUrl(configuredBaseUrl, process.env.NODE_ENV !== "production");
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? "" : localRequestBaseUrl(request);
}

function releaseRepository(): ReleaseRepository | null {
  const owner = process.env.SHOT_RELEASE_REPO_OWNER?.trim() || "";
  const repo = process.env.SHOT_RELEASE_REPO_NAME?.trim() || "AtrisShot";
  if (!GITHUB_REPOSITORY_SEGMENT.test(owner) || !GITHUB_REPOSITORY_SEGMENT.test(repo)) return null;
  return { owner, repo };
}

export function releaseProxyReady() {
  return Boolean(
    releaseRepository() &&
    normalizeBaseUrl(process.env.SHOT_PUBLIC_BASE_URL, process.env.NODE_ENV !== "production"),
  );
}

export function semverCompare(a: string, b: string) {
  const parse = (value: string) => {
    const match = value.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9]+))?$/);
    if (!match) return { core: [0, 0, 0], prerelease: null as number | null, valid: false };
    return {
      core: [Number(match[1]), Number(match[2]), Number(match[3])],
      prerelease: match[4] === undefined ? null : Number(match[4]),
      valid: true,
    };
  };
  const first = parse(a); const second = parse(b);
  if (!first.valid || !second.valid) return first.valid === second.valid ? 0 : first.valid ? 1 : -1;
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
  const headers = (accept: string) => ({
    Accept: accept,
    "User-Agent": "AtrisShot-Release-Proxy",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(process.env.SHOT_RELEASE_REPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.SHOT_RELEASE_REPO_ACCESS_TOKEN}` } : {}),
  });
  const latest = async () => {
    const repository = releaseRepository();
    if (!repository) return null;
    const response = await fetchImpl(`https://api.github.com/repos/${repository.owner}/${repository.repo}/releases/latest`, { headers: headers("application/vnd.github+json") });
    return response.ok ? await response.json() as Release : null;
  };

  router.get("/download/:id", async (request, response) => {
    try {
      const repository = releaseRepository();
      if (!/^\d+$/.test(request.params.id) || !repository) return response.status(404).end();
      const upstream = await fetchImpl(`https://api.github.com/repos/${repository.owner}/${repository.repo}/releases/assets/${request.params.id}`, { headers: headers("application/octet-stream"), redirect: "manual" });
      const location = upstream.headers.get("location");
      return location ? response.redirect(302, location) : response.status(502).end();
    } catch {
      return response.status(502).end();
    }
  });

  router.get("/download-platform/:platform", async (request, response) => {
    try {
      const release = await latest();
      const asset = release?.assets
        ?.map((candidate) => ({ candidate, priority: assetPriority(request.params.platform, candidate.name) }))
        .filter((entry) => entry.priority > 0)
        .sort((a, b) => b.priority - a.priority)[0]?.candidate;
      if (!asset) return response.status(404).send("AtrisShot release is not available for this platform.");
      return response.redirect(302, `/api/releases/download/${asset.id}`);
    } catch {
      return response.status(502).send("AtrisShot release service is temporarily unavailable.");
    }
  });

  router.get("/update/:platform/:version", async (request, response) => {
    try {
      const release = await latest();
      if (!release?.tag_name || semverCompare(release.tag_name, request.params.version) <= 0) return response.status(204).end();
      const asset = (release.assets || []).map((candidate) => ({ candidate, priority: assetPriority(request.params.platform, candidate.name) })).filter((entry) => entry.priority > 0).sort((a, b) => b.priority - a.priority)[0]?.candidate;
      const signature = asset && release.assets?.find((candidate) => candidate.name === `${asset.name}.sig`);
      if (!asset || !signature) return response.status(204).end();
      const repository = releaseRepository();
      if (!repository) return response.status(503).end();
      const signatureResponse = await fetchImpl(`https://api.github.com/repos/${repository.owner}/${repository.repo}/releases/assets/${signature.id}`, { headers: headers("application/octet-stream") });
      const signatureText = signatureResponse.ok ? (await signatureResponse.text()).trim() : "";
      if (!signatureText || signatureText.length > 16_384) return response.status(204).end();
      const base = resolvePublicBaseUrl(request, options.publicBaseUrl ?? process.env.SHOT_PUBLIC_BASE_URL);
      if (!base) return response.status(503).json({ error: "AtrisShot public base URL is not configured securely." });
      return response.json({ version: release.tag_name.replace(/^v/, ""), pub_date: release.published_at, url: `${base}/api/releases/download/${asset.id}`, signature: signatureText, notes: release.body || "" });
    } catch {
      return response.status(204).end();
    }
  });
  return router;
}

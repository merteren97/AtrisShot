import { spawnSync } from "node:child_process";

const MAX_TEXT_BLOB_BYTES = 12 * 1024 * 1024;

function git(args, { input, encoding = "utf8", maxBuffer = 64 * 1024 * 1024 } = {}) {
  const result = spawnSync("git", args, {
    input,
    encoding,
    maxBuffer,
    windowsHide: true,
  });
  if (result.status !== 0) {
    const error = typeof result.stderr === "string" ? result.stderr.trim() : "";
    throw new Error(`git ${args.join(" ")} failed${error ? `: ${error}` : ""}`);
  }
  return result.stdout;
}

function addFinding(target, finding) {
  const key = `${finding.rule}\u0000${finding.object}\u0000${finding.path || ""}`;
  if (!target.keys.has(key)) {
    target.keys.add(key);
    target.items.push(finding);
  }
}

function isLikelyText(buffer) {
  if (buffer.length === 0) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  let zeroes = 0;
  for (const byte of sample) if (byte === 0) zeroes += 1;
  return zeroes / sample.length < 0.01;
}

function isPublicIpv4(value) {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  // Documentation / benchmarking ranges are not production addresses.
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

const criticalPatterns = [
  ["private-key-material", /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/],
  ["github-token", /\b(?:gh[pousr]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255})\b/],
  ["aws-access-key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ["credentialed-database-url", /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[^\s:/@]+:[^\s@/]+@/i],
  ["compact-jwt", /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/],
  [
    "literal-sensitive-assignment",
    /\b(?:JWT_SECRET|DATABASE_URL|DB_PASSWORD|POSTGRES_PASSWORD|SSH_PRIVATE_KEY|TAURI_SIGNING_PRIVATE_KEY|TAURI_SIGNING_PRIVATE_KEY_PASSWORD|WINDOWS_CERTIFICATE_PASSWORD|SHOT_RELEASE_REPO_ACCESS_TOKEN)\b\s*[:=]\s*["']?(?!\s*(?:\$\{|process\.env|env\.|secrets\.|""|'')\b)([^\s"']{8,})/i,
  ],
];

const suspiciousPathPatterns = [
  ["historical-env-file", /(^|\/)\.env(?:\.[^/]+)?$/i, (path) => /\.env\.example$/i.test(path)],
  ["historical-private-key-file", /(?:^|\/)(?:id_rsa|id_ed25519|id_ecdsa|id_dsa)(?:\.[^/]*)?$/i],
  ["historical-certificate-or-key", /\.(?:pem|key|p12|pfx|keystore|jks|mobileprovision|provisionprofile)$/i],
  ["historical-secret-directory", /(^|\/)(?:secrets?|private|credentials?)(\/|$)/i],
];

const critical = { items: [], keys: new Set() };
const review = { items: [], keys: new Set() };

const objectLines = git(["rev-list", "--objects", "--all"])
  .split(/\r?\n/)
  .map((line) => line.trimEnd())
  .filter(Boolean);

const pathsByObject = new Map();
for (const line of objectLines) {
  const space = line.indexOf(" ");
  const object = space === -1 ? line : line.slice(0, space);
  const path = space === -1 ? "" : line.slice(space + 1);
  if (!pathsByObject.has(object)) pathsByObject.set(object, new Set());
  if (path) pathsByObject.get(object).add(path);
}

const objectIds = [...pathsByObject.keys()];
const metadataText = git(
  ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
  { input: `${objectIds.join("\n")}\n` },
);
const metadata = new Map();
for (const line of metadataText.split(/\r?\n/).filter(Boolean)) {
  const [object, type, size] = line.split(" ");
  metadata.set(object, { type, size: Number(size) });
}

for (const object of objectIds) {
  const meta = metadata.get(object);
  if (!meta || meta.type !== "blob") continue;
  const paths = [...(pathsByObject.get(object) || [])];
  const displayPaths = paths.length ? paths : ["<unknown-path>"];

  for (const path of paths) {
    for (const [rule, pattern, exclude] of suspiciousPathPatterns) {
      if (pattern.test(path) && !(exclude && exclude(path))) {
        addFinding(critical, { rule, object, path });
      }
    }
  }

  if (meta.size > MAX_TEXT_BLOB_BYTES) {
    addFinding(review, {
      rule: "large-blob-not-content-scanned",
      object,
      path: displayPaths.join(", "),
    });
    continue;
  }

  const buffer = git(["cat-file", "blob", object], { encoding: null, maxBuffer: MAX_TEXT_BLOB_BYTES + 1024 * 1024 });
  if (!isLikelyText(buffer)) continue;
  const text = buffer.toString("utf8");

  for (const [rule, pattern] of criticalPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      for (const path of displayPaths) addFinding(critical, { rule, object, path });
    }
  }

  const ipv4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  for (const match of text.matchAll(ipv4)) {
    if (isPublicIpv4(match[0])) {
      for (const path of displayPaths) addFinding(review, { rule: "public-ipv4-review", object, path });
      break;
    }
  }

  if (/\/var\/www\/[A-Za-z0-9_.-]+|\bpm2\b|\bself-hosted\b/i.test(text)) {
    for (const path of displayPaths) addFinding(review, { rule: "production-ops-topology-review", object, path });
  }
}

const commitIds = git(["rev-list", "--all"]).split(/\r?\n/).filter(Boolean);
for (const commit of commitIds) {
  const message = git(["show", "-s", "--format=%B", commit]);
  for (const [rule, pattern] of criticalPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(message)) addFinding(critical, { rule: `commit-message-${rule}`, object: commit, path: "<commit-message>" });
  }
}

const identityLines = git(["log", "--all", "--format=%H%x09%ae%x09%ce"])
  .split(/\r?\n/)
  .filter(Boolean);
for (const line of identityLines) {
  const [commit, authorEmail = "", committerEmail = ""] = line.split("\t");
  for (const email of new Set([authorEmail, committerEmail])) {
    if (email && !/@users\.noreply\.github\.com$/i.test(email) && !/^(?:noreply|actions)@github\.com$/i.test(email)) {
      addFinding(review, { rule: "public-commit-email-review", object: commit, path: "<non-noreply-email>" });
    }
  }
}

const print = (label, findings) => {
  console.log(`\n${label}: ${findings.length}`);
  for (const finding of findings) {
    console.log(`- ${finding.rule} | ${finding.object.slice(0, 12)} | ${finding.path || "<no-path>"}`);
  }
};

console.log(`Scanned ${metadata.size} reachable Git objects and ${commitIds.length} commits.`);
console.log("Secret values are intentionally never printed by this audit.");
print("CRITICAL", critical.items);
print("REVIEW", review.items);

if (critical.items.length > 0) {
  console.error("\nHistory audit found critical secret indicators. Rotate/revoke any real credential before considering a history rewrite.");
  process.exitCode = 2;
} else {
  console.log("\nNo critical secret indicator was detected in reachable history. Review-only findings may still contain privacy or topology information.");
}

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const trackedFiles = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const obviousSecretPatterns = [
  ["GitHub classic PAT", /\bghp_[A-Za-z0-9]{30,}\b/g],
  ["GitHub fine-grained PAT", /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g],
  ["private key material", /-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----/g],
  ["PostgreSQL credential URL", /postgres(?:ql)?:\/\/[^:\s/@]+:[^@\s/]+@/gi],
  ["MySQL credential URL", /mysql:\/\/[^:\s/@]+:[^@\s/]+@/gi],
  ["literal JWT secret", /\bJWT_SECRET\s*[:=]\s*["'][^"'${}\n]{8,}["']/g],
];

const ipv4Pattern = /\b(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}\b/g;
const allowedIpv4 = (value) => value.startsWith("127.") || value === "0.0.0.0";

const likelyTextFile = (path) => !/\.(?:png|jpe?g|gif|webp|ico|icns|ttf|woff2?|zip|gz|tar|7z|pdf|exe|msi|dmg|appimage|deb|pfx|p12|sig)$/i.test(path);

const findings = [];
for (const path of trackedFiles.filter(likelyTextFile)) {
  let source;
  try {
    source = await readFile(path, "utf8");
  } catch {
    continue;
  }

  for (const [label, pattern] of obviousSecretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) findings.push(`${path}: ${label}`);
  }

  ipv4Pattern.lastIndex = 0;
  for (const match of source.matchAll(ipv4Pattern)) {
    if (!allowedIpv4(match[0])) findings.push(`${path}: non-loopback IPv4 ${match[0]}`);
  }
}

assert.deepEqual(
  findings,
  [],
  `Public-source server boundary violation(s):\n${findings.map((item) => `- ${item}`).join("\n")}`,
);

console.log("AtrisShot public-source secret scan passed.");

import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const npmCommand = isWindows ? "npm.cmd" : "npm";
const appName = "AtrisShot";
const desktopWorkspace = "@atris-shot/desktop";
const windowsTarget = "x86_64-pc-windows-msvc";
const releaseArtifactsRoot =
  process.env.ATRIS_RELEASE_ARTIFACTS_DIR || path.join(process.env.LOCALAPPDATA || os.homedir(), appName, "release-artifacts");
const updaterPlaceholder = "REPLACE_WITH_PRODUCTION_TAURI_UPDATER_PUBLIC_KEY";

function printHelp() {
  console.log(`AtrisShot Windows release automation

Usage:
  npm run release:windows -- --tag v1.0.1-1
  npm run release:windows -- --tag v1.0.1-1 --publish

Options:
  --tag <version>       Release tag, for example v1.0.1-1
  --target <triple>     Rust target (default: ${windowsTarget})
  --publish              Create/update the GitHub Release and upload assets
  --prerelease           Mark the GitHub Release as prerelease
  --stable               Explicitly mark the GitHub Release as stable
  --skip-install         Reuse the existing node_modules folder
  --allow-dirty          Allow dirty source for a local-only build
  --dry-run              Validate the release environment without building
  --ci                   Use CI cache behavior and persistent runner paths
  --help                 Show this help
`);
}

function parseArgs(argv) {
  const options = {
    allowDirty: false,
    ci: false,
    dryRun: false,
    prerelease: null,
    publish: false,
    skipInstall: false,
    tag: process.env.RELEASE_TAG || "",
    target: process.env.RELEASE_TARGET || windowsTarget,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [name, inlineValue] = argument.split("=", 2);
    const nextValue = inlineValue ?? argv[index + 1];

    if (name === "--help" || name === "-h") {
      options.help = true;
    } else if (name === "--publish") {
      options.publish = true;
    } else if (name === "--prerelease") {
      options.prerelease = true;
    } else if (name === "--stable") {
      options.prerelease = false;
    } else if (name === "--allow-dirty") {
      options.allowDirty = true;
    } else if (name === "--dry-run") {
      options.dryRun = true;
    } else if (name === "--ci") {
      options.ci = true;
    } else if (name === "--skip-install") {
      options.skipInstall = true;
    } else if (name === "--tag" || name === "--target") {
      if (inlineValue === undefined) index += 1;
      if (!nextValue) throw new Error(`${name} requires a value.`);
      if (name === "--tag") options.tag = nextValue;
      else options.target = nextValue;
    } else {
      throw new Error(`Unknown option: ${argument}`);
    }
  }

  if (!options.target.endsWith("-pc-windows-msvc")) {
    throw new Error(`Windows release target must end with -pc-windows-msvc: ${options.target}`);
  }
  if (options.publish && options.allowDirty) {
    throw new Error("--allow-dirty is only valid for a local build; publishing requires a clean worktree.");
  }

  return options;
}

function normalizeTag(rawTag) {
  if (!rawTag) throw new Error("A release tag is required. Use --tag v1.0.1-1.");

  const version = rawTag.trim().replace(/^v/, "");
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid semantic release version: ${rawTag}`);
  }

  const prerelease = version.match(/-(.+)$/)?.[1];
  if (prerelease && (!/^\d+$/.test(prerelease) || Number(prerelease) > 65535)) {
    throw new Error(
      `Windows MSI requires a numeric prerelease identifier from 0 to 65535; use a version such as v1.0.1-1 instead of ${rawTag}.`,
    );
  }

  return { tag: `v${version}`, version };
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
}

function readCargoVersion(relativePath, packageName) {
  const content = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  const escapedName = packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `\\[\\[package\\]\\]\\r?\\nname = "${escapedName}"\\r?\\nversion = "([^"]+)"`,
  ).exec(content);
  if (!match) throw new Error(`${relativePath} does not contain the ${packageName} package.`);
  return match[1];
}

function readReleaseVersions() {
  const packageJson = readJson("package.json");
  const packageLock = readJson("package-lock.json");
  const desktopPackage = readJson("apps/desktop/package.json");
  const tauriConfig = readJson("apps/desktop/src-tauri/tauri.conf.json");
  const cargoToml = fs.readFileSync(path.join(projectRoot, "apps/desktop/src-tauri/Cargo.toml"), "utf8");
  const cargoVersion = cargoToml.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if (!cargoVersion) throw new Error("apps/desktop/src-tauri/Cargo.toml is missing its package version.");

  return {
    rootPackage: packageJson.version,
    rootLock: packageLock.packages?.[""]?.version ?? packageLock.version,
    desktopPackage: desktopPackage.version,
    desktopLock: packageLock.packages?.["apps/desktop"]?.version,
    desktopTauri: tauriConfig.version,
    desktopCargo: cargoVersion,
    desktopCargoLock: readCargoVersion("apps/desktop/src-tauri/Cargo.lock", "atris-shot"),
  };
}

function assertReleaseVersions(expectedVersion) {
  const versions = readReleaseVersions();
  const mismatches = Object.entries(versions).filter(([, value]) => value !== expectedVersion);
  if (mismatches.length > 0) {
    const details = mismatches.map(([source, value]) => `${source}=${value ?? "missing"}`).join(", ");
    throw new Error(
      `Release version mismatch. Expected ${expectedVersion}; mismatched sources: ${details}. ` +
        "Run .github/scripts/apply-release-version.mjs, review the changes, and commit the synchronized version files.",
    );
  }
  return versions;
}

function run(command, args, { allowFailure = false, env = process.env, stdio = "inherit" } = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env,
    shell: isWindows && command.toLowerCase().endsWith(".cmd"),
    stdio,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`Command failed (${result.status}): ${command} ${args.join(" ")}`);
  }
  return result;
}

function commandAvailable(command) {
  const result = spawnSync(command, ["--version"], {
    cwd: projectRoot,
    shell: isWindows && command.toLowerCase().endsWith(".cmd"),
    stdio: "ignore",
    windowsHide: true,
  });
  return !result.error && result.status === 0;
}

function assertRequiredTools(publish) {
  const commands = ["git", npmCommand, "cargo", "rustc"];
  if (publish) commands.push("gh");
  const missing = commands.filter((command) => !commandAvailable(command));
  if (missing.length > 0) throw new Error(`Required release tools are missing from PATH: ${missing.join(", ")}`);
}

function gitStatus() {
  return run("git", ["status", "--porcelain"], { stdio: "pipe" }).stdout.toString().trim();
}

function assertCleanWorktree(allowDirty) {
  const status = gitStatus();
  if (status && !allowDirty) {
    throw new Error(
      "Release build refused because the worktree is not clean. Commit the release source first or use --allow-dirty for a local-only build.\n" +
        status,
    );
  }
}

function assertLocalTagPointsToHead(tag) {
  const tagCommit = run("git", ["rev-list", "-n", "1", tag], { allowFailure: true, stdio: "pipe" });
  if (tagCommit.status !== 0) throw new Error(`Git tag ${tag} is not available locally.`);
  const head = run("git", ["rev-parse", "HEAD"], { stdio: "pipe" }).stdout.toString().trim();
  if (tagCommit.stdout.toString().trim() !== head) {
    throw new Error(`Git tag ${tag} does not point to the checked-out commit. Publishing is stopped.`);
  }

  const mainRefs = ["refs/remotes/origin/main", "refs/heads/main"];
  for (const mainRef of mainRefs) {
    const mainCommit = run("git", ["rev-parse", "--verify", mainRef], { allowFailure: true, stdio: "ignore" });
    if (mainCommit.status !== 0) continue;
    const ancestry = run("git", ["merge-base", "--is-ancestor", "HEAD", mainRef], {
      allowFailure: true,
      stdio: "ignore",
    });
    if (ancestry.status !== 0) throw new Error(`Release tag ${tag} is not on the main branch history.`);
    return;
  }
  throw new Error("The local main branch reference is unavailable; publishing requires a main-based release commit.");
}

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(500);
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.once("timeout", () => finish(false));
  });
}

function defaultLocalCacheRoot() {
  if (isWindows) return path.join(process.env.LOCALAPPDATA || os.homedir(), appName, "release-cache");
  return path.join(os.homedir(), ".cache", appName.toLowerCase(), "release");
}

function configureBuildEnvironment(options) {
  const environment = { ...process.env };
  const configuredRoot = process.env.ATRIS_RELEASE_CACHE_DIR;
  const cacheRoot = configuredRoot || (!options.ci ? defaultLocalCacheRoot() : null);
  if (!cacheRoot) return { environment, cacheRoot: null };

  const absoluteCacheRoot = path.resolve(cacheRoot);
  if (!options.dryRun) fs.mkdirSync(absoluteCacheRoot, { recursive: true });
  environment.CARGO_HOME ??= path.join(absoluteCacheRoot, "cargo-home");
  environment.CARGO_TARGET_DIR ??= path.join(absoluteCacheRoot, "cargo-target");
  environment.npm_config_cache ??= path.join(absoluteCacheRoot, "npm-cache");
  if (!options.dryRun) {
    fs.mkdirSync(environment.CARGO_HOME, { recursive: true });
    fs.mkdirSync(environment.CARGO_TARGET_DIR, { recursive: true });
    fs.mkdirSync(environment.npm_config_cache, { recursive: true });
  }
  return { environment, cacheRoot: absoluteCacheRoot };
}

function configureUpdater(environment) {
  const sourceConfig = readJson("apps/desktop/src-tauri/tauri.conf.json");
  const configuredPublicKey = environment.TAURI_UPDATER_PUBLIC_KEY?.trim();
  const sourcePublicKey = sourceConfig.plugins?.updater?.pubkey?.trim();
  const publicKey = configuredPublicKey || sourcePublicKey;
  if (!publicKey || publicKey === updaterPlaceholder) {
    throw new Error(
      "A production updater public key is required. Set TAURI_UPDATER_PUBLIC_KEY or replace the placeholder in apps/desktop/src-tauri/tauri.conf.json.",
    );
  }

  const existingConfig = environment.TAURI_CONFIG ? JSON.parse(environment.TAURI_CONFIG) : {};
  const mergedConfig = {
    ...sourceConfig,
    ...existingConfig,
    build: { ...sourceConfig.build, ...existingConfig.build },
    bundle: { ...sourceConfig.bundle, ...existingConfig.bundle },
    plugins: {
      ...sourceConfig.plugins,
      ...existingConfig.plugins,
      updater: { ...sourceConfig.plugins?.updater, ...existingConfig.plugins?.updater, pubkey: publicKey },
    },
  };
  environment.TAURI_CONFIG = JSON.stringify(mergedConfig);
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(entryPath) : [entryPath];
  });
}

function findBundleRoot(environment, target) {
  const targetRoot = environment.CARGO_TARGET_DIR
    ? path.resolve(environment.CARGO_TARGET_DIR)
    : path.join(projectRoot, "apps/desktop/src-tauri/target");
  const candidates = [
    path.join(targetRoot, target, "release", "bundle"),
    path.join(targetRoot, "release", "bundle"),
  ];
  return candidates.find((candidate) => walkFiles(candidate).length > 0) || candidates[0];
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function collectReleaseAssets(environment, target, version) {
  const bundleRoot = findBundleRoot(environment, target);
  const assets = walkFiles(bundleRoot)
    .filter((filePath) => /\.(exe|msi|zip|sig)$/i.test(filePath))
    .filter((filePath) => path.basename(filePath).includes(version));
  const installers = assets.filter((filePath) => /\.(exe|msi)$/i.test(filePath));
  const signedBundles = assets.filter(
    (filePath) => /\.(exe|msi|zip)$/i.test(filePath) && fs.existsSync(`${filePath}.sig`),
  );
  if (installers.length === 0) throw new Error(`No Windows installer was produced under ${bundleRoot}.`);
  if (signedBundles.length === 0) {
    throw new Error(`No signed Windows updater bundle was produced under ${bundleRoot}.`);
  }
  return { assets, bundleRoot };
}

function writeReleaseManifest(tag, version, assets, metrics) {
  const outputDirectory = path.join(releaseArtifactsRoot, tag);
  fs.mkdirSync(outputDirectory, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    app: appName,
    tag,
    version,
    assets: assets.map((filePath) => ({
      name: path.basename(filePath),
      relativePath: path.relative(projectRoot, filePath),
      size: fs.statSync(filePath).size,
      sha256: sha256(filePath),
    })),
  };
  const manifestPath = path.join(outputDirectory, "release-manifest.json");
  const metricsPath = path.join(outputDirectory, "build-metrics.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  fs.writeFileSync(metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
  return { manifestPath, metricsPath };
}

function publishRelease(tag, assets, prerelease) {
  const view = run("gh", ["release", "view", tag, "--json", "isDraft", "--jq", ".isDraft"], {
    allowFailure: true,
    stdio: "pipe",
  });
  if (view.status === 0 && view.stdout.toString().trim() !== "true") {
    throw new Error(`Release ${tag} already exists and is not a draft; refusing to overwrite it.`);
  }
  if (view.status !== 0) {
    run("gh", ["release", "create", tag, "--verify-tag", "--draft", "--generate-notes", "--title", `${appName} ${tag}`]);
  }
  run("gh", ["release", "upload", tag, ...assets, "--clobber"]);
  run("gh", ["release", "edit", tag, "--draft=false", `--prerelease=${String(prerelease)}`]);
}

async function main() {
  if (!isWindows) throw new Error("The Windows release workflow must run on Windows.");
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();

  const sourceVersion = readJson("package.json").version;
  const { tag, version } = normalizeTag(options.tag || `v${sourceVersion}`);
  const prerelease = options.prerelease ?? version.includes("-");
  const metrics = {
    app: appName,
    ci: options.ci,
    finishedAt: null,
    startedAt: new Date().toISOString(),
    status: "running",
    steps: [],
    tag,
    target: options.target,
    version,
  };
  let manifestInfo = null;

  const timed = (name, callback) => {
    const startedAt = Date.now();
    try {
      const result = callback();
      metrics.steps.push({ durationMs: Date.now() - startedAt, name, status: "passed" });
      return result;
    } catch (error) {
      metrics.steps.push({ durationMs: Date.now() - startedAt, name, status: "failed" });
      throw error;
    }
  };

  try {
    console.log(`[release] ${appName} ${tag}`);
    console.log(`[release] Mode: ${options.dryRun ? "dry-run" : options.publish ? "build + publish" : "build"}`);
    timed("worktree validation", () => assertCleanWorktree(options.allowDirty));
    const versions = timed("release version validation", () => assertReleaseVersions(version));
    console.log(`[release] Synchronized version: ${versions.rootPackage}`);
    timed("toolchain validation", () => assertRequiredTools(options.publish));
    const { environment, cacheRoot } = configureBuildEnvironment(options);
    configureUpdater(environment);
    console.log(`[release] Cache root: ${cacheRoot || "runner defaults"}`);

    if (await isPortListening(3009)) {
      throw new Error("Port 3009 is active. Stop the AtrisShot dev server before building a release.");
    }
    if (options.publish) timed("release tag validation", () => assertLocalTagPointsToHead(tag));
    if (options.dryRun) {
      console.log(`[release] Dry-run passed. Prerelease: ${prerelease ? "yes" : "no"}.`);
      metrics.status = "passed";
      return;
    }
    if (!environment.TAURI_SIGNING_PRIVATE_KEY) {
      throw new Error("TAURI_SIGNING_PRIVATE_KEY is required to create signed updater artifacts.");
    }
    if (!options.skipInstall) {
      timed("npm ci", () =>
        run(npmCommand, ["ci", "--include=dev", "--include=optional", "--prefer-offline", "--no-audit", "--no-fund"], {
          env: environment,
        }),
      );
    }
    timed("Tauri Windows build", () =>
      run(npmCommand, ["run", "tauri:build", "-w", desktopWorkspace, "--", "--target", options.target], {
        env: environment,
      }),
    );
    const { assets, bundleRoot } = timed("artifact verification", () =>
      collectReleaseAssets(environment, options.target, version),
    );
    manifestInfo = writeReleaseManifest(tag, version, assets, metrics);
    console.log(`[release] Bundle: ${bundleRoot}`);
    console.log(`[release] Manifest: ${path.relative(projectRoot, manifestInfo.manifestPath)}`);
    if (options.publish) timed("GitHub Release publish", () => publishRelease(tag, assets, prerelease));
    metrics.status = "passed";
    console.log(`[release] Produced ${assets.length} Windows release assets.`);
  } catch (error) {
    metrics.status = "failed";
    throw error;
  } finally {
    metrics.finishedAt = new Date().toISOString();
    if (!options.dryRun) {
      const outputDirectory = path.join(releaseArtifactsRoot, tag);
      fs.mkdirSync(outputDirectory, { recursive: true });
      if (manifestInfo) fs.writeFileSync(manifestInfo.metricsPath, `${JSON.stringify(metrics, null, 2)}\n`);
      else fs.writeFileSync(path.join(outputDirectory, "build-metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`);
    }
  }
}

main().catch((error) => {
  console.error(`[release] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

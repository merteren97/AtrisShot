# AtrisShot Windows release security

## Security model

AtrisShot must not keep a repository-level self-hosted GitHub Actions runner attached while the repository is public.

GitHub explicitly warns that public repositories and persistent self-hosted runners are a dangerous combination because untrusted pull requests can potentially execute code on the runner machine. AtrisShot therefore uses GitHub-hosted runners for public CI and keeps Windows local publishing outside GitHub Actions.

Only the repository owner (`merteren97`) should publish production releases or deploy the public service.

## Local Windows build and GitHub Release

The Windows desktop package can be built and published directly from the trusted release machine:

```powershell
# Prepare and review synchronized release versions first.
node .github/scripts/apply-release-version.mjs v1.0.1-1

# Build locally without publishing.
npm.cmd run release:windows -- --tag v1.0.1-1

# Publish the same tag after it has been pushed to GitHub.
gh auth login
npm.cmd run release:windows -- --tag v1.0.1-1 --publish
```

Publishing requires:

- a clean worktree;
- a local tag pointing to `HEAD` in `main` history;
- GitHub CLI authenticated as `merteren97`;
- signing material supplied only through local environment variables.

The release command refuses an active desktop port (`3009`), verifies Windows installers and updater signatures, and writes SHA-256/timing data under `%LOCALAPPDATA%\AtrisShot\release-artifacts` by default. Use `--allow-dirty` only for a local build that will not be published.

Required local environment variables:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = '...'
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '...'
$env:TAURI_UPDATER_PUBLIC_KEY = '...'
```

The public updater key is passed to the Tauri CLI as a build-time `--config` JSON override and is not written into the working tree. Keep all private signing material outside Git. The Authenticode certificate remains optional and can be configured separately when a production certificate is available.

## Public repository rule

Before changing AtrisShot to public:

1. Remove/unregister every repository-level self-hosted runner under `Settings -> Actions -> Runners`.
2. Do not register a persistent self-hosted runner to this public repository later.
3. Run pull-request validation only on GitHub-hosted runners.
4. Keep production deployment and release workflows manual and restricted to `merteren97` on `main`.
5. Prefer the local release command above for Windows publishing.

If a self-hosted runner is ever temporarily required for diagnostics, register it only for the shortest possible maintenance window, do not approve or run pull-request workflows during that window, and remove it immediately afterward. A dedicated disposable machine is preferred.

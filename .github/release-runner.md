# AtrisShot Windows release runner

## Local build and GitHub Release

The Windows path builds only the desktop package locally and can publish signed updater assets to an existing Git tag:

```powershell
# Prepare and review synchronized release versions first.
node .github/scripts/apply-release-version.mjs v1.0.1-1

# Build locally without publishing.
npm.cmd run release:windows -- --tag v1.0.1-1

# Publish the same tag after it has been pushed to GitHub.
gh auth login
npm.cmd run release:windows -- --tag v1.0.1-1 --publish
```

Publishing requires a clean worktree and a local tag pointing to `HEAD` on the `main` history. The command refuses an active desktop port (`3009`), verifies Windows installers and updater signatures, and writes SHA-256/timing data under `%LOCALAPPDATA%\AtrisShot\release-artifacts` by default. Use `--allow-dirty` only for a local build that will not be published.

Required local environment variables:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY = '...'
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '...'
$env:TAURI_UPDATER_PUBLIC_KEY = '...'
```

The public key is injected through `TAURI_CONFIG` for that build and is not written into the working tree. Keep all signing material outside Git. The Authenticode certificate remains optional and can be configured separately when a production certificate is available.

## Automatic self-hosted release

Install a Windows x64 self-hosted runner from `Settings -> Actions -> Runners -> New self-hosted runner`, register the custom label `atrisshot-release`, and install it as a Windows service. Keep the runner installation outside the repository, for example:

```text
C:\actions-runner\AtrisShot
```

The machine needs Node.js 20, Rust MSVC, Visual Studio C++/Windows tooling, WebView2, Git, and GitHub CLI. Inbound port forwarding is not required; the runner only needs outbound HTTPS access to GitHub.

The workflow uses these persistent directories for the service account:

```text
C:\actions-cache\AtrisShot\cargo-home
C:\actions-cache\AtrisShot\cargo-target
C:\actions-cache\AtrisShot\npm-cache
```

Push a synchronized tag to trigger the local runner automatically:

```powershell
git tag v1.0.1-1
git push origin v1.0.1-1
```

The existing `release.yml` remains the manual Windows/Linux fallback and keeps its current target-specific release behavior. It continues to use GitHub-hosted minutes when selected.

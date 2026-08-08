# Security Policy

Security is a release requirement for AtrisShot. Please report suspected vulnerabilities privately and avoid publishing exploit details, credentials, sensitive screenshots, or user data in public issues, discussions, pull requests, or commit messages.

## Supported versions

Security fixes are maintained for the latest published AtrisShot release and the current `main` branch. Older releases may be asked to upgrade rather than receive a backport.

## Reporting a vulnerability

1. Prefer GitHub's **Private Vulnerability Reporting** / repository **Security Advisory** flow when it is available for this repository.
2. Include the affected version or commit, platform, impact, reproduction conditions, and the smallest proof of concept needed to understand the issue.
3. Do **not** include real access tokens, signing keys, SSH material, account passwords, private screenshots, or unrelated personal data. Use clearly fake test values.
4. Do not open a public issue containing exploit details. If private reporting is temporarily unavailable, open only a minimal public issue asking the repository owner for a private security contact, without disclosing the vulnerability itself.

Reports involving any of the following are especially important:

- arbitrary local-file read/write or path traversal from the Tauri webview;
- authentication or AtrisHub session-token exposure;
- updater signature or release-channel bypass;
- GitHub Actions, release-signing, deployment, or supply-chain compromise;
- command/capability privilege escalation between AtrisShot windows;
- cross-site scripting or CSP bypass that reaches native IPC;
- unsafe handling of screenshots, local history, annotations, or configured save paths;
- vulnerabilities in the public release/download proxy.

## Disclosure process

The maintainer will validate the report, determine affected versions, prepare a fix, and coordinate disclosure. Please allow a reasonable remediation window before publishing details. A GitHub Security Advisory may be used for collaboration, CVE coordination, and release notes when appropriate.

## Security boundaries

AtrisShot is designed as a local-first desktop application:

- screenshots, edit history, annotations, and saved paths remain local by default;
- AtrisHub is an external identity/account-verification boundary, not part of this repository's server implementation;
- production credentials, signing private keys, SSH keys, and deployment secrets must never be committed to this repository;
- updater artifacts must remain cryptographically signed and release/deploy automation must preserve least-privilege permissions;
- public pull requests must never receive production secrets or execute on a persistent maintainer-owned self-hosted runner.

## Dependency reports

If a report is only about an upstream dependency, include the upstream advisory identifier and explain whether AtrisShot is actually reachable/affected. This helps distinguish exploitable product issues from dependency-only findings.

## Safe-harbor intent

Good-faith security research that respects user privacy, avoids data destruction or service disruption, uses only accounts/systems you are authorized to test, and follows coordinated disclosure is welcome. This policy does not authorize testing against third-party services such as AtrisHub beyond access you already have permission to use.

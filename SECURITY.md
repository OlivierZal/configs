# Security policy

If you discover a security vulnerability in this package, please report it
privately via [GitHub security advisories](https://github.com/OlivierZal/configs/security/advisories/new)
instead of opening a public issue.

Only the latest published release receives security updates.

## What this package is, for triage

This is development tooling: ESLint, Prettier, TypeScript and Typedoc
presets, plus the reusable GitHub Actions workflows the consuming
repositories call. Nothing it publishes reaches a runtime — consumers
declare it as a `devDependency`, so it never installs under
`npm ci --omit=dev`.

Two consequences for a report:

- A vulnerability here lands in a **build environment**, not in a shipped
  artifact. That widens rather than narrows the impact worth reporting:
  the reusable workflows run with repository credentials, so anything
  touching secret handling, workflow permissions, or the pinned actions
  in `.github/workflows` is in scope even when no published code changes.
- The workflows are consumed by pinned commit SHA. A malicious change
  reaches a consumer only when that consumer moves its pin, which is a
  reviewed pull request — but the window between a compromised release
  and its adoption is exactly what a report should shorten.

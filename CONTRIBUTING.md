# Contributing

Thanks for considering a contribution. This document describes the local
workflow expected before opening a pull request.

## Prerequisites

- Node.js matching `engines.node` in [`package.json`](package.json) —
  currently `^22.22.2 || >=24.15.0`, the floor the installed tree itself
  imposes rather than a round number
- npm 10+

No registry token is needed: this package has no `@olivierzal` scoped
dependency of its own, so `npm ci` runs against the public registry.

## Setup

```sh title="setup"
git clone https://github.com/OlivierZal/configs.git
cd configs
npm ci
```

## Local checks

Run the same suite CI runs on every pull request:

```sh title="checks"
npm run typecheck       # native TypeScript 7, --noEmit
npm run lint            # ESLint, self-hosted on this package's own preset
npm run format          # prettier --check (npm run format:fix to write)
npm test                # vitest run
npm run test:coverage   # vitest run --coverage (must remain at 100%)
npm run lint:package    # build + publint --strict
```

`prepublishOnly` chains tests, typecheck, lint and format, so publishing
without them passing is impossible.

`typecheck` and `build` spell the compiler out as
`node ./node_modules/@typescript/native/bin/tsc`, and must keep doing
so: the native 7.x compiler installs no `.bin` shim, while `tsc` and
`tsc6` both run the TypeScript 6 compat package — kept only for the
tools that import its JS API (typescript-eslint, typedoc), never to
compile this one. A script shortened to a bare `tsc` swaps the compiler
without failing.

## Coverage

Branches, functions, lines and statements are all enforced at **100%** in
[`vitest.config.ts`](vitest.config.ts). New code must arrive with the
tests that keep those thresholds green.

## Two channels, one version

This repository publishes on two channels that must never disagree: the
npm package, and the reusable workflows consumers reference by commit
SHA. A single version covers both, and `scripts/check-pins.sh` fails when
they diverge. A change that moves one must move the other in the same
commit.

## Changing a preset is changing seven repositories

Every rule, option and workflow input here is consumed by six other
repositories plus this one. Two habits follow:

- A rule evaluated and refused stays as a config-level `'off'` carrying a
  one-line reason. That is a triage ledger, not a suppression — and a
  ledger entry is re-examined when its stated reason expires.
- A breaking change to a workflow input, a job name, or a required status
  check name forces every consumer to move in lockstep. Say so in the
  pull request, and prefer an additive shape when one exists.

## Commits & pull requests

- **The pull request title is the commit that lands.** Squash merging is
  the only merge method and it takes the PR title, so the title must
  follow [Conventional Commits](https://www.conventionalcommits.org) —
  the required `PR title` check enforces it. Individual commit messages
  inside the branch are free-form.
- Keep pull requests focused: one concern each.
- **Companion docs are part of done.** A pull request that changes
  behaviour, a preset's surface, a requirement or a process updates the
  affected companion files — [`README.md`](README.md),
  [`CLAUDE.md`](CLAUDE.md), this file, [`SECURITY.md`](SECURITY.md) — in
  the same pull request, never in a later sweep.
- Breaking changes: call them out explicitly in the description.

## Releases and the changelog

There is deliberately **no `CHANGELOG.md`** here. The changelog channel is
the GitHub release notes, written per release and covering what consumers
must do to adopt it — a package whose every version obliges six
repositories to act needs its notes to read as adoption instructions, not
as a commit digest. Keeping a second, file-based history would mean
maintaining the same content twice and letting the two drift.

Releases are cut by the maintainer through GitHub Releases; `publish.yml`
then publishes to GitHub Packages. Versions follow
[SemVer](https://semver.org), counted against the consumer contract:
removing a workflow input, renaming a job, or changing which checks a
gate demands is breaking even when no exported type moves.

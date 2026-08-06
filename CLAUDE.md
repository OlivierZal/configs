# CLAUDE.md

Shared tooling for the OlivierZal repo family (three Homey apps, two
API libraries), on two delivery channels: the npm package
`@olivierzal/configs` (eslint/prettier/tsconfig/typedoc/vitest presets,
compiled to `dist/`) and reusable GitHub workflows referenced by git
tag. `vX.Y.Z` tags serve both channels — bump once, release once.

## The boundary (the reason this package exists at all)

- The presets carry FAMILY policy: everything measured identical across
  the five consumers, parameterized only by measured deltas (globs,
  wire-naming entries, coverage leg).
- Per-repo verdicts stay per-repo: documented `'off'` ledgers, ignores,
  and any rule adjustment with a repo-local reason live in each
  consumer's overlay, never here. Moving a verdict here silently
  imposes it on four other repos.
- `outDir` never enters the tsconfig bases: paths in an extended
  tsconfig resolve relative to the BASE file (inside `node_modules` for
  consumers). Pinned by a test.

## Commands

- `npm run format` / `format:fix` — prettier (self-hosted config).
- `npm run lint` / `lint:fix` — eslint, self-hosted on this package's
  own `library` preset (dogfooding). The overlay documents this repo's
  two structural verdicts: peer-tool imports (a config package imports
  eslint/prettier as peers by design) and prettier's default-export
  protocol for `src/prettier`.
- `npm run typecheck` — tsc, strict + isolatedDeclarations.
- `npm test` / `test:coverage` — vitest: structural preset assertions,
  a REAL floor lint run (mutation: iterator helpers and the `v` flag
  must be flagged by `homey-app`, absent from `library`), tsconfig-base
  pins.
- `npm run lint:package` — build + publint --strict.

## Consumers & adoption

Exact pins only (family doctrine): a release lands through one
adoption PR per consumer, which proves iso-behavior with
`eslint --print-config` diffs before/after on representative files.
Reusable-workflow callers reference tags, never `@main`.

## Process

Same family doctrine as every repo: Conventional-Commits PR titles
(the squash commit IS the title), suites green before push, zero-issue
zero-duplication Sonar bar if wired, docs updated in the same PR, and
every substantive wave ends with a targeted cleanup/simplification
pass over its own diff.

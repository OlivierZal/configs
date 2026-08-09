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
- Path-bearing options (`outDir`, `rootDir`, `include`) never enter the
  tsconfig bases: paths in an extended tsconfig resolve relative to the
  BASE file (inside `node_modules` for consumers), so a base carrying
  them resolves an empty file list. Pinned by a test.

## Naming doctrine

- Strict core, scoped departures. Properties are camelCase by default;
  the only softenings are the Homey preset's capability-id-shaped keys
  (platform-imposed), each repo's filter-scoped `wireNamingEntries`,
  and the test block's widened property formats. The core NEVER
  loosens family-wide — and no consumer re-derives the policy locally:
  a hand-kept copy is how one app's overlay silently drifted lax while
  claiming to be stricter.
- `wireNamingFiles` emits the scoped block FROM the preset because
  `naming-convention`'s option array replaces rather than merges: a
  consumer narrowing the vocabulary by hand would restate the whole
  family policy (boolean prefixes, unused-parameter underscores,
  quoted-key exemption), which is the shape that drifts. The caller
  names its files, never the policy.
- Every wire filter is anchored (`^…$`): a filtered entry outranks the
  core's `requiresQuotes` exemption, so an open-ended `^[A-Z]` filter
  once captured quoted `'Content-Type'` headers and demanded a rename.
- Wire exceptions are exact-name allowlists justified by the protocol
  that imposes them (API field, payload key, platform vocabulary) —
  anything of our own naming gets renamed, not excused.

## Pin doctrine

- Version comments are verified, never trusted. Dependabot has
  maintained them since 2022, but it never corrects a comment that is
  already wrong and only rewrites one the version ends — so an
  unverified comment is disinformation, worse than none. The check
  re-derives the truth from the upstream on every run and fails closed
  when refs are unreadable: a lookup outage must not bless the very
  claims it can no longer verify.
- `# untagged: <reason>` records a verified FACT (no tag reaches the
  pinned commit), not an opt-out: the check queries the upstream and
  fails when some tag does reach it (naming that tag) or when the
  reason is empty. Dependabot is documented to move such a pin to
  another untagged branch HEAD, comment untouched
  ([dependabot-core#14716](https://github.com/dependabot/dependabot-core/issues/14716))
  — harmless here, since the claim is re-derived on every run and a
  version comment is demanded the moment a tag reaches the commit.
- Prefer re-pinning to a real tag over `untagged:` when the delta is
  proven inert (diff the commits); the annotation is the last resort
  for upstreams where the tagged commit is genuinely unusable.
- Refs to THIS repo may never use `untagged:` (every release is
  tagged — it could only dodge the two-channel agreement), and their
  comment tag must equal the consumer's `@olivierzal/configs` npm pin:
  one version covers both channels. One ecosystem pilots the bump —
  Dependabot proposes the npm pin and the workflow refs follow in the
  SAME branch; the consumer's `github-actions` ecosystem ignores
  `OlivierZal/configs`, because two separate ecosystem PRs would each
  fail the two-channel check and deadlock.

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
Reusable-workflow callers reference tags, never `@main`. A release
that CHANGES policy (a naming tightening, a new floor) is the
opposite: every diff is a deliberate, per-repo-classified change —
and the dependabot-fix guidance tells the fixer to stop and leave the
PR red when a bump crosses such a release.

## Process

Same family doctrine as every repo: Conventional-Commits PR titles
(the squash commit IS the title), suites green before push, zero-issue
zero-duplication Sonar bar if wired (verified on BOTH windows before
merge, not after), docs updated in the same PR, and every substantive
wave ends with a targeted cleanup/simplification pass over its own
diff. README speaks to the package CONSUMER (install, wiring,
reference); this file speaks to the MAINTAINER (rules, their reasons,
the incidents behind them) — a rule stated in both must say the same
thing, and doctrine evolves HERE first.

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

## CI matrix doctrine

- A comment asserting an invariant is not a mechanism. `reusable-ci`
  claimed its coverage leg "stays blocking so the quality gate cannot
  be skipped silently" while nothing held the claim up: the leg is
  selected by comparing `coverage-node-version` against each
  `matrix.node-version`, and a value no leg carries matches nothing —
  no coverage, no Sonar upload, three green legs, and nothing missing
  to notice, since `Test (Node latest)` and SonarCloud are outside
  every repo's required set. `scripts/check-coverage-leg.sh` now
  re-derives the agreement on every run, in the check job, which IS a
  required context everywhere. Read every other workflow comment the
  same way: what enforces this?
- `node-versions` entries are quoted strings, and the check refuses
  anything else rather than tolerating it. `22.20` unquoted is JSON for
  the number 22.2: it installs the 22.2 line and is compared as
  `"22.2"`, so one missing pair of quotes buys both a wrong runtime and
  a skipped quality gate.
- Each entry names a required status check (`Test (Node <entry>)`) in
  every consumer's ruleset. Changing the list renames contexts that
  then never report, and a required context that never reports blocks
  every merge — a caller changing it updates its ruleset in the same
  move. The default list is test-pinned for that reason.
- `Test (Node latest)` must stay OUT of the required contexts: its
  `continue-on-error` keeps the RUN green, not the check run. Verified
  holding on all seven repos (2026-08); deliberately NOT automated —
  reading rulesets needs an `administration: read` token on every CI
  run of every repo, which is a standing credential for a setting that
  changes once a decade. `latest` is a moving target, so requiring it
  would hand every Node release the power to block every merge in the
  family for a break that is not ours. An early-warning leg, not a gate.

## Sonar gate doctrine

- The free-tier quality gate is NOT the house bar and cannot be made
  into it: it tolerates 3 % duplication on new code, lets code smells
  through, and is not customizable. So the `Sonar` job reads the
  metrics themselves — `violations`, `security_hotspots`,
  `duplicated_lines_density`, `coverage` and their `new_*` twins — on
  BOTH windows. `qualityGateStatus` is never consulted.
- Anything the gate could not read is a failure, never a pass. An
  absent metric, an unreachable API, an analysis that never appeared:
  each fails with its own diagnosis, because a gate that greens what it
  did not verify is worse than none — it converts an unchecked merge
  into a documented one. It also means a wrong metric name surfaces
  loudly on the first run instead of passing forever.
- Coverage is owed only where there is something to cover, which the
  payload states through `lines_to_cover` / `new_lines_to_cover`. A
  window of workflow YAML and shell carries new lines and no coverable
  one; demanding a ratio there would fail on the analyser's language
  support rather than on the code.
- SonarCloud never runs on a Dependabot pull request, and this house
  does not undo that: Dependabot-triggered workflows get no repository
  secrets by GitHub's design, and the job that would hold the token is
  the job that installs the very dependency version under review. So
  the gate ACCEPTS such a pull request only after establishing that
  every commit on it is Dependabot's own and that it touches nothing
  but manifests and pinned references. That clause is not decorative:
  the family's dependabot-fix workflow pushes Claude's fixes onto
  exactly these branches, and such a commit would otherwise reach
  `main` having been read by no analysis at all. Whatever the clause
  lets through is analysed anyway by the push build on `main`, where
  the gate runs unconditionally.
- A fork pull request cannot be verified either, and there the gate
  FAILS rather than waving it through — a fork carries source.
- The context is `ci / Sonar` and the name must not move: it lands in
  seven rulesets, and a required context that never reports blocks
  every merge. Adopt in two steps — ship the version, watch the job
  report correctly on real pull requests, THEN add the context to the
  rulesets. Adding it first would gate merges on a job whose API
  assumptions have never run.

## Audit doctrine

- `--omit=dev` is the whole scope: only what reaches the device counts.
  Measured 2026-08 — four of the five consumers carry zero production
  advisories, so a strict floor costs one exception line family-wide.
- The floor is `low`, not `high`. `--audit-level=high` was honest about
  its own contract and still shipped vulnerable code:
  `com.melcloud.extension` carries four `moderate` advisories on the
  device and audited green. Raising a threshold hides findings without
  recording that anyone looked.
- A permanent red is not a signal either — it gets ignored, then it
  masks the real one. So the floor drops AND every survivor is named:
  `audit-exceptions` takes one `GHSA-…` id per line with the reason it
  is tolerated. Same doctrine as the lint triage ledger — a recorded
  verdict, never a suppression.
- Three properties make it a verdict rather than a mute. The id is the
  ADVISORY, never the package, so a new finding in an already-excepted
  dependency still fails. A reason is mandatory. And an entry whose
  advisory no longer appears FAILS: an exception that outlives its cause
  misrepresents what was reviewed, and upstream fixes are exactly when
  nobody thinks to look.
- `npm audit` exits non-zero precisely when it finds something, so the
  report is written to a file, never piped: a pipeline conflates "found
  advisories" with "could not run". Every unreadable report — npm error
  object, empty, non-JSON, foreign document, absent file — fails. A gate
  must never report a clean run it did not perform.
- Upstream advisories are NOT worked around in our code. No `overrides`,
  no defensive branch: a workaround is a permanent certain cost against
  a rare risk that is not ours, and it outlives its cause — upstream
  fixes, the workaround stays as invisible debt. The verdict lives in
  the audit config alone. If exposure ever looks serious, that is a
  decision to escalate, not to code around.

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

## Plugin triage — evaluated once, here

Whole-plugin verdicts, held to the same bar as rules: strict adoption
(everything adopted runs at `error`), refusals recorded with their
reason, re-evaluated when the reason expires. Maintenance is a gate —
an unmaintained plugin is refused regardless of coverage — but none of
the three below fails it: all are active under eslint-community.

- **eslint-plugin-n — REFUSED, owned by the CI matrix and real
  coverage.** The fleet measurement put every device on the same Node
  class the CI matrix already tests (the `Test (Node 22)` leg), and the
  100 % real-coverage bar makes every shipped line EXECUTE under that
  Node in CI — a dynamic, exhaustive check the plugin's static
  approximation cannot beat; what it would add reduces to earlier
  editor feedback. Adopted once (1.5.0, stillborn: zero consumers ever
  pinned it) and reverted in 1.6.0. The first of its two named gaps —
  a CI leg floating to the newest 22.x while devices sit on a specific
  minor — is closed by the `node-versions` input (1.8.0): the CI change
  the verdict called for, available to every caller that pins its fleet
  minor. The second closes as the real-coverage campaign reaches all
  three apps. Re-adopt if the fleet's Node ever drops below the tested
  matrix, or if the coverage bar recedes.
- **eslint-plugin-promise — REFUSED, owned.** `catch-or-return` /
  `always-return` by the type-aware `no-floating-promises`,
  callback-misuse by `no-misused-promises`, `prefer-await-to-then` by
  `unicorn/prefer-await`. Its one unique rule, `no-multiple-resolved`,
  polices hand-written executors — the family has two, both in the kit
  and pinned by its tests. Re-evaluate if hand-written executors
  multiply.
- **eslint-plugin-security — REFUSED, owned and noisy.** Taint-style
  analysis is owned by CodeQL and SonarCloud, active and BLOCKING on
  all seven repos, flow-aware where this plugin is syntactic. Its
  unique remainder is the noise set (`detect-object-injection` flags
  every computed access; `detect-non-literal-regexp` would condemn the
  route-guard kernels, `detect-non-literal-fs-filename` the manifest
  reader). Re-evaluate only if the CodeQL/Sonar gates ever drop.

## The HTML formatting handover

The family rule everywhere else — the formatter formats, the linter
lints — reaches HTML too, and reaches it BY HAND.
`eslint-config-prettier` is what normally performs the handover;
measured against the installed plugin, it disables 358 rules and
**zero** `html/` ones. So the `html/` split lives in `homey-app`'s
ledger, entry by entry, each naming which of two reasons retires it:

- **redundant** — Prettier's output already satisfies the rule
  (`class-spacing`, `element-newline`, `lowercase`,
  `no-extra-spacing-text`, `no-multiple-empty-lines`,
  `no-trailing-spaces`, `quotes`);
- **conflicting** — Prettier's output VIOLATES the rule, so keeping it
  would fail every formatted file (`attrs-newline`; `indent`, Prettier
  indents two where the rule wants four; `no-extra-spacing-tags` and
  `require-closing-tags`, both tripped by the ` />` Prettier writes on
  void elements).

The conflicting half is the load-bearing discovery: one Prettier pass
over a settings page that lints clean today raised 78 errors, from
those four rules and nothing else. Three rules that LOOK like
formatting are kept for the mirror reason — Prettier does not do them,
so dropping them would drop the convention itself: `head-order` (never
reorders `<head>`), `sort-attrs` (preserves the attribute order it is
given) and `no-whitespace-only-children`. `require-closing-tags` is the
one that deserved an argument rather than a reflex: its name suggests
validity, but the spec makes a trailing slash on a void element
meaningless, not invalid — both spellings parse to the same DOM, so it
is style, and style is Prettier's.

`tests/unit/presets.test.ts` locks it with a real `format` call, both
ways: Prettier's own output must lint clean, a misformatted page must
raise nothing, and an invalid ARIA role must still be reported. Adding
an `html/` rule means classifying it the same way — and one that
Prettier neither guarantees nor contradicts belongs at `error`.

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

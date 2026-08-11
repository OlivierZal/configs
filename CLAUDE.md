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
- This package's `engines` is NOT the device floor the three runtime
  packages declare — nothing here reaches a Homey, so it answers a
  different question: what does the toolchain need in order to install
  and run? That makes it derived from the dependency tree, never copied
  from a sibling. Measured 2026-08: `eslint-plugin-package-json` requires
  `^22.22.2 || >=24.15.0`, so the long-standing `>=22.19.0` declared a
  floor this package could not actually install on, and `.nvmrc` sent
  every fresh clone there. Both now name the derived value; re-derive it
  when the tree moves rather than nudging it by hand.

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

- Removing a defect class beats guarding it. Two independent inputs
  that must agree — a matrix of versions, and a separate
  `coverage-node-version` compared against it — can always disagree, and
  that disagreement was silent: no coverage, no Sonar upload, three
  green legs, nothing missing to notice, since `Test (Node latest)` and
  SonarCloud are outside every repo's required set. Carrying the flag
  inside the leg (`matrix.include`, `coverage: true`) leaves nothing to
  misspell, and shrank the guard that watched for it from 285 lines to
  a count. Prefer this move wherever two inputs are required to match.
- A comment asserting an invariant is not a mechanism. Read every
  workflow comment the same way: what enforces this?
- `node-versions` versions are quoted. `22.20` unquoted is JSON for the
  number 22.2, which installs the 22.2 line — but it now also renames
  the leg to `Test (Node 22.2)`, so the required context of the right
  name never reports and the merge blocks. Loud, so unguarded: a second
  diagnosis of an already-noisy failure is upkeep with no reader.
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

- The bar lives in the `Olivierzal way` quality gate, the organisation
  default on the Team plan, stated ONCE for every project instead of
  restated in each consumer's CI: `violations`,
  `duplicated_lines_density` and their `new_*` twins at 0,
  `coverage`/`new_coverage` at 100, `security_hotspots_reviewed` and its
  `new_*` twin at 100.
  - Hotspots are the one axis the platform will not take literally:
    SonarCloud refuses `security_hotspots` as a gate condition
    («cannot be used to define a condition») because it models hotspots
    as a review workflow, not a defect count. `*_reviewed` at 100 % is
    the expressible form — and the stronger one, since it demands a
    recorded human verdict rather than forbidding a flagged pattern.
    With zero hotspots the measure reads 100, so the condition is
    vacuously satisfied.
- The SCANNER holds the bar, not a script. The scan step passes
  `-Dsonar.qualitygate.wait=true`, so it blocks on the analysis task it
  just submitted and exits non-zero when the gate rejects it. A
  violation therefore fails the coverage leg — already a required
  context — naming the commit that caused it, and no CI code re-reads a
  verdict the platform has already published. Waiting on its OWN task is
  also what makes that verdict unmistakably this commit's, which a poll
  over recent analyses had to reconstruct.
- ONE window per event, each answering for what it can cause — the same
  split by TIME as the dependency doctrine below. It is the platform's
  own split, not a decision made here: SonarCloud holds a pull request
  analysis to the new-code conditions and a branch to both. It lands
  where the house reasoning did. A pull request answers for the code it
  introduces, which is Clean as You Code and is enough alone: every
  change lands through a gated pull request, so an overall at zero stays
  at zero by induction. The single drift that escapes the induction is
  an analyser update raising issues on untouched code; no pull request
  causes it, so it surfaces on `main`, where it is loud and blocks no
  review it has nothing to do with. No scheduled sweep re-asks the
  question: every push to `main` already evaluates both windows, so a
  weekly one would only re-read what the last merge measured.
- An EMPTY window is not an UNVERIFIED one, and that is now the
  PLATFORM's distinction rather than ours. Sonar analyses no Markdown,
  so a documentation-only pull request comes back without a single
  line-derived figure — a measure with no subject, not a measure that
  failed — and a condition with no measure cannot reject. Measured
  2026-08: a `CHANGELOG.md`-only pull request returns `new_coverage`
  absent and the gate `OK`. Reading those payloads by hand cost this
  house a correction; the gate needs none.
- SonarCloud never runs on a Dependabot pull request, and this house
  keeps it that way BY CHOICE: a path exists — on Dependabot-triggered
  runs `secrets.*` resolves from the Dependabot secrets store, so
  registering `SONAR_TOKEN` there would make these pull requests
  genuinely analysed — and it is refused on threat model, not
  inexistence. The token would enter the environment of the job that
  installs the very dependency version under review, and scoping it to
  the scan step does not close that (an install script can poison
  `$GITHUB_ENV` and read a later step's environment), on top of a
  second secrets store to rotate across the family. Re-evaluate if
  that model changes. Nor is the `workflow_run` split worth it — an
  unprivileged job producing a coverage artefact and a privileged one
  scanning it — since it adds a second workflow to seven repos and
  check-run plumbing back to the pull request, strictly more machinery
  than the exemption it would retire. So
  the gate ACCEPTS such a pull request only after establishing that
  every commit on it is Dependabot's own. That clause is not
  decorative: the family's dependabot-fix workflow pushes Claude's
  fixes onto exactly these branches, and such a commit would otherwise
  reach `main` having been read by no analysis at all.
  - AUTHORSHIP is the whole check, and the file allowlist that used to
    accompany it is gone. Dependabot authors manifests, lockfiles and
    pinned references — never source — so its own commits cannot move a
    metric; the list restated that and let a grouped pull request
    rewrite a whole workflow anyway, which is false comfort rather than
    depth. Whatever the clause lets through is analysed by the push
    build on `main` regardless.
- A fork pull request cannot be verified either, and there the gate
  FAILS rather than waving it through — a fork carries source.
- The context is `ci / Sonar` and the name must not move: it lands in
  seven rulesets, and a required context that never reports blocks
  every merge. Adopt in two steps — ship the version, watch the job
  report correctly on real pull requests, THEN add the context to the
  rulesets. Adding it first would gate merges on a job whose API
  assumptions have never run.

## Dependency doctrine

- The split is by TIME, not by tool. A pull request answers for the
  dependencies it introduces — `dependency-review.yml`, diff-shaped,
  blocking. Everything already there is Dependabot's, continuously. An
  advisory that predates a pull request is not that pull request's doing,
  and gating on it would block innocent work for an event outside it —
  the same reason `Test (Node latest)` is not a required context.
- `fail-on-scopes: runtime` is the whole scope: only what reaches the
  device counts. The scope comes from the dependency graph, so nothing
  here maintains a prod/dev split — and Dependabot applies the same one
  natively, auto-dismissing development findings including `high` ones.
- `fail-on-severity: low`, never a raised floor. A threshold hides
  findings without recording that anyone looked. Measured 2026-08:
  `com.melcloud.extension` shipped four `moderate` advisories to the
  device while `--audit-level=high` reported green.
- A tolerated advisory is dismissed ON THE ALERT, with one of GitHub's
  reasons and a written justification. That beats the list this repo used
  to keep, for a structural reason worth stating: a dismissal has no
  existence apart from its advisory, so it CANNOT outlive its cause. The
  expiry machinery a separate list needs is machinery the separate list
  created. Verified 2026-08 — `com.melcloud.extension` already carried
  such a dismissal for `GHSA-6fx8-h7jm-663j`, predating the script that
  reimplemented it.
- Upstream advisories are NOT worked around in our code. No `overrides`,
  no defensive branch: a workaround is a permanent certain cost against
  a rare risk that is not ours, and it outlives its cause — upstream
  fixes, the workaround stays as invisible debt. If exposure ever looks
  serious, that is a decision to escalate, not to code around.
- `npm audit` is not the reference and never was: it counts one entry per
  package along a transit chain, reporting four advisories where the
  platform sees the one that exists.
- The general lesson, which cost ~600 lines: before building a mechanism,
  establish what the platform already does. Every property this repo
  built and defended — scope filtering, named exceptions, mandatory
  reasons, expiry — existed natively, and one of them had already been
  used here.

## Reusable-workflow blind spot

- A reusable workflow whose only proof is this repository is untested
  where it actually runs. The scripts resolve from
  `node_modules/@olivierzal/configs/scripts/…` with a `scripts/` fallback
  beside it, and this repo has no dependency on itself — so THIS repo
  exercises the fallback while every caller exercises the primary path.
  A defect on the primary path is invisible from here, and one shipped:
  a job that skipped the install passed here and died at exit 127 in
  every caller.
- `tests/unit/workflow-script-resolution.test.ts` holds both halves —
  every job reading the package path installs, the set of such jobs is
  named so the assertion cannot pass over an empty set, and `files`
  carries the directory callers read. Static, because no run from here
  could ever fail.
- What it does NOT cover is a caller that never copied
  `.github/actions/setup-node-and-install`; that stays a known blind
  spot, cheap to detect (the run fails immediately) and not worth a
  cross-repo probe.

## Commands

- `npm run build` — purges `dist` before emitting, because `tsc` overwrites
  but never deletes: a module renamed or removed in `src` would otherwise
  survive in `dist`, and `files` ships that directory, so `prepare` would
  pack the fossil. The purge is inline rather than a `prebuild` hook so it
  cannot be skipped with `--ignore-scripts`.
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
  analysis is owned by CodeQL and SonarCloud, flow-aware where this
  plugin is syntactic. Both run on all seven repos; only `ci / Sonar`
  is a required context — CodeQL reports without blocking, and making
  it block is its own decision, not something this entry assumes. Its
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

## The iOS floor watch

`ios-floor-watch.yml` re-reads, monthly and on dispatch, the fact the
`homey-app` preset derives its webview floor from: the Homey mobile
app's App Store iOS minimum (iTunes Lookup API, track id 1435800024 —
JSON, no scraping). The recorded value lives in the workflow beside the
docstring's (16.4, read 2026-08-11) and the two move only together. Any
other answer opens ONE issue naming the verdict — below 17 the
derivation only needs restating, at 17 the `v` ban stops being
derivable, at 17.4 the whole es2023 floor does — and an empty or
unreadable answer fails the run: an unread floor must not read as a
holding one. Re-deriving is a doctrine change (a policy-crossing
release per the adoption doctrine), never a mechanical bump.

## Governance files

`SECURITY.md` and `CONTRIBUTING.md` exist here because this package is a
public npm artifact whose workflows run with repository credentials — the
reporting path and the local workflow have to be written down, not
inferred from a sibling repo.

There is deliberately **no `CHANGELOG.md`**: the changelog channel is the
GitHub release notes. That is a verdict, not an omission. A package whose
every release obliges six repositories to act needs its notes to read as
adoption instructions, and a second file-based history would duplicate
that content and let the two drift. The obligation the verdict carries is
that the notes stay substantial — a channel nobody keeps is not a channel.

`claude-dependabot-fix.yml` calls this repo's own reusable workflow
through a local `./` reference, exactly as `ci.yml` does. Self-calling was
assumed circular; it is not — the caller fires once per completed build
and the callee resolves from the same commit. `./` is also the honest form
here: a SHA pin to itself would need rewriting at every release, and
`check-pins.sh` would police a reference that has no second channel to
disagree with.

`ci.yml` passes `SONAR_TOKEN` by name rather than `secrets: inherit`.
`inherit` hands every repository secret to the called workflow; in the
repo that hosts the workflows six others call, that is the shape a
supply-chain attack needs. The five sibling callers already name it.

## Process

Same family doctrine as every repo: Conventional-Commits PR titles
(the squash commit IS the title), suites green before push, zero-issue
zero-duplication Sonar bar if wired (the new-code window verified before
merge, not after), docs updated in the same PR, and every substantive
wave ends with a targeted cleanup/simplification pass over its own
diff. README speaks to the package CONSUMER (install, wiring,
reference); this file speaks to the MAINTAINER (rules, their reasons,
the incidents behind them) — a rule stated in both must say the same
thing, and doctrine evolves HERE first.

GitHub merge queues are gated on ORGANISATION ownership — "available
in any public repository owned by an organization" — and every repo in
this family is user-owned, so the `merge_group` event can never fire.
No workflow declares that trigger and the Sonar gate has no rule for
it: an event that cannot arrive needs no handling, and "inert but
harmless" is not a reason to keep configuration. Verified 2026-08
against the docs source; revisit only if a repo moves under an
organisation.

Dependabot's commit prefixes are pinned to `build(deps)` /
`build(deps-dev)` rather than inferred. The **subject** casing cannot
be pinned: `commit-message` accepts only `prefix`,
`prefix-development` and `include`, so Dependabot keeps matching each
repo's own history. Left alone by decision — a Dependabot commit
subject is not a contract, the PR title is, and the `PR title` check
already holds that one.

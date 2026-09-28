# CLAUDE.md

Shared tooling for the OlivierZal repo family — EIGHT repos as of
2026-08-30: three Homey apps (`com.melcloud`, `com.heatzy`,
`com.melcloud.extension`), two API SDKs (`melcloud-api`, `heatzy-api`),
the two shared runtimes they build on (`api-core`, `homey-kit`), and
this package. That makes SEVEN consumers — every repo but this one.
Prefer naming the set over counting it: the numbers below went stale
the day `api-core` joined, in every repo at once, because nothing
machine-checkable holds them. Two delivery channels: the npm package
`@olivierzal/configs` (eslint/prettier/tsconfig/typedoc/vitest presets,
compiled to `dist/`) and reusable GitHub workflows pinned by commit
SHA, the release tag as the pin's version comment. `vX.Y.Z` tags serve
both channels — bump once, release once.

## The boundary (the reason this package exists at all)

- The presets carry FAMILY policy: everything measured identical across
  the seven consumers, parameterized only by measured deltas (globs,
  wire-naming entries, coverage leg).
- Per-repo verdicts stay per-repo: documented `'off'` ledgers, ignores,
  and any rule adjustment with a repo-local reason live in each
  consumer's overlay, never here. Moving a verdict here silently
  imposes it on every other consumer.
- Path-bearing options (`outDir`, `rootDir`, `include`) never enter the
  tsconfig bases: paths in an extended tsconfig resolve relative to the
  BASE file (inside `node_modules` for consumers), so a base carrying
  them resolves an empty file list. Pinned by a test.
- Two tsconfig bases, two subpaths (`tsconfig/app`, `tsconfig/library`),
  nothing else. The `-build` aliases retired in 5.0.0 were content-free
  `{ extends }` shells of those two: measured 2026-09-07, one consumer
  extended one of them and none the other, while a build config already
  names its base once (its own `tsconfig.json`, or the plain base). Four
  twins on two spellings is the shape that drifts; the suite pins the
  export map to the files on disk in both directions. The bare `.`
  export went with them — imported by no consumer, a duplicate of
  `./eslint`. The top-level `types` that pointed at it STAYS, inert:
  with an `exports` map present nothing reads it, but the library
  preset's own `package-json/require-types` demands one, and an
  overlay `off` to delete one line costs more than the line (weighed
  2026-09-14).
- This package's `engines` is NOT the device floor the four runtime
  libraries declare (the three apps derive theirs the way this package
  does, and state the device floor in `compatibility`) — nothing here
  reaches a Homey, so it answers a
  different question: what does the toolchain need in order to install
  and run? That makes it derived from the dependency tree, never copied
  from a sibling. Measured 2026-08: `eslint-plugin-package-json` requires
  `^22.22.2 || >=24.15.0`, so the long-standing `>=22.19.0` declared a
  floor this package could not actually install on, and `.nvmrc` sent
  every fresh clone there. Both now name the derived value; re-derive it
  when the tree moves rather than nudging it by hand — as 7.0.0 did
  (2026-09-27): `eslint-plugin-es-x` requires
  `^22.23.0 || ^24.18.0 || >=26.4.0`, package-json's range is the
  `^22.22.2 || >=24.15.0` above, and their intersection —
  `^22.23.0 || ^24.18.0 || >=26.4.0`, es-x's own range, the narrower
  of the two — is what `engines` names now.
- `.nvmrc` is the INSTALL floor, in every repo of the family, and it is
  derived HERE: the lowest Node the tree this package imposes on every
  consumer installs on — 22.23.0 since 7.0.0, from
  `eslint-plugin-es-x`'s `^22.23.0 || ^24.18.0 || >=26.4.0` (22.22.2
  before it, from `eslint-plugin-package-json`'s
  `^22.22.2 || >=24.15.0`). It is not `engines`. The four libraries keep
  `engines` at the device floor (22.20, what their code needs where it
  runs); below the install floor npm still installs, but only under an
  `EBADENGINE` warning — which is why the apps' 22.20 coverage leg
  installs at all, and why a fresh clone must be told the install floor
  rather than meet it as a warning. This package and the three apps
  derive `engines` the same way and state the device floor elsewhere.
  Recorded 2026-09-07 with the libraries' move to 22.22.2 (their 5.0.0
  adoption), moved 2026-09-27 with es-x; re-derive when the tree moves,
  never nudge by hand.

## Naming doctrine

- Strict core, scoped departures. Properties are camelCase by default;
  the only softenings are the Homey preset's capability-id-shaped keys
  (platform-imposed), each repo's filter-scoped `wireNamingEntries`,
  the library preset's typedoc-key shape on root config files
  (tool-imposed, below), and the test block's widened property
  formats. The core NEVER
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
- Root config files (`*.config.{js,mjs,mts,ts}`) run the core policy
  since 7.0.0; the `off` that stood there had no recorded reason.
  Measured 2026-09-28 over the seven consumers with the core: nine
  findings, every one a key typedoc matches VERBATIM —
  `externalSymbolLinkMappings` by the exported symbol (`Redaction`,
  `LifecycleEvents`, `SessionAPIConfig`, `SyncCallback`, PascalCase by
  our own `typeLike` format) and `navigationLinks` by the rendered
  label (`GitHub`) — all in the four libraries' `typedoc.config.js`,
  the apps at zero. The library preset routes them by SHAPE
  (`typedocKeyEntry`: anchored `^[A-Z][A-Za-z0-9]*$`, `format: null`,
  the way the Homey capability shape is routed); the app preset keeps
  the bare core, typedoc never running on an app. A DECLARED deviation
  from the 7.0.0 spec, which asked for the exact names: an exact list
  in a shared preset couples every new symbol mapping in a library to
  a configs release, and the config block deliberately receives no
  consumer entries (a config file speaks no wire), so a consumer-kept
  list would need a new option. The trade is an uppercase-initial key
  of our own choosing passing unreported in a library's config file —
  a spelling the family never writes for an option. The owner rules;
  the exact-name form (a per-library option of typedoc symbol names)
  is the alternative.

## The eslint entry point

`./eslint` publishes the two presets, their option types (`HomeyAppOptions`, `LibraryOptions`, `TemplateExpressionAllowEntry`) and `webviewFloorBlock` — nothing else since 5.0.0. Nineteen fragment
re-exports and two option types rode out for "the day a repo genuinely
fits neither family": measured 2026-09-07, no consumer imported any of
them, and the set could not have assembled a third family anyway
(`mainLanguageOptions`, `wireNamingBlock` and `testNamingRules` were
never exported). The verdict is the naming doctrine's own: a repo fits
one of the two families, or the family gains a preset HERE — never a
hand-assembled third, which is the copy that drifts. The fragments stay
module-internal in `shared.ts` and `helpers.ts`.

Pinned by a runtime test of the barrel's export names, because the
rule that would report an unused export cannot:
`import-x/no-unused-modules` is inert under ESLint 10 — the plugin
returns no visitor without the FileEnumerator API, and the family's
`suppressMissingFileEnumeratorAPIWarning` is that fact acknowledged. It
stays at `error` so the verdict re-arms when import-x ships its
replacement; nothing leans on it meanwhile, and this repo's overlay no
longer turns it off with a reason that was false twice over.

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
  holding on all eight repos (re-read 2026-08-30, api-core included);
  deliberately NOT automated —
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
  scanning it — since it adds a second workflow to eight repos and
  check-run plumbing back to the pull request, strictly more machinery
  than the exemption it would retire. So
  the gate ACCEPTS such a pull request only after establishing that
  every commit on it is Dependabot's own. That clause is not
  decorative: a fix pushed onto such a branch by hand — or by the
  dependabot-fix workflow 6.0.0 retired, whose success path was
  exactly that push — would otherwise reach `main` having been read by
  no analysis at all.
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
  eight rulesets — one per repo, all eight verified carrying it
  2026-08-30 — and a required context that never reports blocks
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

## Dependencies nothing imports

- `eslint-import-resolver-typescript` is load-bearing although no file
  names it: `importXConfigs.typescript`, which both presets extend,
  sets `settings['import-x/resolver']` to `{ typescript: true }`, and
  import-x loads the package from that name at lint time. Measured
  2026-09-07 with the package hidden: every import rule reports
  `Resolve error: typescript with invalid interface loaded as resolver`
  (the name falls through to the `typescript` compiler package, which
  is not a resolver) and every import goes unresolved. It stays in
  `dependencies`, since the lookup happens in each consumer's lint run.
  Pinned by a real run in `tests/unit/presets.test.ts`: a `.js`
  specifier standing for a `.ts` neighbour — the `nodenext` form every
  consumer writes — resolves, and a missing module still reports.
- The opposite case is a line to delete, not to keep for safety:
  `jsonc-eslint-parser` was declared here from the first commit while
  nothing under `src/` named it and `eslint-plugin-package-json`
  already carries it in its own `dependencies`. Removed 2026-09-07.
  The question for a dependency with no importer is whether a tool
  loads it by name from a setting the presets emit —
  `eslint --print-config` on any `.ts` file shows those settings — and
  the answer is measured by hiding the package, never inferred from a
  grep.
- `typedoc-plugin-mdn-links` and `typedoc-plugin-coverage` are the
  mirror case: the typedoc preset names them and typedoc loads them by
  name from the CONSUMER's tree, so the claim is on the consumer — and
  it is declared in NO field the installer reads, not even the optional
  peer that would be the textbook place. 5.0.0 first declared them so,
  beside `typedoc`, and the consumers' dry adoptions caught the flaw
  before release: GitHub Packages strips `peerDependenciesMeta` from
  the packument. Measured 2026-09-07 on 4.5.0 — `npm view` of its
  `peerDependencies --json` lists the four peers and of its
  `peerDependenciesMeta --json` prints nothing, while
  `npm pack` of the same version carries the map and an npmjs control
  (`eslint-plugin-import-x@4.17.1`) keeps its own. So every optional
  peer reaches a consumer as a mandatory one: `node_modules/typedoc`
  (`dev: true, peer: true`) and fourteen packages under it sat in the
  three apps' locks on that day's `main`, since their first adoption,
  and the 5.0.0 draft would have added both plugins beside it. A
  `file:` install of the tarball honours the flag the registry drops,
  which is why a dry adoption against a pack LOSES typedoc where the
  registry re-pin adds it — the two channels answer differently, and
  only the registry's answer ships. Removing the field removes the
  class: `peerDependencies` names the tools every consumer runs
  (eslint, prettier, vitest) as plain peers, there is no
  `peerDependenciesMeta` to strip, and the tarball says what the
  packument says. typedoc and its plugins stay devDependencies here for
  the proof — a real typedoc run over a fixture, both plugins loading
  and leaving their trace (the coverage badge, the MDN links on an
  `Error` subclass's inherited members) — and the README's typedoc
  section carries the install line and the majors proven. Pinned in
  `export-contracts.test.ts`: the three names in no installer field,
  the peer set exact, no meta. Re-verify through the registry, never
  the tarball, once 5.0.0 is published: `npm view` of 5.0.0's
  `peerDependencies --json` must name exactly those three, and the
  apps' re-pin locks must lose `node_modules/typedoc`.

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
- Since 6.1.0 the reusables reach `.github/actions/setup-node-and-install`
  through `$/`, GitHub's self-repository syntax (2026-07-30: a `uses:`
  starting with `$/` resolves in the repository that DEFINES the
  workflow, at the commit that is running, no checkout needed; GitHub.com
  only, runner 2.336.0 or newer — the hosted runners every caller uses
  qualify, GitHub Enterprise Server does not), so a
  caller carries no copy of the action and the former blind spot — a
  caller that never copied it — is gone. `./` in a reusable resolved
  against the CALLER's checkout, which is why every repository carried
  a byte-identical copy and why zizmor's `self-repository` audit flagged
  each such line; a copy left behind in a caller is inert.
- `reusable-docs.yml` and `reusable-publish.yml` (5.0.0) are the
  release-only reusables, derived from the four identical files the
  libraries carried (one dead env entry fewer), and they sit squarely
  in this blind spot: this repo builds no docs site and publishes once
  per release. Two mitigations, neither a proof. `publish.yml` here calls
  `reusable-publish.yml` through `$/`, so that path runs on every
  release of this package — the caller's shape exactly, minus the
  scoped install. `reusable-docs.yml` takes `dry-run`, which builds and
  packs without deploying, so an adopter dispatches it by hand and
  watches the build half before a release reaches the deploy half. What
  stays unproven from here is the deploy half and the `npm` environment
  on a caller, until its first release through the reusable — the
  residual risk of a release-path reusable, stated rather than hidden.
  `tests/unit/reusable-release-workflows.test.ts` holds the shape the
  callers depend on: the call surface, the environments and grants, the
  dry-run gate and the dogfood reference.

## Commands

- The apps' twins — `reusable-homey-validate.yml`,
  `reusable-homey-publish.yml` — were derived here (2026-09-14) and
  moved to homey-kit 6.1.0 before this package's 6.0.0 shipped them,
  with `ios-floor-watch.yml`: Homey process belongs with the Homey
  package, and a change to it then costs three adoptions, not seven.
  What this package keeps is the rule that makes the move safe:
  `check-pins.sh` polices `OlivierZal/homey-kit` as a two-channel
  package exactly like itself.

## Adopting a fixer

A rule's fixer is adopted when the ERROR DETERMINES ITS CORRECTION, and
refused when it does not — the same question for every opt-in fixer the
family meets, asked once here rather than re-argued per rule.

`jsdoc/check-param-names` carries both answers at once, which is why it
is the worked example (`enableFixer` on, `extraParams` and
`badParamNames` off, reasoned at the rule site). Out-of-order `@param`
tags have exactly one correct arrangement — the names already match the
signature, only their positions differ, and each description travels
with its own tag — so automating it is the same handover as `sort-tags`
and perfectionist. An orphan `@param` has two opposite corrections
("delete this doc" / "you forgot the parameter"), as does a name
mismatch ("the doc is wrong" / "the signature is"), and a fixer choosing
between them deletes or rewrites prose a human wrote. Those stay
reports; the plugin offers its suggestions in the editor regardless,
which is where a judgment call belongs.

`--fix` runs unattended in every consumer, so an adopted fixer is
family policy, not a convenience: pin it behaviorally (a real `--fix`
run, both halves mutation-checked) rather than by asserting the option
value back.

## Plugin triage — evaluated once, here

Whole-plugin verdicts, held to the same bar as rules: strict adoption
(everything adopted runs at `error`), refusals recorded with their
reason, re-evaluated when the reason expires.

The rule tables carry an AUDIT LEDGER: `src/eslint/audited-versions.ts`
names, per rule-bearing package, the `major.minor` its release notes
were last read against, and `tests/unit/audited-versions.test.ts`
fails the moment an installed plugin's `major.minor` leaves it (a
patch bump passes). Dependabot moves the pins without anyone reading
what a minor added — a new rule, a new option, a widened default — so
the tables were drifting behind the tools running them. A red minor
bump is therefore a human's to settle: read the release notes, adopt
or refuse what they add in the tables, move the entry in the same pull
request. The ledger opened 2026-09-14 on the versions installed that
day, with the bumps of the day read for rules and options
(typescript-eslint 8.69 `no-misused-promises` → `flagUnions: 'all'`,
adopted; 8.70 `no-generated-empty-object-type`, arriving through
`strictTypeChecked`; @eslint/css 2.0 `use-baseline` now checking
CSS-wide keywords and duplicate `@keyframes` selectors, behaviour only;
@eslint/json 2.1, perfectionist 5.11, eslint 10.10, jsdoc 64.3–64.4 and
package-json 1.8.1 adding nothing to configure); every other package
sat on the version the 5.0.0 triage read. A FULL reading followed on
2026-09-15 — every rule of every installed plugin against the tables,
not only the release deltas: 1,334 rules, of which 160 unconfigured and
72 deprecated-but-referenced (all `off` through eslint-config-prettier),
judged one by one, each verdict measured by a real run on melcloud-api
and com.melcloud and challenged by two independent re-readings before
it entered the tables — 30 rules adopted or tightened, six refusals
recorded at their rule sites, the rest refused as owned by TypeScript,
Prettier or another rule. The ledger's versions did not move. That
last clause was re-measured in FULL on 2026-09-27 (7.0.0): seven
repos, 533 files, 253 candidate rules — every unconfigured rule of
every installed plugin enabled at its defaults over each tree, then
adversarially verified — and 13 had no owner at all. ADOPTED, each at
`error` with its reason at the rule site: `no-restricted-exports`
(`then`), `@typescript-eslint/no-restricted-types` (`Date`, the type
half of `unicorn/prefer-temporal`), `prefer-enum-initializers`,
`no-proto`, `no-iterator`, `no-unnecessary-qualifier`,
`capitalized-comments` (fixed by hand, never by its fixer, which is
unsafe on identifiers), `import-x/no-commonjs`, the four
`eslint-recommended` rules the JS config files had no owner for
(`no-var`, `prefer-const`, `prefer-rest-params`, `prefer-spread`),
`vitest/prefer-mock-return-shorthand`, `vitest/prefer-todo`,
`import-x/extensions` (app preset only; TS2835 owns it under
`nodenext`) and the `package-json` verdicts of the ownership section
below. REFUSED, with the reason: `strict` (owned by
`unicorn/prefer-module`); `no-div-regex` (taste); `max-lines` — at
1000 it would fit the largest file, and a `max` loosened ABOVE its
default to fit the corpus is the corpus-derived option the doctrine
refuses, every family ceiling tightening BELOW its default;
`vitest/require-hook` — 93 of 96 sites are the parametrised-contract
suite factories, so fitting it needs a curated allow-list, the shape
that drifts; `import-x/max-dependencies`, for the same reason;
`unicorn/no-missing-local-resource` on TypeScript and
`jsdoc/imports-as-dependencies`, inert by construction; the
`unicorn/consistent-boolean-name` split, which covers nothing
(`checkFunctions` reaches only `function` declarations and the family
writes arrows); `package-json/require-devEngines` (no options schema
to shape it); `package-json/restrict-top-level-properties` (a
corpus-derived allow-list). A refusal of a rule no preset turns on
lives in `src/eslint/refused-rules.ts`, never as an `'off'` line (the
refusal doctrine under Process).
vitest 5 (the runner, read the same night) moved two defaults the
tables answer: `clearMocks` is now true, so the five library configs
drop their restatement, the three apps drop their hook-level
`vi.clearAllMocks()`, and `vitest/no-restricted-vi-methods` keeps them
out; `toThrow('')` now matches any message, so a `no-restricted-syntax`
selector in the test block refuses the vacuous argument. The peer
floor stays `vitest: '>=4'` until the next major names 5.
unicorn 75 and jsdoc 64.5 were read on 2026-09-17 (6.4.0). unicorn 75
adds twenty rules; of its ten JS/TS ones, eight are in `recommended`
(`true` or `'unopinionated'` in the rule metadata, both of which the
preset enables) and arrive with the bump (`no-async-iterator-callback`,
`no-unused-builtin-method-return`, `no-unused-iterator-helper`,
`no-useless-set-construction`, `no-using-resource-escape`,
`prefer-combined-guards`, `prefer-iterator-zip`,
`prefer-temporal-conversion`) arrive with the bump, measured at ZERO
findings across the eight repositories. Two were recorded here as
arriving and never did: `prefer-json-import` and
`prefer-uint8array-hex` ship `recommended: false` in 75 AND 76 (re-read
2026-09-27), so the zero this entry once claimed for them was never
live. Both now sit in the refusal ledger (`src/eslint/refused-rules.ts`)
with their reasons — `prefer-json-import` as DOMAIN (neither tsconfig
base sets `resolveJsonModule`, and the rewrite to an import attribute
changes resolution, caching and error timing, which is why unicorn keeps
it opt-in), `prefer-uint8array-hex` as FLOOR (`Uint8Array#toHex` is a
Node 26 API and the device runs 22). Two more refusals of that
plugin's opt-in rules were corrected in the same pass and live there
too: `no-keyword-prefix` is NOT owned by `naming-convention` as the
old `off` claimed — the family's option checks formats and boolean
prefixes, never a forbidden prefix — and is refused as VOCABULARY (87
sites would fire, `newSettings` ×29, `className` ×8, the DOM's own
property); `no-manually-wrapped-comments` is refused as CONFLICTING,
not as noise: its fixer JOINS a wrapped group into one `//` line
without reflowing it (read in the rule source), which would destroy the
print-width convention on every `--fix` run. The CSS
half does NOT arrive: the `cssBlock` enumerates unicorn's CSS rules
instead of extending its preset, so each was judged on what it can
CATCH here (measured over the three settings stylesheets the same day):
`no-deprecated-css-features`, `no-duplicate-css-selectors`,
`no-duplicate-font-family-names`, `no-invalid-media-features`,
`no-unknown-css-annotations` and `no-unknown-pseudo-selectors` adopted
— the last with `allow: ['::-webkit-details-marker']`, the one
pseudo-element the three pages need to hide a `<summary>` marker on the
WebKit the floor admits, an allowance that leaves every other unknown
selector caught. REFUSED, each with its reason:
`prefer-media-feature-range-syntax` (no `@media` exists in the family's
CSS, and the range syntax is Baseline 2023 against the block's 2022
floor knob — an adoption that would argue with `css/use-baseline` the
day @eslint/css dates it), and the three nesting rules
(`no-nesting-with-mixed-specificity`, `no-redundant-nested-style-rules`,
`no-unscoped-css-nesting-selector`) — the floor admits no CSS nesting
and the corpus contains none, so they are inert; they re-enter with the
floor, which `ios-floor-watch` already guards. unicorn 75 also WIDENED
five rules the tables already carry, and the widest of them had to be
BOUNDED (6.4.1): `prefer-ternary` learned flat return statements, and
at the preset's `always` default it rewrites a guard clause — `if (x
=== undefined) { return a } return b` — into a multi-line ternary,
which is exactly the shape `unicorn/prefer-early-return` exists to
produce, undone. Measured over the eight repositories: `always` reports
54 sites and its autofix mangles real early returns (melcloud-api's
`mergeHomeReportChunks` and `mergeHourlyChartResults` were the
evidence); `only-single-line` reports 20, each a one-line ternary that
reads better as one. The tables pinned the bounded form until 6.6.0
(below). The other four
(`prefer-early-return`, `prefer-minimal-ternary`, `no-immediate-mutation`,
`prefer-continue`) bit real code as they should: `no-immediate-mutation`
saw a conditional push in this repo's own suites, fixed rather than
configured away — and the flat return `prefer-ternary` had rewritten
here under `always` went back to a plain boolean chain with 6.5.0. jsdoc 64.5 adds one rule, `ts-ban-ts-comment`,
REFUSED: `@typescript-eslint/ban-ts-comment` owns that policy under the
tool-ownership rule, and the family carries no `@ts-` directive
anywhere in `src` (measured); 64.5.1/64.5.2 only make the `typescript`
peer optional again.
The September releases were read on 2026-09-22 (6.5.0), each measured
over the eight repositories with the version under test PROVEN to be
the one the preset resolves (the recipe below says why that proof
exists). unicorn 76 adds no rule: three opt-in options and two
widenings. `no-break-in-nested-loop`'s `checkContinue` and
`prefer-combined-guards`' `checkCompoundConditions` measured at zero
sites and are adopted as latent guards; `no-immediate-mutation`'s
`checkConditionals` measured at ONE site — api-core's ordered policy
builder — and is REFUSED at the rule site: the conditional spread it
asks for is no clearer than the guarded `push` it replaces and, in
TypeScript, unfixable by the rule's own admission. The widening of
`prefer-logical-operator-over-ternary` to boolean-literal branches
costs seven auto-fixable sites family-wide (one here, fixed; homey-kit
2, com.heatzy 1, com.melcloud 2, api-core 1 — each adoption PR carries
its own). The `prefer-ternary` bound was RE-MEASURED rather than
carried: 76's readability boundaries skip a guard only when the merged
values hold a ternary, a block or a multiline literal, so `always`
still adds six guard-clause flattenings over the seven consumers —
`only-single-line` stood, until 6.6.0. `prefer-minimal-ternary` gained an autofix,
adopted under the fixer doctrine above (the error determines the
correction). eslint 10.11 (a labeled `continue` now reaches
`no-unsafe-finally`; `new-cap` and `object-shorthand` refinements the
tables do not configure), package-json 1.9 (`restrict-dist-tags`,
adopted with an EMPTY allow-list — a dependency is a version, never a
tag) and html-eslint 0.66 (the three rules the app preset configures
moved into `@html-eslint/core`, ids unchanged, the presets suite
green) complete the delta. `yml/no-boolean-key` (3.7, in neither
preset, missed by the full reading) enters at `error` at zero sites —
the parser reads YAML 1.2, so a workflow's `on:` stays text. The
rule-bearing patches (jsdoc 64.5.4, typescript-eslint 8.70.1,
perfectionist 5.11.1) rode along at zero findings. `unplugin-swc` 2.0
(drops Node 18, below the family floor) is not rule-bearing and lands
through Dependabot.
Both September verdicts were RETURNED on 2026-09-23 (6.6.0), on the
owner's challenge and on re-reading the evidence. `checkConditionals`
is adopted: the base rule was already at `error` and its rewrites had
been made, so refusing the extension because one site would move was
inconsistent with strict adoption — and the site, api-core's ordered
policy builder, rewrites safely into one literal that shows the order
at a glance (the fixer's abstention in TypeScript concerns the autofix,
not the resulting code; the explicit array annotation keeps contextual
typing). `prefer-ternary` returns to the preset's `always`: the 6.4.1
evidence was unicorn 75's nested-ternary defect, which 76's readability
boundaries fixed; the 6.5.0 re-measurement judged the fixer's raw
output rather than the formatted result every adoption produces
(`format:fix` follows `lint:fix`); and the `prefer-early-return`
argument conflated a guard before a long body with a two-way value
selection, which is a ternary's job and what the family already asks
of `prefer-minimal-ternary` at its stricter setting. Measured cost:
one site for the option, nine for `always` across the seven consumers,
every one auto-fixable. The bound was a preference, and a preference
is not worth a configuration defended release after release; the
presets suite now pins `always` and the boundary it relies on.

Maintenance is a gate — an unmaintained plugin is refused regardless of
coverage — but none of the plugins below fails it: the three
long-standing refusals are active under eslint-community, and so are
two of the three admitted in 7.0.0 (es-x, eslint-comments), the third
(regexp) under its author beside them.

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
  polices hand-written executors. The verdict was written (2026-08-10)
  against two, both in the kit; the set measured 2026-09-06 over shipped
  non-test source is seven — `api-core/src/resilience/retry-backoff.ts`
  (two abortable sleeps, resolve in a timer and reject in an abort
  listener: the very shape the rule polices), the kit's
  `settings/callback-api.ts`, `webview/boot.ts` and
  `testing/helpers.ts`, `com.melcloud`'s
  `widgets/ata-group-setting/public/animation.mts` and `com.heatzy`'s
  `settings/index.mts`. The "multiply" trigger has therefore fired and
  the re-evaluation was owed and was RUN on 2026-09-17, against
  those seven executors — which live in six files — rather than a
  count: `no-multiple-resolved` (plugin 7.3.0) finds **nothing** in any
  of them — not in
  `retry-backoff.ts`'s two abortable sleeps, the shape the verdict
  named, nor in the kit's three executors, nor in either app's. The
  rule was proven live in the same run on a synthetic double-resolve
  (two findings), so the zero is the corpus, not the harness. What the
  plugin's other unique rules find here is style already owned or
  unwanted: one `no-promise-in-callback` in api-core, two `param-names`
  in melcloud-api. The REFUSAL therefore stands, now measured against
  the set that triggered it; re-run this measurement, never the count,
  if a future executor lands.
- **eslint-plugin-security — REFUSED, owned and noisy.** Taint-style
  analysis is owned by CodeQL and SonarCloud, flow-aware where this
  plugin is syntactic. Sonar and CodeQL default setup run on all eight
  repos (`api-core`, the last gap, configured 2026-09-17 with the
  siblings' exact settings). Only `ci / Sonar`
  is a required context — CodeQL reports without blocking, and making
  it block is its own decision, not something this entry assumes. Its
  unique remainder is the noise set (`detect-object-injection` flags
  every computed access; `detect-non-literal-regexp` would condemn the
  route-guard kernels, `detect-non-literal-fs-filename` the manifest
  reader). Re-evaluate only if the CodeQL/Sonar gates ever drop.
- **eslint-plugin-es-x — ADOPTED 7.0.0, narrowed to the webview floor
  block.** Its `flat/restrict-to-es2023` table replaces the hand
  selectors that named three features and missed a fourth
  (`Promise.withResolvers`, Safari 17.4, was named in the block's own
  docstring and banned nowhere). The edition preset alone is the wrong
  SHAPE for this floor, which is an ENGINE: the table places above
  es2023 five features the iOS 16.4 WebKit ships (four in es2024,
  `Array.fromAsync` in es2026), so five rules are LIVE offs
  at the block with browser-compat-data 6.1.5 as the reason
  (`no-string-prototype-iswellformed`, `-towellformed`,
  `no-atomics-waitasync`, `no-array-fromasync`,
  `no-resizable-and-growable-arraybuffers`; `ArrayBuffer#transfer`,
  17.4, stays banned by its own rule), `no-regexp-v-flag` is off as the
  twin of `require-unicode-regexp` at `u`, and the one Web API the
  floor excludes — `AbortSignal.any`, 17.4 — is banned by hand, since
  es-x is ES-only. Applied to the floor files alone, never
  family-wide: nothing else in the family runs below Node 22. Its cost
  is the install floor: es-x requires `^22.23.0 || ^24.18.0 || >=26.4.0`,
  which moved `.nvmrc` and `engines` (the boundary above).
- **eslint-plugin-regexp — ADOPTED 7.0.0, narrowed.** `flat/recommended`
  in both main blocks before `prettier`, its six `warn` rules raised to
  `error` (zero-warning policy, now mechanical: a presets test resolves
  every representative file and fails on any rule at `warn`),
  `no-useless-escape` off as owned by the core rule (double report
  measured), four more at `error` (`no-super-linear-move`,
  `prefer-result-array-groups` for `noUncheckedIndexedAccess`,
  `prefer-named-replacement`, `prefer-named-backreference`), and four
  refused as owned (`prefer-regexp-exec`, `prefer-regexp-test`,
  `require-unicode-regexp`, `prefer-named-capture-group`). Its unique
  value here is coverage no other tool has: its `no-invalid-regexp`
  caught 10/10 invalid LITERALS that TypeScript and the parser accept
  (measured 2026-09-27), which is why the three core rules the preset
  turns off for its own are accepted. Zero findings on the family's 103
  literals; the family's `prefer-regex-literals` options survive the
  preset's bare `'error'` because the table applies after `extends`
  (pinned by a test).
- **@eslint-community/eslint-plugin-eslint-comments — ADOPTED 7.0.0,
  narrowed.** `recommended` (from the `/configs` subpath) in both main
  blocks, then `require-description` at `error` with the default
  `ignore: []` — an `eslint-enable` needs a description too; of the
  family's 46 directives, the seven undescribed enables get theirs with
  the adoptions — and `no-restricted-disable` on
  `@typescript-eslint/naming-convention`, the naming doctrine
  mechanised (anything of our own naming gets renamed, not excused).
  Two LIVE offs: `no-unlimited-disable` is owned by
  `unicorn/no-abusive-eslint-disable` (both fire on the three directive
  forms, measured), `no-unused-enable` by
  `linterOptions.reportUnusedDisableDirectives: 'error'`.
- **eslint-plugin-compat — REFUSED, blind to the breach.** Its API
  table holds no `AbortSignal` static, so the one Web API the floor
  actually excludes is exactly what it cannot see; the floor's
  detection is es-x plus the hand entry above.
- **eslint-plugin-de-morgan — REFUSED, style.** The one non-trivial
  rewrite it proposes in the family reads worse than the original.
- **eslint-plugin-node-dependencies — REFUSED, unsound offline.**
  `compat-engines` reads the registry at lint time and passes green
  when it cannot, and its local resolver is defeated by `exports` maps.
- **eslint-plugin-sonarjs — REFUSED, owned.** SonarCloud runs the same
  implementations on every pull request; a second TypeScript copy of
  the same verdicts.
- **eslint-plugin-no-unsanitized — REFUSED, owned** by
  `unicorn/no-unsafe-dom-html`.
- **eslint-plugin-erasable-syntax-only — REFUSED, owned** by the
  tsconfig flag of the same name, which both bases set.
- **Refused on 2026-09-27, one line each:** `depend` (a package
  blocklist is dependency policy, owned by `dependency-review.yml` and
  Dependabot); `math` (owned by `no-bitwise`,
  `prefer-exponentiation-operator` and unicorn's `prefer-math-*`
  rules); `jsonc` (owned by `@eslint/json` and Prettier); `tsdoc` (the
  jsdoc plugin already runs in its `flat/recommended-tsdoc-error`
  mode, a second parser of the same comments); `boundaries` (a
  per-repo element map for packages that have one layer;
  `import-x/no-cycle` and `no-restricted-imports` cover what exists);
  `array-func` (owned by unicorn's array rules); `no-only-tests` (owned
  by `vitest/no-focused-tests`); `github-action` (workflows are read
  by zizmor and the `yml/` table already); `i18n-json` (the apps'
  `locales/*.json` are the Homey CLI's to validate, and the JSON block
  ignores them by design); `total-functions` (owned by
  `noUncheckedIndexedAccess`, `strict-boolean-expressions`,
  `switch-exhaustiveness-check` and `no-unsafe-type-assertion`);
  `functional` (immutability by decree fights the class-based SDK
  design; `prefer-readonly` and `no-param-reassign` own the wanted
  half).

### Measuring a candidate before adopting it

A count is not a verdict, and a verdict nobody measured is a guess.
What a new rule COSTS is read off the family corpus first, rule by
rule, and the reading is the decision — `unicorn/prefer-ternary` was
bounded to `only-single-line` because its 54 findings at `always`
turned out to include guard clauses whose fixer would have flattened
them, not because 54 is a large number.

The probe is ESLint's own `--rule`, which layers one rule over a
repo's real config, so the measurement runs against the very
resolution the consumer runs — over the files that config covers,
read off the repo's own run (the apps have no `src`, and a root
target dies, see below):

```sh title="probe one rule over the files a repo's own lint covers"
npm run -s lint -- -f json | python3 -c 'import sys,json;print(" ".join(f["filePath"] for f in json.load(sys.stdin) if f["filePath"].endswith((".ts",".mts"))))' > /tmp/probe-files
node --max-old-space-size=8192 ./node_modules/eslint/bin/eslint.js $(cat /tmp/probe-files) \
  --rule '{"<plugin>/<rule>":["error","<option>"]}' -f json \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(sum(len(f["messages"]) for f in d))'
```

It reaches only plugins the config ALREADY loads (measured 2026-09-18:
an unloaded one dies with "could not find plugin"), so a whole-plugin
triage needs its own probe config declaring the plugin instead. Run it
across the eight repos, read every finding of the widest option, then
narrow the option until what remains is what the family actually wants
— and record the measurement with its date at the rule site, so the
next reader re-runs it rather than trusting the number.

Two more limits, measured 2026-09-22 on the unicorn 76 reading. Give
the run FILES, never the repository root: `.`, `**/*.ts` and
`**/*.{yml,yaml}` all died with "could not find plugin" before linting
anything (the plugin lives in a `files`-scoped block, and the rule
object `--rule` adds has no `files`), while `src`, `src/**/*.ts` and
explicit paths ran — the file list a previous `-f json` run reported
is the exact scope. And in a consumer, the version under test is NOT
the one at the top of `node_modules`: when the preset's range does not
admit it (`^75` against 76, `^0.65` against 0.66.1),
`npm install --no-save` keeps the old copy nested under
`node_modules/@olivierzal/configs/node_modules/` and the preset loads
THAT — a first pass measured seven consumers against the wrong
unicorn. Prune the nested copy and prove the resolution from the
preset's directory before trusting a number; a rule's schema accepting
the new option is the cheapest proof.

Three more, measured 2026-09-27 on the 7.0.0 audit. (a) ESLint accepts
`'off'` for a rule name that does not exist — `rules: { 'no-such-rule':
'off' }` lints without a word — so a refusal written as an `off` on a
rule no preset enables is never validated and rots in silence; that is
why refusals are data (`src/eslint/refused-rules.ts`) proven by a test.
(b) With `-c <file>` ESLint's base path is the CWD: a file outside it is
silently ignored, even with `basePath` set, so a probe config must run
from the tree it measures. (c) A type-aware probe over ONE tsconfig
costs about two seconds and well under 4 GB — the 8 GB figure the lint
scripts reserve is the full `projectService` run over every project —
so a perimeter probe may run typed, and the type-aware rules (es-x's
iterator helpers, `no-unsafe-*`) measure honestly.

Deliberately NOT a script. A routine that reports "n new rules
available" answers the cheap half of the question (which release notes
moved) and leaves the expensive half (is this rule right HERE)
untouched, while the `audited-versions` ledger already fails CI on the
cheap half. Building one was proposed and refused on 2026-09-18 as
overengineering; this recipe is what it would have wrapped.

## The HTML formatting handover

The family rule everywhere else — the formatter formats, the linter
lints — reaches HTML too, and reaches it BY HAND.
`eslint-config-prettier` is what normally performs the handover;
measured against the installed plugin, it disables 358 rules and
**zero** `html/` ones. So the `html/` split is hand-maintained, entry
by entry, each naming which of two reasons retires it:

- **redundant** — Prettier's output already satisfies the rule
  (`class-spacing`, `element-newline`, `no-extra-spacing-text`,
  `no-multiple-empty-lines`, `no-trailing-spaces`, `quotes`);
- **conflicting** — Prettier's output VIOLATES the rule, so keeping it
  would fail every formatted file (`attrs-newline`; `indent`, Prettier
  indents two where the rule wants four; `no-extra-spacing-tags` and
  `require-closing-tags`, both tripped by the ` />` Prettier writes on
  void elements).

The classification stays; since 7.0.0 WHERE an entry lives follows
whether it is live. A rule `html/recommended` turns on is a LIVE `off`
at the block in `homey-app.ts` (the four conflicting ones,
`element-newline` and `quotes`), validated by the preset that enables
it. A rule the recommended set never enables — the four other
redundant ones and the two SEO refusals — is an entry in
`src/eslint/refused-rules.ts`, class `redundant` or `domain`, because
an `off` on a rule nothing turns on validates nothing (ESLint accepts
it for a rule that does not exist).

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

`lowercase` left the redundant list on 2026-09-15: Prettier lowercases
only the element and attribute names it knows (its own output keeps
`onClick`, `DATA-FOO`, `<MY-ELEMENT>`), so it neither guarantees nor
contradicts the rule, which is kept at `error` like `head-order`. The
same audit adopted five more, none of them formatting: `require-attrs`
(`defer` on every external script) and `no-restricted-attr-values`
(`type="module"`), the two halves of the cold-boot verdict every page
documents; `no-restricted-attrs` (inline handlers) and
`no-restricted-tags` (`<style>`), the two doors out of the TypeScript
bundle and the `css/` table; and `use-baseline` at the CSS rule's year.
The two SEO rules (`require-meta-description`,
`require-open-graph-protocol`) are refused in the ledger, class
`domain`, with their reason: a Homey webview is never crawled — never
on in `html/recommended`, so the `off` they had at the block was dead.

`tests/unit/presets.test.ts` locks it with a real `format` call, both
ways: Prettier's own output must lint clean, a misformatted page must
raise nothing, and an invalid ARIA role must still be reported. Adding
an `html/` rule means classifying it the same way — and one that
Prettier neither guarantees nor contradicts belongs at `error`.

## The package.json order handover

Field and collection order in `package.json` are the FORMATTER's, and
7.0.0 made the presets say so: `package-json/order-properties` (from
the plugin's `stylistic` set) and `package-json/sort-collections` (from
`recommended`) are LIVE offs in `packageJsonBlock`. Both wrap
`sort-package-json`, as does `prettier-plugin-packagejson` in the
family's prettier preset — three readers of one table whose orders are
identical today but move in minors and ride two different Dependabot
groups. Nor are they identical everywhere: `sort-collections` sorts the
top-level keys of `exports` code-unit-wise while `sort-package-json`
keeps path order and moves `default` last, so on a condition-keyed
`exports: { types, default }` ESLint writes `{ default, types }` —
TypeScript then stops seeing `types` — and the next Prettier pass
restores it, a fight reproduced 2026-09-27. One owner, the formatter.
The same release settled the app/library split of the plugin's
`require-*` rules on the machine-readable fact: a Homey app is never
published, so `require-private` and `restrict-private-properties` run
at `error` in the app preset (never its fixer — it writes
`"private": false`), and the plugin's `require-exports`,
`require-files`, `require-homepage`… self-skip on a private package,
which retired the two app-side offs; the libraries add
`require-publishConfig`, the scoped package's declaration of its
registry.

## Consumers & adoption

Exact pins only (family doctrine): a release lands through one
adoption PR per consumer, which proves iso-behavior with
`eslint --print-config` diffs before/after on representative files.
Reusable-workflow callers pin a commit SHA with the release tag as its
version comment — never `@main`, and never a bare tag, which zizmor's
`unpinned-uses` flags. A DRY adoption installs the pack by `file:`,
which reads the tarball's manifest; the real re-pin reads the packument,
and the two differ by exactly the fields GitHub Packages strips (see
"Dependencies nothing imports"). What a release installs is therefore
verified through the registry once published, never inferred from the
pack — the pack proves the code, the packument proves the install. A release that CHANGES policy (a naming
tightening, a new floor) is the opposite: every diff is a deliberate,
per-repo-classified change — a Dependabot bump that crosses such a
release is left red for a human to classify, never auto-fixed.

## The iOS floor watch

Lives in homey-kit since 6.1.0 (`ios-floor-watch.yml`, monthly and on
dispatch; its issue lands where the webview-floor doctrine is). The
`homey-app` preset's `webviewFloorBlock` and `css/use-baseline` year
derive from the value that workflow records (16.4, read 2026-08-11 and
RE-ATTESTED 2026-09-27 on Homey 10.1.1 of 2026-09-02, through both the
App Store page and the iTunes Lookup API), so a move it reports is
re-derived HERE, in the preset, and the two restatements — the preset's
docstring and the workflow's recorded value — move together across the
two repositories. Context, not derivation: iOS 16 is the ceiling of the
iPhone 8, 8 Plus and X, under about one per cent of devices per
TelemetryDeck and Statista (2026-06 to 2026-08); the floor stays
derived from the store minimum, never from a share.

What the block enforces since 7.0.0, and why each line is there. The
detection is `eslint-plugin-es-x`'s `flat/restrict-to-es2023`, the
maintained edition table, in place of hand selectors that named three
features (`Object.groupBy`, `Map.groupBy`, the `v` flag, iterator
helpers by a member-name regex) and missed `Promise.withResolvers`,
which the docstring called out as Safari 17.4 and nothing banned. The
floor is an ENGINE, so the table is corrected by browser-compat-data
(6.1.5, read 2026-09-27) where the iOS 16.4 WebKit ships a feature the
table places above es2023: five LIVE offs (`String#isWellFormed` and
`toWellFormed`, `Atomics.waitAsync`, resizable and growable
`ArrayBuffer`s — es2024 — and `Array.fromAsync`, es2026 in es-x's
table), while `ArrayBuffer#transfer` (17.4) stays banned by
its own rule. The `v` flag is refused ONCE: `require-unicode-regexp` at
`{ requireFlag: 'u' }` reports it, `es-x/no-regexp-v-flag` is off as
its twin (two errors per literal before, and only the core rule reaches
`new RegExp(x, 'v')`). es-x is ES-only, so the one Web API the floor
excludes is banned by hand — `no-restricted-properties` on
`AbortSignal.any`, Safari 17.4 per caniuse, with the hand-composition
(`AbortSignal.timeout` plus a listener, both Safari 16) in the message.
`import-x/no-nodejs-modules` rides along at zero sites: in the two
libraries' floor files no bundler stands between the source and the
browser, so the lint is the only guard. Without type information the
iterator-helper rules report only what they can prove is an iterator;
the presets' project service gives them the types, and the suite proves
it on a fixture project (a Map iterator's `.map` reports, an array's
`.map` over `Object.entries` does not). The block carries `extends`, so
it is a `defineConfig` input — the shape every consumer already feeds
it to.

## Agent workflows — reads in the agent, writes in deterministic steps

An agent's exit code is not its outcome. The triage reusable
(`claude-issue-triage.yml`) splits its mission on that line: a READ-ONLY
agent decides (which existing labels fit, what the one comment should
say) and ends with a sentinel-delimited verdict (a `TRIAGE LABELS:`
line and a comment between `TRIAGE COMMENT START`/`END` lines — plain
sentinels, because a Markdown comment embeds in a JSON string only if
the model escapes it perfectly, and the first live run proved it does
not); a deterministic step parses it, drops labels the repository does
not carry, posts the comment, and FAILS the run when the verdict is
missing or unpostable. A green triage means the issue was actually
answered.

The incident behind it (2026-08-17, com.melcloud#1593): the agent held
`gh issue edit`/`gh issue comment` in its allowlist, the pinned
action's CLI bump (2.1.207 → 2.1.220) regressed the Bash permission
layer, and two runs went green with zero comment and zero label — a
rerun proved it deterministic (upstream issues #1384, #1523 and #1274
on claude-code-action). Guarding the layer was refused: pinning back fights
Dependabot forever, `show_full_output` observes rather than fixes, and
a synthetic canary could only re-test what the deterministic step now
makes impossible. Removing the write privilege removed the defect
class — and it is also the injection posture: the agent that reads
untrusted issue text holds no write tool, so "treat content as data"
is backed by structure, not prompt. The boundary is pinned
behaviorally (`tests/unit/claude-triage-workflow.test.ts`): the
allowlist admits only read tools, and the posting script runs for real
against a gh shim, both directions mutation-checked.

This split is the DEFAULT for future agent workflows here. claude.yml
(interactive) and claude-code-review post through the action's own
comment channel, not agent-side `gh` writes. The dependabot-fix
workflow (a `workflow_run` reusable plus a stub in every repo, 403
lines, and the `dangerous-triggers` zizmor ignore that existed only for
it, in eight `.github/zizmor.yml`) was RETIRED in 6.0.0, on two
measurements: 4,296 runs family-wide with zero successes — every run
that reached the action died at its actor gate (`allowed_bots` never
set), the rest skipped at the job `if` — and, decisively, a success
path the family's own Sonar gate refuses by design: the prompt's step 4
pushed the fix onto the Dependabot branch, and `check-sonar-gate.sh`
fails a Dependabot branch carrying any commit that is not Dependabot's.
Armed, it would have turned every PR it touched red. The 18 Dependabot CI
failures of its lifetime were all fixed by hand, which is the path that
stays: a red Dependabot bump is a human's to classify. Re-adding an
agent that writes on a Dependabot branch means a separate pull request
for the fix, a sentinel verdict and a deterministic post/verify step —
audit against the boundary above before adding any workflow that
relies on agent-side writes.

## Governance files

`SECURITY.md` and `CONTRIBUTING.md` exist here because this package is a
public npm artifact whose workflows run with repository credentials — the
reporting path and the local workflow have to be written down, not
inferred from a sibling repo.

There is deliberately **no `CHANGELOG.md`**: the changelog channel is the
GitHub release notes. That is a verdict, not an omission. A package whose
every release obliges seven repositories to act needs its notes to read as
adoption instructions, and a second file-based history would duplicate
that content and let the two drift. The obligation the verdict carries is
that the notes stay substantial — a channel nobody keeps is not a channel.

`ci.yml` and `publish.yml` call this repo's own reusable workflows
through the self-repository reference `$/` (a local `./` until 6.1.0;
the retired dependabot-fix stub did the same). Self-calling was
assumed circular; it is not — the caller fires once per completed build
and the callee resolves from the same commit. `$/` is also the honest
form here: it names this repository at the running commit, a SHA pin to
itself would need rewriting at every release, and `check-pins.sh` would
police a reference that has no second channel to disagree with.

`ci.yml` passes `SONAR_TOKEN` by name rather than `secrets: inherit`.
`inherit` hands every repository secret to the called workflow; in the
repo that hosts the workflows seven others call, that is the shape a
supply-chain attack needs. All seven sibling callers already name it
(one `SONAR_TOKEN` occurrence per `ci.yml`, counted 2026-08-30).

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

Auto-merge is never armed on an authored PR (verdict 2026-09-07:
api-core#12 had it armed and merged 13 s before Copilot's review landed,
leaving two threads on a merged PR, one of them real). A PR is merged by
hand, on its FINAL head, once three things hold at once: every check is
SUCCESS or SKIPPED, the Sonar PR window is at zero open issues with the
gate OK, and every review thread is settled. The Dependabot lane
(`.github/workflows/dependabot.yml` arming `gh pr merge --auto` once CI
passes) is the one deliberate exception and stays as documented.

GitHub merge queues are gated on ORGANISATION ownership — "available
in any public repository owned by an organization" — and every repo in
this family is user-owned, so the `merge_group` event can never fire.
No workflow declares that trigger and the Sonar gate has no rule for
it: an event that cannot arrive needs no handling, and "inert but
harmless" is not a reason to keep configuration. Verified 2026-08
against the docs source; revisit only if a repo moves under an
organisation. That rule retires HANDLERS — configuration whose only
subject is an event nobody can raise, and whose removal leaves nothing
unrecorded. It does not retire an ADOPTED lint rule over a domain the
family lacks: `package-json/prefer-rolling-workspace-spec` runs at
`error` with zero `workspace:` specifiers across the eight repos, its
reason and drop condition at the rule site (`src/eslint/shared.ts`,
recorded 2026-08-30). The plugin-triage doctrine adopts strictly and
records refusals, so dropping that rule is a refusal: it either stays
adopted or lands in the refusal ledger with its class and reason — a
policy verdict for a release, never a silent deletion under this
paragraph.

The ledger is `src/eslint/refused-rules.ts` (7.0.0), and a refusal
never lands as a dead `'off'` again. ESLint accepts `'off'` for a rule
name that does not exist (verified 2026-09-27), so an `off` on a rule
no extended preset turns on is never validated: the plugin renames or
drops the rule and the line rots in silence, still claiming a verdict —
sixteen such lines stood in the tables, one of them dead twice over
(`@stylistic/max-len`, with no `@stylistic` preset extended AND
eslint-config-prettier already listing it). The presets carry only LIVE
settings: a rule some preset enables and the family disables stays an
`'off'` at its rule site with its reason, validated by the preset that
enables it (`unicorn/no-this-assignment`, the `html/` conflicting set,
the es-x BCD corrections); every refusal of a rule that was never on is
an entry in the ledger — class (`owned`, `conflicting`, `redundant`,
`domain`, `floor`, `vocabulary`), reason, the owner when there is one,
the device-floor major a `floor` refusal waits on — and
`tests/unit/refused-rules.test.ts` proves each entry against the
installed plugins: the rule exists and is not deprecated, it is off or
absent wherever its plugin runs, its owner runs at `error`, and a
`floor` refusal goes red the day `DEVICE_NODE_FLOOR` reaches the API it
waits for, forcing the adoption. Absence of a use case is not a
refusal of a practice: the three offs on `unicorn/comment-content`,
`string-content` and `id-match` — rules that enforce only what their
options declare, and the family declares nothing — were deleted
outright rather than ledgered.

Dependabot's commit prefixes are pinned to `build(deps)` /
`build(deps-dev)` rather than inferred. The **subject** casing cannot
be pinned: `commit-message` accepts only `prefix`,
`prefix-development` and `include`, so Dependabot keeps matching each
repo's own history. Left alone by decision — a Dependabot commit
subject is not a contract, the PR title is, and the `PR title` check
already holds that one.

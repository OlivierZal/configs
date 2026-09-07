# @olivierzal/configs

Shared tooling for the OlivierZal repo family, on two delivery
channels: an npm package (eslint/prettier/tsconfig/typedoc/vitest
presets) and reusable GitHub workflows pinned by commit SHA, the
release tag as the pin's version comment. One version covers both —
`vX.Y.Z` tags serve npm and `uses:` refs alike.

[![License](https://img.shields.io/github/license/OlivierZal/configs)](LICENSE)
[![Node](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FOlivierZal%2Fconfigs%2Fmain%2Fpackage.json&query=%24.engines.node&label=node&color=brightgreen)](package.json)
[![GitHub release](https://img.shields.io/github/v/release/OlivierZal/configs?sort=semver)](https://github.com/OlivierZal/configs/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/OlivierZal/configs/ci.yml?branch=main&label=CI)](https://github.com/OlivierZal/configs/actions/workflows/ci.yml)
[![CodeQL](https://github.com/OlivierZal/configs/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)](https://github.com/OlivierZal/configs/security/code-scanning)

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_configs&metric=alert_status)](https://sonarcloud.io/dashboard?id=OlivierZal_configs)
[![Test coverage](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_configs&metric=coverage)](https://sonarcloud.io/component_measures?id=OlivierZal_configs&metric=coverage)

## npm presets

```sh title="install"
npm install --save-dev --save-exact @olivierzal/configs
```

Every family repo's `.nvmrc` names the install floor of its tree —
22.22.2 today, the lowest Node the tooling this package pulls into every
consumer installs on — and never a sibling's value or a round number;
`engines` keeps stating what the code needs where it runs (the device
floor in the four libraries, that same install floor here and in the
apps, whose device floor lives in `compatibility`). Re-derive it when
the tree moves.

### eslint

```ts title="eslint.config.ts (Homey app)"
import { type Config, defineConfig } from 'eslint/config'

import { homeyApp } from '@olivierzal/configs/eslint/homey-app'

const config: Config[] = defineConfig([
  { ignores: ['.homeybuild/', 'coverage/'] },
  ...homeyApp({
    bundledSourceGlobs: ['settings/**'],
    defaultExportFiles: ['api.mts', 'app.mts', 'drivers/*/{device,driver}.mts'],
    jsdocFiles: ['{api,app}.mts', 'drivers/**/*.mts', 'lib/**/*.mts'],
    untypedDoubleTestFiles: ['tests/unit/app.test.ts'],
    webviewFloorFiles: ['settings/**/*.mts'],
    // App-side wire vocabulary, filter-scoped (converters, report
    // readers); omit when the app has none.
    wireNamingEntries: [
      {
        filter: { match: true, regex: '^LOCK_C$' },
        format: null,
        selector: 'objectLiteralProperty',
      },
    ],
  }),
  // Per-repo verdicts (documented `'off'` ledgers) stay here.
])

export default config
```

```ts title="eslint.config.ts (published library)"
import { library } from '@olivierzal/configs/eslint/library'

export default defineConfig([
  { ignores: ['coverage/', 'dist/', 'docs/'] },
  ...library({
    wireNamingEntries: [
      {
        filter: { match: true, regex: '^__brand$' },
        format: null,
        selector: 'typeProperty',
      },
    ],
    // Where that vocabulary may appear. Omitted, it applies repo-wide,
    // so a snake_case name of ours passes unnoticed among the wire's.
    wireNamingFiles: ['src/types/**/*.ts'],
  }),
])
```

Pass `wireNamingFiles` rather than hand-writing a scoped
`naming-convention` block: the rule's option array replaces rather
than merges, so the preset emits the scoped block and the caller names
its files, never the policy (CLAUDE.md has the drift rationale).

The eslint plugins ship as dependencies of this package: rule
evaluations and version bumps happen here once, consumers only bump
their exact pin. Per-repo ignores and documented rule ledgers stay in
each consumer (CLAUDE.md: they are verdicts, not shared policy).

Naming is strict-core: properties are camelCase by default, and every
departure is a scoped opt-out — the Homey preset skips capability-id
shaped keys (`fan_speed`; platform-imposed), each repo passes its own
filter-scoped `wireNamingEntries`, and test files widen property
formats (doubles mirror wire payloads and key mocks by export names).

A library shipping webview-bundled sources composes the runtime floor
(es2023: no iterator helpers, no `Object.groupBy`, no `v` regex flag)
rather than restating it — `webviewFloorBlock(files)` is the very
fragment the Homey preset applies, so it cannot drift from it:

```ts title="eslint.config.ts (library with webview sources)"
import { webviewFloorBlock } from '@olivierzal/configs/eslint'

export default defineConfig([
  ...library({}),
  webviewFloorBlock(['src/webview/**/*.ts']),
])
```

That is the whole of the `eslint` entry point: the two presets, their
option types and `webviewFloorBlock`. The fragments the presets
assemble from are not public — a repo fits one of the two families, or
the family gains a preset here.

Anchor every `wireNamingEntries` filter (`^…$`): a filtered entry
outranks the core's `requiresQuotes` skip, so an open-ended pattern
swallows quoted keys (`'Content-Type'`) it was never meant to judge.

Root `*.config.js` files (typedoc) are linted too, with the full
type-aware rule set: they live outside every tsconfig, so the presets
type them through the project service's default project. This assumes
eslint runs from the repo root (the `allowDefaultProject` glob
resolves against it).

### prettier

```jsonc title="package.json"
{ "prettier": "@olivierzal/configs/prettier" }
```

Prettier formats HTML too: the `homey-app` preset turns off the
`html/` rules that would duplicate or contradict it, and keeps the
quality ones. Do not exclude `*.html` from prettier — nothing lints
its formatting any more.

### tsconfig

```jsonc title="tsconfig.json"
{ "extends": "@olivierzal/configs/tsconfig/app" }
```

Bases: `tsconfig/app` and `tsconfig/library`, one per family and
nothing else. Path-bearing options (`outDir`, `rootDir`, `include`)
stay consumer-side on purpose: paths in an extended tsconfig resolve
relative to the base file, which lives in `node_modules` — a base
carrying them resolves an empty file list. A build config declares its
own beside the base (or extends the repo's `tsconfig.json`, which
names the base once):

```jsonc title="tsconfig.build.json"
{
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "extends": "@olivierzal/configs/tsconfig/library",
  "include": ["src"],
}
```

### typedoc

```js title="typedoc.config.js"
import { typedocBase } from '@olivierzal/configs/typedoc'

const config = typedocBase({
  categoryOrder: ['API Clients', 'Facades'],
  // Defaults to ['src/index.ts']; multi-entry packages list theirs.
  entryPoints: ['src/index.ts', 'src/webview/index.ts'],
  hostedBaseUrl: 'https://olivierzal.github.io/<repo>/',
  name: '<Package> for Node.js',
  navigationLinks: { GitHub: 'https://github.com/OlivierZal/<repo>' },
})

export default config
```

The preset names two plugins (`typedoc-plugin-mdn-links`,
`typedoc-plugin-coverage`) that typedoc loads by name from the
consumer's tree, so they install beside typedoc itself:

```sh title="install"
npm install --save-dev typedoc typedoc-plugin-coverage typedoc-plugin-mdn-links
```

That install line is the whole contract: neither typedoc nor the
plugins are declared here in any field `npm install` reads. The
optional peer that would be the textbook place is not one through
GitHub Packages, which strips `peerDependenciesMeta` from the
packument (measured 2026-09-07 on 4.5.0: the tarball carries the map,
`npm view … peerDependenciesMeta --json` prints nothing), so every
optional peer reaches a consumer as a mandatory one — typedoc declared
that way had been landing in the three apps' locks, which document
nothing, since their first adoption. The majors the preset is proven
against are the devDependency ranges here (typedoc 0.28, coverage 4,
mdn-links 5), pinned by a real run over a fixture; a consumer keeps its
own pins and Dependabot moves them there.

### vitest (decorator transform)

```ts title="vitest.config.ts"
import { swcPlugin } from '@olivierzal/configs/vitest-swc'

export default defineConfig({ oxc: false, plugins: [swcPlugin] })
```

### vitest (coverage bar)

```ts title="vitest.config.ts"
import { coverageDefaults } from '@olivierzal/configs/vitest-coverage'

export default defineConfig({
  test: { coverage: { ...coverageDefaults, include: ['src/**/*.ts'] } },
})
```

The fragment carries the family bar — `text` + `lcov` reporters and
100% thresholds on all four axes. The `include`/`exclude` globs beside
it stay consumer-side: which files count is per-repo identity, how high
the bar sits is not.

## Reusable workflows

Callers keep their own triggers and pin this repo by commit SHA, with
the release tag as the version comment the `Verify action pins` step
proves — never `@main`, and never a bare tag (zizmor's `unpinned-uses`
flags it). Secrets are named, never inherited: the reusable declares
exactly the one it needs, and `inherit` would hand it every repository
secret.

```yaml title=".github/workflows/ci.yml"
jobs:
  ci:
    permissions:
      contents: read
      packages: read
    secrets:
      SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
    uses: OlivierZal/configs/.github/workflows/reusable-ci.yml@<commit sha> # vX.Y.Z
    with:
      run-lint-package: true # libs
```

`node-versions` describes the test legs, one JSON object each (default
`[{"node-version": "22", "coverage": true}, {"node-version": "latest"},
{"node-version": "lts/*"}]`) — a repo whose runtime floor is a specific
minor pins that minor here rather than floating with `lts/*`. Exactly
one leg carries `coverage: true`, and that leg runs coverage and uploads
to Sonar. The flag travels inside the leg it marks, so it cannot name a
leg that does not exist; the `Verify the coverage leg` step only counts
them, since a matrix with no flagged leg is the one mistake that would
otherwise stay silent. Quote every version: `22.20` unquoted is JSON for
the number 22.2, which installs the 22.2 line. Each entry also names a
required status check (`Test (Node <version>)`), so a caller changing
the list updates its ruleset in the same move.

The house bar — zero issues, every security hotspot reviewed, zero
duplication and full coverage, on both the new-code and the overall
window — is stated once in the `Olivierzal way` quality gate, the
organisation default. The scan step waits on it
(`-Dsonar.qualitygate.wait=true`), so a violation fails the coverage leg
itself and no CI code restates or re-reads the bar. Which window applies
is SonarCloud's own split: a pull request analysis is held to the
new-code conditions and a branch to both, which lands exactly where the
house reasoning did — a pull request answers for the code it introduces,
while an analyser update raising issues on untouched code surfaces on
the default branch without blocking a review that did not cause it.

The `Sonar` job reports the one thing a waiting scanner cannot: a scan
that never ran, whose skipped step fails nothing. It accepts exactly two
silences, each verified rather than assumed — a repo that declared
neither project nor token has opted out in writing, and a Dependabot
pull request, which SonarCloud never analyses because such workflows
receive no secrets, is accepted once the job has checked that every
commit on it is Dependabot's own. A fork pull request fails, since it
carries source nobody analysed, and so does a project whose token went
missing, since the upload self-arms on the secret and would otherwise
skip in silence. The context is `ci / Sonar` — add it to the ruleset
only after watching it report correctly, and never rename it.

`dependency-review.yml` blocks a pull request that introduces a
vulnerable runtime dependency, at any severity: `fail-on-scopes: runtime`
keeps what never reaches the device out of the way, and the scope comes
from the dependency graph rather than from a flag anyone maintains. It
judges the diff, which is the whole of its job — an advisory that landed
before the pull request is not that pull request's doing, and belongs to
Dependabot's continuous alerting instead.

Standing advisories are triaged where GitHub raises them: the alert
carries the
production/development scope natively, development findings are
auto-dismissed by the preset rule, and a finding kept on purpose is
dismissed with a reason against the advisory itself. Such a dismissal
cannot outlive its cause the way a list in a repository can, because it
has no existence apart from the alert. Upstream advisories are never
worked around in consumer code — a workaround is a permanent cost
against a risk that is not ours, and it outlives the fix that makes it
pointless.

Available: `reusable-ci.yml` (check + caller-defined test matrix, caller
picks the legs, the coverage leg and the library gates, plus the Sonar
gate), `reusable-claude-dependabot-fix.yml` (caller keeps the
`workflow_run` trigger and passes its verify commands),
`reusable-publish.yml` and `reusable-docs.yml` (the libraries' release
path: the caller keeps the `release` trigger, and the `npm` and
`github-pages` environments travel with the called jobs together with
the `id-token: write` the attestation and the deployment need). The
single-file workflows (`dependency-review`, `pr-title`, `zizmor`,
`claude*`, `dependabot`) also accept `workflow_call` so callers can
become stubs. `templates/zizmor-apps.yml` is the apps' zizmor config
variant; this repo ships the libs' form.

```yaml title=".github/workflows/publish.yml"
jobs:
  publish:
    permissions:
      attestations: write
      contents: read
      id-token: write
      packages: write
    uses: OlivierZal/configs/.github/workflows/reusable-publish.yml@<commit sha> # vX.Y.Z
name: Publish package to GitHub Packages
on:
  release:
    types: [published]
permissions: {}
```

```yaml title=".github/workflows/docs.yml"
jobs:
  docs:
    permissions:
      contents: read
      id-token: write
      packages: read
      pages: write
    uses: OlivierZal/configs/.github/workflows/reusable-docs.yml@<commit sha> # vX.Y.Z
    with:
      dry-run: ${{ inputs.dry-run || false }}
name: Generate & deploy docs
on:
  release:
    types: [published]
  workflow_dispatch:
    inputs:
      dry-run:
        default: false
        description: Build the site without deploying it.
        type: boolean
permissions: {}
```

Both called workflows reference the caller's copy of
`.github/actions/setup-node-and-install`, the one `reusable-ci.yml`
already needs. `dry-run` is the rehearsal a release-only path can get:
dispatch it by hand once adopted and watch the build half succeed on
the reusable before a release reaches the deploy half. This repository
runs `reusable-publish.yml` itself on every release (its own
`publish.yml` calls it), but builds no docs site — so the docs path is
proven by that rehearsal and by a caller's first release through it,
not from here.

## Action pins

Every `uses:` pinned to a commit SHA carries a version comment, and the
`Verify action pins` step of `reusable-ci` proves the comment true — it
runs inside the existing check job, so adopting it costs no workflow
file and no new required status check. The step fails when a SHA pin
has no comment, when the comment names a tag the upstream does not have
or that resolves to another commit, and when anything follows the
version on that line (CLAUDE.md explains why an unverified comment is
worse than none).

Some upstreams ship commits their tags never reach — an action whose
`master` carries a fix no release names. Those pins say so instead:

```yaml title=".github/workflows/validate.yml"
- uses: athombv/github-action-homey-app-validate@0f3b42c1… # untagged: master carries the `don't npm ci` fix the @typescript/native toolchain needs; v1 predates it
```

The claim is checked like any other: declaring `untagged:` on a commit
some tag does reach fails, naming the tag to use, and an empty reason
fails too. Refs to this repo may not use it — every release here is
tagged.

References to this repo carry a second obligation: their tag must match
the consumer's `@olivierzal/configs` npm pin, because one version covers
both channels. Keep that single source by letting Dependabot propose the
npm bump and leaving the workflow refs to follow it in the same branch:

```yaml title=".github/dependabot.yml"
- package-ecosystem: github-actions
  ignore:
    # Not a third-party action: this ref's version is dictated by the
    # npm pin, and both move together in one reviewed adoption.
    - dependency-name: OlivierZal/configs
```

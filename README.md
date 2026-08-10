# @olivierzal/configs

Shared tooling for the OlivierZal repo family, on two delivery
channels: an npm package (eslint/prettier/tsconfig/typedoc/vitest
presets) and reusable GitHub workflows referenced by git tag. One
version covers both — `vX.Y.Z` tags serve npm and `uses:` refs alike.

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

Bases: `tsconfig/app`, `tsconfig/library`, plus `-build` variants.
Path-bearing options (`outDir`, `rootDir`, `include`) stay
consumer-side on purpose: paths in an extended tsconfig resolve
relative to the base file, which lives in `node_modules` — a base
carrying them resolves an empty file list. The `-build` bases
therefore hold no path options; the consumer declares its own:

```jsonc title="tsconfig.build.json"
{
  "compilerOptions": { "rootDir": "src" },
  "extends": "@olivierzal/configs/tsconfig/library-build",
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

### vitest (decorator transform)

```ts title="vitest.config.ts"
import { swcPlugin } from '@olivierzal/configs/vitest-swc'

export default defineConfig({ oxc: false, plugins: [swcPlugin] })
```

## Reusable workflows

Callers keep their own triggers and reference this repo by tag:

```yaml title=".github/workflows/ci.yml"
jobs:
  ci:
    permissions:
      contents: read
      packages: read
    secrets: inherit
    uses: OlivierZal/configs/.github/workflows/reusable-ci.yml@v1.0.0
    with:
      coverage-node-version: '22' # apps: the Homey runtime leg
      run-lint-package: true # libs
```

`node-versions` names the test legs as a JSON array of quoted strings
(default `["22", "latest", "lts/*"]`) — a repo whose runtime floor is a
specific minor pins that minor here rather than floating with `lts/*`.
`coverage-node-version` must name one of them: it is compared against
each leg, so a version outside the list selects nothing and coverage
plus the Sonar upload it feeds would never run, behind legs that stay
green. The `Verify the coverage leg` step proves the two agree before
any of it starts. Each entry also names a required status check
(`Test (Node <entry>)`), so a caller changing the list updates its
ruleset in the same move.

The `Sonar` job holds the house bar on what that leg uploaded: zero
issues, zero security hotspots, zero duplication and full coverage, on
both the new-code and the overall window, read metric by metric from the
SonarCloud API rather than from the free-tier quality gate (which
tolerates 3 % duplication on new code and cannot be customized).
Anything it could not read — an absent metric, an unreachable API, an
analysis that never appeared — fails with its own diagnosis instead of
passing. A Dependabot pull request, which SonarCloud never analyses
because such workflows receive no secrets, is accepted only once the job
has checked that every commit on it is Dependabot's own and that it
touches nothing but manifests and pinned references; a fork pull request
fails, since it carries source nobody analysed. The context is
`ci / Sonar` — add it to the ruleset only after watching it report
correctly, and never rename it.

Available: `reusable-ci.yml` (check + caller-defined test matrix, caller
picks the legs, the coverage leg and the library gates, plus the Sonar
gate), `reusable-audit.yml`,
`reusable-claude-dependabot-fix.yml` (caller keeps the `workflow_run`
trigger and passes its verify commands). The single-file workflows
(`pr-title`, `zizmor`, `claude*`, `dependabot`) also accept
`workflow_call` so callers can become stubs. `templates/zizmor-apps.yml`
is the apps' zizmor config variant; this repo ships the libs' form.

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

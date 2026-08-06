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
  }),
])
```

The eslint plugins ship as dependencies of this package: rule
evaluations and version bumps happen here once, consumers only bump
their exact pin. Per-repo ignores and documented rule ledgers stay in
each consumer — they are verdicts, not shared policy.

Root `*.config.js` files (typedoc) are linted too, with the full
type-aware rule set: they live outside every tsconfig, so the presets
type them through the project service's default project. This assumes
eslint runs from the repo root (the `allowDefaultProject` glob
resolves against it).

### prettier

```jsonc title="package.json"
{ "prettier": "@olivierzal/configs/prettier" }
```

### tsconfig

```jsonc title="tsconfig.json"
{ "extends": "@olivierzal/configs/tsconfig/app" }
```

Bases: `tsconfig/app`, `tsconfig/library`, plus `-build` variants.
`outDir` stays consumer-side on purpose: paths in an extended tsconfig
resolve relative to the base file, which lives in `node_modules`.

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

Available: `reusable-ci.yml` (check + three-leg test matrix, caller
picks the coverage leg and the library gates), `reusable-audit.yml`,
`reusable-claude-dependabot-fix.yml` (caller keeps the `workflow_run`
trigger and passes its verify commands). The single-file workflows
(`pr-title`, `zizmor`, `claude*`, `dependabot`) also accept
`workflow_call` so callers can become stubs. `templates/zizmor-apps.yml`
is the apps' zizmor config variant; this repo ships the libs' form.

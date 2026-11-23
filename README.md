# @olivierzal/configs

Shared tooling for the OlivierZal repositories: an npm package of
ESLint, Prettier, TypeScript, typedoc and vitest presets, and reusable
GitHub workflows. One release covers both: the same `vX.Y.Z` is the npm
version and the tag your workflow references name.

[![License](https://img.shields.io/github/license/OlivierZal/configs)](https://github.com/OlivierZal/configs/blob/main/LICENSE)
[![Node](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FOlivierZal%2Fconfigs%2Fmain%2Fpackage.json&query=%24.engines.node&label=node&color=brightgreen)](https://github.com/OlivierZal/configs/blob/main/package.json)
[![GitHub release](https://img.shields.io/github/v/release/OlivierZal/configs?sort=semver)](https://github.com/OlivierZal/configs/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/OlivierZal/configs/ci.yml?branch=main&label=CI)](https://github.com/OlivierZal/configs/actions/workflows/ci.yml)
[![CodeQL](https://github.com/OlivierZal/configs/actions/workflows/github-code-scanning/codeql/badge.svg?branch=main)](https://github.com/OlivierZal/configs/security/code-scanning)

[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_configs&metric=alert_status)](https://sonarcloud.io/dashboard?id=OlivierZal_configs)
[![Test coverage](https://sonarcloud.io/api/project_badges/measure?project=OlivierZal_configs&metric=coverage)](https://sonarcloud.io/component_measures?id=OlivierZal_configs&metric=coverage)

## Features

- Two ESLint presets with their plugins, `homeyApp` for a Homey app and
  `library` for a published library: type-aware TypeScript rules, plus
  JSON, Markdown, YAML and `package.json`, and HTML and CSS in an app.
- `webviewFloorBlock`, which holds the sources that run in the Homey
  phone webview to what the iOS 16.4 WebKit runs.
- One Prettier configuration, two TypeScript bases and an overlay that
  type-checks your own `.d.ts` files.
- A typedoc preset that fails the docs build on an undocumented export
  or a broken link, and two vitest fragments: decorator support and the
  100 % coverage bar.
- Reusable GitHub workflows: a CI with the test matrix you describe and
  the SonarCloud bar, publishing to GitHub Packages with provenance, a
  docs site on GitHub Pages, and seven smaller ones.
- A CI check that keeps your npm pin and your workflow references on the
  same version.

## Requirements

- Node.js `^22.23.0 || ^24.18.0 || >=26.4.0`.
- `eslint >=10.6.0`, `prettier >=3.5` and `vitest >=4`: peer
  dependencies, to declare in your own `devDependencies`.
- `jiti`, which ESLint needs to load an `eslint.config.ts`, and
  `@vitest/coverage-v8`, which `vitest --coverage` needs: both in your
  `devDependencies` too.
- TypeScript under the family's two names: the TypeScript 7 compiler as
  `@typescript/native` (an alias of `npm:typescript`), which the CI and
  the `typecheck` script below call by path, and TypeScript 6 as
  `typescript` (an alias of `npm:@typescript/typescript6`), for the
  tools that load it as a library. Add `@types/node`: both tsconfig
  bases load it.
- A GitHub personal access token with the `read:packages` scope, to
  install from GitHub Packages.
- For the CI, publish and docs workflows: GitHub.com and runner 2.336.0
  or newer. GitHub-hosted runners qualify, GitHub Enterprise Server does
  not.

## Installation

The package is published to GitHub Packages. Point npm at it for the
`@olivierzal` scope:

```ini title=".npmrc"
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
@olivierzal:registry=https://npm.pkg.github.com
```

`NODE_AUTH_TOKEN` must hold your token; in CI, the workflows below pass
the run's own `GITHUB_TOKEN`. Then install the package as a development
dependency, at an exact version:

```sh title="install"
npm install --save-dev --save-exact @olivierzal/configs
```

The exact version matters: the presets report a range on an
`@olivierzal/` dependency, and your workflow references must name the
same version. The package is ES modules only and has no root entry:
every import names a subpath.

## Quick start

A published library, linted, formatted and compiled with the family's
settings:

```ts title="eslint.config.ts"
import { library } from '@olivierzal/configs/eslint'
import { type Config, defineConfig } from 'eslint/config'

const config: Config[] = defineConfig([
  { ignores: ['coverage/', 'dist/', 'docs/'] },
  ...library(),
])

export default config
```

```jsonc title="package.json"
{ "prettier": "@olivierzal/configs/prettier" }
```

```jsonc title="tsconfig.json"
{
  "compilerOptions": { "outDir": "dist" },
  "extends": "@olivierzal/configs/tsconfig/library",
  "include": ["*.config.ts", "src", "tests"],
}
```

## Usage

### Lint a Homey app

```ts title="eslint.config.ts (Homey app)"
import { homeyApp } from '@olivierzal/configs/eslint'
import { type Config, defineConfig } from 'eslint/config'

const config: Config[] = defineConfig([
  { ignores: ['.homeybuild/', 'coverage/'] },
  ...homeyApp({
    bundledSourceGlobs: ['settings/**'],
    defaultExportFiles: ['api.mts', 'app.mts', 'drivers/*/{device,driver}.mts'],
    jsdocFiles: ['{api,app}.mts', 'drivers/**/*.mts', 'lib/**/*.mts'],
    webviewFloorFiles: ['settings/**/*.mts'],
  }),
])

export default config
```

| Option                    | Required | What it does                                                                                                                                                         |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bundledSourceGlobs`      | yes      | The sources the app bundles (settings pages, widgets). Like the root config files, `scripts/**` and `tests/**`, they may import devDependencies.                     |
| `defaultExportFiles`      | yes      | The files Homey loads a default export from (`api.mts`, `app.mts`, drivers, devices). A default export is required there; elsewhere only root config files have one. |
| `jsdocFiles`              | yes      | The files whose doc blocks are checked. No block is required, but one that exists must be complete (next section).                                                   |
| `webviewFloorFiles`       | yes      | The sources that run in the phone webview, held to the webview floor (below).                                                                                        |
| `namespaceImportAllow`    | no       | The modules that may be imported as `import * as X`. Any other value namespace import is an error; `import type * as X` always passes.                               |
| `templateExpressionAllow` | no       | The types a template literal may interpolate besides strings, as `{ from, name }` entries such as `{ from: 'lib', name: 'URLSearchParams' }`.                        |
| `untypedDoubleTestFiles`  | no       | The test files where `any` and unsafe assignments, calls and member accesses are accepted, for doubles of untyped Homey SDK surfaces.                                |
| `wireNamingEntries`       | no       | Extra naming entries, for the names a device or an API imposes (next section).                                                                                       |
| `wireNamingFiles`         | no       | The globs where those entries apply. Left out, they apply to the whole app, root config files apart.                                                                 |

`defaultExportFiles`, `jsdocFiles` and `webviewFloorFiles` each take at
least one glob: ESLint rejects an empty `files` list.

The preset also accepts multi-segment snake_case keys such as
`measure_temperature`. Prettier formats the HTML: do not exclude
`*.html` from it.

### Lint a published library

`library()` takes no argument, as in the quick start, or the two naming
options of `homeyApp`. Each of the `wireNamingEntries` is an option
object of `@typescript-eslint/naming-convention`, such as
`{ filter: { match: true, regex: '^__brand$' }, format: null, selector: 'typeProperty' }`.
Anchor every `filter` (`^…$`): an open-ended pattern also applies to
quoted keys such as `'Content-Type'`, which are otherwise left alone.
`wireNamingFiles` names the globs where the entries apply: left out,
they apply to the whole repository. Root config files never accept
them, and in test files they apply whatever `wireNamingFiles` says.

Every export and every public callable member of `src/**/*.ts` needs a
doc block. A doc block, here as in an app, has a description, one
`@param` per parameter, `@returns`, `@throws` as a sentence that names
the class with `{@link}`, one `@template` per type parameter, and no
type in braces.

The preset expects decorators under `src/decorators/` and imports of
`temporal-polyfill` in `src/temporal.ts` only, and lets only root config
files and `tests/**` import a devDependency.

### Hold webview sources to the phone floor

`homeyApp` applies the floor to `webviewFloorFiles`. A library whose
sources end up in a webview imports `webviewFloorBlock` from the same
subpath and adds `webviewFloorBlock(['src/webview/**/*.ts'])` after
`...library()`: it is an element of `defineConfig([...])`, not a list to
spread. Its type is exported as `ConfigWithExtends`, beside the option
types `HomeyAppOptions`, `LibraryOptions` and
`TemplateExpressionAllowEntry`.

In those files the lint reports what the iOS 16.4 WebKit does not run:
`Promise.withResolvers()`, `Object.groupBy()`, iterator helpers and the
rest of what came after ES2023, plus `AbortSignal.any()`, the `v` regex
flag (use `u`) and any import of a Node.js built-in module. The few
later features that engine does ship, such as `String#isWellFormed` and
`Array.fromAsync`, are accepted.

### What both presets enforce

- Every rule is an error: there are no warnings. An `eslint-disable`
  comment needs a description, is an error when it silences nothing, and
  may not disable `@typescript-eslint/naming-convention`.
- Linting is type-aware, root `*.config.js` and `*.config.mjs` files
  included: run ESLint from the repository root.
- A config file assigns its configuration to an annotated constant and
  exports that constant, as the examples here do:
  `export default defineConfig([...])` is reported.
- Names are camelCase, types PascalCase, type parameters start with `T`,
  and a variable may also be PascalCase or UPPER_CASE. A boolean
  variable, parameter or class property starts with `are`, `can`, `did`,
  `has`, `have`, `is`, `requires`, `should`, `was`, `were` or `will`. An
  unused parameter starts with `_`. Test files, which live under
  `tests/`, also accept PascalCase, snake_case and UPPER_CASE
  properties.
- Comments and YAML lines hold in 80 columns (`uses:` lines and URLs
  apart), and JSON and YAML keys are sorted. The keys of a workflow step
  follow one fixed order instead: `id`, `name`, `if`,
  `continue-on-error`, `timeout-minutes`, `uses`, `with`, `env`,
  `shell`, `working-directory`, `run`.

### Format with Prettier

The `prettier` key of the quick start is the whole wiring, for an app as
for a library. The configuration sets `semi: false`, `singleQuote: true`
and `objectWrap: 'collapse'`, and loads `prettier-plugin-packagejson`,
which comes with the package and sorts `package.json`.

### Extend a TypeScript base

The `tsconfig.json` of the quick start extends the library base
(`module: nodenext`, `declarationMap`). An app extends
`@olivierzal/configs/tsconfig/app` instead (`module: preserve`, the DOM
libraries). Both are `strict`, target `es2025` and turn on, among
others, `isolatedDeclarations`, `erasableSyntaxOnly`,
`verbatimModuleSyntax`, `rewriteRelativeImportExtensions`,
`exactOptionalPropertyTypes` and `noUncheckedIndexedAccess`. Neither
sets `outDir`, `rootDir` or `include`: declare them yourself, there and
in the `tsconfig.build.json` that the typedoc preset reads.

### Type-check your own declaration files

Both bases set `skipLibCheck: true`, which also skips the `.d.ts` files
you write yourself. When the program of your `tsconfig.json` loads one,
add a second program over them:

```jsonc title="tsconfig.declarations.json"
{
  "extends": ["./tsconfig.json", "@olivierzal/configs/tsconfig/declarations"],
  "include": ["**/*.d.ts"],
}
```

Then run it in the `typecheck` script of `package.json`:

```sh title="typecheck"
node ./node_modules/@typescript/native/bin/tsc --noEmit && node ./node_modules/@typescript/native/bin/tsc -p tsconfig.declarations.json
```

The `Check` job of the family CI fails when such a `.d.ts` is missing
from that second program, or when `typecheck` does not name it. To
replace a package's types, map the package to your declaration file
through `paths` rather than an ambient `declare module`: the program
then reaches your file without loading the package's own `.d.ts`.

### Document a library with typedoc

typedoc and the two plugins the preset loads are yours to install: this
package does not install them for you. The preset is tested against
typedoc 0.28, typedoc-plugin-coverage 4 and typedoc-plugin-mdn-links 5.

```sh title="install"
npm install --save-dev typedoc typedoc-plugin-coverage typedoc-plugin-mdn-links
```

```js title="typedoc.config.js"
// @ts-check
import { typedocBase } from '@olivierzal/configs/typedoc'

/** @type {Partial<import('typedoc').TypeDocOptions>} */
const config = typedocBase({
  categoryOrder: ['API', 'Errors', 'Types'],
  hostedBaseUrl: 'https://olivierzal.github.io/api-core/',
  name: 'API Core',
  navigationLinks: { GitHub: 'https://github.com/OlivierZal/api-core' },
})

export default config
```

Those four options are required: the `@category` names in the order the
site lists them, the URL it is served from, its title and its header
links by label. Two are optional: `entryPoints`, the modules to document
(default `['src/index.ts']`), and `intentionallyNotExported`, the
symbols a published signature may name without exporting them. The site
is built from `tsconfig.build.json` into `docs/`, with `README.md` as
its index page, and standard types link to their MDN pages. The build
fails on an undocumented export (properties apart), on an invalid link
and on a symbol that a signature names without exporting it.

### Test with vitest

```ts title="vitest.config.ts"
import { coverageDefaults } from '@olivierzal/configs/vitest-coverage'
import { swcPlugin } from '@olivierzal/configs/vitest-swc'
import { type ViteUserConfig, defineConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  oxc: false,
  plugins: [swcPlugin],
  test: {
    coverage: { ...coverageDefaults, include: ['src/**/*.ts'] },
    include: ['tests/**/*.test.ts'],
  },
})

export default config
```

`coverageDefaults` sets the `text` and `lcov` reporters and a 100 %
threshold on branches, functions, lines and statements; `include` and
`exclude` stay yours. `swcPlugin` runs the 2022-03 decorators and needs
`oxc: false` beside it: leave both lines out when the repository
declares no decorator.

### Run the family CI

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
      run-docs: true
      run-lint-package: true
name: CI
on:
  pull_request: {}
  push:
    branches: [main]
  schedule:
    - cron: '23 4 * * *'
permissions: {}
```

| Input                | Default                                                                                             | Meaning                                                                                                                                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-node-version` | `lts/*`                                                                                             | The Node.js version of the `Check` and `Sonar` jobs.                                                                                                                                                                                        |
| `node-versions`      | `[{"node-version": "22", "coverage": true}, {"node-version": "latest"}, {"node-version": "lts/*"}]` | The test legs, as JSON: one object per leg, with its `node-version` (a minor such as `"22.20"` when your runtime is pinned to one) and, on exactly one of them, `coverage: true`. Quote every version: `22.20` unquoted is the number 22.2. |
| `run-docs`           | `false`                                                                                             | Also run `npm run docs` in the `Check` job.                                                                                                                                                                                                 |
| `run-lint-package`   | `false`                                                                                             | Also run `npm run lint:package` in the `Check` job.                                                                                                                                                                                         |

The only secret, `SONAR_TOKEN`, is optional. Your repository needs
this package among its `devDependencies`, a committed
`package-lock.json` (the install is
`npm ci --ignore-scripts`), a root `tsconfig.json` and the npm scripts
`typecheck`, `lint`, `format` and `test`, plus `docs` and `lint:package`
when the inputs ask for them. For SonarCloud it adds a
`sonar-project.properties` with `sonar.projectKey`.

The checks are `Check`, one `Test (Node <node-version>)` per leg and
`Sonar`, each prefixed with your job id (`ci / Sonar`). Changing
`node-versions` renames checks, so update your ruleset in the same
change, and keep `Test (Node latest)` out of the required checks: that
leg may fail without failing the run, but its check still reports the
failure.

`Check` first verifies the test legs, the action pins (see "Pin actions
and adopt a release"), the lock file (the check fails on a prerelease
version that no `package.json` names exactly) and the declaration files
(see "Type-check your own declaration files"). It then runs
`typecheck`, `lint` and `format`.

The leg that carries `coverage: true` runs `npm test -- --coverage`.
With `SONAR_TOKEN` set, it uploads the analysis to SonarCloud on a push,
on a scheduled run and on a pull request from a branch of the same
repository that Dependabot did not open, and fails when SonarCloud's own
quality gate rejects it.
The `Sonar` job then requires, on the analysis of the run's own commit,
zero issues, zero duplication, 100 % coverage and every security hotspot
reviewed: on new code for a pull request, on new and overall code
otherwise. It needs no analysis in two cases only: a repository that
declares neither project nor token, and a Dependabot pull request on
which every commit is Dependabot's. With a project declared, it fails on
a pull request from a fork, on any other event than those three, and
without the token.

### Release a library

Two more callers run on a published GitHub release, each one job in the
shape of the CI caller, with no secret.

`publish.yml` references `reusable-publish.yml` and grants
`attestations: write`, `contents: read`, `id-token: write` and
`packages: write`. It publishes your package to GitHub Packages under
the `@olivierzal` scope, with a provenance attestation, in an
environment named `npm`; a prerelease goes out under the dist-tag
`next`. The job runs no build: your package must build when it is
packed (a `prepare` script).

`docs.yml` references `reusable-docs.yml` and grants `contents: read`,
`id-token: write`, `packages: read` and `pages: write`. The `Build docs`
job runs `npm run build` then `npm run docs` and uploads the `docs`
directory; the `Deploy docs` job publishes it to GitHub Pages in the
`github-pages` environment. With the input `dry-run: true` the site is
built and packed but not deployed. To rehearse before a release, give
the caller a `workflow_dispatch` trigger with a boolean `dry-run` input
and pass it on as `dry-run: ${{ inputs.dry-run || false }}`.

### Reuse the smaller workflows

Seven single-file workflows are callable the same way, so that yours is
a stub: one job that grants the permissions below and references
`OlivierZal/configs/.github/workflows/<file>@<commit sha> # vX.Y.Z`,
under the triggers listed. None takes an input. The three `claude`
workflows need the secret `CLAUDE_CODE_OAUTH_TOKEN`, passed by name.

| Workflow                  | What it does                                                                                           | Permissions to grant                                                                        | Triggers you keep                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `dependency-review.yml`   | Fails a pull request that introduces a vulnerable runtime dependency, at any severity.                 | `contents: read`                                                                            | `pull_request`                                                                 |
| `pr-title.yml`            | Checks that the pull request title follows Conventional Commits.                                       | `pull-requests: read`                                                                       | `pull_request` with `types: [edited, opened, reopened, synchronize]`           |
| `zizmor.yml`              | Audits the workflows and actions under `.github/` with zizmor.                                         | `actions: read`, `contents: read`, `security-events: write`                                 | `pull_request`, `push` on `main`                                               |
| `dependabot.yml`          | Arms auto-merge (squash) on a Dependabot pull request, unless the update is a major.                   | `contents: write`, `pull-requests: write`                                                   | `pull_request`                                                                 |
| `claude.yml`              | Answers an `@claude` mention in an issue or a comment written by an owner, a member or a collaborator. | `actions: read`, `contents: read`, `id-token: write`, `issues: read`, `pull-requests: read` | `issue_comment` with `types: [created]`, `issues` with `types: [opened]`       |
| `claude-code-review.yml`  | Reviews a pull request from a branch of the same repository, unless it is a draft or Dependabot's.     | `contents: read`, `id-token: write`, `issues: write`, `pull-requests: write`                | `pull_request` with `types: [opened, ready_for_review, reopened, synchronize]` |
| `claude-issue-triage.yml` | Labels a new issue with labels the repository already has and posts one triage comment.                | `contents: read`, `issues: write`                                                           | `issues` with `types: [opened]`                                                |

zizmor reports the `issue_comment` trigger of a `claude.yml` stub. To
accept it, add the entry `claude.yml:<line of that trigger>` under
`rules.dangerous-triggers.ignore` in your `.github/zizmor.yml`. The
Homey apps' workflows are in `@olivierzal/homey-kit`.

### Pin actions and adopt a release

Reference every workflow and action by a full commit SHA, with its
release tag as a comment that ends the line (`@<commit sha> # vX.Y.Z`),
never by a branch or a bare tag. Pass secrets by name, never with
`secrets: inherit`.

The `Verify action pins` step of the `Check` job reads the SHA-pinned
`uses:` lines of `.github/workflows/` and `.github/actions/*/action.yml`
and needs network access to GitHub. It fails when a pin has no version
comment, when something follows the version, and when the comment names
a tag that the action's repository does not have or that points at
another commit. A reference to `OlivierZal/configs` or
`OlivierZal/homey-kit` must also carry the tag `v` followed by the
version of its npm package in your `package.json`. A commit that no tag
reaches is annotated `# untagged: <reason>` instead: that fails when a
tag does reach it or when the reason is empty, and those two
repositories may not use it.

To adopt a release, open one pull request by hand that moves the npm
pin, every `OlivierZal/configs` reference (SHA and comment) and, when
the release notes name a new `eslint` minor, that minor
(`npm install -D eslint@~<that minor>`). Dependabot's own pull request
for the npm version cannot carry it: its `Check` job fails on the
mismatch with the workflow references, and, where a Sonar project is
declared, a commit added to its branch fails the `Sonar` job. Have
Dependabot ignore `OlivierZal/configs` in its `github-actions`
ecosystem, and the `version-update:semver-major` and
`version-update:semver-minor` updates of `eslint` in its `npm` one.

Each verification of the `Check` job is a bash script of the installed
package, which you can run locally:
`bash node_modules/@olivierzal/configs/scripts/check-pins.sh`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Report a problem on the
[issue tracker](https://github.com/OlivierZal/configs/issues).

## Security

For vulnerability reports, see [SECURITY.md](SECURITY.md).

## Changelog

The [GitHub release notes](https://github.com/OlivierZal/configs/releases)
are the changelog: each release says what to do to adopt it.

## License

[MIT](LICENSE) © Olivier Zalmanski

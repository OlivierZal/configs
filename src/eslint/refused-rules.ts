/**
 * The rules the family REFUSES, as data — never as a dead `'off'` in a
 * preset. ESLint accepts `'off'` for a rule name that does not exist
 * (verified 2026-09-27: a `rules: { 'no-such-rule': 'off' }` entry lints
 * without a word), so an `off` on a rule no extended preset turns on is
 * never validated — the plugin renames or drops the rule and the line
 * rots in silence, still claiming a verdict. The presets therefore carry
 * only LIVE settings: a rule some preset enables and the family disables
 * stays an `'off'` at its rule site, with its reason, and every refusal
 * of a rule that was never on lands here, where
 * `tests/unit/refused-rules.test.ts` proves each entry against the
 * installed plugins — the rule exists and is not deprecated, it is off
 * or absent wherever its plugin is loaded, its owner (when it names one)
 * runs at `error`, and a floor-bound refusal expires the day the device
 * floor reaches the API it waits for.
 */
export interface RefusedRule {
  // Why the rule is refused: OWNED by another rule (named in `owner`),
  // CONFLICTING with Prettier or a house convention, REDUNDANT with what
  // Prettier already produces, out of the family's DOMAIN, below the
  // device FLOOR (`until` names the Node major that lifts it), or a
  // VOCABULARY verdict — a naming policy the family does not want.
  readonly class:
    'conflicting' | 'domain' | 'floor' | 'owned' | 'redundant' | 'vocabulary'
  readonly reason: string
  readonly rule: string
  // The exact `files` globs of the preset block the refusal is scoped
  // to; absent, the refusal is family-wide and the rule is set in no
  // preset entry at all.
  readonly files?: readonly string[]
  // The rule at `error` that covers what this one would report.
  readonly owner?: string
  // A `floor` refusal waits on `DEVICE_NODE_FLOOR`: the ledger test goes
  // red once the floor reaches this major, forcing the adoption.
  readonly until?: { readonly deviceNodeFloorAtLeast: number }
}

// The Homey Pro runtime's Node major: 22 since firmware 12.9.0, 22.20
// measured on the device 2026-08 (CLAUDE.md, the boundary — the four
// runtime libraries declare it as `engines`; this package's own
// `engines` is the toolchain's, derived from the dependency tree). Every
// `floor` entry below waits on this number.
export const DEVICE_NODE_FLOOR = 22

// The Node major that ships each waited-on API, measured 2026-09-28 by
// `typeof` on the toolchain's own runtimes: Node 24.19.0 (V8 13.6) has
// `Error.isError` and `RegExp.escape` but neither `Iterator.concat` nor
// `Uint8Array#toBase64`/`#toHex`; Node 26.7.0 (V8 14.6) has all five.
// The unicorn sources agree wherever they name a target (24 for
// `prefer-error-is-error` and `prefer-regexp-escape`, 26 for the two
// `Uint8Array` rules; `prefer-iterator-concat` names none).
const NODE_24_FLOOR = { deviceNodeFloorAtLeast: 24 }

const NODE_26_FLOOR = { deviceNodeFloorAtLeast: 26 }

const HTML_FILES = ['**/*.html']

// The app preset's CSS block (`eslint-cssicorn` and unicorn), the shared
// JSON block (unicorn, loaded for two JSON-capable rules) and the shared
// YAML block (unicorn's `recommended-yaml`).
const CSS_FILES = ['**/*.css']

const JSON_FILES = ['**/*.json']

const YAML_FILES = ['**/*.{yaml,yml}']

const CSS_NESTING =
  "The webview floor is the iOS 16.4 WebKit (`css/use-baseline` at `available: 2022` in the app CSS block), which ships no CSS nesting — Safari 16.5 brought it — and the twelve app stylesheets contain none (0 sites with eslint-cssicorn 0.1.0, 2026-10-09): inert by construction. Re-enters with the floor, which homey-kit's `ios-floor-watch.yml` records. The three nesting rules were refused in prose on 2026-09-17 under their unicorn 75 ids; the ledger can hold them since cssicorn, an installed plugin a `files` block of the suite resolves, carries them."

const REDUNDANT_DATA_LAYOUT =
  "Layout for the data languages (`comma-spacing` on JSON, `indent` on JSON and CSS): Prettier formats every JSON and CSS file the family lints and already produces this output — 0 hits over the eight repositories at the family's two-space indent (2026-10-09; the rule's default is `tab`, so even its default is not the house output) — and the rule's own docs send JS/TS users to @stylistic. Never on: no unicorn 77 preset enables either, so an `off` would have validated nothing."

const REDUNDANT_HTML =
  "Prettier's output already satisfies it — 0 hits when forced on over com.melcloud's three pages (2026-09-27) — and Prettier formats every page (`format` runs on HTML too). Never on: `html/recommended` does not enable it, so an `off` here validated nothing."

const SEO_HTML =
  'SEO: a Homey settings page or widget renders inside the Homey app and no crawler reads it. The `<meta name="description">` tags the apps carry are cargo (2024-09, no recorded reason), free to leave.'

export const REFUSED_RULES: readonly RefusedRule[] = [
  {
    class: 'conflicting',
    reason:
      "Fights Prettier on both axes. The `code` axis conflicts with the printer's own output — nine declarations in melcloud-api and seven in com.melcloud it cannot break below 80 — and the `comments` axis, the one Prettier leaves alone, would cost 195 hand-wrapped prose lines behind a `code` sentinel the rule needs, having no comments-only mode (measured 2026-09-15). House comments wrap at print width by convention; a rule that cannot fix what it reports is not what would hold it. As an `off` it was dead twice over: no `@stylistic` preset is extended, and eslint-config-prettier already lists the rule at 0.",
    rule: '@stylistic/max-len',
  },
  {
    class: 'conflicting',
    reason:
      "TypeScript owns the real case: with `noImplicitReturns` in both tsconfig bases and `@typescript-eslint/explicit-function-return-type` at `error`, a path that genuinely drops off the end of a value-returning function is a compile error. What the rule adds is two false positives (heatzy-api `src/facades/manager.ts:13`, melcloud-api `src/facades/classic-factory.ts:54`; measured 2026-09-27 and 2026-10-09 under eslint 10.12): exhaustive `switch` statements whose end TypeScript proves unreachable, where the only edit that would satisfy the rule — a `default` branch — is exactly what `@typescript-eslint/switch-exhaustiveness-check` forbids under the family's `allowDefaultCaseForExhaustiveSwitch: false` (reproduced on one fixture: the two rules report it one each way). Adopting it would force dead code the house's own rule rejects. Class `conflicting`, not `owned`: the owner is the compiler, which the ledger cannot name.",
    rule: 'consistent-return',
  },
  {
    class: 'domain',
    files: CSS_FILES,
    reason: CSS_NESTING,
    rule: 'cssicorn/no-declarations-after-nested-rules',
  },
  {
    class: 'domain',
    files: CSS_FILES,
    reason: CSS_NESTING,
    rule: 'cssicorn/no-nesting-with-mixed-specificity',
  },
  {
    class: 'domain',
    files: CSS_FILES,
    reason: CSS_NESTING,
    rule: 'cssicorn/no-redundant-nested-style-rules',
  },
  {
    class: 'domain',
    files: CSS_FILES,
    reason: CSS_NESTING,
    rule: 'cssicorn/no-redundant-nesting-selector',
  },
  {
    class: 'domain',
    files: CSS_FILES,
    reason: CSS_NESTING,
    rule: 'cssicorn/no-unscoped-nesting-selector',
  },
  {
    class: 'owned',
    files: CSS_FILES,
    owner: 'css/use-baseline',
    reason:
      'Mutually exclusive twin at the floor knob: `light-dark()` is Safari 17.5 (Baseline 2024), above the iOS 16.4 WebKit floor, so `css/use-baseline` at `available: 2022` reports the very function this rule would introduce for every paired light/dark colour declaration.',
    rule: 'cssicorn/prefer-light-dark',
  },
  {
    class: 'owned',
    files: CSS_FILES,
    owner: 'css/use-baseline',
    reason:
      "Mutually exclusive twin at the floor knob: `css/use-baseline` at `available: 2022` reports the range syntax (Baseline 2023, Safari 16.4) this rule would demand on every `@media`, so adopting it would argue with the block the day one appears; no `@media` exists in the twelve app stylesheets (0 sites with eslint-cssicorn 0.1.0, 2026-10-09). Re-enters with the year, or by an exact-name allowance the block's own comment provides for. Refused in prose on 2026-09-17 under its unicorn 75 id.",
    rule: 'cssicorn/prefer-media-feature-range-syntax',
  },
  {
    class: 'domain',
    files: CSS_FILES,
    reason: CSS_NESTING,
    rule: 'cssicorn/prefer-nesting',
  },
  {
    class: 'owned',
    files: CSS_FILES,
    owner: 'css/use-baseline',
    reason:
      'Mutually exclusive twin at the floor knob: the relative colour syntax (`rgb(from …)`) is Baseline 2024 — Safari 16.4 shipped it, Chrome 119 dated it — so `css/use-baseline` at `available: 2022` reports the output this rule would write for every alpha variant of a colour custom property.',
    rule: 'cssicorn/prefer-relative-colors',
  },
  {
    class: 'domain',
    files: CSS_FILES,
    reason:
      "A Homey settings page or widget page owns its whole document and ships one stylesheet: there is no shared page a selector could leak into, so a positive scoping boundary on every selector would prefix the twelve app stylesheets (24 sites, 2026-10-14) for a collision that cannot happen. Off in cssicorn's own `recommended` for the same reason.",
    rule: 'cssicorn/require-selector-scope',
  },
  {
    class: 'redundant',
    files: HTML_FILES,
    reason: REDUNDANT_HTML,
    rule: 'html/class-spacing',
  },
  {
    class: 'domain',
    files: HTML_FILES,
    reason:
      "The one local resource every page references — `<script src=\"index.js\">` — is esbuild's output, written by `scripts/bundle.mts` at build time and absent from the tree, so the rule reports a missing file on each of the family's five live pages (5 sites, 2026-10-12) and would report nothing else: the pages carry no other local reference. A build product is outside what a lint of the source tree can see; the bundler's own failure is the check.",
    rule: 'unicorn/no-missing-local-resource',
  },
  {
    class: 'redundant',
    files: HTML_FILES,
    reason: REDUNDANT_HTML,
    rule: 'html/no-extra-spacing-text',
  },
  {
    class: 'redundant',
    files: HTML_FILES,
    reason: REDUNDANT_HTML,
    rule: 'html/no-multiple-empty-lines',
  },
  {
    class: 'redundant',
    files: HTML_FILES,
    reason: REDUNDANT_HTML,
    rule: 'html/no-trailing-spaces',
  },
  {
    class: 'domain',
    files: HTML_FILES,
    reason: SEO_HTML,
    rule: 'html/require-meta-description',
  },
  {
    class: 'domain',
    files: HTML_FILES,
    reason: SEO_HTML,
    rule: 'html/require-open-graph-protocol',
  },
  {
    class: 'owned',
    owner: 'jsdoc/no-types',
    reason:
      "Reports Google Closure `{type=}` syntax, which has no surface in the family's TypeScript doc blocks: `jsdoc/no-types` (preset, `error`) strips every type brace from `@param`/`@returns`, and `jsdoc/check-tag-names` under `typed` (preset, `error`) forbids `@typedef`, `@property` and `@type` outright, so the only tag this rule alone could name is `@throws {T=}` — an 'optional thrown type' the house `@throws {@link X} when …` form never produces (0 across the eight repositories on jsdoc 65.2, 2026-10-09). Its 65.1 fixer (`enableFixer`) rewrites `{T=} n` to `{T} [n]`, the bracketed optional `no-defaults` with `noOptionalParamNames` refuses, so the fixer is never the best practice here either.",
    rule: 'jsdoc/check-syntax',
  },
  {
    class: 'conflicting',
    reason:
      "TypeScript owns the semantic half — `new` on a non-constructor is TS2351, a class called without `new` TS2348 — leaving a casing heuristic the house naming rule contradicts: two of its three sites family-wide (api-core `src/testing/index.ts:330`, melcloud-api `tests/unit/classic-facades.test.ts:106`; the third, com.melcloud `tests/unit/create-test-instance.ts:5`, a local cast of one) are constructor PARAMETERS that `@typescript-eslint/naming-convention` MANDATES in camelCase (`selector: 'parameter'`, `format: ['camelCase']`), so the two rules cannot both be green. Its only options are name whitelists (`newIsCapExceptions`, `capIsNewExceptions`), the corpus-derived shape the doctrine refuses. Measured 2026-09-27 and again 2026-10-09 under eslint 10.12 (which reads the first code point, #21357): three sites, unchanged. Class `conflicting`, not `owned`: the owner is the compiler, which the ledger cannot name.",
    rule: 'new-cap',
  },
  {
    class: 'domain',
    reason:
      "Options-only by design — `useConfigurationIf` is required and ESLint rejects a bare `'error'` (`Value [] should NOT have fewer than 1 items`, perfectionist 5.12.1) — because array-literal order is semantic in general, and in this family it is semantic everywhere: the widest selector (`matchesAstSelector: 'ArrayExpression'`) reports 939 sites across the eight repositories (2026-10-09), every sampled one order-bearing — MELCloud display order (melcloud-api `src/facades/classic-device-ata.ts:49`), `Map` entry tuples whose key/value positions the fixer would swap (heatzy-api `src/constants.ts:92`), Homey capability order (com.melcloud `drivers/melcloud_atw/driver.mts:24`), perfectionist group precedence (this package's `src/eslint/helpers.ts:11`), zod union match order, `Promise.all` positions, `it.each` tables. The arrays whose order is not data are already sorted by `sort-sets` and `sort-array-includes` at `error`; a selector naming any other would be an option fitted to the corpus, the shape the doctrine refuses. The author keeps it out of every `recommended-*` preset for the same reason.",
    rule: 'perfectionist/sort-arrays',
  },
  {
    class: 'conflicting',
    reason:
      "A decorator stack encodes composition order, not a list: TC39 decorators apply bottom-up, so in the three stacks it reports (melcloud-api `src/facades/classic-base.ts:291-292`, `classic-base-device.ts:354-355`, `classic-base-zone.ts:32-33`; measured 2026-10-09 with 5.12.1) `classicUpdateDevice(s)` is the inner wrapper that patches the registry models after the method resolves and `syncDevices` the outer one that notifies sync observers after that — observers read patched models (api-core `src/decorators/sync-devices.ts`, melcloud-api `src/decorators/classic-update-devices.ts`). The alphabetical fixer swaps the two lines, inverts the nesting and fires `notifySync` before the patch: a behaviour rewrite shipped as a sort, on every unattended `--fix`. heatzy-api's identical `@syncDevices()` / `@updateDevice` stacks pass only because `s` sorts before `u`. `sortOnMethods: false` would erase the three findings and leave a rule enforcing nothing — no other element in the eight repositories carries two decorators. Not owned: `sort-classes`' `*-decorated-*` groups order members, not the decorators on one member.",
    rule: 'perfectionist/sort-decorators',
  },
  {
    class: 'owned',
    owner: 'one-var',
    reason:
      "`one-var: 'never'` splits every multi-declarator statement before order matters, and the split keeps evaluation order where this rule's fixer would reorder side-effecting initialisers. Its one unowned residue, a multi-declarator `for (;;)` initialiser, is absent across the eight repos (2026-09-15).",
    rule: 'perfectionist/sort-variable-declarations',
  },
  {
    class: 'redundant',
    files: JSON_FILES,
    reason: REDUNDANT_DATA_LAYOUT,
    rule: 'unicorn/comma-spacing',
  },
  {
    class: 'vocabulary',
    files: [...JSON_FILES, '**/*.md'],
    reason:
      "GitHub's conventional file names — `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `.github/pull_request_template.md` — and Homey's `.homeycompose` flow and capability ids (snake_case by the platform's vocabulary) are not the family's to rename: 62 JSON and 37 Markdown sites over the eight repositories (2026-10-09), every one an external name, the constraint com.melcloud already carries for its TS file names in its own overlay. The rule runs at `error` on TS/JS through `recommended` and on YAML with `directoryRoots`; on these two surfaces the whole corpus is external, so no option fits — never on there: the family's JSON and Markdown blocks extend no unicorn preset.",
    rule: 'unicorn/filename-case',
  },
  {
    class: 'redundant',
    files: [...JSON_FILES, ...CSS_FILES],
    reason: REDUNDANT_DATA_LAYOUT,
    rule: 'unicorn/indent',
  },
  {
    class: 'vocabulary',
    files: JSON_FILES,
    reason:
      "The keys are not the family's to name — Homey's snake_case capability and flow ids in `driver.compose.json` and `.homeycompose/**`, semver version keys in `.homeychangelog.json` that satisfy no case at all, VS Code's dotted settings ids, the `$flow`/`$filter` capability keys in `vendor/`: 357 sites in the family's JSON scope (2026-10-09), and an `ignore` regex fitted to that corpus is the shape the doctrine refuses. Unicorn itself leaves it off in every preset.",
    rule: 'unicorn/key-name-casing',
  },
  {
    class: 'owned',
    files: YAML_FILES,
    owner: 'yml/key-name-casing',
    reason:
      "Duplicate of `yml/key-name-casing`, at `error` in the YAML block with the family's four cases (camelCase, kebab-case, SCREAMING_SNAKE_CASE, snake_case): the same five case flags, `ignore` regexes against yml's `ignores`. 469 at its camelCase-only default (GitHub Actions' kebab keys), 0 with the four cases — identical to the owner's 0 (2026-10-09). `recommended-yaml` ships it off, so an off at the block would be dead.",
    rule: 'unicorn/key-name-casing',
  },
  {
    class: 'vocabulary',
    files: HTML_FILES,
    reason:
      'The main table\'s verdict — a live `\'off\'` where `recommended` enables it, because the abbreviation renames it forces fight the domain naming — reaches HTML through the ledger, since nothing enables the rule on HTML: its two sites are the `id="configuration"` and `id="configuration_summary"` of com.melcloud.extension\'s settings page (2026-10-09). On YAML, where `recommended-yaml` enables it, the same verdict is a live off at the block.',
    rule: 'unicorn/name-replacements',
  },
  {
    class: 'vocabulary',
    reason:
      "Bans `new` and `class` as identifier prefixes. NOT owned: `@typescript-eslint/naming-convention` as configured checks formats and boolean prefixes, never a forbidden prefix. Refused as vocabulary: 87 sites would fire family-wide (2026-09-27), `newSettings` ×29 and `className` ×8 among them — the latter the DOM's own property name — and unicorn itself keeps the rule out of `recommended`.",
    rule: 'unicorn/no-keyword-prefix',
  },
  {
    class: 'conflicting',
    reason:
      'House comments wrap prose at print width; the rule reads those wraps as unfinished sentences and its fixer JOINS the group into one `//` line without reflowing it (verified in the rule source, 2026-09-27) — not noise but the destruction of the convention, on every `--fix` run.',
    rule: 'unicorn/no-manually-wrapped-comments',
  },
  {
    class: 'domain',
    files: HTML_FILES,
    reason:
      "The module bundles the pages reference are gitignored build outputs (CI lints without building); their existence is guaranteed harder by the bundling script, which hashes every local reference and throws when one is missing (the guarantee lands through the validate workflow's CLI build). Refused for HTML only — on CSS and Markdown, where every referenced file is committed, the rule runs at `error`.",
    rule: 'unicorn/no-missing-local-resource',
  },
  {
    class: 'floor',
    reason:
      "Rewrites to `Error.isError()`, a Node 24 API (the rule's own source: enable when the project targets Node.js >=24; a function on Node 24.19.0, `undefined` on 22.23.0, measured 2026-09-28); the Homey Pro runs Node 22.",
    rule: 'unicorn/prefer-error-is-error',
    until: NODE_24_FLOOR,
  },
  {
    class: 'floor',
    reason:
      "Rewrites to `Iterator.concat()`, a Node 26 API — `typeof Iterator.concat` is `undefined` on Node 24.19.0 and a function on 26.7.0 (measured 2026-09-28; the rule's source names no Node target); the Homey Pro runs Node 22.",
    rule: 'unicorn/prefer-iterator-concat',
    until: NODE_26_FLOOR,
  },
  {
    class: 'domain',
    reason:
      "Neither tsconfig base sets `resolveJsonModule`, and the rewrite from `JSON.parse(readFileSync(…))` to `import … with { type: 'json' }` changes semantics — module-relative resolution instead of cwd-relative, load-once caching, a parse failure at link time instead of at the call — so the author keeps it opt-in (`recommended: false` in unicorn 75 and 76; it never arrived with 75 as CLAUDE.md once recorded).",
    rule: 'unicorn/prefer-json-import',
  },
  {
    class: 'floor',
    reason:
      "Rewrites to `RegExp.escape()`, a Node 24 API (the rule's own source: enable when targeting Node.js 24; a function on Node 24.19.0, `undefined` on 22.23.0, measured 2026-09-28); the Homey Pro runs Node 22.",
    rule: 'unicorn/prefer-regexp-escape',
    until: NODE_24_FLOOR,
  },
  {
    class: 'floor',
    reason:
      "Rewrites to `Uint8Array#toBase64()`, a Node 26 API (the rule's own source: enable when targeting Node.js 26; `undefined` on Node 24.19.0, a function on 26.7.0, measured 2026-09-28); the Homey Pro runs Node 22.",
    rule: 'unicorn/prefer-uint8array-base64',
    until: NODE_26_FLOOR,
  },
  {
    class: 'floor',
    reason:
      "Rewrites to `Uint8Array#toHex()`, a Node 26 API (the rule's own source: enable when targeting Node.js 26; `undefined` on Node 24.19.0, a function on 26.7.0, measured 2026-09-28); unicorn 75 and 76 ship it `recommended: false`, so it never arrived — CLAUDE.md's unicorn 75 entry recorded it as recommended by mistake.",
    rule: 'unicorn/prefer-uint8array-hex',
    until: NODE_26_FLOOR,
  },
  {
    class: 'conflicting',
    files: CSS_FILES,
    reason:
      "CSS has no line comment, so the MULTILINE default turns a one-line section label — `/* Zone selector */` — into a three-line block: 18 sites over the three apps' stylesheets (com.melcloud 14, com.heatzy 1, com.melcloud.extension 3; 2026-10-09), the shape the family exempts for the JS config files at their block. At `error` on TS/JS through `recommended`, where a line comment exists; on CSS nothing enables it (the CSS block extends no unicorn preset).",
    rule: 'unicorn/single-line-block-comment-style',
  },
]

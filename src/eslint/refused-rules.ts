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

/**
 * The Homey Pro runtime's Node major: 22 since firmware 12.9.0, 22.20
 * measured on the device 2026-08 (CLAUDE.md, the boundary — the four
 * runtime libraries declare it as `engines`; this package's own
 * `engines` is the toolchain's, derived from the dependency tree). Every
 * `floor` entry of the ledger waits on this number.
 */
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

/**
 * The ledger: every refusal of a rule no preset turns on, one entry
 * each, proven against the installed plugins by the suite.
 */
export const REFUSED_RULES: readonly RefusedRule[] = [
  {
    class: 'conflicting',
    reason:
      "TypeScript owns the real case: with `noImplicitReturns` in both tsconfig bases and `@typescript-eslint/explicit-function-return-type` at `error`, a path that genuinely drops off the end of a value-returning function is a compile error. What the rule adds is two false positives (heatzy-api `src/facades/manager.ts:13`, melcloud-api `src/facades/classic-factory.ts:54`; measured 2026-09-27 and 2026-10-09 under eslint 10.12): exhaustive `switch` statements whose end TypeScript proves unreachable, where the only edit that would satisfy the rule — a `default` branch — is exactly what `@typescript-eslint/switch-exhaustiveness-check` forbids under the family's `allowDefaultCaseForExhaustiveSwitch: false` (reproduced on one fixture: the two rules report it one each way). Adopting it would force dead code the house's own rule rejects. Class `conflicting`, not `owned`: the owner is the compiler, which the ledger cannot name.",
    rule: 'consistent-return',
  },
  {
    class: 'domain',
    files: CSS_FILES,
    reason:
      "Enforces that the fallbacks of CONFIGURED custom properties agree within a file, and configures nothing by default (`customProperties: []`, 0.3.0): a list is the rule's whole subject. The family's stylesheets carry nine fallbacks over eighteen files (2026-10-24), all on Homey's theme tokens (`var(--homey-color-red, rgb(216 28 29))` and six siblings), each written once per file but two; a list naming those seven tokens would hold two agreements and be maintained for every token the webviews adopt — an option fitted to the corpus, which the doctrine refuses. The fallback values themselves are `css/use-baseline`'s and `prefer-existing-custom-properties`' business, both at `error`.",
    rule: 'cssicorn/consistent-custom-property-fallbacks',
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
    class: 'owned',
    files: CSS_FILES,
    owner: 'css/use-baseline',
    reason:
      "Mutually exclusive twin at the floor knob: `subgrid` is Baseline 2023 — Safari 16.0 shipped it, Chrome 117 dated it — so `css/use-baseline` at `available: 2022` reports the one rewrite this rule suggests (measured 2026-10-24, 0.3.0); no nested grid repeats a parent track definition in the eighteen app stylesheets. Re-enters with the year, or by the exact-name allowance `allowPropertyValues: { 'grid-template-columns': ['subgrid'], 'grid-template-rows': ['subgrid'] }` (Safari 16.0, inside the 16.4 floor) the day a page needs one.",
    rule: 'cssicorn/prefer-subgrid',
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
    class: 'domain',
    reason:
      "Reports the AUTHORING of a module that re-exports more than three runtime names and more than it declares — which is what a published package's entry point is. Of its 27 sites over the eight repositories (4.18.1, 2026-11-09), twelve are `exports` targets (the four libraries' `src/index.ts`, melcloud-api's `classic.ts` and `home.ts` dialect entries, homey-kit's `node`, `settings`, `testing`, `webview` and `widget` entries), fourteen the directory barrels those entries re-export from, and the last com.melcloud's `files.mts`, the JSON import seam. The premise — modules loaded and unused behind a barrel — is void on both runtimes the family ships to: Node loads a package through its entry and keeps the graph, and every manifest declares `sideEffects: false`, the contract under which esbuild drops what a webview bundle does not reach (each app's perimeter test pins its bundles' inputs). Ported from eslint-plugin-barrel-files, whose subject is application code behind a bundler.",
    rule: 'import-x/avoid-barrel-files',
  },
  {
    class: 'domain',
    reason:
      "Reports an import whose target's runtime graph exceeds twenty modules: 331 of its 425 sites over the eight repositories (4.18.1, 2026-11-09) are a dependency's entry point — vitest 228 times, this family's own SDKs 94 (`@olivierzal/api-core`, `@olivierzal/melcloud-api` with its dialect entries, `@olivierzal/heatzy-api`), yaml, chart.js, two ESLint plugins — the one path an `exports` map admits, and the remaining 94 the libraries' own directory barrels, `avoid-barrel-files`' subject. A consumer that may not import `vitest` imports nothing; the graph behind a package entry is the package, and the manifests' `sideEffects: false` is what lets a bundler prune it.",
    rule: 'import-x/avoid-importing-barrel-files',
  },
  {
    class: 'domain',
    reason:
      'Counts how imports are spelled, not what a module depends on: a Set of distinct specifiers, so one barrel weighs 1 however many modules sit behind it while the same names taken from their own modules weigh one each, and `ignoreTypeImports` drops not only `import type` but every `export … from` and dynamic `import()` (4.18.1, read 2026-11-20). A cap would reward routing imports through a barrel, not fewer dependencies, so the number carries no signal worth one.',
    rule: 'import-x/max-dependencies',
  },
  {
    class: 'owned',
    owner: 'import-x/avoid-namespace-import',
    reason:
      "The same ban as `import-x/avoid-namespace-import` — a namespace import hides which names a module uses — with a fixer and `ignore` globs, but no exemption for `import type * as`, which the owner has by construction. A type namespace is erased and names what no named import can: the module type a mocked module is typed against (`mockModule<typeof HomeyLib>`, the three apps' `app.test.ts`; `consistent-type-imports` refuses a `typeof import()` annotation) and the same-name types com.melcloud's `types/classic-capabilities.mts` disambiguates across three modules — twelve sites over the three apps (4.18.1, 2026-11-09), none a glob could carve out without also admitting a value import of the same source. Ran at `error` in the library preset until 8.8.0 (zero sites there, of either kind) and in the app preset for 8.7.0 alone, an unadopted release; the owner runs in both since, with the overlay's `namespaceImportAllow` for com.melcloud's two documented dialect namespaces (31 value sites).",
    rule: 'import-x/no-namespace',
  },
  {
    class: 'domain',
    reason:
      "Takes the default export's BINDING name for the module's name, a premise published packages contradict: eleven of its 13 sites (4.18.1, 2026-11-09) are this package's plugin imports, whose shipped bindings read `plugin`, `_default` and `eslintPluginUnicorn` — `stylistic`, `perfectionist`, `unicorn`, `vitest`, `esx`, `cssicorn` and `swc` all reported, since 4.18's module-name aliasing admits the specifier's full word sequence and not a plugin's conventional short name. The family's own default exports exist only where a platform demands them — Homey's `api.mts`, each exporting `api`; `eslint.config.ts`, each exporting `config` (`import-x/no-default-export` at `error` keeps it so) — so a module consuming two of them must rename one: com.melcloud's `api-contract.test.ts` takes the widgets' `api` as `ataGroupSettingApi` and `chartsApi`. Its `whitelist` is a list of the corpus, the shape the doctrine refuses.",
    rule: 'import-x/no-rename-default',
  },
  {
    class: 'owned',
    owner: 'perfectionist/sort-imports',
    reason:
      "Import order is perfectionist's: `sort-imports` at `error` in the shared table, with the family's groups. 4.18 added a `'top'` mode to `warnOnUnassignedImports` — side-effect imports before every assigned one — which the owner already holds through its leading `side-effect` group: zero sites under the mode over the eight repositories (2026-11-09; the two `import 'source-map-support/register.js'` open their `app.mts`).",
    rule: 'import-x/order',
  },
  {
    class: 'domain',
    reason:
      "Inert by construction on ESLint 8 and later: the rule reports its own obsolescence and returns before reading an example, its engine being the removed `CLIEngine`. Its successor is not a rule but the plugin's examples processor, whose verdict is recorded with the plugin triage (CLAUDE.md). Not flagged `meta.deprecated` in jsdoc 65.5: the day it is, this row goes.",
    rule: 'jsdoc/check-examples',
  },
  {
    class: 'owned',
    owner: 'jsdoc/no-types',
    reason:
      "Reports the Google Closure `{type=}` suffix, a detail of a type brace the family does not write: the brace itself is the error on every tag of the family's vocabulary that takes a JSDoc type: `jsdoc/no-types` on `@param` and `@returns` in every signature context, `jsdoc/valid-types` through `structuredTags` on `@template`, `@throws` and `@yields`, and `jsdoc/check-tag-names` under `typed` forbids `@typedef`, `@property` and `@type` outright. Alone, the rule can only name a `{T=}` on `@next`, whose structure the plugin's helper pins, or after a tag that has no type position. Its fixer (`enableFixer`) writes `{T} [name]`, which `jsdoc/no-defaults` with `noOptionalParamNames` refuses, and `{T|undefined}` on the other tags, which keeps the brace (jsdoc 65.5, 2026-11-20).",
    rule: 'jsdoc/check-syntax',
  },
  {
    class: 'conflicting',
    reason:
      "Turns the comment before a function, a variable or a property into a doc block, on the premise that such a comment is documentation. The family holds two channels by role: `//` is an implementation note (`@stylistic/multiline-comment-style` at `separate-lines`), absent from the emitted `.d.ts`, the hover and the typedoc site; the doc block is the contract, held to the whole jsdoc table. A converted note becomes a contract, so the house's own rules then ask `@param`, `@returns` and `@throws` of private members and unexported helpers, and deleting the note is the cheapest way to comply: a rule that penalises explaining. Where a note sits between a doc block and its declaration the fixer writes a second block that orphans the real one. Which declarations must carry a doc block is `jsdoc/require-jsdoc`'s question.",
    rule: 'jsdoc/convert-to-jsdoc-comments',
  },
  {
    class: 'owned',
    owner: 'jsdoc/no-types',
    reason:
      "Checks that the package named by an inline `import()` type in a doc brace is listed in `package.json`. In the family's TypeScript there is no such brace to check: the brace itself is the error on every tag of the family's vocabulary that takes a JSDoc type: `jsdoc/no-types` on `@param` and `@returns` in every signature context, `jsdoc/valid-types` through `structuredTags` on `@template`, `@throws` and `@yields`, and `jsdoc/check-tag-names` under `typed` forbids `@typedef`, `@property` and `@type` outright. It never reads a real import, whose dependency status is TypeScript's and `import-x/no-extraneous-dependencies`'.",
    rule: 'jsdoc/imports-as-dependencies',
  },
  {
    class: 'conflicting',
    reason:
      'Requires a blank line before every multi-line doc block and names no context, so it reports the second and later documented member of every interface, object type and object literal, where the perfectionist settings hold the opposite layout (`newlinesBetween: 0`, `newlinesInside: 0`): with both on, ESLint ends on `ESLintCircularFixesWarning` and one rule stays red. It also counts a `//` note or an `eslint-disable` directive as the text before the block and separates the note from the doc block it introduces. Where a blank line IS the layout — module-level types, functions and classes, class members — `perfectionist/sort-modules` and `sort-classes` already report a glued block.',
    rule: 'jsdoc/lines-before-block',
  },
  {
    class: 'owned',
    owner: 'jsdoc/require-description',
    reason:
      "An empty block is a block without a description, and `jsdoc/require-description`, at `error` on `contexts: ['any']`, reports every one of them wherever it sits. What this rule adds is its fixer, which deletes the block: an empty block has two opposite corrections (write the description, or delete the block), and where `jsdoc/require-jsdoc` demands the block the deletion trades one report for another. The ownership holds as long as `require-description` keeps its `any` context.",
    rule: 'jsdoc/no-blank-blocks',
  },
  {
    class: 'conflicting',
    reason:
      "Its resolver is a syntactic stand-in for TypeScript's: a `{@link}` name must be declared or imported in the file, or be a sibling of a concrete class member. So it rejects links the compiler resolves (an inherited member, an interface sibling) and accepts links it cannot (a missing member of an imported class). Satisfying it means importing a module only to name it in prose, an import the house's unused-import rules then report. Its other half, type names in braces, has no object where braces are forbidden. Link validity belongs to the tools that resolve as TypeScript does: the checker in the editor, typedoc's `invalidLink` in the libraries.",
    rule: 'jsdoc/no-undefined-types',
  },
  {
    class: 'owned',
    owner: 'jsdoc/check-tag-names',
    reason:
      "Judges JSDoc casts, `/** @type {T} */ (value)`, the assertion syntax of type-checked JavaScript. It acts only on blocks that carry `@type`, a tag `jsdoc/check-tag-names` under `typed` forbids outright in the family's TypeScript; real assertions (`as`) are held by `@typescript-eslint/no-unnecessary-type-assertion`.",
    rule: 'jsdoc/no-unnecessary-type-assertion',
  },
  {
    class: 'owned',
    owner: 'jsdoc/no-types',
    reason:
      "Replaces an inline `import()` type in a doc brace by a JSDoc `@import` tag, the idiom of JSDoc-typed JavaScript. In a TypeScript file that tag is inert, the compiler does not read it, and the brace that carries the `import()` is itself the error: the brace itself is the error on every tag of the family's vocabulary that takes a JSDoc type: `jsdoc/no-types` on `@param` and `@returns` in every signature context, `jsdoc/valid-types` through `structuredTags` on `@template`, `@throws` and `@yields`, and `jsdoc/check-tag-names` under `typed` forbids `@typedef`, `@property` and `@type` outright. Its fixer, on by default and run unattended in every consumer, would write into TypeScript sources a block the house then rejects. At `error` in the table until 8.11.0, on no stated reason.",
    rule: 'jsdoc/prefer-import-tag',
  },
  {
    class: 'conflicting',
    reason:
      "Its sentence model is a splitter on full stops, and the family's blocks are Markdown: it reads a sentence that opens on an inline `{@link}` as lower-case and a Markdown list as a paragraph missing its period, two forms the house holds on purpose (the `{@` opener of `jsdoc/match-description`, the indented sections of `jsdoc/check-indentation`). Its fixer then rewrites prose: it capitalises the word after the link and puts a period on the last list item only. The two ends of a description are held by `jsdoc/match-description`.",
    rule: 'jsdoc/require-description-complete-sentence',
  },
  {
    class: 'conflicting',
    reason:
      'An `@example` body is code, and no gate of the family compiles, lints or runs it: a mandated example restates the call in a comment and drifts from the signature, the duplication `jsdoc/no-types` and `jsdoc/no-defaults` refuse for types and optionality. The family keeps examples where recovery code is the documentation and demonstrates the rest in tests, which fail when a signature moves. The fixer writes an empty `@example` tag: a stub, never a correction.',
    rule: 'jsdoc/require-example',
  },
  {
    class: 'conflicting',
    reason:
      "The type of the value fed back through `next()` is the third argument of `Generator<T, TReturn, TNext>`, checked by the compiler; a brace on `@next` repeats it and nothing verifies the copy. The plugin's own tsdoc preset turns the rule off; the house keeps the description half (`jsdoc/require-next-description`) and leaves the type to the signature.",
    rule: 'jsdoc/require-next-type',
  },
  {
    class: 'conflicting',
    reason:
      "A parameter's type is in the signature, checked by the compiler; a brace in the doc block repeats it and nothing checks the copy. `jsdoc/no-types` holds that practice at `error`, and this rule demands exactly what it forbids: no block satisfies both.",
    rule: 'jsdoc/require-param-type',
  },
  {
    class: 'owned',
    owner: 'jsdoc/check-tag-names',
    reason:
      '`@property` documents the shape of a `@typedef`, the JSDoc way to declare a type; in TypeScript the interface or the alias declares it, and `jsdoc/check-tag-names` under `typed` forbids the tag outright, typed or not. Every tag this rule could report is already an error.',
    rule: 'jsdoc/require-property-type',
  },
  {
    class: 'conflicting',
    reason:
      'The return type is in the signature, checked by the compiler; a brace on `@returns` repeats it unverified, and typedoc drops it from the published text. `jsdoc/no-types` holds the practice at `error` and this rule demands what it forbids: no block satisfies both.',
    rule: 'jsdoc/require-returns-type',
  },
  {
    class: 'conflicting',
    reason:
      "Requires the JSDoc brace `@throws {Type}`, the one form typedoc drops from the published text, and reports every form that survives publication. The exception's class is information TypeScript does not carry, so it is written where the docs keep it: as a `{@link}` inside the sentence, which typedoc renders and link-checks. `jsdoc/valid-types`, through the `structuredTags` setting, forbids the brace this rule asks for.",
    rule: 'jsdoc/require-throws-type',
  },
  {
    class: 'conflicting',
    reason:
      "The yielded type is the first argument of the function's `Generator<…>` return type, checked by the compiler; a brace on `@yields` repeats it, drifts unverified, and typedoc drops it from the published text. The rule reports the brace-free tag, the house form, and `jsdoc/valid-types` reports the brace it asks for.",
    rule: 'jsdoc/require-yields-type',
  },
  {
    class: 'conflicting',
    reason:
      "Both of its modes assume a renderer the family does not have. The doc blocks are Markdown, read by typedoc and by the editor's hover, and a code span is how the house writes a type or an identifier (`jsdoc/match-description` accepts one as a description's first or last character). `escapeMarkdown` puts a backslash before every code span's opening backtick, which unmakes the span; `escapeHTML` turns `<` and `&` inside code spans into entities, which Markdown shows verbatim. The rule always fixes.",
    rule: 'jsdoc/text-escaping',
  },
  {
    class: 'owned',
    owner: '@typescript-eslint/ban-ts-comment',
    reason:
      "A port of `@typescript-eslint/ban-ts-comment` for projects that lint JavaScript without typescript-eslint. The original runs at `error` on every file of the family, the libraries' JavaScript config files included; every site this rule reports, the original reports.",
    rule: 'jsdoc/ts-ban-ts-comment',
  },
  {
    class: 'owned',
    owner: 'jsdoc/no-types',
    reason:
      "Chooses between `{run(): void}` and `{run: () => void}` inside a doc-block type: the style of a brace the house does not write, since the brace itself is the error on every tag of the family's vocabulary that takes a JSDoc type: `jsdoc/no-types` on `@param` and `@returns` in every signature context, `jsdoc/valid-types` through `structuredTags` on `@template`, `@throws` and `@yields`, and `jsdoc/check-tag-names` under `typed` forbids `@typedef`, `@property` and `@type` outright. The real declarations are held by `@typescript-eslint/method-signature-style`.",
    rule: 'jsdoc/ts-method-signature-style',
  },
  {
    class: 'owned',
    owner: 'jsdoc/no-types',
    reason:
      "Simplifies a template-literal type written inside a doc brace: a refinement of a brace the house does not write, since the brace itself is the error on every tag of the family's vocabulary that takes a JSDoc type: `jsdoc/no-types` on `@param` and `@returns` in every signature context, `jsdoc/valid-types` through `structuredTags` on `@template`, `@throws` and `@yields`, and `jsdoc/check-tag-names` under `typed` forbids `@typedef`, `@property` and `@type` outright. Template-literal types in code are held by `@typescript-eslint/no-unnecessary-template-expression`.",
    rule: 'jsdoc/ts-no-unnecessary-template-expression',
  },
  {
    class: 'owned',
    owner: 'jsdoc/no-types',
    reason:
      "Rewrites a lone call signature `{(): void}` into a function type inside a doc-block type: the style of a brace the house does not write, since the brace itself is the error on every tag of the family's vocabulary that takes a JSDoc type: `jsdoc/no-types` on `@param` and `@returns` in every signature context, `jsdoc/valid-types` through `structuredTags` on `@template`, `@throws` and `@yields`, and `jsdoc/check-tag-names` under `typed` forbids `@typedef`, `@property` and `@type` outright. The real declarations are held by `@typescript-eslint/prefer-function-type`.",
    rule: 'jsdoc/ts-prefer-function-type',
  },
  {
    class: 'owned',
    owner: 'jsdoc/no-types',
    reason:
      "Normalises the inside of a type brace (spacing, array style, quotes). The house does not style those braces, it forbids them: the brace itself is the error on every tag of the family's vocabulary that takes a JSDoc type: `jsdoc/no-types` on `@param` and `@returns` in every signature context, `jsdoc/valid-types` through `structuredTags` on `@template`, `@throws` and `@yields`, and `jsdoc/check-tag-names` under `typed` forbids `@typedef`, `@property` and `@type` outright. Its fixer, on by default, would rewrite in place a brace every owner wants removed.",
    rule: 'jsdoc/type-formatting',
  },
  {
    class: 'domain',
    reason:
      "A file's length measures nothing the family holds code to: what makes code hard to follow is a long function, deep nesting, branching and statement count, each capped in production code (`max-depth` 3 and `complexity` 10 below ESLint's defaults, `max-lines-per-function` 50 and `max-statements` 10 at them, the two length caps lifted in the test block), while a module's boundary follows cohesion, and a cohesive module split to meet a number exports its private helpers as a cross-module surface for the same lines (com.melcloud's verdict on `settings/index.mts`, 2026-09-14). ESLint's own docs grant there is no objective maximum.",
    rule: 'max-lines',
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
    class: 'domain',
    reason:
      "Options-only by design, like `sort-arrays` — `useConfigurationIf` is required, a bare `'error'` is rejected, and the docs scope it to «classes where parameter order does not matter (e.g., classes using dependency injection)», out of every `recommended-*` preset — because a constructor's parameter order is positional API: the fixer reorders the parameters and not one `new X(a, b)` call site, so an unattended `--fix` rewrites behaviour. The family has no such class: 75 constructors across the eight repositories, 0 parameter properties, 0 decorators (2026-10-22, 5.13.0), and under the widest selector (`matchesAstSelector: 'MethodDefinition'`) the rule reports 15 of them, every one called positionally — com.melcloud `drivers/base-report.mts:72` `(device, config)` under three subclasses, api-core `src/api/sync-manager.ts` `(syncFunction, logger, intervalMinutes = false)`, which the fixer turns into `(intervalMinutes = false, logger, syncFunction)` while its four `new SyncManager(syncFunction, logger, 0)` sites stand — a semver-major break of a published library, and a signature `@typescript-eslint/default-param-last` then reports, since the rule partitions on `?` only, never on a default. Every non-inert configuration rewrites positional API and every inert one enforces nothing. The one order-free shape the family writes, a single destructured options object, has one parameter and is `sort-objects`' business; member order is `sort-classes`', both at `error`.",
    rule: 'perfectionist/sort-constructor-parameters',
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
    class: 'owned',
    owner: '@typescript-eslint/strict-void-return',
    reason:
      'Bans an async function as a `Promise#finally()` callback. unicorn 80 took it out of `recommended` and `unopinionated` because it polices a spelling, not the hazard: by its own docs a non-async callback returning the same promise passes, and an async one that handles its own errors is reported. The type-aware owner reports the hazard in both spellings — `finally` takes a `() => void`, so a promise-returning callback, async or not, is a value returned where none is expected — on awaited and `void`-discarded chains alike, and `unicorn/prefer-await` already reports the `.finally()` chain itself. What only this rule sees is a callback whose type was made void on purpose (an `as () => void` cast, a void overload over an async implementation, a JSDoc `@type` in a JavaScript file), measured over 61 shapes (2026-11-18); 0 sites over the eight repositories when forced on (2026-11-16). On through `recommended` until 79, so the family ran it.',
    rule: 'unicorn/no-async-promise-finally',
  },
  {
    class: 'vocabulary',
    reason:
      "Bans `new` and `class` as identifier prefixes. NOT owned: `@typescript-eslint/naming-convention` as configured checks formats and boolean prefixes, never a forbidden prefix. Refused as vocabulary, on what the prefixes say rather than how often they occur: `className` is the DOM's and the platform's own property name, `newSettings` names the state a write moves to, and the confusion the rule guards against — `newFoo` read as `new Foo` — is one a camelCase identifier never invites, a keyword being followed by a space. unicorn itself keeps the rule out of `recommended`.",
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
      "CSS has no line comment, so the MULTILINE default turns a one-line section label — `/* Zone selector */` — into a three-line block: 18 sites over the three apps' stylesheets (com.melcloud 14, com.heatzy 1, com.melcloud.extension 3; 2026-10-09), the shape the family exempts for the JS config files at their block. On TS/JS, where a line comment exists, `recommended` turns it on and the main table turns it off for a conflict of its own, stated at the entry; on CSS nothing enables it (the CSS block extends no unicorn preset).",
    rule: 'unicorn/single-line-block-comment-style',
  },
  {
    class: 'conflicting',
    files: ['tests/**/*.ts'],
    reason:
      "Reads syntax, not effect: at collection scope it reports a bare call that is not the runner's own, and an initialised `let`. A shared suite — a helper of a consumer's own test tree that owns its `describe`, called once per implementation — is such a call, and it is registration: Vitest admits a suite function only at the top level or inside another suite, and drops or rejects one moved into a hook, as the message asks (5.1.0, reproduced 2026-11-20). `vitest/require-top-level-describe` and `vitest/valid-describe-callback`, both at `error`, refuse the other shapes a suite shared between test files can take; only this call passes them, or the same call one `for…of` deep, which the rule does not report. Setup itself passes behind `const`, `await` or any `vi.*` call, and the `let` half reads the initialiser, so a variable a hook already assigns is reported for its placeholder. `allowedFunctionCalls` matches spellings and validates none: it could only list each consumer's own helpers.",
    rule: 'vitest/require-hook',
  },
]

/**
 * The plugin versions the rule tables in this directory were last
 * audited against, as `major.minor`. Dependabot moves the pins in
 * `package.json` without anyone reading what a release added — a new
 * rule, a new option, a widened default — so the tables drift behind
 * the tools that run them. `tests/unit/audited-versions.test.ts` fails
 * the moment an installed plugin's `major.minor` leaves this table:
 * re-read that release's notes, adopt or refuse what it adds in the
 * tables, and move the entry in the same pull request. A patch bump
 * passes without ceremony.
 *
 * A FULL reading — every rule of every plugin against the tables, not a
 * release's delta — was done on 2026-09-15 and again on 2026-09-27
 * (CLAUDE.md, plugin triage; the second one measured every unconfigured
 * rule over the seven consumers and admitted three plugins: es-x,
 * regexp, eslint-comments). Between the two, entries moved by DELTA
 * readings of their release notes, each measured over the eight
 * repositories before it moved (2026-09-22: eslint 10.11, unicorn 76,
 * package-json 1.9, html-eslint 0.66; 2026-09-29: typescript-eslint 8.71,
 * jsdoc 65; 2026-10-09: eslint 10.12, unicorn 77 with eslint-cssicorn 0.1
 * — the CSS half unicorn moved out — perfectionist 5.12, package-json
 * 1.10, jsdoc 65.2, yml 3.9; 2026-10-14: unicorn 78, eslint-cssicorn
 * 0.2, jsdoc 65.3 — measured with a pack of this package installed in
 * the seven consumers, and a probe config extending each repository's
 * own for the rules no preset turns on; same day, html-eslint 0.67 and
 * es-x 10.1, zero sites over the seven consumers; 2026-10-22: jsdoc 65.4
 * — `check-tag-names`' fixer moves `@prop` descriptions onto the
 * properties they name, under the preset's `typed: true`, behaviour only
 * — perfectionist 5.13 — `sort-constructor-parameters` refused in the
 * ledger, 15 positional constructors over the eight repositories; the
 * sort fixes, zero sites, and the settings values it now validates at
 * lint start, accepted — and typescript-eslint 8.72 — `await-thenable`'s
 * `allowMixedPromiseArrays` kept at its strict default, `no-deprecated`
 * on object literals and `require-array-sort-compare` on tuples, zero
 * sites — measured with a pack in the seven consumers); 2026-10-24:
 * unicorn 79 — `no-top-level-side-effects` refocused on global mutations
 * on import, which is exactly the `"sideEffects": false` contract the
 * eight manifests declare; its new `checkUnknownCalls` kept off, because
 * no allow-list reaches silence: `allow` trusts only a direct call on an
 * imported binding, so the chained zod builders, `new Set`/`new Map`,
 * `String.raw` templates and local table builders stay reported (17 in
 * `src` here, 15 under the widest principled allow; melcloud-api 246 →
 * 76 under a sixty-name zod allow, heatzy-api 46 → 37), and a
 * `@__PURE__` on each remaining site is bundler semantics no runtime of
 * the family consumes, which a tagged template cannot carry at all; the
 * maintainers keep it opt-in since the rule "does not prove purity";
 * `comment-content`'s `ignore` is an option on a rule the family does not
 * configure; the sharper
 * `prefer-smaller-scope` found ten type aliases over the three apps' tests,
 * paid by the adoptions — package-json 1.11 — `consistent-property-aliases`
 * and `consistent-package-manager-declaration` adopted, zero sites — and
 * eslint-cssicorn 0.3 — three rules adopted, two refused in the ledger
 * (`consistent-custom-property-fallbacks` out of domain, `prefer-subgrid`
 * owned by `css/use-baseline` at the floor knob), thirteen
 * `no-redundant-shorthand-values` sites paid by the adoptions;
 * 2026-11-04 (measured on APFS clones of the eight repositories with a
 * pack built from the bumped pins): eslint 10.13 — `no-use-before-define`
 * now reports references inside an IIFE, a widening that touches only the
 * `variables: false`/`classes: false` escape hatches; the rule itself is
 * in no table, left to TypeScript's TDZ checks, and would report 20 legal
 * closure-ordering sites family-wide (a module-level arrow calling a
 * `const` declared below it, resolved at call time) — and 10.14 —
 * `func-name-matching` reworked its property-descriptor reading under
 * the `considerPropertyDescriptor` the main table sets, zero sites over
 * the eight repositories; package-json 1.12 — `sort-collections` gains
 * key selectors, an option on a live off the formatter owns — 1.13 —
 * `require-override-restrictions`, adopted in the shared table at zero
 * sites — and 1.14 — `prefer-scoped-name`, adopted in both presets on the
 * publication fact (`preferred: '@olivierzal'` for the libraries,
 * `allowed: ['@olivierzal']` for the apps), zero sites on the eight
 * manifests; jsdoc 65.4.1–65.4.3, regexp 3.3.2–3.3.3 and typescript-eslint
 * 8.72.1 are fixes only; `@eslint/css` 2.0.1 is baseline data the consumers'
 * trees already resolve; vitest 5.1.0 ran the eight suites green;
 * 2026-11-09 (measured with a pack of the bumped tree in APFS clones of
 * the seven consumers — each clone's own lint first, zero new sites,
 * import-x 4.18's analysis rewrite included, then a probe config
 * extending each repository's own with the candidates at their
 * defaults): import-x 4.18 — four barrel rules ported from
 * eslint-plugin-barrel-files: `avoid-re-export-all` adopted in the
 * shared table at zero sites, `avoid-namespace-import` adopted there too
 * — it exempts `import type * as` by construction, the module-type
 * naming the apps' tests need (twelve sites), and the overlay's
 * `namespaceImportAllow` names com.melcloud's two dialect entries —
 * with `no-namespace`, its fixable twin without that exemption, retired
 * from the library preset into the ledger as owned (8.8.0; 8.7.0 had
 * kept the twin and was never adopted), `avoid-barrel-files` and
 * `avoid-importing-barrel-files` refused in the ledger (the family's
 * barrels are package entries, and 331 of 425 import sites a
 * dependency's entry point); `no-rename-default` refused there too (its
 * premise fails on published bindings and on the platform's same-named
 * default exports); `order`'s `'top'` mode owned by
 * `perfectionist/sort-imports`' leading side-effect group, a ledger
 * row; `extensions` now reads an extension alias (`./x.js` for `x.ts`,
 * TypeScript's ESM spelling) as the extension written, so the app
 * preset's report on the resolver fixture's `.js` stand-in is gone — the
 * one behaviour change the rewrite brought, caught by the presets suite,
 * not by the consumers (zero sites: the apps write the real extension) —
 * and its `checkSelfReference` is inert by construction — an
 * app declares no `exports` map, so no self-reference resolves, and the
 * libraries, which do, run no `extensions` (TS2835 owns it there) — and
 * the `whitelist`s of `no-duplicates` and `no-rename-default` name
 * nothing here; html-eslint 0.68 — `lowercase` now admits an uppercase
 * `DOCTYPE`, which Prettier lowercases on every page anyway,
 * `require-attrs` checks its `value` once a `conditions` clause matched
 * (the block states none) and `no-extra-spacing-text`'s `skipComments`
 * is an option on a ledgered refusal; yml 3.10 — `max-len`, adopted in
 * the YAML block at 80 with the `uses:`-line and URL exemptions, 63
 * sites paid by the adoptions; 2026-11-18 (measured on 2026-11-16 with a
 * pack of the bumped tree in APFS clones of the seven consumers, each
 * verdict then challenged by refuters and, for the contested one, by two
 * advocates): unicorn 80 — its three new `recommended` rules arrive as
 * live offs in the main table, `require-spread-parentheses` (redundant,
 * Prettier writes the parentheses), `prefer-regexp-exec` (owned by
 * `@typescript-eslint/prefer-regexp-exec`) and `prefer-options-parameter`
 * (refused: it bans the platform's `(subject?, options?)` idiom, and its
 * `checkWithoutOptionsObject` only adds reports to that check);
 * `no-async-promise-finally`, out of `recommended` in 80, is a ledger row
 * owned by `@typescript-eslint/strict-void-return`; `prefer-ternary`'s new
 * `checkNestedTernaries` stays off, 32 of its 35 rewrites rejected by
 * `no-nested-ternary`; the two new opt-out options, `no-immediate-mutation`'s
 * `checkCollections` and `prefer-smaller-scope`'s `checkTypeAliases`, keep
 * their `true` defaults; `checkBufferDecoding` is an option on two floor
 * refusals; and the widenings cost one site, com.melcloud's error count
 * (`prefer-minimal-ternary` on a member chain), rewritten in the adoption;
 * 2026-11-20: `@eslint/markdown` 9.0 — its rules declare `meta.languages`
 * (`no-bare-urls` and `table-column-count` GFM-only, the Markdown
 * block's language) and `table-column-count` leaves `recommended`,
 * which the block enables by name; unused-directive locations remapped;
 * its fixes measured zero sites old and new over the eight
 * repositories' Markdown; 2026-11-21 (measured with a pack of the
 * bumped tree in clones of the seven consumers): eslint 10.15 —
 * behaviour only, zero new sites: `func-names` reads `__proto__` and
 * assignment targets, `accessor-pairs` string and computed descriptor
 * keys, `no-invalid-this` TypeScript assertions, `no-shadow` a
 * specifier's own `type` modifier; jsdoc 65.5 — the occasion of a FULL
 * reading of the plugin, every rule and option against the table and
 * not the release's delta (CLAUDE.md, the 8.11.0 entry), each fixer
 * tried on a fixture before it was kept or withheld. The release
 * itself: `publicOnly` on the three description rules is not taken — a
 * block that exists is held to the whole table wherever it stands;
 * `require-param-name` gains a fixer no option withholds, reasoned at
 * its rule site; `useObjectTypeForDestructuredRoots` shapes a fixer
 * the table withholds, and writes a JSDoc type; the `fix` option of
 * `implements-on-classes` writes one too; the new options of
 * `imports-as-dependencies` sit on a ledgered refusal; the `flat/all`
 * configs are not extended, the family building on the TSDoc preset;
 * and `require-throws` now sees a throw under a bare `finally` and in
 * a function called where it is defined, zero sites. jsdoc
 * 65.4.4–65.4.12 are fixes and one speed-up, typescript-eslint 8.72.2
 * fixes only; same day, for 8.12.0 (a pack of the bumped tree in the
 * seven consumers' clones, then a probe config for the one opt-in):
 * `@stylistic` 6.0 — the four rules the table sets keep their options
 * (`quotes` loses spellings it never used), and two widen what they
 * leave alone: `multiline-comment-style` skips the `@ts-` directives,
 * `prettier-ignore`, the `v8`, `c8` and `node:coverage` pragmas,
 * webpack's magic comments and the triple-slash references, where it
 * skipped the linters' directives and istanbul's, and `spaced-comment`
 * a triple-slash reference written without its space; zero sites over
 * the seven consumers. Its two new rules, `jsx-shorthand-boolean` and
 * `jsx-shorthand-fragment`, enter the main table as latent guards, and
 * `jsx-pascal-case`, the third `suggestion` rule of its JSX half, the
 * ledger; `jsx-indent`, `jsx-props-no-multi-spaces` and
 * `jsx-sort-props` are gone, none of them configured; the rest of the
 * release is layout, the formatter's. perfectionist 5.14 —
 * `sort-modules` gains `sortArrowFunctions`, kept at its default and
 * reasoned at the rule site, and reads the dependencies a decorator
 * names, zero sites. typescript-eslint 8.73 is read and HELD, the
 * entry staying at 8.72: for the experimental TypeScript 7.1 backend
 * of its project service, the parser declares an optional peer on
 * `@typescript/native` at `>=7.1.0-dev.20261009.1`, the name under
 * which the family's 6/7 layout installs the 7.0 compiler. The peer is
 * there and too old, and npm settles it with a compiler nobody chose:
 * npm 10.9.8 and 11.20.0 both nest the day's nightly
 * (`7.1.0-dev.20261121.1`) beneath `@typescript-eslint/utils` when
 * they resolve this package's manifest from nothing, and on the lock
 * npm 11 writes from the previous one, npm 10's `npm ci` stops
 * (`Missing: @typescript/native@7.1.0-dev.20261121.1 from lock file`).
 * The hold is re-examined the day `@typescript/native` is a 7.1 here,
 * a version that range admits: the suite watches for it, and
 * `.github/dependabot.yml` ignores the releases in between. What 8.73
 * brings was measured before the hold:
 * `no-unsafe-class-instance-assignment` arrives through
 * `strictTypeChecked` (a value used where a class instance is expected
 * and that no constructor of that class made), 17 sites, every one in
 * a test (api-core 10, two tables of errors whose rows TypeScript
 * reduces to one of their classes; melcloud-api 6 and heatzy-api 1, a
 * helper meant for doubles taken for a non-null assertion, and a
 * foreign transport handed over on purpose), and
 * `consistent-type-imports` narrows the place it reports at.
 */
export const AUDITED_PLUGIN_VERSIONS: Readonly<Record<string, string>> = {
  '@eslint/css': '2.0',
  '@eslint/js': '10.0',
  '@eslint/json': '2.1',
  '@eslint/markdown': '9.0',
  '@eslint-community/eslint-plugin-eslint-comments': '4.8',
  '@html-eslint/eslint-plugin': '0.68',
  '@stylistic/eslint-plugin': '6.0',
  '@vitest/eslint-plugin': '1.6',
  eslint: '10.15',
  'eslint-cssicorn': '0.3',
  'eslint-plugin-es-x': '10.1',
  'eslint-plugin-import-x': '4.18',
  'eslint-plugin-jsdoc': '65.5',
  'eslint-plugin-package-json': '1.14',
  'eslint-plugin-perfectionist': '5.14',
  'eslint-plugin-regexp': '3.3',
  'eslint-plugin-unicorn': '80.0',
  'eslint-plugin-yml': '3.10',
  'typescript-eslint': '8.72',
}

// The Homey-app family preset: everything the three apps share. Each
// app's overlay keeps only its documented verdicts (ignores, `'off'`
// ledgers) and the globs below that genuinely differ per app.
import { type Config, defineConfig } from 'eslint/config'
import { globs as tsGlobs } from 'typescript-eslint'
import css from '@eslint/css'
import html from '@html-eslint/eslint-plugin'
import stylistic from '@stylistic/eslint-plugin'
import esx from 'eslint-plugin-es-x'
import perfectionist from 'eslint-plugin-perfectionist'
import unicorn from 'eslint-plugin-unicorn'

import {
  type ConfigWithExtends,
  type NamingConventionOptions,
  type SharedMainRulesOptions,
  type TemplateExpressionAllowEntry,
  configJsBlock,
  configTsBlock,
  expiringTodoComments,
  jsdocBlock,
  jsonBlock,
  linterOptionsBlock,
  mainExtends,
  mainLanguageOptions,
  markdownBlock,
  packageJsonBlock,
  perfectionistSettings,
  sharedClassGroups,
  sharedClassGroupsTail,
  sharedMainRules,
  testNamingRules,
  testsBlock,
  wireNamingBlock,
  yamlBlock,
} from './shared.ts'

export interface HomeyAppOptions {
  // Sources bundled by esbuild, whose imports may live in
  // devDependencies (e.g. `settings/**`, `widgets/**`).
  readonly bundledSourceGlobs: readonly string[]
  // Files allowed (and required) to default-export for the Homey SDK
  // loader (`api.mts`, `app.mts`, driver classes).
  readonly defaultExportFiles: readonly string[]
  // Files that carry API documentation.
  readonly jsdocFiles: readonly string[]
  // Sources that run in the phone webview and carry the es2023 floor.
  readonly webviewFloorFiles: readonly string[]
  readonly templateExpressionAllow?: readonly TemplateExpressionAllowEntry[]
  // Test files whose Homey driver/device doubles proxy untyped SDK
  // surfaces; omit when the app has none (ESLint rejects `files: []`).
  readonly untypedDoubleTestFiles?: readonly string[]
  // App-side wire vocabulary — converters and webview report readers
  // speak the device wire; entries stay filter-scoped per app.
  readonly wireNamingEntries?: readonly unknown[]
  // Where that vocabulary is allowed to appear. Left out, it applies
  // app-wide, so a name of ours in the same shape passes unnoticed;
  // listed, the strict core holds everywhere else. Tests keep the wire
  // entries either way — doubles mirror payloads verbatim.
  readonly wireNamingFiles?: readonly string[]
}

// Capability handlers and the `__` translation key use wire-imposed
// names.
const homeyNamingEntries = [
  {
    format: null,
    modifiers: ['requiresQuotes'],
    selector: 'objectLiteralMethod',
  },
  {
    filter: { match: true, regex: '_' },
    format: null,
    selector: 'objectLiteralMethod',
  },
  {
    filter: { match: true, regex: '^__$' },
    format: null,
    selector: 'objectLiteralProperty',
  },
  // Exempts a SHAPE rather than a single origin: multi-segment
  // snake_case keys. Two realities impose it on a Homey app, neither
  // ours to rename — capability ids (`measure_temperature`,
  // `fan_speed`) and the snake_case wire vocabularies devices speak
  // (`on_off`, `derog_time`). Single-segment ids (`onoff`) already
  // pass the strict camelCase core, and dotted sub-capability keys
  // ride the requiresQuotes skip.
  {
    filter: { match: true, regex: '^[a-z0-9]+(_[a-z0-9]+)+$' },
    format: null,
    selector: ['objectLiteralProperty', 'typeProperty'],
  },
]

const lifecycleHooks = [
  'onInit',
  'onPair',
  'onRepair',
  'onSettings',
  'onDeleted',
  'onUninit',
]

const lifecycleGroupName = (hook: string): string =>
  `homey-lifecycle-${hook.slice(2).toLowerCase()}`

/**
 * The webview runtime floor as a standalone block. Derived, not
 * preventive: the Homey mobile app requires iOS 16.4 or later — the App
 * Store minimum, re-attested 2026-09-27 on Homey 10.1.1 of 2026-09-02
 * through both the store page and the iTunes Lookup API — and a Homey
 * app only ever gets the system WebKit, so the worst legitimate engine
 * is iOS 16.4's. iOS 16 is the ceiling of the iPhone 8, 8 Plus and X,
 * under about one per cent of devices per TelemetryDeck and Statista
 * (2026-06 to 2026-08); recorded as context only — the floor stays
 * derived, not statistical. Android never binds it, its System WebView
 * being evergreen.
 *
 * The detection is `eslint-plugin-es-x`'s `restrict-to-es2023`, the
 * maintained edition table, in place of the hand selectors that named
 * three features and missed a fourth: `Promise.withResolvers` (Safari
 * 17.4) was named in this very comment and banned nowhere until 7.0.0.
 * The floor is an ENGINE, not an edition, so the edition table is
 * corrected by browser-compat-data (6.1.5, read 2026-09-27) in both
 * directions. Five rules above es2023 are turned OFF because the iOS
 * 16.4 WebKit ships the feature — `String#isWellFormed` and
 * `toWellFormed`, `Atomics.waitAsync`, resizable and growable
 * `ArrayBuffer`s (es2024; `ArrayBuffer#transfer`, 17.4, stays banned by
 * its own rule) and `Array.fromAsync` (es2026 in es-x's table) — and
 * one Web API es-x cannot see is banned by hand:
 * `AbortSignal.any`, 17.4. The `v` regex flag is refused once, by
 * `require-unicode-regexp` at `u` — the global config demands `v`, the
 * floor steps the requirement down, it does not drop it — with es-x's
 * `no-regexp-v-flag` off as its twin; under a sub-es2024 esbuild target
 * a `v` literal ships as a `new RegExp` call, so an escapee throws at
 * runtime inside the feature that runs it rather than at parse, and
 * only the core rule reaches that `new RegExp(x, 'v')` spelling.
 * Without type information the iterator-helper rules report only what
 * they can prove is an iterator; the presets' project service gives
 * them the types. `import-x/no-nodejs-modules` rides along: nothing
 * that runs in the webview imports `node:*`, and in the two libraries'
 * floor files — where no bundler stands between the source and the
 * browser — the lint is the only guard (the apps' bundle would fail
 * anyway). Zero sites in every perimeter (2026-09-27).
 *
 * The tsconfig `lib` cannot express this (one project, two runtimes),
 * so the constraint lives here. Exported for consumers that need the
 * floor without the full app preset (a library shipping webview-bundled
 * sources). es2024 becomes derivable when the App Store minimum reaches
 * 17.4 — homey-kit's `ios-floor-watch.yml` records the value, and the
 * CSS block's Baseline year moves with it.
 * @param files - Globs of the sources that run in the phone webview.
 * @returns The config block carrying the floor; it carries `extends`, so
 * it is consumed inside `defineConfig([...])`.
 */
export const webviewFloorBlock = (
  files: readonly string[],
): ConfigWithExtends => ({
  extends: [esx.configs['flat/restrict-to-es2023']],
  files: [...files],
  rules: {
    // BCD 6.1.5 (2026-09-27): shipped by Safari iOS 16.4, the floor's
    // own engine — the edition table says es2026 for `Array.fromAsync`
    // and es2024 for the four other offs, the engine says yes to all.
    'es-x/no-array-fromasync': 'off',
    'es-x/no-atomics-waitasync': 'off',
    // Owned by `require-unicode-regexp` below: one report per literal,
    // and only the core rule reaches `new RegExp(x, 'v')`.
    'es-x/no-regexp-v-flag': 'off',
    'es-x/no-resizable-and-growable-arraybuffers': 'off',
    'es-x/no-string-prototype-iswellformed': 'off',
    'es-x/no-string-prototype-towellformed': 'off',
    // Nothing that runs in the webview imports Node (see the docstring).
    'import-x/no-nodejs-modules': 'error',
    // `es-x` is ES-only and cannot see Web APIs: the one the floor
    // excludes is banned by hand.
    'no-restricted-properties': [
      'error',
      {
        message:
          'Web API above the derived floor: AbortSignal.any() is Safari iOS 17.4 (caniuse, read 2026-09-27), the iOS 16.4 WebKit throws. Compose the signals by hand (listener + AbortSignal.timeout, both Safari 16).',
        object: 'AbortSignal',
        property: 'any',
      },
    ],
    // The global config requires the `v` regex flag; the floor caps
    // webview code at `u` (es2024, above the derived floor), so the
    // requirement steps down here, it does not disappear.
    'require-unicode-regexp': ['error', { requireFlag: 'u' }],
  },
})

// Every rule turned off below is owned by Prettier (formatter formats,
// linter lints) — the family rule for every other language, reaching
// HTML by hand because `eslint-config-prettier` disables 358 rules and
// ZERO `html/` ones. Each off here is LIVE — `html/recommended` turns
// the rule on — and names which of two reasons retires it: REDUNDANT,
// Prettier's output already satisfies it, so keeping it only duplicates
// the formatter; or CONFLICTING, Prettier's output VIOLATES it,
// measured rather than assumed — one Prettier pass over a settings page
// that lints clean today raises 78 errors, from the four conflicting
// rules and nothing else. The REDUNDANT rules the recommended set never
// turns on (`class-spacing`, `no-extra-spacing-text`,
// `no-multiple-empty-lines`, `no-trailing-spaces`) and the two SEO
// refusals live in the refusal ledger (`refused-rules.ts`), not here: an
// `off` on a rule nothing enables validates nothing. The quality rules
// come through that same Prettier pass untouched, which is what makes
// the split safe: Prettier moves whitespace, it never invents an ARIA
// role.
const htmlBlock: Config[] = defineConfig([
  {
    extends: ['html/recommended'],
    files: ['**/*.html'],
    language: 'html/html',
    plugins: { html, unicorn },
    rules: {
      // CONFLICTING: the rule breaks attributes onto their own lines
      // past a COUNT, Prettier keeps them inline while they fit the
      // print WIDTH.
      'html/attrs-newline': 'off',
      'html/css-no-empty-blocks': 'error',
      // REDUNDANT
      'html/element-newline': 'off',
      // Kept: Prettier never reorders `<head>` children, so no formatter
      // guarantees this one.
      'html/head-order': 'error',
      'html/id-naming-convention': 'error',
      // CONFLICTING: Prettier indents HTML by two spaces where the
      // rule expects four, so every nested line fails.
      'html/indent': 'off',
      // Kept: Prettier lowercases only the element and attribute names
      // it knows — its own output keeps `onClick`, `DATA-FOO`,
      // `<MY-ELEMENT>` — so it neither guarantees nor contradicts this;
      // SVG camelCase attributes are exempt. One determinate fix.
      'html/lowercase': 'error',
      'html/max-element-depth': 'error',
      'html/no-abstract-roles': 'error',
      'html/no-accesskey-attrs': 'error',
      'html/no-aria-hidden-body': 'error',
      'html/no-aria-hidden-on-focusable': 'error',
      'html/no-duplicate-class': 'error',
      'html/no-empty-headings': 'error',
      // CONFLICTING: Prettier writes the space in `<meta … />` that
      // this rule rejects.
      'html/no-extra-spacing-tags': 'off',
      'html/no-heading-inside-button': 'error',
      'html/no-ineffective-attrs': 'error',
      'html/no-inline-styles': 'error',
      'html/no-invalid-attr-value': 'error',
      'html/no-invalid-entity': 'error',
      'html/no-invalid-role': 'error',
      'html/no-nested-interactive': 'error',
      'html/no-non-scalable-viewport': 'error',
      'html/no-positive-tabindex': 'error',
      'html/no-redundant-role': 'error',
      // Pins an incident every page documents in its boot comment: a
      // static `<script type="module">` stalls a cold webview boot and
      // blocks `onHomeyReady` (proven on-device on com.melcloud), so
      // bundles ship as classic `defer` scripts. Case-insensitive and
      // whitespace-tolerant, as the HTML spec matches script types.
      'html/no-restricted-attr-values': [
        'error',
        {
          attrPatterns: ['^type$'],
          attrValuePatterns: [String.raw`^\s*[Mm][Oo][Dd][Uu][Ll][Ee]\s*$`],
          message:
            'Module scripts stall a cold webview boot: ship bundles as classic defer scripts.',
        },
      ],
      // Inline handlers are JavaScript outside the TypeScript bundle,
      // the webview floor and the DOM rules; case-insensitive because
      // browsers read attribute names that way.
      'html/no-restricted-attrs': [
        'error',
        {
          attrPatterns: ['^[Oo][Nn][A-Za-z]+$'],
          message:
            'Inline event handlers bypass the TypeScript bundle: wire listeners from the .mts sources.',
          tagPatterns: ['.*'],
        },
      ],
      // CSS inside `<style>` reaches none of the `css/` table (Baseline
      // floor, logical properties, relative units): the element form of
      // what `no-inline-styles` closes for the attribute.
      'html/no-restricted-tags': [
        'error',
        {
          message:
            'CSS lives in .css files, where the css/ table (Baseline floor, logical properties, relative units) sees it.',
          tagPatterns: ['^style$'],
        },
      ],
      'html/no-script-style-type': 'error',
      'html/no-skip-heading-levels': 'error',
      'html/no-target-blank': 'error',
      'html/no-whitespace-only-children': 'error',
      'html/prefer-https': 'error',
      // REDUNDANT
      'html/quotes': 'off',
      // The positive half of the boot verdict above: every external
      // script (8 across the five pages) is a classic `defer` script,
      // so the head never blocks the webview boot; the `conditions`
      // clause leaves the inline boot script alone. No `value` — that
      // is what arms the fixer, which would write `defer=""` out of
      // `sort-attrs` order.
      'html/require-attrs': [
        'error',
        {
          attr: 'defer',
          conditions: [{ attr: 'src', kind: 'present' }],
          message:
            'External scripts load as classic defer scripts so the head never blocks the webview boot.',
          tag: 'script',
        },
      ],
      'html/require-button-type': 'error',
      // CONFLICTING: Prettier self-closes void elements (`<img … />`),
      // which is exactly what this rule reports. Its name suggests
      // validity, but the spec makes a trailing slash on a void element
      // meaningless, not invalid — both spellings parse to the same
      // DOM, so the rule is style, and style is Prettier's.
      'html/require-closing-tags': 'off',
      'html/require-content': 'error',
      'html/require-details-summary': 'error',
      'html/require-explicit-size': 'error',
      'html/require-form-method': 'error',
      'html/require-frame-title': 'error',
      'html/require-input-label': 'error',
      'html/require-meta-charset': 'error',
      'html/require-meta-viewport': 'error',
      // Kept: attribute ORDER reads like formatting, but Prettier
      // preserves the order it is given — no formatter enforces this, so
      // dropping it would drop the convention itself.
      'html/sort-attrs': 'error',
      'html/svg-require-viewbox': 'error',
      // Bound to the same iOS 16.4 floor as `css/use-baseline` below,
      // through the same Baseline year; the default (`widely`) is a
      // rolling 30-month window already a year past the floor. Unlike
      // the CSS rule this one has no allow-list, so a feature WebKit had
      // before the floor that Baseline dates later (`inert`: Safari
      // 15.5, dated 2023 by Firefox 112) re-enters by an
      // `eslint-disable-next-line html/use-baseline` naming the Safari
      // release, or by a per-app overlay — never by moving the year.
      'html/use-baseline': ['error', { available: 2022 }],
      'unicorn/expiring-todo-comments': expiringTodoComments,
      'unicorn/no-empty-file': 'error',
      'unicorn/no-invalid-file-input-accept': 'error',
      'unicorn/text-encoding-identifier-case': 'error',
    },
  },
])

const cssBlock: Config[] = defineConfig([
  {
    extends: [css.configs.recommended],
    files: ['**/*.css'],
    language: 'css/css',
    plugins: { unicorn },
    rules: {
      // `allowUnknownVariables`: the pages consume custom properties the
      // linter never sees — Homey's runtime-injected stylesheet defines
      // the `--homey-…` set and the pages only read it: 79
      // `var(--homey-…)` references across the three apps' stylesheets
      // (com.melcloud 65, com.heatzy 4, com.melcloud.extension 10;
      // counted 2026-09-28). Every other invalid property still reports.
      'css/no-invalid-properties': ['error', { allowUnknownVariables: true }],
      'css/prefer-logical-properties': 'error',
      'css/relative-font-units': 'error',
      // Measured family ceiling (com.melcloud's settings/index.css, the
      // widest corpus, 2026-09-15; the two other apps sit inside it),
      // one step of headroom on pseudo-classes for the
      // `:hover:focus-visible` idiom; rises only by a recorded verdict,
      // like `complexity`. Without limits the entry was inert (every
      // maximum defaults to Infinity). `maxUniversals: 0` is a measured
      // absence, not a performance verdict — the `*, *::before` reset
      // would raise it by verdict.
      'css/selector-complexity': [
        'error',
        {
          maxAttributes: 2,
          maxClasses: 3,
          maxCombinators: 2,
          maxIds: 1,
          maxPseudoClasses: 2,
          maxTypes: 2,
          maxUniversals: 0,
        },
      ],
      // Bound to the engine `webviewFloorBlock` derives from — the iOS
      // 16.4 WebKit, never a Chromium — through the one knob the rule
      // has, a Baseline year: a feature passes once every core browser
      // had shipped it by that year's end. 2022 is the last year inside
      // the floor (its WebKit half is Safari 16.2 at the latest); 2023
      // would admit what Safari 16.5 brought (`&`-nesting — the one
      // nesting form the rule detects — and `:user-valid`) and that
      // engine lacks. The year moves with the App Store minimum
      // homey-kit's `ios-floor-watch.yml` records, and only with it.
      //
      // The proxy cuts the other way too: Baseline dates a feature by
      // the LAST core browser to ship it, so the year alone rejects CSS
      // WebKit had before the floor. Such a feature re-enters by exact
      // name with the Safari release that carries it (MDN
      // browser-compat-data), and only at 16.4 or below — measured over
      // the three apps' stylesheets (2026-09-07) and grown the same way:
      // an app meeting a new rejection reads the compat table, and the
      // feature either lands here with its release or gets rewritten.
      'css/use-baseline': [
        'error',
        {
          // Safari 16.2; dated 2023 by Firefox 113.
          allowFunctions: ['color-mix'],
          // `mask-image`: unprefixed since Safari 15.4, dated 2023 by
          // Chrome 120. `outline`: dated 2023 by Safari 16.4 itself, the
          // floor's own release, for following `border-radius`.
          allowProperties: ['mask-image', 'outline'],
          available: 2022,
        },
      ],
      'unicorn/expiring-todo-comments': expiringTodoComments,
      // `eslint-plugin-unicorn` 75's CSS half, adopted by what it can
      // CATCH here (measured over the three stylesheets, 2026-09-17): a
      // deprecated feature, a selector written twice, a font family
      // repeated in one stack, a mistyped media feature, an annotation
      // that is not one, and a pseudo-selector the engines do not know.
      'unicorn/no-deprecated-css-features': 'error',
      'unicorn/no-duplicate-css-selectors': 'error',
      'unicorn/no-duplicate-font-family-names': 'error',
      'unicorn/no-empty-file': 'error',
      'unicorn/no-invalid-media-features': 'error',
      'unicorn/no-missing-local-resource': 'error',
      'unicorn/no-shorthand-property-overrides': 'error',
      'unicorn/no-transition-all': 'error',
      'unicorn/no-unknown-css-annotations': 'error',
      // `::-webkit-details-marker` is the ONE pseudo-element the rule's
      // vocabulary lacks and the three settings pages need: they hide
      // the native disclosure triangle of `<summary>` to draw their own
      // chevron, and `list-style: none` alone does not reach the WebKit
      // the floor admits. An allowance, not a disable — the rule still
      // catches every other unknown selector.
      'unicorn/no-unknown-pseudo-selectors': [
        'error',
        { allow: ['::-webkit-details-marker'] },
      ],
      'unicorn/prefer-explicit-viewport-units': 'error',
      'unicorn/text-encoding-identifier-case': 'error',
    },
  },
])

// Class ordering with the Homey lifecycle hooks spliced after the
// constructor.
const appSortClassesOptions: Record<string, unknown> = {
  customGroups: lifecycleHooks.map((hook) => ({
    elementNamePattern: `^${hook}$`,
    groupName: lifecycleGroupName(hook),
    selector: 'method',
  })),
  groups: [
    ...sharedClassGroups,
    ...lifecycleHooks.map((hook) => lifecycleGroupName(hook)),
    ...sharedClassGroupsTail,
  ],
  newlinesBetween: 1,
  newlinesInside: 1,
}

// Per-app wire entries first (most specific), then the platform layer.
const appNaming = (
  wireNamingEntries: NonNullable<HomeyAppOptions['wireNamingEntries']>,
): NamingConventionOptions => ({
  extraEntries: [...wireNamingEntries, ...homeyNamingEntries],
})

const appMainRuleOptions = (
  bundledSourceGlobs: HomeyAppOptions['bundledSourceGlobs'],
  templateExpressionAllow: NonNullable<
    HomeyAppOptions['templateExpressionAllow']
  >,
  naming: NamingConventionOptions,
): SharedMainRulesOptions => ({
  extraneous: {
    devDependencies: [
      '*.config.{js,mjs,mts,ts}',
      'scripts/**',
      'tests/**',
      ...bundledSourceGlobs,
    ],
  },
  naming,
  templateExpressionAllow,
  unassignedImportAllow: ['source-map-support/register.js'],
})

const appMainBlock = ({
  bundledSourceGlobs,
  naming,
  templateExpressionAllow = [],
}: Pick<HomeyAppOptions, 'bundledSourceGlobs' | 'templateExpressionAllow'> & {
  readonly naming: NamingConventionOptions
}): Config[] =>
  defineConfig([
    {
      extends: mainExtends,
      files: [tsGlobs.ts, '*.config.{js,mjs}'],
      languageOptions: mainLanguageOptions,
      plugins: { '@stylistic': stylistic, perfectionist },
      rules: {
        ...sharedMainRules(
          appMainRuleOptions(
            bundledSourceGlobs,
            templateExpressionAllow,
            naming,
          ),
        ),
        // Under `module: preserve` an extensionless relative import of a
        // `.mts` module is already TS2307, so what the rule covers is the
        // `.ts` test and config files vitest and jiti resolve leniently:
        // the family's explicit-extension convention
        // (`rewriteRelativeImportExtensions`) held everywhere, zero sites
        // (2026-09-27). The library preset omits it: TS2835 under
        // `module: nodenext` owns it there.
        'import-x/extensions': [
          'error',
          'always',
          { checkTypeImports: true, ignorePackages: true },
        ],
        'perfectionist/sort-classes': ['error', appSortClassesOptions],
      },
      settings: perfectionistSettings,
    },
  ])

// Omitted entirely when empty: ESLint rejects `files: []`.
const untypedDoubleBlock = (files: readonly string[]): Config[] =>
  files.length > 0
    ? [
        {
          files: [...files],
          rules: {
            // Homey driver/device doubles proxy untyped SDK surfaces.
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
          },
        },
      ]
    : []

// The Homey re-export shim needs the SDK dependency shape the rule
// cannot see.
const homeyShimBlock: Config = {
  files: ['lib/homey.mts'],
  rules: {
    'import-x/no-extraneous-dependencies': 'off',
    'import-x/no-named-as-default-member': 'off',
  },
}

const appTestsBlock = (naming: NamingConventionOptions): Config[] =>
  testsBlock({
    ...testNamingRules(naming),
    // Test doubles cast wholesale around the SDK's branded types.
    '@typescript-eslint/no-unsafe-type-assertion': 'off',
  })

const appPackageJsonBlock: Config[] = packageJsonBlock({
  // A Homey app is never published to npm, and `private: true` is the
  // machine-readable form of that fact (npm refuses `publish`). The
  // plugin's `require-exports`, `require-files`, `require-homepage`…
  // self-skip on a private package (`ignorePrivateDefault`), so the two
  // offs that stood here until 7.0.0 are gone with it;
  // `restrict-private-properties` then refuses the fields a private
  // package has no use for (`files`, `publishConfig` by default). NEVER
  // run `require-private`'s fixer: it writes `"private": false`
  // (measured 2026-09-28) — an adoption sets `true` by hand first. No
  // `enforceForPrivate`.
  'package-json/require-private': 'error',
  'package-json/restrict-private-properties': 'error',
})

export const homeyApp = ({
  bundledSourceGlobs,
  defaultExportFiles,
  jsdocFiles,
  templateExpressionAllow = [],
  untypedDoubleTestFiles = [],
  webviewFloorFiles,
  wireNamingEntries = [],
  wireNamingFiles = [],
}: HomeyAppOptions): Config[] => {
  const naming = appNaming(wireNamingEntries)
  const isScoped = wireNamingFiles.length > 0

  return defineConfig([
    linterOptionsBlock,
    ...appMainBlock({
      bundledSourceGlobs,
      naming: isScoped ? appNaming([]) : naming,
      templateExpressionAllow,
    }),
    // After the main block, so the scoped files win the override.
    ...(isScoped ? [wireNamingBlock(wireNamingFiles, naming)] : []),
    jsdocBlock([...jsdocFiles]),
    webviewFloorBlock(webviewFloorFiles),
    homeyShimBlock,
    {
      files: [...defaultExportFiles],
      rules: {
        // Platform-imposed: the Homey loader reads `export default class`
        // from the app, driver, device and api modules — a named export
        // is not found.
        'import-x/no-default-export': 'off',
        'import-x/prefer-default-export': ['error', { target: 'any' }],
      },
    },
    // The platform entries, never the wire's: a config file speaks no
    // wire. No typedoc-key shape either (the library preset's): typedoc
    // never runs on an app, so its config files hold the bare core.
    configTsBlock(['*.config.{js,mjs,mts,ts}'], appNaming([])),
    configJsBlock,
    htmlBlock,
    jsonBlock(['app.json', 'locales/*.json']),
    cssBlock,
    markdownBlock,
    ...appTestsBlock(naming),
    ...untypedDoubleBlock(untypedDoubleTestFiles),
    yamlBlock(['id', 'name', 'if', 'uses', 'with', 'env', 'run']),
    ...appPackageJsonBlock,
  ])
}

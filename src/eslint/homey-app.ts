// The Homey-app family preset: everything the three apps share. Each
// app's overlay keeps only its documented verdicts (ignores, `'off'`
// ledgers) and the globs below that genuinely differ per app.
import { type Config, defineConfig } from 'eslint/config'
import { flatConfigs as importXConfigs } from 'eslint-plugin-import-x'
import { configs as tsConfigs, globs as tsGlobs } from 'typescript-eslint'
import css from '@eslint/css'
import js from '@eslint/js'
import html from '@html-eslint/eslint-plugin'
import stylistic from '@stylistic/eslint-plugin'
import prettier from 'eslint-config-prettier/flat'
import perfectionist from 'eslint-plugin-perfectionist'
import unicorn from 'eslint-plugin-unicorn'

import {
  type NamingConventionOptions,
  type SharedMainRulesOptions,
  type TemplateExpressionAllowEntry,
  configJsBlock,
  configTsBlock,
  expiringTodoComments,
  jsdocBlock,
  jsonBlock,
  linterOptionsBlock,
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
 * The webview runtime floor as a standalone block: es2023 is the
 * ceiling — no `Object.groupBy`/`Map.groupBy`, no iterator helpers, no
 * `v` regex flag. Derived, not preventive: the Homey mobile app
 * requires iOS 16.4 or later (App Store, read 2026-08-11) and a Homey
 * app only ever gets the system WebKit, so the worst legitimate engine
 * is iOS 16.4's — es2023-complete, short of every es2024 gain
 * (`Object.groupBy` and `Promise.withResolvers` need Safari 17.4, the
 * `v` flag 17). es2024 becomes derivable when that App Store minimum
 * reaches 17.4; Android never binds the floor, its System WebView being
 * evergreen. Under a sub-es2024 esbuild target a `v` literal ships as a
 * `new RegExp` call, so an escapee throws at runtime inside the feature
 * that runs it rather than at parse — narrower blast radius, same ban.
 * The tsconfig `lib` cannot express this (one project, two runtimes),
 * so the constraint lives here. Exported for consumers that need the
 * floor without the full app preset (e.g. a library shipping
 * webview-bundled sources).
 * @param files - Globs of the sources that run in the phone webview.
 * @returns The config block carrying the floor.
 */
export const webviewFloorBlock = (files: readonly string[]): Config => ({
  files: [...files],
  rules: {
    'no-restricted-properties': [
      'error',
      {
        message:
          'es2024, above the derived floor: the iOS 16.4 WebKit lacks it (CLAUDE.md webview floor).',
        object: 'Object',
        property: 'groupBy',
      },
      {
        message:
          'es2024, above the derived floor: the iOS 16.4 WebKit lacks it (CLAUDE.md webview floor).',
        object: 'Map',
        property: 'groupBy',
      },
    ],
    'no-restricted-syntax': [
      'error',
      {
        message:
          'The `v` regex flag is es2024, above the derived floor: the iOS 16.4 WebKit throws on it (CLAUDE.md webview floor). Use `u`.',
        selector: 'Literal[regex.flags=/v/]',
      },
      {
        message:
          'Iterator helpers are es2025, above the derived floor: the iOS 16.4 WebKit lacks them (CLAUDE.md webview floor). Spread into an array first.',
        selector:
          "CallExpression[callee.type='MemberExpression'][callee.property.name=/^(drop|every|filter|find|flatMap|forEach|map|reduce|some|take|toArray)$/][callee.object.type='CallExpression'][callee.object.callee.type='MemberExpression'][callee.object.callee.property.name=/^(entries|keys|matchAll|values)$/][callee.object.callee.object.name!='Object']",
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
// ZERO `html/` ones. Each entry names which of two reasons retires it:
// REDUNDANT, Prettier's output already satisfies it, so keeping it only
// duplicates the formatter; or CONFLICTING, Prettier's output VIOLATES
// it, measured rather than assumed — one Prettier pass over a settings
// page that lints clean today raises 78 errors, from the four
// conflicting rules and nothing else. The quality rules come through
// that same pass untouched, which is what makes the split safe:
// Prettier moves whitespace, it never invents an ARIA role.
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
      // REDUNDANT
      'html/class-spacing': 'off',
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
      // REDUNDANT
      'html/no-extra-spacing-text': 'off',
      'html/no-heading-inside-button': 'error',
      'html/no-ineffective-attrs': 'error',
      'html/no-inline-styles': 'error',
      'html/no-invalid-attr-value': 'error',
      'html/no-invalid-entity': 'error',
      'html/no-invalid-role': 'error',
      // REDUNDANT
      'html/no-multiple-empty-lines': 'off',
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
      // REDUNDANT
      'html/no-trailing-spaces': 'off',
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
      // SEO, both: a Homey settings page or widget renders inside the
      // Homey app and no crawler reads it. The `<meta name="description">`
      // tags the apps carry are cargo (2024-09, no recorded reason), free
      // to leave.
      'html/require-meta-description': 'off',
      'html/require-meta-viewport': 'error',
      'html/require-open-graph-protocol': 'off',
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
      // The referenced module bundles are gitignored build outputs (CI
      // lints without building); their existence is guaranteed harder
      // by the bundling script, which hashes every local reference and
      // throws when one is missing (the guarantee lands through the
      // validate workflow's CLI build).
      'unicorn/no-missing-local-resource': 'off',
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
      // unicorn 75's CSS half, adopted by what it can CATCH here
      // (measured over the three stylesheets, 2026-09-17): a deprecated
      // feature, a selector written twice, a font family repeated in one
      // stack, a mistyped media feature, an annotation that is not one,
      // and a pseudo-selector the engines do not know.
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
      extends: [
        js.configs.recommended,
        unicorn.configs.recommended,
        tsConfigs.strictTypeChecked,
        tsConfigs.stylisticTypeChecked,
        importXConfigs.errors,
        importXConfigs.typescript,
        // Last, so it can neutralize formatting rules from the presets
        // above.
        prettier,
      ],
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
        'perfectionist/sort-classes': ['error', appSortClassesOptions],
        // Settings and widget sources run in the Homey webview: DOM rules
        // apply.
        'unicorn/no-unsafe-dom-html': 'error',
        'unicorn/require-post-message-target-origin': 'error',
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
  // A Homey app is not a published library: no exports, files,
  // keywords or types fields.
  'package-json/require-exports': 'off',
  'package-json/require-files': 'off',
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
        'import-x/no-default-export': 'off',
        'import-x/prefer-default-export': ['error', { target: 'any' }],
      },
    },
    configTsBlock(['*.config.{js,mjs,mts,ts}']),
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

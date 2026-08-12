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
  type TemplateExpressionAllowEntry,
  configJsBlock,
  configTsBlock,
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
      // REDUNDANT
      'html/lowercase': 'off',
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
      'html/no-script-style-type': 'error',
      'html/no-skip-heading-levels': 'error',
      'html/no-target-blank': 'error',
      // REDUNDANT
      'html/no-trailing-spaces': 'off',
      'html/no-whitespace-only-children': 'error',
      'html/prefer-https': 'error',
      // REDUNDANT
      'html/quotes': 'off',
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
      'unicorn/expiring-todo-comments': 'error',
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
      'css/selector-complexity': 'error',
      // Newly-baseline properties are fine: the Homey webview Chromium
      // supports them.
      'css/use-baseline': ['error', { available: 'newly' }],
      'unicorn/expiring-todo-comments': 'error',
      'unicorn/no-empty-file': 'error',
      'unicorn/no-missing-local-resource': 'error',
      'unicorn/no-shorthand-property-overrides': 'error',
      'unicorn/no-transition-all': 'error',
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
): Parameters<typeof sharedMainRules>[0] => ({
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

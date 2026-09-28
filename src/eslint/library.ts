// The published-library family preset: everything the API clients
// share. Each library's overlay keeps only its documented verdicts
// (ignores, `'off'` ledgers) and its wire-protocol naming entry.
import type { Linter } from 'eslint'
import { type Config, defineConfig } from 'eslint/config'
import { globs as tsGlobs } from 'typescript-eslint'
import stylistic from '@stylistic/eslint-plugin'
import perfectionist from 'eslint-plugin-perfectionist'

import {
  type NamingConventionOptions,
  type SharedMainRulesOptions,
  changelogBlock,
  configJsBlock,
  configTsBlock,
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
  typedocKeyEntry,
  wireNamingBlock,
  yamlBlock,
} from './shared.ts'

export interface LibraryOptions {
  // The wire-protocol naming entry (e.g. a `__brand` sentinel or split
  // register names) spliced into the naming convention.
  readonly wireNamingEntries?: readonly unknown[]
  // Where that vocabulary is allowed to appear. Left out, it applies
  // repo-wide, so a name of ours in the same shape passes unnoticed;
  // listed, the strict core holds everywhere else. Tests keep the wire
  // entries either way — doubles mirror payloads verbatim.
  readonly wireNamingFiles?: readonly string[]
}

const libraryNaming = (
  wireNamingEntries: NonNullable<LibraryOptions['wireNamingEntries']>,
): NamingConventionOptions => ({
  // `device` is excluded: its type includes `false` as a sentinel
  // but it is not a boolean flag.
  booleanFilter: { match: false, regex: '^device$' },
  extraEntries: wireNamingEntries,
})

const libraryMainRuleOptions = (
  wireNamingEntries: NonNullable<LibraryOptions['wireNamingEntries']>,
): SharedMainRulesOptions => ({
  extraneous: {
    devDependencies: ['*.config.{js,mjs,mts,ts}', 'tests/**'],
    includeTypes: true,
  },
  naming: libraryNaming(wireNamingEntries),
})

const libraryMainBlock = ({
  wireNamingEntries = [],
}: LibraryOptions): Config[] =>
  defineConfig([
    {
      extends: mainExtends,
      files: [tsGlobs.ts, '*.config.{js,mjs}'],
      languageOptions: mainLanguageOptions,
      plugins: { '@stylistic': stylistic, perfectionist },
      rules: {
        ...sharedMainRules(libraryMainRuleOptions(wireNamingEntries)),
        // A namespace import hides which names a module uses; the
        // libraries import by name. The app preset OMITS it: com.melcloud
        // disambiguates the two wire vocabularies with `import * as
        // Classic/Home from '@olivierzal/melcloud-api/{classic,home}'` —
        // 86 sites in 70 files, 56 of them type-only (2026-09-27), the
        // consumption melcloud-api's `src/classic.ts` documents — and the
        // rule's only option is `ignore` globs, with no type-only
        // exemption.
        'import-x/no-namespace': 'error',
        // `src/temporal.ts` is the single sanctioned polyfill entry
        // point.
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['temporal-polyfill', 'temporal-polyfill/*'],
                message: 'Import Temporal/Intl from src/temporal.ts instead.',
              },
            ],
          },
        ],
        'perfectionist/sort-classes': [
          'error',
          {
            groups: [...sharedClassGroups, ...sharedClassGroupsTail],
            newlinesBetween: 1,
            newlinesInside: 1,
          },
        ],
      },
      settings: perfectionistSettings,
    },
  ])

// TC39 decorator protocol: the replacement method receives the
// instance through `this` (no class body to put it in), and the
// `context` parameter is what pins the decorator kind at type level
// even when unused.
const decoratorsBlock: Config = {
  files: ['src/decorators/**/*.ts'],
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_context$',
        enableAutofixRemoval: { imports: true },
      },
    ],
    // The replacement methods must be `function` expressions: the
    // decorator protocol rebinds `this` at call time, which an arrow
    // cannot receive. LIVE, not dead: the rule does report a function
    // expression declaring a `this:` parameter — its `hasThisParameter`
    // check withholds only the SUGGESTION — five sites across the three
    // libraries' decorators without this off (measured 2026-09-28).
    'unicorn/consistent-function-style': 'off',
  },
}

const temporalBlock: Config = {
  files: ['src/temporal.ts'],
  rules: {
    // The sanctioned `temporal-polyfill` entry point is the one module
    // allowed to import it.
    'no-restricted-imports': 'off',
  },
}

// The vitest-concurrent pattern destructures the test-context `expect`
// (required for exact assertion counts), shadowing the module import by
// design. The other two options restate the main table's: dropping
// `hoist: 'all'` here had silently loosened the test block to the rule's
// `functions` default until 7.0.0.
const libraryTestShadow: Linter.RuleEntry = [
  'error',
  { allow: ['expect', 'Intl', 'Temporal'], builtinGlobals: true, hoist: 'all' },
]

const libraryPackageJsonRules: NonNullable<Config['rules']> = {
  'package-json/require-homepage': 'error',
  'package-json/require-keywords': 'error',
  // A scoped package published to a non-default registry declares it:
  // three of the five libraries already carry
  // `{ registry: 'https://npm.pkg.github.com' }` (2026-09-27); the other
  // two gain it with their 7.0.0 adoption.
  'package-json/require-publishConfig': 'error',
  'package-json/require-types': 'error',
}

const libraryYamlStepOrder = [
  'id',
  'name',
  'if',
  'continue-on-error',
  'timeout-minutes',
  'uses',
  'with',
  'env',
  'shell',
  'working-directory',
  'run',
]

export const library = ({
  wireNamingEntries = [],
  wireNamingFiles = [],
}: LibraryOptions = {}): Config[] => {
  const naming = libraryNaming(wireNamingEntries)
  const isScoped = wireNamingFiles.length > 0

  return defineConfig([
    linterOptionsBlock,
    jsdocBlock(['src/**/*.ts']),
    ...libraryMainBlock({
      wireNamingEntries: isScoped ? [] : wireNamingEntries,
    }),
    // After the main block, so the scoped files win the override.
    ...(isScoped ? [wireNamingBlock(wireNamingFiles, naming)] : []),
    // The core policy, never the wire's (a config file speaks no wire),
    // plus the one tool-imposed shape of a library's root configs: the
    // typedoc map keys. Library-only — typedoc never runs on an app.
    configTsBlock(['*.config.{js,mjs,mts,ts}'], {
      ...libraryNaming([]),
      extraEntries: [typedocKeyEntry],
    }),
    configJsBlock,
    jsonBlock(),
    markdownBlock,
    changelogBlock,
    decoratorsBlock,
    temporalBlock,
    testsBlock({
      ...testNamingRules(naming),
      '@typescript-eslint/no-shadow': libraryTestShadow,
    }),
    yamlBlock(libraryYamlStepOrder),
    packageJsonBlock(libraryPackageJsonRules),
  ])
}

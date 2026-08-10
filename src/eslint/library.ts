// The published-library family preset: everything the API clients
// share. Each library's overlay keeps only its documented verdicts
// (ignores, `'off'` ledgers) and its wire-protocol naming entry.
import { type Config, defineConfig } from 'eslint/config'
import { flatConfigs as importXConfigs } from 'eslint-plugin-import-x'
import { configs as tsConfigs, globs as tsGlobs } from 'typescript-eslint'
import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import prettier from 'eslint-config-prettier/flat'
import perfectionist from 'eslint-plugin-perfectionist'
import unicorn from 'eslint-plugin-unicorn'

import {
  type NamingConventionOptions,
  changelogBlock,
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
): Parameters<typeof sharedMainRules>[0] => ({
  extraneous: {
    devDependencies: ['*.config.{js,ts}', 'tests/**'],
    includeTypes: true,
  },
  naming: libraryNaming(wireNamingEntries),
})

const libraryMainBlock = ({
  wireNamingEntries = [],
}: LibraryOptions): Config[] =>
  defineConfig([
    {
      extends: [
        js.configs.recommended,
        unicorn.configs.recommended,
        tsConfigs.strictTypeChecked,
        tsConfigs.stylisticTypeChecked,
        importXConfigs.errors,
        importXConfigs.typescript,
        // Last: it neutralizes formatting rules from the presets above.
        prettier,
      ],
      files: [tsGlobs.ts, '*.config.js'],
      languageOptions: mainLanguageOptions,
      plugins: { '@stylistic': stylistic, perfectionist },
      rules: {
        ...sharedMainRules(libraryMainRuleOptions(wireNamingEntries)),
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
        // Unaware of `Symbol.dispose`.
        'unicorn/no-nonstandard-builtin-properties': 'off',
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
    // cannot receive.
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
    configTsBlock(['*.config.{js,ts}']),
    configJsBlock,
    jsonBlock(),
    markdownBlock,
    changelogBlock,
    decoratorsBlock,
    temporalBlock,
    testsBlock({
      ...testNamingRules(naming),
      // The vitest-concurrent pattern destructures the test-context
      // `expect` (required for exact assertion counts), shadowing the
      // module import by design.
      '@typescript-eslint/no-shadow': [
        'error',
        { allow: ['expect', 'Intl', 'Temporal'], builtinGlobals: true },
      ],
    }),
    yamlBlock(libraryYamlStepOrder),
    packageJsonBlock({
      'package-json/require-homepage': 'error',
      'package-json/require-keywords': 'error',
      'package-json/require-types': 'error',
    }),
  ])
}

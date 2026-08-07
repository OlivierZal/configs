// Every fragment the two family presets assemble from. Rules that read
// differently per family (Homey webview constraints, wire-protocol
// vocabularies) live in the presets; per-repo verdicts (documented
// `'off'` ledgers, ignores) stay in each consumer's overlay.
import type { Linter } from 'eslint'
import { type Config, defineConfig } from 'eslint/config'
import { jsdoc } from 'eslint-plugin-jsdoc'
import { configs as packageJsonConfigs } from 'eslint-plugin-package-json'
import { Alphabet } from 'eslint-plugin-perfectionist/alphabet'
import { configs as ymlConfigs } from 'eslint-plugin-yml'
import json from '@eslint/json'
import markdown from '@eslint/markdown'
import vitest from '@vitest/eslint-plugin'
import unicorn from 'eslint-plugin-unicorn'

import {
  buildImportGroup,
  typeLikeSortOptions,
  typeSortOptions,
} from './helpers.ts'

export interface TemplateExpressionAllowEntry {
  readonly from: string
  readonly name: string
}

// Typed more narrowly than the `Config` slot (`Record<string,
// unknown>`) so consumers can spread `parserOptions`.
export const mainLanguageOptions: { parserOptions: Linter.ParserOptions } = {
  parserOptions: {
    // Root `*.config.js` files (typedoc) live outside every tsconfig;
    // the default project types them so the type-aware rules still
    // apply. (`allowDefaultProject` accepts no `**` globs.)
    projectService: { allowDefaultProject: ['*.config.js'] },
    warnOnUnsupportedTypeScriptVersion: false,
  },
}

export const linterOptionsBlock: Config = {
  linterOptions: {
    reportUnusedDisableDirectives: 'error',
    reportUnusedInlineConfigs: 'error',
  },
}

const jsdocRules: NonNullable<Config['rules']> = {
  'jsdoc/check-template-names': 'error',
  'jsdoc/informative-docs': 'error',
  'jsdoc/no-bad-blocks': 'error',
  'jsdoc/no-blank-block-descriptions': 'error',
  'jsdoc/no-blank-blocks': 'error',
  'jsdoc/normalize-see-links': 'error',
  'jsdoc/prefer-import-tag': 'error',
  'jsdoc/require-description': 'error',
  'jsdoc/require-hyphen-before-param-description': ['error', 'always'],
  'jsdoc/require-rejects': 'error',
  'jsdoc/require-template': 'error',
  'jsdoc/require-template-description': 'error',
  'jsdoc/require-throws': 'error',
  'jsdoc/require-throws-description': 'error',
  'jsdoc/require-yields-description': 'error',
  'jsdoc/sort-tags': 'error',
}

// One jsdoc policy for the family; each repo names the files that
// carry API documentation.
export const jsdocBlock = (files: string[]): Config => ({
  ...jsdoc({
    config: 'flat/recommended-tsdoc-error',
    rules: jsdocRules,
    settings: { tagNamePreference: { rejects: 'throws' } },
  }),
  files,
})

// Class-member order shared by both families; the Homey preset splices
// its lifecycle groups after the constructor.
export const sharedClassGroups: (string | string[])[] = [
  'index-signature',
  'static-decorated-property',
  'static-property',
  'static-accessor-property',
  ['static-get-method', 'static-set-method'],
  'protected-static-decorated-property',
  'protected-static-property',
  'protected-static-accessor-property',
  ['protected-static-get-method', 'protected-static-set-method'],
  'private-static-decorated-property',
  'private-static-property',
  'private-static-accessor-property',
  ['private-static-get-method', 'private-static-set-method'],
  'static-block',
  'declare-property',
  'abstract-property',
  'abstract-accessor-property',
  ['abstract-get-method', 'abstract-set-method'],
  'decorated-property',
  'property',
  'accessor-property',
  ['get-method', 'set-method'],
  'protected-decorated-property',
  'protected-property',
  'protected-accessor-property',
  ['protected-get-method', 'protected-set-method'],
  'private-decorated-property',
  'private-property',
  'private-accessor-property',
  ['private-get-method', 'private-set-method'],
  'constructor',
]

export const sharedClassGroupsTail: (string | string[])[] = [
  'static-decorated-method',
  'static-function-property',
  'static-method',
  'protected-static-decorated-method',
  'protected-static-function-property',
  'protected-static-method',
  'private-static-decorated-method',
  'private-static-function-property',
  'private-static-method',
  'abstract-method',
  'decorated-method',
  'function-property',
  'method',
  'protected-decorated-method',
  'protected-function-property',
  'protected-method',
  'private-decorated-method',
  'private-function-property',
  'private-method',
  'unknown',
]

// The boolean naming entry: semantic prefixes make intent obvious at
// the call site. The optional filter lets a family exclude a name whose
// type merely includes a boolean sentinel.
const booleanNamingEntry = (filter?: {
  match: boolean
  regex: string
}): Record<string, unknown> => ({
  ...(filter !== undefined && { filter }),
  format: ['PascalCase'],
  prefix: [
    'are',
    'can',
    'did',
    'has',
    'have',
    'is',
    'requires',
    'should',
    'was',
    'were',
    'will',
  ],
  selector: ['variable', 'parameter', 'classProperty'],
  types: ['boolean'],
})

export interface NamingConventionOptions {
  readonly booleanFilter?: { match: boolean; regex: string }
  readonly extraEntries?: readonly unknown[]
  // Formats accepted on object/type properties. The strict core keeps
  // camelCase; the tests override widens it (doubles mirror wire
  // payloads and key mocks by module-export names).
  readonly propertyFormats?: readonly string[]
}

const namingConventionHead: unknown[] = [
  {
    format: ['camelCase'],
    leadingUnderscore: 'forbid',
    selector: 'default',
    trailingUnderscore: 'forbid',
  },
  // PascalCase: `as const` enum-like objects. UPPER_CASE: scalar
  // constants.
  { format: ['camelCase', 'PascalCase', 'UPPER_CASE'], selector: 'variable' },
  // Destructured — external shapes (API responses, libs) are not ours.
  { format: null, modifiers: ['destructured'], selector: 'variable' },
]

const namingConventionMiddle: unknown[] = [
  // Unused parameters must wear the underscore; used ones must not.
  {
    format: ['camelCase'],
    leadingUnderscore: 'require',
    modifiers: ['unused'],
    selector: 'parameter',
  },
  { format: ['camelCase'], leadingUnderscore: 'forbid', selector: 'parameter' },
  {
    format: ['camelCase'],
    selector: ['function', 'classMethod', 'objectLiteralMethod', 'typeMethod'],
  },
]

const namingConventionTail = (
  propertyFormats: readonly string[],
): unknown[] => [
  // Strict core: properties are camelCase; wire and platform
  // vocabularies opt out upstream through scoped entries (the Homey
  // capability entry, each repo's wire entries) — never here.
  {
    format: [...propertyFormats],
    selector: ['objectLiteralProperty', 'typeProperty'],
  },
  // Quoted keys ('Content-Type', '@scope/pkg') — skip entirely.
  {
    format: null,
    modifiers: ['requiresQuotes'],
    selector: ['objectLiteralProperty', 'typeProperty'],
  },
  { format: ['camelCase', 'PascalCase'], selector: 'import' },
  { format: ['PascalCase'], selector: 'typeLike' },
  // T-prefix: T, TKey, TValue — universal TS convention.
  { format: ['PascalCase'], prefix: ['T'], selector: 'typeParameter' },
]

// The family-wide naming policy; families splice their wire-protocol
// vocabularies through `extraEntries`.
export const namingConventionEntries = ({
  booleanFilter,
  extraEntries = [],
  propertyFormats = ['camelCase'],
}: NamingConventionOptions): unknown[] => [
  ...namingConventionHead,
  booleanNamingEntry(booleanFilter),
  ...namingConventionMiddle,
  ...extraEntries,
  ...namingConventionTail(propertyFormats),
]

// Narrowing where a wire vocabulary applies means re-stating the whole
// option array, which replaces rather than merges — so a consumer that
// scoped it by hand would carry its own copy of the family policy, the
// shape that drifts. The preset emits the scoped block instead: the
// caller names its files, never the policy.
export const wireNamingBlock = (
  files: readonly string[],
  naming: NamingConventionOptions,
): Config => ({
  files: [...files],
  rules: {
    '@typescript-eslint/naming-convention': [
      'error',
      ...namingConventionEntries(naming),
    ],
  },
})

// The tests override: same per-repo naming options, properties
// widened — test doubles mirror wire payloads verbatim and key module
// mocks by their PascalCase export names.
export const testNamingRules = (
  naming: NamingConventionOptions,
): NonNullable<Config['rules']> => ({
  '@typescript-eslint/naming-convention': [
    'error',
    ...namingConventionEntries({
      ...naming,
      propertyFormats: ['camelCase', 'PascalCase', 'snake_case', 'UPPER_CASE'],
    }),
  ],
})

export interface SharedMainRulesOptions {
  readonly extraneous: {
    readonly devDependencies: readonly string[]
    readonly includeTypes?: boolean
  }
  readonly naming: NamingConventionOptions
  readonly templateExpressionAllow?: readonly TemplateExpressionAllowEntry[]
  readonly unassignedImportAllow?: readonly string[]
}

// The static mass of the main type-checked rule set both families
// share verbatim — a table, split from the option-driven entries the
// factory below merges in.
const staticMainRules: NonNullable<Config['rules']> = {
  '@stylistic/multiline-comment-style': [
    'error',
    'separate-lines',
    { checkExclamation: true },
  ],
  // Deliberate override of a config-prettier "special rule": safe with
  // `avoidEscape`.
  '@stylistic/quotes': [
    'error',
    'single',
    { allowTemplateLiterals: 'never', avoidEscape: true },
  ],
  '@stylistic/spaced-comment': [
    'error',
    'always',
    { block: { balanced: true } },
  ],
  '@typescript-eslint/class-methods-use-this': 'error',
  '@typescript-eslint/consistent-type-assertions': [
    'error',
    {
      arrayLiteralTypeAssertions: 'never',
      assertionStyle: 'as',
      objectLiteralTypeAssertions: 'never',
    },
  ],
  '@typescript-eslint/consistent-type-exports': [
    'error',
    { fixMixedExportsWithInlineTypeSpecifier: true },
  ],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { fixStyle: 'inline-type-imports' },
  ],
  '@typescript-eslint/default-param-last': 'error',
  '@typescript-eslint/explicit-function-return-type': 'error',
  '@typescript-eslint/explicit-member-accessibility': 'error',
  '@typescript-eslint/max-params': 'error',
  '@typescript-eslint/method-signature-style': 'error',
  '@typescript-eslint/no-base-to-string': ['error', { checkUnknown: true }],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-floating-promises': [
    'error',
    {
      checkThenables: true,
      // `no-void` bans the `void promise` escape; demand await/.catch.
      ignoreVoid: false,
    },
  ],
  '@typescript-eslint/no-import-type-side-effects': 'error',
  '@typescript-eslint/no-magic-numbers': [
    'error',
    {
      enforceConst: true,
      ignore: [0, 1, 2],
      ignoreEnums: true,
      ignoreNumericLiteralTypes: true,
      ignoreReadonlyClassProperties: true,
      ignoreTypeIndexes: true,
    },
  ],
  '@typescript-eslint/no-shadow': [
    'error',
    // `allow` covers deliberate polyfill re-exports (Temporal, Intl).
    { allow: ['Intl', 'Temporal'], builtinGlobals: true, hoist: 'all' },
  ],
  '@typescript-eslint/no-unnecessary-condition': [
    'error',
    { checkTypePredicates: true },
  ],
  '@typescript-eslint/no-unnecessary-type-assertion': [
    'error',
    { checkLiteralConstAssertions: true },
  ],
  '@typescript-eslint/no-unsafe-type-assertion': 'error',
  '@typescript-eslint/no-unused-private-class-members': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    { enableAutofixRemoval: { imports: true } },
  ],
  '@typescript-eslint/no-useless-empty-export': 'error',
  '@typescript-eslint/only-throw-error': [
    'error',
    { allowThrowingAny: false, allowThrowingUnknown: false },
  ],
  // Assignment and renamed-property enforcement breeds unreadable
  // destructuring.
  '@typescript-eslint/prefer-destructuring': [
    'error',
    {
      AssignmentExpression: { array: false, object: false },
      VariableDeclarator: { array: true, object: true },
    },
    {
      enforceForDeclarationWithTypeAnnotation: true,
      enforceForRenamedProperties: false,
    },
  ],
  '@typescript-eslint/prefer-readonly': 'error',
  '@typescript-eslint/promise-function-async': 'error',
  '@typescript-eslint/require-array-sort-compare': 'error',
  // Stricter than the strict preset's 'error-handling-correctness-only'.
  '@typescript-eslint/return-await': ['error', 'in-try-catch'],
  '@typescript-eslint/strict-boolean-expressions': [
    'error',
    { allowNullableObject: false, allowNumber: false, allowString: false },
  ],
  '@typescript-eslint/strict-void-return': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': [
    'error',
    {
      allowDefaultCaseForExhaustiveSwitch: false,
      considerDefaultExhaustiveForUnions: false,
      requireDefaultForNonUnion: true,
    },
  ],
  'accessor-pairs': 'error',
  'array-callback-return': ['error', { checkForEach: true }],
  'arrow-body-style': 'error',
  // Measured codebase ceiling.
  complexity: ['error', { max: 10 }],
  // Deliberate override of a config-prettier "special rule": the
  // default (all statements braced) never conflicts with Prettier.
  curly: 'error',
  'default-case-last': 'error',
  eqeqeq: 'error',
  'func-style': 'error',
  'guard-for-in': 'error',
  'id-length': 'error',
  'import-x/first': 'error',
  'import-x/newline-after-import': 'error',
  'import-x/no-absolute-path': 'error',
  'import-x/no-anonymous-default-export': [
    'error',
    { allowCallExpression: false },
  ],
  'import-x/no-cycle': 'error',
  'import-x/no-default-export': 'error',
  'import-x/no-duplicates': ['error', { 'prefer-inline': true }],
  'import-x/no-dynamic-require': ['error', { esmodule: true }],
  'import-x/no-empty-named-blocks': 'error',
  'import-x/no-import-module-exports': 'error',
  'import-x/no-mutable-exports': 'error',
  'import-x/no-named-as-default': 'error',
  'import-x/no-named-as-default-member': 'error',
  'import-x/no-named-default': 'error',
  'import-x/no-relative-packages': 'error',
  'import-x/no-self-import': 'error',
  'import-x/no-unresolved': ['error', { caseSensitiveStrict: true }],
  'import-x/no-unused-modules': [
    'error',
    {
      missingExports: true,
      suppressMissingFileEnumeratorAPIWarning: true,
      unusedExports: true,
    },
  ],
  'import-x/no-useless-path-segments': 'error',
  'import-x/no-webpack-loader-syntax': 'error',
  'import-x/unambiguous': 'error',
  'max-classes-per-file': 'error',
  // Measured codebase ceiling.
  'max-depth': ['error', { max: 3 }],
  'max-lines-per-function': 'error',
  'max-statements': 'error',
  'no-await-in-loop': 'error',
  'no-bitwise': 'error',
  'no-cond-assign': ['error', 'always'],
  'no-console': 'error',
  'no-constructor-return': 'error',
  'no-eval': 'error',
  'no-extend-native': 'error',
  'no-extra-bind': 'error',
  'no-extra-boolean-cast': ['error', { enforceForInnerExpressions: true }],
  'no-fallthrough': ['error', { reportUnusedFallthroughComment: true }],
  'no-implicit-coercion': 'error',
  'no-inline-comments': 'error',
  'no-irregular-whitespace': ['error', { skipStrings: false }],
  'no-labels': 'error',
  'no-lone-blocks': 'error',
  'no-lonely-if': 'error',
  'no-multi-assign': 'error',
  'no-multi-str': 'error',
  'no-new': 'error',
  'no-new-func': 'error',
  'no-object-constructor': 'error',
  'no-param-reassign': 'error',
  'no-promise-executor-return': 'error',
  'no-return-assign': ['error', 'always'],
  'no-self-compare': 'error',
  'no-sequences': ['error', { allowInParentheses: false }],
  'no-template-curly-in-string': 'error',
  'no-unmodified-loop-condition': 'error',
  'no-unneeded-ternary': 'error',
  'no-unreachable-loop': 'error',
  // Owned by `@typescript-eslint/no-unused-private-class-members`.
  'no-unused-private-class-members': 'off',
  'no-useless-computed-key': 'error',
  'no-useless-rename': 'error',
  'no-useless-return': 'error',
  'no-void': 'error',
  'object-shorthand': 'error',
  'one-var': ['error', 'never'],
  'perfectionist/sort-array-includes': 'error',
  'perfectionist/sort-enums': 'error',
  'perfectionist/sort-export-attributes': 'error',
  'perfectionist/sort-exports': [
    'error',
    {
      groups: [
        'named-type-export',
        'wildcard-type-export',
        'named-value-export',
        'wildcard-value-export',
      ],
      newlinesBetween: 1,
    },
  ],
  'perfectionist/sort-heritage-clauses': 'error',
  'perfectionist/sort-import-attributes': 'error',
  'perfectionist/sort-imports': [
    'error',
    {
      groups: [
        // Side-effect imports carry no specifiers, so only the bare
        // selectors can match them.
        'side-effect',
        { newlinesBetween: 1 },
        'side-effect-style',
        ...buildImportGroup('style'),
        { newlinesBetween: 1 },
        ...buildImportGroup('builtin'),
        { newlinesBetween: 1 },
        ...buildImportGroup('external'),
        ...buildImportGroup('subpath'),
        ...buildImportGroup('internal'),
        { newlinesBetween: 1 },
        ...buildImportGroup('parent'),
        ...buildImportGroup('sibling'),
        ...buildImportGroup('index'),
      ],
    },
  ],
  'perfectionist/sort-interfaces': ['error', typeLikeSortOptions],
  'perfectionist/sort-intersection-types': ['error', typeSortOptions],
  'perfectionist/sort-maps': 'error',
  'perfectionist/sort-modules': [
    'error',
    {
      groups: [
        'declare-enum',
        ['declare-interface', 'declare-type'],
        'declare-function',
        'declare-class',
        'enum',
        ['interface', 'type'],
        'function',
        'class',
        'export-enum',
        ['export-interface', 'export-type'],
        'export-function',
        'export-class',
        'export-default-interface',
        'export-default-function',
        'export-default-class',
      ],
      newlinesBetween: 1,
      newlinesInside: 1,
    },
  ],
  'perfectionist/sort-named-exports': [
    'error',
    { groups: ['type-export', 'value-export'] },
  ],
  'perfectionist/sort-named-imports': [
    'error',
    { groups: ['type-import', 'value-import'] },
  ],
  'perfectionist/sort-object-types': ['error', typeLikeSortOptions],
  'perfectionist/sort-objects': [
    'error',
    { groups: ['property', 'method'], partitionByComputedKey: true },
  ],
  'perfectionist/sort-sets': 'error',
  'perfectionist/sort-switch-case': 'error',
  'perfectionist/sort-union-types': ['error', typeSortOptions],
  'prefer-arrow-callback': 'error',
  'prefer-exponentiation-operator': 'error',
  'prefer-named-capture-group': 'error',
  'prefer-numeric-literals': 'error',
  'prefer-object-has-own': 'error',
  'prefer-object-spread': 'error',
  'prefer-regex-literals': ['error', { disallowRedundantWrapping: true }],
  'prefer-template': 'error',
  'require-atomic-updates': 'error',
  'require-unicode-regexp': ['error', { requireFlag: 'v' }],
  'symbol-description': 'error',
  'unicode-bom': 'error',
  // Config-driven comment vocabulary with no invariant to encode.
  'unicorn/comment-content': 'off',
  // Owned by `@typescript-eslint/naming-convention` for variables,
  // parameters and class properties (identical prefix set).
  'unicorn/consistent-boolean-name': 'off',
  // Owned by `perfectionist/sort-classes`.
  'unicorn/consistent-class-member-order': 'off',
  'unicorn/consistent-destructuring': 'error',
  'unicorn/consistent-function-style': ['error', { default: 'arrow-function' }],
  'unicorn/custom-error-definition': 'error',
  // Owned by `@typescript-eslint/naming-convention`.
  'unicorn/id-match': 'off',
  'unicorn/iteration-fallback-style': 'error',
  // Vocabulary opt-out: the abbreviation renames it forces
  // (`args` -> `arguments_`, ...) fight the domain naming.
  'unicorn/name-replacements': 'off',
  // Owned by `import-x/no-anonymous-default-export`.
  'unicorn/no-anonymous-default-export': 'off',
  'unicorn/no-array-front-mutation': 'error',
  // Doc-comment formatting is owned by the jsdoc plugin (the house
  // style keeps the `*` line prefix).
  'unicorn/no-asterisk-prefix-in-documentation-comments': 'off',
  // Owned by `@typescript-eslint/naming-convention`.
  'unicorn/no-keyword-prefix': 'off',
  // House comments wrap prose at print width; the heuristic reads
  // those wraps as unfinished sentences.
  'unicorn/no-manually-wrapped-comments': 'off',
  // Owned by `import-x/no-named-default` (imports; the export form it
  // also covers is unused here).
  'unicorn/no-named-default': 'off',
  'unicorn/no-non-function-verb-prefix': 'error',
  // The Homey SDK and both wire protocols speak `null` — banning null
  // literals fights the domain.
  'unicorn/no-null': 'off',
  // Owned by `@typescript-eslint/no-unnecessary-boolean-literal-compare`.
  'unicorn/no-unnecessary-boolean-comparison': 'off',
  'unicorn/no-unreadable-new-expression': 'error',
  'unicorn/no-unused-properties': 'error',
  'unicorn/prefer-dispose': 'error',
  // Requires Node.js 24 (`Error.isError`).
  'unicorn/prefer-error-is-error': 'off',
  // Mutually exclusive twin of `prefer-number-properties`' `checkNaN`:
  // the family picks `Number.NaN` (SonarCloud S7773 is a required gate,
  // and it pairs with the mandated `Number.isNaN`).
  'unicorn/prefer-global-number-constants': 'off',
  'unicorn/prefer-import-meta-properties': 'error',
  // Requires Node.js 24 (`Iterator.concat`).
  'unicorn/prefer-iterator-concat': 'off',
  // Stricter than the v72 default: varying-base member accesses stay
  // reported so the shared shape is factored out.
  'unicorn/prefer-minimal-ternary': ['error', { checkVaryingBase: true }],
  // Stricter than the v72 default (see `prefer-global-number-constants`
  // above).
  'unicorn/prefer-number-properties': ['error', { checkNaN: true }],
  // Requires Node.js 24 (`RegExp.escape`).
  'unicorn/prefer-regexp-escape': 'off',
  'unicorn/prefer-short-arrow-method': 'error',
  // Owned by `@typescript-eslint/prefer-string-starts-ends-with`.
  'unicorn/prefer-string-starts-ends-with': 'off',
  'unicorn/prefer-temporal': 'error',
  // Requires Node.js 24 (`Uint8Array#toBase64`).
  'unicorn/prefer-uint8array-base64': 'off',
  // Config-driven string vocabulary with no invariant to encode.
  'unicorn/string-content': 'off',
  'unicorn/try-complexity': 'error',
  'use-isnan': ['error', { enforceForIndexOf: true }],
  'valid-typeof': ['error', { requireStringLiterals: true }],
  yoda: 'error',
}

// Merges the static table with the measured family knobs.
export const sharedMainRules = ({
  extraneous,
  naming,
  templateExpressionAllow = [],
  unassignedImportAllow,
}: SharedMainRulesOptions): NonNullable<Config['rules']> => ({
  ...staticMainRules,
  '@typescript-eslint/naming-convention': [
    'error',
    ...namingConventionEntries(naming),
  ],
  '@typescript-eslint/restrict-template-expressions': [
    'error',
    {
      allow: [...templateExpressionAllow],
      allowAny: false,
      allowArray: false,
      allowBoolean: false,
      allowNever: false,
      allowNullish: false,
      allowNumber: false,
      allowRegExp: false,
    },
  ],
  'import-x/no-extraneous-dependencies': [
    'error',
    {
      bundledDependencies: false,
      devDependencies: [...extraneous.devDependencies],
      ...(extraneous.includeTypes === true && { includeTypes: true }),
      optionalDependencies: false,
      peerDependencies: false,
    },
  ],
  'import-x/no-unassigned-import':
    unassignedImportAllow === undefined
      ? 'error'
      : ['error', { allow: [...unassignedImportAllow] }],
})

export const perfectionistSettings: Record<string, Record<string, unknown>> = {
  perfectionist: {
    alphabet: Alphabet.generateRecommendedAlphabet()
      .sortByNaturalSort('en-US')
      .placeCharacterBefore({ characterAfter: '-', characterBefore: '/' })
      .getCharacters(),
    ignoreCase: false,
    locales: 'en-US',
    newlinesBetween: 0,
    newlinesInside: 0,
    order: 'asc',
    partitionByComment: false,
    partitionByNewLine: false,
    type: 'custom',
  },
}

export const configTsBlock = (files: string[]): Config => ({
  files,
  rules: {
    '@typescript-eslint/naming-convention': 'off',
    'import-x/no-default-export': 'off',
    // Config loaders (eslint, vitest, prettier, typedoc) consume
    // default exports.
    'import-x/prefer-default-export': ['error', { target: 'any' }],
  },
})

// The JS config files (`@ts-check` + JSDoc types) keep the full typed
// rule set; the only rules stepping aside are those whose fix JS
// cannot spell: a return-type annotation is TypeScript-only syntax,
// and a JSDoc `@type` is semantic exactly because it is a block
// comment — a line comment carries no type.
export const configJsBlock: Config = {
  files: ['*.config.js'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    'unicorn/single-line-block-comment-style': 'off',
  },
}

export const jsonBlock = (extraIgnores: readonly string[] = []): Config[] =>
  defineConfig([
    {
      extends: [json.configs.recommended],
      files: ['**/*.json'],
      ignores: ['**/package-lock.json', '**/package.json', ...extraIgnores],
      language: 'json/json',
      rules: {
        'json/sort-keys': [
          'error',
          'asc',
          { caseSensitive: true, natural: true },
        ],
        'json/top-level-interop': 'error',
      },
    },
  ])

export const markdownBlock: Config[] = defineConfig([
  {
    extends: [markdown.configs.recommended],
    files: ['**/*.md'],
    language: 'markdown/gfm',
    plugins: { unicorn },
    rules: {
      'markdown/fenced-code-meta': 'error',
      'markdown/no-bare-urls': 'error',
      'markdown/no-duplicate-headings': 'error',
      'markdown/no-html': 'error',
      'markdown/no-missing-atx-heading-space': [
        'error',
        { checkClosedHeadings: true },
      ],
      'markdown/no-missing-label-refs': [
        'error',
        {
          allowLabels: ['!CAUTION', '!IMPORTANT', '!NOTE', '!TIP', '!WARNING'],
        },
      ],
      'markdown/no-missing-link-fragments': ['error', { ignoreCase: false }],
      'markdown/no-space-in-emphasis': ['error', { checkStrikethrough: true }],
      'markdown/table-column-count': ['error', { checkMissingCells: true }],
      'unicorn/expiring-todo-comments': 'error',
      'unicorn/no-empty-file': 'error',
      'unicorn/no-missing-local-resource': 'error',
    },
  },
])

// Release sections repeat their own headings by design.
export const changelogBlock: Config = {
  files: ['CHANGELOG.md'],
  rules: {
    'markdown/no-duplicate-headings': ['error', { checkSiblingsOnly: true }],
  },
}

export const sharedTestRules: NonNullable<Config['rules']> = {
  // Fixtures and assertions are literal-heavy by nature.
  '@typescript-eslint/no-magic-numbers': 'off',
  // Owned by `vitest/unbound-method`, the mock-aware port.
  '@typescript-eslint/unbound-method': 'off',
  // Suites are one `describe` per function — length caps target
  // production code, not test tables.
  'max-lines-per-function': 'off',
  'max-statements': 'off',
  // Mock builders nest factories.
  'unicorn/max-nested-calls': ['error', { max: 4 }],
  // Without options the rule is a no-op; the suites use `.each`
  // exclusively.
  'vitest/consistent-each-for': [
    'error',
    { describe: 'each', it: 'each', suite: 'each', test: 'each' },
  ],
  'vitest/consistent-test-filename': 'error',
  'vitest/consistent-test-it': ['error', { fn: 'it' }],
  'vitest/consistent-vitest-vi': 'error',
  'vitest/hoisted-apis-on-top': 'error',
  // Measured codebase ceiling.
  'vitest/max-nested-describe': ['error', { max: 3 }],
  'vitest/no-alias-methods': 'error',
  'vitest/no-conditional-in-test': 'error',
  'vitest/no-conditional-tests': 'error',
  // The recommended preset ships this at 'warn' (zero-warning policy).
  'vitest/no-disabled-tests': 'error',
  'vitest/no-duplicate-hooks': 'error',
  'vitest/no-large-snapshots': 'error',
  'vitest/no-test-return-statement': 'error',
  // Union of the seven per-hook `padding-around-*` rules.
  'vitest/padding-around-all': 'error',
  'vitest/prefer-called-times': 'error',
  'vitest/prefer-called-with': 'error',
  'vitest/prefer-comparison-matcher': 'error',
  'vitest/prefer-describe-function-title': 'error',
  'vitest/prefer-each': 'error',
  'vitest/prefer-equality-matcher': 'error',
  'vitest/prefer-expect-assertions': [
    'error',
    {
      disallowHasAssertions: true,
      onlyFunctionsWithExpectInCallback: true,
      onlyFunctionsWithExpectInLoop: true,
    },
  ],
  'vitest/prefer-expect-resolves': 'error',
  'vitest/prefer-expect-type-of': 'error',
  'vitest/prefer-hooks-in-order': 'error',
  'vitest/prefer-hooks-on-top': 'error',
  'vitest/prefer-import-in-mock': 'error',
  'vitest/prefer-importing-vitest-globals': 'error',
  'vitest/prefer-lowercase-title': 'error',
  'vitest/prefer-mock-promise-shorthand': 'error',
  'vitest/prefer-snapshot-hint': 'error',
  'vitest/prefer-spy-on': 'error',
  'vitest/prefer-strict-boolean-matchers': 'error',
  'vitest/prefer-strict-equal': 'error',
  'vitest/prefer-to-be': 'error',
  'vitest/prefer-to-contain': 'error',
  'vitest/prefer-to-have-been-called-times': 'error',
  'vitest/prefer-to-have-length': 'error',
  'vitest/prefer-vi-mocked': 'error',
  'vitest/require-awaited-expect-poll': 'error',
  'vitest/require-mock-type-parameters': [
    'error',
    { checkImportFunctions: true },
  ],
  'vitest/require-to-throw-message': 'error',
  'vitest/require-top-level-describe': 'error',
  'vitest/unbound-method': 'error',
  'vitest/warn-todo': 'error',
}

export const testsBlock = (
  extraRules: NonNullable<Config['rules']> = {},
): Config[] =>
  defineConfig([
    {
      extends: [vitest.configs.recommended],
      files: ['tests/**/*.ts'],
      rules: { ...sharedTestRules, ...extraRules },
      settings: { vitest: { typecheck: true } },
    },
  ])

export const yamlBlock = (stepKeyOrder: readonly string[]): Config[] =>
  defineConfig([
    {
      // `files` keeps the `yml/*` rules off every non-YAML file.
      extends: [ymlConfigs.standard, ymlConfigs.prettier],
      files: ['**/*.{yaml,yml}'],
      rules: {
        'yml/file-extension': ['error', { extension: 'yml' }],
        'yml/key-name-casing': [
          'error',
          {
            camelCase: true,
            'kebab-case': true,
            SCREAMING_SNAKE_CASE: true,
            snake_case: true,
          },
        ],
        'yml/require-string-key': 'error',
        'yml/sort-keys': [
          'error',
          {
            order: { caseSensitive: true, natural: true, type: 'asc' },
            pathPattern: String.raw`^(?!jobs\.\w+\.steps\[\d+\]).*$`,
          },
          {
            order: [...stepKeyOrder],
            pathPattern: String.raw`^jobs\.\w+\.steps\[\d+\]$`,
          },
        ],
        'yml/sort-sequence-values': [
          'error',
          {
            order: { caseSensitive: true, natural: true, type: 'asc' },
            pathPattern: '^.*$',
          },
        ],
      },
    },
  ])

export const packageJsonBlock = (
  familyRules: NonNullable<Config['rules']>,
): Config[] =>
  defineConfig([
    {
      extends: [packageJsonConfigs.recommended, packageJsonConfigs.stylistic],
      files: ['**/package.json'],
      rules: {
        'package-json/require-author': 'error',
        'package-json/require-bugs': 'error',
        'package-json/require-engines': 'error',
        ...familyRules,
      },
    },
  ])

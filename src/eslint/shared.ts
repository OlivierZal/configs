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
    projectService: { allowDefaultProject: ['*.config.js', '*.config.mjs'] },
    warnOnUnsupportedTypeScriptVersion: false,
  },
}

export const linterOptionsBlock: Config = {
  linterOptions: {
    reportUnusedDisableDirectives: 'error',
    reportUnusedInlineConfigs: 'error',
  },
}

// unicorn 74 ships its comment-expiry rule hollow: `checkDates` and
// `allowWarningComments` default to false/true, so a dated warning
// comment never expired and an undated one was never a report. Stated
// wherever the rule runs (the main table, Markdown, HTML, CSS — a
// severity-only entry falls back to the plugin defaults), so every
// warning term names its expiry. Measured 2026-09-15: zero such
// comments across the eight repos, so the guard is latent. ESLint
// 10.10 + unicorn 74 report a term anywhere in a comment (the doc tag
// of that name included), word-bounded — this very comment names none;
// `ignore` is the escape hatch should placeholder prose ever need one.
// `checkDatesOnPullRequests` stays at its default (false): an expiry is
// a clock event outside the pull request — the dependency-review split
// by TIME — and lands on `main`'s push run instead.
export const expiringTodoComments: Linter.RuleEntry = [
  'error',
  { allowWarningComments: false, checkDates: true },
]

// The `confusing-browser-globals` set, inlined: the package is
// unmaintained and would fail the plugin-triage maintenance gate.
const confusingBrowserGlobals: readonly string[] = [
  'addEventListener',
  'blur',
  'close',
  'closed',
  'confirm',
  'defaultStatus',
  'defaultstatus',
  'event',
  'external',
  'find',
  'focus',
  'frameElement',
  'frames',
  'history',
  'innerHeight',
  'innerWidth',
  'length',
  'location',
  'locationbar',
  'menubar',
  'moveBy',
  'moveTo',
  'name',
  'onblur',
  'onerror',
  'onfocus',
  'onload',
  'onresize',
  'onunload',
  'open',
  'opener',
  'opera',
  'outerHeight',
  'outerWidth',
  'pageXOffset',
  'pageYOffset',
  'parent',
  'print',
  'removeEventListener',
  'resizeBy',
  'resizeTo',
  'screen',
  'screenLeft',
  'screenTop',
  'screenX',
  'screenY',
  'scroll',
  'scrollbars',
  'scrollBy',
  'scrollTo',
  'scrollX',
  'scrollY',
  'self',
  'status',
  'statusbar',
  'stop',
  'toolbar',
  'top',
]

const jsdocRules: NonNullable<Config['rules']> = {
  // The fixer reorders `@param` blocks into signature order and drops
  // duplicates — the same handover as `sort-tags` and perfectionist:
  // mechanical order belongs to the tool, not to the reader. It is safe
  // to automate precisely because the error DETERMINES its correction —
  // the names already match, only their positions differ, so exactly one
  // result is right, and each description travels with its own tag.
  //
  // The rule's two other fixers stay off (`extraParams`, `badParamNames`),
  // which is a verdict rather than an oversight: an orphan `@param` means
  // either "delete this doc" or "you forgot the parameter", and a name
  // mismatch means either the doc or the signature is wrong. Two opposite
  // corrections explain the same symptom, so the tool cannot choose —
  // and it would be choosing by deleting or rewriting prose a human
  // wrote. Both keep reporting, and the plugin offers its suggestions in
  // the editor regardless of these options, which is where a judgment
  // call belongs.
  // `never`: no column-aligned tag blocks, and a wrapped description
  // continues unindented — the house layout measured (2026-09-15).
  // Doc-comment layout is the plugin's because Prettier never enters a
  // comment. Whitespace fixer, determinate.
  'jsdoc/check-line-alignment': ['error', 'never'],
  'jsdoc/check-param-names': ['error', { enableFixer: true }],
  'jsdoc/check-template-names': 'error',
  'jsdoc/informative-docs': 'error',
  // Pins the FORM of every block the way `informative-docs` pins its
  // content: a description starts with a capital, a backtick, a digit
  // or a `{@link …}` reference (the one opener the default pattern
  // refuses, hence the custom regex) and ends in `.`, `?`, `!` or a
  // backtick. `contexts: ['any']` reaches type, interface, enum and
  // member blocks, not only the three function kinds. `throws` stays
  // out: the family writes `@throws {@link X} when …`, a tag form of
  // its own. Measured 0 across the eight repos (2026-09-15).
  'jsdoc/match-description': [
    'error',
    {
      contexts: ['any'],
      matchDescription: String.raw`^\n?(?:(?:[A-Z\x60\d_]|\{@)[\s\S]*[.?!\x60]\s*)?$`,
      tags: { param: true, returns: true, template: true, yields: true },
    },
  ],
  // The default reports a `/***` block only when it carries tags; the
  // option reports every one, so a mistyped opener cannot silently
  // drop a surface out of the docs. Fixable.
  'jsdoc/no-bad-blocks': ['error', { preventAllMultiAsteriskBlocks: true }],
  'jsdoc/no-blank-block-descriptions': 'error',
  'jsdoc/no-blank-blocks': 'error',
  // Optionality lives in the signature (`name?:` under
  // exactOptionalPropertyTypes); a `@param [name]` restates it and
  // drifts — the duplication `no-types` refuses for types. Fixable.
  'jsdoc/no-defaults': ['error', { noOptionalParamNames: true }],
  'jsdoc/normalize-see-links': 'error',
  'jsdoc/prefer-import-tag': 'error',
  // The house style keeps the `*` line prefix (the reason
  // `unicorn/no-asterisk-prefix-in-documentation-comments` is off);
  // until 2026-09-15 nothing checked it. Fixable; adoption cost 39
  // lines in homey-kit, 0 elsewhere.
  'jsdoc/require-asterisk-prefix': ['error', 'always'],
  // Every documented surface carries prose: the default contexts are
  // the three function kinds, so a tags-only block on a class, a type
  // or a member passed. Measured 0 across the family.
  'jsdoc/require-description': ['error', { contexts: ['any'] }],
  // `@template T - desc` uniformly (37/37 measured); `property` is
  // forbidden outright by `check-tag-names`, so it is not listed.
  'jsdoc/require-hyphen-before-param-description': [
    'error',
    'always',
    { tags: { template: 'always' } },
  ],
  // Adopted over an absent domain like every other
  // `require-*-description`: no `@next` tag exists in the family, and
  // the day one does it carries prose.
  'jsdoc/require-next-description': 'error',
  'jsdoc/require-rejects': 'error',
  // One `@template` per type parameter, so `require-template-description`
  // cannot be satisfied by one description shared across two.
  'jsdoc/require-template': ['error', { requireSeparateTemplates: true }],
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
const namingConventionEntries = ({
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
  // Refused with the measured reasons rather than the config-prettier
  // reflex: the `code` axis conflicts with Prettier's own output (nine
  // declarations in melcloud-api and seven in com.melcloud the printer
  // cannot break below 80), and the `comments` axis — the one Prettier
  // leaves alone — would cost 195 hand-wrapped prose lines family-wide
  // behind a `code` sentinel the rule needs, having no comments-only
  // mode. House comments wrap at print width by convention; measured
  // 2026-09-15 the convention is not held, and a rule that cannot fix
  // what it reports is not what would hold it.
  '@stylistic/max-len': 'off',
  // `checkJSDoc` stays at its default (false): it would rewrite `/** */`
  // blocks into line comments, which the jsdoc plugin and typedoc
  // cannot read.
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
  // 8.69: a conditional over a union that MAY hold a promise is as
  // wrong as one that always does — `all` flags every such union.
  '@typescript-eslint/no-misused-promises': [
    'error',
    {
      checksConditionals: { flagUnions: 'all' },
      checksSpreads: true,
      checksVoidReturn: true,
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
  // Every legitimate need is expressed in tsconfig (`types`, `lib`); a
  // directive is an import channel none of the import machinery sees.
  '@typescript-eslint/triple-slash-reference': [
    'error',
    { lib: 'never', types: 'never' },
  ],
  // `enforceForTSTypes`: the set-without-get check reaches interfaces
  // and type literals too. `getWithoutSet` stays off — a read-only
  // getter is a deliberate shape.
  'accessor-pairs': ['error', { enforceForTSTypes: true }],
  'array-callback-return': ['error', { checkForEach: true }],
  'arrow-body-style': 'error',
  // Measured codebase ceiling.
  complexity: ['error', { max: 10 }],
  // Deliberate override of a config-prettier "special rule": the
  // default (all statements braced) never conflicts with Prettier.
  curly: 'error',
  'default-case-last': 'error',
  eqeqeq: 'error',
  // A named function expression whose name differs from its binding is
  // a misleading name the naming convention cannot see; the domain is
  // the generator and decorator expressions the arrow style cannot
  // absorb.
  'func-name-matching': [
    'error',
    'always',
    { considerPropertyDescriptor: true },
  ],
  // `as-needed`: a name only where ES2015 inference gives none, so no
  // function expression reaches a stack trace anonymous.
  'func-names': ['error', 'as-needed'],
  'func-style': 'error',
  // Completes `accessor-pairs`: a pair sits together, getter first, in
  // classes, object literals and (`enforceForTSTypes`) interfaces.
  // `perfectionist/sort-classes` keeps a pair adjacent and is stable
  // between its two members, so the two rules never fight.
  'grouped-accessor-pairs': [
    'error',
    'getBeforeSet',
    { enforceForTSTypes: true },
  ],
  'guard-for-in': 'error',
  'id-length': 'error',
  'import-x/first': 'error',
  'import-x/newline-after-import': 'error',
  'import-x/no-absolute-path': 'error',
  // Tighter than upstream (`allowCallExpression` defaults to true) and
  // load-bearing for config files: see `configTsBlock` for the
  // `isolatedDeclarations` derivation this tightening enforces.
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
  // Inert under ESLint 10, which removed the FileEnumerator API the rule
  // enumerates `src` with: the plugin returns no visitor and says so
  // (the suppressed warning is that statement). Kept at `error` so the
  // verdict re-arms the day import-x ships its replacement, but nothing
  // in the family may lean on it meanwhile — an unused export is caught
  // by a test that pins the published surface, never by this rule.
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
  // Measured codebase ceiling (melcloud-api reaches exactly 3 twice),
  // Promise executors counted: `max-depth` caps blocks, this caps the
  // callback pyramid. Off in the test block, where `describe` > `it` >
  // callback > factory nests structurally.
  'max-nested-callbacks': [
    'error',
    { checkConstructorCallCallbacks: true, max: 3 },
  ],
  'max-statements': 'error',
  // Shared rather than app-only: homey-kit's webview sources compile
  // under `lib: DOM` in a library-preset repo, and the other libraries
  // pay nothing (TS2304 there). A blocking native dialog is the wrong
  // surface in a Homey webview; the platform's dialogs are.
  'no-alert': 'error',
  'no-await-in-loop': 'error',
  'no-bitwise': 'error',
  // `arguments.callee`/`.caller` throw under ESM strict mode and
  // TypeScript declares them; `prefer-rest-params` skips non-computed
  // members of `arguments`, so the defect was unowned.
  'no-caller': 'error',
  'no-cond-assign': ['error', 'always'],
  'no-console': 'error',
  // Through `js.configs.recommended` at its default; the option also
  // reports a relational comparison of two literals.
  'no-constant-binary-expression': [
    'error',
    { checkRelationalComparisons: true },
  ],
  'no-constructor-return': 'error',
  // Dead structure after a `return`; `allowElseIf: false` keeps chains
  // from hiding the same shape. Composes with `unicorn/prefer-ternary`
  // (both accept the ternary form). Fixable, one correction.
  'no-else-return': ['error', { allowElseIf: false }],
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
  // The core rule, since typescript-eslint 8.64 deprecated its twin: a
  // closure created in a loop over a binding the loop keeps mutating.
  'no-loop-func': 'error',
  'no-multi-assign': 'error',
  'no-multi-str': 'error',
  // Lost verdict re-adopted: unicorn's recommended set turns the core
  // rule off for its twin, and eslint-config-prettier then turns the
  // twin off (it demands parentheses) — measured, both at `off`, nested
  // ternaries unpoliced. The core rule has no formatting content.
  'no-nested-ternary': 'error',
  'no-new': 'error',
  'no-new-func': 'error',
  'no-object-constructor': 'error',
  'no-param-reassign': 'error',
  'no-promise-executor-return': 'error',
  // Under `lib: DOM` every `window` property is a bare global
  // TypeScript accepts, so a forgotten local reads `name`, `status`,
  // `length`, `event`, `parent`, `top`… with a plausible type. The
  // explicit `globalThis.x` form `unicorn/prefer-global-this` writes
  // passes. Shared for homey-kit's webview sources; the other libraries
  // pay nothing (TS2304).
  'no-restricted-globals': ['error', ...confusingBrowserGlobals],
  'no-return-assign': ['error', 'always'],
  // A `javascript:` URL is string-evaluated code in the webview pages;
  // the literal complement of `unicorn/no-unsafe-dom-html`. Shared for
  // the same reason as `no-alert`.
  'no-script-url': 'error',
  'no-self-compare': 'error',
  'no-sequences': ['error', { allowInParentheses: false }],
  'no-template-curly-in-string': 'error',
  // `checkConditionalExpressions`: each operand of a `?:` inside a loop
  // condition is checked on its own, not the ternary as one group.
  'no-unmodified-loop-condition': [
    'error',
    { checkConditionalExpressions: true },
  ],
  'no-unneeded-ternary': 'error',
  'no-unreachable-loop': 'error',
  // Owned by `@typescript-eslint/no-unused-private-class-members`.
  'no-unused-private-class-members': 'off',
  // `fn.call(undefined, a)` is a plain call written the long way;
  // `prefer-spread` and `unicorn/prefer-reflect-apply` own the `apply`
  // half only.
  'no-useless-call': 'error',
  'no-useless-computed-key': 'error',
  // `prefer-template` reports concatenation only with a non-literal
  // operand; two literals on one line are its residue.
  'no-useless-concat': 'error',
  'no-useless-rename': 'error',
  'no-useless-return': 'error',
  'no-void': 'error',
  'object-shorthand': 'error',
  'one-var': ['error', 'never'],
  // The arithmetic twin of `unicorn/logical-assignment-operators`
  // (`always`): `x = x + y` → `x += y`. Fixable, one correction; the
  // rule skips targets with side effects.
  'operator-assignment': ['error', 'always'],
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
  // Owned by `one-var: 'never'`: every multi-declarator statement is
  // split before order matters, and the split keeps evaluation order
  // where this rule's fixer would reorder side-effecting initialisers.
  // Its one unowned residue, a multi-declarator `for (;;)` initialiser,
  // is absent across the eight repos (2026-09-15).
  'perfectionist/sort-variable-declarations': 'off',
  // `allowUnboundThis: false`: a `function` callback is reported even
  // when it mentions `this` — the stance `func-style`,
  // `unicorn/consistent-function-style` and `prefer-short-arrow-method`
  // already take. A callback that needs a dynamic `this` is a hoisted
  // `this`-typed function passed by reference; none exists
  // (2026-09-15). The fixer converts only the semantics-preserving
  // cases.
  'prefer-arrow-callback': ['error', { allowUnboundThis: false }],
  'prefer-exponentiation-operator': 'error',
  'prefer-named-capture-group': 'error',
  'prefer-numeric-literals': 'error',
  'prefer-object-has-own': 'error',
  'prefer-object-spread': 'error',
  'prefer-regex-literals': ['error', { disallowRedundantWrapping: true }],
  'prefer-template': 'error',
  // The parameter-less `catch { throw new X() }` is the one remaining
  // way to sever an error chain silently. Suggestion only; the error
  // classes with a `cause` slot are each repo's vocabulary.
  'preserve-caught-error': ['error', { requireCatchParameter: true }],
  // `always`: the explicit radix on every `parseInt`, `Number.parseInt`
  // included.
  radix: ['error', 'always'],
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
  'unicorn/expiring-todo-comments': expiringTodoComments,
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
  // unicorn 76's `checkContinue` (off by default): an unlabeled
  // `continue` inside a nested loop, or inside a `switch` within a
  // loop, reads as ambiguous about what it continues. Measured
  // 2026-09-22 at zero sites over the eight repositories — adopted as
  // a latent guard, the way `prefer-rolling-workspace-spec` is.
  'unicorn/no-break-in-nested-loop': ['error', { checkContinue: true }],
  // unicorn 76's `checkConditionals` (off by default): a value built by
  // guarded `push` calls right after its initialization is built in its
  // literal instead, conditional spreads included. One site over the
  // eight repositories (api-core's ordered policy builder), which
  // rewrites safely into a literal that shows the order at a glance;
  // the rule's own abstention from fixing it in TypeScript concerns the
  // autofix, not the code — an explicit array annotation keeps the
  // contextual typing. Refused on 2026-09-22 for that one site, adopted
  // on 2026-09-23: the base rule was already at `error` with its
  // rewrites made, and the extension asks nothing different.
  'unicorn/no-immediate-mutation': ['error', { checkConditionals: true }],
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
  // unicorn 76's `checkCompoundConditions` (off by default): two
  // consecutive guards whose conditions are compound (`&&`, `??`, a
  // ternary, a negated group) get combined like simple ones. Measured
  // 2026-09-22 at zero sites over the eight repositories — adopted as
  // a latent guard.
  'unicorn/prefer-combined-guards': [
    'error',
    { checkCompoundConditions: true },
  ],
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
  // At the preset's `always` since 6.6.0. The `only-single-line` bound
  // of 6.4.1 answered unicorn 75's nested-ternary defect, which 76's
  // readability boundaries fixed (a guard whose values hold a ternary, a
  // block or a multiline literal is left alone in both modes); the
  // 6.5.0 re-measurement judged the fixer's raw output, not the result
  // `format:fix` produces right after it. A two-way value selection is
  // a ternary's job — what `prefer-minimal-ternary` above already asks
  // at its stricter setting — and `prefer-early-return` guards a long
  // body, not a value. Nine sites over the seven consumers (2026-09-23),
  // every one auto-fixed.
  'unicorn/prefer-ternary': 'error',
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
    // The `const config = defineConfig(...)` / `export default config`
    // spelling here is DERIVED, not stylistic, and the global
    // `no-anonymous-default-export` tightening is what enforces it.
    // The docs of every loader this block serves write
    // `export default defineConfig(...)`, but both family tsconfig
    // bases hold every included file — config files among them — to
    // `isolatedDeclarations`, and TypeScript cannot annotate a default
    // export: the docs form is a hard TS9037 on every tree (measured
    // 2026-08-12 on this repo). The annotated const is that form's
    // only compilable spelling, so the lint ban makes the compiling
    // shape also the linted shape. Re-evaluate if TypeScript learns
    // default-export annotations or config files leave the
    // `isolatedDeclarations` surface.
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
  files: ['*.config.{js,mjs}'],
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
      'unicorn/expiring-todo-comments': expiringTodoComments,
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

const sharedTestRules: NonNullable<Config['rules']> = {
  // Fixtures and assertions are literal-heavy by nature.
  '@typescript-eslint/no-magic-numbers': 'off',
  // Owned by `vitest/unbound-method`, the mock-aware port.
  '@typescript-eslint/unbound-method': 'off',
  // Suites are one `describe` per function — length caps target
  // production code, not test tables — and `describe` > `it` > callback
  // > mock factory nests four to six deep by construction.
  'max-lines-per-function': 'off',
  'max-nested-callbacks': 'off',
  'max-statements': 'off',
  // vitest 5 makes `toThrow('')` match ANY message (vitest 4 read it as
  // an exactly-empty message), so the argument turns the assertion
  // vacuous while `require-to-throw-message` still sees an argument.
  // Zero sites in the family (2026-09-15); the selector also meets
  // `.not.toThrow('')`, where the fix is the same — drop the argument.
  'no-restricted-syntax': [
    'error',
    {
      message:
        "vitest 5: toThrow('') matches any message — name the message or drop the empty-string argument.",
      selector:
        "CallExpression[callee.property.name=/^toThrow(Error)?$/][arguments.0.type='Literal'][arguments.0.value='']",
    },
  ],
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
  // vitest 5 throws on a hoisted API outside the top level; the rule
  // stays as the static, pre-run signal that names the line.
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
  // vitest 5 clears every mock before each test (`clearMocks` defaults
  // to true), so a hook-level clear restates the runner; a mid-test
  // phase boundary is `mock.mockClear()` on the one mock it concerns.
  'vitest/no-restricted-vi-methods': [
    'error',
    {
      clearAllMocks:
        'vitest 5 clears every mock before each test; a hook-level clear restates the runner — use mock.mockClear() for a mid-test phase boundary.',
    },
  ],
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
  // An unawaited `expect.poll` has thrown at runtime since vitest 4; the
  // rule is the static signal.
  'vitest/require-awaited-expect-poll': 'error',
  'vitest/require-mock-type-parameters': [
    'error',
    { checkImportFunctions: true },
  ],
  'vitest/require-to-throw-message': 'error',
  'vitest/require-top-level-describe': 'error',
  'vitest/unbound-method': 'error',
  // `alwaysAwait`: a block-bodied `return expect(…).resolves` in a hook,
  // a `describe` body or a helper — where `no-test-return-statement`
  // (test bodies only) does not look — is reported; an expression-bodied
  // arrow stays accepted. The fixer is right for one site per file and
  // wrong for two or more non-async callbacks in one file (the second
  // gets `await` inside a non-async function), so a multi-site `--fix`
  // is read before it lands. vitest 5 fails an unawaited `resolves`,
  // `rejects` or `toMatchFileSnapshot` at runtime too; the rule stays as
  // the static, pre-run signal.
  'vitest/valid-expect': ['error', { alwaysAwait: true }],
  'vitest/warn-todo': 'error',
}

// Both presets pass their family's test rules; there is no caller for
// which an empty table would be right.
export const testsBlock = (
  extraRules: NonNullable<Config['rules']>,
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
        // In neither preset (3.8.1): a plain `true:` key (`on:` under YAML
        // 1.1) reaches readers as a boolean. Zero sites 2026-09-22; YAML 1.2.
        'yml/no-boolean-key': 'error',
        // Mirrors the core `no-irregular-whitespace` verdict
        // (`skipStrings: false`): an NBSP inside a quoted `run:` or
        // `name:` scalar is reported too.
        'yml/no-irregular-whitespace': ['error', { skipQuotedScalars: false }],
        // Overrides `ymlConfigs.prettier`: Prettier keeps float spelling
        // (`1.50` survives a pass, probed 2026-09-15), so nothing owns
        // this; the fixer retags `x.0` as `x` (versions here are quoted).
        'yml/no-trailing-zeros': 'error',
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
        // Adopted over an ABSENT domain: the family has no monorepo —
        // no `workspaces` key, no pnpm-workspace.yaml, and zero
        // `workspace:` specifiers across the eight repos (2026-08-30),
        // which are eight independent packages pinned to each other by
        // exact version. It can never fire today, and it is kept at
        // `error` as a latent guard: the day a workspace appears, the
        // rolling spec should be the default from the first commit
        // rather than a later cleanup. Drop it if the family commits to
        // staying multi-repo for good.
        // Guards the runtime pins — api-core, homey-kit, melcloud-api,
        // heatzy-api under `dependencies` — against a committed `file:`,
        // `link:` or relative pack rehearsal, the shape the 2026-09-07
        // dry adoptions took. It reads `dependencies` only: the
        // `@olivierzal/configs` rehearsal lands in `devDependencies`,
        // where `check-pins.sh` is the guard. A runtime `file:` pin
        // lints red on this rule until the re-pin — that red is the
        // point.
        'package-json/no-local-dependencies': 'error',
        'package-json/prefer-rolling-workspace-spec': 'error',
        'package-json/require-author': 'error',
        'package-json/require-bugs': 'error',
        'package-json/require-engines': 'error',
        // The exact-pin doctrine, mechanised for the family packages:
        // `check-pins.sh` polices the two two-channel packages, this
        // rule reaches the three single-channel ones (api-core,
        // melcloud-api, heatzy-api) too. Third-party ranges are caret by
        // habit, not by verdict, so they stay out; `npm:` aliases and
        // `file:` specs are not semver ranges and pass.
        'package-json/restrict-dependency-ranges': [
          'error',
          { forPackages: ['^@olivierzal/'], rangeType: 'pin' },
        ],
        // package-json 1.9's rule, with an EMPTY allow-list: a dependency
        // is a version here, never a dist-tag — `latest` or `next` would
        // dodge Dependabot's reviewed bump and the exact-pin doctrine
        // alike. Measured 2026-09-22 at zero sites over the eight
        // repositories.
        'package-json/restrict-dist-tags': ['error', { allowed: [] }],
        ...familyRules,
      },
    },
  ])

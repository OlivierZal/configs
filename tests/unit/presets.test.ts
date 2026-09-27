import { fileURLToPath } from 'node:url'

import type { Config } from 'eslint/config'
import { ESLint } from 'eslint'
import { format } from 'prettier'
import { describe, expect, it } from 'vitest'

import { homeyApp } from '../../src/eslint/homey-app.ts'
import { library } from '../../src/eslint/library.ts'
import { jsdocBlock, mainLanguageOptions } from '../../src/eslint/shared.ts'
import { asRecord } from '../helpers.ts'

const appPreset = homeyApp({
  bundledSourceGlobs: ['settings/**'],
  defaultExportFiles: ['api.mts', 'app.mts'],
  jsdocFiles: ['lib/**/*.mts'],
  untypedDoubleTestFiles: ['tests/unit/app.test.ts'],
  webviewFloorFiles: ['settings/**/*.mts'],
})

const noDoublesPreset = homeyApp({
  bundledSourceGlobs: ['settings/**'],
  defaultExportFiles: ['api.mts', 'app.mts'],
  jsdocFiles: ['lib/**/*.mts'],
  webviewFloorFiles: ['settings/**/*.mts'],
})

const untypedDoubleBlockOf = (
  preset: typeof appPreset,
): (typeof appPreset)[number] | undefined =>
  preset.find(
    (entry) =>
      entry.rules?.['@typescript-eslint/no-explicit-any'] === 'off' &&
      entry.rules['@typescript-eslint/no-unsafe-call'] === 'off',
  )

const libraryPreset = library({
  wireNamingEntries: [
    {
      filter: { match: true, regex: '^__brand$' },
      format: null,
      selector: 'typeProperty',
    },
  ],
})

const libraryWith = (
  wireNamingEntries: readonly unknown[],
  wireNamingFiles: readonly string[] = [],
): Config[] => library({ wireNamingEntries, wireNamingFiles })

const homeyAppWith = (
  wireNamingEntries: readonly unknown[],
  wireNamingFiles: readonly string[] = [],
): Config[] =>
  homeyApp({
    bundledSourceGlobs: ['settings/**'],
    defaultExportFiles: ['api.mts', 'app.mts'],
    jsdocFiles: ['lib/**/*.mts'],
    webviewFloorFiles: ['settings/**/*.mts'],
    wireNamingEntries,
    wireNamingFiles,
  })

// The floor block's own table; its `extends` lands as a sibling entry
// carrying the same files.
const floorEntry = appPreset.find(
  (entry) =>
    entry.rules !== undefined &&
    Object.hasOwn(entry.rules, 'require-unicode-regexp') &&
    entry.files?.includes('settings/**/*.mts') === true,
)

// Each preset with files standing for every block it carries (`app.json`
// and `locales/*.json` are ignored by design and resolve to nothing, so
// they are not listed).
const presets = [
  {
    files: [
      'app.mts',
      'api.mts',
      'lib/homey.mts',
      'lib/device.mts',
      'settings/index.mts',
      'settings/index.html',
      'settings/index.css',
      'package.json',
      'README.md',
      '.github/workflows/ci.yml',
      'tests/unit/x.test.ts',
      'tests/unit/app.test.ts',
      'eslint.config.ts',
      'typedoc.config.js',
    ],
    preset: appPreset,
    presetName: 'homeyApp',
  },
  {
    files: [
      'src/index.ts',
      'src/decorators/x.ts',
      'src/temporal.ts',
      'package.json',
      'tsconfig.json',
      'README.md',
      'CHANGELOG.md',
      '.github/workflows/ci.yml',
      'tests/unit/x.test.ts',
      'eslint.config.ts',
      'typedoc.config.js',
    ],
    preset: libraryPreset,
    presetName: 'library',
  },
]

const representativeCases = presets.flatMap(({ files, preset, presetName }) =>
  files.map((file) => ({ file, preset, presetName })),
)

const resolvedCwd = fileURLToPath(
  new URL('../fixtures/resolved/', import.meta.url),
)

const resolveRules = async (
  preset: Config[],
  file: string,
): Promise<Record<string, unknown>> => {
  const eslint = new ESLint({
    cwd: resolvedCwd,
    overrideConfig: preset,
    overrideConfigFile: true,
  })
  return asRecord(
    asRecord(
      await eslint.calculateConfigForFile(file),
      `the resolved config of ${file}`,
    ).rules,
    'rules',
  )
}

const severityOf = (entry: unknown): unknown =>
  Array.isArray(entry) ? entry[0] : entry

const warnRules = (rules: Record<string, unknown>): string[] =>
  Object.entries(rules)
    .filter(([, entry]) => severityOf(entry) === 1)
    .map(([ruleId]) => ruleId)

// The type-checked main block is the one that enables the project
// service; scoped blocks legitimately override it for their own files.
const mainRulesOf = (preset: typeof appPreset): Record<string, unknown> =>
  preset.find(
    (entry) =>
      entry.languageOptions?.parserOptions !== undefined &&
      entry.languageOptions.parserOptions !== null &&
      Object.hasOwn(entry.languageOptions.parserOptions, 'projectService') &&
      entry.rules !== undefined,
  )?.rules ?? {}

// Minimal page satisfying every quality rule the preset keeps, so a
// mutation below can only raise its own message. Written the way
// Prettier writes it, which is the point: the same bytes must survive
// both the formatter and the linter.
const HTML_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta content="width=device-width, initial-scale=1" name="viewport" />
    <title>t</title>
  </head>
  <body>
    <p class="a">x</p>
  </body>
</html>
`

const htmlBlocks = appPreset.filter(
  (entry) => entry.files?.includes('**/*.html') === true,
)

const lintHtml = async (text: string): Promise<(string | null)[]> => {
  const eslint = new ESLint({
    overrideConfig: htmlBlocks,
    overrideConfigFile: true,
  })
  // The path must sit inside the cwd: `lintText` silently reports
  // nothing for a path outside it, which would turn every assertion
  // here into a comparison against an empty list it never populated.
  const [result] = await eslint.lintText(text, {
    filePath: 'settings/index.html',
  })
  return result?.messages.map(({ ruleId }) => ruleId) ?? []
}

const lintJsdoc = async (
  text: string,
): Promise<{ output: string | undefined; ruleIds: (string | null)[] }> => {
  const eslint = new ESLint({
    fix: true,
    overrideConfig: jsdocBlock(['lib/*.js']),
    overrideConfigFile: true,
  })
  const [result] = await eslint.lintText(text, { filePath: 'lib/sample.js' })
  return {
    output: result?.output,
    ruleIds: result?.messages.map(({ ruleId }) => ruleId) ?? [],
  }
}

describe(homeyApp, () => {
  it('should carry the webview floor on the given files only', () => {
    expect(floorEntry).toBeDefined()
    expect(floorEntry?.rules?.['require-unicode-regexp']).toStrictEqual([
      'error',
      { requireFlag: 'u' },
    ])
  })

  // The floor is an ENGINE, not an edition: es-x's es2023 table is
  // corrected where the iOS 16.4 WebKit ships an es2024 feature, the `v`
  // flag is refused once (by `require-unicode-regexp`, the twin off), a
  // Web API es-x cannot see is banned by hand, and the hand selectors the
  // table replaced are gone.
  it('should correct the edition table by the engine', () => {
    const rules = floorEntry?.rules ?? {}

    expect(rules['es-x/no-array-fromasync']).toBe('off')
    expect(rules['es-x/no-atomics-waitasync']).toBe('off')
    expect(rules['es-x/no-regexp-v-flag']).toBe('off')
    expect(rules['es-x/no-resizable-and-growable-arraybuffers']).toBe('off')
    expect(rules['es-x/no-string-prototype-iswellformed']).toBe('off')
    expect(rules['es-x/no-string-prototype-towellformed']).toBe('off')
    expect(rules['import-x/no-nodejs-modules']).toBe('error')
    expect(JSON.stringify(rules['no-restricted-properties'])).toContain(
      'AbortSignal',
    )
    expect(rules).not.toHaveProperty('no-restricted-syntax')
  })

  it('should pin the main rule inventory', () => {
    expect(
      Object.keys(mainRulesOf(appPreset)).toSorted((first, second) =>
        first.localeCompare(second),
      ),
    ).toMatchSnapshot()
  })

  it('should scope the untyped-double offs to the given files', () => {
    expect(untypedDoubleBlockOf(appPreset)?.files).toStrictEqual([
      'tests/unit/app.test.ts',
    ])
  })

  it('should omit the untyped-double block when no files are given', () => {
    expect(untypedDoubleBlockOf(noDoublesPreset)).toBeUndefined()
  })

  // ESLint rejects `files: []` at config normalization, so a real
  // calculation is the lock: an unconditional block would throw here.
  it('should stay a valid config with the block omitted', async () => {
    const eslint = new ESLint({
      overrideConfig: noDoublesPreset,
      overrideConfigFile: true,
    })

    await expect(
      eslint.calculateConfigForFile('app.mts'),
    ).resolves.toBeDefined()
  })
})

// The HTML handover is the one place `eslint-config-prettier` cannot
// help: it disables no `html/` rule at all, so the split between what
// Prettier formats and what the preset still lints is hand-maintained —
// and only a real Prettier run can prove it lands where it claims.
describe('html formatting handover', () => {
  it('should accept what Prettier produces', async () => {
    const formatted = await format(HTML_PAGE, { parser: 'html' })

    await expect(lintHtml(formatted)).resolves.toStrictEqual([])
  })

  // The formatter's job, given up here: four-space indent, padded tags
  // and single quotes are all rewritten by the very next `format` run,
  // so reporting them would only duplicate it.
  it('should leave formatting alone', async () => {
    const misformatted = HTML_PAGE.replace(
      '    <p class="a">x</p>',
      "        <p    class='a'  >x</p>",
    )

    await expect(lintHtml(misformatted)).resolves.toStrictEqual([])
  })

  // The counterweight: no formatter invents an ARIA role, so the
  // quality half must survive the handover intact.
  it('should still reject an invalid ARIA role', async () => {
    const invalid = HTML_PAGE.replace(
      '<p class="a">x</p>',
      '<p role="not-a-role">x</p>',
    )

    await expect(lintHtml(invalid)).resolves.toStrictEqual([
      'html/no-invalid-role',
    ])
  })
})

const cssBlocks = appPreset.filter(
  (entry) => entry.files?.includes('**/*.css') === true,
)

const lintCss = async (text: string): Promise<(string | null)[]> => {
  const eslint = new ESLint({
    overrideConfig: cssBlocks,
    overrideConfigFile: true,
  })
  const [result] = await eslint.lintText(text, {
    filePath: 'settings/index.css',
  })
  return result?.messages.map(({ ruleId }) => ruleId) ?? []
}

// The CSS gate is bound to the same engine as the JS floor — the iOS
// 16.4 WebKit — through a Baseline year, plus an exact-name allowlist
// for what that engine shipped ahead of the other browsers. Real lint
// runs, both ways: a feature above the floor is rejected, and the
// allowlisted ones pass where the year alone would refuse them.
describe('css baseline floor', () => {
  it('should bind the year to the floor and allow features by name', () => {
    expect(
      cssBlocks
        .map((entry) => entry.rules?.['css/use-baseline'])
        .filter((option) => Array.isArray(option)),
    ).toStrictEqual([
      [
        'error',
        {
          allowFunctions: ['color-mix'],
          allowProperties: ['mask-image', 'outline'],
          available: 2022,
        },
      ],
    ])
  })

  it.each([
    { css: 'a {\n  text-wrap: balance;\n}\n', feature: 'text-wrap' },
    {
      css: '@starting-style {\n  a {\n    color: red;\n  }\n}\n',
      feature: '@starting-style',
    },
    // Safari 16.5 features: 2023 would admit them, 2022 rejects them —
    // the rows that hold the year where the floor put it.
    { css: 'a:user-valid {\n  color: red;\n}\n', feature: ':user-valid' },
    { css: 'a {\n  & b {\n    color: red;\n  }\n}\n', feature: '`&` nesting' },
  ])('should reject $feature, above the floor', async ({ css }) => {
    await expect(lintCss(css)).resolves.toContain('css/use-baseline')
  })

  it('should accept what WebKit shipped before the floor', async () => {
    await expect(
      lintCss(
        'a {\n  color: color-mix(in srgb, red, blue);\n  mask-image: none;\n  outline: none;\n}\n',
      ),
    ).resolves.toStrictEqual([])
  })
})

// The one pseudo-element the three settings pages need — hiding a
// `<summary>` marker on the WebKit the floor admits — is allowed by
// exact name, and every other unknown selector still reports.
describe('css unknown pseudo-selectors', () => {
  it('should allow the details marker by name', async () => {
    await expect(
      lintCss('summary::-webkit-details-marker {\n  display: none;\n}\n'),
    ).resolves.toStrictEqual([])
  })

  it('should still report any other unknown pseudo-selector', async () => {
    await expect(lintCss('a::-foo {\n  color: red;\n}\n')).resolves.toContain(
      'unicorn/no-unknown-pseudo-selectors',
    )
  })
})

// Two fixers of one rule, adopted and refused for the same reason, so
// only a real `--fix` run can show the line holding: an out-of-order
// block has exactly one correct arrangement, while an orphan `@param`
// has two opposite corrections and must stay a human call.
describe('jsdoc param fixers', () => {
  it('should reorder param tags into signature order', async () => {
    const { output } = await lintJsdoc(`/**
 * Joins a building name to its device count.
 * @param count - How many devices the building holds.
 * @param name - The building's display name.
 * @returns The joined label.
 */
export const label = (name, count) => \`\${name} (\${count})\`
`)

    expect(output).toContain(`@param name - The building's display name.
 * @param count - How many devices the building holds.`)
  })

  it('should report an orphan param without removing it', async () => {
    const { output, ruleIds } = await lintJsdoc(`/**
 * Joins a building name to its device count.
 * @param name - The building's display name.
 * @param ghost - A parameter this function does not take.
 * @returns The joined label.
 */
export const label = (name) => \`\${name}\`
`)

    expect(ruleIds).toContain('jsdoc/check-param-names')
    expect(output).toBeUndefined()
  })
})

// The two DOM rules moved from the app preset to the shared table in
// 7.0.0, for the reason `no-alert` is there: homey-kit's webview sources
// compile under `lib: DOM` in a library-preset repo. The one that has
// only JSX and HTML visitors stays in the HTML block.
describe.each(presets)('the DOM rules via $presetName', ({ preset }) => {
  it('should carry the DOM rules in the main table', () => {
    const rules = mainRulesOf(preset)

    expect(rules['unicorn/no-unsafe-dom-html']).toBe('error')
    expect(rules['unicorn/require-post-message-target-origin']).toBe('error')
    expect(rules['unicorn/no-invalid-file-input-accept']).toBeUndefined()
  })
})

describe(library, () => {
  it('should carry no webview floor anywhere', () => {
    // Plugin objects are circular; rule maps are the floor's only home.
    const allRuleIds = libraryPreset.flatMap((entry) =>
      Object.keys(entry.rules ?? {}),
    )

    expect(allRuleIds).not.toContain('no-restricted-properties')
    expect(allRuleIds).not.toContain('import-x/no-nodejs-modules')
    expect(allRuleIds.some((ruleId) => ruleId.startsWith('es-x/'))).toBe(false)
  })

  it('should route the polyfill through the sanctioned entry point', () => {
    const rules = mainRulesOf(libraryPreset)

    expect(JSON.stringify(rules['no-restricted-imports'])).toContain(
      'temporal-polyfill',
    )
  })

  it('should splice the wire naming entry into the convention', () => {
    const rules = mainRulesOf(libraryPreset)

    expect(
      JSON.stringify(rules['@typescript-eslint/naming-convention']),
    ).toContain('__brand')
  })

  it('should pin the main rule inventory', () => {
    expect(
      Object.keys(mainRulesOf(libraryPreset)).toSorted((first, second) =>
        first.localeCompare(second),
      ),
    ).toMatchSnapshot()
  })
})

// A real end-to-end run over an on-disk fixture: nothing short of it
// proves the whole chain (glob match, typed parser, default-project or
// fixture-tsconfig type info). Each fixture's failing twin is the
// mutation guard — a broken link in the chain reports zero messages
// and fails here.
const lintFixture = async (
  preset: typeof appPreset,
  fixturePath: string,
  file: string,
): Promise<(string | null)[]> => {
  const cwd = fileURLToPath(
    new URL(`../fixtures/${fixturePath}/`, import.meta.url),
  )
  const eslint = new ESLint({
    cwd,
    overrideConfig: [
      ...preset,
      // The `allowDefaultProject` globs resolve against
      // `tsconfigRootDir`, which defaults to the node process cwd —
      // the repo root for a consumer's lint run, pinned to the
      // fixture here. The spread restates the preset's parser options
      // rather than leaning on flat-config merge semantics.
      {
        languageOptions: {
          parserOptions: {
            ...mainLanguageOptions.parserOptions,
            tsconfigRootDir: cwd,
          },
        },
      },
    ],
    overrideConfigFile: true,
  })
  const results = await eslint.lintFiles([file])
  return results.flatMap(({ messages }) => messages.map(({ ruleId }) => ruleId))
}

// Real lint runs through the fixture project: the es-x iterator rules
// report only what type information proves to be an iterator, so the
// array `.map` on `Object.entries` stays legal (or the floor rejects the
// idiom it exists to allow), and only a run shows the `v` flag reported
// ONCE — by `require-unicode-regexp`, es-x's twin being off — and a
// feature the iOS 16.4 WebKit ships passing through an off.
describe('webview floor', () => {
  it.each([
    {
      file: 'with-resolvers.mts',
      ruleId: 'es-x/no-promise-withresolvers',
      shape: '`Promise.withResolvers()`',
    },
    {
      file: 'group-by.mts',
      ruleId: 'es-x/no-object-groupby',
      shape: '`Object.groupBy()`',
    },
    {
      file: 'iterator-helper.mts',
      ruleId: 'es-x/no-iterator-prototype-map',
      shape: 'a helper on a Map iterator',
    },
    {
      file: 'abort-any.mts',
      ruleId: 'no-restricted-properties',
      shape: '`AbortSignal.any()`',
    },
    {
      file: 'node-import.mts',
      ruleId: 'import-x/no-nodejs-modules',
      shape: 'a `node:` import',
    },
    {
      file: 'v-flag.mts',
      ruleId: 'require-unicode-regexp',
      shape: 'the `v` regex flag, once',
    },
  ])('should report $shape', { timeout: 60_000 }, async ({ file, ruleId }) => {
    await expect(
      lintFixture(appPreset, 'floor', `settings/${file}`),
    ).resolves.toStrictEqual([ruleId])
  })

  it.each([
    { file: 'array-map.mts', shape: 'array helpers on `Object.entries`' },
    {
      file: 'well-formed.mts',
      shape: '`String#isWellFormed`, which the iOS 16.4 WebKit ships',
    },
  ])('should leave $shape alone', { timeout: 60_000 }, async ({ file }) => {
    await expect(
      lintFixture(appPreset, 'floor', `settings/${file}`),
    ).resolves.toStrictEqual([])
  })
})

// Zero-warning policy, made mechanical: a preset's `warn` is raised in
// the tables or the rule is off with a reason, never left as a warning
// nobody gates. Resolved from the fixture root, where the
// `allowDefaultProject` globs have a project to resolve against.
describe('zero-warning policy', () => {
  it.each(representativeCases)(
    'should resolve $file to no rule at warn via $presetName',
    { timeout: 60_000 },
    async ({ file, preset }) => {
      const rules = await resolveRules(preset, file)

      expect(warnRules(rules)).toStrictEqual([])
    },
  )
})

// What the presets RESOLVE to, file by file — the layer where an extended
// preset's value and the family table's meet.
describe.each(presets)('resolved config via $presetName', ({ preset }) => {
  // `no-this-alias` (recommended and strict) owns what unicorn's twin
  // would report twice.
  it(
    'should leave this-aliasing to the typescript-eslint owner',
    { timeout: 60_000 },
    async () => {
      const rules = await resolveRules(preset, 'src/index.ts')

      expect(severityOf(rules['@typescript-eslint/no-this-alias'])).toBe(2)
      expect(severityOf(rules['unicorn/no-this-assignment'])).toBe(0)
    },
  )

  // The regexp preset sets a bare `'error'`; the family table's option
  // must survive it, which is why the preset is extended before the
  // table applies.
  it(
    'should keep the prefer-regex-literals option over the regexp preset',
    { timeout: 60_000 },
    async () => {
      const rules = await resolveRules(preset, 'src/index.ts')

      expect(rules['prefer-regex-literals']).toStrictEqual([
        2,
        { disallowRedundantWrapping: true },
      ])
    },
  )

  // The test block restates `no-shadow` to allow the destructured
  // `expect`; it must restate the whole option, `hoist: 'all'` included,
  // or the block silently loosens to the rule's default.
  it(
    'should keep hoist all in the test block',
    { timeout: 60_000 },
    async () => {
      const rules = await resolveRules(preset, 'tests/unit/x.test.ts')

      expect(rules['@typescript-eslint/no-shadow']).toStrictEqual([
        2,
        expect.objectContaining({ builtinGlobals: true, hoist: 'all' }),
      ])
    },
  )
})

describe.each(presets)(
  'root js config linting via $presetName',
  ({ preset }) => {
    it(
      'should type-lint a root js config through the default project',
      { timeout: 60_000 },
      async () => {
        await expect(
          lintFixture(preset, 'config-js/invalid', 'typedoc.config.js'),
        ).resolves.toContain('@typescript-eslint/no-floating-promises')
      },
    )

    it(
      'should keep a conforming js config clean',
      { timeout: 60_000 },
      async () => {
        await expect(
          lintFixture(preset, 'config-js/valid', 'typedoc.config.js'),
        ).resolves.toStrictEqual([])
      },
    )
  },
)

// The import rules resolve through `eslint-import-resolver-typescript`,
// which no file names: `importXConfigs.typescript` sets
// `settings['import-x/resolver']` to `{ typescript: true }` and import-x
// loads the package from that name. A `.js` specifier standing for a
// `.ts` neighbour — the `nodenext` form the libraries write — is what
// the node fallback cannot follow, so the resolving half fails without
// the package (every import then reports a resolve error) and the
// missing-module half proves the rule still reports through it. The
// resolving half demands a fully clean run rather than the absence of
// one rule: a parse failure or a misnamed path reports no rule either.
// The app family writes the real extension instead
// (`rewriteRelativeImportExtensions`), which `import-x/extensions` holds
// since 7.0.0 — so on the `.js` stand-in the app preset reports that one
// rule, naming the `.ts` the resolver reached: a report that could not
// exist without the resolution, and the only one.
describe('import resolution', () => {
  it.each([
    {
      file: 'resolved.ts',
      preset: libraryPreset,
      presetName: 'library',
      reports: [],
    },
    {
      file: 'resolved-app.ts',
      preset: appPreset,
      presetName: 'homeyApp',
      reports: [],
    },
    {
      file: 'resolved.ts',
      preset: appPreset,
      presetName: 'homeyApp',
      reports: ['import-x/extensions'],
    },
  ])(
    'should resolve $file to its ts neighbour via $presetName',
    { timeout: 60_000 },
    async ({ file, preset, reports }) => {
      await expect(
        lintFixture(preset, 'resolver', file),
      ).resolves.toStrictEqual(reports)
    },
  )

  it.each(presets)(
    'should still report a module that exists under no extension via $presetName',
    { timeout: 60_000 },
    async ({ preset }) => {
      await expect(
        lintFixture(preset, 'resolver', 'unresolved.ts'),
      ).resolves.toContain('import-x/no-unresolved')
    },
  )
})

// `prefer-ternary` at the preset's `always` is pinned by what it DOES:
// a guard clause that selects a value is reported whether the value
// spans lines or not, and the readability boundary the setting relies
// on holds — a guard whose fall-through already holds a ternary is
// left alone rather than nested.
describe.each(presets)(
  'prefer-ternary at the preset default via $presetName',
  ({ preset }) => {
    it.each([
      { file: 'guard.ts', shape: 'a guard clause with a multi-line value' },
      { file: 'one-line.ts', shape: 'a one-line if/else' },
    ])('should report $shape', { timeout: 60_000 }, async ({ file }) => {
      await expect(lintFixture(preset, 'ternary', file)).resolves.toContain(
        'unicorn/prefer-ternary',
      )
    })

    it(
      'should leave a guard alone when merging would nest ternaries',
      { timeout: 60_000 },
      async () => {
        await expect(
          lintFixture(preset, 'ternary', 'nested.ts'),
        ).resolves.not.toContain('unicorn/prefer-ternary')
      },
    )
  },
)

const namingRule = '@typescript-eslint/naming-convention'

describe('strict naming core', () => {
  it(
    'should accept capability-shaped keys under homeyApp only',
    { timeout: 60_000 },
    async () => {
      await expect(
        lintFixture(appPreset, 'naming', 'capability.ts'),
      ).resolves.not.toContain(namingRule)
      await expect(
        lintFixture(libraryPreset, 'naming', 'capability.ts'),
      ).resolves.toContain(namingRule)
    },
  )

  it.each(presets)(
    'should reject mixed-case and underscore properties via $presetName',
    { timeout: 60_000 },
    async ({ preset }) => {
      await expect(
        lintFixture(preset, 'naming', 'strict-property.ts'),
      ).resolves.toContain(namingRule)
      await expect(
        lintFixture(preset, 'naming', 'underscore-property.ts'),
      ).resolves.toContain(namingRule)
    },
  )

  // Config files hold the core plus one tool-imposed shape: typedoc keys
  // its maps by exported symbol names and rendered labels, PascalCase
  // (`GitHub` passes); a snake_case key of ours still reports.
  it.each(presets)(
    'should hold config keys to the core, PascalCase names excepted, via $presetName',
    { timeout: 60_000 },
    async ({ preset }) => {
      await expect(
        lintFixture(preset, 'config-js/naming', 'typedoc.config.js'),
      ).resolves.toStrictEqual([namingRule])
    },
  )
})

// Both fixtures carry the same `Legacy_key`: one stands where the wire
// vocabulary is declared, the other anywhere else. Narrowing must move
// the second from accepted to rejected, or the option is decorative.
const wireEntries = [
  {
    filter: { match: true, regex: '^Legacy_key$' },
    format: null,
    selector: 'objectLiteralProperty',
  },
]

describe('scoped wire vocabulary', () => {
  it.each([
    { build: homeyAppWith, presetName: 'homeyApp' },
    { build: libraryWith, presetName: 'library' },
  ])(
    'should leave $presetName untouched when no files are named',
    ({ build }) => {
      const repoWide = build(wireEntries)

      expect(build(wireEntries, [])).toHaveLength(repoWide.length)
      expect(build(wireEntries, ['wire-property.ts'])).toHaveLength(
        repoWide.length + 1,
      )
    },
  )

  it.each([
    { build: homeyAppWith, presetName: 'homeyApp' },
    { build: libraryWith, presetName: 'library' },
  ])(
    'should confine the $presetName wire vocabulary to its own files',
    { timeout: 60_000 },
    async ({ build }) => {
      const repoWide = build(wireEntries)
      const scoped = build(wireEntries, ['wire-property.ts'])

      await expect(
        lintFixture(repoWide, 'naming', 'strict-property.ts'),
      ).resolves.not.toContain(namingRule)

      await expect(
        lintFixture(scoped, 'naming', 'wire-property.ts'),
      ).resolves.not.toContain(namingRule)

      await expect(
        lintFixture(scoped, 'naming', 'strict-property.ts'),
      ).resolves.toContain(namingRule)
    },
  )
})

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import type { Config } from 'eslint/config'
import { ESLint, Linter } from 'eslint'
import { format } from 'prettier'
import { describe, expect, it } from 'vitest'

import { homeyApp } from '../../src/eslint/homey-app.ts'
import { library } from '../../src/eslint/library.ts'
import { jsdocBlock, mainLanguageOptions } from '../../src/eslint/shared.ts'

// Throws instead of narrowing conditionally: the vitest rules ban
// conditional logic inside tests.
const parseRecord = (raw: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new TypeError('expected a JSON object')
  }
  return { ...parsed }
}

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

const floorEntry = appPreset.find(
  (entry) =>
    entry.rules !== undefined &&
    Object.hasOwn(entry.rules, 'no-restricted-syntax') &&
    entry.files?.includes('settings/**/*.mts') === true,
)

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

  // Real lint runs, because the floor is a selector string: only the
  // parser can say what it matches. `String#matchAll` returns an
  // iterator, so helpers chained onto it are 2025-era too — the
  // selector missed it until a consumer's hand-copied floor proved it
  // did. `Object.entries` returns an array, so its `.map` is ES5 and
  // must stay legal, or the floor rejects the idiom it exists to allow.
  it.each([
    { code: 'items.entries().map(toRow)', expected: 'Iterator helpers' },
    { code: 'text.matchAll(/x/u).map(toRow)', expected: 'Iterator helpers' },
    { code: 'const re = /x/v', expected: 'regex flag' },
  ])('should flag `$code`', ({ code, expected }) => {
    const linter = new Linter()
    const report = linter.verify(`${code}\n`, {
      rules: {
        'no-restricted-syntax':
          floorEntry?.rules?.['no-restricted-syntax'] ?? 'off',
      },
    })

    expect(report).toHaveLength(1)
    expect(report[0]?.message).toContain(expected)
  })

  it('should leave array helpers on Object.entries alone', () => {
    const linter = new Linter()
    const report = linter.verify('Object.entries(source).map(toRow)\n', {
      rules: {
        'no-restricted-syntax':
          floorEntry?.rules?.['no-restricted-syntax'] ?? 'off',
      },
    })

    expect(report).toHaveLength(0)
  })

  it('should keep the DOM rules that only apply to webview code', () => {
    const rules = mainRulesOf(appPreset)

    expect(rules['unicorn/no-unsafe-dom-html']).toBe('error')
    expect(rules['unicorn/require-post-message-target-origin']).toBe('error')
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

describe(library, () => {
  it('should carry no webview floor anywhere', () => {
    // Plugin objects are circular; rule maps are the floor's only home.
    const allRuleIds = libraryPreset.flatMap((entry) =>
      Object.keys(entry.rules ?? {}),
    )

    expect(allRuleIds).not.toContain('no-restricted-properties')
    expect(
      mainRulesOf(libraryPreset)['unicorn/no-unsafe-dom-html'],
    ).toBeUndefined()
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

describe.each([
  { preset: appPreset, presetName: 'homeyApp' },
  { preset: libraryPreset, presetName: 'library' },
])('root js config linting via $presetName', ({ preset }) => {
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
})

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

  it.each([
    { preset: appPreset, presetName: 'homeyApp' },
    { preset: libraryPreset, presetName: 'library' },
  ])(
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

describe('tsconfig bases', () => {
  it.each(['app', 'app-build', 'library', 'library-build'])(
    'should parse %s.json',
    async (name) => {
      const raw = await readFile(
        new URL(`../../tsconfig-bases/${name}.json`, import.meta.url),
        'utf8',
      )

      expect(() => parseRecord(raw)).not.toThrow()
    },
  )

  it.each(['app', 'library'])(
    'should keep outDir out of the %s base',
    async (name) => {
      const raw = await readFile(
        new URL(`../../tsconfig-bases/${name}.json`, import.meta.url),
        'utf8',
      )

      // Paths in an extended tsconfig resolve relative to the BASE
      // file: an outDir here would emit inside node_modules for every
      // consumer.
      expect(parseRecord(raw).compilerOptions).not.toHaveProperty('outDir')
    },
  )
})

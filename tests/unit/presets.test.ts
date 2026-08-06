import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { ESLint, Linter } from 'eslint'
import { describe, expect, it } from 'vitest'

import { homeyApp } from '../../src/eslint/homey-app.ts'
import { library } from '../../src/eslint/library.ts'
import { mainLanguageOptions } from '../../src/eslint/shared.ts'

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

const libraryPreset = library({
  wireNamingEntries: [
    {
      filter: { match: true, regex: '^__brand$' },
      format: null,
      selector: 'typeProperty',
    },
  ],
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

describe(homeyApp, () => {
  it('should carry the webview floor on the given files only', () => {
    expect(floorEntry).toBeDefined()
    expect(floorEntry?.rules?.['require-unicode-regexp']).toStrictEqual([
      'error',
      { requireFlag: 'u' },
    ])
  })

  it('should flag an iterator helper through a real lint run', () => {
    const linter = new Linter()
    const report = linter.verify('items.entries().map(toRow)\n', {
      rules: {
        'no-restricted-syntax':
          floorEntry?.rules?.['no-restricted-syntax'] ?? 'off',
      },
    })

    expect(report).toHaveLength(1)
    expect(report[0]?.message).toContain('Iterator helpers')
  })

  it('should flag the v regex flag through a real lint run', () => {
    const linter = new Linter()
    const report = linter.verify('const re = /x/v\n', {
      rules: {
        'no-restricted-syntax':
          floorEntry?.rules?.['no-restricted-syntax'] ?? 'off',
      },
    })

    expect(report).toHaveLength(1)
    expect(report[0]?.message).toContain('regex flag')
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
// proves the whole `*.config.js` chain (glob match, typed parser,
// default-project type info). The invalid twin is the mutation guard —
// a broken link in that chain reports zero messages and fails here.
const lintConfigJsFixture = async (
  preset: typeof appPreset,
  fixture: string,
): Promise<(string | null)[]> => {
  const cwd = fileURLToPath(
    new URL(`../fixtures/config-js/${fixture}/`, import.meta.url),
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
  const results = await eslint.lintFiles(['typedoc.config.js'])
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
      await expect(lintConfigJsFixture(preset, 'invalid')).resolves.toContain(
        '@typescript-eslint/no-floating-promises',
      )
    },
  )

  it(
    'should keep a conforming js config clean',
    { timeout: 60_000 },
    async () => {
      await expect(lintConfigJsFixture(preset, 'valid')).resolves.toStrictEqual(
        [],
      )
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

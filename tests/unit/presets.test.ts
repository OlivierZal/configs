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

  // `String#matchAll` returns an iterator, so helpers chained onto it
  // are 2025-era too — the selector missed it until a consumer's
  // hand-copied floor proved it did.
  it('should flag a helper chained onto matchAll', () => {
    const linter = new Linter()
    const report = linter.verify('text.matchAll(/x/u).map(toRow)\n', {
      rules: {
        'no-restricted-syntax':
          floorEntry?.rules?.['no-restricted-syntax'] ?? 'off',
      },
    })

    expect(report).toHaveLength(1)
    expect(report[0]?.message).toContain('Iterator helpers')
  })

  // `Object.entries` returns an array: its `.map` is ES5 and must stay
  // legal, or the floor would reject the idiom it is meant to allow.
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

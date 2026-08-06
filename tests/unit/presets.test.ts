import { readFile } from 'node:fs/promises'

import { Linter } from 'eslint'
import { describe, expect, it } from 'vitest'

import { homeyApp } from '../../src/eslint/homey-app.ts'
import { library } from '../../src/eslint/library.ts'

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

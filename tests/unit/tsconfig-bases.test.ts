import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import { repoRoot } from '../helpers.ts'
import packageJson from '../../package.json' with { type: 'json' }

const basesDir = path.join(repoRoot, 'tsconfig-bases')
const fixturesDir = path.join(repoRoot, 'tests/fixtures/tsconfig-build')

// The whole tsconfig surface: one base per family, one subpath each.
// The `-build` aliases that used to double them were content-free
// shells (`{ extends }` of these two) and are gone — a consumer's build
// config extends its own tsconfig.json, which names the base once.
const bases = ['app', 'library']

interface ResolvedTsconfig {
  readonly compilerOptions?: { readonly strict?: boolean }
  readonly files?: readonly string[]
}

// Throws instead of narrowing conditionally: the vitest rules ban
// conditional logic inside tests.
const parseRecord = (raw: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new TypeError('expected a JSON object')
  }
  return { ...parsed }
}

const readBase = async (base: string): Promise<Record<string, unknown>> =>
  parseRecord(await readFile(path.join(basesDir, `${base}.json`), 'utf8'))

// A real consumer resolution: the fixture projects extend the bases
// through the package name, resolved via a node_modules symlink to
// this repo — the exact shape an adopting repo sees.
const showConfig = (project: string): ResolvedTsconfig =>
  parseRecord(
    execFileSync(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules/@typescript/native/bin/tsc'),
        '--showConfig',
        '--project',
        path.join(fixturesDir, project),
      ],
      { encoding: 'utf8' },
    ),
  )

describe('the tsconfig bases', () => {
  beforeAll(() => {
    const scopeDir = path.join(fixturesDir, 'node_modules/@olivierzal')
    rmSync(path.join(fixturesDir, 'node_modules'), {
      force: true,
      recursive: true,
    })
    mkdirSync(scopeDir, { recursive: true })
    symlinkSync(repoRoot, path.join(scopeDir, 'configs'))
  })

  // Both directions at once: a base on disk that no subpath publishes
  // is dead weight in the tarball, and a subpath naming no base is a
  // consumer resolution error. Either drift fails here.
  it('should publish exactly the bases on disk', () => {
    expect(
      Object.entries(packageJson.exports).filter(([subpath]) =>
        subpath.startsWith('./tsconfig/'),
      ),
    ).toStrictEqual(
      bases.map((base) => [
        `./tsconfig/${base}`,
        `./tsconfig-bases/${base}.json`,
      ]),
    )
    expect(
      readdirSync(basesDir).toSorted((first, second) =>
        first.localeCompare(second),
      ),
    ).toStrictEqual(bases.map((base) => `${base}.json`))
  })

  it.each(bases)('should parse the %s base', async (base) => {
    await expect(readBase(base)).resolves.toHaveProperty('compilerOptions')
  })

  // Paths in an extended tsconfig resolve relative to the BASE file
  // (node_modules for a consumer): an outDir here would emit inside
  // node_modules for every consumer, and an include would resolve an
  // empty file list. Path-bearing options stay consumer-side.
  it.each(bases)(
    'should keep path options out of the %s base',
    async (base) => {
      const { compilerOptions } = await readBase(base)

      expect(compilerOptions).not.toHaveProperty('outDir')
      expect(compilerOptions).not.toHaveProperty('rootDir')
      await expect(readBase(base)).resolves.not.toHaveProperty('include')
    },
  )

  it.each(bases)(
    'should resolve a non-empty file list for a %s consumer',
    (project) => {
      const resolved = showConfig(project)

      expect(resolved.files).toBeDefined()
      expect(resolved.files?.length).toBeGreaterThan(0)
      expect(JSON.stringify(resolved.files)).toContain('index.ts')
      expect(resolved.compilerOptions?.strict).toBe(true)
    },
  )
})

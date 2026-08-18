import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const fixturesDir = fileURLToPath(
  new URL('../fixtures/tsconfig-build/', import.meta.url),
)

interface ResolvedTsconfig {
  readonly compilerOptions?: { readonly strict?: boolean }
  readonly files?: readonly string[]
}

const parseTsconfig = (raw: string): ResolvedTsconfig => {
  const parsed: unknown = JSON.parse(raw)
  if (typeof parsed !== 'object' || parsed === null) {
    throw new TypeError('expected a JSON object')
  }
  return parsed
}

// A real consumer resolution: the fixture projects extend the bases
// through the package name, resolved via a node_modules symlink to
// this repo — the exact shape an adopting repo sees.
const showConfig = (project: string): ResolvedTsconfig =>
  parseTsconfig(
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

describe('the -build tsconfig bases', () => {
  beforeAll(() => {
    const scopeDir = path.join(fixturesDir, 'node_modules/@olivierzal')
    rmSync(path.join(fixturesDir, 'node_modules'), {
      force: true,
      recursive: true,
    })
    mkdirSync(scopeDir, { recursive: true })
    symlinkSync(repoRoot, path.join(scopeDir, 'configs'))
  })

  // Paths in an extended tsconfig resolve relative to the base file
  // (node_modules for a consumer), so the -build bases must stay pure
  // extends shells — any option added here needs a conscious verdict.
  it.each(['app', 'library'])(
    'should keep the %s-build base a pure extends shell',
    async (base) => {
      expect(
        JSON.parse(
          await readFile(
            path.join(repoRoot, `tsconfig-bases/${base}-build.json`),
            'utf8',
          ),
        ),
      ).toStrictEqual({ extends: `@olivierzal/configs/tsconfig/${base}` })
    },
  )

  it.each(['app', 'library'])(
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

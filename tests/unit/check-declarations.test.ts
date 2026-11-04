import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { type RunResult, repoRoot, runScript } from '../helpers.ts'

const fixturesDir = path.join(repoRoot, 'tests/fixtures/declarations')
const script = path.join(repoRoot, 'scripts/check-declarations.sh')

// The fixtures drive the script through its `DECLARATION_FILES` seam —
// they have no main program to list — and through `TSC`, this repo's
// own compiler: the resolution and the file listing are the real ones.
const check = (fixture: string, files: readonly string[]): RunResult =>
  runScript(script, {
    args: [path.join(fixturesDir, fixture)],
    env: {
      ...process.env,
      DECLARATION_FILES: files.join('\n'),
      TSC: path.join(repoRoot, 'node_modules/@typescript/native/bin/tsc'),
    },
  })

// Without the seam the script lists the fixture's own main program —
// the path every consumer takes.
const checkProgram = (fixture: string): RunResult =>
  runScript(script, {
    args: [path.join(fixturesDir, fixture)],
    env: {
      ...process.env,
      TSC: path.join(repoRoot, 'node_modules/@typescript/native/bin/tsc'),
    },
  })

describe('the declaration check', () => {
  it('reads the declaration files out of the main program', () => {
    const { output, status } = checkProgram('main-program')

    expect(status).toBe(0)
    expect(output).toContain(
      'checked 1 declaration file(s) of this repository through tsconfig.declarations.json',
    )
  })

  // A main program that does not resolve lists nothing, which must not
  // read as a repository with nothing to prove.
  it('reports a main program that does not resolve instead of passing', () => {
    const { output, status } = checkProgram('broken-main')

    expect(status).toBe(1)
    expect(output).toContain('tsconfig.json does not resolve')
  })

  it('has nothing to prove for a program that loads no declaration file of its own', () => {
    const { output, status } = check('none', [])

    expect(status).toBe(0)
    expect(output).toContain('no declaration file of this repository')
  })

  it('accepts a program that reaches every declaration file', () => {
    const { output, status } = check('covered', ['types.d.ts'])

    expect(status).toBe(0)
    expect(output).toContain(
      'checked 1 declaration file(s) of this repository through tsconfig.declarations.json',
    )
  })

  // One fixture per way the protection can be absent while the file
  // exists: no program, a program the gate never runs, a program that
  // skips what it was made to check, one that would emit, and an
  // include that misses a file — the silent case the check exists for.
  it.each([
    {
      expected: 'of this repository but no tsconfig.declarations.json',
      files: ['types.d.ts'],
      fixture: 'no-program',
    },
    {
      expected: '`typecheck` does not run tsconfig.declarations.json',
      files: ['types.d.ts'],
      fixture: 'unchained',
    },
    {
      expected: 'resolves skipLibCheck to true',
      files: ['types.d.ts'],
      fixture: 'lib-check-on',
    },
    { expected: 'does not set noEmit', files: ['types.d.ts'], fixture: 'emit' },
    {
      expected: 'other.d.ts is not in the tsconfig.declarations.json program',
      files: ['types.d.ts', 'other.d.ts'],
      fixture: 'uncovered',
    },
  ])('rejects $fixture', ({ expected, files, fixture }) => {
    const { output, status } = check(fixture, files)

    expect(status).toBe(1)
    expect(output).toContain(expected)
  })
})

import { type SpawnSyncReturns, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const fixturesDir = path.join(repoRoot, 'tests/fixtures/pins')
const script = path.join(repoRoot, 'scripts/check-pins.sh')

interface CheckResult {
  readonly output: string
  readonly status: number
}

const isSpawnError = (error: unknown): error is SpawnSyncReturns<string> =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  'stderr' in error

// The fixtures drive the script through its `PIN_CHECK_REFS` seam, so
// the suite never reaches the network: the fake ref table names both an
// annotated tag (commit under `^{}`) and a lightweight one.
const check = (fixture: string): CheckResult => {
  try {
    return {
      output: execFileSync(script, [path.join(fixturesDir, fixture)], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PIN_CHECK_REFS: path.join(fixturesDir, 'refs.tsv'),
        },
      }),
      status: 0,
    }
  } catch (error) {
    if (isSpawnError(error)) {
      return { output: error.stderr, status: error.status ?? 1 }
    }
    throw error
  }
}

describe('the pin check', () => {
  it('accepts pins whose comment resolves to the pinned commit', () => {
    const { output, status } = check('valid')

    expect(status).toBe(0)
    // Annotated tag, lightweight tag and the configs workflow ref. The
    // local `./` reference is not a pin, and neither is a `uses:` that
    // sits in a comment or a `run:` body — the fixture carries both.
    expect(output).toContain('checked 3 pinned reference(s)')
  })

  // One fixture per way a comment can lie. The trailing-text case is
  // the subtle one: Dependabot leaves a comment alone unless the
  // version ends the line, so prose would freeze it silently.
  it.each([
    { expected: 'no version comment', fixture: 'missing-comment' },
    {
      expected: '`v0.9.0` is 33333333, but the pin is 22222222',
      fixture: 'wrong-tag',
    },
    { expected: 'has no tag `v7.7.7`', fixture: 'unknown-tag' },
    { expected: 'carries trailing text', fixture: 'trailing-text' },
    {
      expected: 'one version covers both channels',
      fixture: 'channel-mismatch',
    },
  ])('rejects the $fixture fixture', ({ expected, fixture }) => {
    const { output, status } = check(fixture)

    expect(status).toBe(1)
    expect(output).toContain(expected)
  })
})

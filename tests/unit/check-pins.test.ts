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
    // Annotated tag, lightweight tag and the configs workflow ref; the
    // local `./` reference is not a pin and is not counted.
    expect(output).toContain('checked 3 pinned reference(s)')
  })

  it('rejects a SHA pin carrying no version comment', () => {
    const { output, status } = check('missing-comment')

    expect(status).toBe(1)
    expect(output).toContain('no version comment')
  })

  it('rejects a comment naming a tag that points elsewhere', () => {
    const { output, status } = check('wrong-tag')

    expect(status).toBe(1)
    expect(output).toContain('`v0.9.0` is 33333333, but the pin is 22222222')
  })

  it('rejects a comment naming a tag the upstream does not have', () => {
    const { output, status } = check('unknown-tag')

    expect(status).toBe(1)
    expect(output).toContain('has no tag `v7.7.7`')
  })

  // Dependabot leaves a comment alone unless the version ends the line,
  // so trailing prose would freeze the version silently.
  it('rejects a comment with trailing text', () => {
    const { output, status } = check('trailing-text')

    expect(status).toBe(1)
    expect(output).toContain('carries trailing text')
  })

  it('rejects a configs ref disagreeing with the npm pin', () => {
    const { output, status } = check('channel-mismatch')

    expect(status).toBe(1)
    expect(output).toContain('one version covers both channels')
  })
})

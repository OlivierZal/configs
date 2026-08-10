import { type SpawnSyncReturns, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const script = path.join(repoRoot, 'scripts/check-coverage-leg.sh')

const leg = (version: string): string => `{"node-version": "${version}"}`
const coverageLeg = (version: string): string =>
  `{"node-version": "${version}", "coverage": true}`

interface CheckResult {
  readonly output: string
  readonly status: number
}

const isSpawnError = (error: unknown): error is SpawnSyncReturns<string> =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  'stderr' in error

const check = (versions: string): CheckResult => {
  try {
    return {
      output: execFileSync(script, [versions], { encoding: 'utf8' }),
      status: 0,
    }
  } catch (error) {
    if (isSpawnError(error)) {
      return { output: error.stderr, status: error.status ?? 1 }
    }
    throw error
  }
}

// Throws instead of narrowing conditionally: the vitest rules ban
// conditional logic inside tests.
const asRecord = (value: unknown, what: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`expected ${what} to be a mapping`)
  }
  return { ...value }
}

const asString = (value: unknown, what: string): string => {
  if (typeof value !== 'string') {
    throw new TypeError(`expected ${what} to be a string`)
  }
  return value
}

const isSequence = (value: unknown): value is readonly unknown[] =>
  Array.isArray(value)

const asArray = (value: unknown, what: string): readonly unknown[] => {
  if (!isSequence(value)) {
    throw new TypeError(`expected ${what} to be a sequence`)
  }
  return value
}

const workflow = asRecord(
  parse(
    readFileSync(
      path.join(repoRoot, '.github/workflows/reusable-ci.yml'),
      'utf8',
    ),
  ),
  'reusable-ci.yml',
)
const jobs = asRecord(workflow.jobs, 'jobs')
const inputs = asRecord(
  asRecord(asRecord(workflow.on, 'on').workflow_call, 'workflow_call').inputs,
  'inputs',
)

const defaultOf = (name: string): string =>
  asString(asRecord(inputs[name], name).default, `${name}.default`)

const testJob = asRecord(jobs.test, 'test')
const checkSteps = asArray(asRecord(jobs.check, 'check').steps, 'steps')
const testSteps = asArray(testJob.steps, 'test steps')

const ifsOf = (steps: readonly unknown[]): readonly string[] =>
  steps
    .map((step) => asRecord(step, 'step').if)
    .filter((condition) => typeof condition === 'string')

describe('the coverage-leg check', () => {
  it('accepts exactly one flagged leg', () => {
    const { output, status } = check(
      `[${coverageLeg('22.20')}, ${leg('latest')}]`,
    )

    expect(status).toBe(0)
    expect(output).toContain('coverage runs on the Node 22.20 leg')
  })

  // The one failure the new shape cannot make noisy: three green legs,
  // no coverage, no Sonar upload, and no missing context to notice.
  it('rejects a matrix where no leg is flagged', () => {
    const { output, status } = check(`[${leg('22')}, ${leg('latest')}]`)

    expect(status).toBe(1)
    expect(output).toContain('0 of 2 legs carry')
  })

  it('rejects a matrix where two legs are flagged', () => {
    const { output, status } = check(
      `[${coverageLeg('22')}, ${coverageLeg('latest')}]`,
    )

    expect(status).toBe(1)
    expect(output).toContain('2 of 2 legs carry')
  })

  // `coverage: "true"` is not `coverage: true`, and GitHub would read
  // the string as truthy — so the check has to agree with the workflow
  // on what marks a leg, not merely on the key being present.
  it('rejects a flag that is not the boolean true', () => {
    const { status } = check('[{"node-version": "22", "coverage": "true"}]')

    expect(status).toBe(1)
  })
})

describe('the reusable CI workflow', () => {
  // The whole point of the change: the flag lives inside the leg, so
  // there is no second input left to disagree with the matrix.
  it('builds its matrix from the node-versions input alone', () => {
    const matrix = asRecord(
      asRecord(testJob.strategy, 'strategy').matrix,
      'matrix',
    )

    expect(Object.keys(matrix)).toStrictEqual(['include'])
    expect(asString(matrix.include, 'include')).toMatch(
      /^\$\{\{\s*fromJSON\(inputs\.node-versions\)\s*\}\}$/v,
    )
  })

  it('declares no coverage-node-version input', () => {
    expect(Object.keys(inputs)).not.toContain('coverage-node-version')
  })

  // Selecting on the flag rather than on a comparison is what removes
  // the class; a step that went back to comparing two inputs would
  // reinstate it, whatever the rest of the condition says.
  it('selects coverage on the flag the leg carries', () => {
    const conditions = ifsOf(testSteps)

    expect(
      conditions.filter((condition) => condition.includes('matrix.coverage')),
    ).toHaveLength(3)
    expect(
      conditions.filter((condition) => condition.includes('node-version')),
    ).toStrictEqual([])
  })

  // Shipping the script without wiring it would leave the invariant
  // exactly as unguarded as before, and every other test here green.
  // Naming the script is not running it: the resolution assigns a path
  // and a separate line invokes it, so both halves are pinned or a
  // dropped invocation reads as wired.
  it('runs the check in the check job', () => {
    const runs = checkSteps
      .map((step) => asRecord(step, 'step').run)
      .filter((run) => typeof run === 'string')
      .join('\n')

    expect(runs).toContain('check-coverage-leg.sh')
    expect(runs).toMatch(/^\s*bash "\$script" "\$NODE_VERSIONS"$/mv)
  })

  // A caller that passes nothing still has to get coverage, so the
  // default is fed through the real check rather than eyeballed.
  it('declares a default that carries its own coverage leg', () => {
    const { status } = check(defaultOf('node-versions'))

    expect(status).toBe(0)
  })

  // Each entry names a required status check (`Test (Node <version>)`)
  // in seven rulesets: changing this list renames contexts that then
  // never report, and a required context that never reports blocks
  // every merge. Editing it here is legitimate — doing so unaware is not.
  it('keeps the leg names its callers require', () => {
    expect(
      asArray(JSON.parse(defaultOf('node-versions')), 'node-versions').map(
        (entry) => asRecord(entry, 'leg')['node-version'],
      ),
    ).toStrictEqual(['22', 'latest', 'lts/*'])
  })
})

import { type SpawnSyncReturns, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const script = path.join(repoRoot, 'scripts/check-coverage-leg.sh')

const DEFAULT_MATRIX = '["22", "latest", "lts/*"]'

interface CheckResult {
  readonly output: string
  readonly status: number
}

const isSpawnError = (error: unknown): error is SpawnSyncReturns<string> =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  'stderr' in error

const check = (versions: string, coverage: string): CheckResult => {
  try {
    return {
      output: execFileSync(script, [versions, coverage], { encoding: 'utf8' }),
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

const checkSteps = asArray(asRecord(jobs.check, 'check').steps, 'steps')

describe('the coverage-leg check', () => {
  it.each([
    { coverage: 'lts/*', versions: DEFAULT_MATRIX },
    // The reason the input exists: a repo whose runtime floor is a
    // specific minor names that minor, and coverage follows it there.
    { coverage: '22.20', versions: '["22.20", "latest", "lts/*"]' },
  ])('accepts $coverage against $versions', ({ coverage, versions }) => {
    const { output, status } = check(versions, coverage)

    expect(status).toBe(0)
    expect(output).toContain(`coverage runs on the Node ${coverage} leg`)
  })

  // The mutation this whole check exists for: today the workflow would
  // run three green legs, no coverage and no Sonar upload, and say
  // nothing. `Test (Node latest)` and SonarCloud are outside every
  // repo's required set, so nothing downstream would notice either.
  it('rejects a coverage version the matrix does not carry', () => {
    const { output, status } = check(DEFAULT_MATRIX, '22.20')

    expect(status).toBe(1)
    expect(output).toContain('names no leg of node-versions')
  })

  it.each([
    // A typo is the likeliest form of the same mistake.
    {
      coverage: 'lst/*',
      expected: 'names no leg of node-versions',
      versions: DEFAULT_MATRIX,
    },
    // `22.20` unquoted is the number 22.2: it would install the 22.2
    // line — a real Node release, three years older — and be compared
    // as a string that names no leg. Both failures from one pair of
    // missing quotes, so unquoted entries are refused outright.
    {
      coverage: '22.20',
      expected: 'installs and is compared as "22.2"',
      versions: '[22.20, "latest", "lts/*"]',
    },
    { coverage: '22', expected: 'not valid JSON', versions: 'lts/*' },
    {
      coverage: '22',
      expected: 'must be a non-empty JSON array',
      versions: '"22"',
    },
    {
      coverage: '22',
      expected: 'must be a non-empty JSON array',
      versions: '[]',
    },
    {
      coverage: '22',
      expected: 'holds an empty entry',
      versions: '["22", ""]',
    },
    {
      coverage: '',
      expected: 'coverage-node-version is empty',
      versions: DEFAULT_MATRIX,
    },
    { coverage: '22', expected: 'usage: check-coverage-leg.sh', versions: '' },
  ])(
    'rejects $versions against $coverage',
    ({ coverage, expected, versions }) => {
      const { output, status } = check(versions, coverage)

      expect(status).toBe(1)
      expect(output).toContain(expected)
    },
  )
})

describe('the reusable CI workflow', () => {
  it('builds its matrix from the node-versions input', () => {
    const { strategy } = asRecord(jobs.test, 'test')
    const matrix = asRecord(asRecord(strategy, 'strategy').matrix, 'matrix')

    expect(Object.keys(matrix)).toStrictEqual(['node-version'])
    expect(asString(matrix['node-version'], 'node-version')).toMatch(
      /^\$\{\{\s*fromJSON\(inputs\.node-versions\)\s*\}\}$/v,
    )
  })

  // Shipping the script without wiring it would leave the invariant
  // exactly as unguarded as before, and every other test here green.
  // The check job is the one that is a required context in all seven
  // repos, which is what makes the failure unmissable.
  // Naming the script is not running it: the resolution assigns a path
  // and a separate line invokes it, so both halves are pinned or a
  // dropped invocation reads as wired.
  it('runs the check in the check job', () => {
    const runs = checkSteps
      .map((step) => asRecord(step, 'step').run)
      .filter((run) => typeof run === 'string')
      .join('\n')

    expect(runs).toContain('check-coverage-leg.sh')
    expect(runs).toMatch(
      /^\s*bash "\$script" "\$NODE_VERSIONS" "\$COVERAGE_NODE_VERSION"$/mv,
    )
  })

  // A caller that passes neither input still has to get coverage, so
  // the two defaults are fed through the real check rather than eyeballed.
  it('declares defaults that agree with each other', () => {
    const { status } = check(
      defaultOf('node-versions'),
      defaultOf('coverage-node-version'),
    )

    expect(status).toBe(0)
  })

  // Each entry names a required status check (`Test (Node <entry>)`) in
  // seven rulesets: changing this list renames contexts that then never
  // report, and a required context that never reports blocks every
  // merge. Editing it here is legitimate — doing so unaware is not.
  it('keeps the leg names its callers require', () => {
    expect(JSON.parse(defaultOf('node-versions'))).toStrictEqual([
      '22',
      'latest',
      'lts/*',
    ])
  })
})

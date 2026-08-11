import { type SpawnSyncReturns, execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const gateScript = path.join(repoRoot, 'scripts/check-sonar-gate.sh')
// The opt-out cases need a directory with no sonar-project.properties:
// run from the repository root, the script would read this repo's own.
const scratch = mkdtempSync(path.join(os.tmpdir(), 'sonar-gate-'))
const inheritedPath = process.env.PATH ?? ''

const BOT = 'dependabot[bot]'

interface RunResult {
  readonly output: string
  readonly status: number
}

const isSpawnError = (error: unknown): error is SpawnSyncReturns<string> =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  'stderr' in error

const run = (
  script: string,
  env: Readonly<Record<string, string>> = {},
  cwd: string = repoRoot,
): RunResult => {
  try {
    return {
      output: execFileSync(script, [], {
        cwd,
        encoding: 'utf8',
        // A clean slate: the ambient SONAR_TOKEN of a developer machine
        // would otherwise decide which branch the gate takes.
        env: { PATH: inheritedPath, ...env },
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

const asArray = (value: unknown, what: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
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
const sonarJob = asRecord(jobs.sonar, 'sonar')

const stepsOf = (job: Readonly<Record<string, unknown>>): readonly unknown[] =>
  asArray(job.steps, 'steps')

describe('the unanalysed-pull-request branch', () => {
  const prEnv = {
    EVENT_NAME: 'pull_request',
    HEAD_REPO: 'OlivierZal/configs',
    PR_AUTHOR: BOT,
    PR_NUMBER: '7',
    THIS_REPO: 'OlivierZal/configs',
  }

  it('accepts a Dependabot pull request it has verified', () => {
    const { output, status } = run(gateScript, {
      ...prEnv,
      COMMIT_AUTHORS: BOT,
    })

    expect(status).toBe(0)
    expect(output).toContain('no analysable change went unread')
  })

  // Not hypothetical: the family's dependabot-fix workflow pushes
  // Claude's fixes onto these very branches, and that commit would
  // otherwise reach main having been read by no analysis at all.
  it('rejects a commit nobody analysed on a Dependabot branch', () => {
    const { output, status } = run(gateScript, {
      ...prEnv,
      COMMIT_AUTHORS: `${BOT}\nclaude[bot]`,
    })

    expect(status).toBe(1)
    expect(output).toContain('claude[bot]')
    expect(output).toContain('move it to its own pull request')
  })

  it.each([
    {
      env: { ...prEnv, HEAD_REPO: 'someone/configs', PR_AUTHOR: 'someone' },
      expected: 'receives no SONAR_TOKEN',
      what: 'a fork pull request',
    },
    {
      env: { EVENT_NAME: 'schedule', THIS_REPO: 'OlivierZal/configs' },
      expected: 'has no rule for it',
      what: 'an event with no rule',
    },
  ])('rejects $what', ({ env, expected }) => {
    const { output, status } = run(gateScript, env)

    expect(status).toBe(1)
    expect(output).toContain(expected)
  })

  it('refuses to run at all without a trigger', () => {
    const { output, status } = run(gateScript)

    expect(status).toBe(1)
    expect(output).toContain('EVENT_NAME is empty')
  })
})

// The analysed path is now a single question — did the scan get the
// token it needed to run at all? — because the scanner itself waits on
// the gate. An absent token is the one way the upload silently skips.
describe('the analysed path', () => {
  const pushEnv = {
    EVENT_NAME: 'push',
    SONAR_PROJECT_KEY: 'OlivierZal_configs',
    THIS_REPO: 'OlivierZal/configs',
  }

  it('accepts a run whose scan had its token', () => {
    const { output, status } = run(gateScript, {
      ...pushEnv,
      SONAR_TOKEN: 'test-token',
    })

    expect(status).toBe(0)
    expect(output).toContain('Olivierzal way')
  })

  // The upload step self-arms on the secret, so a missing token skips
  // the analysis rather than failing for it — green legs, no bar.
  it('rejects a run whose scan would have skipped', () => {
    const { output, status } = run(gateScript, pushEnv)

    expect(status).toBe(1)
    expect(output).toContain('the scan step skipped instead of running')
  })

  // Opting out is a written state, not a silence: a project without a
  // token is a deliberate abstention, a token without a project is a
  // misconfiguration that would otherwise read as a pass.
  it('accepts a repo that declared no project and holds no token', () => {
    const { output, status } = run(
      gateScript,
      { EVENT_NAME: 'push', THIS_REPO: 'OlivierZal/configs' },
      scratch,
    )

    expect(status).toBe(0)
    expect(output).toContain('no Sonar project is declared')
  })

  it('rejects a token with no project to verify', () => {
    const { output, status } = run(
      gateScript,
      {
        EVENT_NAME: 'push',
        SONAR_TOKEN: 'test-token',
        THIS_REPO: 'OlivierZal/configs',
      },
      scratch,
    )

    expect(status).toBe(1)
    expect(output).toContain('cannot name the project to verify')
  })
})

describe('the reusable CI workflow', () => {
  // Without `qualitygate.wait` the scanner uploads and returns green
  // whatever the gate then decides, and the bar becomes a dashboard.
  // This is the whole reason the verdict is no longer re-read here.
  it('makes the scanner wait on the gate it uploads to', () => {
    const scan = stepsOf(asRecord(jobs.test, 'test'))
      .map((step) => asRecord(step, 'step'))
      .find((step) =>
        asString(step.uses ?? '', 'uses').includes('sonarqube-scan-action'),
      )

    expect(
      asString(asRecord(scan?.with, 'scan.with').args, 'scan.args'),
    ).toContain('-Dsonar.qualitygate.wait=true')
  })

  // Shipping the script without wiring it would leave the unanalysed
  // case exactly as unguarded as before, with every other test green.
  // Naming the script is not running it: the resolution assigns a path
  // and a separate line invokes it, so both halves are pinned or a
  // dropped invocation reads as wired.
  it('runs the gate in a job of its own', () => {
    const runs = stepsOf(sonarJob)
      .map((step) => asRecord(step, 'step').run)
      .filter((step) => typeof step === 'string')
      .join('\n')

    expect(runs).toContain('check-sonar-gate.sh')
    expect(runs).toMatch(/^\s*bash "\$script"$/mv)
  })

  // Load-bearing rather than ordering hygiene: a rejected gate fails
  // the coverage leg, and this job must not answer for a run whose
  // analysis never passed.
  it('speaks only after the leg that uploads the analysis', () => {
    expect(sonarJob.needs).toBe('test')
  })

  // The context name lands in seven rulesets; a rename makes a required
  // check that never reports, which blocks every merge in the family.
  it('keeps the context name its callers will require', () => {
    expect(asString(sonarJob.name, 'sonar.name')).toBe('Sonar')
  })

  // Authorship is read rather than inferred, which is what makes the
  // unanalysed branch a verification and not a guess. From git, not the
  // pulls API: a called job may not ask for a permission its caller
  // withholds, and requesting one fails the run before any step starts.
  it('reads the commit authors from history', () => {
    const script = stepsOf(sonarJob)
      .map((step) => asRecord(step, 'step').run)
      .filter((step) => typeof step === 'string')
      .join('\n')

    expect(script).toContain('git log')
  })

  // Authorship comes from the two sides of the merge commit, which are
  // only present with the full history.
  it('checks out both sides of the merge commit', () => {
    const depths = stepsOf(sonarJob)
      .map((step) => asRecord(asRecord(step, 'step').with ?? {}, 'with'))
      .map((entry) => entry['fetch-depth'])

    expect(depths).toContain(0)
  })

  // A caller grants `contents` and `packages`; anything beyond that is
  // an escalation GitHub refuses at startup, and it would refuse it for
  // all seven callers at once.
  it('asks for no permission its callers withhold', () => {
    expect(
      Object.keys(asRecord(sonarJob.permissions, 'permissions')),
    ).toStrictEqual(['contents', 'packages'])
  })
})

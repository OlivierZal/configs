import { type ChildProcess, spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  type RunResult,
  asArray,
  asRecord,
  asString,
  repoRoot,
  reusableCi,
  runScript,
} from '../helpers.ts'
import {
  ANALYSED_SHA,
  BRANCH_NAME,
  PULL_REQUEST_KEY,
  REJECTED_VALUES,
  TOKEN,
} from '../sonar-scenarios.ts'

const gateScript = path.join(repoRoot, 'scripts/check-sonar-gate.sh')
const stubScript = path.join(repoRoot, 'tests/sonar-stub.ts')
// The opt-out cases need a directory with no sonar-project.properties:
// run from the repository root, the script would read this repo's own.
const scratch = mkdtempSync(path.join(os.tmpdir(), 'sonar-gate-'))
const inheritedPath = process.env.PATH ?? ''

const BOT = 'dependabot[bot]'
const THIS_REPO = 'OlivierZal/configs'
// The read-back retries a transient failure after two seconds, then
// four: an outage that outlasts both takes six seconds to report.
const RETRY_TIMEOUT_MS = 15_000

const metricsOf = (window: 'new' | 'overall'): string[] =>
  Object.keys(REJECTED_VALUES).filter(
    (metric) => metric.startsWith('new_') === (window === 'new'),
  )

const run = (
  env: Readonly<Record<string, string>> = {},
  cwd: string = repoRoot,
): RunResult =>
  runScript(gateScript, {
    cwd,
    // A clean slate: the ambient SONAR_TOKEN of a developer machine
    // would otherwise decide which branch the gate takes.
    env: { PATH: inheritedPath, ...env },
  })

const jobs = asRecord(reusableCi.jobs, 'jobs')
const sonarJob = asRecord(jobs.sonar, 'sonar')

const stepsOf = (job: Readonly<Record<string, unknown>>): readonly unknown[] =>
  asArray(job.steps, 'steps')

describe('the unanalysed-pull-request branch', () => {
  const prEnv = {
    EVENT_NAME: 'pull_request',
    HEAD_REPO: THIS_REPO,
    HEAD_SHA: ANALYSED_SHA,
    PR_AUTHOR: BOT,
    PR_NUMBER: PULL_REQUEST_KEY,
    THIS_REPO,
  }

  it('accepts a Dependabot pull request it has verified', () => {
    const { output, status } = run({ ...prEnv, COMMIT_AUTHORS: BOT })

    expect(status).toBe(0)
    expect(output).toContain('no analysable change went unread')
  })

  // Not hypothetical: a fix pushed onto one of these branches by hand —
  // or by the dependabot-fix workflow 6.0.0 retired, whose success path
  // was exactly this — would otherwise reach main having been read by
  // no analysis at all.
  it('rejects a commit nobody analysed on a Dependabot branch', () => {
    const { output, status } = run({
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
      env: { EVENT_NAME: 'schedule', HEAD_SHA: ANALYSED_SHA, THIS_REPO },
      expected: 'has no rule for it',
      what: 'an event with no rule',
    },
  ])('rejects $what', ({ env, expected }) => {
    const { output, status } = run(env)

    expect(status).toBe(1)
    expect(output).toContain(expected)
  })

  it('refuses to run at all without a trigger', () => {
    const { output, status } = run()

    expect(status).toBe(1)
    expect(output).toContain('EVENT_NAME is empty')
  })

  // The bar is read on the analysis of ONE commit; without the commit
  // the read could be any run's.
  it('refuses to run without the commit to tie the bar to', () => {
    const { output, status } = run({ EVENT_NAME: 'push', THIS_REPO })

    expect(status).toBe(1)
    expect(output).toContain('HEAD_SHA is empty')
  })
})

// The analysed path reads from a stand-in SonarCloud (see
// `tests/sonar-stub.ts` for the scenario each project key plays).
describe('against a stand-in SonarCloud', () => {
  let stub: ChildProcess | undefined
  let sonarHost = ''

  beforeAll(async () => {
    // The stand-in's stdin is piped: it exits when this end closes, so a
    // killed worker leaves no server behind.
    stub = spawn(process.execPath, [stubScript], {
      stdio: ['pipe', 'pipe', 'inherit'],
    })
    const { stdout } = stub
    sonarHost = await new Promise((resolve, reject) => {
      stdout?.on('data', (chunk: Buffer) => {
        const port = /PORT=(?<port>\d+)/v.exec(chunk.toString())?.groups?.port
        if (port !== undefined) {
          resolve(`http://127.0.0.1:${port}`)
        }
      })
      stub?.on('error', reject)
      // A stand-in that dies before it listens prints no port: name the
      // exit instead of waiting on it.
      stub?.on('exit', (code) => {
        reject(new Error(`the stand-in exited with ${String(code)}`))
      })
    })
  })

  afterAll(() => {
    stub?.kill()
  })

  const analysedPullRequest = (
    project: string,
  ): Readonly<Record<string, string>> => ({
    EVENT_NAME: 'pull_request',
    HEAD_REPO: THIS_REPO,
    HEAD_SHA: ANALYSED_SHA,
    PR_AUTHOR: 'someone',
    PR_NUMBER: PULL_REQUEST_KEY,
    SONAR_HOST_URL: sonarHost,
    SONAR_PROJECT_KEY: project,
    SONAR_TOKEN: TOKEN,
    THIS_REPO,
  })

  const analysedPush = (
    project: string,
    overrides: Readonly<Record<string, string>> = {},
  ): Readonly<Record<string, string>> => ({
    BRANCH: BRANCH_NAME,
    EVENT_NAME: 'push',
    HEAD_SHA: ANALYSED_SHA,
    SONAR_HOST_URL: sonarHost,
    SONAR_PROJECT_KEY: project,
    SONAR_TOKEN: TOKEN,
    THIS_REPO,
    ...overrides,
  })

  // The analysed path asks two things: did the scan get the token it
  // needed to run at all (an absent token is the one way the upload
  // silently skips), and does the analysis it published meet the bar.
  describe('the analysed path', () => {
    it('accepts a run whose scan had its token and met the bar', () => {
      const { output, status } = run(analysedPush('best'))

      expect(status).toBe(0)
      expect(output).toContain('house bar holds')
    })

    // The upload step self-arms on the secret, so a missing token skips
    // the analysis rather than failing for it — green legs, no bar.
    it('rejects a run whose scan would have skipped', () => {
      const { output, status } = run(analysedPush('best', { SONAR_TOKEN: '' }))

      expect(status).toBe(1)
      expect(output).toContain('the scan step skipped instead of running')
    })

    // Opting out is a written state, not a silence: a project without a
    // token is a deliberate abstention, a token without a project is a
    // misconfiguration that would otherwise read as a pass.
    it('accepts a repo that declared no project and holds no token', () => {
      const { output, status } = run(
        { EVENT_NAME: 'push', HEAD_SHA: ANALYSED_SHA, THIS_REPO },
        scratch,
      )

      expect(status).toBe(0)
      expect(output).toContain('no Sonar project is declared')
    })

    it('rejects a token with no project to verify', () => {
      const { output, status } = run(
        {
          EVENT_NAME: 'push',
          HEAD_SHA: ANALYSED_SHA,
          SONAR_TOKEN: TOKEN,
          THIS_REPO,
        },
        scratch,
      )

      expect(status).toBe(1)
      expect(output).toContain('cannot name the project to verify')
    })
  })

  // The house bar, read back from the analysis the scanner published:
  // the platform's built-in gate is the Free plan's floor, so the
  // thresholds the `Olivierzal way` gate used to hold are enforced here.
  describe('the house bar', () => {
    // A pull request answers for the code it introduces: the overall
    // window is the branch's business.
    it('holds a pull request to its new code only', () => {
      const { output, status } = run(analysedPullRequest('short-violations'))

      expect(status).toBe(0)
      expect(output).toContain('house bar holds on pull request #7')
      expect(output).not.toContain('violations=3')
    })

    // The stand-in answers each scope with its own figures: the pull
    // request meets the bar, the branch does not, so the verdict says
    // which one the script read.
    it('reads the pull request scope for a pull request', () => {
      const { output, status } = run(analysedPullRequest('scoped'))

      expect(status).toBe(0)
      expect(output).toContain('house bar holds on pull request #7')
    })

    it('reads the branch scope for a push', () => {
      const { output, status } = run(analysedPush('scoped'))

      expect(status).toBe(1)
      expect(output).toContain('violations is 3, the bar is at most 0')
    })

    it.each(metricsOf('new'))(
      'rejects a pull request whose new code misses the bar on %s',
      (metric) => {
        const { output, status } = run(analysedPullRequest(`short-${metric}`))

        expect(status).toBe(1)
        expect(output).toContain(
          `${metric} is ${REJECTED_VALUES[metric] ?? ''}, the bar is`,
        )
      },
    )

    it.each([...metricsOf('new'), ...metricsOf('overall')])(
      'holds a branch to both windows, %s included',
      (metric) => {
        const { output, status } = run(analysedPush(`short-${metric}`))

        expect(status).toBe(1)
        expect(output).toContain(
          `${metric} is ${REJECTED_VALUES[metric] ?? ''}, the bar is`,
        )
      },
    )

    // A documentation-only change carries no line-derived figure: a
    // measure with no subject, not a measure that failed.
    it('lets an empty window through', () => {
      const { output, status } = run(analysedPullRequest('empty-window'))

      expect(status).toBe(0)
      expect(output).toContain('new_coverage: no measure (empty window)')
    })

    // A sibling run on the same branch may have published since the leg
    // uploaded: the measures must be this commit's or the verdict is
    // another run's.
    it("reads only this commit's analysis", () => {
      const { output, status } = run(
        analysedPush('best', { HEAD_SHA: 'f'.repeat(40) }),
      )

      expect(status).toBe(1)
      expect(output).toContain(ANALYSED_SHA)
      expect(output).toContain('re-run the workflow')
    })

    it('refuses a pull request nobody analysed', () => {
      const { output, status } = run(analysedPullRequest('unlisted'))

      expect(status).toBe(1)
      expect(output).toContain('no analysis of pull request #7 is published')
    })

    it(
      'retries a transient platform failure',
      () => {
        const { output, status } = run(analysedPush('flaky'))

        expect(status).toBe(0)
        expect(output).toContain('house bar holds')
      },
      RETRY_TIMEOUT_MS,
    )

    it(
      'gives up on an outage after three attempts',
      () => {
        const { output, status } = run(analysedPush('down'))

        expect(status).toBe(1)
        expect(output).toContain('HTTP 503 after 3 attempts')
      },
      RETRY_TIMEOUT_MS,
    )

    // The negative of the token test: a refused token is a verdict on
    // the request, not an outage.
    it('treats a refused token as a verdict, not an outage', () => {
      const { output, status } = run(
        analysedPush('authenticated', { SONAR_TOKEN: 'wrong' }),
      )

      expect(status).toBe(1)
      expect(output).toContain('project_branches/list: HTTP 401')
      expect(output).not.toContain('attempts')
    })

    // The platform's documented rate limit is an outage, not a verdict:
    // it gets the same attempts a 5xx does.
    it(
      'retries a rate-limited read',
      () => {
        const { output, status } = run(analysedPush('rate-limited'))

        expect(status).toBe(0)
        expect(output).toContain('house bar holds')
      },
      RETRY_TIMEOUT_MS,
    )

    // A 4xx is a verdict on the request, not an outage: no retry.
    it('fails at once on a refused request', () => {
      const { output, status } = run(analysedPush('forbidden'))

      expect(status).toBe(1)
      expect(output).toContain('HTTP 403')
      expect(output).not.toContain('attempts')
    })

    // The token is sent when set: a private project would read the same
    // way a public one does.
    it('sends the token it was given', () => {
      const { output, status } = run(analysedPush('authenticated'))

      expect(status).toBe(0)
      expect(output).toContain('house bar holds')
    })
  })
})

describe('the reusable CI workflow', () => {
  // Without `qualitygate.wait` the scanner uploads and returns green
  // before the analysis is processed; the read-back would then find the
  // previous analysis and refuse it on the commit check.
  it('makes the scanner wait on the analysis it uploads', () => {
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
    expect(runs).toMatch(/^ *bash "\$script"$/mv)
  })

  // Load-bearing rather than ordering hygiene: a rejected gate fails
  // the coverage leg, and this job must not answer for a run whose
  // analysis never passed.
  it('speaks only after the leg that uploads the analysis', () => {
    expect(sonarJob.needs).toBe('test')
  })

  // The context name lands in every ruleset in the family, this repo's
  // included; a rename makes a required check that never reports, which
  // blocks every merge in the family.
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

  // The analysis is tied to the pull request's head, which is what the
  // scanner reports, not to the merge commit the runner checks out.
  it('names the commit the analysis must be of', () => {
    const envs = stepsOf(sonarJob)
      .map((step) => asRecord(asRecord(step, 'step').env ?? {}, 'env'))
      .map((entry) => entry.HEAD_SHA)
      .filter((entry) => typeof entry === 'string')
      .join('\n')

    expect(envs).toMatch(
      /github\.event\.pull_request\.head\.sha \|\| github\.sha/v,
    )
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
  // every caller at once — each family repo's `ci.yml` stub and this
  // repo's own.
  it('asks for no permission its callers withhold', () => {
    expect(
      Object.keys(asRecord(sonarJob.permissions, 'permissions')),
    ).toStrictEqual(['contents', 'packages'])
  })
})

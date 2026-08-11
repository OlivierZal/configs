import {
  type SpawnSyncReturns,
  execFile,
  execFileSync,
} from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { type Server, createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const gateScript = path.join(repoRoot, 'scripts/check-sonar-gate.sh')
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
  args: readonly string[],
  env: Readonly<Record<string, string>> = {},
): RunResult => {
  try {
    return {
      output: execFileSync(script, [...args], {
        cwd: repoRoot,
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

// Named after its own content: identical payloads share a file and no
// counter has to be carried between calls.
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
const sonarJob = asRecord(asRecord(workflow.jobs, 'jobs').sonar, 'sonar')

describe('the unanalysed-pull-request branch', () => {
  const prEnv = {
    EVENT_NAME: 'pull_request',
    HEAD_REPO: 'OlivierZal/configs',
    PR_AUTHOR: BOT,
    PR_NUMBER: '7',
    THIS_REPO: 'OlivierZal/configs',
  }

  it('accepts a Dependabot pull request it has verified', () => {
    const { output, status } = run(gateScript, [], {
      ...prEnv,
      CHANGED_FILES:
        'package.json\npackage-lock.json\n.github/workflows/ci.yml',
      COMMIT_AUTHORS: BOT,
    })

    expect(status).toBe(0)
    expect(output).toContain('no analysable source changed')
  })

  // Not hypothetical: the family's dependabot-fix workflow pushes
  // Claude's fixes onto these very branches, and that commit would
  // otherwise reach main having been read by no analysis at all.
  it('rejects a commit nobody analysed on a Dependabot branch', () => {
    const { output, status } = run(gateScript, [], {
      ...prEnv,
      CHANGED_FILES: 'package.json',
      COMMIT_AUTHORS: `${BOT}\nclaude[bot]`,
    })

    expect(status).toBe(1)
    expect(output).toContain('claude[bot]')
    expect(output).toContain('move it to its own pull request')
  })

  it('rejects a file outside what Dependabot alone authors', () => {
    const { output, status } = run(gateScript, [], {
      ...prEnv,
      CHANGED_FILES: 'src/eslint/index.ts',
      COMMIT_AUTHORS: BOT,
    })

    expect(status).toBe(1)
    expect(output).toContain('src/eslint/index.ts')
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
    const { output, status } = run(gateScript, [], env)

    expect(status).toBe(1)
    expect(output).toContain(expected)
  })

  it('refuses to run at all without a trigger', () => {
    const { output, status } = run(gateScript, [])

    expect(status).toBe(1)
    expect(output).toContain('EVENT_NAME is empty')
  })
})

// Which window an event answers for is a decision no source assertion
// can prove: only a run shows which measures the gate actually asked
// SonarCloud for. So the API is stood up locally and its requests are
// recorded. `execFileSync` would deadlock against an in-process server,
// hence the async form.
const HEAD = 'c0ffee1c0ffee1c0ffee1c0ffee1c0ffee1c0ffee'

// Hand-wrapped rather than promisified: `execFile`'s callback is typed
// as value-returning, which the void-return rule rejects at the
// `promisify` call site.
const runAsync = async (
  script: string,
  env: Readonly<Record<string, string>>,
): Promise<string> =>
  new Promise((resolve, reject) => {
    execFile(
      script,
      [],
      { cwd: scratch, encoding: 'utf8', env },
      (error, stdout) => {
        if (error !== null) {
          reject(new Error(`${error.message}\n${stdout}`))
          return
        }
        resolve(stdout)
      },
    )
  })

const condition = (
  metricKey: string,
  actualValue: string,
  status: string,
): Readonly<Record<string, string>> => ({
  actualValue,
  comparator: 'GT',
  errorThreshold: '0',
  metricKey,
  status,
})

// The three answers SonarCloud can give, which are the three outcomes
// this gate must never blur.
const GATE_OK = {
  conditions: [condition('new_violations', '0', 'OK')],
  status: 'OK',
}
const GATE_ERROR = {
  conditions: [condition('new_violations', '3', 'ERROR')],
  status: 'ERROR',
}
const GATE_NO_VERDICT = {}

const bodyFor = (url: string, projectStatus: unknown): string => {
  if (url.startsWith('/project_pull_requests/list')) {
    return JSON.stringify({
      pullRequests: [{ commit: { sha: HEAD }, key: '7' }],
    })
  }
  if (url.startsWith('/project_analyses/search')) {
    return JSON.stringify({ analyses: [{ revision: HEAD }] })
  }
  return JSON.stringify({ projectStatus })
}

const serve = async (
  projectStatus: unknown = GATE_OK,
): Promise<{ origin: string; urls: string[]; close: () => Promise<void> }> => {
  const urls: string[] = []
  const server: Server = createServer((request, response) => {
    urls.push(request.url ?? '')
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(bodyFor(request.url ?? '', projectStatus))
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve()
    })
  })
  const address = server.address()
  const port =
    typeof address === 'object' && address !== null ? address.port : 0
  return {
    origin: `http://127.0.0.1:${String(port)}`,
    urls,
    close: async () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve()
        })
      }),
  }
}

// A scratch cwd: the gate writes its payloads beside itself, and the
// repository is not a scratch directory.
const gateEnv = (origin: string): Record<string, string> => ({
  PATH: inheritedPath,
  SONAR_API_BASE: origin,
  SONAR_POLL_ATTEMPTS: '1',
  SONAR_PROJECT_KEY: 'OlivierZal_configs',
  SONAR_TOKEN: 'test-token',
})

const statusUrl = (urls: readonly string[]): string =>
  urls.find((url) => url.startsWith('/qualitygates/project_status')) ?? ''

// Resolves on failure too: this gate's rejections are as much of a
// contract as its acceptances, and the synchronous form would deadlock
// against the in-process server.
const attempt = async (
  env: Readonly<Record<string, string>>,
): Promise<RunResult> =>
  new Promise((resolve) => {
    execFile(
      gateScript,
      [],
      { cwd: scratch, encoding: 'utf8', env },
      (error, stdout, stderr) => {
        resolve({
          output: `${stdout}${stderr}`,
          status: error === null ? 0 : 1,
        })
      },
    )
  })

const prEnv = (origin: string): Record<string, string> => ({
  ...gateEnv(origin),
  EVENT_NAME: 'pull_request',
  HEAD_REPO: 'OlivierZal/configs',
  HEAD_SHA: HEAD,
  PR_AUTHOR: 'OlivierZal',
  PR_NUMBER: '7',
  THIS_REPO: 'OlivierZal/configs',
})

describe('the quality gate verdict', () => {
  it('asks SonarCloud for the pull request under review', async () => {
    const { close, origin, urls } = await serve()
    const stdout = await runAsync(gateScript, prEnv(origin))
    await close()

    expect(stdout).toContain('the quality gate holds')
    expect(statusUrl(urls)).toContain('pullRequest=7')
    expect(statusUrl(urls)).not.toContain('branch=')
  })

  it('asks for the branch on a push, where drift surfaces', async () => {
    const { close, origin, urls } = await serve()
    const stdout = await runAsync(gateScript, {
      ...gateEnv(origin),
      BRANCH: 'main',
      EVENT_NAME: 'push',
      MERGE_SHA: HEAD,
      THIS_REPO: 'OlivierZal/configs',
    })
    await close()

    expect(stdout).toContain('the quality gate holds')
    expect(statusUrl(urls)).toContain('branch=main')
    expect(statusUrl(urls)).not.toContain('pullRequest=')
  })

  it('rejects a failing gate, naming the condition that failed', async () => {
    const { close, origin } = await serve(GATE_ERROR)
    const { output, status } = await attempt(prEnv(origin))
    await close()

    expect(status).toBe(1)
    expect(output).toContain('the quality gate rejects this analysis')
    expect(output).toContain('new_violations=3')
  })

  it('rejects a verdict it could not read rather than greening it', async () => {
    const { close, origin } = await serve(GATE_NO_VERDICT)
    const { output, status } = await attempt(prEnv(origin))
    await close()

    expect(status).toBe(1)
    expect(output).toContain('no quality-gate verdict')
  })
})

describe('the reusable CI workflow', () => {
  // Shipping the scripts without wiring them would leave the bar
  // exactly as unmechanized as before, with every other test green.
  // Naming the script is not running it: the resolution assigns a path
  // and a separate line invokes it, so both halves are pinned or a
  // dropped invocation reads as wired.
  it('runs the gate in a job of its own', () => {
    const runs = asArray(sonarJob.steps, 'steps')
      .map((step) => asRecord(step, 'step').run)
      .filter((step) => typeof step === 'string')
      .join('\n')

    expect(runs).toContain('check-sonar-gate.sh')
    expect(runs).toMatch(/^\s*bash "\$script"$/mv)
  })

  // The analysis this verifies is uploaded by the coverage leg, so a
  // gate that did not wait for it would read the previous commit's
  // figures and call them this one's.
  it('waits for the leg that uploads the analysis', () => {
    expect(sonarJob.needs).toBe('test')
  })

  // The context name lands in seven rulesets; a rename makes a required
  // check that never reports, which blocks every merge in the family.
  it('keeps the context name its callers will require', () => {
    expect(asString(sonarJob.name, 'sonar.name')).toBe('Sonar')
  })

  // Both lists are read rather than inferred, which is what makes the
  // unanalysed branch a verification and not a guess. From git, not the
  // pulls API: a called job may not ask for a permission its caller
  // withholds, and requesting one fails the run before any step starts.
  it('reads the commit authors and the changed files', () => {
    const script = asArray(sonarJob.steps, 'steps')
      .map((step) => asRecord(step, 'step').run)
      .filter((step) => typeof step === 'string')
      .join('\n')

    expect(script).toContain('git log')
    expect(script).toContain('git diff')
  })

  // The lists come from the two sides of the merge commit, which are
  // only present with the full history.
  it('checks out both sides of the merge commit', () => {
    const depths = asArray(sonarJob.steps, 'steps')
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

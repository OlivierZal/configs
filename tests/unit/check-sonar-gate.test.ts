import {
  type SpawnSyncReturns,
  execFile,
  execFileSync,
} from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { type Server, createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const barScript = path.join(repoRoot, 'scripts/check-sonar-bar.sh')
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
const measuresFile = (
  measures: readonly Readonly<Record<string, unknown>>[],
): string => {
  const body = JSON.stringify({ component: { measures } })
  const file = path.join(
    scratch,
    `measures-${createHash('sha256').update(body).digest('hex').slice(0, 16)}.json`,
  )
  writeFileSync(file, body)
  return file
}

const measure = (metric: string, value: string): Record<string, unknown> => ({
  metric,
  value,
})

const OVERALL_CLEAN = [
  measure('violations', '0'),
  measure('security_hotspots', '0'),
  measure('duplicated_lines_density', '0.0'),
  measure('coverage', '100.0'),
  measure('lines_to_cover', '85'),
]

const NEW_CLEAN = [
  measure('new_violations', '0'),
  measure('new_security_hotspots', '0'),
  measure('new_duplicated_lines_density', '0.0'),
  measure('new_coverage', '100.0'),
  measure('new_lines', '42'),
  measure('new_lines_to_cover', '12'),
]

const withMetric = (
  measures: readonly Readonly<Record<string, unknown>>[],
  metric: string,
  value: string,
): Readonly<Record<string, unknown>>[] =>
  measures.map((entry) =>
    entry.metric === metric ? measure(metric, value) : entry,
  )

const without = (
  measures: readonly Readonly<Record<string, unknown>>[],
  metric: string,
): Readonly<Record<string, unknown>>[] =>
  measures.filter((entry) => entry.metric !== metric)

const bar = (
  mode: string,
  measures: readonly Readonly<Record<string, unknown>>[],
): RunResult => run(barScript, [mode, measuresFile(measures)])

// A window that touched nothing: no line, hence neither ratio.
const NEW_NO_LINES = withMetric(
  withMetric(NEW_CLEAN, 'new_lines', '0'),
  'new_lines_to_cover',
  '0',
)
const NEW_EMPTY_WINDOW = without(
  without(NEW_NO_LINES, 'new_coverage'),
  'new_duplicated_lines_density',
)

// What SonarCloud answers for a documentation-only change: it analyses
// no Markdown, so the counters come back and every line-derived figure
// is simply absent. The window is empty, not unverified.
const NEW_NOTHING_ANALYSABLE = [
  measure('new_violations', '0'),
  measure('new_security_hotspots', '0'),
]

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

describe('the Sonar bar', () => {
  it.each([
    { measures: OVERALL_CLEAN, mode: 'overall' },
    { measures: NEW_CLEAN, mode: 'new' },
    // A window that added no line reports no ratio, and says so itself
    // through `new_lines` rather than leaving the gate to guess.
    { measures: NEW_EMPTY_WINDOW, mode: 'new' },
    // Workflow YAML and shell carry new lines but nothing coverable, so
    // no ratio is owed. Demanding one there fails on the analyser's
    // language support rather than on the code — the false failure this
    // clause exists to prevent.
    {
      measures: without(
        withMetric(NEW_CLEAN, 'new_lines_to_cover', '0'),
        'new_coverage',
      ),
      mode: 'new',
    },
    // A documentation-only pull request: analysed, counters returned,
    // every line-derived figure absent because there was no subject to
    // measure. Failing here would report "could not verify" for a window
    // that is fully verified — and it blocked two real pull requests.
    { measures: NEW_NOTHING_ANALYSABLE, mode: 'new' },
  ])('accepts a clean $mode window', ({ measures, mode }) => {
    const { output, status } = bar(mode, measures)

    expect(status).toBe(0)
    expect(output).toContain(`the ${mode} window holds the house bar`)
  })

  // One mutation per clause of the house bar. The free-tier quality
  // gate passes several of these, which is the whole reason the gate
  // reads the metrics instead of the gate status.
  it.each([
    {
      expected: 'open issues: 1',
      metric: 'violations',
      mode: 'overall',
      value: '1',
    },
    {
      expected: 'security hotspots: 2',
      metric: 'security_hotspots',
      mode: 'overall',
      value: '2',
    },
    // Under the free gate this is a pass: it tolerates 3 % on new code.
    {
      expected: 'duplicated lines: 2.5',
      metric: 'duplicated_lines_density',
      mode: 'overall',
      value: '2.5',
    },
    {
      expected: 'coverage: 99.4 %',
      metric: 'coverage',
      mode: 'overall',
      value: '99.4',
    },
    {
      expected: 'issues on new code: 1',
      metric: 'new_violations',
      mode: 'new',
      value: '1',
    },
    {
      expected: 'security hotspots on new code: 1',
      metric: 'new_security_hotspots',
      mode: 'new',
      value: '1',
    },
    {
      expected: 'duplicated lines on new code: 1.2',
      metric: 'new_duplicated_lines_density',
      mode: 'new',
      value: '1.2',
    },
    {
      expected: 'coverage of new code: 87 %',
      metric: 'new_coverage',
      mode: 'new',
      value: '87',
    },
  ])('rejects $metric at $value', ({ expected, metric, mode, value }) => {
    const clean = mode === 'overall' ? OVERALL_CLEAN : NEW_CLEAN
    const { output, status } = bar(mode, withMetric(clean, metric, value))

    expect(status).toBe(1)
    expect(output).toContain(expected)
  })

  // The trap this gate exists to avoid: a metric it cannot read is a
  // metric it did not verify, so absence fails rather than passes. It
  // is also what turns a wrong metric name into a loud failure on the
  // first real run instead of a permanent false green.
  it.each([
    { metric: 'violations', mode: 'overall' },
    { metric: 'security_hotspots', mode: 'overall' },
    { metric: 'duplicated_lines_density', mode: 'overall' },
    { metric: 'coverage', mode: 'overall' },
    { metric: 'new_violations', mode: 'new' },
    { metric: 'new_security_hotspots', mode: 'new' },
    { metric: 'new_lines', mode: 'new' },
    // Absent while the payload says there ARE lines to cover: that is
    // an unverified ratio, not an inapplicable one.
    { metric: 'new_coverage', mode: 'new' },
  ])('rejects an absent $metric', ({ metric, mode }) => {
    const clean = mode === 'overall' ? OVERALL_CLEAN : NEW_CLEAN
    const { output, status } = bar(mode, without(clean, metric))

    expect(status).toBe(1)
    expect(output).toContain(`\`${metric}\` is absent`)
  })

  it('rejects a payload with no measures at all', () => {
    const { output, status } = bar('overall', [])

    expect(status).toBe(1)
    expect(output).toContain('carries no measures')
  })

  // The tolerance is for figures with no subject, never for the counters
  // that prove the analysis answered: an empty window still holds them.
  it('holds the counters on a window with nothing analysable', () => {
    const { output, status } = bar(
      'new',
      withMetric(NEW_NOTHING_ANALYSABLE, 'new_violations', '1'),
    )

    expect(status).toBe(1)
    expect(output).toContain('issues on new code: 1')
  })

  // Counters gone as well: nothing establishes that an analysis answered
  // at all, so this is the unverified case and not the empty one.
  it('rejects a window that reports no counter either', () => {
    const { output, status } = bar(
      'new',
      without(NEW_NOTHING_ANALYSABLE, 'new_violations'),
    )

    expect(status).toBe(1)
    expect(output).toContain('`new_violations` is absent')
  })

  // SonarCloud answers an unauthorized read with a body, not only a
  // status, so the payload itself has to be treated as untrusted.
  it('rejects an API error body', () => {
    const file = path.join(scratch, 'errors.json')
    writeFileSync(
      file,
      JSON.stringify({ errors: [{ msg: 'Insufficient privileges' }] }),
    )
    const { output, status } = run(barScript, ['overall', file])

    expect(status).toBe(1)
    expect(output).toContain('SonarCloud refused the request')
  })

  it.each([
    { args: [], expected: 'usage: check-sonar-bar.sh' },
    { args: ['sideways', 'x'], expected: 'mode must be' },
    { args: ['overall', 'absent.json'], expected: 'no such measures file' },
  ])('rejects the call $args', ({ args, expected }) => {
    const { output, status } = run(barScript, args)

    expect(status).toBe(1)
    expect(output).toContain(expected)
  })
})

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

const bodyFor = (url: string): string => {
  if (url.startsWith('/project_pull_requests/list')) {
    return JSON.stringify({
      pullRequests: [{ commit: { sha: HEAD }, key: '7' }],
    })
  }
  if (url.startsWith('/project_analyses/search')) {
    return JSON.stringify({ analyses: [{ revision: HEAD }] })
  }
  return JSON.stringify({
    component: {
      measures: url.includes('metricKeys=new_') ? NEW_CLEAN : OVERALL_CLEAN,
    },
  })
}

const serve = async (): Promise<{
  origin: string
  urls: string[]
  close: () => Promise<void>
}> => {
  const urls: string[] = []
  const server: Server = createServer((request, response) => {
    urls.push(request.url ?? '')
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(bodyFor(request.url ?? ''))
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

const measuresUrl = (urls: readonly string[]): string =>
  urls.find((url) => url.startsWith('/measures/component')) ?? ''

describe('the window each event answers for', () => {
  it('holds a pull request to the new-code window alone', async () => {
    const { close, origin, urls } = await serve()
    const stdout = await runAsync(gateScript, {
      ...gateEnv(origin),
      EVENT_NAME: 'pull_request',
      HEAD_REPO: 'OlivierZal/configs',
      HEAD_SHA: HEAD,
      PR_AUTHOR: 'OlivierZal',
      PR_NUMBER: '7',
      THIS_REPO: 'OlivierZal/configs',
    })
    await close()

    expect(stdout).toContain('the new window holds the house bar')
    expect(stdout).not.toContain('the overall window')
    expect(measuresUrl(urls)).toContain('metricKeys=new_violations')
    expect(measuresUrl(urls)).toContain('pullRequest=7')
  })

  it('holds a push to the overall window, where drift surfaces', async () => {
    const { close, origin, urls } = await serve()
    const stdout = await runAsync(gateScript, {
      ...gateEnv(origin),
      BRANCH: 'main',
      EVENT_NAME: 'push',
      MERGE_SHA: HEAD,
      THIS_REPO: 'OlivierZal/configs',
    })
    await close()

    expect(stdout).toContain('the overall window holds the house bar')
    expect(stdout).not.toContain('the new window')
    expect(measuresUrl(urls)).toContain('metricKeys=violations')
    expect(measuresUrl(urls)).not.toContain('pullRequest=')
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

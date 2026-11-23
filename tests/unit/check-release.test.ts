import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BRANCH_NAME, RELEASED_SHA, TOKEN } from '../github-scenarios.ts'
import {
  type RunResult,
  type Stub,
  repoRoot,
  runScript,
  startStub,
} from '../helpers.ts'

const guardScript = path.join(repoRoot, 'scripts/check-release.sh')
const stubScript = path.join(repoRoot, 'tests/github-stub.ts')
const inheritedPath = process.env.PATH ?? ''

// The read retries a transient failure after two seconds, then four: an
// outage that outlasts both takes six seconds to report.
const RETRY_TIMEOUT_MS = 15_000

// Nothing listens there: a connection is refused at once.
const CLOSED_PORT = 'http://127.0.0.1:1'

// The guard reads an unfinished run again every fifteen seconds, for
// eight minutes: the suite keeps the reads and shortens the pause.
const POLL_SECONDS = '0.01'

const run = (env: Readonly<Record<string, string>>): RunResult =>
  runScript(guardScript, {
    cwd: repoRoot,
    // A clean slate: the ambient GITHUB_TOKEN of a developer machine or
    // of the runner would otherwise be the one the script sends.
    env: { PATH: inheritedPath, ...env },
  })

describe('against a stand-in GitHub', () => {
  let stub: Stub | undefined
  let githubHost = ''

  beforeAll(async () => {
    stub = await startStub(stubScript)
    githubHost = stub.host
  })

  afterAll(() => {
    stub?.stop()
  })

  const release = (
    repo: string,
    overrides: Readonly<Record<string, string>> = {},
  ): Readonly<Record<string, string>> => ({
    DEFAULT_BRANCH: BRANCH_NAME,
    GITHUB_API_URL: githubHost,
    GITHUB_TOKEN: TOKEN,
    HEAD_SHA: RELEASED_SHA,
    POLL_SECONDS,
    THIS_REPO: repo,
    ...overrides,
  })

  const prerelease = (repo: string): Readonly<Record<string, string>> =>
    release(repo, { IS_PRERELEASE: 'true' })

  it('accepts a commit whose CI run on the default branch succeeded', () => {
    const { output, status } = run(release('acme/green'))

    expect(status).toBe(0)
    expect(output).toContain(
      `run #1 of ci.yml on \`${BRANCH_NAME}\` succeeded for ${RELEASED_SHA}`,
    )
  })

  // The LATEST run decides, whatever the order the platform lists them
  // in: a commit that failed and was then re-judged green is released,
  // one that has failed since is not. Thirty-one runs are one more than
  // the platform lists unasked: the read asks for the whole of them.
  it.each([
    ['after a failed one', 'acme/green-since', 'run #2 of ci.yml'],
    ['after thirty failed ones', 'acme/often', 'run #31 of ci.yml'],
  ])(
    'accepts a commit whose latest run succeeded %s',
    (_what, repo, expected) => {
      const { output, status } = run(release(repo))

      expect(status).toBe(0)
      expect(output).toContain(expected)
    },
  )

  // A release is often cut within seconds of the merge, while the run
  // of its commit is still going or before it is even listed: the guard
  // waits for the verdict instead of refusing for want of one.
  it.each([
    ['still going', 'acme/finishing', 'is in_progress'],
    ['not listed yet', 'acme/late', 'waiting for one'],
  ])(
    'waits for a run %s and accepts it once it has succeeded',
    (_what, repo, waiting) => {
      const { output, status } = run(release(repo))

      expect(status).toBe(0)
      expect(output).toContain(waiting)
      expect(output).toContain('run #1 of ci.yml on `main` succeeded')
    },
  )

  // A pull request headed by the default branch names that branch and
  // its tip, and judges their merge into another branch: the run of the
  // branch itself decides, whichever of the two is the newer.
  it("leaves aside the green run of the default branch's own pull request", () => {
    const { output, status } = run(release('acme/default-into-branch'))

    expect(status).toBe(1)
    expect(output).toContain('run #1 of ci.yml on `main` concluded failure')
  })

  it("leaves aside the red run of the default branch's own pull request", () => {
    const { output, status } = run(release('acme/default-into-red-branch'))

    expect(status).toBe(0)
    expect(output).toContain('run #1 of ci.yml on `main` succeeded')
  })

  it('judges a release on the default branch it is given', () => {
    const { output, status } = run(
      release('acme/trunk', { DEFAULT_BRANCH: 'trunk' }),
    )

    expect(status).toBe(0)
    expect(output).toContain('on `trunk` succeeded')
  })

  // No run to show on the default branch of this repository: another
  // commit's, another branch's, another workflow's, a fork's.
  it.each([
    ['a commit the CI never ran on', 'acme/never'],
    ['the runs of a sibling commit, branch and workflow', 'acme/elsewhere'],
    ['a commit judged on another branch alone', 'acme/branch'],
    ["a fork's run under the default branch's name", 'acme/fork'],
    ['the run of a fork that is gone', 'acme/fork-gone'],
  ])('refuses %s', (_what, repo) => {
    const { output, status } = run(release(repo, { IS_PRERELEASE: 'false' }))

    expect(status).toBe(1)
    expect(output).toContain('ci.yml never ran on `main`')
  })

  // A run to show, and not a green one: only `success` releases.
  it.each([
    [
      'outlasts the wait',
      'acme/running',
      'run #2 of ci.yml on `main` is still',
    ],
    ['failed', 'acme/red', 'run #1 of ci.yml on `main` concluded failure'],
    ['failed since', 'acme/red-since', 'run #2 of ci.yml on `main` concluded'],
    ['was cancelled', 'acme/cancelled', 'concluded cancelled'],
    ['failed under a fork', 'acme/fork-over-red', 'run #1 of ci.yml on `main`'],
  ])('refuses a commit whose latest run %s', (_what, repo, expected) => {
    const { output, status } = run(release(repo))

    expect(status).toBe(1)
    expect(output).toContain(expected)
  })

  // A listing it cannot read whole is no verdict: more runs than the
  // largest page, or an answer short of its list or of its count.
  it.each([
    ['more runs than it read', 'acme/overflow', '101 runs of ci.yml'],
    ['an answer without its runs', 'acme/runless', 'a shape this read'],
    ['an answer without its count', 'acme/countless', 'a shape this read'],
  ])('refuses %s', (_what, repo, expected) => {
    const { output, status } = run(release(repo))

    expect(status).toBe(1)
    expect(output).toContain(expected)
  })

  // The one release cut from work in progress: its commit may sit on
  // any branch of the repository, and on none of a fork's.
  it('accepts a prerelease whose commit a branch of the repository judged', () => {
    const { output, status } = run(prerelease('acme/branch'))

    expect(status).toBe(0)
    expect(output).toContain('run #1 of ci.yml on `feature` succeeded')
  })

  it("refuses a prerelease whose only run is a fork's", () => {
    const { output, status } = run(prerelease('acme/fork'))

    expect(status).toBe(1)
    expect(output).toContain('ci.yml never ran in acme/fork')
  })

  // The CI is the caller's `ci.yml`: a repository that has none has no
  // run to show, and the platform says so with a 404.
  it('fails on a repository that has no ci.yml', () => {
    const { output, status } = run(release('acme/no-ci-file'))

    expect(status).toBe(1)
    expect(output).toContain('HTTP 404')
  })

  // An outage — a 5xx, a 429 or a connection that drops — gets three
  // attempts: one that clears recovers, one that lasts reports.
  it.each([
    { expected: 'succeeded', repo: 'acme/flaky', status: 0 },
    { expected: 'succeeded', repo: 'acme/rate-limited', status: 0 },
    { expected: 'HTTP 503 after 3 attempts', repo: 'acme/down', status: 1 },
  ])(
    'gives a platform failure three attempts in $repo',
    ({ expected, repo, status }) => {
      const result = run(release(repo))

      expect(result.status).toBe(status)
      expect(result.output).toContain(expected)
    },
    RETRY_TIMEOUT_MS,
  )

  it(
    'gives a refused connection three attempts',
    () => {
      const { output, status } = run(
        release('acme/green', { GITHUB_API_URL: CLOSED_PORT }),
      )

      expect(status).toBe(1)
      expect(output).toContain('after 3 attempts')
    },
    RETRY_TIMEOUT_MS,
  )

  // A 4xx is a verdict on the request, not an outage: no retry.
  it.each([
    {
      code: 401,
      overrides: { GITHUB_TOKEN: 'wrong' },
      repo: 'acme/authenticated',
    },
    { code: 403, overrides: {}, repo: 'acme/forbidden' },
  ])('fails at once on a $code', ({ code, overrides, repo }) => {
    const { output, status } = run(release(repo, overrides))

    expect(status).toBe(1)
    expect(output).toContain(`HTTP ${String(code)}`)
    expect(output).not.toContain('attempts')
  })

  it('reads the runs under the token it was given', () => {
    const { status } = run(release('acme/authenticated'))

    expect(status).toBe(0)
  })

  // Each one is what ties the verdict to THIS release: without it the
  // read could be of any commit, any repository, any branch, or refused.
  it.each(['HEAD_SHA', 'THIS_REPO', 'DEFAULT_BRANCH', 'GITHUB_TOKEN'])(
    'refuses to run without %s',
    (variable) => {
      const { output, status } = run(release('acme/green', { [variable]: '' }))

      expect(status).toBe(1)
      expect(output).toContain(`${variable} is empty`)
    },
  )
})

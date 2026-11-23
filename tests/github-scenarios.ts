// What the stand-in GitHub of `tests/github-stub.ts` answers, keyed by
// the repository the script under test names: the suites pick a
// scenario by setting `THIS_REPO`, and the constants below are the
// facts both sides agree on (the released commit, the default branch,
// the token, the CI workflow file).
import type { Outage } from './stub-server.ts'

export interface Run {
  readonly conclusion: string | null
  readonly event: string
  readonly head_branch: string
  readonly head_sha: string
  readonly path: string
  readonly run_number: number
  readonly status: string
  // The repository the run's branch is in: the scenario's own unless
  // said, a fork's for a pull request from it, `null` once that fork is
  // gone.
  readonly head_repository?: { readonly full_name: string } | null
}

export interface Scenario extends Outage {
  readonly runs: readonly Run[]
  // Lists every run whatever commit the query names, as a platform that
  // stopped honouring its filter: the script must hold each run to what
  // it asked for.
  readonly isUnfiltered?: true
  // Answers without its run list, or without its count, as a platform
  // that changed its shape.
  readonly missing?: 'total_count' | 'workflow_runs'
  // The listings after which the runs still going are served as
  // completed, with this conclusion: a CI that ends while it is waited
  // on. Counted once per stub lifetime, as an outage is.
  readonly settles?: { readonly after: number; readonly conclusion: string }
  // The listings that come back empty before the runs are listed: a
  // release cut before the platform has created the run of its commit.
  readonly startsAfter?: number
  readonly status?: number
  readonly token?: string
  // The workflow file the runs belong to, `ci.yml` unless said.
  readonly workflow?: string
}

export const RELEASED_SHA = '0123456789abcdef0123456789abcdef01234567'
export const BRANCH_NAME = 'main'
export const TOKEN = 'test-token'
export const CI_WORKFLOW = 'ci.yml'

const OTHER_SHA = 'f'.repeat(40)
const FORK = { full_name: 'fork/fork' }
// One run more than the platform lists unasked, and one more than it
// lists at the most.
const DEFAULT_PAGE_AND_ONE = 31
const LARGEST_PAGE_AND_ONE = 101
const ALWAYS = 99

const run = (
  runNumber: number,
  conclusion: string | null,
  overrides: Partial<Run> = {},
): Run => ({
  conclusion,
  event: 'push',
  head_branch: BRANCH_NAME,
  head_sha: RELEASED_SHA,
  path: `.github/workflows/${CI_WORKFLOW}`,
  run_number: runNumber,
  status: conclusion === null ? 'in_progress' : 'completed',
  ...overrides,
})

// A commit judged over and over, the latest run green: listed oldest
// first, so the newest is the last of the list.
const judged = (times: number): readonly Run[] =>
  Array.from({ length: times }, (_unused, index) =>
    run(index + 1, index + 1 === times ? 'success' : 'failure'),
  )

const green: readonly Run[] = [run(1, 'success')]

export const scenarios: Readonly<Partial<Record<string, Scenario>>> = {
  'acme/authenticated': { runs: green, token: TOKEN },
  // Judged on a branch that has a pull request, never on the default
  // branch: what a prerelease is cut from.
  'acme/branch': {
    runs: [
      run(1, 'success', { event: 'pull_request', head_branch: 'feature' }),
    ],
  },
  'acme/cancelled': { runs: [run(1, 'cancelled')] },
  'acme/countless': { missing: 'total_count', runs: green },
  // Every run but the released commit's own, on its own branch, of its
  // own workflow: a sibling commit, a sibling branch, a sibling file.
  // A pull request headed by the default branch, into another branch:
  // its runs name the default branch and its tip, and judge their merge
  // into that other branch. Green over the branch's own red run, or the
  // reverse, they decide nothing.
  'acme/default-into-branch': {
    runs: [run(1, 'failure'), run(2, 'success', { event: 'pull_request' })],
  },
  'acme/default-into-red-branch': {
    runs: [run(1, 'success'), run(2, 'failure', { event: 'pull_request' })],
  },
  'acme/down': { failuresFirst: ALWAYS, runs: green },
  'acme/elsewhere': {
    isUnfiltered: true,
    runs: [
      run(1, 'success', { head_sha: OTHER_SHA }),
      run(2, 'success', { head_branch: 'feature' }),
      run(3, 'success', { path: '.github/workflows/zizmor.yml' }),
    ],
  },
  'acme/finishing': {
    runs: [run(1, null)],
    settles: { after: 2, conclusion: 'success' },
  },
  'acme/flaky': { failuresFirst: 2, runs: green },
  'acme/forbidden': { runs: green, status: 403 },
  // A pull request from a fork whose branch bears the default branch's
  // name: the platform lists its runs under that name, on a commit the
  // default branch never held.
  'acme/fork': { runs: [run(1, 'success', { head_repository: FORK })] },
  'acme/fork-gone': { runs: [run(1, 'success', { head_repository: null })] },
  // The fork's green run is the newer of the two: it must not outrank
  // the repository's own verdict on the commit.
  'acme/fork-over-red': {
    runs: [run(1, 'failure'), run(2, 'success', { head_repository: FORK })],
  },
  'acme/green': { runs: green },
  'acme/green-since': { runs: judged(2) },
  'acme/late': { runs: green, startsAfter: 2 },
  'acme/never': { runs: [run(1, 'success', { head_sha: OTHER_SHA })] },
  // A repository whose CI lives under another file name.
  'acme/no-ci-file': {
    runs: [run(1, 'success', { path: '.github/workflows/checks.yml' })],
    workflow: 'checks.yml',
  },
  'acme/often': { runs: judged(DEFAULT_PAGE_AND_ONE) },
  'acme/overflow': { runs: judged(LARGEST_PAGE_AND_ONE) },
  'acme/rate-limited': { failureStatus: 429, failuresFirst: 1, runs: green },
  'acme/red': { runs: [run(1, 'failure')] },
  'acme/red-since': { runs: [run(2, 'failure'), run(1, 'success')] },
  'acme/runless': { missing: 'workflow_runs', runs: green },
  'acme/running': { runs: [run(1, 'success'), run(2, null)] },
  // A repository whose default branch bears another name.
  'acme/trunk': { runs: [run(1, 'success', { head_branch: 'trunk' })] },
}

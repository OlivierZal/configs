// A GitHub stand-in for the `check-release.sh` suite: the one
// endpoint the script reads, the runs of a workflow, answered from the
// scenario the repository names (`tests/github-scenarios.ts`), so the
// script under test runs unmodified against a local `GITHUB_API_URL`.
// The server itself is `tests/stub-server.ts`'s.
import type { IncomingMessage } from 'node:http'

import { type Scenario, CI_WORKFLOW, scenarios } from './github-scenarios.ts'
import { type Reply, createOutage, HTTP, serve } from './stub-server.ts'

const RUNS_PATH =
  /^\/repos\/(?<repo>[^\/]+\/[^\/]+)\/actions\/workflows\/(?<workflow>[^\/]+)\/runs$/v

const message = (text: string): unknown => ({ message: text })

const outageOf = createOutage()

// The listings each scenario has served, for the ones whose runs move
// while they are waited on: listed late, or settled after a few reads.
const listings = new Map<string, number>()

const runsNow = (repo: string, scenario: Scenario): Scenario['runs'] => {
  const served = listings.get(repo) ?? 0
  listings.set(repo, served + 1)
  const { runs, settles, startsAfter = 0 } = scenario
  if (served < startsAfter) {
    return []
  }
  return settles === undefined || served < settles.after
    ? runs
    : runs.map((run) =>
        run.status === 'completed'
          ? run
          : { ...run, conclusion: settles.conclusion, status: 'completed' },
      )
}

// The refusals that precede the listing: a token the scenario demands
// and did not get, the status it always answers with, and the outage
// it scripts before answering.
const refuse = (
  repo: string,
  scenario: Scenario,
  authorization: string | undefined,
): Reply | undefined => {
  if (
    scenario.token !== undefined &&
    authorization !== `Bearer ${scenario.token}`
  ) {
    return [HTTP.unauthorized, message('Bad credentials')]
  }
  if (scenario.status !== undefined) {
    return [scenario.status, message(`always ${String(scenario.status)}`)]
  }
  const outage = outageOf(repo, scenario)
  return outage === undefined ? undefined : [outage, message('try again later')]
}

// The largest page the platform serves, and the one it serves unasked.
const LARGEST_PAGE = 100
const DEFAULT_PAGE = 30

// The listing as the platform serves it: the runs that name the commit,
// counted whole and listed one page at a most, each in the scenario's
// own repository unless it says otherwise. The stand-in is stricter
// than the platform on one point: it refuses a query that names no
// commit, so a filter the script dropped is a failed request rather
// than a longer list.
const list = (repo: string, scenario: Scenario, url: URL): Reply => {
  const headSha = url.searchParams.get('head_sha')
  if (headSha === null) {
    return [HTTP.badRequest, message('a commit is required')]
  }
  const pageSize = Math.min(
    Number(url.searchParams.get('per_page') ?? DEFAULT_PAGE),
    LARGEST_PAGE,
  )
  const current = runsNow(repo, scenario)
  const runs = (
    scenario.isUnfiltered === true
      ? current
      : current.filter((run) => run.head_sha === headSha)
  ).map((run) => ({ head_repository: { full_name: repo }, ...run }))
  const body = {
    total_count: runs.length,
    workflow_runs: runs.slice(0, pageSize),
  }
  return [
    HTTP.ok,
    Object.fromEntries(
      Object.entries(body).filter(([key]) => key !== scenario.missing),
    ),
  ]
}

const answer = (request: IncomingMessage): Reply => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  const { repo = '', workflow = '' } =
    RUNS_PATH.exec(url.pathname)?.groups ?? {}
  const scenario = scenarios[repo]
  if (scenario === undefined) {
    return [HTTP.notFound, message(`unknown repository ${repo}`)]
  }
  const refused = refuse(repo, scenario, request.headers.authorization)
  if (refused !== undefined) {
    return refused
  }
  return workflow === (scenario.workflow ?? CI_WORKFLOW)
    ? list(repo, scenario, url)
    : [HTTP.notFound, message('Not Found')]
}

serve(answer)

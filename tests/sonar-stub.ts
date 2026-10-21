// A SonarCloud stand-in for the `check-sonar-gate.sh` suites: the three
// read-back endpoints answered from the scenario the project key names
// (`tests/sonar-scenarios.ts`), so the script under test runs
// unmodified against a local `SONAR_HOST_URL`. It is a process of its
// own because the suites run the script synchronously, and a server
// inside the test process could not answer while that call blocks.
// Prints the port it listens on, then serves until it is killed or its
// stdin closes.
import { type IncomingMessage, createServer } from 'node:http'

import {
  type Measures,
  type Scenario,
  type Scope,
  ANALYSED_SHA,
  BRANCH_NAME,
  PULL_REQUEST_KEY,
  scenarios,
} from './sonar-scenarios.ts'

type Reply = readonly [status: number, body: unknown]

// Listed FIRST in both listings, so position and identity disagree: a
// lookup by key or by name finds the analysis, the first entry does not.
const DECOY_SHA = 'd'.repeat(40)

const HTTP = {
  badRequest: 400,
  notFound: 404,
  ok: 200,
  unauthorized: 401,
  unavailable: 503,
}

const errors = (message: string): unknown => ({ errors: [{ msg: message }] })

// The scope a request names, as the platform would resolve it: the
// pull request by its key, the branch by its name, nothing else.
const SCOPES: readonly (readonly [scope: Scope, expected: string])[] = [
  ['pullRequest', PULL_REQUEST_KEY],
  ['branch', BRANCH_NAME],
]

const measuresFor = (scenario: Scenario, url: URL): Measures | undefined => {
  const scope = SCOPES.find(
    ([parameter, expected]) => url.searchParams.get(parameter) === expected,
  )?.[0]
  return scope === undefined ? undefined : scenario.measures[scope]
}

const newCodeEntry = (
  metric: string,
  value: string,
  shape: Scenario['shape'],
): unknown => {
  switch (shape) {
    case 'bare': {
      return { metric }
    }
    case 'period': {
      return { metric, period: { index: 1, value } }
    }
    case undefined: {
      return { metric, periods: [{ index: 1, value }] }
    }
  }
}

const measuresOf = (
  scenario: Scenario,
  measures: Measures,
  url: URL,
): unknown[] => {
  const requested = new Set(
    (url.searchParams.get('metricKeys') ?? '').split(','),
  )
  return Object.entries(measures)
    .filter(([metric]) => requested.has(metric))
    .map(([metric, value]) =>
      metric.startsWith('new_')
        ? newCodeEntry(metric, value, scenario.shape)
        : { metric, value },
    )
}

type Route = (scenario: Scenario, url: URL) => Reply

const routes = new Map<string, Route>([
  [
    '/api/measures/component',
    (scenario, url): Reply => {
      const measures = measuresFor(scenario, url)
      return measures === undefined
        ? [
            HTTP.badRequest,
            errors('a pull request key or a branch name is required'),
          ]
        : [
            HTTP.ok,
            { component: { measures: measuresOf(scenario, measures, url) } },
          ]
    },
  ],
  [
    '/api/project_branches/list',
    (scenario): Reply => [
      HTTP.ok,
      {
        branches: scenario.unlisted
          ? []
          : [
              { commit: { sha: DECOY_SHA }, name: 'feature/decoy' },
              { commit: { sha: ANALYSED_SHA }, name: BRANCH_NAME },
            ],
      },
    ],
  ],
  [
    '/api/project_pull_requests/list',
    (scenario): Reply => [
      HTTP.ok,
      {
        pullRequests: scenario.unlisted
          ? []
          : [
              { commit: { sha: DECOY_SHA }, key: '6' },
              { commit: { sha: ANALYSED_SHA }, key: PULL_REQUEST_KEY },
            ],
      },
    ],
  ],
])

const failuresLeft = new Map<string, number>()

// The refusals that precede any route: a token the scenario demands
// and did not get, the status it always answers with, and the outage
// it scripts before answering.
const refuse = (
  project: string,
  scenario: Scenario,
  authorization: string | undefined,
): Reply | undefined => {
  if (
    scenario.token !== undefined &&
    authorization !== `Bearer ${scenario.token}`
  ) {
    return [HTTP.unauthorized, errors('unauthorized')]
  }
  if (scenario.status !== undefined) {
    return [scenario.status, errors(`always ${String(scenario.status)}`)]
  }
  const left = failuresLeft.get(project) ?? scenario.failuresFirst ?? 0
  if (left > 0) {
    failuresLeft.set(project, left - 1)
    return [
      scenario.failureStatus ?? HTTP.unavailable,
      errors('try again later'),
    ]
  }
  return undefined
}

const answer = (request: IncomingMessage): Reply => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  const project =
    url.searchParams.get('project') ?? url.searchParams.get('component') ?? ''
  const scenario = scenarios[project]
  if (scenario === undefined) {
    return [HTTP.notFound, errors(`unknown project ${project}`)]
  }
  const refused = refuse(project, scenario, request.headers.authorization)
  if (refused !== undefined) {
    return refused
  }
  const route = routes.get(url.pathname)
  return route === undefined
    ? [HTTP.notFound, errors(`unknown path ${url.pathname}`)]
    : route(scenario, url)
}

const server = createServer((request, response) => {
  const [status, body] = answer(request)
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
})

server.listen(0, '127.0.0.1', () => {
  const address = server.address()
  const port =
    typeof address === 'object' && address !== null ? address.port : 0
  process.stdout.write(`PORT=${String(port)}\n`)
})

// Exits with the test process even when `afterAll` never runs (a
// crashed or signalled worker): the OS closes its end of stdin as it
// dies.
process.stdin.on('end', () => {
  server.close()
})
process.stdin.resume()

// What the stand-in SonarCloud of `tests/sonar-stub.ts` answers, keyed
// by the project the script under test names: the suites pick a
// scenario by setting `SONAR_PROJECT_KEY`, and the constants below are
// the facts both sides agree on (the analysed commit, the pull request,
// the branch, the token). Every scenario answers each scope with its
// own measures, so a read against the wrong scope is a different
// verdict rather than the same one by luck.
export type Measures = Readonly<Record<string, string>>

export interface Scenario {
  readonly measures: Readonly<Record<Scope, Measures>>
  // The status the outage answers with, 503 unless the scenario says.
  readonly failureStatus?: number
  // Fires once per stub lifetime: the stand-in counts the outage down
  // and never re-arms it, so a scenario with an outage serves one run.
  readonly failuresFirst?: number
  readonly status?: number
  readonly token?: string
  readonly unlisted?: true
}

export type Scope = 'branch' | 'pullRequest'

export const ANALYSED_SHA = '0123456789abcdef0123456789abcdef01234567'
export const BRANCH_NAME = 'main'
export const PULL_REQUEST_KEY = '7'
export const TOKEN = 'test-token'

// The house bar's metrics and a value each one rejects.
export const REJECTED_VALUES: Measures = {
  coverage: '99.9',
  duplicated_lines_density: '0.1',
  new_coverage: '99.5',
  new_duplicated_lines_density: '0.4',
  new_security_hotspots_reviewed: '50.0',
  new_violations: '1',
  security_hotspots_reviewed: '0.0',
  violations: '3',
}

const BEST: Measures = {
  coverage: '100.0',
  duplicated_lines_density: '0.0',
  new_coverage: '100.0',
  new_duplicated_lines_density: '0.0',
  new_security_hotspots_reviewed: '100.0',
  new_violations: '0',
  security_hotspots_reviewed: '100.0',
  violations: '0',
}

const both = (measures: Measures): Readonly<Record<Scope, Measures>> => ({
  branch: measures,
  pullRequest: measures,
})

// One scenario per metric, named `short-<metric>`, where that metric
// alone misses the bar on both scopes.
const shortOf = (metric: string): readonly [string, Scenario] => [
  `short-${metric}`,
  { measures: both({ ...BEST, [metric]: REJECTED_VALUES[metric] ?? '' }) },
]

export const scenarios: Readonly<Record<string, Scenario>> = {
  ...Object.fromEntries(
    Object.keys(REJECTED_VALUES).map((metric) => shortOf(metric)),
  ),
  authenticated: { measures: both(BEST), token: TOKEN },
  best: { measures: both(BEST) },
  down: { failuresFirst: 3, measures: both(BEST) },
  'empty-window': {
    measures: both(
      Object.fromEntries(
        Object.entries(BEST).filter(([metric]) => metric !== 'new_coverage'),
      ),
    ),
  },
  flaky: { failuresFirst: 1, measures: both(BEST) },
  forbidden: { measures: both(BEST), status: 403 },
  'rate-limited': {
    failureStatus: 429,
    failuresFirst: 1,
    measures: both(BEST),
  },
  // The pull request meets the bar, the branch does not: which scope
  // the script read is the verdict.
  scoped: {
    measures: { branch: { ...BEST, violations: '3' }, pullRequest: BEST },
  },
  unlisted: { measures: both(BEST), unlisted: true },
}

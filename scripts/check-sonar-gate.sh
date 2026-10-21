#!/usr/bin/env bash
# Holds the house bar on the analysis the scanner uploaded, and reports
# the one thing the scanner cannot: a quality gate that was never
# consulted.
#
# The bar is stated once, below, in `NEW_CODE_BAR` and `OVERALL_BAR`
# (`HOUSE_BAR` joins the windows the event answers for): `violations`,
# `duplicated_lines_density` and their `new_*` twins at 0,
# `coverage`/`new_coverage` at 100, `security_hotspots_reviewed` and its
# `new_*` twin at 100. The organisation's Free plan has no custom
# quality gate: its built-in `Sonar way` gate, which the scan step waits
# on (`sonar.qualitygate.wait=true`), accepts 80 % coverage and 3 %
# duplication on new code and is the FLOOR — it fails the coverage leg
# on the commit that caused it, and the wait leaves the analysis
# published for the read-back here. The split by window mirrors the
# platform's: a pull request answers for its new code, a branch for
# both windows.
#
# Two facts make the read-back a verification rather than a dashboard:
# the measures are fetched for the event's own pull request or branch,
# and the analysis they belong to must be of THIS commit (`HEAD_SHA`),
# or the verdict could be a sibling run's. An absent measure is an
# empty window, not an unverified one (a documentation-only pull
# request carries no line-derived figure), and cannot reject. A 5xx, a
# 429 or a dropped connection gets three attempts, each bounded so the
# three stay inside the job's timeout; any other status is a verdict on
# the request.
#
# What no read-back can report is a scan that never ran: a skipped step
# fails nothing, and an unanalysed pull request would reach the default
# branch with every check green. The gate admits exactly two silences,
# each verified rather than assumed:
#
#   no project and no token   -> the repo opted out of Sonar in writing
#   a Dependabot pull request -> GitHub withholds from those runs the
#                                secrets an analysis needs
#
# The second is not a blanket exemption. A path to analyse them EXISTS —
# on Dependabot-triggered runs `secrets.*` resolves from the Dependabot
# secrets store, so registering SONAR_TOKEN there would make these pull
# requests genuinely analysed — and it is refused on threat model, not
# inexistence: the token would enter the environment of the job that
# installs the very dependency version under review, and scoping it to
# the scan step does not close that (an install script can poison
# $GITHUB_ENV and read a later step's environment). Re-evaluate if that
# model changes.
#
# So the exemption is granted only once this script has established that
# every commit on the branch is Dependabot's own. That is not a
# theoretical precaution: a human — or, until 6.0.0 retired it, the
# family's dependabot-fix workflow — pushing a fix onto one of these
# branches is exactly the hole this clause closes, and the reason that
# workflow could never have gone green. Dependabot itself authors
# manifests and pinned references, never source, so its own commits
# cannot move a metric — which is why their authorship is the whole
# check, and why the file list that used to accompany it added nothing.
#
# Reads its context from the environment so the workflow keeps the
# GitHub expressions and this keeps the decisions. `SONAR_HOST_URL`
# (the scanner's own variable) defaults to SonarCloud, and every read
# goes out under the token the scan ran under.
set -euo pipefail

readonly bot='dependabot[bot]'

fail() {
  local message=$1
  printf 'error: %s\n' "$message" >&2
  exit 1
}

pass() {
  local message=$1
  printf '%s\n' "$message"
  exit 0
}

readonly event=${EVENT_NAME-}
readonly this_repo=${THIS_REPO-}
readonly head_repo=${HEAD_REPO-}
readonly pr_number=${PR_NUMBER-}
readonly pr_author=${PR_AUTHOR-}

[[ -n $event ]] || fail 'EVENT_NAME is empty; this gate needs its trigger'
[[ -n ${HEAD_SHA-} ]] || fail 'HEAD_SHA is empty; the bar cannot be tied to this commit'

project_key=${SONAR_PROJECT_KEY-}
if [[ -z $project_key && -f sonar-project.properties ]]; then
  project_key=$(sed -n 's/^sonar\.projectKey=\(.*\)$/\1/p' sonar-project.properties)
fi

# A repo with neither a project nor a token has opted out of Sonar in
# writing, and that is the only silence this gate accepts without
# looking further. One without the other is a misconfiguration that
# would otherwise read as a pass: the scan step self-arms on the secret,
# so an absent token skips the analysis instead of failing for it.
if [[ -z $project_key ]]; then
  [[ -z ${SONAR_TOKEN-} ]] ||
    fail 'SONAR_TOKEN is set but no sonar.projectKey was found; the gate cannot name the project to verify'
  pass 'no Sonar project is declared for this repo; nothing to gate'
fi

# The gate predicate, stated once: a push is analysed; a pull request is
# analysed when it comes from a branch of this repository and a person
# opened it — Dependabot's receive no analysis and are accepted on the
# proof that every commit is Dependabot's, since it authors manifests and
# pinned references rather than source. Every clause states a fact this
# script checked; none of them is an assumption about who opened what.
case $event in
push) ;;
pull_request)
  [[ $head_repo == "$this_repo" ]] ||
    fail "a pull request from the fork \`$head_repo\` receives no SONAR_TOKEN, so the bar cannot be verified here; land it from a branch of $this_repo"
  if [[ $pr_author == "$bot" ]]; then
    while IFS= read -r author; do
      [[ -n $author ]] || continue
      [[ $author == "$bot" ]] ||
        fail "commit authored by \`$author\` on a Dependabot branch: a change nobody analysed is exactly what this gate refuses, so move it to its own pull request"
    done <<<"${COMMIT_AUTHORS-}"
    pass "Dependabot pull request #$pr_number: every commit is $bot's, and $bot authors manifests and pinned references rather than source, so no analysable change went unread"
  fi
  ;;
*) fail "no analysis runs for a \`$event\` event and this gate has no rule for it; the bar was not verified" ;;
esac

# The analysed path. The scan ran under this token and waited on the
# platform's gate, so reaching here means an analysis of this event
# exists; an absent token is the one way that could silently not have
# happened.
[[ -n ${SONAR_TOKEN-} ]] ||
  fail "an analysis is expected for this \`$event\` but SONAR_TOKEN is absent, so the scan step skipped instead of running; the bar was not verified"

# The house bar, read back from that analysis. Node is on the path of
# every job that runs this script (the install step precedes it), and
# its own `fetch` keeps the read free of a JSON tool the runner would
# have to provide.
export PROJECT_KEY=$project_key
node --input-type=module - <<'JS'
const host = (process.env.SONAR_HOST_URL ?? 'https://sonarcloud.io').replace(/\/+$/u, '')
const token = process.env.SONAR_TOKEN
const project = process.env.PROJECT_KEY
const event = process.env.EVENT_NAME
const headSha = process.env.HEAD_SHA
const isPullRequest = event === 'pull_request'
const scope = isPullRequest
  ? { pullRequest: process.env.PR_NUMBER ?? '' }
  : { branch: process.env.BRANCH ?? '' }

// `GT` rejects a measure above the threshold, `LT` one below it — the
// same vocabulary the platform's gate conditions use.
const NEW_CODE_BAR = [
  { comparator: 'GT', metric: 'new_violations', threshold: 0 },
  { comparator: 'GT', metric: 'new_duplicated_lines_density', threshold: 0 },
  { comparator: 'LT', metric: 'new_coverage', threshold: 100 },
  { comparator: 'LT', metric: 'new_security_hotspots_reviewed', threshold: 100 },
]
const OVERALL_BAR = [
  { comparator: 'GT', metric: 'violations', threshold: 0 },
  { comparator: 'GT', metric: 'duplicated_lines_density', threshold: 0 },
  { comparator: 'LT', metric: 'coverage', threshold: 100 },
  { comparator: 'LT', metric: 'security_hotspots_reviewed', threshold: 100 },
]
const HOUSE_BAR = isPullRequest ? NEW_CODE_BAR : [...NEW_CODE_BAR, ...OVERALL_BAR]

const ATTEMPTS = 3
const RETRY_DELAY_MS = 2000
// Per request: three stalled attempts must still report inside the
// Sonar job's 15-minute timeout, where undici's 300 s default would not.
const REQUEST_TIMEOUT_MS = 60_000

const fail = (message) => {
  console.error(`error: ${message}`)
  process.exit(1)
}

const sleep = async (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

// A 5xx, a 429 (the platform's documented rate limit) or a dropped
// connection is the platform's transient failure, retried briefly;
// anything else is a verdict on the request itself.
const get = async (path, params) => {
  const url = new URL(`${host}/api/${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const headers = { authorization: `Bearer ${token}` }
  for (let attempt = 1; ; attempt += 1) {
    let detail
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (response.ok) {
        return await response.json()
      }
      detail = `HTTP ${response.status}`
      if (response.status < 500 && response.status !== 429) {
        fail(`${path}: ${detail}`)
      }
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error)
    }
    if (attempt === ATTEMPTS) {
      fail(`${path}: ${detail} after ${attempt} attempts`)
    }
    await sleep(RETRY_DELAY_MS * attempt)
  }
}

const describeScope = () =>
  isPullRequest ? `pull request #${scope.pullRequest}` : `branch \`${scope.branch}\``

// The analysis the measures belong to must be this commit's: the job
// runs after the leg that uploaded it, but a sibling run on the same
// branch could have published since.
const verifyRevision = async () => {
  const published = isPullRequest
    ? (await get('project_pull_requests/list', { project })).pullRequests
        .find((pullRequest) => String(pullRequest.key) === scope.pullRequest)
    : (await get('project_branches/list', { project })).branches
        .find((branch) => branch.name === scope.branch)
  if (published === undefined) {
    fail(`no analysis of ${describeScope()} is published for ${project}; the bar was not verified`)
  }
  const revision = published.commit?.sha ?? ''
  if (revision !== headSha) {
    fail(`the published analysis of ${describeScope()} is of ${revision}, not of this commit ${headSha}; re-run the workflow so the bar is read on its own analysis`)
  }
  return revision
}

const readMeasures = async () => {
  const { component } = await get('measures/component', {
    component: project,
    metricKeys: HOUSE_BAR.map(({ metric }) => metric).join(','),
    ...scope,
  })
  return new Map(
    component.measures.map((measure) => [
      measure.metric,
      measure.value ?? measure.periods?.[0]?.value,
    ]),
  )
}

const revision = await verifyRevision()
const measures = await readMeasures()
const rejected = []
const read = []
for (const { comparator, metric, threshold } of HOUSE_BAR) {
  const value = measures.get(metric)
  if (value === undefined) {
    read.push(`${metric}: no measure (empty window)`)
    continue
  }
  const actual = Number(value)
  read.push(`${metric}=${value}`)
  const beyond = comparator === 'GT' ? actual > threshold : actual < threshold
  if (Number.isNaN(actual) || beyond) {
    rejected.push(`${metric} is ${value}, the bar is ${comparator === 'GT' ? 'at most' : 'at least'} ${threshold}`)
  }
}
if (rejected.length > 0) {
  fail(`the house bar rejects ${describeScope()} (analysis ${revision}): ${rejected.join('; ')}`)
}
console.log(`the house bar holds on ${describeScope()} (analysis ${revision}): ${read.join(', ')}`)
JS

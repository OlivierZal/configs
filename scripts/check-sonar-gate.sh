#!/usr/bin/env bash
# Turns the `Olivierzal way` quality gate into a status check, and
# refuses to report success on anything it did not verify. The bar is
# stated once in the gate, for the whole organisation; this reads its
# verdict for the commit under review.
#
# Three outcomes, never blurred:
#   verified compliant   -> success, printing the measures it read
#   verified violating   -> failure, naming the metric and its value
#   could not verify     -> failure, saying why (unreachable, not yet
#                           computed, absent analysis, unexpected event)
#
# The one case where an absent analysis is accepted is itself verified
# rather than assumed. SonarCloud never runs on a Dependabot pull
# request. A path to change that EXISTS — on Dependabot-triggered runs
# `secrets.*` resolves from the Dependabot secrets store, so registering
# SONAR_TOKEN there would make these pull requests genuinely analysed —
# and it is refused on threat model, not inexistence: the token would
# enter the environment of the job that installs the very dependency
# version under review, and scoping it to the scan step does not close
# that (an install script can poison $GITHUB_ENV and read a later
# step's environment). Re-evaluate if that model changes. So a
# Dependabot pull request is accepted only once this script has
# established that every commit on it is Dependabot's own and that it
# touches nothing but manifests and pinned action references. A hand- or
# agent-authored commit on such a branch is not a theoretical case: the
# family's dependabot-fix workflow pushes fixes onto exactly these
# branches, and that is the hole this clause closes. Whatever it lets
# through is analysed anyway by the push build on the default branch,
# where this same gate runs unconditionally.
#
# Reads its context from the environment so the workflow keeps the
# GitHub expressions and this keeps the decisions.
set -euo pipefail

readonly api=${SONAR_API_BASE:-https://sonarcloud.io/api}
readonly bot='dependabot[bot]'
readonly attempts=${SONAR_POLL_ATTEMPTS:-30}
readonly delay=${SONAR_POLL_DELAY:-10}

# What Dependabot alone is able to author. A pull request of its own
# that stays inside this set cannot move a source metric: a version
# range and a pinned digest are values, not structure.
readonly default_allowlist='package.json
package-lock.json
.github/dependabot.yml
.github/workflows/*.yml
.github/actions/*
.github/actions/*/*'

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
readonly head_sha=${HEAD_SHA-}
readonly merge_sha=${MERGE_SHA-}
readonly branch=${BRANCH-}

[[ -n $event ]] || fail 'EVENT_NAME is empty; this gate needs its trigger'

project_key=${SONAR_PROJECT_KEY-}
if [[ -z $project_key && -f sonar-project.properties ]]; then
  project_key=$(sed -n 's/^sonar\.projectKey=\(.*\)$/\1/p' sonar-project.properties)
fi

# A repo with neither a project nor a token has opted out of Sonar in
# writing, and that is the only silence this gate accepts. One without
# the other is a misconfiguration that would otherwise read as a pass.
if [[ -z $project_key ]]; then
  [[ -z ${SONAR_TOKEN-} ]] ||
    fail 'SONAR_TOKEN is set but no sonar.projectKey was found; the gate cannot name the project to verify'
  pass 'no Sonar project is declared for this repo; nothing to gate'
fi
# Mirrors the upload condition of the test job. Kept as one expression
# so the two cannot drift into a gate that waits for an analysis nobody
# uploads, or that skips one that exists.
analysis_expected() {
  case $event in
  push) return 0 ;;
  pull_request)
    [[ $pr_author != "$bot" && $head_repo == "$this_repo" ]] && return 0
    return 1
    ;;
  *) return 1 ;;
  esac
}

matches_allowlist() {
  local file=$1 pattern
  local allowlist=${SONAR_SCOPE_ALLOWLIST:-$default_allowlist}
  while IFS= read -r pattern; do
    [[ -n $pattern ]] || continue
    # shellcheck disable=SC2053 -- the right-hand side is a glob on purpose
    [[ $file == $pattern ]] && return 0
  done <<<"$allowlist"
  return 1
}

# The accepted-without-analysis branch. Every clause states a fact this
# script checked; none of them is an assumption about who opened what.
accept_unanalysed() {
  [[ $event == pull_request ]] ||
    fail "no analysis runs for a \`$event\` event and this gate has no rule for it; the bar was not verified"
  [[ $head_repo == "$this_repo" ]] ||
    fail "a pull request from the fork \`$head_repo\` receives no SONAR_TOKEN, so the bar cannot be verified here; land it from a branch of $this_repo"
  [[ $pr_author == "$bot" ]] ||
    fail "no analysis exists for this pull request and its author \`$pr_author\` is not $bot; the bar was not verified"

  local author
  while IFS= read -r author; do
    [[ -n $author ]] || continue
    [[ $author == "$bot" ]] ||
      fail "commit authored by \`$author\` on a Dependabot branch: a change nobody analysed is exactly what this gate refuses, so move it to its own pull request"
  done <<<"${COMMIT_AUTHORS-}"

  local file
  while IFS= read -r file; do
    [[ -n $file ]] || continue
    matches_allowlist "$file" ||
      fail "\`$file\` is outside what Dependabot alone authors, so this pull request changes something no analysis has read"
  done <<<"${CHANGED_FILES-}"

  pass "Dependabot pull request #$pr_number: every commit is $bot's and every file is a manifest or a pinned reference, so no analysable source changed"
}

api_get() {
  local path=$1 out=$2 code
  code=$(
    curl -sS --max-time 30 -o "$out" -w '%{http_code}' \
      -H "Authorization: Bearer ${SONAR_TOKEN-}" "$api/$path"
  ) || return 1
  [[ $code == 200 ]] || {
    printf 'SonarCloud returned HTTP %s for %s\n' "$code" "$path" >&2
    return 1
  }
}

# Waits for the analysis of THIS commit rather than for any analysis:
# the previous one is already there, and reading it would hold the bar
# against code that is not under review.
wait_for_analysis() {
  local path revisions attempt=1
  if [[ $event == pull_request ]]; then
    path="project_pull_requests/list?project=$project_key"
    revisions='.pullRequests?.filter((entry) => String(entry?.key) === wanted).map((entry) => entry?.commit?.sha)'
  else
    path="project_analyses/search?project=$project_key&branch=$branch&ps=1"
    revisions='.analyses?.map((entry) => entry?.revision)'
  fi
  while ((attempt <= attempts)); do
    if api_get "$path" analysis.json && node -e '
        const { readFileSync } = require("node:fs")
        const [, file, wanted, ...shas] = process.argv
        const parsed = JSON.parse(readFileSync(file, "utf8"))
        const found = (parsed'"$revisions"' ?? []).filter(Boolean)
        process.exit(found.some((sha) => shas.includes(sha)) ? 0 : 1)
      ' analysis.json "$pr_number" "$head_sha" "$merge_sha"; then
      printf 'analysis found for %s after %s attempt(s)\n' \
        "${head_sha:-$merge_sha}" "$attempt"
      return 0
    fi
    ((attempt < attempts)) && sleep "$delay"
    ((attempt++))
  done
  fail "no SonarCloud analysis for this commit appeared within $((attempts * delay))s; it may still be queued — re-run this job rather than merging on an unverified bar"
}

analysis_expected || accept_unanalysed

# Only the analysed path needs the token, which is why this sits below
# the branch: a Dependabot pull request legitimately has none.
[[ -n ${SONAR_TOKEN-} ]] ||
  fail "an analysis is expected for this \`$event\` but SONAR_TOKEN is absent; the bar cannot be verified"

wait_for_analysis

# The bar itself lives in the `Olivierzal way` quality gate, which
# states it once for the whole organisation instead of restating it in
# every consumer's CI. This reads that gate's verdict rather than the
# measures behind it.
#
# Which window applies is the platform's own split, not a choice made
# here: SonarCloud applies a gate's new-code conditions to a pull
# request analysis and leaves its overall ones aside, then applies both
# on a branch. That lands exactly where the house reasoning did — a pull
# request answers for the code it introduces, and an overall at zero
# stays at zero by induction — while an analyser update raising issues
# on untouched code surfaces on the default branch, loud and blocking
# nobody's review.
if [[ $event == pull_request ]]; then
  readonly status_path="qualitygates/project_status?projectKey=$project_key&pullRequest=$pr_number"
else
  readonly status_path="qualitygates/project_status?projectKey=$project_key&branch=$branch"
fi

api_get "$status_path" status.json ||
  fail 'SonarCloud could not be read for the quality gate; the bar was not verified — re-run this job'

# An absent verdict is the third outcome, never a pass: a gate that
# greens what it could not read is worse than none.
node -e '
  const { readFileSync } = require("node:fs")
  const status = JSON.parse(readFileSync(process.argv[1], "utf8"))?.projectStatus
  const verdict = status?.status
  if (verdict !== "OK" && verdict !== "ERROR") {
    console.error(
      `error: SonarCloud reported no quality-gate verdict (${verdict ?? "absent"}); the bar was not verified`,
    )
    process.exit(1)
  }
  const conditions = status.conditions ?? []
  const describe = ({ actualValue, comparator, errorThreshold, metricKey }) =>
    `${metricKey}=${actualValue ?? "absent"} (fails ${comparator} ${errorThreshold})`
  if (verdict === "ERROR") {
    const failed = conditions.filter((one) => one?.status === "ERROR")
    console.error(
      `error: the quality gate rejects this analysis — ${failed.map(describe).join(", ")}`,
    )
    process.exit(1)
  }
  console.log(
    `the quality gate holds: ${conditions.map(({ actualValue, metricKey }) => `${metricKey}=${actualValue ?? "n/a"}`).join(", ")}`,
  )
' status.json

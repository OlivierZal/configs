#!/usr/bin/env bash
# Reports the one thing the scanner cannot: a quality gate that was
# never consulted.
#
# The bar is stated once for the whole organisation, in the
# `Olivierzal way` quality gate, and the scan step waits on its verdict
# (`sonar.qualitygate.wait=true`). A violation therefore fails the leg
# that uploaded the analysis, on both windows at once — SonarCloud
# applies a gate's new-code conditions to a pull request and both its
# windows to a branch. Nothing here restates or re-reads that.
#
# What a waiting scanner cannot report is a scan that never ran: a
# skipped step fails nothing, and an unanalysed pull request would reach
# the default branch with every check green. That is this gate's whole
# remit, and it admits exactly two silences, each verified rather than
# assumed:
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
# theoretical precaution: the family's dependabot-fix workflow pushes
# agent-authored fixes onto exactly these branches, and that is the hole
# this clause closes. Dependabot itself authors manifests and pinned
# references, never source, so its own commits cannot move a metric —
# which is why their authorship is the whole check, and why the file
# list that used to accompany it added nothing.
#
# Reads its context from the environment so the workflow keeps the
# GitHub expressions and this keeps the decisions.
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

# Mirrors the upload condition of the test job. Kept as one expression
# so the two cannot drift into a gate that vouches for an analysis
# nobody uploaded, or that waves through one that exists.
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

  pass "Dependabot pull request #$pr_number: every commit is $bot's, and $bot authors manifests and pinned references rather than source, so no analysable change went unread"
}

analysis_expected || accept_unanalysed

# The analysed path. The scan ran under this token and waited on the
# gate, so reaching here means the bar was verified by the scanner
# itself; an absent token is the one way that could silently not have
# happened.
[[ -n ${SONAR_TOKEN-} ]] ||
  fail "an analysis is expected for this \`$event\` but SONAR_TOKEN is absent, so the scan step skipped instead of running; the bar was not verified"

pass "the analysis of this \`$event\` ran under the \`Olivierzal way\` gate, which the scanner waited on"

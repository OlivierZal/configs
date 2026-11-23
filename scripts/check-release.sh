#!/usr/bin/env bash
# Refuses to publish a commit its CI has not judged.
#
# A release publishes the commit its tag names, and nothing in the
# publish path looks at that commit again: the job installs without
# scripts, packs and publishes, and `prepublishOnly` never runs for a
# tarball. What stood behind a release was a habit, cutting it from a
# default branch whose CI had gone green. This script makes it a fact
# of the pipeline: the LATEST run of the caller's CI workflow on the
# default branch, for the commit being published, must have succeeded.
#
# The latest run, not any run: a commit whose CI has failed since (a
# scheduled run, a re-run) is not released until that CI is green
# again. And a run of the default branch itself: a tag put on a commit
# that branch never held has no such run to show.
#
# A prerelease is the one release cut from work in progress, so its
# commit may sit on any branch of the repository: the latest run that
# names it, whichever branch and whichever event, must have succeeded.
# A branch has such a run once it has a pull request.
#
# Five things are read on the run itself rather than assumed from the
# query: its commit, its workflow file, its branch, the repository that
# branch is in and its event. The repository, because the platform
# knows a branch by its name: a pull request from a fork whose branch
# bears the default branch's name is listed under it. The event,
# because a pull request headed by the default branch names that branch
# and its tip while it judges their merge into another branch.
#
# A release is often cut within seconds of the merge, while the run of
# its commit is still going or before the platform has even listed it:
# the read is repeated until that run has completed, eight minutes at
# the most. A run that outlasts them fails the job with the way out
# (re-run it once the CI has succeeded), and a commit still without a
# run by then never had one coming. A 5xx, a 429 or a dropped
# connection gets three attempts, each bounded so that the whole stays
# inside the job's timeout; any other status is a verdict on the
# request.
#
# Reads its context from the environment so the workflow keeps the
# GitHub expressions and this keeps the decisions. `IS_PRERELEASE` is
# the release event's own flag, `true` for a prerelease and anything
# else for a release. `GITHUB_API_URL` is the runner's own variable and
# defaults to GitHub.com. `POLL_SECONDS` is the pause between two reads
# of a verdict that is not in yet, fifteen unless a suite shortens it.
# The CI is the caller's `.github/workflows/ci.yml`, the name the
# family's callers all give it.
set -euo pipefail

fail() {
  local message=$1
  printf 'error: %s\n' "$message" >&2
  exit 1
}

[[ -n ${HEAD_SHA-} ]] || fail 'HEAD_SHA is empty; the release names no commit to judge'
[[ -n ${THIS_REPO-} ]] || fail 'THIS_REPO is empty; the runs of no repository can be read'
[[ -n ${DEFAULT_BRANCH-} ]] || fail 'DEFAULT_BRANCH is empty; the branch whose CI judges a release is unknown'
[[ -n ${GITHUB_TOKEN-} ]] || fail 'GITHUB_TOKEN is empty; the runs cannot be read'

# Node is on the path of the job that runs this script (the install
# step precedes it), and its own `fetch` keeps the read free of a JSON
# tool the runner would have to provide.
node --input-type=module - <<'JS'
const host = (process.env.GITHUB_API_URL ?? 'https://api.github.com').replace(/\/+$/u, '')
const token = process.env.GITHUB_TOKEN
const repo = process.env.THIS_REPO
const branch = process.env.DEFAULT_BRANCH
const headSha = process.env.HEAD_SHA
const isPrerelease = process.env.IS_PRERELEASE === 'true'
const workflow = 'ci.yml'
const workflowPath = `.github/workflows/${workflow}`

const ATTEMPTS = 3
const RETRY_DELAY_MS = 2000
// A verdict that is not in yet (a run still going, or not listed yet)
// is read again after a pause, thirty-two times at the most: eight
// minutes, where the CI of the family takes two and has not taken
// seven.
const POLLS = 32
const POLL_MS = Number(process.env.POLL_SECONDS ?? 15) * 1000
// Per request: a read that stalls gives up after a minute, where
// undici's 300 s default would let three of them outlast the job.
const REQUEST_TIMEOUT_MS = 60_000
// One page. A commit gathers a run per push, per scheduled day and per
// manual dispatch; more than a page of them on one commit is no state
// a release is cut from, and is refused rather than half-read.
const PAGE_SIZE = 100

const fail = (message) => {
  console.error(`error: ${message}`)
  process.exit(1)
}

const sleep = async (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

// A 5xx, a 429 or a dropped connection is the platform's transient
// failure, retried briefly; anything else is a verdict on the request
// itself (a 404 names a workflow file the repository does not have, a
// 403 a token without `actions: read`, or a rate limit under its other
// status, which no six seconds of retries would outlast).
const get = async (path, params) => {
  const url = new URL(`${host}/${path}`)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'x-github-api-version': '2022-11-28',
  }
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
        fail(`the runs of ${workflow} in ${repo} could not be read: ${detail}`)
      }
    } catch (error) {
      detail = error instanceof Error ? error.message : String(error)
    }
    if (attempt === ATTEMPTS) {
      fail(`the runs of ${workflow} in ${repo} could not be read: ${detail} after ${attempt} attempts`)
    }
    await sleep(RETRY_DELAY_MS * attempt)
  }
}

// What a run must be, beyond naming the commit in this repository's
// own workflow file. For a release, a run of the default branch
// itself: not a pull request's, even one headed by that branch. For a
// prerelease, any run, a pull request's first of all: the only CI a
// branch gets.
const judges = (run) =>
  isPrerelease || (run.head_branch === branch && run.event !== 'pull_request')

// The latest run that judges the commit, if there is one yet. The
// query names the commit alone, and each run is still held to it: a
// filter the platform stopped honouring cannot pass a sibling's run.
// The branch is read here with its repository rather than asked for,
// since the platform would answer for every branch of that name.
const readLatest = async () => {
  const { total_count: total, workflow_runs: listed } = await get(
    `repos/${repo}/actions/workflows/${workflow}/runs`,
    { head_sha: headSha, per_page: String(PAGE_SIZE) },
  )
  if (!Array.isArray(listed) || typeof total !== 'number') {
    fail(`the runs of ${workflow} in ${repo} came back in a shape this read does not know; the commit was not judged`)
  }
  if (total > listed.length) {
    fail(`${total} runs of ${workflow} name ${headSha}, more than the ${listed.length} read; the latest cannot be told from here`)
  }
  const runs = listed.filter(
    (run) =>
      run.head_sha === headSha &&
      run.head_repository?.full_name === repo &&
      run.path === workflowPath &&
      judges(run),
  )
  return runs.length === 0
    ? undefined
    : runs.reduce((newest, run) =>
        run.run_number > newest.run_number ? run : newest,
      )
}

const nameOf = (run) =>
  `run #${run.run_number} of ${workflow} on \`${run.head_branch}\``

const isPending = (run) => run === undefined || run.status !== 'completed'

let latest = await readLatest()
for (let polls = 0; isPending(latest) && polls < POLLS; polls += 1) {
  if (polls === 0) {
    console.log(
      latest === undefined
        ? `no run of ${workflow} judges ${headSha} yet: waiting for one`
        : `${nameOf(latest)} is ${latest.status} for ${headSha}: waiting for it to complete`,
    )
  }
  await sleep(POLL_MS)
  latest = await readLatest()
}
if (latest === undefined) {
  fail(
    isPrerelease
      ? `${workflow} never ran in ${repo} for ${headSha}: a prerelease is cut from a commit its CI has judged, on a branch that has a pull request`
      : `${workflow} never ran on \`${branch}\` for ${headSha}: a release is cut from a commit of the default branch that its CI has judged`,
  )
}
const name = nameOf(latest)
if (latest.status !== 'completed') {
  fail(`${name} is still ${latest.status} for ${headSha}: re-run this job once it has succeeded`)
}
if (latest.conclusion !== 'success') {
  fail(`${name} concluded ${latest.conclusion} for ${headSha}: only a run that succeeded releases a commit. Re-run it if it can pass, then this job; otherwise release a later commit`)
}
console.log(`the CI has judged this commit: ${name} succeeded for ${headSha}`)
JS

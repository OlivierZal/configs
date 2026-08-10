#!/usr/bin/env bash
# Proves the coverage leg the caller asked for is a leg that exists.
#
# The reusable CI picks that leg by comparing every `matrix.node-version`
# against `inputs.coverage-node-version`. A value no leg carries makes
# each comparison false, so `npm test -- --coverage` and the Sonar
# upload it feeds never run — behind three green legs, with no missing
# required context to notice (`Test (Node latest)` and SonarCloud are
# both outside the required set) and no skipped step to read, since the
# step that would have been skipped is the one that never existed. A
# single mistyped character would publish a green run with no quality
# gate behind it.
#
# Entries must be quoted: `22.20` is JSON for the number 22.2, which
# names a different Node line than the string it was meant to be, and
# the disagreement would surface only as that same silent skip.
#
# Usage: check-coverage-leg.sh <node-versions-json> <coverage-node-version>
set -euo pipefail

readonly versions_json=${1-}
readonly coverage_version=${2-}

fail() {
  local message=$1
  printf 'error: %s\n' "$message" >&2
  exit 1
}

[[ -n $versions_json ]] ||
  fail 'usage: check-coverage-leg.sh <node-versions-json> <coverage-node-version>'
[[ -n $coverage_version ]] ||
  fail 'coverage-node-version is empty; name the leg coverage runs on'

# One entry per line — an entry is a Node version, so none can carry a
# newline. Every way the array can fail to describe a matrix is rejected
# here rather than degrading into the "no leg matched" silence this
# check exists to end.
versions=$(
  node -e '
    const raw = process.argv[1]
    const fail = (message) => {
      process.stderr.write(`error: ${message}\n`)
      process.exit(1)
    }
    let entries
    try {
      entries = JSON.parse(raw)
    } catch {
      fail(`node-versions is not valid JSON: ${raw}`)
    }
    if (!Array.isArray(entries) || entries.length === 0) {
      fail(`node-versions must be a non-empty JSON array, got: ${raw}`)
    }
    const unquoted = entries.filter((entry) => typeof entry !== "string")
    if (unquoted.length > 0) {
      fail(
        `node-versions entries must be quoted: ${JSON.stringify(unquoted)} ` +
          `installs and is compared as ${unquoted.map((entry) => JSON.stringify(String(entry))).join(", ")}`,
      )
    }
    if (entries.includes("")) {
      fail("node-versions holds an empty entry; every leg names a Node version")
    }
    process.stdout.write(entries.join("\n"))
  ' "$versions_json"
)

while IFS= read -r version; do
  [[ $version == "$coverage_version" ]] || continue
  printf 'coverage runs on the Node %s leg of %s\n' "$coverage_version" "$versions_json"
  exit 0
done <<<"$versions"

fail "coverage-node-version \`$coverage_version\` names no leg of node-versions $versions_json; coverage and the Sonar upload it feeds would never run"

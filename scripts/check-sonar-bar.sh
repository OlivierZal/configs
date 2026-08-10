#!/usr/bin/env bash
# Holds the house Sonar bar against one window of a SonarCloud analysis.
#
# The free-tier quality gate is not the bar and cannot be made into it:
# it tolerates 3 % duplication on new code, lets code smells through, and
# is not customizable. So `qualityGateStatus` being OK proves nothing
# this house cares about, and the bar is checked metric by metric here:
# zero issues of every kind, zero security hotspots, zero duplication,
# full coverage. One window per call, named by the caller — which window
# an event answers for is the gate's decision, not this script's.
#
# Missing metrics fail rather than pass. A metric this script cannot find
# is a metric it did not verify, and a gate that reports success on what
# it could not read is worse than no gate: it converts an unchecked merge
# into a documented one. The only tolerated absence is a new-code ratio
# on a window that added no new line, which the payload states itself
# through `new_lines`.
#
# Usage: check-sonar-bar.sh <overall|new> <measures-json-file>
set -euo pipefail

readonly mode=${1-}
readonly payload=${2-}

fail() {
  local message=$1
  printf 'error: %s\n' "$message" >&2
  exit 1
}

[[ -n $mode && -n $payload ]] ||
  fail 'usage: check-sonar-bar.sh <overall|new> <measures-json-file>'
[[ $mode == overall || $mode == new ]] ||
  fail "mode must be \`overall\` or \`new\`, got \`$mode\`"
[[ -f $payload ]] || fail "no such measures file: $payload"

node -e '
  const { readFileSync } = require("node:fs")

  const [, mode, file] = process.argv

  const fail = (message) => {
    process.stderr.write(`error: ${message}\n`)
    process.exit(1)
  }

  let parsed
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"))
  } catch (error) {
    fail(`measures payload is not valid JSON: ${error.message}`)
  }

  // SonarCloud reports an API-level error as a body, not a status the
  // caller can trust alone — an unreadable payload is an unverified bar.
  if (Array.isArray(parsed?.errors)) {
    fail(
      `SonarCloud refused the request: ${parsed.errors
        .map((entry) => entry?.msg ?? JSON.stringify(entry))
        .join("; ")}`,
    )
  }

  const measures = parsed?.component?.measures
  if (!Array.isArray(measures) || measures.length === 0) {
    fail(
      `the ${mode} payload carries no measures; the bar was not verified ` +
        "(an analysis for this commit may not exist)",
    )
  }

  // New-code figures arrive as a bare `value` on current SonarCloud and
  // under a period on older shapes. Reading both keeps the gate from
  // failing over a response shape rather than over the code.
  const read = (metric) => {
    const found = measures.find((measure) => measure?.metric === metric)
    if (found === undefined) {
      return undefined
    }
    const raw =
      found.value ?? found.period?.value ?? found.periods?.[0]?.value
    if (raw === undefined) {
      return undefined
    }
    const value = Number(raw)
    if (!Number.isFinite(value)) {
      fail(`metric \`${metric}\` is not a number: ${JSON.stringify(raw)}`)
    }
    return value
  }

  const problems = []

  const require0 = (metric, label) => {
    const value = read(metric)
    if (value === undefined) {
      problems.push(`\`${metric}\` is absent, so ${label} was not verified`)
      return
    }
    if (value !== 0) {
      problems.push(`${label}: ${value}, the bar is 0 (\`${metric}\`)`)
    }
  }

  // Coverage is owed only where there is something to cover. A window
  // made of workflow YAML and shell carries lines but no coverable one,
  // and demanding a ratio there would fail on the analyser rather than
  // on the code — so the payload states the count and this reads it.
  const requireFullCoverage = (metric, label, toCoverMetric) => {
    const toCover = read(toCoverMetric)
    const value = read(metric)
    if (toCover === undefined || toCover === 0) {
      if (value === undefined) {
        return
      }
    } else if (value === undefined) {
      problems.push(`\`${metric}\` is absent, so ${label} was not verified`)
      return
    }
    if (value !== undefined && value !== 100) {
      problems.push(`${label}: ${value} %, the bar is 100 % (\`${metric}\`)`)
    }
  }

  if (mode === "overall") {
    require0("violations", "open issues")
    require0("security_hotspots", "security hotspots")
    require0("duplicated_lines_density", "duplicated lines")
    requireFullCoverage("coverage", "coverage", "lines_to_cover")
  } else {
    require0("new_violations", "issues on new code")
    require0("new_security_hotspots", "security hotspots on new code")
    // A window that added no line has no ratio to report, and that is
    // the payload saying so rather than this script assuming it.
    const newLines = read("new_lines")
    if (newLines === undefined) {
      problems.push(
        "`new_lines` is absent, so an absent new-code ratio cannot be told " +
          "apart from an unverified one",
      )
    }
    if (newLines !== 0) {
      require0("new_duplicated_lines_density", "duplicated lines on new code")
    }
    requireFullCoverage("new_coverage", "coverage of new code", "new_lines_to_cover")
  }

  if (problems.length > 0) {
    fail(
      `the ${mode} window misses the house bar:\n` +
        problems.map((problem) => `  - ${problem}`).join("\n"),
    )
  }

  process.stdout.write(
    `the ${mode} window holds the house bar: ` +
      measures
        .map((measure) => `${measure.metric}=${measure.value ?? measure.period?.value ?? measure.periods?.[0]?.value}`)
        .join(", ") +
      "\n",
  )
' "$mode" "$payload"

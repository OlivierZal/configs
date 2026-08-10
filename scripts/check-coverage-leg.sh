#!/usr/bin/env bash
# Proves exactly one test leg carries `coverage: true`.
#
# The flag travels inside the leg it marks, so the class this once
# guarded — a separate input naming a leg that does not exist — can no
# longer be written. What is left is arithmetic, and only one side of it
# is silent: with no flagged leg, `npm test -- --coverage` and the Sonar
# upload it feeds never run, behind legs that all stay green, and nothing
# downstream notices because `Test (Node latest)` and SonarCloud sit
# outside every repo's required set. Two flagged legs would upload twice.
#
# Every other way to misstate the matrix now fails loudly on its own:
# malformed JSON stops `fromJSON` before any job starts, and a mistyped
# or unquoted version renames its leg, so the required status check of
# that name never reports and the merge blocks. None of that is repeated
# here — a second diagnosis of an already-noisy failure is upkeep with
# no reader.
#
# Usage: check-coverage-leg.sh <node-versions-json>
set -euo pipefail

node -e '
  const legs = JSON.parse(process.argv[1])
  const flagged = legs.filter((leg) => leg.coverage === true)
  if (flagged.length !== 1) {
    process.stderr.write(
      `error: ${flagged.length} of ${legs.length} legs carry ` +
        "`coverage: true`, need exactly one; coverage and the Sonar " +
        "upload it feeds run on that leg\n",
    )
    process.exit(1)
  }
  process.stdout.write(
    `coverage runs on the Node ${flagged[0]["node-version"]} leg\n`,
  )
' "${1-}"

#!/usr/bin/env bash
# Fails on any production advisory that has not been named and reasoned.
#
# `npm audit --audit-level=high --omit=dev` was honest about its own
# contract and still shipped vulnerable code: the extension carries four
# `moderate` advisories on the device and audits green. Raising the floor
# alone would trade that false green for a false red — the advisories
# come from `homey-api`'s pinned socket.io 2.x, the published version is
# already the newest, and a permanent red is a signal nobody reads.
#
# So the floor drops to `low` and every survivor must be named with the
# reason it survives. An allowlist entry is a verdict, not a suppression:
# it names one advisory id, carries the reasoning, and expires — an entry
# whose advisory no longer appears fails just as loudly as an advisory
# with no entry, because an exception that outlives its cause is a lie
# about what was reviewed.
#
# The report is read from a file rather than a pipe: `npm audit` exits
# non-zero precisely when it finds something, so a pipeline would
# conflate "found advisories" with "could not run" — and this check
# must never report a clean run it did not perform.
#
# Usage: check-production-audit.sh <report-json> <audit-level> [exceptions]
set -euo pipefail

readonly report=${1-}
readonly level=${2-}
readonly exceptions=${3-}

fail() {
  printf 'error: %s\n' "$1" >&2
  exit 1
}

[[ -n $report ]] ||
  fail 'usage: check-production-audit.sh <report-json> <audit-level> [exceptions]'
[[ -n $level ]] || fail 'audit-level is empty; name the floor advisories must clear'
[[ -f $report ]] || fail "audit report \`$report\` does not exist; npm audit did not run"

AUDIT_LEVEL=$level AUDIT_EXCEPTIONS=$exceptions node -e '
  const { readFileSync } = require("node:fs")

  const RANK = ["info", "low", "moderate", "high", "critical"]

  const fail = (message) => {
    process.stderr.write(`error: ${message}\n`)
    process.exit(1)
  }

  const level = process.env.AUDIT_LEVEL
  if (!RANK.includes(level)) {
    fail(`audit-level \`${level}\` is not one of ${RANK.join(", ")}`)
  }
  const floor = RANK.indexOf(level)

  const raw = readFileSync(process.argv[1], "utf8").trim()
  if (raw === "") {
    fail("audit report is empty; npm audit produced no output")
  }
  let report
  try {
    report = JSON.parse(raw)
  } catch {
    fail(`audit report is not valid JSON: ${raw.slice(0, 200)}`)
  }
  // npm reports a failed run as JSON too — a green verdict must never be
  // read out of an error object.
  if (report.error) {
    fail(`npm audit failed: ${JSON.stringify(report.error)}`)
  }
  if (typeof report.vulnerabilities !== "object" || report.vulnerabilities === null) {
    fail("audit report carries no `vulnerabilities` map; this is not an npm audit report")
  }

  // One advisory reaches the tree through several packages — the
  // extension carries one ReDoS as four entries. Identity is the GHSA id
  // so an exception names the finding, never the packages it happens to
  // travel through today.
  const advisories = new Map()
  for (const vulnerability of Object.values(report.vulnerabilities)) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via !== "object" || via === null) {
        continue
      }
      const id = /GHSA-[\w-]+/.exec(via.url ?? "")?.[0]
      if (id === undefined || RANK.indexOf(via.severity) < floor) {
        continue
      }
      advisories.set(id, { severity: via.severity, title: via.title ?? "", url: via.url })
    }
  }

  const allowed = new Map()
  for (const line of (process.env.AUDIT_EXCEPTIONS ?? "").split("\n")) {
    const entry = line.trim()
    if (entry === "") {
      continue
    }
    const match = /^(?<id>GHSA-[\w-]+)\s*[:—-]?\s*(?<reason>.*)$/.exec(entry)
    if (!match?.groups) {
      fail(`audit exception \`${entry}\` does not start with a GHSA id`)
    }
    const { id, reason } = match.groups
    // An exception without its reasoning is the silent suppression this
    // mechanism exists to replace.
    if (reason.trim() === "") {
      fail(`audit exception \`${id}\` carries no reason; name why it is tolerated`)
    }
    allowed.set(id, reason.trim())
  }

  const unexpected = [...advisories].filter(([id]) => !allowed.has(id))
  const stale = [...allowed].filter(([id]) => !advisories.has(id))

  for (const [id, reason] of allowed) {
    if (advisories.has(id)) {
      const { severity, title } = advisories.get(id)
      process.stdout.write(`tolerated ${id} (${severity}) ${title}\n  ${reason}\n`)
    }
  }

  for (const [id, { severity, title, url }] of unexpected) {
    process.stderr.write(`unnamed ${severity} advisory ${id}: ${title}\n  ${url}\n`)
  }
  for (const [id, reason] of stale) {
    process.stderr.write(
      `stale exception ${id}: the advisory no longer reaches production\n  ${reason}\n`,
    )
  }

  if (unexpected.length > 0) {
    const one = unexpected.length === 1
    fail(
      `${unexpected.length} production advisor${one ? "y" : "ies"} at or above ` +
        `\`${level}\` ship${one ? "s" : ""} to the device unnamed; fix ${one ? "it" : "them"} ` +
        "or record the verdict in audit-exceptions",
    )
  }
  if (stale.length > 0) {
    fail(
      `${stale.length} audit exception${stale.length === 1 ? "" : "s"} outlived ` +
        `${stale.length === 1 ? "its" : "their"} advisory; delete ${stale.length === 1 ? "it" : "them"} from audit-exceptions`,
    )
  }

  process.stdout.write(
    `no production advisory at or above \`${level}\` outside ${allowed.size} recorded exception${allowed.size === 1 ? "" : "s"}\n`,
  )
' "$report"

#!/usr/bin/env bash
# Proves the lock resolves no prerelease that nobody wrote down.
#
# A prerelease reaches a lock two ways. A manifest NAMES it, exactly,
# and it is as fixed as a release: a library's alpha is pinned in the
# consumer that tries it and pins the alphas it was built on, and a
# fresh resolution of this package holds `@emnapi/core@2.0.0-beta.2`
# because `@rolldown/binding-wasm32-wasi` asks for that very version.
# Or a RANGE admits it, and npm takes the newest on the day the lock is
# written. Nobody chose that one, and the same manifest resolves to
# another the day a newer one is published: tomorrow for a nightly,
# which is also younger than the seven days Dependabot's `cooldown`
# waits.
#
# A name counts when the manifest that writes it is itself settled: the
# repository's own, a release's, or a prerelease so named in turn. Two
# prereleases a range picked do not vouch for each other, which `vitest`
# and `@vitest/coverage-v8` would otherwise do, each naming the other at
# its own version, betas included.
#
# The case that brought the check (measured 2026-11-21, npm 10.9.8 and
# 11.20.0, each on a fresh resolution of this package's manifest):
# typescript-eslint 8.73 gives its parser an optional peer on
# `@typescript/native` at `>=7.1.0-dev.20261009.1`, for the experimental
# TypeScript 7.1 backend of its project service. The family installs
# the 7.0 compiler under that very name — the official 6/7 side-by-side
# layout — so the peer is there and too old, and npm settles it by
# nesting the day's NIGHTLY, `7.1.0-dev.20261121.1`, beneath
# `@typescript-eslint/utils`. Neither says a word of it afterwards: npm
# 10's `npm ci` installs the nightly, from either lock; npm 11 writes it
# `extraneous`, and its `npm ci` leaves it out.
#
# Usage: check-lock.sh [root]
set -euo pipefail

readonly root=${1:-.}

node --input-type=module - "$root/package-lock.json" <<'JS'
import { readFileSync } from 'node:fs'

const [lockPath] = process.argv.slice(2)
const { packages } = JSON.parse(readFileSync(lockPath, 'utf8'))
if (packages === undefined) {
  process.stderr.write(
    `error: ${lockPath} has no \`packages\` map (lockfileVersion 1?), nothing can be read from it\n`,
  )
  process.exit(1)
}

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]
const MODULES = 'node_modules/'
const PRERELEASE = /^\d+\.\d+\.\d+-/u

// What a manifest names: each `||` alternative of each spec, read past
// an `npm:` alias and the `=` and `v` npm itself reads past. A
// comparator, a caret or a tilde names nothing — it admits whatever is
// newest.
const namesOf = (entry) =>
  DEPENDENCY_FIELDS.flatMap((field) =>
    Object.entries(entry[field] ?? {}).flatMap(([name, spec]) =>
      spec.split('||').map(
        (alternative) =>
          `${name}@${alternative
            .trim()
            .replace(/^npm:.+@/u, '')
            .replace(/^=?\s*v?(?=\d)/u, '')}`,
      ),
    ),
  )

const entries = Object.entries(packages)
const locked = entries
  .filter(([path]) => path.includes(MODULES))
  .map(([path, entry]) => {
    const name = path.slice(path.lastIndexOf(MODULES) + MODULES.length)
    const { version = '' } = entry
    return { entry, key: `${name}@${version}`, name, path, version }
  })
const prereleases = locked.filter(({ version }) => PRERELEASE.test(version))

// The prereleases of `pool` that `names` reaches, each one reached
// lending its own names in turn.
const reach = (names, pool) => {
  const reached = new Set()
  for (;;) {
    const found = pool.filter(
      (item) => !reached.has(item) && names.has(item.key),
    )
    if (found.length === 0) {
      return reached
    }
    for (const item of found) {
      reached.add(item)
      for (const name of namesOf(item.entry)) {
        names.add(name)
      }
    }
  }
}

// Settled from the start: the repository's own manifests and every
// release, as the lock restates them.
const settledNames = new Set(
  entries
    .filter(
      ([path, { version = '' }]) =>
        !path.includes(MODULES) || !PRERELEASE.test(version),
    )
    .flatMap(([, entry]) => namesOf(entry)),
)
const settled = reach(settledNames, prereleases)
const floating = prereleases.filter((item) => !settled.has(item))

// One line per cause: a prerelease no manifest names at all, the rest
// of what floats following from it. Prereleases that only name each
// other have no such cause above them, and are all reported.
const everyName = new Set(entries.flatMap(([, entry]) => namesOf(entry)))
const causes = floating.filter(({ key }) => !everyName.has(key))
const explained = reach(
  new Set(causes.flatMap(({ entry }) => namesOf(entry))),
  floating,
)
const reported = floating.filter(
  (item) => causes.includes(item) || !explained.has(item),
)

if (reported.length > 0) {
  for (const { key, path } of reported) {
    process.stderr.write(
      `error: ${lockPath} resolves ${key} at ${path}, a prerelease only a range leads to\n`,
    )
  }
  process.stderr.write(
    'No manifest names it at an exact version, or only prereleases a ' +
      'range picked do: npm took the newest that range admits on the ' +
      'day the lock was written. `npm ls --package-lock-only <name>` ' +
      'names the dependency that asks for it: keep that dependency at ' +
      'the version the lock held before, or write the prerelease down ' +
      'in package.json, at an exact version, if it is wanted.\n',
  )
  process.exit(1)
}

process.stdout.write(
  `checked ${locked.length} locked package(s): ${prereleases.length} prerelease(s), none chosen by a range\n`,
)
JS

#!/usr/bin/env bash
# Proves the lock resolves no prerelease that nobody wrote down.
#
# A prerelease reaches a lock two ways. A manifest NAMES it, exactly,
# and it is as fixed as a release: a library's alpha is pinned in the
# consumer that tries it and pins the alphas it was built on, and a
# fresh resolution of this package holds `@emnapi/core@2.0.0-beta.2`
# because `@rolldown/binding-wasm32-wasi` asks for that very version.
# Or a RANGE admits it, and npm takes the newest on the day the lock is
# written. Nobody chose that one, it is younger than the seven days the
# family waits before taking a release, and the same manifest resolves
# to another tomorrow.
#
# The case that brought the check (measured 2026-11-21, npm 10.9.8 and
# 11.20.0, each on a fresh resolution of this package's manifest):
# typescript-eslint 8.73 gives its parser an optional peer on
# `@typescript/native` at `>=7.1.0-dev.20261009.1`, for the experimental
# TypeScript 7.1 backend of its project service. The family installs
# the 7.0 compiler under that very name — the official 6/7 side-by-side
# layout — so the peer is there and too old, and npm settles it by
# nesting the day's NIGHTLY, `7.1.0-dev.20261121.1`, beneath
# `@typescript-eslint/utils`. `npm ci` then installs that lock without a
# word.
#
# Usage: check-lock.sh [root]
set -euo pipefail

readonly root=${1:-.}

node --input-type=module - "$root/package-lock.json" <<'JS'
import { readFileSync } from 'node:fs'

const [lockPath] = process.argv.slice(2)
const { packages = {} } = JSON.parse(readFileSync(lockPath, 'utf8'))

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
]
const MODULES = 'node_modules/'
const PRERELEASE = /^\d+\.\d+\.\d+-/u

// What a spec names: each `||` alternative, read past an `npm:` alias
// and an `=`. A comparator, a caret or a tilde names nothing — it
// admits whatever is newest.
const namedBy = (spec) =>
  spec
    .split('||')
    .map((alternative) =>
      alternative.trim().replace(/^npm:.+@/u, '').replace(/^=/u, ''),
    )

// The root's manifest and every dependency's, as the lock restates them.
const named = new Set(
  Object.values(packages).flatMap((entry) =>
    DEPENDENCY_FIELDS.flatMap((field) =>
      Object.entries(entry[field] ?? {}).flatMap(([name, spec]) =>
        namedBy(spec).map((version) => `${name}@${version}`),
      ),
    ),
  ),
)

const locked = Object.entries(packages)
  .filter(([path]) => path.includes(MODULES))
  .map(([path, { version = '' }]) => ({
    name: path.slice(path.lastIndexOf(MODULES) + MODULES.length),
    path,
    version,
  }))
const prereleases = locked.filter(({ version }) => PRERELEASE.test(version))
const unnamed = prereleases.filter(
  ({ name, version }) => !named.has(`${name}@${version}`),
)

if (unnamed.length > 0) {
  for (const { name, path, version } of unnamed) {
    process.stderr.write(
      `error: ${lockPath} resolves ${name}@${version} at ${path}, a prerelease no manifest names\n`,
    )
  }
  process.stderr.write(
    'A range or an optional peer admitted it, and npm took the newest ' +
      'on the day the lock was written. `npm explain <name>` names the ' +
      'dependency that asks for it: keep that dependency at the version ' +
      'the lock held before, or write the prerelease down in ' +
      'package.json, at an exact version, if it is wanted.\n',
  )
  process.exit(1)
}

process.stdout.write(
  `checked ${locked.length} locked package(s): ${prereleases.length} prerelease(s), none chosen by a range\n`,
)
JS

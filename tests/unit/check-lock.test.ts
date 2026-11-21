import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  type RunResult,
  asArray,
  asRecord,
  repoRoot,
  reusableCi,
  runScript,
} from '../helpers.ts'

type Packages = Readonly<Record<string, Readonly<Record<string, unknown>>>>

const script = path.join(repoRoot, 'scripts/check-lock.sh')

// Each case writes the lock it describes: only `packages` is read, so
// a case states the few entries that make it and nothing else.
const check = (packages: Packages): RunResult => {
  const root = mkdtempSync(path.join(tmpdir(), 'lock-'))
  writeFileSync(
    path.join(root, 'package-lock.json'),
    JSON.stringify({ packages }),
  )
  return runScript(script, { args: [root] })
}

const NIGHTLY = '7.1.0-dev.20261121.1'

// The tree npm 10 and 11 both resolve from this package's manifest
// (2026-11-21), cut down to the entries that tell the story: the
// family's 7.0 compiler at the root, the parser's optional peer on a
// 7.1, and the nightly npm nests to settle it, with one of the binaries
// that nightly names in turn.
const nestedNightly: Packages = {
  '': { devDependencies: { '@typescript/native': 'npm:typescript@^7.0.2' } },
  'node_modules/@typescript/native': { version: '7.0.2' },
  'node_modules/@typescript-eslint/utils': { version: '8.73.0' },
  'node_modules/@typescript-eslint/utils/node_modules/@typescript/native': {
    optionalDependencies: { '@typescript/typescript-linux-x64': NIGHTLY },
    version: NIGHTLY,
  },
  'node_modules/@typescript-eslint/utils/node_modules/@typescript/typescript-linux-x64':
    { version: NIGHTLY },
  'node_modules/@typescript-eslint/utils/node_modules/@typescript-eslint/typescript-estree':
    {
      peerDependencies: {
        '@typescript/native':
          'npm:typescript@>=7.1.0-dev.20261009.1 || >=7.1.0-beta <7.1.0-dev',
      },
      version: '8.73.0',
    },
}

const checkSteps = asArray(
  asRecord(asRecord(reusableCi.jobs, 'jobs').check, 'check').steps,
  'steps',
)

describe('the lock check', () => {
  it('accepts a lock that holds no prerelease', () => {
    const { output, status } = check({
      '': { dependencies: { eslint: '^10.15.0' } },
      'node_modules/eslint': { version: '10.15.0' },
    })

    expect(status).toBe(0)
    expect(output).toContain('checked 1 locked package(s): 0 prerelease(s)')
  })

  // One line, for the entry nobody named: the binary beneath it is
  // named by the nightly's own manifest, and reporting it too would
  // bury the cause under its consequences.
  it('rejects the nightly an optional peer nests', () => {
    const { output, status } = check(nestedNightly)

    expect(status).toBe(1)
    expect(output).toContain(
      `resolves @typescript/native@${NIGHTLY} at node_modules/@typescript-eslint/utils/node_modules/@typescript/native`,
    )
    expect(output).not.toContain('typescript-linux-x64')
  })

  // A floor is not a name: the lock holds whichever prerelease was the
  // newest when it was written.
  it('rejects a prerelease resolved from a caret on an older one', () => {
    const { output, status } = check({
      'node_modules/@vitest/browser': { version: '5.0.0-beta.9' },
      'node_modules/vitest': {
        peerDependencies: { '@vitest/browser': '^5.0.0-beta.5 || >=5.0.0' },
        version: '5.0.0',
      },
    })

    expect(status).toBe(1)
    expect(output).toContain('resolves @vitest/browser@5.0.0-beta.9')
  })

  // The three ways a manifest writes a version down. The second is the
  // shape a fresh resolution of this package holds today
  // (`@rolldown/binding-wasm32-wasi` and `@napi-rs/wasm-runtime` on
  // `@emnapi/core`); the third is how the 6/7 layout spells a compiler.
  it.each([
    { name: 'on its own', spec: '2.0.0-beta.2' },
    { name: 'as one side of an alternative', spec: '^1.7.1 || 2.0.0-beta.2' },
    { name: 'behind an alias', spec: 'npm:core@2.0.0-beta.2' },
  ])('accepts a prerelease a dependency names $name', ({ spec }) => {
    const { output, status } = check({
      'node_modules/@emnapi/core': { version: '2.0.0-beta.2' },
      'node_modules/binding': {
        dependencies: { '@emnapi/core': spec },
        version: '1.0.0',
      },
    })

    expect(status).toBe(0)
    expect(output).toContain('1 prerelease(s), none chosen by a range')
  })

  // The libraries' alpha flow, on both of its sides: the consumer pins
  // the alpha it tries, that alpha pins the one it was built on, and
  // the library's own branch carries the alpha as its version.
  it('accepts the alphas of a release in progress', () => {
    const { status } = check({
      '': {
        dependencies: { '@olivierzal/melcloud-api': '63.0.0-alpha.0' },
        version: '47.0.0-alpha.0',
      },
      'node_modules/@olivierzal/api-core': { version: '3.0.0-alpha.1' },
      'node_modules/@olivierzal/melcloud-api': {
        dependencies: { '@olivierzal/api-core': '3.0.0-alpha.1' },
        version: '63.0.0-alpha.0',
      },
    })

    expect(status).toBe(0)
  })
})

describe('the reusable CI workflow', () => {
  // A script nothing runs guards nothing. The resolution assigns a path
  // and a separate line invokes it, so both halves are pinned.
  it('runs the lock check in the check job', () => {
    const run = checkSteps
      .map((step) => asRecord(step, 'step').run)
      .find(
        (candidate) =>
          typeof candidate === 'string' && candidate.includes('check-lock.sh'),
      )

    expect(run).toMatch(/^bash "\$script"$/mv)
  })
})

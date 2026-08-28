import { type SpawnSyncReturns, execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { parse } from 'yaml'

export interface RunResult {
  readonly output: string
  readonly status: number
}

export const repoRoot: string = fileURLToPath(new URL('..', import.meta.url))

const isSpawnError = (error: unknown): error is SpawnSyncReturns<string> =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  'stderr' in error

// A rejecting script surfaces as a throw: fold both outcomes into one
// result so the suites assert on status and stderr alike.
export const runScript = (
  script: string,
  {
    args = [],
    cwd,
    env,
  }: {
    readonly args?: readonly string[]
    readonly cwd?: string
    readonly env?: Readonly<Record<string, string>>
  } = {},
): RunResult => {
  try {
    return {
      output: execFileSync(script, args, { cwd, encoding: 'utf8', env }),
      status: 0,
    }
  } catch (error) {
    if (isSpawnError(error)) {
      return { output: error.stderr, status: error.status ?? 1 }
    }
    throw error
  }
}

// Throws instead of narrowing conditionally: the vitest rules ban
// conditional logic inside tests.
export const asRecord = (
  value: unknown,
  what: string,
): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`expected ${what} to be a mapping`)
  }
  return { ...value }
}

export const asString = (value: unknown, what: string): string => {
  if (typeof value !== 'string') {
    throw new TypeError(`expected ${what} to be a string`)
  }
  return value
}

export const asArray = (value: unknown, what: string): readonly unknown[] => {
  if (!Array.isArray(value)) {
    throw new TypeError(`expected ${what} to be a sequence`)
  }
  return value
}

export const reusableCi: Record<string, unknown> = asRecord(
  parse(
    readFileSync(
      path.join(repoRoot, '.github/workflows/reusable-ci.yml'),
      'utf8',
    ),
  ),
  'reusable-ci.yml',
)

import { type SpawnSyncReturns, execFileSync, spawn } from 'node:child_process'
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
// result so the suites assert on status and output alike — `output` is
// stdout when the script exits 0 and stderr when it does not. `env` is
// the script's WHOLE environment, not an overlay: a suite that wants
// the runner's variables spreads `process.env` in itself.
export const runScript = (
  script: string,
  {
    args = [],
    cwd,
    env,
  }: {
    readonly args?: readonly string[]
    readonly cwd?: string
    readonly env?: NodeJS.ProcessEnv
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

export interface Stub {
  readonly host: string
  readonly stop: () => void
}

// Starts a stand-in server (`tests/stub-server.ts`) as a process of its
// own and answers the address it listens on. Its stdin is piped: the
// stand-in exits when this end closes, so a killed worker leaves no
// server behind.
export const startStub = async (script: string): Promise<Stub> => {
  const stub = spawn(process.execPath, [script], {
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  const host = await new Promise<string>((resolve, reject) => {
    stub.stdout.on('data', (chunk: Buffer) => {
      const port = /PORT=(?<port>\d+)/v.exec(chunk.toString())?.groups?.port
      if (port !== undefined) {
        resolve(`http://127.0.0.1:${port}`)
      }
    })
    stub.on('error', reject)
    // A stand-in that dies before it listens prints no port: name the
    // exit instead of waiting on it.
    stub.on('exit', (code) => {
      reject(new Error(`the stand-in exited with ${String(code)}`))
    })
  })
  return {
    host,
    stop: (): void => {
      stub.kill()
    },
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

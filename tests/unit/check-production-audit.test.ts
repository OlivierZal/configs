import { type SpawnSyncReturns, execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const script = path.join(repoRoot, 'scripts/check-production-audit.sh')

const PARSEURI = 'GHSA-6fx8-h7jm-663j'
const REASON = `${PARSEURI} — reached only through the SDK's own local URL`

// The shape npm emits: one advisory reaches the tree through several
// packages, so the report names it more than once and identity has to be
// the GHSA id rather than the package.
const advisory = (severity: string): string =>
  JSON.stringify({
    metadata: { vulnerabilities: { total: 2 } },
    vulnerabilities: {
      'engine.io-client': { severity, via: ['parseuri'] },
      parseuri: {
        severity,
        via: [
          {
            name: 'parseuri',
            severity,
            title: 'parse-uri Regular expression Denial of Service (ReDoS)',
            url: `https://github.com/advisories/${PARSEURI}`,
          },
        ],
      },
    },
  })

const CLEAN = JSON.stringify({
  metadata: { vulnerabilities: { total: 0 } },
  vulnerabilities: {},
})

const tmp = mkdtempSync(path.join(os.tmpdir(), 'audit-'))

const reportAt = (contents: string, name: string): string => {
  const file = path.join(tmp, `${name}.json`)
  writeFileSync(file, contents)
  return file
}

interface CheckResult {
  readonly output: string
  readonly status: number
}

const isSpawnError = (error: unknown): error is SpawnSyncReturns<string> =>
  typeof error === 'object' &&
  error !== null &&
  'status' in error &&
  'stderr' in error

const check = (
  report: string,
  level: string,
  exceptions: string,
): CheckResult => {
  try {
    return {
      output: execFileSync(script, [report, level, exceptions], {
        encoding: 'utf8',
      }),
      status: 0,
    }
  } catch (error) {
    if (isSpawnError(error)) {
      return {
        output: `${error.stdout}${error.stderr}`,
        status: error.status ?? 1,
      }
    }
    throw error
  }
}

const asRecord = (value: unknown, what: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`expected ${what} to be a mapping`)
  }
  return { ...value }
}

const asString = (value: unknown, what: string): string => {
  if (typeof value !== 'string') {
    throw new TypeError(`expected ${what} to be a string`)
  }
  return value
}

const isSequence = (value: unknown): value is readonly unknown[] =>
  Array.isArray(value)

const asArray = (value: unknown, what: string): readonly unknown[] => {
  if (!isSequence(value)) {
    throw new TypeError(`expected ${what} to be a sequence`)
  }
  return value
}

const workflow = asRecord(
  parse(
    readFileSync(
      path.join(repoRoot, '.github/workflows/reusable-audit.yml'),
      'utf8',
    ),
  ),
  'reusable-audit.yml',
)
const auditSteps = asArray(
  asRecord(asRecord(workflow.jobs, 'jobs').audit, 'audit').steps,
  'steps',
)
const inputs = asRecord(
  asRecord(asRecord(workflow.on, 'on').workflow_call, 'workflow_call').inputs,
  'inputs',
)
const runs = auditSteps
  .map((step) => asRecord(step, 'step').run)
  .filter((run) => typeof run === 'string')
  .join('\n')

describe('the production-audit check', () => {
  it('passes a clean report', () => {
    const { output, status } = check(reportAt(CLEAN, 'clean'), 'low', '')

    expect(status).toBe(0)
    expect(output).toContain('no production advisory at or above `low`')
  })

  // The defect this replaces: four moderate advisories shipped to the
  // device behind a green `--audit-level=high` audit.
  it('fails a moderate advisory that no exception names', () => {
    const { output, status } = check(
      reportAt(advisory('moderate'), 'moderate'),
      'low',
      '',
    )

    expect(status).toBe(1)
    expect(output).toContain(`unnamed moderate advisory ${PARSEURI}`)
    expect(output).toContain('ships to the device unnamed')
  })

  it('tolerates it once recorded, and says so with the reason', () => {
    const { output, status } = check(
      reportAt(advisory('moderate'), 'named'),
      'low',
      REASON,
    )

    expect(status).toBe(0)
    expect(output).toContain(`tolerated ${PARSEURI} (moderate)`)
    expect(output).toContain("reached only through the SDK's own local URL")
  })

  // An exception that outlives its cause misrepresents what was
  // reviewed, so it fails as loudly as an unnamed advisory.
  it('fails an exception whose advisory no longer reaches production', () => {
    const { output, status } = check(reportAt(CLEAN, 'stale'), 'low', REASON)

    expect(status).toBe(1)
    expect(output).toContain(`stale exception ${PARSEURI}`)
    expect(output).toContain('outlived its advisory')
  })

  // Identity is the advisory, not the package: a second finding in the
  // same dependency is a new verdict to make, not one already made.
  it('fails a different advisory in an already-excepted package', () => {
    const other = advisory('high').replaceAll(PARSEURI, 'GHSA-aaaa-bbbb-cccc')
    const { status } = check(reportAt(other, 'other'), 'low', REASON)

    expect(status).toBe(1)
  })

  it.each([
    { exceptions: PARSEURI, expected: 'carries no reason', name: 'reasonless' },
    {
      exceptions: 'parseuri is fine',
      expected: 'does not start with a GHSA id',
      name: 'unidentified',
    },
  ])('rejects a $name exception', ({ exceptions, expected, name }) => {
    const { output, status } = check(
      reportAt(advisory('moderate'), `exc-${name}`),
      'low',
      exceptions,
    )

    expect(status).toBe(1)
    expect(output).toContain(expected)
  })

  // A gate that cannot verify must not report a clean run: every way the
  // collect step can fail lands here rather than in a green audit.
  it.each([
    {
      contents: '{"error":{"code":"ENETUNREACH"}}',
      expected: 'npm audit failed',
      name: 'an npm error object',
    },
    { contents: '', expected: 'is empty', name: 'an empty report' },
    {
      contents: 'npm ERR! code ENOTFOUND',
      expected: 'not valid JSON',
      name: 'non-JSON output',
    },
    {
      contents: '{"metadata":{}}',
      expected: 'carries no `vulnerabilities` map',
      name: 'a foreign JSON document',
    },
  ])('refuses to pass on $name', ({ contents, expected, name }) => {
    const { output, status } = check(
      reportAt(contents, `bad-${name.replaceAll(' ', '-')}`),
      'low',
      '',
    )

    expect(status).toBe(1)
    expect(output).toContain(expected)
  })

  it('rejects a level outside npm severities', () => {
    const { output, status } = check(reportAt(CLEAN, 'level'), 'severe', '')

    expect(status).toBe(1)
    expect(output).toContain('is not one of')
  })

  it('reports a missing report rather than passing', () => {
    const { output, status } = check(path.join(tmp, 'absent.json'), 'low', '')

    expect(status).toBe(1)
    expect(output).toContain('npm audit did not run')
  })
})

describe('the reusable audit workflow', () => {
  // Shipping the script unwired would leave the invariant exactly as
  // unguarded as before, with every other test here green. Naming the
  // script is not enough — the resolved path is assigned a line earlier,
  // so this asserts the invocation, with the report and both inputs.
  it('runs the check on the collected report', () => {
    expect(runs).toContain('npm audit --omit=dev --json > audit.json')
    expect(runs).toMatch(
      /bash "\$script" audit\.json "\$AUDIT_LEVEL" "\$AUDIT_EXCEPTIONS"/v,
    )
  })

  // Only what reaches the device counts; dropping this would flood the
  // gate with dev-tree advisories and force it to be widened again.
  it('keeps the audit scoped to production dependencies', () => {
    expect(runs).not.toMatch(/npm audit(?!.*--omit=dev)/v)
  })

  // The floor is the decision this release makes: `high` is what let
  // four production advisories through.
  it('defaults the floor to low', () => {
    expect(
      asString(
        asRecord(inputs['audit-level'], 'audit-level').default,
        'default',
      ),
    ).toBe('low')
  })

  it('defaults to no exceptions, so a caller must opt into each one', () => {
    expect(
      asRecord(inputs['audit-exceptions'], 'audit-exceptions').default,
    ).toBe('')
  })
})

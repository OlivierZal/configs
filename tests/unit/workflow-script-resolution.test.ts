import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import packageJson from '../../package.json' with { type: 'json' }

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const workflowDir = path.join(repoRoot, '.github/workflows')

// A caller finds these scripts inside the installed package. The
// `scripts/` fallback beside that lookup resolves only in this repo,
// which has no dependency on itself — so a job that reads the package
// path without installing passes here and cannot run anywhere else. That
// is not hypothetical: it shipped, and the audit gate was unable to run
// in any caller while this repo's own audit reported green.
const PACKAGE_SCRIPT_PATH = 'node_modules/@olivierzal/configs/scripts/'
const INSTALL_ACTION = 'setup-node-and-install'

// Every job that reads a script out of the package. Kept explicit rather
// than derived: a new entry is rare, and appearing here is the moment to
// confirm the job installs.
const RESOLVING_JOBS = [
  'reusable-audit.yml#audit',
  'reusable-ci.yml#check',
  'reusable-ci.yml#sonar',
]

const asRecord = (value: unknown, what: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError(`expected ${what} to be a mapping`)
  }
  return { ...value }
}

const isSequence = (value: unknown): value is readonly unknown[] =>
  Array.isArray(value)

const asArray = (value: unknown, what: string): readonly unknown[] => {
  if (!isSequence(value)) {
    throw new TypeError(`expected ${what} to be a sequence`)
  }
  return value
}

interface Job {
  readonly id: string
  readonly steps: readonly Record<string, unknown>[]
}

const stepsOf = (job: Record<string, unknown>, id: string): Job => ({
  id,
  steps: asArray(job.steps ?? [], `${id} steps`).map((step) =>
    asRecord(step, `${id} step`),
  ),
})

const jobsOf = (file: string): readonly Job[] => {
  const workflow = asRecord(
    parse(readFileSync(path.join(workflowDir, file), 'utf8')),
    file,
  )
  return Object.entries(asRecord(workflow.jobs, `${file} jobs`)).map(
    ([name, job]) =>
      stepsOf(asRecord(job, `${file} job ${name}`), `${file}#${name}`),
  )
}

// Absent `install` means the composite action's own default, which is to
// install — only the explicit string opts out.
const hasInstallStep = ({ steps }: Job): boolean =>
  steps.some((step) => {
    const { uses } = step
    if (typeof uses !== 'string' || !uses.endsWith(INSTALL_ACTION)) {
      return false
    }
    return (
      asRecord(step.with ?? {}, `${INSTALL_ACTION} inputs`).install !== 'false'
    )
  })

const hasPackageScriptStep = ({ steps }: Job): boolean =>
  steps.some(
    (step) =>
      typeof step.run === 'string' && step.run.includes(PACKAGE_SCRIPT_PATH),
  )

const resolvingJobs = readdirSync(workflowDir)
  .filter((file) => file.endsWith('.yml'))
  .flatMap((file) => jobsOf(file))
  .filter((job) => hasPackageScriptStep(job))

describe('the workflows that read a script out of the package', () => {
  // Without this the invariant below could hold over an empty set: a
  // renamed lookup path would leave every assertion green while nothing
  // was checked at all.
  it('are the ones this repo knows about', () => {
    expect(
      resolvingJobs
        .map(({ id }) => id)
        .toSorted((left, right) => left.localeCompare(right)),
    ).toStrictEqual(RESOLVING_JOBS)
  })

  it('all install, so the package path exists when they read it', () => {
    expect(
      resolvingJobs.filter((job) => !hasInstallStep(job)).map(({ id }) => id),
    ).toStrictEqual([])
  })

  // The other half of the same resolution: installing is pointless if the
  // published tarball does not carry the directory the caller reads.
  it('read a directory the published package carries', () => {
    expect(packageJson.files).toContain('scripts')
  })
})

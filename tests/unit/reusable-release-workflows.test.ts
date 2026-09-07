import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import { asArray, asRecord, repoRoot } from '../helpers.ts'

// The two release-only reusables are the ones this repository can least
// prove by running (CLAUDE.md, the reusable-workflow blind spot): a
// docs site is not built here, and a publish happens once per release.
// What a static read CAN hold is the shape the callers depend on — the
// call surface, the environments and the permissions the jobs claim,
// and the one rehearsal handle — so a rename or a dropped grant fails
// here rather than at the next release of four libraries at once.
const workflow = (file: string): Record<string, unknown> =>
  asRecord(
    parse(readFileSync(path.join(repoRoot, '.github/workflows', file), 'utf8')),
    file,
  )

const jobOf = (file: string, id: string): Record<string, unknown> =>
  asRecord(asRecord(workflow(file).jobs, `${file} jobs`)[id], `${file}#${id}`)

const stepsOf = (
  file: string,
  id: string,
): readonly Record<string, unknown>[] =>
  asArray(jobOf(file, id).steps, `${file}#${id} steps`).map((step) =>
    asRecord(step, `${file}#${id} step`),
  )

describe('reusable-docs.yml', () => {
  it('should be callable with the dry-run rehearsal input', () => {
    expect(workflow('reusable-docs.yml').on).toStrictEqual({
      workflow_call: {
        inputs: {
          'dry-run': { default: false, required: false, type: 'boolean' },
        },
      },
    })
  })

  it('should deploy from the github-pages environment with the OIDC grant', () => {
    const deploy = jobOf('reusable-docs.yml', 'deploy')

    const environment = asRecord(deploy.environment, 'deploy environment')

    expect(environment.name).toBe('github-pages')
    expect(environment.url).toMatch(
      /^\$\{\{ steps\.deployment\.outputs\.page_url \}\}$/v,
    )
    expect(deploy.permissions).toStrictEqual({
      'id-token': 'write',
      pages: 'write',
    })
    expect(deploy.needs).toBe('build')
  })

  // The rehearsal gates the deploy job and nothing else: the build half
  // runs in full, which is what a dry run is for.
  it('should skip only the deploy job on a dry run', () => {
    expect(jobOf('reusable-docs.yml', 'deploy').if).toMatch(
      /^\$\{\{ !inputs\.dry-run \}\}$/v,
    )
    expect(jobOf('reusable-docs.yml', 'build')).not.toHaveProperty('if')
    expect(
      stepsOf('reusable-docs.yml', 'build').filter((step) => 'if' in step),
    ).toStrictEqual([])
  })
})

describe('reusable-publish.yml', () => {
  it('should be callable', () => {
    expect(workflow('reusable-publish.yml').on).toStrictEqual({
      workflow_call: {},
    })
  })

  it('should publish from the npm environment with the attestation grants', () => {
    const publish = jobOf('reusable-publish.yml', 'publish')

    expect(publish.environment).toBe('npm')
    expect(publish.permissions).toStrictEqual({
      attestations: 'write',
      contents: 'read',
      'id-token': 'write',
      packages: 'write',
    })
  })

  // Pack, attest that exact tarball, publish that exact tarball.
  it('should attest the tarball it publishes', () => {
    const steps = stepsOf('reusable-publish.yml', 'publish')
    const runs = steps.map(({ run }) => run).filter((run) => run !== undefined)

    expect(runs).toHaveLength(2)
    expect(runs[0]).toBe('npm pack')
    expect(runs[1]).toMatch(
      /^npm publish \*\.tgz \$\{\{ github\.event\.release\.prerelease && '--tag next' \|\| '' \}\}$/v,
    )
    expect(
      steps.findIndex(
        ({ uses }) =>
          typeof uses === 'string' &&
          uses.startsWith('actions/attest-build-provenance@'),
      ),
    ).toBe(steps.length - 2)
  })

  // The dogfooding half: the one release-only reusable a run from this
  // repo can exercise is exercised, through the same local reference
  // ci.yml uses for the reusable CI.
  it('should be what this repo publishes through', () => {
    const publish = jobOf('publish.yml', 'publish')

    expect(publish.uses).toBe('./.github/workflows/reusable-publish.yml')
    expect(publish.permissions).toStrictEqual(
      jobOf('reusable-publish.yml', 'publish').permissions,
    )
  })
})

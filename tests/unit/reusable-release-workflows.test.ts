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

// The apps' twins (6.0.0): derived from the three byte-identical
// validate.yml files and the three publish.yml files that differed only
// by their bundle list. Validate proves itself on every app pull
// request; publish is release-only, so its shape is pinned here like
// the libraries' path.
describe('reusable-homey-validate.yml', () => {
  it('should be callable without inputs', () => {
    expect(workflow('reusable-homey-validate.yml').on).toStrictEqual({
      workflow_call: {},
    })
  })

  it('should validate at publish level with the read grants only', () => {
    const validate = jobOf('reusable-homey-validate.yml', 'validate')
    const last = stepsOf('reusable-homey-validate.yml', 'validate').at(-1)

    expect(validate.permissions).toStrictEqual({
      contents: 'read',
      packages: 'read',
    })
    expect(last?.uses).toMatch(
      /^athombv\/github-action-homey-app-validate@[0-9a-f]{40}$/v,
    )
    expect(last?.with).toStrictEqual({ level: 'publish' })
  })
})

describe('reusable-homey-publish.yml', () => {
  it('should be callable with the bundle list and the stamped page', () => {
    const call = asRecord(
      asRecord(workflow('reusable-homey-publish.yml').on, 'on').workflow_call,
      'workflow_call',
    )
    const inputs = asRecord(call.inputs, 'inputs')
    const bundles = asRecord(inputs.bundles, 'bundles')
    const stampedPage = asRecord(inputs['stamped-page'], 'stamped-page')
    const secrets = asRecord(call.secrets, 'secrets')

    expect(Object.keys(inputs)).toStrictEqual(['bundles', 'stamped-page'])
    expect(bundles.required).toBe(true)
    expect(bundles.type).toBe('string')
    expect(stampedPage.default).toBe('settings/index.html')
    expect(stampedPage.required).toBe(false)
    expect(Object.keys(secrets)).toStrictEqual(['HOMEY_PAT'])
    expect(asRecord(secrets.HOMEY_PAT, 'HOMEY_PAT').required).toBe(true)
  })

  it('should publish from the homey environment with the read grants only', () => {
    const publish = jobOf('reusable-homey-publish.yml', 'publish')

    expect(publish.environment).toBe('homey')
    expect(publish.permissions).toStrictEqual({
      contents: 'read',
      packages: 'read',
    })
  })

  // The inputs reach the assertion through the environment, never
  // interpolated into the script — the injection posture zizmor checks.
  it('should assert the bundles from the environment, not from the script', () => {
    const assertion = stepsOf('reusable-homey-publish.yml', 'publish').find(
      (step) => step.name === 'Assert the packaged bundles',
    )
    const env = asRecord(assertion?.env, 'assertion env')

    expect(env.BUNDLES).toMatch(/^\$\{\{ inputs\.bundles \}\}$/v)
    expect(env.STAMPED_PAGE).toMatch(/^\$\{\{ inputs\.stamped-page \}\}$/v)
    expect(assertion?.run).not.toMatch(/\$\{\{/v)
  })
})

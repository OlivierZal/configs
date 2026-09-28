import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { AUDITED_PLUGIN_VERSIONS } from '../../src/eslint/audited-versions.ts'
import { asRecord, repoRoot } from '../helpers.ts'
import packageJson from '../../package.json' with { type: 'json' }

const majorMinor = (version: string): string =>
  version.split('.').slice(0, 2).join('.')

const byLocale = (first: string, second: string): number =>
  first.localeCompare(second, 'en')

const installedVersion = (name: string): string => {
  const { version } = asRecord(
    JSON.parse(
      readFileSync(
        path.join(repoRoot, 'node_modules', name, 'package.json'),
        'utf8',
      ),
    ),
    name,
  )
  if (typeof version !== 'string') {
    throw new TypeError(`${name} declares no version`)
  }
  return version
}

// Dependabot moves the pins; nobody reads what a release added unless
// something stops the bump. This is that something: a plugin whose
// installed `major.minor` is not the audited one fails here, and the
// fix is to read the release notes, settle the tables, and move the
// entry in the same pull request. Patches pass.
describe('audited plugin versions', () => {
  // Every plugin the presets load is audited, and nothing else is: the
  // resolver and the prettier bridge carry no rules. The SET is the
  // contract; the ledger's own order is perfectionist's (the family
  // alphabet places `/` before `-`, so `@eslint/…` precedes
  // `@eslint-community/…`), which is why both sides sort the same way
  // here.
  it('should cover exactly the rule-bearing packages', () => {
    const ruleBearing = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    })
      .filter(
        (name) =>
          name === 'eslint' ||
          name === 'typescript-eslint' ||
          name.startsWith('@eslint/') ||
          name.includes('eslint-plugin'),
      )
      .toSorted(byLocale)

    expect(
      Object.keys(AUDITED_PLUGIN_VERSIONS).toSorted(byLocale),
    ).toStrictEqual(ruleBearing)
  })

  it.each(Object.entries(AUDITED_PLUGIN_VERSIONS))(
    'should have audited the installed %s',
    (name, audited) => {
      expect(majorMinor(installedVersion(name))).toBe(audited)
    },
  )
})

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import { AUDITED_PLUGIN_VERSIONS } from '../../src/eslint/audited-versions.ts'
import { asArray, asRecord, repoRoot } from '../helpers.ts'
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

const dependabot = asRecord(
  parse(readFileSync(path.join(repoRoot, '.github/dependabot.yml'), 'utf8')),
  'dependabot.yml',
)

// The versions of a package Dependabot is told not to propose in the
// npm ecosystem: the shape a hold takes in `.github/dependabot.yml`.
const ignoredVersions = (name: string): readonly unknown[] =>
  asArray(dependabot.updates, 'updates')
    .map((update) => asRecord(update, 'update'))
    .filter((update) => update['package-ecosystem'] === 'npm')
    .flatMap((update) => asArray(update.ignore ?? [], 'ignore'))
    .map((entry) => asRecord(entry, 'ignore entry'))
    .filter((entry) => entry['dependency-name'] === name)
    .flatMap((entry) => asArray(entry.versions ?? [], 'versions'))

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
  // here. `eslint-cssicorn` is the one rule-bearing package whose name
  // carries no `eslint-plugin` (unicorn's CSS half, named after unicorn).
  it('should cover exactly the rule-bearing packages', () => {
    const ruleBearing = Object.keys({
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    })
      .filter(
        (name) =>
          name === 'eslint' ||
          name === 'eslint-cssicorn' ||
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

  // What the ledger read is what a consumer installs. The ledger
  // watches this repository's own tree: an audited package shipped on
  // a range resolves, in a consumer's lock, to a minor nobody read
  // (nine of them were on a caret until 8.12.0).
  it.each(
    Object.keys(AUDITED_PLUGIN_VERSIONS).filter((name) =>
      Object.hasOwn(packageJson.dependencies, name),
    ),
  )('should ship %s at an exact version', (name) => {
    expect(asRecord(packageJson.dependencies, 'dependencies')[name]).toMatch(
      /^\d+\.\d+\.\d+$/v,
    )
  })

  // The hold on typescript-eslint, at 8.72 for as long as the compiler
  // installed as `@typescript/native` is a 7.0 (the ledger says why),
  // has two halves that go together. The first fails the day that
  // compiler is a 7.1: typescript-eslint is re-read then, and both
  // halves go. The second fails if the `ignore` goes before it.
  it('should still wait on a 7.0 native compiler to hold typescript-eslint', () => {
    expect(majorMinor(installedVersion('@typescript/native'))).toBe('7.0')
  })

  it('should keep Dependabot off the typescript-eslint it holds', () => {
    expect(ignoredVersions('typescript-eslint')).toStrictEqual(['>=8.73.0'])
  })
})

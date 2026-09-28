import { fileURLToPath } from 'node:url'

import type { Config } from 'eslint/config'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

import { homeyApp } from '../../src/eslint/homey-app.ts'
import { library } from '../../src/eslint/library.ts'
import {
  type RefusedRule,
  DEVICE_NODE_FLOOR,
  REFUSED_RULES,
} from '../../src/eslint/refused-rules.ts'
import { asRecord } from '../helpers.ts'

type Case = Representative & { readonly entry: RefusedRule }

interface Representative {
  readonly file: string
  readonly preset: Config[]
  readonly presetName: string
}

interface ResolvedConfig {
  readonly plugins: Record<string, unknown>
  readonly rules: Record<string, unknown>
}

// Core rules resolve under ESLint's built-in plugin key.
const CORE_PREFIX = '@'

const splitRuleId = (ruleId: string): { name: string; prefix: string } => {
  const slash = ruleId.lastIndexOf('/')
  return slash === -1
    ? { name: ruleId, prefix: CORE_PREFIX }
    : { name: ruleId.slice(slash + 1), prefix: ruleId.slice(0, slash) }
}

// The plugin objects a resolved config carries are the installed ones
// the lint run loads — core rules included, under `@`, as a Map.
const ruleOf = (rules: unknown, name: string): unknown =>
  rules instanceof Map ? rules.get(name) : asRecord(rules, 'rules')[name]

const deprecatedOf = (rule: unknown): unknown => {
  const { meta } = asRecord(rule, 'rule')
  return meta === undefined ? undefined : asRecord(meta, 'meta').deprecated
}

const severityOf = (entry: unknown): unknown =>
  Array.isArray(entry) ? entry[0] : entry

const appPreset = homeyApp({
  bundledSourceGlobs: ['settings/**'],
  defaultExportFiles: ['api.mts', 'app.mts'],
  // The README's shape: an app documents its app and api modules.
  jsdocFiles: ['{api,app}.mts', 'lib/**/*.mts'],
  webviewFloorFiles: ['settings/**/*.mts'],
})

const libraryPreset = library()

// A refusal with no `files` is judged where the JavaScript plugins run —
// one main-block file per preset; a scoped one where its block runs.
const jsRepresentatives: readonly Representative[] = [
  { file: 'app.mts', preset: appPreset, presetName: 'homeyApp' },
  { file: 'src/index.ts', preset: libraryPreset, presetName: 'library' },
]

const scopedRepresentatives: Readonly<
  Record<string, readonly Representative[]>
> = {
  '**/*.html': [
    { file: 'settings/index.html', preset: appPreset, presetName: 'homeyApp' },
  ],
}

const representativesOf = ({
  files,
}: RefusedRule): readonly Representative[] =>
  files === undefined
    ? jsRepresentatives
    : files.flatMap((glob) => scopedRepresentatives[glob] ?? [])

const cases: readonly Case[] = REFUSED_RULES.flatMap((entry) =>
  representativesOf(entry).map((representative) => ({
    ...representative,
    entry,
  })),
)

const isOwned = (
  testCase: Case,
): testCase is Case & { readonly entry: { readonly owner: string } } =>
  testCase.entry.owner !== undefined

const hasUntil = (
  entry: RefusedRule,
): entry is RefusedRule & {
  readonly until: NonNullable<RefusedRule['until']>
} => entry.until !== undefined

const scopedEntries = REFUSED_RULES.filter((entry) => entry.files !== undefined)

const cwd = fileURLToPath(new URL('../fixtures/resolved/', import.meta.url))

const resolve = async (
  preset: Config[],
  file: string,
): Promise<ResolvedConfig> => {
  const eslint = new ESLint({
    cwd,
    overrideConfig: preset,
    overrideConfigFile: true,
  })
  const config = asRecord(
    await eslint.calculateConfigForFile(file),
    `the resolved config of ${file}`,
  )
  return {
    plugins: asRecord(config.plugins, 'plugins'),
    rules: asRecord(config.rules, 'rules'),
  }
}

// `defineConfig` names every entry it flattens out of `extends` as
// `<parent> > <child>`; the family's own tables are the rest (the jsdoc
// block spreads the plugin's config, name included, and stays ours).
const ownEntries = [...appPreset, ...libraryPreset].filter(
  (entry) => !(entry.name ?? '').includes(' > '),
)

const settingEntries = ({ files, rule }: RefusedRule): Config[] =>
  ownEntries.filter(
    (entry) =>
      entry.rules !== undefined &&
      Object.hasOwn(entry.rules, rule) &&
      (files === undefined ||
        entry.files?.some(
          (glob) => typeof glob === 'string' && files.includes(glob),
        ) === true),
  )

// The ledger is data a test reads: each refusal names a rule that is
// real and alive in the plugin the lint run loads, is off or absent
// wherever that plugin runs, hands over to an owner that runs at
// `error`, and — when it waits on the device floor — still has a floor
// to wait on. A dead `'off'` in a preset could claim none of this;
// ESLint accepts one on a rule that does not exist.
describe('refused rules', () => {
  it.each(REFUSED_RULES)(
    'should pair its owner and its floor with their classes: $rule',
    ({ class: ruleClass, owner, until }) => {
      expect(owner !== undefined).toBe(ruleClass === 'owned')
      expect(until !== undefined).toBe(ruleClass === 'floor')
    },
  )

  it.each(scopedEntries)(
    'should scope $rule to a block this suite can resolve',
    ({ files }) => {
      expect(
        files?.every((glob) => Object.hasOwn(scopedRepresentatives, glob)),
      ).toBe(true)
    },
  )

  it.each(cases)(
    'should refuse a live rule and leave it off where its plugin runs: $entry.rule ($presetName, $file)',
    { timeout: 60_000 },
    async ({ entry, file, preset }) => {
      const { name, prefix } = splitRuleId(entry.rule)
      const { plugins, rules } = await resolve(preset, file)

      expect(Object.keys(plugins)).toContain(prefix)

      const rule = ruleOf(
        asRecord(plugins[prefix], `the ${prefix} plugin`).rules,
        name,
      )

      expect(rule).toBeDefined()
      expect(Boolean(deprecatedOf(rule))).toBe(false)
      expect([0, undefined]).toContain(severityOf(rules[entry.rule]))
    },
  )

  it.each(cases.filter(isOwned))(
    'should run the owner of $entry.rule at error ($presetName, $file)',
    { timeout: 60_000 },
    async ({ entry, file, preset }) => {
      const { rules } = await resolve(preset, file)

      expect(severityOf(rules[entry.owner])).toBe(2)
    },
  )

  it.each(REFUSED_RULES.filter(hasUntil))(
    'should still wait on the device floor: $rule',
    ({ until }) => {
      expect(DEVICE_NODE_FLOOR).toBeLessThan(until.deviceNodeFloorAtLeast)
    },
  )

  it.each(REFUSED_RULES)('should set $rule in no table of its own', (entry) => {
    expect(settingEntries(entry)).toStrictEqual([])
  })
})

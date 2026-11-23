import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import { asArray, asRecord, asString, repoRoot } from '../helpers.ts'

// The `dangerous-triggers` ignore is scoped to a line on purpose
// (`.github/zizmor.yml` says why): it lapses when that line moves, so
// that a trigger nobody re-read is reported again. The report is an
// alert on the code scanning page, which fails no check, and one stayed
// open for a month. Held here instead: each entry names the line of
// the trigger it was written for, so the pull request that moves the
// line is the one that re-reads it.
const fromGithub = (file: string): string =>
  readFileSync(path.join(repoRoot, '.github', file), 'utf8')

const { rules } = asRecord(parse(fromGithub('zizmor.yml')), 'zizmor.yml')
const { ignore } = asRecord(
  asRecord(rules, 'rules')['dangerous-triggers'],
  'dangerous-triggers',
)
const ignored = asArray(ignore, 'ignore').map((entry) =>
  asString(entry, 'ignore entry'),
)

describe('the dangerous-triggers ignore', () => {
  it('should name one trigger and no other', () => {
    expect(ignored).toHaveLength(1)
  })

  it.each(ignored)('should name the line of the trigger in %s', (entry) => {
    const [file = '', line = ''] = entry.split(':', 2)

    expect(
      fromGithub(path.join('workflows', file)).split('\n')[Number(line) - 1],
    ).toBe('  issue_comment:')
  })
})

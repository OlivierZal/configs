import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import { asArray, asRecord, asString, repoRoot } from '../helpers.ts'

const ACTION = 'anthropics/claude-code-action@'

const claudeArgsOf = (file: string, job: string): string => {
  const workflow: unknown = parse(
    readFileSync(path.join(repoRoot, '.github/workflows', file), 'utf8'),
  )
  const { jobs } = asRecord(workflow, file)
  const { steps } = asRecord(asRecord(jobs, 'jobs')[job], job)
  const step = asArray(steps, `${job} steps`)
    .map((entry) => asRecord(entry, `${job} step`))
    .find(({ uses }) => typeof uses === 'string' && uses.startsWith(ACTION))
  return asString(asRecord(step?.with, `${job} inputs`).claude_args, file)
}

describe('claude workflows', () => {
  // The action's default is not a contract: claude-code-action 1.0.273
  // starts a session in `auto` mode when no mode is given, where the
  // pin of that day passed `acceptEdits` on a mention and none on a
  // prompt. The mode each workflow runs in is therefore stated in its
  // own `claude_args`, whose flag comes last and wins, so a pin bump
  // cannot move the posture. The triage workflow needs no such line:
  // `allowed_non_write_users` keeps it out of the new default, and its
  // agent holds read tools only.
  it.each([
    { file: 'claude.yml', job: 'claude', mode: 'acceptEdits' },
    { file: 'claude-code-review.yml', job: 'review', mode: 'default' },
  ])('should state the permission mode of $file', ({ file, job, mode }) => {
    expect(claudeArgsOf(file, job)).toContain(`--permission-mode ${mode}`)
  })
})

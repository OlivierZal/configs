import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import { asArray, asRecord, asString, repoRoot, runScript } from '../helpers.ts'

const workflow: unknown = parse(
  readFileSync(
    path.join(repoRoot, '.github/workflows/claude-issue-triage.yml'),
    'utf8',
  ),
)

const stepList = (): Record<string, unknown>[] => {
  const { jobs } = asRecord(workflow, 'workflow')
  const { triage } = asRecord(jobs, 'jobs')
  return asArray(asRecord(triage, 'triage').steps, 'triage steps').map((step) =>
    asRecord(step, 'triage step'),
  )
}

const stepBy = (key: string, value: string): Record<string, unknown> => {
  const found = stepList().find((step) => step[key] === value)
  if (found === undefined) {
    throw new TypeError(`no step with ${key} = ${value}`)
  }
  return found
}

// A gh shim that serves `label list` and records every write, so the
// posting script runs for real without a network or a repository.
const GH_SHIM = String.raw`#!/bin/bash
if [ "$1 $2" = 'label list' ]; then
  printf 'bug\nenhancement\n'
  exit 0
fi
printf '%s\n' "$*" >> "$GH_CALLS"
if [ "$1 $2" = 'issue comment' ]; then
  printf -- '--- body ---\n' >> "$GH_CALLS"
  cat "$5" >> "$GH_CALLS"
fi
`

// The verdict the prompt demands: sentinel lines, a comment free to
// carry newlines, backticks and fences — everything that broke the
// JSON-in-prose protocol on its first live run. The instructions are
// quoted ABOVE a decoy pair to pin the last-pair-wins rule.
const VERDICT_RESULT = [
  'Following "TRIAGE COMMENT START ... TRIAGE COMMENT END" as instructed.',
  'TRIAGE COMMENT START',
  'a decoy the quoting paragraph opened',
  'TRIAGE COMMENT END',
  'TRIAGE LABELS: bug, invented-label',
  'TRIAGE COMMENT START',
  'Likely cause: `toWallClock` in',
  '',
  '```ts',
  'const x = 1',
  '```',
  '',
  'Missing: the timezone.',
  'TRIAGE COMMENT END',
].join('\n')

const executionFixture = (result: string | null): string => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'triage-exec-'))
  const file = path.join(workDir, 'execution.json')
  const messages: unknown[] = [{ type: 'system' }]
  if (result !== null) {
    messages.push({ result, type: 'result' })
  }
  writeFileSync(file, JSON.stringify(messages))
  return file
}

const runPostStep = (
  executionFile: string,
): { calls: string; status: number } => {
  const workDir = mkdtempSync(path.join(tmpdir(), 'triage-'))
  const ghCalls = path.join(workDir, 'gh-calls.log')
  writeFileSync(ghCalls, '')
  writeFileSync(path.join(workDir, 'gh'), GH_SHIM, { mode: 0o755 })
  const scriptPath = path.join(workDir, 'post.sh')
  writeFileSync(
    scriptPath,
    asString(stepBy('name', 'Post the verdict').run, 'post step run'),
  )
  const environment = {
    EXECUTION_FILE: executionFile,
    GH_CALLS: ghCalls,
    GH_REPO: 'owner/repo',
    GH_TOKEN: 'test-token',
    ISSUE_NUMBER: '42',
    PATH: `${workDir}:${process.env.PATH ?? ''}`,
    RUNNER_TEMP: workDir,
  }
  // The outcome is the gh-calls log rather than the script's output:
  // the shim records every write the posting script attempted.
  const { status } = runScript('bash', {
    args: ['-e', scriptPath],
    env: environment,
  })
  return { calls: readFileSync(ghCalls, 'utf8'), status }
}

describe('claude issue triage workflow', () => {
  // The boundary this workflow exists to hold: the agent that reads
  // untrusted issue text carries no write tool. The 2026-08-17 incident
  // (two green runs, zero comment, zero label) came from trusting an
  // agent-side write to a permission layer that silently denied it.
  it('should give the agent exactly the read-only allowlist', () => {
    const claudeArgs = asString(
      asRecord(stepBy('id', 'analyze').with, 'analyze inputs').claude_args,
      'claude_args',
    )
    const [, allowed = ''] = /--allowedTools "(?<tools>[^"]+)"/v.exec(
      claudeArgs,
    ) ?? ['', '']

    expect(allowed).toBe(
      'Read,Glob,Grep,Bash(gh issue view:*),Bash(gh issue list:*),Bash(gh label list:*),Bash(gh search:*)',
    )
  })

  it('should keep the posting script free of template injection', () => {
    expect(
      asString(stepBy('name', 'Post the verdict').run, 'post step run'),
    ).not.toContain('${{')
  })

  it('should post the comment and only the labels the repo carries', () => {
    const { calls, status } = runPostStep(executionFixture(VERDICT_RESULT))

    expect(status).toBe(0)
    expect(calls).toContain('issue edit 42 --add-label bug')
    expect(calls).not.toContain('invented-label')
    expect(calls).toContain('issue comment 42 --body-file')
    // The LAST sentinel pair is the verdict: the decoy a quoting
    // paragraph opened is discarded, fences and blank lines survive.
    expect(calls).toContain('Likely cause: `toWallClock` in')
    expect(calls).toContain('```ts')
    expect(calls).toContain('Missing: the timezone.')
    expect(calls).not.toContain('decoy')
  })

  it('should post a comment when the agent picked no label', () => {
    const { calls, status } = runPostStep(
      executionFixture(
        [
          'TRIAGE LABELS: none',
          'TRIAGE COMMENT START',
          'Nothing matched.',
          'TRIAGE COMMENT END',
        ].join('\n'),
      ),
    )

    expect(status).toBe(0)
    expect(calls).not.toContain('issue edit')
    expect(calls).toContain('issue comment 42 --body-file')
  })

  it('should fail loudly when the agent produced no verdict', () => {
    const { calls, status } = runPostStep(
      executionFixture('I analyzed the issue but forgot the sentinels.'),
    )

    expect(status).not.toBe(0)
    expect(calls).toBe('')
  })

  it('should fail loudly when the agent produced no result at all', () => {
    const { calls, status } = runPostStep(executionFixture(null))

    expect(status).not.toBe(0)
    expect(calls).toBe('')
  })
})

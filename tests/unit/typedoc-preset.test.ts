import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { typedocBase } from '../../src/typedoc/index.ts'
import { repoRoot } from '../helpers.ts'

// A real typedoc run over an on-disk fixture, from a copy in a scratch
// directory so nothing lands in the tree: the preset names two plugins
// that typedoc resolves by name at run time, and only a run proves the
// names resolve and the plugins do their work. Each plugin leaves a
// trace nothing else produces — the coverage badge, and the MDN links
// on an `Error` subclass's inherited members (the plugin resolves lib
// names it has a page for; `Error.message` is one, `Promise` is not) —
// so a plugin that failed to load fails here.
const workDir = mkdtempSync(path.join(tmpdir(), 'configs-typedoc-'))
const outDir = path.join(workDir, 'docs')

const htmlFilesUnder = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => path.join(entry.parentPath, entry.name))

describe(typedocBase, () => {
  beforeAll(() => {
    cpSync(path.join(repoRoot, 'tests/fixtures/typedoc'), workDir, {
      recursive: true,
    })
    // Relative paths in an options file resolve against the file, so it
    // sits beside the fixture — exactly where a consumer's
    // typedoc.config.js sits.
    writeFileSync(
      path.join(workDir, 'typedoc.json'),
      JSON.stringify(
        typedocBase({
          categoryOrder: [],
          hostedBaseUrl: 'https://example.invalid/docs/',
          name: 'Fixture',
          navigationLinks: {},
        }),
      ),
    )
    execFileSync(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules/typedoc/bin/typedoc'),
        '--options',
        path.join(workDir, 'typedoc.json'),
        '--out',
        outDir,
      ],
      { cwd: workDir, encoding: 'utf8' },
    )
  }, 60_000)

  afterAll(() => {
    rmSync(workDir, { force: true, recursive: true })
  })

  it('should generate the site', () => {
    expect(existsSync(path.join(outDir, 'index.html'))).toBe(true)
  })

  it('should load typedoc-plugin-coverage', () => {
    expect(existsSync(path.join(outDir, 'coverage.svg'))).toBe(true)
  })

  it('should load typedoc-plugin-mdn-links', () => {
    expect(
      htmlFilesUnder(outDir).some((file) =>
        readFileSync(file, 'utf8').includes('developer.mozilla.org'),
      ),
    ).toBe(true)
  })
})

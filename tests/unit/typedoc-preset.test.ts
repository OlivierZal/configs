import { spawnSync } from 'node:child_process'
import {
  appendFileSync,
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
import { asString, repoRoot } from '../helpers.ts'

// A real typedoc run over an on-disk fixture, from a copy in a scratch
// directory so nothing lands in the tree: the preset names two plugins
// that typedoc resolves by name at run time, and only a run proves the
// names resolve and the plugins do their work. Each plugin leaves a
// trace nothing else produces — the coverage badge, and the MDN links
// on the lib symbols the fixture names — so a plugin that failed to
// load fails here.
const workDir = mkdtempSync(path.join(tmpdir(), 'configs-typedoc-'))
const outDir = path.join(workDir, 'docs')
const warnedDir = mkdtempSync(path.join(tmpdir(), 'configs-typedoc-'))

// The fixture, copied into a scratch directory with the preset's
// options beside it, where a consumer's typedoc.config.js sits:
// relative paths in an options file resolve against the file.
const seed = (dir: string): void => {
  cpSync(path.join(repoRoot, 'tests/fixtures/typedoc'), dir, {
    recursive: true,
  })
  writeFileSync(
    path.join(dir, 'typedoc.json'),
    JSON.stringify(
      typedocBase({
        categoryOrder: [],
        hostedBaseUrl: 'https://example.invalid/docs/',
        name: 'Fixture',
        navigationLinks: {},
      }),
    ),
  )
}

const build = (dir: string): { output: string; status: number | null } => {
  const { status, stderr, stdout } = spawnSync(
    process.execPath,
    [
      path.join(repoRoot, 'node_modules/typedoc/bin/typedoc'),
      '--options',
      path.join(dir, 'typedoc.json'),
      '--out',
      path.join(dir, 'docs'),
    ],
    { cwd: dir, encoding: 'utf8' },
  )
  return { output: `${stdout}${stderr}`, status }
}

const htmlFilesUnder = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => path.join(entry.parentPath, entry.name))

// The MDN pages the generated site links to, each by the last segment
// of its path. Read off the parsed URL: the mdn-links trace is a link
// whose HOST is MDN, and a substring search for the name would also
// accept a host that merely contains it.
const mdnPages = (): string[] =>
  htmlFilesUnder(outDir)
    .flatMap((file) =>
      readFileSync(file, 'utf8')
        .matchAll(/href="(?<href>[^"]*)"/gv)
        .map(
          ({ groups }) =>
            new URL(asString(groups?.href, 'href'), 'https://example.invalid'),
        )
        .toArray(),
    )
    .filter(({ hostname }) => hostname === 'developer.mozilla.org')
    .map(({ pathname }) => pathname.split('/').at(-1) ?? '')

describe(typedocBase, () => {
  let built: { output: string; status: number | null } | undefined

  beforeAll(() => {
    seed(workDir)
    built = build(workDir)
  }, 60_000)

  afterAll(() => {
    rmSync(workDir, { force: true, recursive: true })
    rmSync(warnedDir, { force: true, recursive: true })
  })

  it('should generate the site', () => {
    expect(built?.output).not.toMatch(/\[(?:warning|error)\]/v)
    expect(built?.status).toBe(0)
    expect(existsSync(path.join(outDir, 'index.html'))).toBe(true)
  })

  // The fixture's README shows a workflow, as a library's does: a
  // fence in a language the preset does not list is published as plain
  // text.
  it('should highlight the workflow a README shows', () => {
    const { groups } =
      /<code class="yaml">(?<block>.*?)<\/code>/sv.exec(
        readFileSync(path.join(outDir, 'index.html'), 'utf8'),
      ) ?? {}

    expect(groups?.block).toContain('<span class="hl-')
  })

  // Any warning, not the validation's alone: the fence below is in a
  // language the preset does not list, which typedoc reports without
  // failing anything of its own accord.
  it('should fail the build on a warning', () => {
    seed(warnedDir)
    appendFileSync(
      path.join(warnedDir, 'README.md'),
      '\n```toml\nname = "fixture"\n```\n',
    )

    const { output, status } = build(warnedDir)

    expect(output).toContain('toml')
    expect(status).not.toBe(0)
  }, 60_000)

  it('should load typedoc-plugin-coverage', () => {
    expect(existsSync(path.join(outDir, 'coverage.svg'))).toBe(true)
  })

  it('should load typedoc-plugin-mdn-links', () => {
    expect(mdnPages()).toContain('message')
  })

  // The lib declarations sit in `@typescript/old` under the 6/7
  // side-by-side layout, a package the plugin does not know by name:
  // until 8.12.0 named it, only the inherited members above resolved,
  // and the `{@link TypeError}` of the fixture failed the validation —
  // which the run in `beforeAll` would now die on.
  it.each(['Error', 'Map', 'Promise', 'TypeError'])(
    'should link the lib symbol %s to its MDN page',
    (name) => {
      expect(mdnPages()).toContain(name)
    },
  )
})

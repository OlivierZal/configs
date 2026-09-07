import { describe, expect, it } from 'vitest'
import { type ViteUserConfig, defineConfig } from 'vitest/config'

import { webviewFloorBlock } from '../../src/eslint/index.ts'
import { typedocBase } from '../../src/typedoc/index.ts'
import { coverageDefaults } from '../../src/vitest/coverage.ts'
import { swcOptions, swcPlugin } from '../../src/vitest/swc.ts'
import packageJson from '../../package.json' with { type: 'json' }
import prettierConfig from '../../src/prettier/index.ts'

const typedocPlugins = ['typedoc-plugin-mdn-links', 'typedoc-plugin-coverage']

// The eslint presets are exercised by real lint runs; the other
// modules export plain objects whose contract is their shape — pin it
// so a drift is a failing test, not a silent consumer break.
describe('export contracts', () => {
  it('should keep the family prettier policy', () => {
    expect(prettierConfig).toStrictEqual({
      objectWrap: 'collapse',
      plugins: ['prettier-plugin-packagejson'],
      semi: false,
      singleQuote: true,
    })
  })

  // The barrel publishes the two presets and the one fragment a
  // consumer composes on its own; the fragments the presets assemble
  // from are module-internal. Pinned at runtime because the lint rule
  // that would report an unused export is inert under ESLint 10
  // (`shared.ts`), so a fragment re-exported "for later" would otherwise
  // ride out unnoticed, as nineteen of them once did.
  it('should publish only the presets and the webview floor', async () => {
    const barrel = await import('../../src/eslint/index.ts')

    expect(
      Object.keys(barrel).toSorted((first, second) =>
        first.localeCompare(second),
      ),
    ).toStrictEqual(['homeyApp', 'library', 'webviewFloorBlock'])
  })

  // A library shipping webview-bundled sources composes the floor from
  // the barrel instead of hand-copying it, so this import path is a
  // contract: a repo that re-derives the policy watches it drift.
  it('should expose the webview floor as a composable fragment', () => {
    const block = webviewFloorBlock(['src/webview/**/*.ts'])

    expect(block.files).toStrictEqual(['src/webview/**/*.ts'])
    expect(block.rules?.['require-unicode-regexp']).toStrictEqual([
      'error',
      { requireFlag: 'u' },
    ])
  })

  it('should build a typedoc config around the consumer identity', () => {
    const config = typedocBase({
      categoryOrder: ['One', 'Two'],
      hostedBaseUrl: 'https://example.invalid/docs/',
      intentionallyNotExported: ['Internal'],
      name: 'Example',
      navigationLinks: { GitHub: 'https://example.invalid' },
    })

    // Identity fields forward verbatim…
    expect(config.categoryOrder).toStrictEqual(['One', 'Two'])
    expect(config.entryPoints).toStrictEqual(['src/index.ts'])
    expect(config.hostedBaseUrl).toBe('https://example.invalid/docs/')
    expect(config.intentionallyNotExported).toStrictEqual(['Internal'])
    expect(config.name).toBe('Example')
    expect(config.navigationLinks).toStrictEqual({
      GitHub: 'https://example.invalid',
    })
    // …and the WHOLE assembled shape is pinned: any drift in the static
    // defaults must show up as an explicit snapshot update.
    expect(config).toMatchSnapshot()
  })

  // typedoc loads each plugin by name from the consumer's tree, so the
  // list the preset emits is a dependency claim on the four consumers
  // that document — and it is declared in NO field the installer
  // reads. The optional peer that would be the textbook place is not
  // one through the registry this package publishes to: GitHub
  // Packages strips `peerDependenciesMeta` from the packument, so an
  // optional peer reaches every consumer as a mandatory one, and
  // typedoc declared that way sat in the three apps' locks from their
  // first adoption (CLAUDE.md, "Dependencies nothing imports"). The
  // claim lives in the README's typedoc section; the real run in
  // `typedoc-preset.test.ts` proves it against the devDependencies.
  it('should name the typedoc plugins it loads', () => {
    expect(
      typedocBase({
        categoryOrder: [],
        hostedBaseUrl: 'https://example.invalid/docs/',
        name: 'Example',
        navigationLinks: {},
      }).plugin,
    ).toStrictEqual(typedocPlugins)
  })

  it.each(['typedoc', ...typedocPlugins])(
    'should keep %s out of every field the installer reads',
    (name) => {
      expect(packageJson.dependencies).not.toHaveProperty(name)
      expect(packageJson.peerDependencies).not.toHaveProperty(name)
      expect(packageJson).not.toHaveProperty('optionalDependencies')
      // The proof run needs it here, and nowhere else.
      expect(packageJson.devDependencies).toHaveProperty(name)
    },
  )

  // The peers are the tools every consumer runs, and none is marked
  // optional: the registry erases the mark, so a manifest carrying it
  // says one thing through `npm pack` and another through
  // `npm install` — a dry adoption against the tarball LOST typedoc
  // where the registry re-pin would have added it and both plugins.
  // With no such field the two channels cannot disagree.
  it('should declare the family tools as plain peers, none optional', () => {
    expect(Object.keys(packageJson.peerDependencies)).toStrictEqual([
      'eslint',
      'prettier',
      'vitest',
    ])
    expect(packageJson).not.toHaveProperty('peerDependenciesMeta')
  })

  it('should forward custom entry points for multi-entry packages', () => {
    const config = typedocBase({
      categoryOrder: [],
      entryPoints: ['src/index.ts', 'src/webview/index.ts'],
      hostedBaseUrl: 'https://example.invalid/docs/',
      name: 'Example',
      navigationLinks: {},
    })

    expect(config.entryPoints).toStrictEqual([
      'src/index.ts',
      'src/webview/index.ts',
    ])
  })

  it('should carry the family coverage bar in the coverage fragment', () => {
    expect(coverageDefaults).toStrictEqual({
      reporter: ['text', 'lcov'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    })
  })

  // The adoption gesture itself, typechecked: the fragment spreads into
  // `test.coverage` beside a repo's own globs, so an option-surface
  // drift in vitest fails here rather than in seven adoption PRs.
  it('should spread into a coverage block as consumers write it', () => {
    const config: ViteUserConfig = defineConfig({
      test: { coverage: { ...coverageDefaults, include: ['src/**/*.ts'] } },
    })

    expect(config.test?.coverage).toMatchObject(coverageDefaults)
  })

  it('should carry the decorator transform in the swc fragment', () => {
    expect(swcOptions).toStrictEqual({
      jsc: {
        parser: { decorators: true, syntax: 'typescript' },
        target: 'es2024',
        transform: { decoratorVersion: '2022-03' },
      },
    })
    expect(swcPlugin.name).toContain('swc')
  })
})

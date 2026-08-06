import { describe, expect, it } from 'vitest'

import { typedocBase } from '../../src/typedoc/index.ts'
import { swcOptions, swcPlugin } from '../../src/vitest/swc.ts'
import prettierConfig from '../../src/prettier/index.ts'

// The eslint presets are exercised by real lint runs; these three
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

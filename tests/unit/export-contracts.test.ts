import { describe, expect, it } from 'vitest'

import { typedocBase } from '../../src/typedoc/index.ts'
import { swcPlugin } from '../../src/vitest/swc.ts'
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
      categoryOrder: ['One'],
      hostedBaseUrl: 'https://example.invalid/docs/',
      name: 'Example',
      navigationLinks: { GitHub: 'https://example.invalid' },
    })

    expect(config).toMatchObject({
      entryPoints: ['src/index.ts'],
      hostedBaseUrl: 'https://example.invalid/docs/',
      name: 'Example',
      out: 'docs',
      treatValidationWarningsAsErrors: true,
    })
    expect(config.intentionallyNotExported).toStrictEqual([])
  })

  it('should carry the decorator transform in the swc fragment', () => {
    expect(swcPlugin.name).toContain('swc')
  })
})

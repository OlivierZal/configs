// The decorator-transform fragment every decorator-using repo needs:
// vitest's default transform does not run the 2022-03 decorator
// protocol, swc does. Pair it with `oxc: false` in the consumer.
import swc from 'unplugin-swc'

// Exported on its own so the contract is pinnable: the plugin closes
// over its options, which a test could otherwise only probe by name.
export const swcOptions = {
  jsc: {
    parser: { decorators: true, syntax: 'typescript' },
    target: 'es2024',
    transform: { decoratorVersion: '2022-03' },
  },
} as const

export const swcPlugin: ReturnType<typeof swc.vite> = swc.vite(swcOptions)

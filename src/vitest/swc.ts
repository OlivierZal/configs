// The decorator-transform fragment every decorator-using repo needs:
// vitest's default transform does not run the 2022-03 decorator
// protocol, swc does. Pair it with `oxc: false` in the consumer.
import swc from 'unplugin-swc'

export const swcPlugin: ReturnType<typeof swc.vite> = swc.vite({
  jsc: {
    parser: { decorators: true, syntax: 'typescript' },
    target: 'es2024',
    transform: { decoratorVersion: '2022-03' },
  },
})

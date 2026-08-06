import { type ViteUserConfig, defineConfig } from 'vitest/config'

const config: ViteUserConfig = defineConfig({
  test: {
    clearMocks: true,
    coverage: {
      exclude: ['src/prettier/**', 'src/typedoc/**', 'src/vitest/**'],
      include: ['src/**/*.ts'],
      reporter: ['text', 'lcov'],
    },
    include: ['tests/**/*.test.ts'],
  },
})

export default config

import { type ViteUserConfig, defineConfig } from 'vitest/config'

// Relative import, not `@olivierzal/configs/vitest-coverage`: this repo
// does not install itself, and reading the source keeps the config in
// lockstep with the export the family consumes.
import { coverageDefaults } from './src/vitest/coverage.ts'

const config: ViteUserConfig = defineConfig({
  test: {
    clearMocks: true,
    coverage: { ...coverageDefaults, include: ['src/**/*.ts'] },
    include: ['tests/**/*.test.ts'],
  },
})

export default config

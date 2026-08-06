// Self-hosted on the package's own library preset (dogfooding). The
// jsdoc scope is empty by this repo's verdict: the sources are config
// fragments whose intent comments live inline, not an API-doc surface.
import { type Config, defineConfig } from 'eslint/config'

import { library } from './src/eslint/library.ts'

const config: Config[] = defineConfig([
  { ignores: ['coverage/', 'dist/'] },
  ...library(),
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      // A config package imports the host tools it configures as PEER
      // dependencies by design — the family rule assumes app/lib
      // repos, where a peer import would be a mistake.
      'import-x/no-extraneous-dependencies': [
        'error',
        {
          bundledDependencies: false,
          devDependencies: ['*.config.ts', 'tests/**'],
          includeTypes: true,
          optionalDependencies: false,
          peerDependencies: true,
        },
      ],
      // Preset fragments are consumed by the published entry points and
      // the test suite; intra-package usage analysis cannot see package
      // consumers.
      'import-x/no-unused-modules': 'off',
    },
  },
  {
    files: ['src/prettier/index.ts'],
    rules: {
      // Prettier's shareable-config protocol resolves the module's
      // DEFAULT export (`"prettier": "@olivierzal/configs/prettier"`).
      'import-x/no-default-export': 'off',
      'import-x/prefer-default-export': ['error', { target: 'any' }],
    },
  },
  {
    files: ['src/eslint/**/*.ts'],
    rules: {
      // Rule severities and AST selector strings are the DOMAIN here:
      // magic values and long option literals are the payload, not
      // noise.
      '@typescript-eslint/no-magic-numbers': 'off',
    },
  },
])

export default config

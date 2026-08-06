// The family prettier policy: compact objects everywhere (line length
// is the only sanctioned reason to wrap), package.json field order
// normalized.
import type { Config } from 'prettier'

const config: Config = {
  objectWrap: 'collapse',
  plugins: ['prettier-plugin-packagejson'],
  semi: false,
  singleQuote: true,
}

export default config

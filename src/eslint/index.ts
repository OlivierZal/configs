// Composable fragments plus the two family presets. Consumers normally
// import a preset (`./eslint/homey-app` or `./eslint/library`) and keep
// only their documented verdicts in the overlay; the fragments are for
// the day a repo genuinely fits neither family.
export type { HomeyAppOptions } from './homey-app.ts'
export type { LibraryOptions } from './library.ts'
export type {
  NamingConventionOptions,
  SharedMainRulesOptions,
  TemplateExpressionAllowEntry,
} from './shared.ts'

export {
  buildImportGroup,
  typeLikeSortOptions,
  typeSortOptions,
} from './helpers.ts'
export { homeyApp, webviewFloorBlock } from './homey-app.ts'
export { library } from './library.ts'
export {
  changelogBlock,
  configJsBlock,
  configTsBlock,
  jsdocBlock,
  jsonBlock,
  linterOptionsBlock,
  markdownBlock,
  namingConventionEntries,
  packageJsonBlock,
  perfectionistSettings,
  sharedClassGroups,
  sharedClassGroupsTail,
  sharedMainRules,
  sharedTestRules,
  testsBlock,
  yamlBlock,
} from './shared.ts'

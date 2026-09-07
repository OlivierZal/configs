// The two family presets and the one fragment a consumer composes on
// its own: a library shipping webview-bundled sources takes the floor
// the Homey preset applies rather than restating it. Nothing else is
// public — the fragments the presets assemble from stay module-internal
// (`shared.ts`, `helpers.ts`), because no consumer assembles a preset
// by hand: a repo fits one of the two families or the family gains a
// preset here, never a hand-built third.
export type { HomeyAppOptions } from './homey-app.ts'
export type { LibraryOptions } from './library.ts'
export type { TemplateExpressionAllowEntry } from './shared.ts'

export { homeyApp, webviewFloorBlock } from './homey-app.ts'
export { library } from './library.ts'

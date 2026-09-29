/**
 * The rules the family REFUSES, as data — never as a dead `'off'` in a
 * preset. ESLint accepts `'off'` for a rule name that does not exist
 * (verified 2026-09-27: a `rules: { 'no-such-rule': 'off' }` entry lints
 * without a word), so an `off` on a rule no extended preset turns on is
 * never validated — the plugin renames or drops the rule and the line
 * rots in silence, still claiming a verdict. The presets therefore carry
 * only LIVE settings: a rule some preset enables and the family disables
 * stays an `'off'` at its rule site, with its reason, and every refusal
 * of a rule that was never on lands here, where
 * `tests/unit/refused-rules.test.ts` proves each entry against the
 * installed plugins — the rule exists and is not deprecated, it is off
 * or absent wherever its plugin is loaded, its owner (when it names one)
 * runs at `error`, and a floor-bound refusal expires the day the device
 * floor reaches the API it waits for.
 */
export interface RefusedRule {
  // Why the rule is refused: OWNED by another rule (named in `owner`),
  // CONFLICTING with Prettier or a house convention, REDUNDANT with what
  // Prettier already produces, out of the family's DOMAIN, below the
  // device FLOOR (`until` names the Node major that lifts it), or a
  // VOCABULARY verdict — a naming policy the family does not want.
  readonly class:
    'conflicting' | 'domain' | 'floor' | 'owned' | 'redundant' | 'vocabulary'
  readonly reason: string
  readonly rule: string
  // The exact `files` globs of the preset block the refusal is scoped
  // to; absent, the refusal is family-wide and the rule is set in no
  // preset entry at all.
  readonly files?: readonly string[]
  // The rule at `error` that covers what this one would report.
  readonly owner?: string
  // A `floor` refusal waits on `DEVICE_NODE_FLOOR`: the ledger test goes
  // red once the floor reaches this major, forcing the adoption.
  readonly until?: { readonly deviceNodeFloorAtLeast: number }
}

// The Homey Pro runtime's Node major: 22 since firmware 12.9.0, 22.20
// measured on the device 2026-08 (CLAUDE.md, the boundary — the four
// runtime libraries declare it as `engines`; this package's own
// `engines` is the toolchain's, derived from the dependency tree). Every
// `floor` entry below waits on this number.
export const DEVICE_NODE_FLOOR = 22

// The Node major that ships each waited-on API, measured 2026-09-28 by
// `typeof` on the toolchain's own runtimes: Node 24.19.0 (V8 13.6) has
// `Error.isError` and `RegExp.escape` but neither `Iterator.concat` nor
// `Uint8Array#toBase64`/`#toHex`; Node 26.7.0 (V8 14.6) has all five.
// The unicorn sources agree wherever they name a target (24 for
// `prefer-error-is-error` and `prefer-regexp-escape`, 26 for the two
// `Uint8Array` rules; `prefer-iterator-concat` names none).
const NODE_24_FLOOR = { deviceNodeFloorAtLeast: 24 }

const NODE_26_FLOOR = { deviceNodeFloorAtLeast: 26 }

const HTML_FILES = ['**/*.html']

const REDUNDANT_HTML =
  "Prettier's output already satisfies it — 0 hits when forced on over com.melcloud's three pages (2026-09-27) — and Prettier formats every page (`format` runs on HTML too). Never on: `html/recommended` does not enable it, so an `off` here validated nothing."

const SEO_HTML =
  'SEO: a Homey settings page or widget renders inside the Homey app and no crawler reads it. The `<meta name="description">` tags the apps carry are cargo (2024-09, no recorded reason), free to leave.'

export const REFUSED_RULES: readonly RefusedRule[] = [
  {
    class: 'conflicting',
    reason:
      "Fights Prettier on both axes. The `code` axis conflicts with the printer's own output — nine declarations in melcloud-api and seven in com.melcloud it cannot break below 80 — and the `comments` axis, the one Prettier leaves alone, would cost 195 hand-wrapped prose lines behind a `code` sentinel the rule needs, having no comments-only mode (measured 2026-09-15). House comments wrap at print width by convention; a rule that cannot fix what it reports is not what would hold it. As an `off` it was dead twice over: no `@stylistic` preset is extended, and eslint-config-prettier already lists the rule at 0.",
    rule: '@stylistic/max-len',
  },
  {
    class: 'redundant',
    files: HTML_FILES,
    reason: REDUNDANT_HTML,
    rule: 'html/class-spacing',
  },
  {
    class: 'redundant',
    files: HTML_FILES,
    reason: REDUNDANT_HTML,
    rule: 'html/no-extra-spacing-text',
  },
  {
    class: 'redundant',
    files: HTML_FILES,
    reason: REDUNDANT_HTML,
    rule: 'html/no-multiple-empty-lines',
  },
  {
    class: 'redundant',
    files: HTML_FILES,
    reason: REDUNDANT_HTML,
    rule: 'html/no-trailing-spaces',
  },
  {
    class: 'conflicting',
    reason:
      "Measured before being left out, with jsdoc 65 (2026-09-29). At its default the rule forbids any indentation after the asterisk: 15 of the 18 sites it reports in api-core and melcloud-api are the continuation lines of a `1.` or `-` item, indented to the item's content column — the layout Prettier itself produces for a Markdown list, and the one typedoc renders as the family's docs. `allowIndentedSections`, the option shaped for exactly that distinction (tags and the first line stay flush, sections may indent), clears 17 of the 18 but still reports a well-formed nested list whose items carry an inline `{@link …}` (api-core `src/resilience/index.ts`; reproduced — the same block passes once the inline tags are removed). A doc block would have to bend to the rule's parsing, so the rule waits until it follows Markdown structure.",
    rule: 'jsdoc/check-indentation',
  },
  {
    class: 'domain',
    files: HTML_FILES,
    reason: SEO_HTML,
    rule: 'html/require-meta-description',
  },
  {
    class: 'domain',
    files: HTML_FILES,
    reason: SEO_HTML,
    rule: 'html/require-open-graph-protocol',
  },
  {
    class: 'owned',
    owner: 'one-var',
    reason:
      "`one-var: 'never'` splits every multi-declarator statement before order matters, and the split keeps evaluation order where this rule's fixer would reorder side-effecting initialisers. Its one unowned residue, a multi-declarator `for (;;)` initialiser, is absent across the eight repos (2026-09-15).",
    rule: 'perfectionist/sort-variable-declarations',
  },
  {
    class: 'owned',
    owner: 'jsdoc/require-asterisk-prefix',
    reason:
      'Mutually exclusive twin of the owner: the house style keeps the `*` line prefix in doc blocks, and `jsdoc/require-asterisk-prefix` at `always` enforces exactly what this rule would forbid.',
    rule: 'unicorn/no-asterisk-prefix-in-documentation-comments',
  },
  {
    class: 'vocabulary',
    reason:
      "Bans `new` and `class` as identifier prefixes. NOT owned: `@typescript-eslint/naming-convention` as configured checks formats and boolean prefixes, never a forbidden prefix. Refused as vocabulary: 87 sites would fire family-wide (2026-09-27), `newSettings` ×29 and `className` ×8 among them — the latter the DOM's own property name — and unicorn itself keeps the rule out of `recommended`.",
    rule: 'unicorn/no-keyword-prefix',
  },
  {
    class: 'conflicting',
    reason:
      'House comments wrap prose at print width; the rule reads those wraps as unfinished sentences and its fixer JOINS the group into one `//` line without reflowing it (verified in the rule source, 2026-09-27) — not noise but the destruction of the convention, on every `--fix` run.',
    rule: 'unicorn/no-manually-wrapped-comments',
  },
  {
    class: 'domain',
    files: HTML_FILES,
    reason:
      "The module bundles the pages reference are gitignored build outputs (CI lints without building); their existence is guaranteed harder by the bundling script, which hashes every local reference and throws when one is missing (the guarantee lands through the validate workflow's CLI build). Refused for HTML only — on CSS and Markdown, where every referenced file is committed, the rule runs at `error`.",
    rule: 'unicorn/no-missing-local-resource',
  },
  {
    class: 'floor',
    reason:
      "Rewrites to `Error.isError()`, a Node 24 API (the rule's own source: enable when the project targets Node.js >=24; a function on Node 24.19.0, `undefined` on 22.23.0, measured 2026-09-28); the Homey Pro runs Node 22.",
    rule: 'unicorn/prefer-error-is-error',
    until: NODE_24_FLOOR,
  },
  {
    class: 'floor',
    reason:
      "Rewrites to `Iterator.concat()`, a Node 26 API — `typeof Iterator.concat` is `undefined` on Node 24.19.0 and a function on 26.7.0 (measured 2026-09-28; the rule's source names no Node target); the Homey Pro runs Node 22.",
    rule: 'unicorn/prefer-iterator-concat',
    until: NODE_26_FLOOR,
  },
  {
    class: 'domain',
    reason:
      "Neither tsconfig base sets `resolveJsonModule`, and the rewrite from `JSON.parse(readFileSync(…))` to `import … with { type: 'json' }` changes semantics — module-relative resolution instead of cwd-relative, load-once caching, a parse failure at link time instead of at the call — so the author keeps it opt-in (`recommended: false` in unicorn 75 and 76; it never arrived with 75 as CLAUDE.md once recorded).",
    rule: 'unicorn/prefer-json-import',
  },
  {
    class: 'floor',
    reason:
      "Rewrites to `RegExp.escape()`, a Node 24 API (the rule's own source: enable when targeting Node.js 24; a function on Node 24.19.0, `undefined` on 22.23.0, measured 2026-09-28); the Homey Pro runs Node 22.",
    rule: 'unicorn/prefer-regexp-escape',
    until: NODE_24_FLOOR,
  },
  {
    class: 'floor',
    reason:
      "Rewrites to `Uint8Array#toBase64()`, a Node 26 API (the rule's own source: enable when targeting Node.js 26; `undefined` on Node 24.19.0, a function on 26.7.0, measured 2026-09-28); the Homey Pro runs Node 22.",
    rule: 'unicorn/prefer-uint8array-base64',
    until: NODE_26_FLOOR,
  },
  {
    class: 'floor',
    reason:
      "Rewrites to `Uint8Array#toHex()`, a Node 26 API (the rule's own source: enable when targeting Node.js 26; `undefined` on Node 24.19.0, a function on 26.7.0, measured 2026-09-28); unicorn 75 and 76 ship it `recommended: false`, so it never arrived — CLAUDE.md's unicorn 75 entry recorded it as recommended by mistake.",
    rule: 'unicorn/prefer-uint8array-hex',
    until: NODE_26_FLOOR,
  },
]

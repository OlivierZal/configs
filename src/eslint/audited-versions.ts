/**
 * The plugin versions the rule tables in this directory were last
 * audited against, as `major.minor`. Dependabot moves the pins in
 * `package.json` without anyone reading what a release added — a new
 * rule, a new option, a widened default — so the tables drift behind
 * the tools that run them. `tests/unit/audited-versions.test.ts` fails
 * the moment an installed plugin's `major.minor` leaves this table:
 * re-read that release's notes, adopt or refuse what it adds in the
 * tables, and move the entry in the same pull request. A patch bump
 * passes without ceremony.
 *
 * A FULL reading — every rule of every plugin against the tables, not a
 * release's delta — was done on 2026-09-15 and again on 2026-09-27
 * (CLAUDE.md, plugin triage; the second one measured every unconfigured
 * rule over the seven consumers and admitted three plugins: es-x,
 * regexp, eslint-comments). Between the two, entries moved by DELTA
 * readings of their release notes, each measured over the eight
 * repositories before it moved (2026-09-22: eslint 10.11, unicorn 76,
 * package-json 1.9, html-eslint 0.66; 2026-09-29: typescript-eslint 8.71,
 * jsdoc 65; 2026-10-09: eslint 10.12, unicorn 77 with eslint-cssicorn 0.1
 * — the CSS half unicorn moved out — perfectionist 5.12, package-json
 * 1.10, jsdoc 65.2, yml 3.9; 2026-10-14: unicorn 78, eslint-cssicorn
 * 0.2, jsdoc 65.3 — measured with a pack of this package installed in
 * the seven consumers, and a probe config extending each repository's
 * own for the rules no preset turns on; same day, html-eslint 0.67 and
 * es-x 10.1, zero sites over the seven consumers).
 */
export const AUDITED_PLUGIN_VERSIONS: Readonly<Record<string, string>> = {
  '@eslint/css': '2.0',
  '@eslint/js': '10.0',
  '@eslint/json': '2.1',
  '@eslint/markdown': '8.0',
  '@eslint-community/eslint-plugin-eslint-comments': '4.8',
  '@html-eslint/eslint-plugin': '0.67',
  '@stylistic/eslint-plugin': '5.10',
  '@vitest/eslint-plugin': '1.6',
  eslint: '10.12',
  'eslint-cssicorn': '0.2',
  'eslint-plugin-es-x': '10.1',
  'eslint-plugin-import-x': '4.17',
  'eslint-plugin-jsdoc': '65.3',
  'eslint-plugin-package-json': '1.10',
  'eslint-plugin-perfectionist': '5.12',
  'eslint-plugin-regexp': '3.3',
  'eslint-plugin-unicorn': '78.0',
  'eslint-plugin-yml': '3.9',
  'typescript-eslint': '8.71',
}

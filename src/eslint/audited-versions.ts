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
 * release's delta — was done on 2026-09-15 (CLAUDE.md, plugin triage).
 * Entries have since moved by DELTA readings of their release notes,
 * each measured over the eight repositories before it moved
 * (2026-09-22: eslint 10.11, unicorn 76, package-json 1.9,
 * html-eslint 0.66).
 */
export const AUDITED_PLUGIN_VERSIONS: Readonly<Record<string, string>> = {
  '@eslint/css': '2.0',
  '@eslint/js': '10.0',
  '@eslint/json': '2.1',
  '@eslint/markdown': '8.0',
  '@html-eslint/eslint-plugin': '0.66',
  '@stylistic/eslint-plugin': '5.10',
  '@vitest/eslint-plugin': '1.6',
  eslint: '10.11',
  'eslint-plugin-import-x': '4.17',
  'eslint-plugin-jsdoc': '64.5',
  'eslint-plugin-package-json': '1.9',
  'eslint-plugin-perfectionist': '5.11',
  'eslint-plugin-unicorn': '76.0',
  'eslint-plugin-yml': '3.8',
  'typescript-eslint': '8.70',
}

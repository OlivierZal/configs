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
 * release's delta — was done on 2026-09-15 against exactly these
 * versions (CLAUDE.md, plugin triage); the next one is the next minor.
 */
export const AUDITED_PLUGIN_VERSIONS: Readonly<Record<string, string>> = {
  '@eslint/css': '2.0',
  '@eslint/js': '10.0',
  '@eslint/json': '2.1',
  '@eslint/markdown': '8.0',
  '@html-eslint/eslint-plugin': '0.65',
  '@stylistic/eslint-plugin': '5.10',
  '@vitest/eslint-plugin': '1.6',
  eslint: '10.10',
  'eslint-plugin-import-x': '4.17',
  'eslint-plugin-jsdoc': '64.4',
  'eslint-plugin-package-json': '1.8',
  'eslint-plugin-perfectionist': '5.11',
  'eslint-plugin-unicorn': '74.0',
  'eslint-plugin-yml': '3.8',
  'typescript-eslint': '8.70',
}

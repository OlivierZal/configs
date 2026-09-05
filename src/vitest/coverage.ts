// The family coverage bar every vitest repo used to restate by hand:
// `text` for the CI log, `lcov` for the Sonar upload, and 100% on all
// four axes — the same bar the `Olivierzal way` quality gate holds.
// Spread it into `test.coverage`; the `include`/`exclude` globs beside
// it stay per-repo identity, never here.
import type { CoverageOptions } from 'vitest/node'

// Typed against vitest's own option surface so a drift in its
// `reporter`/`thresholds` vocabulary fails THIS repo's typecheck
// instead of every consumer's adoption PR.
export const coverageDefaults: Required<
  Pick<CoverageOptions, 'reporter' | 'thresholds'>
> = {
  reporter: ['text', 'lcov'],
  thresholds: { branches: 100, functions: 100, lines: 100, statements: 100 },
}

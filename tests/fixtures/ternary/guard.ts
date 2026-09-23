// A guard clause whose value spans lines: a two-way value selection,
// reported at the preset's `always` and merged into a ternary that
// Prettier lays out one branch per line.
export const clampToCeiling = (
  measuredTemperatureInDegrees: number | undefined,
  configuredCeilingTemperatureInDegrees: number,
): number => {
  if (measuredTemperatureInDegrees === undefined) {
    return configuredCeilingTemperatureInDegrees
  }
  return Math.min(
    measuredTemperatureInDegrees,
    configuredCeilingTemperatureInDegrees,
  )
}

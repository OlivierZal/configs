// A guard clause whose value spans lines: the shape `prefer-ternary`
// at `always` rewrites into a multi-line ternary, and the bounded
// `only-single-line` leaves alone.
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

// The one-line if/else a ternary reads better as.
export const pick = (value: number | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback
  }
  return value
}

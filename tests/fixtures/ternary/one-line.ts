// The one-line if/else a ternary reads better as — reported in both
// modes, so the bounded option still bites.
export const pick = (value: number | undefined, fallback: number): number => {
  if (value === undefined) {
    return fallback
  }
  return value
}

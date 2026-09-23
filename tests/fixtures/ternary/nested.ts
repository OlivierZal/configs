// A guard whose fall-through already holds a ternary: merging would
// nest ternaries, which unicorn 76's readability boundary refuses in
// both modes — the boundary the return to `always` relies on.
export const label = (value: number | undefined, isMetric: boolean): string => {
  if (value === undefined) {
    return 'n/a'
  }
  return isMetric ? `${String(value)} °C` : `${String(value)} °F`
}

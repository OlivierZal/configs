// Node-side shipped code: the device floor polices it.
export const newestFirst = (versions: readonly string[]): string[] =>
  versions.toSorted((left, right) => right.localeCompare(left))

export const isTime = (value: string): boolean => /^\d{2}:\d{2}$/v.test(value)

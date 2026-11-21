/**
 * Raised when a tally cannot be read.
 */
export class TallyError extends Error {
  /**
   * Creates the error.
   * @param ticks - The tick count that could not be read.
   */
  public constructor(ticks: number) {
    super(`unreadable tally at tick ${String(ticks)}`)
    this.name = 'TallyError'
  }
}

/**
 * Reads the tally a tick count stands for.
 * @param ticks - The tick count to read.
 * @returns The tally, by name.
 * @throws A {@link TypeError} when the count is not a whole number.
 */
export const readTally = async (
  ticks: number,
): Promise<Map<string, number>> => {
  if (!Number.isInteger(ticks)) {
    throw new TypeError('not a whole number')
  }
  return Promise.resolve(new Map([['ticks', ticks]]))
}

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

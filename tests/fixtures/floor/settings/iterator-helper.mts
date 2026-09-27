const items = new Map<string, number>([['a', 1]])

export const rows: Iterable<string> = items.entries().map(([key]) => key)

const source = { alpha: 1, beta: 2 }

export const rows: string[] = Object.entries(source).map(([key, value]) =>
  key.repeat(value),
)

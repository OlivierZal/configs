// Webview-bundled: the browser engine runs this — the webview floor
// applies (es2023 arrays allowed), the device node floor must not.
export const newestFirst = (versions: readonly string[]): string[] =>
  versions.toSorted((left, right) => right.localeCompare(left))

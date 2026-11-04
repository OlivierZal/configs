#!/usr/bin/env bash
# Proves every hand-written declaration file is type-checked.
# `skipLibCheck: true` — the family's setting, and the modern default —
# silences every diagnostic inside a `.d.ts`, a repository's own
# included: an unresolved name there keeps its spelling, relates like
# `any` and reports nothing (measured 2026-11-04 on a reference that had
# been dead for fourteen months). So a repository whose program loads
# `.d.ts` files of its own runs a second program over them, `tsconfig.declarations.json`,
# composed from its own tsconfig and the `tsconfig/declarations` base
# (`skipLibCheck: false`, `noEmit`), and its `typecheck` script chains
# that program so the local gates and CI see the same thing. A
# repository whose program loads no declaration file of its own has
# nothing to prove.
#
# Usage: check-declarations.sh [root]
#
# `DECLARATION_FILES` replaces the main program's listing with a
# newline-separated list of files relative to the root — the seam the
# suite drives. `TSC` names the compiler (default: the root's native
# TypeScript).
set -euo pipefail

readonly root=${1:-.}
readonly program=tsconfig.declarations.json
readonly tsc=${TSC:-$root/node_modules/@typescript/native/bin/tsc}

failures=0

fail() {
  local message=$1
  printf 'error: %s\n' "$message" >&2
  failures=$((failures + 1))
}

# The declaration files that can hide a diagnostic are the ones the
# main program loads: a `.d.ts` outside it (a test fixture, a build
# output) shapes no type the repository compiles against. Installed
# packages carry declaration files by the hundred, and none of them is
# this repository's to check.
absolute_root=$(cd "$root" && pwd -P)

# A program that does not resolve must never read as a program with
# nothing in it: the listing's failure is reported, not folded away.
list_program() {
  local config=$1 listing
  if ! listing=$(node "$tsc" --listFilesOnly -p "$config" 2>&1); then
    fail "$config does not resolve: $listing"
    printf '%s\n' "$failures declaration problem(s)" >&2
    exit 1
  fi
  printf '%s\n' "$listing"
}

if [[ -n ${DECLARATION_FILES+set} ]]; then
  files=$(printf '%s\n' "$DECLARATION_FILES" | sed '/^$/d')
else
  main_listing=$(list_program "$root/tsconfig.json") || exit 1
  files=''
  # Literal prefix and suffix tests — never a pattern built from a path,
  # whose dots would match more than themselves.
  while IFS= read -r line; do
    [[ $line == "$absolute_root/"* && $line == *.d.ts && $line != */node_modules/* ]] || continue
    files+="${line#"$absolute_root/"}"$'\n'
  done <<<"$main_listing"
  files=${files%$'\n'}
fi

if [[ -z $files ]]; then
  printf 'no declaration file of this repository in its program\n'
  exit 0
fi
count=$(printf '%s\n' "$files" | wc -l | tr -d ' ')

if [[ ! -f $root/$program ]]; then
  fail "$count declaration file(s) of this repository but no $program: compose one from the repository's tsconfig and @olivierzal/configs/tsconfig/declarations, with an include that reaches every .d.ts"
  printf '%s\n' "$failures declaration problem(s)" >&2
  exit 1
fi

# The program only protects when the gate everyone runs reaches it.
typecheck=$(node -e '
  const { scripts = {} } = require(process.argv[1])
  process.stdout.write(scripts.typecheck ?? "")
' "$(cd "$root" && pwd)/package.json")
if [[ $typecheck != *"$program"* ]]; then
  fail "package.json \`typecheck\` does not run $program; chain it after the main program"
fi

# The two options the base carries, read back resolved: a consumer
# program that re-enabled skipLibCheck would check nothing, and one
# that emitted would write files during a check.
if ! resolved=$(node "$tsc" --showConfig -p "$root/$program" 2>&1); then
  fail "$program does not resolve: $resolved"
  printf '%s\n' "$failures declaration problem(s)" >&2
  exit 1
fi
options=$(node -e '
  const { compilerOptions = {} } = JSON.parse(process.argv[1])
  process.stdout.write(
    `${compilerOptions.skipLibCheck === true ? "skip" : "check"} ${compilerOptions.noEmit === true ? "noEmit" : "emit"}`,
  )
' "$resolved")
[[ $options == check* ]] || fail "$program resolves skipLibCheck to true, so it checks no declaration file"
[[ $options == *noEmit ]] || fail "$program does not set noEmit, so the check would emit"

# Every declaration file must be a root or a dependency of the program:
# one the include misses is exactly the silent case again.
listed=$(list_program "$root/$program") || exit 1
while IFS= read -r file; do
  absolute=$(cd "$root" && cd "$(dirname "$file")" && printf '%s/%s' "$(pwd -P)" "$(basename "$file")")
  if ! grep -qxF "$absolute" <<<"$listed"; then
    fail "$file is not in the $program program; widen its include"
  fi
done <<<"$files"

if ((failures > 0)); then
  printf '%s\n' "$failures declaration problem(s)" >&2
  exit 1
fi

printf 'checked %s declaration file(s) of this repository through %s\n' "$count" "$program"

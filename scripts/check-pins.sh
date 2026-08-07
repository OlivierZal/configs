#!/usr/bin/env bash
# Proves every SHA-pinned `uses:` reference carries a version comment
# that really names that SHA. A comment nobody verifies drifts into
# disinformation, which is worse than no comment: Dependabot maintains
# these comments but leaves an already-wrong one untouched, and skips
# the update entirely when the version is not the end of the line.
#
# References to this package's own repo carry a second obligation: the
# tag must match the `@olivierzal/configs` npm pin, because one version
# covers both delivery channels.
#
# Usage: check-pins.sh [root]
#
# `PIN_CHECK_REFS` replaces the remote lookup with a file of
# `owner/repo<TAB>refname<TAB>sha` lines — the seam the suite drives.
set -euo pipefail

readonly root=${1:-.}
readonly self_repo=OlivierZal/configs
readonly self_package=@olivierzal/configs

failures=0

fail() {
  printf 'error: %s\n' "$1" >&2
  failures=$((failures + 1))
}

cache_dir=$(mktemp -d)
readonly cache_dir
trap 'rm -rf "$cache_dir"' EXIT

# One lookup per upstream repo, however many pins reference it.
refs_for() {
  local repo=$1 cache
  cache="$cache_dir/${repo//\//__}"
  if [[ ! -f $cache ]]; then
    if [[ -n ${PIN_CHECK_REFS:-} ]]; then
      awk -F'\t' -v repo="$repo" \
        '$1 == repo { print $3 "\t" $2 }' "$PIN_CHECK_REFS" >"$cache"
    else
      git ls-remote --tags "https://github.com/$repo" >"$cache" 2>/dev/null || true
    fi
  fi
  cat "$cache"
}

# Annotated tags expose the commit they name under `^{}`; lightweight
# ones point at it directly. Prefer the dereferenced form so a pin is
# always compared against a commit.
sha_for_tag() {
  local repo=$1 tag=$2 refs sha
  refs=$(refs_for "$repo")
  sha=$(awk -v ref="refs/tags/$tag^{}" '$2 == ref { print $1 }' <<<"$refs")
  if [[ -z $sha ]]; then
    sha=$(awk -v ref="refs/tags/$tag" '$2 == ref { print $1 }' <<<"$refs")
  fi
  printf '%s' "$sha"
}

npm_pin=''
if [[ -f $root/package.json ]]; then
  npm_pin=$(
    node -e '
      const manifest = require(process.argv[1])
      const { devDependencies = {}, dependencies = {} } = manifest
      process.stdout.write(
        devDependencies[process.argv[2]] ?? dependencies[process.argv[2]] ?? "",
      )
    ' "$(cd "$(dirname "$root/package.json")" && pwd)/package.json" "$self_package"
  )
fi
readonly npm_pin

shopt -s nullglob
files=(
  "$root"/.github/workflows/*.yml
  "$root"/.github/workflows/*.yaml
  "$root"/.github/actions/*/action.yml
  "$root"/.github/actions/*/action.yaml
)
shopt -u nullglob

pins=0
for file in "${files[@]}"; do
  while IFS= read -r entry; do
    number=${entry%%:*}
    text=${entry#*:}
    [[ $text =~ uses:[[:space:]]*[\'\"]?([A-Za-z0-9._-]+/[A-Za-z0-9._-]+)(/[^@\'\"[:space:]]*)?@([^\'\"[:space:]]+)[\'\"]?[[:space:]]*(#[[:space:]]*(.*[^[:space:]])[[:space:]]*)?$ ]] || continue
    repo=${BASH_REMATCH[1]}
    ref=${BASH_REMATCH[3]}
    comment=${BASH_REMATCH[5]}
    # Tag and branch references are zizmor's `unpinned-uses` territory.
    [[ $ref =~ ^[0-9a-f]{40}$ ]] || continue
    pins=$((pins + 1))
    where="$file:$number"

    if [[ -z $comment ]]; then
      fail "$where: $repo is pinned to ${ref:0:8} with no version comment; add \`# <tag>\`"
      continue
    fi
    # Dependabot only rewrites a comment whose version ends the line,
    # so trailing prose silently freezes it at today's value.
    if [[ $comment != "${comment%%[[:space:]]*}" ]]; then
      fail "$where: version comment \`$comment\` carries trailing text; Dependabot only updates a comment that ends with the version"
      continue
    fi

    resolved=$(sha_for_tag "$repo" "$comment")
    if [[ -z $resolved ]]; then
      fail "$where: $repo has no tag \`$comment\`"
    elif [[ $resolved != "$ref" ]]; then
      fail "$where: $repo \`$comment\` is ${resolved:0:8}, but the pin is ${ref:0:8}"
    fi

    if [[ $repo == "$self_repo" && -n $npm_pin && $comment != "v$npm_pin" ]]; then
      fail "$where: workflow ref \`$comment\` and npm pin \`$npm_pin\` disagree; one version covers both channels"
    fi
  done < <(grep -nE "uses:[[:space:]]*[\'\"]?[A-Za-z0-9._-]+/" "$file" || true)
done

if ((failures > 0)); then
  printf '%s\n' "$failures pin problem(s) across ${#files[@]} file(s)" >&2
  exit 1
fi

printf 'checked %s pinned reference(s) across %s file(s)\n' "$pins" "${#files[@]}"

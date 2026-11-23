# Fixture

A small package the typedoc preset is run over for real. The class
extends `Error`, and the function answers a `Promise` and links
`TypeError` from its doc block: three lib symbols
`typedoc-plugin-mdn-links` has a page for.

A workflow, as a library's README shows one to its callers:

```yaml
jobs:
  docs:
    uses: ./.github/workflows/docs.yml
```

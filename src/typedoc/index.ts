/**
 * What a library supplies to {@link typedocBase}: its identity and the
 * ledger of the internals it documents without exporting.
 */
export interface TypedocBaseOptions {
  /**
   * The `@category` names of the library, in the order the site lists
   * them; a category left out is appended after the last one.
   */
  readonly categoryOrder: readonly string[]
  /**
   * The URL the docs site is served from.
   */
  readonly hostedBaseUrl: string
  /**
   * The site's title.
   */
  readonly name: string
  /**
   * The header links, keyed by the label typedoc renders.
   */
  readonly navigationLinks: Readonly<Record<string, string>>
  /**
   * The modules to document; `src/index.ts` alone when left out.
   */
  readonly entryPoints?: readonly string[]
  /**
   * The symbols a published signature names without exporting them,
   * each one a verdict of the library.
   */
  readonly intentionallyNotExported?: readonly string[]
}

const staticTypedocOptions: Record<string, unknown> = {
  // The MDN-links plugin resolves a symbol by the package its
  // declaration sits in, and knows three by name (`typescript`,
  // `@types/web`, `@webgpu/types`). Under the 6/7 side-by-side layout
  // the lib declarations typedoc reads sit in `@typescript/old`, the
  // TypeScript 6 the `typescript` alias depends on: without this
  // entry `Promise`, `Map` or `Error` stay plain text and a
  // `{@link TypeError}` fails the validation (measured 2026-11-21 on
  // the fixture, that link apart: 5 MDN links, the inherited members
  // of `Error`, against 12). Inert the day the lib is `typescript`'s
  // own again.
  additionalModuleSources: ['@typescript/old'],
  cacheBust: true,
  categorizeByGroup: false,
  cleanOutputDir: true,
  excludeInternal: true,
  excludePrivate: true,
  excludeProtected: true,
  // Single H1 on the index page, owned by the README.
  headings: { document: false, readme: false },
  hideGenerator: true,
  // Languages used in code fences across the README and TSDoc.
  // `javascript` covers `js` blocks inherited from the TypeScript
  // stdlib's `Error` example annotations, which propagate to every
  // error subclass; `yaml`, the workflow a README shows its callers.
  // A fence in a language left out is published as plain text, under
  // a warning that `treatWarningsAsErrors` below makes fatal.
  highlightLanguages: ['ini', 'javascript', 'shell', 'typescript', 'yaml'],
  includeVersion: true,
  markdownLinkExternal: true,
  out: 'docs',
  plugin: ['typedoc-plugin-mdn-links', 'typedoc-plugin-coverage'],
  readme: 'README.md',
  // Property excluded: most public types mirror a wire protocol
  // verbatim, where field names speak for themselves.
  requiredToBeDocumented: [
    'Accessor',
    'Class',
    'Constructor',
    'Enum',
    'EnumMember',
    'Function',
    'Interface',
    'Method',
    'Module',
    'Namespace',
    'Reference',
    'TypeAlias',
    'Variable',
  ],
  searchInComments: true,
  searchInDocuments: true,
  sourceLinkExternal: true,
  // Every warning, the validation's included: typedoc exits 0 on one
  // of its own accord, and a site it warned about is still published.
  treatWarningsAsErrors: true,
  tsconfig: 'tsconfig.build.json',
  useFirstParagraphOfCommentAsSummary: true,
  validation: {
    invalidLink: true,
    invalidPath: true,
    notDocumented: true,
    notExported: true,
    rewrittenLink: true,
    unusedMergeModuleWith: true,
  },
}

/**
 * The structural typedoc options the published libraries share: the
 * validation that fails the build on an undocumented or unresolved
 * symbol, the plugins, the output. A library adds what only it knows.
 * @param options - The library's identity.
 * @param options.categoryOrder - The `@category` names, in site order.
 * @param options.entryPoints - The modules to document.
 * @param options.hostedBaseUrl - The URL the site is served from.
 * @param options.intentionallyNotExported - The symbols documented
 * without being exported.
 * @param options.name - The site's title.
 * @param options.navigationLinks - The header links, by label.
 * @returns The typedoc options, to export from `typedoc.config.js`.
 */
export const typedocBase = ({
  categoryOrder,
  // The single-barrel library shape; multi-entry packages (one entry
  // per subpath export) list theirs instead.
  entryPoints = ['src/index.ts'],
  hostedBaseUrl,
  intentionallyNotExported = [],
  name,
  navigationLinks,
}: TypedocBaseOptions): Record<string, unknown> => ({
  ...staticTypedocOptions,
  categoryOrder: [...categoryOrder],
  entryPoints: [...entryPoints],
  hostedBaseUrl,
  intentionallyNotExported: [...intentionallyNotExported],
  name,
  navigationLinks: { ...navigationLinks },
})

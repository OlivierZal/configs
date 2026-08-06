// The structural typedoc base both published libraries share; each
// consumer supplies its identity (name, hostedBaseUrl, links) and its
// documented internals ledger.
export interface TypedocBaseOptions {
  readonly categoryOrder: readonly string[]
  readonly hostedBaseUrl: string
  readonly name: string
  readonly navigationLinks: Readonly<Record<string, string>>
  readonly entryPoints?: readonly string[]
  readonly intentionallyNotExported?: readonly string[]
}

const staticTypedocOptions: Record<string, unknown> = {
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
  // error subclass.
  highlightLanguages: ['ini', 'javascript', 'shell', 'typescript'],
  includeVersion: true,
  markdownLinkExternal: true,
  out: 'docs',
  plugin: ['typedoc-plugin-mdn-links', 'typedoc-plugin-coverage'],
  readme: 'README.md',
  // Property and EnumMember excluded: most public types mirror a wire
  // protocol verbatim, where field names speak for themselves.
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
  treatValidationWarningsAsErrors: true,
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

// Sorting vocabularies shared by every repo's perfectionist setup.

export const buildImportGroup = (selector: string): string[] =>
  ['type', 'named', 'default', 'wildcard', 'require', 'ts-equals'].map(
    (modifier) => `${modifier}-${selector}`,
  )

export const typeSortOptions: { groups: string[] } = {
  groups: [
    'keyword',
    'import',
    'literal',
    'named',
    'function',
    'object',
    'tuple',
    'union',
    'intersection',
    'conditional',
    'operator',
    'unknown',
    'nullish',
  ],
}

export const typeLikeSortOptions: { groups: string[] } = {
  groups: [
    'index-signature',
    'required-property',
    'optional-property',
    'required-method',
    'optional-method',
  ],
}

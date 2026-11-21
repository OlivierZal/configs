// Sorting vocabularies shared by every repo's perfectionist setup.

/**
 * Spells one perfectionist import group under each of its modifiers, a
 * type import first, so the six forms of a source sort together.
 * @param selector - The perfectionist selector the group is for
 * (`builtin`, `external`, `sibling`…).
 * @returns The six `modifier-selector` names, in the house order.
 */
export const buildImportGroup = (selector: string): string[] =>
  ['type', 'named', 'default', 'wildcard', 'require', 'ts-equals'].map(
    (modifier) => `${modifier}-${selector}`,
  )

/**
 * The order of the members of a union or an intersection, simplest
 * first and the nullish ones last: the groups `sort-union-types` and
 * `sort-intersection-types` both take.
 */
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

/**
 * The order of the members of an interface or an object type: the index
 * signature, then properties before methods, required before optional.
 */
export const typeLikeSortOptions: { groups: string[] } = {
  groups: [
    'index-signature',
    'required-property',
    'optional-property',
    'required-method',
    'optional-method',
  ],
}

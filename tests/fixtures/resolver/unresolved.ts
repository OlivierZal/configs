// @ts-expect-error -- the missing module is the point: the lint resolver
// must report it, and the repo's own typecheck reaches this fixture too.
import { missing } from './missing.js'

export const unresolvedProbe: unknown = missing

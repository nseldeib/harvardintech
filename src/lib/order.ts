// Ordering for CMS-authored lists.
//
// Several content collections expose an optional `order` field so an editor can
// arrange entries without renaming files. Entries that never got a number must
// not jump to the front (a `undefined ?? 0` would put them there) — they sort
// after everything explicitly ordered, keeping their relative order.
//
// Pure and framework-free so it is unit-testable and shared by every collection
// that sorts this way (volunteer projects, testimonials, board members).

export interface Ordered {
  order?: number;
}

/**
 * Comparator for `Array.prototype.sort`: ascending `order`, with entries that
 * have no `order` sorted last. Stable for equal/absent values, so the caller's
 * incoming order is preserved within a tie.
 */
export function byOrder(a: Ordered, b: Ordered): number {
  const av = a.order ?? Number.MAX_SAFE_INTEGER;
  const bv = b.order ?? Number.MAX_SAFE_INTEGER;
  return av - bv;
}

/** Non-mutating `sort(byOrder)` — the source array is left untouched. */
export function sortByOrder<T extends Ordered>(items: readonly T[]): T[] {
  return [...items].sort(byOrder);
}

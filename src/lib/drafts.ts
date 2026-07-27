// Pure, framework-free helpers for draft visibility. Kept out of any `.astro`
// route so the rule can be unit-tested under vitest and applied identically by
// every `getCollection` call site. No DOM, no Astro imports — just data in,
// data out. Mirrors the shape of `filterActiveBoardMembers` in `./team.ts`.

/**
 * The minimum shape this module needs: a content-collection entry whose `data`
 * may carry a `draft` flag. Structural, so it accepts entries from any of the
 * five collections without naming their individual schemas.
 */
export interface DraftableEntry {
  data: { draft?: boolean };
}

/**
 * Keep only the entries fit to publish. An entry is published unless `draft` is
 * explicitly `true`, so an absent flag — the state of every existing entry, and
 * what the CMS writes when the Draft toggle is off — means live. `draft: false`
 * is treated the same as absent, since a hand-edited file may spell it out even
 * though the CMS never writes it.
 *
 * Pass `includeDrafts` to keep drafts in the list. Callers derive it from
 * `import.meta.env.PROD` so drafts stay visible while authoring (`astro dev`,
 * and therefore the codeyam preview) but are omitted from the built site. It is
 * an explicit parameter rather than a read of `import.meta.env` inside this
 * function so both halves of the rule are testable without faking the
 * environment.
 *
 * Returns a new array — the input is not mutated.
 */
export function publishedEntries<T extends DraftableEntry>(
  entries: T[],
  includeDrafts = false,
): T[] {
  if (includeDrafts) return [...entries];
  return entries.filter((entry) => entry.data.draft !== true);
}

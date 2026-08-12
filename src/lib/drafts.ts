// Pure, framework-free helpers for draft visibility. Kept out of any `.astro`
// route so the rule can be unit-tested under vitest and applied identically by
// every `getCollection` call site. No DOM, no Astro imports — just data in,
// data out. Mirrors the shape of `filterActiveBoardMembers` in `./team.ts`.
//
// Since @codeyam/cms 0.5.0 the package ships the same rule as
// `lib/publishFilter`, and this module now DELEGATES the actual selection to it
// rather than reimplementing it — so a change to what "published" means arrives
// with a version bump instead of drifting between two copies.
//
// What is deliberately NOT delegated is the signature. The package's
// `publishedEntries(entries, { includeDrafts })` takes an options object, while
// every call site here passes `INCLUDE_DRAFTS` positionally. Re-exporting the
// package function directly would leave those calls type-checking and silently
// wrong: `publishedEntries(entries, true)` would hand `true` where an object is
// expected, read `undefined` for `includeDrafts`, and fall back to the package's
// own `!isProductionBuild()` guess. That guess is exactly what this project
// cannot use — see `./draftVisibility`, where the review track is a PRODUCTION
// build that must show drafts. The wrapper keeps the explicit parameter, so the
// two-track rule stays in one place and stays testable.
import { selectPublished } from '@codeyam/cms/lib/publishFilter';
import { isLockedPreview as isLockedPreviewEntry, isPreviewEntry } from '@codeyam/cms/lib/previewPages';

/**
 * The minimum shape these helpers need: a content-collection entry whose `data`
 * may carry a `draft` flag and the `previewOf` preview marker. Structural, so it
 * accepts entries from any collection without naming their individual schemas.
 */
export interface DraftableEntry {
  data: { draft?: boolean; previewOf?: string };
}

/**
 * Keep only the entries fit to LIST. An entry is published unless `draft` is
 * explicitly `true`, so an absent flag — the state of every existing entry, and
 * what the CMS writes when the Draft toggle is off — means live. `draft: false`
 * is treated the same as absent, since a hand-edited file may spell it out even
 * though the CMS never writes it.
 *
 * Preview pages drop out unconditionally, and `includeDrafts` does not bring
 * them back. That is not the same rule as the draft rule wearing a second hat: a
 * draft is hidden because it is not finished, while a preview is hidden because
 * the ONLY intended way to reach it is the token URL someone was handed. Listing
 * one — even on the review track, even in dev — is what the token exists to
 * prevent.
 *
 * Pass `includeDrafts` to keep drafts in the list. Callers take it from
 * `INCLUDE_DRAFTS` in `./draftVisibility`, so drafts stay visible while
 * authoring (`astro dev`, and therefore the codeyam preview) and on the review
 * track, but are omitted from the public build. It is an explicit parameter
 * rather than an ambient environment read inside this function so both halves of
 * the rule are testable without faking the environment.
 *
 * Returns a new array — the input is not mutated.
 */
export function publishedEntries<T extends DraftableEntry>(
  entries: T[],
  includeDrafts = false,
): T[] {
  return selectPublished(entries, { includeDrafts });
}

/**
 * The entries a collection's `getStaticPaths` should BUILD: everything
 * {@link publishedEntries} returns, plus every preview page.
 *
 * The deliberate mirror image of the listing rule, and both halves are
 * load-bearing. A preview is kept out of listings so nothing links to it — but
 * it must still be built, or the link handed to a reviewer 404s and the feature
 * fails at the one moment it is used. A preview stays routable even when it also
 * carries `draft: true`: hiding it from the site was never the point.
 *
 * Using `publishedEntries` in a `getStaticPaths` for a collection with preview
 * links silently breaks every one of those links, which is why the five routed
 * collections call this instead.
 */
export function routableEntries<T extends DraftableEntry>(
  entries: T[],
  includeDrafts = false,
): T[] {
  const listable = new Set(publishedEntries(entries, includeDrafts));
  return entries.filter((entry) => listable.has(entry) || isPreviewEntry(entry));
}

/**
 * Whether an entry is an unlisted preview page. Re-exported through this module
 * so a route needs one import for the whole publish-state question, and so the
 * package's `previewOf`-is-the-marker rule has exactly one crossing point into
 * this codebase.
 */
export function isPreview(entry: DraftableEntry): boolean {
  return isPreviewEntry(entry);
}

/**
 * Whether a preview is PASSWORD-PROTECTED — its title and body encrypted at
 * rest, with the entry holding a placeholder title and a base64 body.
 *
 * A route has to ask this before rendering, and the cost of not asking is
 * visible rather than subtle: the stored body is ciphertext, so a page that
 * renders it as markdown shows the reader a wall of base64. Locked entries take
 * the unlock island (`LockedPreviewBody.astro`) in place of the article.
 */
export function isLocked(entry: DraftableEntry & { data: { previewLock?: string } }): boolean {
  return isLockedPreviewEntry(entry);
}

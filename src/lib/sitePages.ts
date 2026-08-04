// Top-level routing rules for the `pages` collection.
//
// `pages` is the CMS's free-form page collection — the "Pages" card an editor
// meets first on the dashboard. It ships at the site ROOT (`/about`, `/privacy`)
// rather than under a `/pages/` prefix, because that is what "Pages" means in
// every CMS an editor has used before: the thing you make when you want a new
// page at a sensible address, not a nested one.
//
// Serving it from the root means a page's slug shares a namespace with the
// hand-built routes and the static files in `public/`. Astro resolves that
// collision in favour of the static route, so a page slugged `donate` builds
// without complaint and simply never appears — the exact silent-loss failure
// this whole route exists to end. `shadowedPageSlugs` finds those up front so
// the build can say so.
//
// Pure and framework-free (the `drafts.ts` / `order.ts` pattern) so the rule is
// unit-testable with no Astro imports and no filesystem.

/**
 * Slugs a CMS page cannot claim, because something else already answers at that
 * address and would win.
 *
 * Three sources, all of them real routes today:
 * - hand-built pages and route directories under `src/pages/`
 * - static files and directories served verbatim from `public/`
 * - generated endpoints (`robots.txt`, `llms.txt`) and the CMS's own `/admin`
 *
 * Kept as an explicit list rather than derived by scanning `src/pages/` at build
 * time: the scan would need `fs` (which drags this out of unit-test reach), and
 * a route added without updating this list is a change the author is making
 * deliberately — a failing test naming the new route is a better prompt than a
 * silent re-derivation.
 */
export const RESERVED_PAGE_SLUGS: readonly string[] = [
  // Hand-built routes under src/pages/
  '404',
  'donate',
  'events',
  'sponsor',
  'volunteer',
  // Route directories under src/pages/
  'blog',
  'chapters',
  'communities',
  'isolated-components',
  // Generated endpoints
  'llms.txt',
  'robots.txt',
  // Served verbatim from public/
  'design-review-4ece6c14',
  'favicon.svg',
  'images',
  'review',
  // Injected by @codeyam/cms on dev + the review track
  'admin',
];

/** Normalize a slug for comparison: trimmed, lowercased, no surrounding slashes. */
function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/^\/+|\/+$/g, '');
}

/**
 * The page slugs that something else already answers for, in the order given.
 *
 * A match means the page will not be reachable at its own address: Astro serves
 * the static route or the `public/` file instead. Returns the offending slugs
 * (not a boolean) so the caller can name them — an editor who slugged a page
 * `events` needs to be told which word is the problem, not that "a problem
 * exists".
 *
 * Comparison is case- and slash-insensitive, because an editor typing `/About`
 * into a slug box has made the same collision as one typing `about`.
 */
export function shadowedPageSlugs(
  slugs: readonly string[],
  reserved: readonly string[] = RESERVED_PAGE_SLUGS,
): string[] {
  const taken = new Set(reserved.map(normalizeSlug));
  return slugs.filter((slug) => taken.has(normalizeSlug(slug)));
}

/**
 * Whether a single slug is safe to publish at the site root. The one-slug form
 * of {@link shadowedPageSlugs}, for a caller checking as it goes.
 */
export function isReservedPageSlug(
  slug: string,
  reserved: readonly string[] = RESERVED_PAGE_SLUGS,
): boolean {
  return shadowedPageSlugs([slug], reserved).length > 0;
}

/**
 * The build-time warning for a set of shadowed slugs, or `null` when there is
 * nothing to say.
 *
 * Advisory rather than fatal, matching the orphan-chapter-tag warning in
 * `chapters/[slug].astro`: refusing to build over one badly-slugged page would
 * turn a single invisible page into a dead site update, which is strictly worse.
 * The message names the slugs and says what to do, because it is read by whoever
 * is watching a deploy log, not by whoever wrote the page.
 */
export function shadowedSlugWarning(shadowed: readonly string[]): string | null {
  if (shadowed.length === 0) return null;
  const one = shadowed.length === 1;
  const list = shadowed.map((slug) => JSON.stringify(slug)).join(', ');
  return (
    `[pages] ${shadowed.length} ${one ? 'page uses' : 'pages use'} a slug the site already ` +
    `routes elsewhere and will not be reachable: ${list}. ` +
    `Rename ${one ? 'it' : 'them'} in /admin → Pages (the entry's slug), or the existing ` +
    `route keeps the address.`
  );
}

/** The minimum shape this module needs from a `pages` entry: its slug (`id`,
 * the Content Layer's file stem). Structural, so it accepts a real
 * `CollectionEntry<'pages'>` without importing `astro:content` — which is what
 * keeps this module unit-testable. */
export interface PageEntryLike {
  id: string;
}

/** The routing decision for a set of page entries. */
export interface PageRouteSelection<T extends PageEntryLike> {
  /** Entries that get a route, in input order. */
  routable: T[];
  /** Slugs dropped because something else already answers at that address. */
  shadowed: string[];
  /** The build-time warning naming them, or `null` when nothing was dropped. */
  warning: string | null;
}

/**
 * Split page entries into the ones that get a route and the ones that cannot.
 *
 * A shadowed entry is DROPPED rather than emitted: Astro refuses to build two
 * routes for one path, so emitting it would fail the whole build over a single
 * badly-slugged page. Dropping it plus warning turns that into one reported,
 * recoverable loss — and the static route was going to win the address anyway.
 *
 * Extracted from `getStaticPaths`, where the same shadow list was computed
 * TWICE (once for the warning, once for the filter) and none of it could be
 * tested — `getStaticPaths` only runs inside a real Astro build.
 */
export function pageRouteEntries<T extends PageEntryLike>(
  pages: readonly T[],
  reserved: readonly string[] = RESERVED_PAGE_SLUGS,
): PageRouteSelection<T> {
  const shadowed = shadowedPageSlugs(
    pages.map((page) => page.id),
    reserved,
  );
  const dropped = new Set(shadowed);
  return {
    routable: pages.filter((page) => !dropped.has(page.id)),
    shadowed,
    warning: shadowedSlugWarning(shadowed),
  };
}

/** The frontmatter fields that feed a page's `<head>`. */
export interface PageSeoFields {
  title: string;
  description?: string;
  metaTitle?: string;
  metaDescription?: string;
  ogImage?: string;
}

/** What the layout needs to render a page's `<head>`. */
export interface PageSeo {
  title: string;
  description?: string;
  image?: string;
}

/**
 * Resolve a page's SEO fields: the explicit override, else the page's own
 * visible copy, else (inside `<SEO />`) the site defaults.
 *
 * One function rather than three `??` expressions in the route, because this is
 * the rule deciding what search results and share cards say about every
 * CMS-authored page — an editor who fills in "SEO title" expects it to win, and
 * one who leaves it blank expects their real title, not an empty tag.
 *
 * A blank-but-present override (`metaTitle: ''`, which the CMS writes when an
 * editor clears the box) is treated as ABSENT, not as an empty title. `??`
 * alone would have published a page with no title at all.
 */
export function pageSeo(data: PageSeoFields): PageSeo {
  const firstNonBlank = (...values: (string | undefined)[]): string | undefined =>
    values.find((value) => value !== undefined && value.trim() !== '');

  return {
    title: firstNonBlank(data.metaTitle, data.title) ?? data.title,
    description: firstNonBlank(data.metaDescription, data.description),
    image: firstNonBlank(data.ogImage),
  };
}

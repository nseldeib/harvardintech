// Loading the homepage's bands, hero slides, and stat figures from their content
// collections.
//
// Split from `./homeSections.ts` for the same reason `./momentumSectionsContent.ts`
// is split from `./momentumSections.ts`: that module is pure and framework-free so
// its ordering and visibility rules unit-test without Astro. This one touches
// `astro:content`, so it is the thin, untestable edge — read, draft-filter, order.
//
// It exists as a module rather than as page frontmatter because TWO callers need
// the same bands: `index.astro` renders them, and `BaseLayout.astro` reads them to
// drop menu links to hidden ones. A second hand-rolled copy of this pipeline is a
// copy that drifts, and the two disagreeing would mean a menu item pointing at a
// band that is not on the page — precisely the failure the visibility rule exists
// to prevent.

import { getCollection } from 'astro:content';
import { publishedEntries } from './drafts';
import { INCLUDE_DRAFTS } from './draftVisibility';
import { sortByOrder } from './order';
import { orderedHomeSections, unknownHomeSectionKinds, type HomeSectionLike } from './homeSections';

/** One hero slide as the carousel wants it. */
export interface HeroSlideLike {
  title: string;
  kicker?: string;
  lede?: string;
  image?: string;
  ctas?: { label: string; url: string; variant?: string }[];
}

/** One figure in the stat strip. */
export interface StatLike {
  value: string;
  label: string;
}

/**
 * The published bands in editor order, plus any `kind` values that matched no
 * component so the caller can warn about them.
 *
 * Drafts follow the site-wide rule: visible while authoring and on the review
 * track, omitted from the public build. So a band an editor hid is absent from
 * the live site and still reviewable before they turn it back on.
 */
export async function loadHomeSections(): Promise<{
  sections: HomeSectionLike[];
  unknownKinds: string[];
}> {
  const entries = publishedEntries(await getCollection('homeSections'), INCLUDE_DRAFTS).map(
    (entry) => entry.data,
  );

  return { sections: orderedHomeSections(entries), unknownKinds: unknownHomeSectionKinds(entries) };
}

/**
 * The published hero slides in editor order.
 *
 * An empty result is meaningful, not an error: `HeroCarousel` falls back to its
 * own defaults, so the top of the site can never render blank because someone
 * drafted every slide.
 */
export async function loadHeroSlides(): Promise<HeroSlideLike[]> {
  return sortByOrder(
    publishedEntries(await getCollection('heroSlides'), INCLUDE_DRAFTS).map((entry) => entry.data),
  );
}

/** The published stat figures in editor order. Empty falls back the same way. */
export async function loadHomeStats(): Promise<StatLike[]> {
  return sortByOrder(
    publishedEntries(await getCollection('stats'), INCLUDE_DRAFTS).map((entry) => entry.data),
  );
}

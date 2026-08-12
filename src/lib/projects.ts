// Volunteer-project selection for /volunteer.
//
// The `projects` collection holds every project the org has ever posted; the
// page shows only the ones currently open, in the order an editor chose. Kept
// out of the `.astro` component so it is unit-testable without rendering.
import { sortByOrder, type Ordered } from './order';
import { formatEventDate } from './events';

export interface ProjectLike extends Ordered {
  title: string;
  /** Absent means OPEN. An editor who never touches the toggle should still
   *  see their project on the page — only an explicit `false` retires it. */
  active?: boolean;
  /** The entry's id. Only `relatedProjects` needs it, to know which project the
   *  reader is already on and where to start the wrap-around. */
  slug?: string;
}

/**
 * The projects to render: currently-open ones, ordered. Non-mutating.
 */
export function openProjects<T extends ProjectLike>(projects: readonly T[]): T[] {
  return sortByOrder(projects.filter((p) => p.active !== false));
}

/**
 * Where one project's detail page lives. The route and the card that links to it
 * both derive their URL from here, so the two cannot drift apart — the bug that
 * made a thumbnail look clickable while pointing nowhere.
 *
 * Site-root-relative on purpose: callers wrap it in `withBase` so it resolves
 * under both deploy bases, exactly as every other internal link does.
 */
export function projectPath(slug: string): string {
  return `/volunteer/projects/${slug}`;
}

/** The call-to-action a project detail page should render, or `null` for none. */
export interface ProjectCta {
  href: string;
  label: string;
}

/**
 * Which sign-up link a project's detail page offers.
 *
 * A project's own `applyUrl` wins. When it has none the page falls back to the
 * site-wide volunteer CTA, because a project posted before its sign-up form
 * exists still needs a way in — a page that just ends after the description
 * leaves a willing reader with nowhere to go. Only when neither exists does the
 * page render no ask at all, rather than a dead button.
 *
 * Pure so the fallback rule is testable without rendering; the caller wraps
 * `href` in `withBase` like every other internal link.
 */
export function projectCta(
  applyUrl?: string,
  ctaLabel?: string,
  ctaUrl?: string,
): ProjectCta | null {
  if (applyUrl) return { href: applyUrl, label: 'Get involved' };
  if (ctaUrl) return { href: ctaUrl, label: ctaLabel || 'Volunteer with us' };
  return null;
}

/** The year `formatEventDate` appends, so a same-year range can drop it from the
 *  opening date. Matches the trailing ", YYYY" that `month: long, day: numeric,
 *  year: numeric` in the en-US locale always produces — the one place this
 *  module depends on the SHAPE of that format rather than just calling it. */
const TRAILING_YEAR = /,\s*\d{4}$/;

/**
 * A project's dates as one display string, or `null` when it has none.
 *
 * Four real cases, because both fields are optional and an organizer fills them
 * in whenever they know them:
 *   both        → "September 1 – December 15, 2026" (the shared year is written
 *                 once) or "December 1, 2026 – March 3, 2027" across a boundary
 *   start only  → "Starts September 1, 2026"
 *   end only    → "Through December 15, 2026"
 *   neither     → null, so the caller renders nothing rather than an empty chip
 *
 * Each date goes through `formatEventDate`, the site's single "Month D, YYYY"
 * formatter, so a project date and an event date can never drift into two
 * formats. Its name is event-flavoured for what is now a site-wide job; renaming
 * it would ripple through the events pages for no user-visible gain.
 *
 * An INVERTED range (end before start) formats in the order it was authored
 * rather than being silently swapped: a visibly wrong range on the page is a bug
 * an organizer reports, a quietly reordered one is a mystery. Never throws.
 */
export function formatProjectDates(
  start?: string | Date,
  end?: string | Date,
): string | null {
  const from = start ? formatEventDate(start) : null;
  const to = end ? formatEventDate(end) : null;

  if (from && to) {
    const sameYear = from.match(TRAILING_YEAR)?.[0] === to.match(TRAILING_YEAR)?.[0];
    return `${sameYear ? from.replace(TRAILING_YEAR, '') : from} – ${to}`;
  }
  if (from) return `Starts ${from}`;
  if (to) return `Through ${to}`;
  return null;
}

/** A `projects` collection entry as it arrives from `getCollection` — an `id`
 *  plus the validated frontmatter. Narrow enough that `projectCardData` needs no
 *  `astro:content` import and stays unit-testable, the same split
 *  `EventEntryLike` uses in `src/lib/events.ts`. */
export interface ProjectEntryLike {
  id: string;
  data: {
    title: string;
    blurb?: string;
    image?: string;
    applyUrl?: string;
    commitment?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    order?: number;
    active?: boolean;
  };
}

/** The flat shape a project card renders — frontmatter with the entry's `id`
 *  promoted to `slug`, and nothing from `astro:content`. */
export interface ProjectCardData extends ProjectLike {
  slug: string;
  blurb?: string;
  image?: string;
  applyUrl?: string;
  commitment?: string;
  startDate?: string | Date;
  endDate?: string | Date;
}

/**
 * Project entries projected into the flat shape the cards render.
 *
 * Lives here rather than inline in `/volunteer/projects/[slug].astro` because it
 * is the piece most likely to drift silently: a new field on the `projects`
 * schema that is not added to this projection simply never reaches a suggestion
 * card, with no type error and no failing build to say so. One projection under
 * test beats the same nine-line map written out in a route file.
 *
 * The entry's `id` becomes `slug`, which is what `projectPath` and the
 * wrap-around in `relatedProjects` key on. Non-mutating; an empty list in gives
 * an empty list out.
 */
export function projectCardData(entries: readonly ProjectEntryLike[]): ProjectCardData[] {
  return entries.map((entry) => ({
    slug: entry.id,
    title: entry.data.title,
    blurb: entry.data.blurb,
    image: entry.data.image,
    applyUrl: entry.data.applyUrl,
    commitment: entry.data.commitment,
    startDate: entry.data.startDate,
    endDate: entry.data.endDate,
    order: entry.data.order,
    active: entry.data.active,
  }));
}

/**
 * Up to `limit` other open projects to suggest at the bottom of one project's
 * detail page.
 *
 * "Related" here means ADJACENT IN EDITOR ORDER, wrapping past the end — not
 * semantically similar. The collection carries no tag, category, or topic field,
 * so there is nothing to compute similarity from; of the honest alternatives
 * (recency, matching commitment, curated order) the editor's own ordering is the
 * only one that reflects a human decision. Wrapping means the last project still
 * gets suggestions instead of none.
 *
 * Filtered through `openProjects` so a retired project is never advertised at
 * the bottom of an open one — the detail route generates a page for every
 * published entry regardless of `active`, so without this a closed project would
 * be suggested. Reusing the helper keeps "what counts as open" in one place.
 *
 * Returns `[]` when there is no other open project — which is today's real
 * state, with one project in the collection — and when `currentSlug` names
 * nothing open. Non-mutating, like `openProjects`.
 */
export function relatedProjects<T extends ProjectLike>(
  all: readonly T[],
  currentSlug: string,
  limit = 3,
): T[] {
  const open = openProjects(all);
  const current = open.findIndex((p) => p.slug === currentSlug);
  if (current === -1) return [];
  return [...open.slice(current + 1), ...open.slice(0, current)].slice(0, limit);
}

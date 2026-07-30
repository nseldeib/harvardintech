// Pure, framework-free helpers for the events feature. Kept out of any `.astro`
// component so they can be unit-tested under vitest and reused by both the
// landing-page UpcomingEvents section and the /events page. No DOM, no Astro
// imports — just data in, data out.

export interface EventLike {
  slug?: string;
  title: string;
  date: string | Date;
  location?: string;
  description?: string;
  link?: string;
  /** Id of the chapter OR community this event is tagged to — that entry's
   *  filename without `.md`. One "belongs to" field serves both, so an editor
   *  has no second box to choose between. */
  chapter?: string;
}

/**
 * The shape a collection entry arrives in from `getCollection` — an `id` plus
 * the validated frontmatter. Narrow enough that `eventsTaggedTo` needs no Astro
 * import and stays unit-testable.
 */
export interface EventEntryLike {
  id: string;
  data: {
    title: string;
    date: string | Date;
    location?: string;
    description?: string;
    link?: string;
    chapter?: string;
  };
}

/**
 * The events belonging to `ownerId` — a chapter id or a community id — projected
 * into the `EventLike` shape the event cards render.
 *
 * The match is an EXACT string comparison against the owner's id, because that
 * is what `/chapters/<slug>` and `/communities/<slug>` are keyed on. A near-miss
 * (`New York City` for `nyc`, or a stray trailing space) silently belongs to
 * nobody — which is precisely the case `unmatchedChapterTags` reports, so the
 * two functions are two halves of one rule and live together on purpose.
 *
 * An event with no tag belongs to no page: it is excluded here and still appears
 * on `/events`. Callers pass entries already draft-filtered by `publishedEntries`,
 * the same contract every other derivation in this codebase has.
 */
export function eventsTaggedTo(
  events: readonly EventEntryLike[],
  ownerId: string,
): EventLike[] {
  return events
    .filter((event) => event.data.chapter === ownerId)
    .map((event) => ({
      slug: event.id,
      title: event.data.title,
      date: event.data.date,
      location: event.data.location,
      description: event.data.description,
      link: event.data.link,
    }));
}

/** Coerce a string-or-Date into a Date (Dates pass through untouched). */
export function toEventDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Format an event date as "Month D, YYYY" (e.g. "September 24, 2026") in the
 * en-US locale — the display format used across every event card.
 */
export function formatEventDate(value: string | Date): string {
  return toEventDate(value).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Split a flat list of events into `upcoming` (date >= now, soonest first) and
 * `past` (date < now, most recent first), relative to `now` (defaults to the
 * current time). Events exactly at `now` count as upcoming.
 */
export function splitEvents<T extends EventLike>(
  events: T[],
  now: string | Date = new Date(),
): { upcoming: T[]; past: T[] } {
  const reference = toEventDate(now).valueOf();
  const upcoming = events
    .filter((e) => toEventDate(e.date).valueOf() >= reference)
    .sort((a, b) => toEventDate(a.date).valueOf() - toEventDate(b.date).valueOf());
  const past = events
    .filter((e) => toEventDate(e.date).valueOf() < reference)
    .sort((a, b) => toEventDate(b.date).valueOf() - toEventDate(a.date).valueOf());
  return { upcoming, past };
}

/**
 * The distinct `chapter` tags on `events` that match no id in `chapterIds`, in
 * first-seen order.
 *
 * `/chapters/<slug>` links an event to its chapter by exact string match on the
 * chapter's id (its filename without `.md`), and the CMS renders `chapter` as a
 * free-text box — so `New York City` instead of `nyc`, or a stray trailing
 * space, drops the event off the chapter page while the entry still validates,
 * the build still succeeds, and `/events` still lists it. Naming those tags is
 * the only signal an editor gets until the CMS can offer a chapter picker.
 *
 * Events with no tag, or a blank one, are excluded rather than reported: an
 * untagged event belongs to no chapter on purpose.
 */
export function unmatchedChapterTags(
  events: readonly { chapter?: string }[],
  chapterIds: readonly string[],
): string[] {
  const known = new Set(chapterIds);
  const reported = new Set<string>();
  const unmatched: string[] = [];
  for (const { chapter } of events) {
    if (!chapter || chapter.trim() === '') continue;
    if (known.has(chapter) || reported.has(chapter)) continue;
    reported.add(chapter);
    unmatched.push(chapter);
  }
  return unmatched;
}

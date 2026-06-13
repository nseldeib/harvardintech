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

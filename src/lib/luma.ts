// Harvard Alumni in Tech's Luma calendar — the single source of truth for the
// org's event calendar URL. Used by the Events page (the "full calendar" block)
// and by the empty-state CTA on the homepage's Upcoming Events section (to point
// visitors at the Luma calendar to subscribe).
//
// We have the public calendar page (https://lu.ma/harvardintech). To embed the
// calendar inline as an <iframe> instead of linking out, grab the embed snippet
// from Luma → calendar settings → Embed (it yields a
// `https://lu.ma/embed/calendar/cal-XXXX/events` URL) and set LUMA_EMBED_URL.

/** Public calendar page visitors land on to browse and subscribe. */
export const LUMA_CALENDAR_URL = 'https://lu.ma/harvardintech';

/** Optional inline-embed src. When set, the Events page renders the calendar as
 *  an <iframe> instead of the link-out card. Taken from Luma → calendar
 *  settings → Embed for calendar `cal-KK3JJjJ39Jwt9kI`.
 *
 *  `lt=light` pins Luma's light theme. Without it the embed defaults to
 *  `system`, which renders a dark calendar block on our light Events page. */
export const LUMA_EMBED_URL =
  'https://luma.com/embed/calendar/cal-KK3JJjJ39Jwt9kI/events?lt=light';

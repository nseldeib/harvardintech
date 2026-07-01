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

/** Optional inline-embed src. Empty until the embed cal-id is provided; when
 *  set, the Events page renders the calendar as an <iframe> instead of a card. */
export const LUMA_EMBED_URL = '';

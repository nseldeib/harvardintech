// Hero personalization for the Momentum Fund campaign page (/donate).
//
// The email campaign links to `/donate?name=Nicole` so the hero can greet a
// subscriber by name; everyone arriving without a name (the public link, a
// social share, a forward) sees the generic greeting from the same page. One
// page, both audiences — no duplicate landing page to keep in sync.
//
// The site is `output: 'static'`, so this cannot run at render time: the HTML is
// built once, long before anyone clicks the link. The name is read in the
// browser and written into the hero after load (see MomentumFundHero.astro).
//
// SECURITY: the value comes from a URL a stranger controls, and the page it
// lands on is one we mail to the whole list — a plausible target for someone
// crafting `/donate?name=<something nasty>` and forwarding it as an official
// link. The consumer writes the result via `textContent` (never innerHTML), and
// this module is the second layer: reject anything that isn't plausibly a
// first name, so a hostile link degrades to the generic greeting rather than
// rendering attacker-chosen text under Harvard's brand.
//
// Pure and framework-free so it is unit-testable without a DOM.

/** Longest accepted first name. Comfortably fits real names; stops a URL that
 *  tries to stuff a paragraph (or a payload) into the headline. */
export const MAX_NAME_LENGTH = 40;

// Letters (incl. accented/non-Latin via Unicode letter class), plus the marks
// that legitimately appear inside names: space, hyphen, apostrophe, period.
// Deliberately EXCLUDES <>&"/\{}()=;: — the characters an injection attempt
// needs — and digits, which no first name has.
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} '’.\-]*$/u;

/**
 * Normalize a raw `?name=` value into a display-safe first name, or `null` when
 * it is absent, empty, over-long, or doesn't look like a name.
 *
 * Only the FIRST whitespace-separated token is kept: campaign tools often merge
 * a full name into the field, and "Hi Nicole —" reads better than
 * "Hi Nicole Eldeib —" in a greeting.
 */
export function sanitizeFirstName(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;

  // Collapse whitespace (a merge field can arrive with newlines or padding).
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (collapsed.length === 0) return null;
  // Length-check BEFORE taking the first token, so a long payload with a short
  // first word ("Hi <script>…") is rejected outright rather than truncated
  // into something that looks legitimate.
  if (collapsed.length > MAX_NAME_LENGTH) return null;
  if (!NAME_PATTERN.test(collapsed)) return null;

  const first = collapsed.split(' ')[0];
  return first.length > 0 ? first : null;
}

/**
 * Choose the hero greeting. `named` may contain a `{name}` placeholder; with no
 * usable name (or no placeholder to fill) the generic greeting is used, so the
 * page always renders a complete sentence and never a stray "{name}".
 */
export function heroGreeting(
  named: string,
  generic: string,
  rawName: string | null | undefined,
): string {
  const name = sanitizeFirstName(rawName);
  if (name === null || !named.includes('{name}')) return generic;
  return named.replace(/\{name\}/g, name);
}

/** Pull the `name` parameter out of a full URL or a bare query string. */
export function nameFromSearch(search: string | null | undefined): string | null {
  if (typeof search !== 'string' || search.length === 0) return null;
  const q = search.includes('?') ? search.slice(search.indexOf('?')) : search;
  try {
    return new URLSearchParams(q).get('name');
  } catch {
    return null;
  }
}

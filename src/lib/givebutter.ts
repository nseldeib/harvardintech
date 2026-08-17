// Pure, framework-free rules for the Givebutter fundraising widgets.
//
// No `fs`, no Astro imports, so this unit-tests directly — the same shape as
// `./giving.ts`, which decides where a Give button points. This module decides
// only one thing: whether the site ships Givebutter's loader script at all, and
// at what URL.
//
// The split matters. Givebutter's own instructions are "paste this <script> tag
// into your <head>", and the site has a box that would take it verbatim — the
// `customHeadHtml` escape hatch. That box is the power-user, inject-anything
// door, where a typo is a broken <head> on every page. So the template owns the
// script markup and an editor types only the account id, exactly the split
// `Analytics.astro` already makes for the GA4 measurement id.

/** Givebutter's widget loader, the origin their embed snippet points at. */
const LOADER_ORIGIN = 'https://widgets.givebutter.com/latest.umd.cjs';

/**
 * Where to load Givebutter's widget script from, or `undefined` when no account
 * is configured.
 *
 * `undefined` is the "ship no third-party script at all" state, and it is the
 * DEFAULT: a site with no Givebutter account loads no Givebutter code rather
 * than a disabled or empty tag. Blank and whitespace-only are treated as absent,
 * so a cleared CMS box cannot produce `acct=`.
 *
 * A `goal-meter` band still emits its `<givebutter-widget>` element in that
 * state, but with no script to define it the element never upgrades and the band
 * stays collapsed — inert markup, nothing rendered, no third-party request.
 *
 * The id is URL-encoded because it arrives by copy-paste from Givebutter's
 * dashboard: a stray `&` or `#` in what an editor pasted must not be able to
 * alter the query string it lands in.
 */
export function givebutterScriptSrc(accountId?: string): string | undefined {
  const trimmed = accountId?.trim();
  if (!trimmed) return undefined;
  return `${LOADER_ORIGIN}?acct=${encodeURIComponent(trimmed)}&p=other`;
}

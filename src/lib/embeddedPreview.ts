// Is this page being rendered INSIDE the CMS entry editor's live preview pane,
// rather than being visited by a person?
//
// From @codeyam/cms 0.14.0 the entry editor embeds the entry's real page in an
// iframe beside the form, so it reloads on every entry an editor opens. The page
// it embeds is the ordinary published page — same HTML, same <head> — which
// means every third-party tag in that head fires once per entry opened. For
// Google Analytics that is a `page_view` per edit: the team's own editing lands
// in the same property as real visitors, and the traffic numbers stop meaning
// what they say. Givebutter's donation widget loads too, which is weight and a
// live donate form nobody asked for inside an editing tool.
//
// The CMS marks those loads for exactly this purpose — `cms-embed=1` says "a
// pane is showing you, not a reader" — so the fix is to read the flag rather
// than to guess from referrers or frame nesting.
//
// WHY A PURE FUNCTION OVER `location.search` AND NOT A SERVER CHECK: the site is
// `output: 'static'`, so every page is built once, long before anyone opens the
// editor. The query string is only knowable in the browser, which puts this in a
// `<script>` — and this repo's convention for that (see MomentumHero.astro) is a
// bundled script importing a tested function, never logic stranded in an inline
// string where no test can reach it.

/** The CMS's own flag for "this page is embedded in the editor's preview pane".
 * Mirrors `PREVIEW_EMBED_FLAG` in @codeyam/cms; kept as a literal so the site's
 * public pages never import from the admin package, which ships only on the
 * gated review track. */
export const EMBED_FLAG = 'cms-embed';

/**
 * True when `search` carries the editor-pane flag.
 *
 * Deliberately loose about the VALUE: the CMS writes `cms-embed=1` today, but
 * the flag's meaning is its presence, and a future `cms-embed` or
 * `cms-embed=true` should suppress the tags just the same. The failure modes are
 * asymmetric — a missed embed pollutes real analytics data permanently, while a
 * false positive costs one uncounted visit from someone who hand-typed the
 * parameter.
 *
 * @param search A `location.search` string, with or without the leading `?`.
 */
export function isEmbeddedPreview(search: string): boolean {
  if (!search) return false;
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  return params.has(EMBED_FLAG);
}

/**
 * Append a third-party `<script async src>` to `<head>` — unless this page load
 * is the editor's preview pane, or no source is configured.
 *
 * Both suppressing callers were writing these same six lines, which is how the
 * two would have drifted: a later fix to one (a `defer`, a nonce, a second flag)
 * silently leaving the other loading in the pane.
 *
 * `doc` is a parameter rather than a reference to the ambient `document` so the
 * DOM half is reachable from a unit test; the callers pass their own `document`.
 *
 * @returns whether the tag was appended. Callers gate their OWN follow-on work
 * on this — Analytics has Google's `dataLayer`/`gtag` bootstrap to run, and
 * running it against a tag that was never loaded would leave a half-initialised
 * global queueing events nothing will ever send.
 */
export function loadScriptUnlessEmbedded(
  doc: Document,
  search: string,
  src: string | undefined,
): boolean {
  if (!src) return false;
  if (isEmbeddedPreview(search)) return false;

  const tag = doc.createElement('script');
  tag.async = true;
  tag.src = src;
  doc.head.appendChild(tag);
  return true;
}

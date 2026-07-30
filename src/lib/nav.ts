// Pure, framework-free helpers for the site navigation. No `fs` and no Astro
// imports, so the rules unit-test directly — the same shape as `./drafts.ts`
// and `./events.ts`. The layout supplies the data; this module only reshapes it.
//
// The Chapters dropdown is DERIVED from the `chapters` collection rather than
// hand-listed in `nav.json`. Publishing a chapter through the CMS is therefore
// the only step needed to put it in the menu, and drafting, renaming, or
// deleting one can no longer leave a menu entry pointing at a 404.
//
// The group is injected here rather than marked in `nav.json` because the CMS
// round-trip would erase a marker: `normalizeNavItem` in @codeyam/cms rebuilds
// every nav item from `label` plus `children`/`url` and drops any other key, and
// it collapses a dropdown with no children back to a plain link. A group the
// layout injects is the only form that serializer cannot corrupt.
import type { NavItem } from './site';

/**
 * The minimum shape needed to build a chapter link: `{ slug, ...data }`, the
 * same projection `index.astro` builds for the "Our chapters" section.
 */
export interface ChapterLike {
  slug: string;
  city: string;
  order?: number;
}

/**
 * The minimum shape needed to build a community link. `name` rather than `city`
 * — a community is defined by an interest, not a location — but the ordering and
 * draft rules are the chapter rules, so the two derivations stay symmetric.
 */
export interface CommunityLike {
  slug: string;
  name: string;
  order?: number;
}

/** The label the injected dropdown carries in the header. */
export const CHAPTERS_LABEL = 'Chapters';

/** The group derived communities are merged INTO. Unlike Chapters — a group
 *  this module injects wholesale — Communities already exists in `nav.json`
 *  carrying hand-authored links (WhatsApp), so the derived items join it. */
export const COMMUNITIES_LABEL = 'Communities';

/** The group the derived Chapters dropdown is inserted after, reproducing
 *  today's menu order. Absent (renamed or removed), the group is appended. */
const INSERT_AFTER_LABEL = 'Programs';

/**
 * Menu items for the given chapters, ordered exactly as the "Our chapters"
 * section orders its cards (`OurChapters.astro`) — by `order`, with `city`
 * breaking ties and sorting the entries that carry no `order` at all. Sharing
 * the convention is what keeps the two surfaces from ever disagreeing.
 *
 * The label is the chapter's own `city`, so the menu shows the name the editor
 * typed; the url is built from the `slug`, matching the `/chapters/<slug>`
 * route. Paths are returned base-agnostic — the layout wraps them in `withBase`
 * at render, as it already does for every other nav item.
 *
 * Callers pass chapters that are already draft-filtered (via `publishedEntries`),
 * so draft visibility stays one rule applied identically at every call site.
 */
export function chapterNavItems(chapters: ChapterLike[]): NavItem[] {
  return [...chapters]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.city.localeCompare(b.city))
    .map((chapter) => ({ label: chapter.city, url: `/chapters/${chapter.slug}` }));
}

/**
 * The top-level menu with the derived Chapters dropdown inserted directly after
 * `Programs`, or appended when no such item exists.
 *
 * With no chapters the group is omitted entirely rather than rendered empty: an
 * empty dropdown is a caret that opens onto nothing, and the CMS serializer
 * collapses it back into a plain link pointing nowhere.
 *
 * Returns a new array — the input is not mutated.
 */
export function withChapterGroup(items: NavItem[], chapterItems: NavItem[]): NavItem[] {
  if (chapterItems.length === 0) return [...items];

  const group: NavItem = { label: CHAPTERS_LABEL, children: chapterItems };
  const anchor = items.findIndex((item) => item.label === INSERT_AFTER_LABEL);
  if (anchor === -1) return [...items, group];

  return [...items.slice(0, anchor + 1), group, ...items.slice(anchor + 1)];
}

/**
 * Menu items for the given communities, ordered the way chapters are: by the
 * optional `order` pin, then alphabetically by name. The label is the
 * community's own `name`, the url is built from the `slug` to match the
 * `/communities/<slug>` route.
 *
 * Callers pass communities already draft-filtered (via `publishedEntries`), the
 * same contract `chapterNavItems` has.
 */
export function communityNavItems(communities: CommunityLike[]): NavItem[] {
  return [...communities]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name))
    .map((community) => ({ label: community.name, url: `/communities/${community.slug}` }));
}

/**
 * The top-level menu with the derived community links merged into the existing
 * `Communities` group, after whatever that group already lists by hand.
 *
 * This is the asymmetry with `withChapterGroup`: Chapters is a group this module
 * OWNS, so it injects the whole thing; Communities is a group an editor already
 * owns in `nav.json` (the WhatsApp link), so the derived items are appended to
 * its children rather than replacing them. An editor reordering or renaming the
 * hand-authored links keeps working, and publishing a community still needs no
 * nav edit at all.
 *
 * With no communities the menu is returned unchanged — including the case where
 * `nav.json` has no Communities group, which is then NOT created: an empty
 * dropdown is the same caret-onto-nothing the chapters rule avoids.
 *
 * Returns a new array; neither the input list nor its item objects are mutated.
 */
export function withCommunityItems(items: NavItem[], communityItems: NavItem[]): NavItem[] {
  if (communityItems.length === 0) return [...items];

  const anchor = items.findIndex((item) => item.label === COMMUNITIES_LABEL);
  if (anchor === -1) return [...items, { label: COMMUNITIES_LABEL, children: communityItems }];

  const existing = items[anchor];
  const merged: NavItem = {
    ...existing,
    children: [...(existing.children ?? []), ...communityItems],
  };

  return [...items.slice(0, anchor), merged, ...items.slice(anchor + 1)];
}

/**
 * Every site-internal url in the menu tree, in declaration order. Internal means
 * rooted at `/`; the `https://` links out to Medium, LinkedIn, and the
 * newsletter are another site's problem and out of scope for the guard.
 */
export function internalNavUrls(items: NavItem[]): string[] {
  const urls: string[] = [];

  const walk = (nodes: NavItem[]) => {
    for (const node of nodes) {
      if (node.url?.startsWith('/')) urls.push(node.url);
      if (node.children) walk(node.children);
    }
  };
  walk(items);

  return urls;
}

/**
 * Reduce a nav url to the page it actually lands on: drop any `#fragment` so
 * `/events#webinars` resolves against `/events`, read a bare `/#about` as the
 * home page, and ignore a trailing slash.
 */
function toPath(url: string): string {
  const withoutFragment = url.split('#')[0];
  const trimmed = withoutFragment.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * The urls with no page behind them. `knownPaths` is every route the site
 * actually builds — the static pages plus what the `[slug]` routes generate
 * from published content.
 *
 * This is what catches the hand-authored links that remain in `nav.json` after
 * the chapters stop being hand-listed: `Content Hub → Blog` points at one
 * specific post (`/blog/welcome`) and breaks the moment that post is drafted,
 * renamed, or deleted.
 *
 * Reported as a unit test rather than a build gate on purpose: the deploy
 * workflow runs `npm run build` and never runs vitest, so a dead link informs
 * developers without ever blocking an editor's publish.
 */
export function unresolvedNavUrls(urls: string[], knownPaths: string[]): string[] {
  const known = new Set(knownPaths.map(toPath));
  return urls.filter((url) => !known.has(toPath(url)));
}

---
title: "cms -- Chapters Nav Derived From Content"
mode: ui
createdAt: "2026-07-27T21:15:03Z"
prefix: "cms"
source: manual
---

## Summary

Publishing a chapter through `/admin` does not put it in the site's navigation.
The header's Chapters dropdown is a hand-written list of five links in
`src/data/nav.json`, duplicating what already lives in `src/content/chapters/`.
An editor who adds a sixth chapter gets a working `/chapters/<slug>` page and a
new card in the "Our chapters" section, but no menu entry — and no warning that
one is missing. The reverse is worse: draft, rename, or delete a chapter and the
menu keeps pointing at a URL that now 404s.

The drift also silently corrupts a second surface. `BaseLayout.astro:26-27`
builds the crimson utility strip ("A global community · Boston & Cambridge ·
New York City · …") by reading the labels out of that same nav group, so a stale
nav line means a stale city list at the top of every page on the site.

This plan makes the Chapters dropdown derive from the `chapters` collection at
render time, so publishing a chapter is the only step, and adds an integrity
guard over the internal links that remain hand-authored in `nav.json` — starting
with `Content Hub → Blog`, which points at one specific post (`/blog/welcome`)
and breaks the moment that post is drafted or renamed.

## Key Decisions

- **Derive at render time, don't lint a hand-maintained list.** A guard that
  merely fails when `nav.json` disagrees with the collection would push a second
  manual step onto a non-technical editor at exactly the wrong moment — and
  because `npm run build` (which the deploy workflow runs) includes `astro
  check`, a hard failure there would silently stop the deploy of a chapter they
  just published. Derivation removes the step instead of policing it.

- **Remove the Chapters group from `nav.json` entirely and inject it in the
  layout — do not mark it with a `source` key.** The CMS round-trip forbids the
  marker approach: `normalizeNavItem` in
  `node_modules/@codeyam/cms/src/lib/siteConfig.ts:138-144` rebuilds every nav
  item from `label` plus `children`/`url` and nothing else, so any extra key
  (`source: "chapters"`) is silently dropped the first time anyone saves the nav
  from `/admin/settings`. The same function collapses a dropdown with an empty
  `children` array back to a plain link, so "keep the group but empty it" is not
  a stable shape either. A group the layout injects is the only form the CMS
  serializer cannot corrupt.

- **Accept that the injected group is not reorderable from `/admin`.** This is
  the real cost of the decision above: editors can rename or reorder every other
  menu group but not Chapters. It is the right trade against a dropdown that
  lies. The durable fix is a collection-backed nav-group field in `@codeyam/cms`
  (raised separately as a package feature request); when that lands, this
  injection becomes the fallback.

- **Inject after the group labeled `Programs`, appending if it is absent.**
  That reproduces today's menu order exactly and degrades to a sensible position
  rather than throwing if someone renames or removes Programs.

- **Reuse the ordering convention the chapters section already uses.**
  `OurChapters.astro:20-22` sorts by `(a.order ?? 99) - (b.order ?? 99) ||
  a.city.localeCompare(b.city)`. The chapters carry `order` 1–5 (Boston,
  NYC, London, DC, Seattle), which is byte-for-byte today's nav order, so the
  derived menu ships with no visible reordering.

- **Labels come from `city`, which changes one label.** `nav.json` currently
  reads `DC & DMV`; the chapter's `city` is `DC & DMV Area`. Deriving means the
  menu shows the chapter's own name. That is the correct behavior — one source
  of truth — and the label change is intentional, not a regression.

- **Drafts are respected the same way every other route respects them.** Build
  the derived items from `publishedEntries(await getCollection('chapters'),
  !import.meta.env.PROD)` so a drafted chapter is previewable under `astro dev`
  and absent from the built menu, matching `src/pages/index.astro:38` and the
  rest of the site.

- **Guard the links that stay hand-authored, as a unit test, not a build gate.**
  `nav.json` still holds `/events`, `/blog/welcome`, and a set of `/#anchor`
  links. A pure helper plus a vitest guard reports any internal nav URL with no
  corresponding published page or real route. Deliberately not wired into
  `astro build`: the deploy workflow (`.github/workflows/deploy.yml:50`) runs
  `npm run build` and never runs vitest, so a test failure informs developers
  without ever blocking an editor's publish.

## Implementation

### 1. The pure nav helpers

**New file**: `src/lib/nav.ts`

Framework-free, no `fs` and no Astro imports, so it unit-tests directly — the
same shape as `src/lib/drafts.ts` and `src/lib/events.ts`.

- `chapterNavItems(chapters)` — map published chapters to `{ label: city, url:
  '/chapters/<slug>' }`, sorted with the `OurChapters` convention above. Returns
  `[]` for no chapters.
- `withChapterGroup(items, chapterItems)` — return a new top-level item list
  with a `Chapters` dropdown inserted directly after the item labeled
  `Programs`, or appended when there is none. When `chapterItems` is empty the
  group is omitted entirely rather than rendered as an empty dropdown.
- `internalNavUrls(items)` — walk the (up to three-level) tree and collect every
  `url` that is site-internal, i.e. starts with `/`. External `https://` links
  are out of scope for the guard.
- `unresolvedNavUrls(urls, knownPaths)` — the URLs with no match in
  `knownPaths`. Strip any `#fragment` before comparing so `/events#webinars`
  resolves against `/events`, and treat a bare `/#about` as the home page.

Reuse the `NavItem` / `SiteNav` types already exported from `src/lib/site.ts`
rather than redeclaring them.

### 2. Render the derived group

**File**: `src/layouts/BaseLayout.astro`

Add a `getCollection('chapters')` read to the frontmatter (the layout does not
import from `astro:content` today), filter it with `publishedEntries`, and build
`chapterItems` via `chapterNavItems`. Then:

- Replace the `nav.items.map(...)` source at line 63 with
  `withChapterGroup(nav.items, chapterItems)`.
- Replace the `utilCities` derivation at lines 26-27 so the utility strip reads
  the derived chapter labels directly instead of hunting for a nav group by
  label. This is the line that currently goes stale invisibly.

The dropdown markup itself is unchanged — a derived group is an ordinary
one-level dropdown and hits the existing `mega-col` branch.

### 3. Drop the duplicated links

**File**: `src/data/nav.json`

Remove the entire `Chapters` group (the five hand-listed chapter links). The
other four groups stay exactly as they are and remain fully editable from
`/admin/settings`.

### 4. Tests

**New file**: `src/lib/nav.test.ts`

Cover the behavior the drift made invisible:

- A chapter present in the collection but absent from `nav.json` still appears
  in the menu — the headline bug.
- Ordering follows `order`, with the `city` tiebreak for equal/absent values.
- A drafted chapter is absent from the production menu and present when
  `includeDrafts` is passed, matching the rest of the site.
- Zero chapters produces no Chapters group at all, not an empty dropdown.
- `withChapterGroup` places the group after `Programs`, and appends when
  `Programs` is missing.
- `unresolvedNavUrls` resolves `/events#webinars` against `/events` and `/#about`
  against `/`, and reports a genuinely dead link.

**File**: `src/data/collections.test.ts` — no change here; the nav integrity
check over the *committed* `nav.json` belongs with the other nav tests. Add it
to `src/lib/nav.test.ts` as a final describe block that reads the real
`src/data/nav.json` and the real content directories from disk (the pattern
`src/data/collections.test.ts:88-96` already uses), asserting every internal nav
URL resolves. `/blog/welcome` is the live example this pins.

### 5. Document the new rule

**File**: `CMS_SETUP.md`

Add a short **Navigation** section: menu groups are edited in `/admin →
Settings`, except Chapters, which is generated from the chapters collection —
publish a chapter and it appears; there is nothing to add by hand. Note the
one consequence: the Chapters group cannot be reordered or renamed from the
admin UI.

## Reused existing code

- `publishedEntries` from `src/lib/drafts.ts` (glossary entry:
  `publishedEntries`) — the draft-visibility rule every route already applies
- `withBase` from `src/lib/url.ts` (glossary entry: `withBase`) — already
  applied at each nav render site in `BaseLayout.astro`; the derived items stay
  base-agnostic and are wrapped once at render, matching the contract pinned by
  `src/components/landing/landing-images.test.ts`
- `nav` / `NavItem` / `SiteNav` from `src/lib/site.ts` (glossary entries: `site`,
  `readSingleton`) — the singleton reader and the nav types
- The sort convention in `src/components/landing/OurChapters.astro:20-22` —
  reused verbatim so the menu and the chapters section can never order
  differently
- `src/data/collections.test.ts` — the committed-file-vs-disk test pattern the
  final integrity block follows

**Existing-implementation survey.** Nothing in this repo derives navigation from
content today: the only reads of `nav` are `src/lib/site.ts:60` and
`src/layouts/BaseLayout.astro:26,63`, and there is no existing nav helper module
(`src/lib/` has no `nav.ts`). On the package side, `@codeyam/cms` offers no
collection-backed nav group — `navEditor.ts` and `siteConfig.ts` model only
literal `label`/`url`/`children` items, which is what forces the injection
approach above.

## Reproduction Test

Pins that a chapter published through the CMS never reaches the site menu.

**Target**: `src/lib/nav.test.ts` (new) — run with
`codeyam-editor editor refresh-tests --test nav`.

```ts
// A chapter that exists in the collection must appear in the menu even though
// nav.json has never heard of it — the drift that leaves a published chapter
// unreachable from the header.
it("includes a chapter that nav.json does not list", () => {
  const navItems = [{ label: "Programs", children: [{ label: "All Events", url: "/events" }] }];
  const chapters = [{ slug: "tokyo", data: { city: "Tokyo", order: 6 } }];

  const merged = withChapterGroup(navItems, chapterNavItems(chapters));
  const chapterGroup = merged.find((i) => i.label === "Chapters");

  expect(chapterGroup?.children).toContainEqual({ label: "Tokyo", url: "/chapters/tokyo" });
});
```

Status: PROPOSED — confirm red at execution. Expected failure: `src/lib/nav.ts`
does not exist, so the import of `withChapterGroup` / `chapterNavItems` fails to
resolve and the file errors before asserting. Once the helpers land the
assertion is the real check.

## Scenarios to Demonstrate

- **Today's five chapters** — the header and utility strip identical to the
  current site, proving the derivation is not a visual change
- **A newly published sixth chapter** — appearing in the dropdown and in the
  utility strip with no nav edit
- **A drafted chapter** — absent from the production menu, visible in the dev
  preview
- **Zero chapters** — no Chapters group at all, the rest of the menu intact
  (the production-starts-empty state `OurChapters` already handles)
- **A chapter renamed from "DC & DMV Area"** — the label following the content
  instead of stranding a stale hand-written one
- **`nav.json` with a dead internal link** — the integrity guard naming
  `/blog/welcome` after that post is drafted
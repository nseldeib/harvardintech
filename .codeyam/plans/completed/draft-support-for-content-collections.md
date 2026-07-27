---
title: "Draft Support For Content Collections"
mode: ui
createdAt: "2026-07-26T10:30:00Z"
source: manual
dependsOn: ["adopt-codeyam-cms-and-retire-sveltia"]
---

## Summary

Make the CMS's Draft toggle actually do something. The editor renders a Draft
checkbox on every collection and writes `draft: true` into an entry's
frontmatter when it is ticked — but none of this site's five schemas in
`src/content/config.ts` declare a `draft` field, and none of the six
`getCollection` call sites filter on one. The result is a control that looks
like it unpublishes an entry and does nothing at all: the entry keeps rendering
on the public site exactly as before.

Notably this does **not** fail the build. Zod object schemas strip unknown keys
rather than rejecting them, so `draft: true` is silently discarded at validation
— confirmed by adding it to a real chapter and building: 0 errors, page still
rendered. That silence is what makes the bug worth fixing deliberately; an
editor gets no feedback that the toggle they just used had no effect.

## Key Decisions

- **Add `draft` to all five schemas, not just the ones with an obvious use.**
  The CMS shows the toggle on every collection, so any collection missing the
  field reproduces the same broken affordance. Consistency here is cheaper than
  explaining which collections honor drafts.
- **Absent means published.** Declare it `z.boolean().optional()` and treat
  missing/false as live. Every existing entry then keeps its current behavior
  with no content migration, which matches how the CMS already writes the field
  — it omits `draft` entirely rather than writing `draft: false` (only `true` is
  emitted).
- **Filter at the `getCollection` call sites, not in the schema or a layout.**
  The schema's job is validation; the routes decide visibility. There are only
  six call sites and they already map/sort their results, so a filter is a
  one-line addition at each — clearer than a wrapper helper that hides which
  routes are draft-aware. If a seventh appears later, the pattern is obvious.
- **Drafts stay visible in dev, hidden in production.** A draft is useless if
  the author cannot preview it. Gate the filter on `import.meta.env.PROD` so
  `astro dev` (and therefore the codeyam preview and scenario capture) shows
  drafts, while the GitHub Pages build omits them. This mirrors how the content
  sandbox already distinguishes dev from build in `astro.config.mjs`.
- **Dynamic routes must also stop generating pages for drafts.** Filtering the
  index listings alone would leave a draft's own page live at its URL — hidden
  from navigation but publicly reachable, which is worse than not supporting
  drafts at all. `getStaticPaths` in both `[slug].astro` routes needs the same
  filter.

## Implementation

### 1. Declare the field

**File**: `src/content/config.ts`

Add `draft: z.boolean().optional()` to all five collection schemas — `blog`,
`pages`, `team`, `events`, and `chapters` — alongside a short comment stating
that an absent value means published, matching the style of the existing
per-field comments in that file.

### 2. Filter the listing routes

**Files**: `src/pages/index.astro`, `src/pages/events.astro`

`index.astro` reads four collections (events at line 27, chapters at 32, blog at
35, team at 45) and `events.astro` reads events at line 17. Each already chains
`.map(...)`; add the draft filter ahead of the existing transform so the
downstream shape is unchanged.

Check `src/components/EventsPage.astro` — it takes events as a prop rather than
calling `getCollection` itself, so it needs no change, but confirm both of its
callers filter before passing.

### 3. Filter the dynamic routes

**Files**: `src/pages/blog/[slug].astro`, `src/pages/chapters/[slug].astro`

Both build their paths from `getCollection` inside `getStaticPaths`. Apply the
same filter there so a draft entry generates no page at all in a production
build (see Key Decisions).

### 4. Tests

**File**: a new or existing test alongside the affected routes

Cover the behavior that the bug's silence made invisible:

- An entry with `draft: true` is excluded from a production listing
- The same entry IS included in dev, so previewing still works
- An entry with no `draft` key renders exactly as before — the no-regression
  guard for all existing content
- `draft: false` behaves as published, since a hand-edited file may contain it
  even though the CMS never writes it
- No page is generated for a draft entry in a production build

## Reused existing code

- `src/content/config.ts` — the five schemas being extended, and its existing
  convention of optional fields with an explicit "absent means…" comment
- The six `getCollection` call sites listed above — each already transforms its
  results, so the filter composes into existing chains
- `import.meta.env.PROD` — the dev/production distinction the content sandbox in
  `astro.config.mjs` already relies on

## Reproduction Test

Pins that a draft entry still publishes.

**Target**: a test alongside the blog route — run with
`codeyam-editor editor refresh-tests --test draft`.

```ts
// An entry flagged draft is excluded from the published listing.
it("omits draft entries from the blog listing in production", () => {
  const entries = [
    { id: "live-post", data: { title: "Live", draft: false } },
    { id: "wip-post", data: { title: "WIP", draft: true } },
  ];
  expect(publishedEntries(entries).map((e) => e.id)).toEqual(["live-post"]);
});
```

Status: PROPOSED — confirm red at execution. Expected failure: there is no
`publishedEntries` helper and no filtering anywhere, so this fails to compile /
resolve rather than asserting — the execution step should introduce the filter
in whatever shape the route code makes natural, and adapt this test to it. If
the filter lands inline at each call site rather than as a shared helper, retarget
the test at the route's exported path-building logic instead.

## Scenarios to Demonstrate

- **Blog listing with a draft present** — the draft absent from the published
  list while the live posts render
- **Same listing in dev** — the draft visible, proving preview still works
- **Draft toggle in the entry editor** — an entry mid-edit with Draft ticked,
  the control that currently does nothing
- **All-published content** — the existing site state, unchanged, proving no
  regression for the 12 current entries
- **Chapter draft** — a drafted chapter dropping out of both the chapters
  listing and the nav-linked `/chapters/<slug>` page

---
title: "NS -- Volunteer Project Dates and Related Projects"
mode: ui
createdAt: "2026-08-07T21:12:01Z"
prefix: "NS"
source: manual
---

## Summary

Two additions to volunteer projects.

**Dates.** A `startDate` and `endDate` on the `projects` collection, editable in the CMS and
shown as a formatted range on the project card and its detail page. **Display only** — a
project's visibility stays governed solely by the existing `active` toggle, so nothing ever
disappears from the grid on its own and an organizer is never surprised by a project vanishing
because a date passed. `openProjects` is not touched.

**"You may also be interested in".** At the bottom of `/volunteer/projects/<slug>`, below the
sign-up CTA, up to three other open projects rendered as the same cards the grid uses. The
volunteer page has no in-place expander — last week's plan deliberately chose a detail page over
an accordion, and the card thumbnail and title link there — so "after the user expands the
project" is served by the existing click-through, and this section is the tail of that page.

**Two things to know before judging the result.** The collection currently holds exactly one
project (`social-media-marketing-specialist-events.md`), so the related section renders nothing
at all until more are posted — correct behaviour, invisible today. And the `projects` schema has
no tag, category, or topic field, so "related" cannot be semantic. The rule below is proximity in
the editor's own ordering, which is honest about that rather than pretending to a relevance it
cannot compute.

## Key Decisions

- **Dates are display-only, and `openProjects` stays exactly as it is.** Date-gated visibility on
  a *static* site is a trap: the page only changes when a build runs, so a project would linger
  past its end date until the next deploy and then vanish without anyone touching the CMS. The
  `active` toggle is explicit, immediate on publish, and already understood by the editor.
- **`z.coerce.date()`, matching `events`.** The `events` collection already types its `date` this
  way and the CMS already has a native `date` field type, so an editor gets the same picker and
  the schema accepts the same ISO strings the CMS writes. No new date convention.
- **One date format for the whole site.** `formatEventDate` in `src/lib/events.ts` is the site's
  "Month D, YYYY" formatter. The new range formatter delegates to it rather than reimplementing
  `toLocaleDateString`. Its name is event-flavoured for a now-generic job, but renaming it would
  ripple through the events pages for no user-visible gain — reuse it and note why.
- **A range is one string, computed by a pure helper.** `formatProjectDates(start, end)` returns a
  single display string or `null`, so every caller renders `{dates ? … : null}` with no date logic
  in a `.astro` file. Four cases, all real: both dates, start only ("Starts …"), end only
  ("Through …"), neither (`null`, render nothing).
- **An inverted range renders as authored.** If an editor sets an end date before the start date,
  the helper formats it in the order given rather than silently swapping them — a visibly wrong
  range is a bug report; a quietly reordered one is a mystery. It must not throw.
- **"Related" means adjacent in editor order, wrapping.** With no taxonomy on the collection, the
  choices are recency, commitment-matching, or the order the editor already curates. Editor order
  is the only one that reflects a human decision, and wrapping past the end means the last project
  still gets three suggestions instead of none.
- **Suggestions are filtered through `openProjects`.** A retired project still has a detail page
  (`getStaticPaths` filters on draft status, not `active`), so without this a closed project would
  be advertised at the bottom of an open one. Reusing the existing helper keeps "what counts as
  open" defined in exactly one place.
- **Suggest only pages that were actually generated.** The sibling list comes from the same
  `publishedEntries(…, INCLUDE_DRAFTS)` call `getStaticPaths` already makes, so the section can
  never link to a 404: on the public build drafts are absent from both the routes and the
  suggestions, and on the review track both include them.
- **Reuse `VolunteerProjectCard`, don't invent a compact variant.** The suggestions are the same
  objects as the grid and should look it. A second card component is a second thing to keep in
  sync the next time the card changes.
- **Render nothing when there is nothing.** Zero related projects means no section and no heading
  — which is the state the site is in today with one project, so this is the common case, not the
  edge case.

## Implementation

### 1. Content schema

**File**: `src/content/config.ts`

Add to the `projects` schema, after `commitment`:

```ts
startDate: z.coerce.date().optional(),
endDate: z.coerce.date().optional(),
```

Both optional — every existing entry stays valid, and an organizer can post a project before
knowing either date. Add a short comment noting these are display-only and that `active` alone
controls whether a project appears, so the next reader does not add date filtering on the
assumption it was forgotten.

### 2. CMS fields

**File**: `src/data/collections.json`

Add two fields to the `projects` entry, placed after `commitment` so the framing details sit
together:

```json
{
  "name": "startDate",
  "label": "Start date",
  "type": "date",
  "optional": true,
  "hint": "When the project begins. Shown on the card and project page; does not hide the project."
},
{
  "name": "endDate",
  "label": "End date",
  "type": "date",
  "optional": true,
  "hint": "When the project wraps up. Use the Active toggle to take a finished project off the page."
}
```

The hints carry the display-only rule to the person it actually affects — the editor — so nobody
waits for a project to retire itself.

### 3. Date and related-project helpers

**File**: `src/lib/projects.ts`

Two pure additions, in the module's existing style:

- `formatProjectDates(start?: string | Date, end?: string | Date): string | null`
  - both → `"September 1 – December 15, 2026"`, collapsing the repeated year when the two dates
    share one, and `"December 1, 2026 – March 3, 2027"` when they do not
  - start only → `"Starts September 1, 2026"`
  - end only → `"Through December 15, 2026"`
  - neither → `null`
  - delegates each date to `formatEventDate`; accepts `string | Date` the way `toEventDate` does,
    because frontmatter reaches components as either
- `relatedProjects<T>(all: readonly T[], currentSlug: string, limit = 3): T[]`
  - runs `all` through `openProjects`, drops the entry whose slug matches `currentSlug`, and takes
    up to `limit` starting at the position after the current project, wrapping to the front
  - returns `[]` when there is no other open project, or when `currentSlug` matches nothing
  - non-mutating, like `openProjects`

Extend `ProjectLike` (or add a narrow local interface) with the optional `slug` the wrap-around
needs. `VolunteerProjectLike` in `VolunteerProjects.astro` already carries `slug?`.

**File**: `src/lib/projects.test.ts`

Add a `describe` per helper alongside the existing `openProjects` / `projectPath` / `projectCta`
blocks. Cases worth pinning: same-year collapse, cross-year full form, start-only, end-only,
neither, an inverted range formatting without throwing; and for `relatedProjects` — wrap-around
from the last project, a retired project never suggested, the current project never suggesting
itself, fewer than three available, and exactly zero others.

### 4. Dates on the card

**File**: `src/components/volunteer/VolunteerProjectCard.astro`

Accept `startDate` / `endDate`, compute the string via `formatProjectDates`, and render it beside
the existing `commitment` chip — same treatment, so a card with both reads as two framing details
rather than a paragraph. Absent dates render nothing, preserving the "no holes" contract the
component's header comment already states.

**File**: `src/components/volunteer/VolunteerProjects.astro`

Add `startDate` / `endDate` to `VolunteerProjectLike` and pass both down to each card.

### 5. Dates on the detail page

**File**: `src/components/volunteer/VolunteerProjectHeader.astro`

Accept `startDate` / `endDate` and render the formatted range next to the commitment chip, same
as the card, so the two surfaces agree.

**File**: `src/components/volunteer/VolunteerProjectPage.astro`

Thread `startDate` / `endDate` through to the header, and accept a `related` prop (see below).
Props-only, as today.

### 6. The related-projects section

**New file**: `src/components/volunteer/VolunteerRelatedProjects.astro` *(new)*

Props: `projects: VolunteerProjectLike[]`, `title = 'You may also be interested in'`. Returns
nothing at all when `projects` is empty — no heading, no empty section. Otherwise a heading and a
grid of `VolunteerProjectCard`s, at most three across, reusing the `/volunteer` grid's responsive
breakpoints (3 → 2 at 900px → 1 at 720px).

**File**: `src/components/volunteer/VolunteerProjectPage.astro`

Render it after `VolunteerProjectCta`. Place it outside the `.s-narrow` prose column so three
cards get the page's full width rather than being squeezed into a reading measure — the CTA ends
the prose, and the suggestions are a new movement.

**File**: `src/pages/volunteer/projects/[slug].astro`

`getStaticPaths` already loads every published project; add that list to each route's `props`
(alongside the existing `project`). In the page frontmatter, map it to the plain shape
`VolunteerProjectCard` needs — `{ slug: p.id, title, blurb, image, applyUrl, commitment,
startDate, endDate, order, active }` — call `relatedProjects(siblings, project.id)`, and pass the
result to `VolunteerProjectPage`. Also destructure `startDate` / `endDate` from `project.data` and
pass them through.

### 7. Seed the one real project

**File**: `src/content/projects/social-media-marketing-specialist-events.md`

Add a `startDate` (and an `endDate` if the role has one) so the dates are visible on the live
entry rather than only in scenarios. Note this entry is `draft: true` today, so it renders on the
review track and in dev, not on the public build.

## Reused existing code

- `openProjects` and `projectPath` from `src/lib/projects.ts` (glossary entries: `openProjects`,
  `projectPath`; tested in `src/lib/projects.test.ts`) — the suggestion list is filtered through
  `openProjects` rather than re-deciding what "open" means, and the cards link via `projectPath`.
- `formatEventDate` / `toEventDate` from `src/lib/events.ts` (glossary entry:
  `unmatchedChapterTags` is the registered one in this module; the date helpers live alongside it,
  tested in `src/lib/events.test.ts`) — the site's single "Month D, YYYY" format and its
  `string | Date` coercion.
- `z.coerce.date()` on the `events` collection in `src/content/config.ts` — the precedent for a
  date field that survives both CMS-written ISO strings and hand-authored frontmatter.
- `VolunteerProjectCard` and the `/volunteer` grid breakpoints in `VolunteerProjects.astro` — the
  suggestions reuse the card wholesale and match the grid's responsive columns.
- `publishedEntries` (`src/lib/drafts.ts`) + `INCLUDE_DRAFTS` (`src/lib/draftVisibility.ts`)
  (glossary entries: `publishedEntries`, `INCLUDE_DRAFTS`) — already called in `getStaticPaths`;
  the sibling list reuses that same call so suggestions and generated routes cannot disagree.
- `withBase` from `src/lib/url.ts` (glossary entry: `withBase`) — applied inside
  `VolunteerProjectCard` already; the new section inherits it by reusing the card.
- The `date` field type in the CMS registry (`CUSTOM_FIELD_TYPES` in
  `node_modules/@codeyam/cms/src/lib/collectionRegistry.ts`) — no package change needed; `date` is
  already a supported field type.

**Existing-implementation survey.** The `projects` schema has **no** date field of any kind today
(`title`, `blurb`, `image`, `applyUrl`, `commitment`, `order`, `active`, `draft`), and
`collections.json` declares the same seven for the CMS — so `startDate` / `endDate` are genuinely
new rather than duplicating an existing field. There is no related/similar/recommended-items
helper anywhere in `src/lib/`, and no date-range formatter: `events.ts` formats a single date and
splits upcoming from past, but nothing composes two dates into one string. And there is no tag,
category, or topic field on `projects` to key a semantic "related" off, which is why the rule is
editor-order proximity — recorded here so it reads as a constraint that was checked, not a
shortcut.

**Constrained-file pre-check.** `classify-constrained-files` over the full file list returns
`{"constrained": []}` — no lean-limited SKILL.md and no agent-config files in scope.

## Scenarios to Demonstrate

- A project detail page with both dates and three suggestions — the full feature.
- The same page with one other open project — one card, heading still reads naturally.
- A project with no other open projects (today's real state, one entry in the collection) — no
  section, no heading, page ends at the CTA.
- The last project in editor order — suggestions wrap to the front rather than coming up empty.
- A retired project (`active: false`) that still has a detail page — never appears as a
  suggestion, and its own page still renders.
- A project with a start date only — card and header read "Starts September 1, 2026".
- A project with an end date only — "Through December 15, 2026".
- A project with both dates in the same year — the collapsed form, one year shown.
- A project spanning a year boundary — both years shown.
- A project with neither date — card and header identical to today, no empty chip.
- The `/volunteer` grid showing dated and undated cards side by side, geometry unchanged.
- Mobile: the suggestions grid at one column, dates wrapping under the commitment chip.
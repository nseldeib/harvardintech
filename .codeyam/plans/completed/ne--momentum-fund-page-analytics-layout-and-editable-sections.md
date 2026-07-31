---
title: "ne -- Momentum Fund Page: Analytics, Layout, and Editable Sections"
mode: ui
createdAt: "2026-07-31T15:22:02Z"
prefix: "ne"
source: manual
---

## Summary

Nicole's review raised four things about the Momentum Fund page (`/donate`) plus one
site-wide item: turn Google Analytics on with her GA4 id, drop the first stats band,
re-lay the "Every Number Represents a Story" section as image-left / text-right, re-lay
"Why Support Harvard in Tech" as text-left / image-right AND move it directly under the
hero — and answer her two questions, "How do I edit this page?" and "Do I have the option
to move sections up or down?". Today the honest answer to both is *no*: the page's copy
lives in `src/data/donatePage.json`, which the CMS does not expose (it edits only
`settings.json`, `nav.json`, the collections registry, and the media library — verified in
`@codeyam/cms@0.2.2`, whose `CmsConfig` has no singleton extension point), and section
order is hardcoded in `MomentumFundPage.astro`. This plan makes the layout changes AND
converts the page's middle into a CMS-editable, reorderable `momentumSections` collection,
so "move a section up" becomes an Order field an editor can change, and "remove a section"
becomes the Draft toggle she already knows.

## Key Decisions

- **Sections become content, not markup.** A new `momentumSections` content collection
  gives each middle-of-page section its own markdown entry with `order`, `draft`, `layout`,
  and `image`. That is the only mechanism the CMS can already edit (custom collections are
  registered in `src/data/collections.json`; JSON singletons other than settings/nav are not
  editable at all), so it answers "how do I edit this page" and "can I move sections up or
  down" with no upstream package work.
- **Hero and closing CTA stay a fixed frame.** Only what sits between them is reorderable.
  A page whose hero could be dragged to the bottom is a page an editor can break; the
  campaign's ask-at-the-end structure is a design decision, not an editorial one.
- **Bespoke bands stay code, positioned by data.** `accomplishments`, `pillars`,
  `testimonials`, and `stats` keep their tailored components and keep reading their data from
  `donatePage.json`; their entry is a *slot* carrying `kind` + `order` only. Modelling their
  card data as markdown would trade a good design for editability nobody asked for.
- **One narrative component replaces two.** `MomentumStory` and `MomentumWhy` differ only in
  styling of the same thing (heading + prose). They collapse into `MomentumNarrative.astro`
  with a `layout` prop (`image-left` | `image-right` | `text-only`), which is exactly the
  control Nicole asked for on both sections.
- **`kind` and `layout` are free text with hints, not enums.** The CMS field types are
  `text | number | textarea | date | image | boolean | list` (`CUSTOM_FIELD_TYPES` in
  `collectionRegistry.ts`) — there is no select. So the build validates instead: an unknown
  `kind` warns and renders nothing (never a crash), an unknown `layout` falls back to
  `text-only`.
- **GA is a repo edit, not a CMS edit.** `Analytics.astro` and `settings.googleAnalyticsId`
  already exist and are already wired through `HeadExtras`; the CMS's settings editor does
  not model that key (the package's `SiteSettings` stops at socials), so setting it is a
  one-line data change here. The docs must say so rather than sending Nicole to /admin.

## Implementation

### 1. Turn on Google Analytics

**File**: `src/data/settings.json`

Set `"googleAnalyticsId": "G-GCBX577FFD"`. Nothing else is needed —
`src/components/Analytics.astro` renders the gtag pair only when the id is non-empty and is
already included site-wide via `HeadExtras`. Verify the rendered `<head>` on a built page
contains the two scripts, and that the isolated-component/scenario captures still render.

### 2. Declare the `momentumSections` collection

**File**: `src/content/config.ts`

Add a `momentumSections` collection alongside the existing eight, loaded with the same
`glob({ base: `${root}/momentumSections` })` pattern so the codeyam content sandbox and the
seed adapter keep working:

- `kind`: `z.string()` — `narrative | accomplishments | pillars | testimonials | stats`
- `title`: optional (narrative heading; the bespoke bands keep their titles in `donatePage.json`)
- `layout`: optional — `image-left | image-right | text-only`
- `image`: optional site-relative path (media-library URL, e.g. `/images/gallery/event-01.jpg`)
- `order`: optional number
- `draft`: optional boolean (the site-wide convention — absent means published)

The markdown body is the narrative prose.

### 3. Register it in the CMS

**File**: `src/data/collections.json`

Add a `momentumSections` collection to the `collections` array — `label: "Momentum Fund
sections"`, `singular: "Section"` — with fields mirroring the schema. Hints do the work the
missing select type can't:

- `kind` — "Which section this is: narrative, accomplishments, pillars, testimonials, or stats."
- `layout` — "narrative only: image-left, image-right, or text-only."
- `order` — "Lower numbers appear higher on the page. Change this to move a section up or down."
- `image` — "Shown beside the text on image-left / image-right sections."

### 4. Seed the sections from today's page

**New files**: `src/content/momentumSections/why.md`, `accomplishments.md`, `story.md`,
`pillars.md`, `testimonials.md`

The migration is what delivers Nicole's requested order — hero → **Why** → accomplishments →
**Story** → pillars → testimonials → close, with the first stats band simply not seeded:

- `why.md` — `kind: narrative`, `order: 1`, `layout: image-right`, `title: "Why Support
  Harvard in Tech?"`, `image` from the media library. Body = the two `whyBody` blocks with
  their titles as `###` subheads. (Text left, image right, directly under the hero.)
- `accomplishments.md` — `kind: accomplishments`, `order: 2`.
- `story.md` — `kind: narrative`, `order: 3`, `layout: image-left`, `title: "And Every Number
  Represents a Story"`, `image` from the media library. Body = `storyLede` as the opening
  paragraph, `storyPullQuote` as a `>` blockquote, then `storyBody`.
- `pillars.md` — `kind: pillars`, `order: 4`.
- `testimonials.md` — `kind: testimonials`, `order: 5`.
- **No `stats.md`** — this is Nicole's "remove first set of stats". The `stats` kind stays
  supported so she can re-add the band from the CMS without a code change.

### 5. Ordering/validation helper

**New file**: `src/lib/momentumSections.ts`

Pure and framework-free, the shape of `src/lib/sponsors.ts` and `src/lib/events.ts` so it
unit-tests without rendering:

- `SECTION_KINDS` — the supported kinds.
- `orderedSections(entries)` — draft-filtered input (callers apply `publishedEntries`),
  sorted by `order` via the existing `sortByOrder`, unknown kinds dropped.
- `unknownSectionKinds(entries)` — the advisory list, so the route can `console.warn` the way
  `chapters/[slug].astro` warns about orphan event tags. Advisory, never build-failing: a
  typo in one section must not take the deploy down.
- `resolveLayout(value)` — normalizes to `image-left | image-right | text-only`, unknown →
  `text-only`.

**New file**: `src/lib/momentumSections.test.ts` — order pinning, absent-order fallback,
unknown-kind drop + advisory, layout normalization.

### 6. The narrative section component

**New file**: `src/components/donate/MomentumNarrative.astro`

Heading + rendered markdown body in a two-column band: image left / text right, image right /
text left, or full-width prose when there is no image or `layout: text-only`. Keeps the
existing typography of `MomentumStory` (serif lede, crimson-ruled pull quote via a styled
`blockquote`) so nothing about the page's voice changes. Collapses to a single column under
900px, image first — the mobile order both layouts already imply. Alt text via `altFor` from
`src/lib/media.ts` so a photo's library alt reaches the page.

**Delete**: `src/components/donate/MomentumStory.astro`, `src/components/donate/MomentumWhy.astro`
and their `storyTitle`/`storyLede`/`storyPullQuote`/`storyBody`/`whyTitle`/`whyBody` keys in
`DonatePageCopy` (`src/lib/site.ts`) and `src/data/donatePage.json`, now that the copy lives in
the two markdown entries. `MomentumStats.astro` is kept — it is the renderer for `kind: stats`.

### 7. Compose the page from the collection

**File**: `src/components/MomentumFundPage.astro`

Takes a new `sections` prop (already ordered and draft-filtered) instead of hardcoding the
middle of the page: render `MomentumHero`, then map the sections to their renderer by `kind`
(`narrative` → `MomentumNarrative` with the entry's rendered body, `accomplishments` →
`MomentumAccomplishments`, `pillars` → `GiftPillars`, `testimonials` →
`MomentumTestimonials`, `stats` → `MomentumStats`), then `MomentumClose`. Props-only, so the
isolated-component scenarios keep working.

**File**: `src/pages/donate.astro`

Load `momentumSections` with `getCollection` + `publishedEntries(…, INCLUDE_DRAFTS)` +
`orderedSections`, `render()` each narrative body (the `chapters/[slug].astro` pattern), and
pass them down. `console.warn` any unknown kinds.

### 8. Scenarios

**File**: `src/pages/isolated-components/[name].astro`

Retire the `MomentumStory` / `MomentumWhy` states, add `MomentumNarrative` states
(image-left, image-right, text-only, no-image fallback), and update the `MomentumFundPage`
states to pass a seeded `sections` array — including a "sections reordered by an editor"
state, which is the whole point of the change and the thing Nicole will want to see.
Existing scenario files to refresh: `momentumstory-full-narrative`, `momentumwhy-two-blocks`,
`momentumstats-campaign-figures`, `momentum-fund-public-visitor`,
`momentum-fund-arriving-from-the-email`.

### 9. Answer the two questions in writing

**New file**: `docs/editing-the-site.md`

Plain-language, written for Nicole, no repo knowledge assumed: which parts of `/donate` are
editable and where (Momentum Fund sections → the new collection in /admin), how to move a
section up or down (the Order field, lower = higher on the page), how to hide one without
deleting it (Draft), which parts are still code-only (hero, the closing CTA, the pillar/stat
card data, the GA id) and who to ask for those. Link it from `docs/nicole-review.md` and
reference it from `CMS_SETUP.md`.

## Reused existing code

- `sortByOrder` from `src/lib/order.ts` (glossary entry: `sortByOrder`) — the site-wide
  order-then-fallback rule, reused verbatim for section order.
- `publishedEntries` from `src/lib/drafts.ts` and `INCLUDE_DRAFTS` from
  `src/lib/draftVisibility.ts` (glossary entries: `publishedEntries`, `INCLUDE_DRAFTS`) — the
  Draft toggle becomes "hide this section" for free.
- `altFor` / `readMediaManifest` from `src/lib/media.ts` (glossary entries: `altFor`,
  `readMediaManifest`) — library alt text on the new section images.
- `withBase` from `src/lib/url.ts` (glossary entry: `withBase`) — the deploy currently serves
  under the `/harvardintech` base path, so every image src must go through it.
- `render()` + `getStaticPaths` collection pattern from `src/pages/chapters/[slug].astro`
  (glossary entry: `ChapterRoute`), including its advisory `console.warn` precedent.
- `Analytics.astro` + `settings.googleAnalyticsId` (glossary entry: `site`) — already built;
  this plan only supplies the id.
- `groupSponsorsByLevel` in `src/lib/sponsors.ts` (glossary entry: `groupSponsorsByLevel`) —
  the model for a pure, unknown-value-tolerant reshaping helper.

**Existing-implementation survey.** Grepped for an existing section-order or page-copy
editing mechanism before proposing one: there is **none**. No `*Page.json` singleton carries a
`sections`/`sectionOrder` key; `MomentumFundPage.astro`, `VolunteerPage.astro`, and
`SponsorPage.astro` all hardcode composition order. `@codeyam/cms@0.2.2` exposes exactly two
editable singletons (`SETTINGS_PATH`, `NAV_PATH` in `src/lib/siteConfig.ts`) plus the custom-
collection registry (`COLLECTIONS_PATH` in `collectionRegistry.ts`); `CmsConfig`
(`cmsConfig.ts`) has no field for registering another singleton, so a collection is the only
in-repo path to CMS editability. GA is the opposite case: `Analytics.astro`,
`settings.googleAnalyticsId`, and the `HeadExtras` include already exist — nothing to build.

## Scenarios to Demonstrate

- Momentum Fund page in the new default order: hero → Why (text left, image right) →
  accomplishments → Story (image left, text right) → pillars → testimonials → close.
- The same page with an editor's reorder applied (Story moved above Why) — proving Order works.
- A section hidden with the Draft toggle (testimonials off), page still reads as finished.
- The stats band re-added as a `kind: stats` entry, back in first position.
- A narrative section with no image → full-width prose fallback.
- A section with an unrecognized `kind` typed in the CMS → skipped, page renders, warning logged.
- Mobile (< 900px): both narrative layouts stack image-first.
- A built page's `<head>` carrying the GA4 gtag scripts for `G-GCBX577FFD`.
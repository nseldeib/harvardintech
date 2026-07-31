---
title: "ne -- Volunteer Project Detail Pages and the Missing Photo"
mode: ui
createdAt: "2026-07-31T15:23:01Z"
prefix: "ne"
source: manual
---

## Summary

Nicole reported two things about the volunteer project she created in the CMS: "uploaded
photo not visible" and "thumbnail appears but does not link to full description". Both
reproduce against the entry she actually committed. Her entry
(`src/content/projects/social-media-marketing-specialist-events.md` on `main`) carries a long
markdown body — the full description — and **nothing in this repo renders a project's body
anywhere**: `VolunteerProjectCard.astro` shows title, commitment, blurb, and an optional
apply link, and there is no `/volunteer/projects/<slug>` route to link to. Separately her
entry has **no `image` frontmatter at all**, so the card draws its gradient placeholder, and
the media manifest is out of sync with the repo: `src/data/media.json` on `main` records
three uploads (`volunteers.webp`, `volunteers-2.webp`, `gallery/volunteers.webp`) but only
`public/images/volunteers.webp` was ever committed — picking either ghost record in the CMS
yields a live `<img>` pointing at a file that does not exist. This plan adds a real project
detail page, links the card to it, repairs the manifest, and adds a check so a manifest
record without a file can never silently become a broken image again.

## Key Decisions

- **A detail page, not an in-place expander.** `/volunteer/projects/<slug>` is a static route
  on a static site, is linkable and shareable (an organizer can send one project to one
  person), and needs no client JS — where an accordion/modal would add hydration to a page
  that currently ships none.
- **Draft projects get a page only where drafts are visible.** `getStaticPaths` filters with
  `publishedEntries(…, INCLUDE_DRAFTS)`, exactly as `chapters/[slug].astro` does. Nicole's
  project is `draft: true` today, so it must appear on the review/preview build and be absent
  from the public one — otherwise a project hidden from the grid is still fetchable at its URL.
- **The manifest is repaired in data, and guarded in code.** Deleting the two ghost records is
  the immediate fix; a pure `missingMediaFiles` helper plus a `npm run check:media` script is
  what stops the next one. The underlying cause is upstream — `@codeyam/cms` published the
  manifest edit without the image blobs — so this repo defends itself rather than pretending
  to fix the package.
- **The card keeps its geometry.** Thumbnails stay 168px and cropped so a mixed grid stays
  aligned; the detail page is where the photo is shown at full size, uncropped. Nicole's
  "photo not visible" is answered by *there being a place the photo is actually visible*, not
  by making cards ragged.
- **Whole card is not one big link.** The title and thumbnail link to the detail page and the
  apply link stays its own control — nesting an `<a>` inside a card-wide `<a>` is invalid and
  breaks keyboard users.

## Implementation

### 1. Project detail route

**New file**: `src/pages/volunteer/projects/[slug].astro`

Mirrors `src/pages/chapters/[slug].astro`: `getStaticPaths` over the `projects` collection
filtered by `publishedEntries(…, INCLUDE_DRAFTS)`, `render(entry)` for the body, and
`BaseLayout` with a per-project `title`/`description` (the blurb, falling back to the site
default). Renders through a new composition component so it is capturable in isolation.

### 2. Detail page body

**New file**: `src/components/volunteer/VolunteerProjectPage.astro`

Props-only (`title`, `blurb`, `image`, `commitment`, `applyUrl`, plus the body in a slot) —
the same split `VolunteerPage.astro` and `ChapterPage.astro` use, so scenarios can render it
without the collection. Layout: full-width photo (uncropped, `max-height` bounded so a square
1200×1200 upload like `volunteers.webp` doesn't push the copy off-screen), title, commitment
badge, blurb as the lede, then the markdown body in a `.narrow` prose column, then the apply
CTA — falling back to the page-level volunteer CTA (`volunteerPage.ctaLabel` / `ctaUrl`) when
the project has no `applyUrl`, so a project posted before its form exists still has a way in.
A "← All volunteer projects" link back to `/volunteer#projects`. Image alt via `altFor`.

### 3. Link the card to it

**File**: `src/components/volunteer/VolunteerProjectCard.astro`

Accept `slug`; wrap the thumbnail and the `<h3>` title in a link to `projectPath(slug)` (via
`withBase`), and add a "Read the full description →" link in the card footer beside the
existing "Get involved →". When no `slug` is supplied (isolated-component states that pass
none) the card renders exactly as it does today — no link, no layout change. Also pass the
image's library alt through `altFor` instead of the current hardcoded `alt=""`.

**File**: `src/components/volunteer/VolunteerProjects.astro`

Pass `slug={p.slug}` down — the route already puts it on each project object.

### 4. Path helper

**File**: `src/lib/projects.ts`

Add `projectPath(slug)` → `/volunteer/projects/<slug>`, pure and callers wrap it in
`withBase`. One place owns the URL shape, so the route and the card cannot drift.

**File**: `src/lib/projects.test.ts` — a test for the path shape, and one asserting
`openProjects` still orders/filters unchanged.

### 5. Media-manifest integrity

**File**: `src/lib/media.ts`

Add `missingMediaFiles(manifest, exists)` — the manifest records whose file is absent, with
the existence check injected so it is pure and unit-testable. (See the reproduction test.)

**New file**: `scripts/check-media-manifest.mjs` + a `check:media` script in `package.json`.
Scans `src/data/media.json` against `public/images`, reports ghost records (manifest entry,
no file) and unrecorded files (file, no manifest entry), exits non-zero only on ghosts.

**File**: `src/data/media.json` — remove the two ghost records `volunteers-2.webp` and
`gallery/volunteers.webp`. Note: this branch is 2 commits behind `origin/main` (the two
"via CodeYam CMS" commits that added Nicole's project and these records) — merge `main`
first, or the edit has nothing to remove.

### 6. Restore Nicole's photo

**File**: `src/content/projects/social-media-marketing-specialist-events.md` (arrives with the
`main` merge)

Set `image: /images/volunteers.webp` — the one upload whose file actually exists — so her
project shows the photo she picked on both the card and the new detail page. Confirm the file
is a real 1200×1200 image before trusting the record.

### 7. Tell the editor what happened

**File**: `docs/nicole-review.md`

A short note: the full description now has its own page, the photo needed to be re-picked
(and why), and that an upload must be published from the media library *before* it appears on
the site. Also file the ghost-record behaviour upstream against `@codeyam/cms` — code change
here, bug report there.

## Reused existing code

- `publishedEntries` (`src/lib/drafts.ts`) + `INCLUDE_DRAFTS` (`src/lib/draftVisibility.ts`)
  (glossary entries: `publishedEntries`, `INCLUDE_DRAFTS`) — draft projects get a page only
  where drafts are visible.
- `openProjects` from `src/lib/projects.ts` (glossary entry: `openProjects`) — unchanged grid
  selection; the new `projectPath` joins it in the same module.
- `withBase` from `src/lib/url.ts` (glossary entry: `withBase`) — mandatory, the preview
  deploys under the `/harvardintech` base path.
- `altFor` / `readMediaManifest` from `src/lib/media.ts` (glossary entries: `altFor`,
  `readMediaManifest`) — already the site's way to get library alt onto a page.
- `getStaticPaths` + `render()` route pattern from `src/pages/chapters/[slug].astro`
  (glossary entry: `ChapterRoute`) and the props-only composition split from
  `src/components/VolunteerPage.astro` (glossary entry: `VolunteerPage`).
- `src/lib/media.test.ts` (test registry: 5 registered tests) is the home for the new
  `missingMediaFiles` test; `src/lib/projects.test.ts` (5 registered tests) for `projectPath`.

**Existing-implementation survey.** No project detail route exists (`src/pages/` has no
`volunteer/` directory), nothing calls `render()` on a `projects` entry, and no helper
compares `media.json` against the files on disk — `readMediaManifest` deliberately tolerates a
malformed/absent manifest but never validates its contents. So both additions are new, not
duplicates.

## Reproduction Test

Pins the ghost-record half of the bug: `src/data/media.json` can name an image whose file was
never committed, and nothing in the repo notices — which is how an "uploaded" photo becomes a
broken `<img>` on the site.

**Target**: `src/lib/media.test.ts` — run with
`codeyam-editor editor refresh-tests --test "reports manifest records whose image file is missing"`.

```ts
// A manifest record whose file was never committed is reported as missing, so a
// published-manifest-without-bytes upload cannot silently become a broken image.
it('reports manifest records whose image file is missing', () => {
  const manifest = {
    assets: [
      { filename: 'volunteers.webp', url: '/images/volunteers.webp' },
      { filename: 'volunteers-2.webp', url: '/images/volunteers-2.webp' },
      { filename: 'gallery/volunteers.webp', url: '/images/gallery/volunteers.webp' },
    ],
  };
  const onDisk = new Set(['volunteers.webp']);

  expect(missingMediaFiles(manifest, (f) => onDisk.has(f))).toEqual([
    'volunteers-2.webp',
    'gallery/volunteers.webp',
  ]);
});
```

Status: PROPOSED — confirm red at execution. Expected failure: `src/lib/media.ts` exports no
`missingMediaFiles`, so the import fails and the suite errors before the assertion runs. The
fixture mirrors the three records actually committed on `main`, so it is real data rather
than an invented shape.

The other half — "thumbnail does not link to the full description" — has no unit-level repro:
it is a missing route plus missing markup, provable only by rendering. Demonstrate it with the
"project card links to its detail page" and "project detail page" scenarios below.

## Scenarios to Demonstrate

- `/volunteer` grid where a card links through to its detail page (Nicole's real entry).
- The detail page for "Social Media Marketing Specialist- Events" — full photo, commitment,
  blurb, and the complete bulleted description that is invisible today.
- A project with a photo but no apply link → falls back to the page-level volunteer CTA.
- A project with no photo → detail page and card both render without a hole.
- A draft project: present on the preview/review build, absent from the public build.
- Empty state unchanged — production still starts with no open projects.
- Mobile detail page: photo, prose column, sticky-free CTA at natural width.
- Media check run against a manifest carrying a ghost record → non-zero exit, named files.
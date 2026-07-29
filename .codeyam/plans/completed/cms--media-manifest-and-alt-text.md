---
title: "cms -- Media Manifest And Alt Text"
mode: ui
createdAt: "2026-07-27T21:15:11Z"
prefix: "cms"
source: manual
---

## Summary

The CMS's media library expects a manifest singleton at `src/data/media.json`
(`MEDIA_MANIFEST_PATH`, `node_modules/@codeyam/cms/src/lib/mediaLibrary.ts:24`,
package version 0.2.0). This repo has never
had one, so the library falls back to a bare directory scan: all 67 images under
`public/images/` show up as selectable assets carrying nothing but a path and a
byte size. No alt text, no dimensions, no upload date, no captions.

Two things follow from that, and both are visible today. The Publish Checklist
ships a "missing image alt text" check that resolves alt through the manifest —
with no manifest, `findAssetByUrl` returns nothing and the check short-circuits
to zero findings, so the one preflight step meant to catch an inaccessible image
passes vacuously rather than meaningfully. And on the public site
the alt attributes are either empty or invented at render: the 40-photo event
gallery emits `alt="Harvard in Tech event photo ${i + 1}"`
(`src/components/landing/EventGallery.astro:33`), and the chapter cards in
`OurChapters.astro:45` render their city photos with `alt=""` — decorative
markup on images that carry real meaning.

This plan adopts the manifest, seeds it from the images already in the tree with
alt text written once, and makes the site read that alt at render, so alt
authored in `/admin` actually reaches the page instead of stopping at the CMS.

## Key Decisions

- **Seed the manifest from the existing tree; never require a re-upload.** The
  67 files are already committed and referenced. `mergeLibrary` in the package
  treats disk as the authority on which assets exist and the manifest as the
  authority on what is known about them
  (`mediaLibrary.ts:75-136`), so a manifest that describes files already present
  is exactly the shape it expects — no import step, no migration.

  0.2.0 makes this stronger than when the plan was written: subdirectory asset
  identities are now first-class (`sanitizeAssetPath`, `assetDirname`,
  `libraryFolders`, and an upload `destination` argument), and the disk scan
  recurses to `MAX_SCAN_DEPTH = 6` emitting posix-separated relative paths
  (`mediaSource.ts:44,76-128`). Since 66 of the 67 images live in
  subdirectories, the subpath-keyed records below are exactly the identity shape
  the package now formalizes.

- **Author alt only where alt is meaningful, and record the decorative ones
  explicitly as `alt: ""`.** A background wash (`bg/hero-bg.jpg`,
  `hero/hero.jpg`) and a social glyph next to a visible label are decorative;
  giving them prose alt makes screen readers worse, not better. Writing the
  empty string deliberately is different from having no record at all — it
  documents the judgment in the manifest, and `altFor` honors it at the render
  site (see the decision below), so a decorative image ships with `alt=""`
  rather than inheriting a fallback.

  What the empty string does NOT do — corrected against `@codeyam/cms` 0.2.0 —
  is silence the package's missing-alt publish check. That check tests
  `asset.alt == null || asset.alt.trim() === ''`
  (`publishChecklist.ts:416`), so an explicit `""` reads as missing, exactly
  like an absent one. `enrich` drops it before the admin UI ever sees it anyway
  (`mediaLibrary.ts:150` gates on `record?.alt ?`, a truthy test). And the check
  is scoped to staged *content entries* — markdown body images plus
  `coverImage` / `ogImage` frontmatter — while every decorative image here is
  referenced from `.astro` components or the `donatePage.json` /
  `volunteerPage.json` singletons, which that check never walks. The empty
  string is written for the site render and for the human reading the manifest;
  it is not a suppression mechanism.

- **The site reads alt from the manifest, with the render site's current value
  as the fallback.** This is what turns the manifest from CMS-only bookkeeping
  into something an editor can actually see the effect of. Fallback rather than
  replacement means no image can end up with *worse* alt than it has today, and
  a newly uploaded image with no alt yet degrades to current behavior instead of
  emitting `alt="undefined"`.

- **Read it through the same singleton path as `settings` and `nav`.**
  `src/lib/site.ts:21-24` reads singletons with `fs` from `dataRoot()` rather
  than a static import, precisely so a codeyam session can redirect them to the
  sandbox. `media.json` must go through the same reader or scenario seeding will
  not reach it — and the seed adapter already writes any object-valued key to
  `<dataRoot>/<key>.json`, so `media` seeds per scenario for free once it is
  read this way.

- **Do not make the gallery CMS-editable in this plan.** `EventGallery.astro`
  generates its 40 paths from a loop over `event-01..40`; making the photo set
  itself editable is a real improvement but a different change with its own
  content model. Here the gallery keeps its generated list and gains real alt.
  Flagged rather than silently folded in.

- **Guard the manifest against the tree, both directions, as a unit test.**
  A manifest record whose file is gone is a broken reference; a rendered image
  with no record is an image nobody wrote alt for. `src/lib/team.photos.test.ts`
  already establishes the read-content-off-disk guard pattern for exactly this
  class of bug (the live-site headshot regression), and this follows it.

## Implementation

### 1. The manifest

**New file**: `src/data/media.json`

Shape `{ "assets": [...] }`, one record per file under `public/images/`, each
with `filename` (path within `public/images`, the asset identity), `url`
(`/images/<filename>`), and `alt`. Group the authoring by what the image is for:

- **`gallery/event-01..40.jpg`** (40) — event photographs. Alt describing what
  the photo shows, not "event photo 7". These are to be written from the actual
  images at execution, not invented from filenames.
- **`team/*.png`** (5) — board headshots. Alt is the member's name, matching
  what `BoardMemberCard.astro:25` already renders.
- **`chapters/*.jpg`** (4) and **`bg/*.jpg`**, **`hero/hero.jpg`** — city and
  section imagery; descriptive alt for the city photos, explicit `alt: ""` for
  the two background washes and the hero backdrop.
- **`sections/*`** (5), **`support/*.png`** (5), **`social/*`** (4),
  **`harvard-shield.png`** — logos, icons and glyphs. Decorative where a text
  label sits beside them (the socials in `ContactUs.astro:40` and
  `ChapterConnect.astro:45` already pass `alt=""` for this reason); descriptive
  where the image stands alone.

Note while authoring: `chapters/japan.jpg`, `chapters/la.jpg` and
`chapters/san-francisco.jpg` have no corresponding entry in
`src/content/chapters/` (which holds boston-cambridge, dc-dmv, london, nyc,
seattle). They are unreferenced. Keep them in the manifest — they are real files
an editor can still pick — but do not invent a chapter for them.

### 2. Read the manifest

**New file**: `src/lib/media.ts`

- Export the `MediaAsset` / `MediaManifest` types matching the package's shape.
- Read `media.json` through the same `readSingleton` mechanism `src/lib/site.ts`
  uses, tolerating an absent file by returning `{ assets: [] }` — production
  before the first upload, and any scenario that seeds no media, must not crash
  the render.
- `altFor(url, fallback)` — the manifest's alt for a site-relative image URL,
  falling back to the caller's current value when there is no record and to the
  fallback when the record's alt is absent. An explicit `""` in the manifest is
  a real answer and must win over the fallback, not be treated as missing.

Keep it pure apart from the one singleton read, and match the existing module
style: no DOM, no Astro imports, so it unit-tests directly.

### 3. Render the authored alt

**Files**: `src/components/landing/EventGallery.astro`,
`src/components/landing/OurChapters.astro`,
`src/components/landing/BoardOfDirectors.astro`,
`src/components/BoardMemberCard.astro`

Replace each hardcoded or empty `alt` with `altFor(<url>, <current value>)`, so
every one of these render sites keeps its present behavior until the manifest
says otherwise:

- `EventGallery.astro:33` — fallback stays the generated
  `Harvard in Tech event photo ${i + 1}` string
- `OurChapters.astro:45` — fallback stays `''`, and the manifest supplies the
  city description
- `BoardOfDirectors.astro:39` and `BoardMemberCard.astro:25` — fallback stays
  `member.name`

Leave the genuinely decorative render sites alone
(`BaseLayout.astro:54` brand shield, `ChapterHero.astro:29`, `Hero.astro:23`,
`HeroCarousel.astro:63`, the social glyphs) — their `alt=""` is correct and the
manifest records agree with it.

### 4. Tests

**New file**: `src/lib/media.test.ts`

- `altFor` returns the manifest alt, falls back when there is no record,
  honors an explicit `""`, and falls back for a record with no `alt` key.
- Every `filename` in the committed `src/data/media.json` exists under
  `public/images/` — the broken-reference direction.
- Every file under `public/images/` has a manifest record — the
  nobody-wrote-alt direction, and the check that keeps the manifest current as
  images are added.
- A non-empty sanity assertion on the manifest size, so an empty or
  failed-to-parse manifest cannot make the two loops vacuously pass (the guard
  `src/lib/team.photos.test.ts:27-29` uses).

### 5. Document it

**File**: `CMS_SETUP.md`

The **Media** section currently says the images "were adopted by directory scan
— there was no import step and no manifest to author". Update it: there is now a
manifest, `src/data/media.json`, holding alt text and metadata; it is edited
through the media library like any other content and commits in the same batch.
Add the rule that alt written there reaches the rendered page, and that an
empty alt is a deliberate "this image is decorative".

## Reused existing code

- `readSingleton` / `dataRoot` from `src/lib/site.ts:21-24` and
  `src/lib/contentRoot.ts` (glossary entries: `readSingleton`, `dataRoot`,
  `contentRoot`) — the sandbox-aware singleton read the manifest must go through
- The `MediaAsset` / `MediaManifest` shape and `MEDIA_DIR` / `MEDIA_URL_PREFIX`
  conventions from `node_modules/@codeyam/cms/src/lib/mediaLibrary.ts:20-60` —
  the manifest must match what the package reads and writes, not a parallel
  shape
- `src/lib/team.photos.test.ts` — the disk-vs-content guard pattern the manifest
  tests follow, including its vacuous-pass sanity check
- `withBase` from `src/lib/url.ts` (glossary entry: `withBase`) — unchanged at
  every render site; alt is independent of the base path, and
  `src/components/landing/landing-images.test.ts` keeps pinning the src side

**Existing-implementation survey.** There is no media manifest and no media
helper in this repo today: `src/data/` holds `cms.json`, `collections.json`,
`donatePage.json`, `nav.json`, `settings.json` and `volunteerPage.json` — no
`media.json` — and `src/lib/` has no `media.ts`. No render site reads alt from data — every `alt=` in `src/` is either
a literal `""`, a template string, or a direct field read (`member.name`). On
the package side the manifest reader, the alt-carrying `![alt](url)` insertion,
and the missing-alt publish check are all already implemented and simply have no
data to work with.

## Reproduction Test

Pins that authored alt text never reaches the rendered page.

**Target**: `src/lib/media.test.ts` (new) — run with
`codeyam-editor editor refresh-tests --test media`.

```ts
// Alt text written in the media library must reach the render site; today the
// gallery invents "Harvard in Tech event photo 7" and the manifest is ignored.
it("returns the authored alt for a known image", () => {
  const manifest = {
    assets: [
      { filename: "gallery/event-07.jpg", url: "/images/gallery/event-07.jpg",
        alt: "Panelists on stage at the NYC chapter launch" },
    ],
  };

  expect(altFor(manifest, "/images/gallery/event-07.jpg", "Harvard in Tech event photo 7"))
    .toBe("Panelists on stage at the NYC chapter launch");
});
```

Status: PROPOSED — confirm red at execution. Expected failure: `src/lib/media.ts`
does not exist, so the `altFor` import fails to resolve and the file errors
before asserting. Note the signature above takes the manifest explicitly for
testability; if execution makes the module-level singleton the only entry point,
retarget this at the pure inner function rather than stubbing `fs`.

## Scenarios to Demonstrate

- **The event gallery with authored alt** — the same 40 photos, each carrying a
  real description instead of a serial number
- **Chapter cards with described photos** — `OurChapters` where `alt=""` sits
  on meaningful city imagery today
- **An image with no manifest record** — a freshly uploaded photo rendering with
  the current fallback alt rather than breaking
- **A deliberately decorative image** — an explicit `alt: ""` in the manifest
  winning over a fallback, proving the empty string is a real answer
- **The media library itself** — `/admin/media` showing the 67 images with
  their alt text and metadata instead of bare filenames
- **The Publish Checklist** — the "missing image alt text" check reaching a
  meaningful verdict for the first time, on a staged entry whose cover image has
  no alt
---
title: "NS -- Per-Chapter Photo Galleries: Curated, Clickable, and Sized to Fit"
mode: ui
createdAt: "2026-08-06T18:53:44Z"
prefix: "NS"
source: manual
---

## Summary

Every city chapter page shows the same photos. `ChapterPage.astro:99` renders `<EventGallery />`
with no props, so all six chapters — boston-cambridge, dc-dmv, london, nyc, seattle,
sf-bay-area — display the identical 40-photo landing-page wall from
`/images/gallery/event-01..40.jpg`. The component already accepts an `images` override; nothing
passes one, and the `chapters` schema has no field to pass.

This plan gives each chapter its own gallery, curated in the CMS, clickable, and laid out for
the number of photos it actually has. Four changes, one component:

1. **Per-chapter photos** — a `photos` list field on the `chapters` collection.
2. **CMS-editable** — declared in `collections.json` so Nicole picks photos from the media
   library in /admin, exactly as she already does for `leads` and `links`.
3. **Click to enlarge** — a native `<dialog>` lightbox with keyboard nav, progressively
   enhanced.
4. **Layout and count** — the column count adapts to the photo count, and a gallery longer
   than 12 photos collapses behind a "Show all N photos" button.

**Scope: chapter pages only.** `/communities/<slug>` renders the same `ChapterPage` component
and has an identical schema, but is deliberately left on the shared gallery — it simply never
passes the new prop, and the fallback below keeps its current behaviour byte-for-byte. The
landing page is likewise untouched: `<EventGallery />` with no props must keep rendering all 40
photos uncapped, so the cap and the adaptive columns are opt-in per call site, not new defaults.

**Nothing regresses on day one.** A chapter with no `photos` falls back to the shared 40-photo
set, so the site looks exactly as it does today until someone curates a chapter. `showGallery:
false` still hides the section outright.

## Key Decisions

- **A `list` field, not a bare image array.** `leads` and `links` on this same collection are
  already `list` fields with scalar sub-fields, and the CMS renders them with add/remove/reorder
  rows for free. A `photos` list of `{ image, caption? }` follows that precedent exactly, and the
  caption sub-field is what makes a lightbox worth opening. Nested lists are unsupported by the
  registry, but this is one level, so it fits.
- **Captions live on the entry, alt text stays in the media library.** `altFor` already resolves
  alt from `media.json` and is the site's single source for it — a second alt field on the
  chapter would be a competing source that drifts. A caption is editorial ("Spring mixer at
  Cornell Tech"), alt is accessibility; they are different jobs and should not share a field.
- **Normalize at the boundary with a pure helper.** `EventGallery`'s existing `images?: string[]`
  prop is used by the landing page and by the captured `event-gallery` scenario. Rather than
  change its type and break both, add `toGalleryPhotos(input)` in `src/lib/gallery.ts` that
  accepts `string[]` *or* the chapter's `{ image, caption? }` rows and returns a uniform
  `GalleryPhoto[]`. One code path renders the grid; both call shapes keep working.
- **Native `<dialog>`, not a hand-rolled modal.** `showModal()` gives focus trapping, Esc-to-close,
  inert background, and the top layer for free — all the parts a hand-rolled lightbox gets wrong.
  There is no existing modal anywhere in `src/` to reuse, so this is new either way; native is the
  smaller and more correct new thing.
- **Progressive enhancement, no framework.** The site ships no client framework and the existing
  interactive components (`HeroCarousel.astro`, `EventGallery.astro`) are dependency-free
  `<script>` blocks over `data-*` hooks, with the decision logic extracted into unit-tested pure
  helpers in `src/lib/`. The lightbox follows that shape. Without JS — or without
  `HTMLDialogElement` — the tiles stay plain images and the gallery is fully usable; the
  enhancement is additive.
- **A button, not a link, opens a photo.** There is no URL to navigate to, so `<button>` is the
  honest element and is keyboard-operable with no `tabindex`/`role` patching.
- **The cap is a prop, not a default.** Defaulting to 12 everywhere would silently truncate the
  homepage's 40-photo wall. Chapters pass the cap; the landing page does not.
- **Reveal-on-scroll survives the cap.** The existing `initGalleryReveal()` queries
  `#gallery .gallery-item` once on load. Photos revealed by "Show all" mount after that, so the
  wiring has to be re-runnable — it already unobserves as it goes, but it must also pick up tiles
  that appeared since. Making it idempotent-and-re-callable is a small change to an existing
  function, not a rewrite.
- **One `id="gallery"` per page.** The reveal helper and the section anchor both key off it. A
  chapter page renders one gallery, so this holds — but it is a real constraint on ever putting
  two on a page, and worth a comment rather than a surprise later.

## Implementation

### 1. Content schema

**File**: `src/content/config.ts`

Add to the `chapters` schema, alongside `heroImage` / `showGallery`:

```ts
photos: z
  .array(z.object({ image: z.string(), caption: z.string().optional() }))
  .optional(),
```

Optional, so every existing chapter file stays valid. Extend the block comment that already
explains `heroImage` / `showGallery` to say what `photos` does and that absent means "fall back
to the shared event gallery". Leave the `communities` schema alone — that is the scope boundary.

### 2. CMS field

**File**: `src/data/collections.json`

Add a `photos` field to the `chapters` entry, modelled on the existing `leads` / `links` list
fields:

```json
{
  "name": "photos",
  "label": "Chapter photos",
  "type": "list",
  "optional": true,
  "hint": "This chapter's own event photos. Leave empty to show the shared event gallery.",
  "fields": [
    { "name": "image", "label": "Photo", "type": "image" },
    { "name": "caption", "label": "Caption", "type": "text", "optional": true }
  ]
}
```

Place it after `showGallery` so the two gallery controls sit together in the editor. The `image`
sub-field type gives Nicole the media-library picker; `list` gives her add / remove / reorder.

### 3. Gallery helpers

**File**: `src/lib/gallery.ts`

Four additions, all pure and unit-testable, in the module's existing "data in, data out" style:

- `export interface GalleryPhoto { src: string; caption?: string }`
- `toGalleryPhotos(input: (string | { image: string; caption?: string })[]): GalleryPhoto[]` —
  normalizes either shape, dropping rows with a blank/missing `image` so a half-filled CMS row
  cannot render an empty tile.
- `galleryColumns(count: number, max = 5): number` — `Math.min(count, max)`, floored at 1, so a
  three-photo chapter renders three columns instead of five with two holes.
- `visibleGalleryPhotos(photos, { expanded, cap })` — the first `cap` when collapsed, all when
  expanded or when `cap` is absent. Callers with no cap get every photo, which is what keeps the
  landing page uncapped.

Also make `initGalleryReveal()` safe to call again after "Show all" mounts new tiles: it already
no-ops on an empty query and unobserves each tile as it reveals, so the change is to skip tiles
already marked `in-view` and to export the re-run rather than assuming a single call at load.

**File**: `src/lib/gallery.test.ts` — cases for each new helper: mixed string/object input,
blank-image rows dropped, columns clamped both directions (1 photo → 1, 40 photos → 5),
collapsed vs expanded vs uncapped.

### 4. Lightbox

**New file**: `src/lib/lightbox.ts` *(new)*

Mirrors the `gallery.ts` / `parallax.ts` split — pure helpers plus thin idempotent wiring:

- `lightboxKeyAction(key: string): 'close' | 'next' | 'prev' | null` — maps `Escape`,
  `ArrowRight`, `ArrowLeft`; everything else `null`. (`<dialog>` handles Esc natively too; mapping
  it keeps the close path single.)
- `nextPhotoIndex(current: number, count: number, delta: number): number` — wraps at both ends.
- `initLightbox(): void` — no-op under SSR/vitest (no `window`/`document`) and when
  `HTMLDialogElement` is unavailable; otherwise binds the open buttons, the dialog's prev / next /
  close controls, and the keydown handler. Idempotent, guarded by a `data-` flag so a second call
  does not double-bind.

**New file**: `src/lib/lightbox.test.ts` *(new)* — the two pure helpers, including wrap-around in
both directions and the unmapped-key case.

### 5. The gallery component

**File**: `src/components/landing/EventGallery.astro`

- Props become `photos?: (string | { image: string; caption?: string })[]`, `cap?: number`,
  `heading?: string`, `kicker?: string`, all optional. Keep `images?: string[]` as an alias for
  `photos` so the captured `event-gallery` scenario and any existing call keep working, and note
  in the comment that it is retained for that reason.
- Normalize through `toGalleryPhotos`, compute `columns` via `galleryColumns`, and render
  `visibleGalleryPhotos(...)`. Pass the real `columns` into the existing
  `galleryStaggerDelay(i, columns)` so the ripple matches the grid actually rendered rather than
  always assuming five.
- Drive the grid off a `--gallery-cols` custom property set inline from `columns`; keep the
  existing 900px → 4 and 600px → 3 breakpoints as ceilings via `min()` so a small gallery never
  gains columns on a narrow screen.
- Wrap each tile's `<img>` in `<button type="button" data-lightbox-open data-index={i}>`, carrying
  the full-size src and caption as data attributes. Style the button to be visually
  indistinguishable from today's tile — no border, no background, inheriting the existing
  `aspect-ratio: 1/1` crop — with a visible `:focus-visible` ring.
- Render one `<dialog data-lightbox>` per gallery holding the large `<img>`, a `<figcaption>`, a
  close button, and prev / next buttons. Hidden until `showModal()`.
- Below the grid, when `cap` is set and there are more photos than the cap, a
  `<button data-gallery-expand>` reading "Show all N photos". Its click handler removes the cap
  class and re-runs `initGalleryReveal()`.
- Heading/kicker default to today's "Community" / "From our events" so the landing page is
  unchanged.
- Extend the `<script>` block to call `initLightbox()` alongside the existing
  `initGalleryReveal()`.

### 6. Wiring the chapter page

**File**: `src/components/ChapterPage.astro`

Accept `photos?: { image: string; caption?: string }[]` and pass it down, with the fallback that
preserves today's behaviour:

```astro
{showGallery
  ? <EventGallery
      photos={photos?.length ? photos : undefined}
      cap={photos?.length ? 12 : undefined}
      heading={photos?.length ? `Photos from ${name}` : undefined}
    />
  : null}
```

A chapter with no curated photos passes nothing and gets the shared 40-photo wall, uncapped, with
the original heading — exactly what renders today. Update the component's header comment, which
currently describes the gallery as shared.

**File**: `src/pages/chapters/[slug].astro`

Destructure `photos` from `chapter.data` (line ~53) and pass it to `ChapterPage` (line ~68).

**Not changed**: `src/pages/communities/[slug].astro`. It never passes `photos`, so communities
keep the shared gallery. Say so in a comment there, so the omission reads as a decision rather
than an oversight.

### 7. Seed one real chapter

**File**: `src/content/chapters/nyc.md`

Add a `photos` list with a handful of real entries so the feature is visible without CMS work and
the scenarios have honest data. Only `/images/gallery/event-*.jpg` and
`/images/chapters/nyc.jpg` are known to exist — confirm any path against `public/images` before
committing it, since a record naming a file that is not there renders a broken tile.

## Reused existing code

- `galleryStaggerDelay`, `galleryRevealImmediately`, `initGalleryReveal` from `src/lib/gallery.ts`
  (glossary entries: `galleryStaggerDelay`, `galleryRevealImmediately`, `initGalleryReveal`;
  tested in `src/lib/gallery.test.ts`) — the stagger and reveal keep working; the new helpers join
  the same module.
- `altFor` + `readMediaManifest` from `src/lib/media.ts` (glossary entries: `altFor`,
  `readMediaManifest`) — already how `EventGallery` resolves alt text; the lightbox's large image
  reuses the same resolved alt rather than inventing one.
- `withBase` from `src/lib/url.ts` (glossary entry: `withBase`) — mandatory on every image src;
  the preview deploys under the `/harvardintech` base path, and `landing-images.test.ts` exists
  specifically because this was missed once before.
- `ChapterPage` (glossary entry: `ChapterPage`) and `ChapterRoute` /
  `getStaticPaths` (`src/pages/chapters/[slug].astro`, glossary entries: `ChapterPage`,
  `ChapterRoute`, `getStaticPaths`) — the prop-drilling seam already exists for `heroImage` and
  `showGallery`; `photos` follows the identical path.
- The `leads` / `links` `list` fields in `src/data/collections.json` — the exact precedent for a
  repeatable CMS field on this collection, including how sub-fields are declared.
- The dependency-free `<script>` + `data-*` hook pattern from
  `src/components/landing/HeroCarousel.astro`, and the pure-helpers-plus-thin-wiring split from
  `src/lib/parallax.ts` (tested in `src/lib/parallax.test.ts`).

**Existing-implementation survey.** Grepped `src/` for `dialog`, `modal`, and `lightbox`
(case-insensitive, excluding tests): **no** existing modal, dialog, or lightbox anywhere in the
site, so `src/lib/lightbox.ts` is genuinely new rather than a duplicate. On the data side, the
`chapters` collection has no photo-list field today — `heroImage` is a single image and
`showGallery` is a boolean toggle over the shared set — and no helper anywhere normalizes gallery
input or computes a column count; `galleryStaggerDelay` takes a `columns` argument but every
caller relies on its default of 5. So all four helpers are additions.

**Constrained-file pre-check.** `classify-constrained-files` over the full file list returns
`{"constrained": []}` — nothing here is a lean-limited SKILL.md or an agent-config file.

## Scenarios to Demonstrate

- NYC with a curated 8-photo gallery — its own photos, its own heading, 5 columns.
- A chapter with 3 photos — 3 columns, no empty grid cells (the layout bug the current fixed
  5-column grid would produce).
- A chapter with 20 photos — 12 shown, "Show all 20 photos" button, then the full set with the
  reveal animation firing on the newly mounted tiles.
- A chapter with no `photos` (dc-dmv, london, seattle as they stand today) — the shared 40-photo
  wall, uncapped, original heading. The no-regression case.
- `showGallery: false` — no gallery section at all, unchanged.
- Lightbox open on a photo with a caption, and on one without.
- Lightbox keyboard nav: arrow keys wrapping past both ends, Esc closing, focus returning to the
  tile that opened it.
- A community page — still the shared gallery, proving the scope boundary holds.
- The landing page — all 40 photos, no cap, no heading change.
- Mobile: 3 columns, the lightbox filling the viewport, the expand button at natural width.
- Reduced motion: tiles revealed immediately, no transform, lightbox still operable.
- A `photos` row saved with a blank image in the CMS — dropped, no empty tile.
---
title: "NS -- Hero Video On The Donate Page"
mode: ui
createdAt: "2026-08-07T21:34:39Z"
prefix: "NS"
source: manual
---

## Summary

Let the Momentum Fund hero on `/donate` carry a video instead of the photo. A
new **Hero video** field on the `/donate` page-copy entry in `/admin` takes a
path to a self-hosted file (`/videos/momentum.mp4`); when it holds one, the hero
plays it as a silent, looping, controlless backdrop behind the headline and the
Give button. Blank leaves the page exactly as it is today. The hero image stays
in place as the video's poster frame and as the fallback everywhere the video
cannot or should not play — reduced-motion, a missing file, a browser that
refuses to autoplay.

## Key Decisions

- **Backdrop, not a player.** Muted, looping, no controls — the photo's
  replacement, with the headline, subhead, and Give button unchanged on top. A
  hero that becomes a video player would move the campaign's call to action
  below the fold and put a sound control in front of the one thing the page
  exists to do.
- **The image never goes away; it becomes the fallback layer.** `heroImage`
  stays on the section as the CSS background and is handed to the video as its
  `poster`. So a video that 404s, a browser that blocks autoplay, and a visitor
  on `prefers-reduced-motion` all get the current page rather than a black
  rectangle — with no JavaScript involved in any of those three paths.
- **A `text` field, not the CMS `image` field.** The media library uploader is
  images-only (`accept="image/*"` in the package's `UploadDropZone.tsx`), so a
  video cannot be uploaded through it and an `image`-typed field would offer a
  picker that can never show the file. The field takes a path an editor pastes;
  adding a new video file to `public/videos/` stays a repo commit.
- **Self-hosted under `public/videos/`, not an external URL or an embed.** It
  ships with the static build, has no third-party origin, no cookie surface, and
  no iframe — and a YouTube/Vimeo embed cannot be a silent chromeless backdrop
  anyway. The cost is repo weight, which the field's hint states as a size
  budget.
- **`heroVideo` is deliberately NOT added to `src/data/donatePage.json`.**
  `mergeDonateFrame` runs every frame field through `preferText`, which falls
  back to the JSON when the CMS value is blank — so a field that exists in both
  places can never be cleared from `/admin`. Leaving the JSON without the key
  means clearing the box in the CMS genuinely removes the video and restores the
  photo, which is the one thing an editor must be able to do unaided.
- **The video is decorative.** `aria-hidden`, no track, no captions: it carries
  no speech and no information the headline does not already state.

## Implementation

### 1. Declare the field on the page-copy schema

**File**: `src/content/config.ts`

Add `heroVideo: z.string().optional()` to the `pageCopy` collection schema,
beside the existing frame fields, with a comment naming it as the hero's
optional moving backdrop and pointing at the poster/fallback relationship with
`heroImage`.

### 2. Put the field in the CMS

**File**: `src/data/collections.json`

A new `heroVideo` field on the `pageCopy` collection, directly after
`heroImage`: `"type": "text"`, `"optional": true`, label **Hero video**. The
hint carries what an editor actually needs to know — that it takes a path like
`/videos/momentum.mp4` for a file committed under `public/videos/`, that the
video plays silently on a loop with no controls, that the hero image is used as
its first frame and as the fallback, and that clearing the box restores the
photo.

### 3. Carry it through the copy merge

**File**: `src/lib/pageCopyMerge.ts`

`heroVideo?: string` on `DonateFrameEntry`, and one more `preferText` line in
`mergeDonateFrame`. Because `donatePage.json` carries no `heroVideo`, the
fallback resolves to `undefined` and clearing the field really clears it — the
inverse of the `inquiryFormUrl` case in `mergeSponsorCopy`, and worth a comment
saying so beside the line.

**File**: `src/lib/site.ts`

`heroVideo?: string` on `DonatePageCopy`, documented next to `heroImage`.

### 4. Render it

**File**: `src/components/donate/MomentumHero.astro`

Take a new optional `video` prop. When set, render a `<video>` as the first
child of `.hero`:

- `autoplay muted loop playsinline preload="metadata" aria-hidden="true"`
- `poster` = the resolved hero image, `src` = `withBase(video)` (the same
  `withBase` the image already goes through, so it survives the project-subpath
  base on the current GitHub Pages deploy)
- absolutely positioned, `inset: 0`, `object-fit: cover`

Stacking: the video sits below the existing `.hero::before` scrim, which sits
below `.hero-in` — the scrim already guarantees the headline's contrast floor
over an arbitrary photo and must do the same over an arbitrary frame of video.
Keep `--hero-img` on the section unconditionally so the photo is painted behind
the video rather than replaced by it; that is what makes a failed load
invisible. Add `@media (prefers-reduced-motion: reduce) { .hero-video { display:
none } }`, which reveals that same background image.

**File**: `src/components/MomentumFundPage.astro`

Pass `video={copy.heroVideo}` to `MomentumHero`.

### 5. Somewhere for the file to live

**New directory**: `public/videos/` (new)

Where a committed hero video goes; it is created when the first real video is
supplied. Nothing else changes until then — the field is blank in production and
the hero renders exactly as it does today. Guidance for the file, to be repeated
in the field hint: H.264 MP4, muted, no larger than 1080p, and kept to a few
megabytes, because every visitor to `/donate` downloads it and the whole site is
served from GitHub Pages.

### 6. Tests and the isolation page

**File**: `src/lib/pageCopyMerge.test.ts`

Extend the existing `mergeDonateFrame` suite: `heroVideo` passes through from
the entry; a blank one resolves to `undefined` rather than resurrecting a
fallback; an entry with no `heroVideo` at all leaves the rest of the frame
untouched.

**New file**: `src/pages/isolated-components/MomentumHero-Video.astro` (new)

The `MomentumHero` isolation page with a `video` prop set, following the
existing `StepTick-Done.astro` / `BoardMemberTile-Initials.astro` variant
naming. If the capture of a playing video turns out to be non-deterministic
between runs, pin it the way `previewName` already pins the personalized
headline — a scenario-only prop that renders the still — rather than accepting a
frame-dependent screenshot.

## Reused existing code

- `withBase` from `src/lib/url.ts` (glossary entry: `withBase`) — the video src
  goes through the same base-path resolution as `heroImage`, which is what keeps
  it working under the current `/harvardintech` project-site base.
- `preferText` and `mergeDonateFrame` from `src/lib/pageCopyMerge.ts` (glossary
  entries: `preferText`, `mergeDonateFrame`) — the field joins the existing
  frame merge rather than getting a path of its own.
- `MomentumHero.astro`'s existing `--hero-img` background and `.hero::before`
  scrim — the video is layered into that structure, not a replacement for it.
- The `previewName` scenario-hook pattern in `MomentumHero.astro` — the model if
  a capture-stability prop turns out to be needed.
- `loadDonateFrame` in `src/lib/donatePageContent.ts` (glossary entry:
  `loadDonateFrame`) — needs no change; it spreads whatever `mergeDonateFrame`
  returns, so the new key arrives at the component for free.

### Existing-implementation survey

Grepped for existing video handling before adding a field. There is none: no
`<video>` element anywhere in `src/components/`, no `video` key in
`src/data/media.json` or `src/lib/media.ts` (whose `MediaAsset` models images
and their alt text), and the package's media library infers `image/*` MIME types
only. `heroImage` on `pageCopy` is the closest existing thing and is what this
field is modelled on and falls back to. So nothing equivalent exists to extend.

## Scenarios to Demonstrate

- `/donate` hero with a video backdrop set — headline, subhead, and Give button
  legible over it through the existing scrim.
- `/donate` hero with the field blank: today's page, unchanged. The regression
  guard that matters most, since that is production until a video is supplied.
- Reduced motion with a video set: the photo, not the video.
- A `heroVideo` path that resolves to nothing: the photo again, with no gap or
  black band — proving the fallback is structural rather than a happy accident.
- The `/admin` page-settings editor for `/donate` showing the new **Hero video**
  field and its hint below the Hero image picker.
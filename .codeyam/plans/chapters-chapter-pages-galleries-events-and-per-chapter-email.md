---
title: "chapters: Chapter Pages — Galleries, Events, and Per-Chapter Email"
mode: ui
createdAt: "2026-06-15T00:00:00Z"
source: manual
prefix: "chapters"
---

## Summary

The chapter pages (`/chapters/<slug>`) still don't match the live
harvardintech.com chapter pages below the fold. On the live site **every**
chapter page (NYC, San Francisco, Japan) shows an event-photo **gallery** as you
scroll, the **SF page shows a featured event/panel**, and **Connect With Us
displays a per-chapter contact email** (NYC `info@…`, Japan `japan@…`, SF
`risdhillon@…`). Locally only Japan renders the gallery (it's the lone chapter
with `showGallery: true`), no chapter renders any events, and Connect always
shows the single global settings email. This plan makes the gallery appear on
every chapter page, adds a per-chapter Upcoming Events section (reusing the
existing event card/data helpers), and lets each chapter show its own contact
email in Connect.

## Key Decisions

- **Gallery on by default** — change `showGallery` to default `true` so the
  event-photo gallery renders on every chapter page (matching the live site),
  while a chapter can still opt out with `showGallery: false`. Chosen over
  hand-setting `showGallery: true` in each of the four chapter files because the
  live behavior is "every chapter has one," so the default should reflect that
  and new chapters inherit it automatically.
- **Explicit `chapter` link on events** — associate events to a chapter via a
  new optional `chapter` slug field on the `events` collection rather than
  fuzzy-matching `event.location` against `chapter.region`. Explicit, CMS-
  editable, and unambiguous. Events with no `chapter` (e.g. the Cambridge panel)
  simply don't appear on any chapter page.
- **Events section only renders when the chapter has events** — avoids an empty
  "Upcoming Events" block on chapters with none (Japan, L.A.), matching the live
  NYC/Japan pages which show no events list.
- **Per-chapter email is an optional override** — add optional `contactEmail` to
  the `chapters` schema; `ChapterConnect` uses it when set and falls back to the
  global `settings.contactEmail` otherwise. Keeps existing global behavior intact
  for chapters that don't set one.
- **Scroll order mirrors the live SF page** — Hero → Upcoming Events (when any)
  → Sign Up → narrow content block (when any) → Gallery → Connect.

## Implementation

### 1. Add `chapter` to the events schema and `contactEmail` to the chapters schema

**File**: `src/content/config.ts`

- In the `events` collection schema, add `chapter: z.string().optional()` — the
  slug/id of the chapter this event belongs to. Keep the existing comment style;
  note it's optional so a non-chapter event (e.g. Cambridge) still validates.
- In the `chapters` collection schema, add `contactEmail: z.string().optional()`
  — per-chapter Connect email; absent means fall back to the global settings
  email.

### 2. Show the gallery on every chapter page by default

**File**: `src/components/ChapterPage.astro`

- Change the `showGallery` prop default from `false` to `true` so an unset
  chapter renders the gallery.

**File**: `src/pages/chapters/[slug].astro`

- The route currently passes `showGallery={showGallery}`; when the frontmatter
  omits it this is `undefined`, which now falls through to the component default
  (`true`). Confirm Japan (`showGallery: true`) is unchanged. No content edit
  needed for NYC/SF/L.A. — they inherit the gallery from the new default.

### 3. New per-chapter Upcoming Events section

**New file**: `src/components/ChapterEvents.astro`

A section component that takes an already-filtered, already-split list of
upcoming events for one chapter plus the `city`, and renders a heading like
"Upcoming Events" (or "Upcoming Events in {city}") above a grid of cards reusing
the shared `EventCard` (`variant="upcoming"`). Mirror the grid/markup of
`landing/UpcomingEvents.astro` (`s-section` / `s-inner` / `s-title`,
`auto-fit minmax(280px, 1fr)` grid) for visual consistency. Render **nothing**
when the events array is empty (the parent already guards, but keep it safe).

### 4. Wire events + per-chapter email through the page

**File**: `src/components/ChapterPage.astro`

- Add props: `events?: EventLike[]` (upcoming events for this chapter, already
  filtered) and `contactEmail?: string`.
- Insert `<ChapterEvents>` immediately after `<ChapterHero>` and before
  `<ChapterSignUp>`, rendered only when `events.length > 0` — matching the live
  SF page where the panel sits between the hero and Sign Up.
- Pass `contactEmail` down to `<ChapterConnect>` (see step 5).

**File**: `src/pages/chapters/[slug].astro`

- In `getStaticPaths` (or the page frontmatter), load the events collection,
  filter to `event.data.chapter === chapter.id`, map to the `EventLike` shape,
  and split with `splitEvents(...)` to take `upcoming` (soonest first). Pass the
  result as the `events` prop and `chapter.data.contactEmail` as `contactEmail`
  to `<ChapterPage>`.

### 5. Per-chapter email in Connect

**File**: `src/components/ChapterConnect.astro`

- Add an optional `email?: string` prop; use it when provided, otherwise fall
  back to `settings.contactEmail`. The mailto + displayed address both use the
  resolved email. Socials remain from settings.

### 6. Tag existing events to chapters and set per-chapter emails

**Files**: `src/content/events/founders-investors-mixer-sf.md`,
`src/content/events/harvard-in-tech-summit-2026.md`

- Add `chapter: san-francisco` to the SF mixer and `chapter: nyc` to the Summit.
  Leave `women-in-tech-panel.md` (Cambridge) unassigned so it demonstrates an
  event that appears on no chapter page.

**Files**: `src/content/chapters/nyc.md`, `src/content/chapters/japan.md`,
`src/content/chapters/san-francisco.md`

- Add `contactEmail` matching the live pages: `info@harvardintech.com` (NYC),
  `japan@harvardintech.com` (Japan), and the SF chapter's live address. Leave
  L.A. without one so it demonstrates the global-email fallback.

### 7. Update the CMS config for the new fields

**File**: `public/admin/editor/config.yml`

- Add the optional `contactEmail` field to the chapters collection and the
  optional `chapter` field to the events collection so both stay editable in the
  Sveltia/Decap CMS. Keep them optional (`required: false`).

## Reused existing code

- `EventCard` from `src/components/EventCard.astro` (glossary entry: not yet
  registered — component already shared by `UpcomingEvents` and the events page)
- `splitEvents`, `formatEventDate`, `EventLike` from `src/lib/events.ts`
  (glossary entries: `splitEvents`, `formatEventDate`)
- `EventGallery` from `src/components/landing/EventGallery.astro` — already
  wired into `ChapterPage`; now shown on every chapter via the default change
- `ChapterConnect` from `src/components/ChapterConnect.astro` (glossary entry:
  `ChapterConnect`) — extended with an optional `email` override
- `buildMailto` from `src/lib/mailto.ts` and `socialIconSrc` from
  `src/lib/socialIcon.ts` — unchanged, used by `ChapterConnect`
- `landing/UpcomingEvents.astro` as the markup/grid reference for the new
  `ChapterEvents` section

## Scenarios to Demonstrate

- **NYC chapter** — hero, an Upcoming Events section with the Summit 2026 card,
  Sign Up, the photo gallery, and Connect showing `info@harvardintech.com`.
- **San Francisco chapter** — hero, Upcoming Events showing the Founders &
  Investors Mixer, gallery, and Connect with the SF email.
- **Japan chapter** — hero + tagline, **no** events section (no chapter events),
  the gallery, and Connect showing `japan@harvardintech.com`.
- **L.A. chapter** — gallery present, no events section, Connect falling back to
  the global settings email (no per-chapter override).
- **ChapterEvents (isolated)** — rich (multiple cards) vs empty (renders nothing)
  to prove the empty-state guard.
- **ChapterConnect (isolated)** — with a per-chapter `email` override vs without
  (global fallback).

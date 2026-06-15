---
title: "Homepage — exact visual match to harvardintech.com"
mode: ui
createdAt: "2026-06-15T11:09:00Z"
source: prototype
step: 10
---

# Homepage — exact visual match to harvardintech.com

Bring the homepage into a faithful, section-by-section match with the live
site at https://www.harvardintech.com/. Prototyped against the live preview by
screenshotting both sites and reconciling each landing section. All work is on
the existing per-section components under `src/components/landing/` plus the
shared title styling in `src/styles/tokens.css`; assets were downloaded from the
live site into `public/images/`.

## What was prototyped (section by section)

### WhatsApp community (`src/components/landing/WhatsappCommunity.astro`)
- Removed the "WhatsApp Community" `<h2>` heading — on the live site the
  **banner image is the header**.
- Moved the "JOIN OUR COMMUNITY ON WHATSAPP" banner to the **top** of the
  section and made it full-width (max 918px).
- Section background changed to the live robin's-egg blue **`#ebf7f4`**
  (new `--color-bg-blue` token).
- Body copy + the two-step apply list are now **left-aligned** (was centered).
- Banner asset: `public/images/sections/whatsapp-banner.jpg`.

### Support Us (`src/components/landing/SupportUs.astro`)
- Replaced the bordered card boxes with the live site's **five large circular
  flat icons** above each label (no card chrome).
- Icons downloaded from Strikingly's static set into
  `public/images/support/`: `trophy.png`, `chat.png`, `briefcase.png`,
  `quote.png`, `star.png` — mapped in order to Sponsor an Event / Host us in
  your space / Share with us job opportunities / Speak at a future event /
  Volunteer your time. Each is still a pre-filled `mailto` via `buildMailto`.
- Five-across grid on desktop; wraps responsively below 780px.

### Event gallery (`src/components/landing/EventGallery.astro`)
- Bumped from 12 to **40** real event photos (downloaded at retina res to
  `public/images/gallery/event-01..40.jpg`).
- Dense **5-column** grid (4 cols ≤900px, 3 cols ≤600px), 6px gaps, square
  tiles — matches the live layout.
- Added **fade-in-on-scroll**: each tile starts at opacity 0 / translateY(24px)
  and animates in via an `IntersectionObserver`, staggered per column.
  Honors `prefers-reduced-motion` (shows everything immediately) and degrades
  gracefully without `IntersectionObserver`.

### Board of Directors (`src/components/landing/BoardOfDirectors.astro`, `src/components/BoardMemberCard.astro`)
- Decision: keep the board **data-driven** (the 5 members from the `team`
  content collection), not the static composite image — confirmed with the user.
- Restyled the wrapping card grid into a **single centered B&W row** of 5
  (`.board-row`), wrapping responsively below 820px.
- `BoardMemberCard` now splits the `role` on `·` so the title and Harvard class
  render on **two lines** (e.g. "Founder" / "Harvard C'08"), matching the live
  composite; names are weight 400.
- Re-added the **logo lockup** the live composite bakes in above the profiles:
  the Harvard-in-Tech mark (`public/images/sections/board-logo.png`) and the
  "BOARD OF DIRECTORS" wordmark (`public/images/sections/board-wordmark.png`),
  cropped from the original composite and laid out centered side-by-side above
  the member row (`.board-lockup`).

### Contact (`src/components/landing/ContactUs.astro`)
- Section background set to the same light-blue band (`--color-bg-blue`).
- Links restyled to the live **blue `#3377cc`** (`--color-link`), larger,
  normal case (was uppercase tracked teal).

### Global section titles (`src/styles/tokens.css`)
- `.s-title` reworked to the live theme: **dark-teal `#1d5a5a`**
  (`--color-title`), ~36px Helvetica, weight 400, flanked by two short
  horizontal rules via `::before`/`::after` using `currentColor` (so the
  white-on-dark "GET INVOLVED" title gets white rules for free).
- Removed the old uppercase transform + small underline; per-section casing is
  now authored in the markup to match the live site (uppercase for GET
  INVOLVED / SUPPORT US / CONTACT US / BOARD OF DIRECTORS; title-case for the
  gallery heading).
- Added `.s-title--plain` for the live "Upcoming Events" outlier — a smaller,
  muted grey Roboto heading with **no** flanking rules
  (`src/components/landing/UpcomingEvents.astro`).

## New / changed assets
- `public/images/sections/whatsapp-banner.jpg` (banner header)
- `public/images/sections/board-logo.png`, `board-wordmark.png` (cropped lockup)
- `public/images/support/{trophy,chat,briefcase,quote,star}.png` (5 icons)
- `public/images/gallery/event-01..40.jpg` (40 photos, replaced the prior 12)

## Decisions made
- **Board = data-driven row**, not the static composite image (user choice) —
  but with the live lockup graphics restored above it for fidelity.
- **Upcoming Events** title kept as the muted grey, rule-less outlier to match
  the live site exactly rather than normalizing it to the teal title style.

## Edge cases verified in the prototype
- Section title rules invert to white automatically on the dark "Get Involved"
  band (via `currentColor`).
- Gallery fade-in respects `prefers-reduced-motion` and the no-IO fallback.
- Board row and support icons collapse to responsive grids on narrow screens.
- `BoardMemberCard` role-splitting is a no-op for roles without a `·`.

## Deconstruct / hardening notes for Build
- Existing scenarios that exercise this code: **Harvard in Tech - Landing Page**
  (Desktop + Mobile), **Harvard in Tech - Board of Directors**, **Harvard in
  Tech - No Upcoming Events**, plus the isolated `BoardMemberCard` /
  `EventsPage` component scenarios. Re-capture these — the visuals changed
  substantially.
- Pure logic to cover with tests: the `role` split in `BoardMemberCard`
  (consider lifting into `src/lib/team.ts` as a tested helper), and the gallery
  fade-in observer wiring (the enable/fallback decision can mirror the
  `parallax.ts` pure-helper + thin-wiring split for unit testing).
- Confirm the 40 gallery filenames and the new section/support assets are
  committed and referenced via `withBase` so they survive the Pages base-path
  rewrite.

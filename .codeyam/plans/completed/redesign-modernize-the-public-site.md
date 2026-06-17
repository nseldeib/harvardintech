---
title: "redesign: Modernize the Public Site"
mode: ui
createdAt: "2026-06-17T16:00:00Z"
source: manual
prefix: "redesign"
---

## Summary

The entire public site is currently a faithful reproduction of harvardintech.com's
Strikingly "persona/fresh" template — Roboto 300 on near-black text, a single teal
accent, full-width centered bands with uppercase titles flanked by short 80×2px
rules, flat dark photo overlays, and 4px-radius pill buttons. The look reads as
early-2010s template. This plan gives the **whole public site a bolder, contemporary
redesign** while keeping it unmistakably Harvard in Tech: a refreshed Harvard
crimson + teal palette, a modern variable-font type system with large editorial
headings, generous whitespace, a grid-/card-driven layout with depth and overlap,
a sticky header that condenses on scroll, and tasteful scroll-reveal motion. The
work is anchored in `src/styles/tokens.css` and the shared `.s-*` utility classes
so the new visual language propagates consistently, then each section/component is
restyled to use it. Content, copy, links, data wiring, and the CMS/admin surfaces
are unchanged — this is purely presentational.

## Key Decisions

- **Token-first.** Rebuild `src/styles/tokens.css` (palette, type, spacing, radius,
  shadow, motion tokens) and the shared `.s-section` / `.s-title` / `.s-btn`
  classes first. Every public surface already consumes these, so the redesign
  lands cohesively instead of component-by-component drift. Considered editing
  components in isolation — rejected because it produces an inconsistent site and
  duplicates style decisions.
- **Drop the flanking-rule title cliché.** Replace the `.s-title` "80px rule —
  uppercase text — 80px rule" treatment (repeated in Hero, ChapterHero, and every
  section) with a modern editorial heading: a small colored **eyebrow/kicker**
  label above a large, tighter-tracked display heading. This single change is the
  strongest visual signal that the site moved past the template.
- **Bolder but still Harvard.** Introduce **Harvard crimson** (`#A5122F`-ish) as a
  primary brand color alongside a refined teal as the interactive/accent color,
  plus a proper neutral ramp and a dark surface token. Keeps brand recognition
  while giving the palette real range for contrast and hierarchy. Considered a
  full palette swap — rejected as off-brand for a Harvard org.
- **Modern type via Google Fonts.** Swap Roboto 300 for a contemporary variable
  sans (Inter) for body/UI and a strong display family for headings (Inter tight,
  or a geometric/grotesk display such as Space Grotesk), loaded through the
  existing `<link rel="stylesheet">` in `BaseLayout`. No build-tooling change.
- **Reuse the existing motion primitives.** Keep parallax but soften it (gradient
  overlays, gentler offset) via the existing `initParallax`, and drive
  scroll-reveal with the existing `initGalleryReveal` / `galleryStaggerDelay`
  pattern rather than adding a new animation dependency.
- **Fold orphan pages into the shell.** `src/pages/blog/[slug].astro` renders its
  own bare `<html>`/`<head>` and skips `BaseLayout`. Route it through `BaseLayout`
  so it inherits the new header, footer, fonts, and tokens for free.
- **Respect reduced motion.** All new reveal/parallax/hover motion is gated behind
  `@media (prefers-reduced-motion: reduce)` and the existing `parallaxEnabled`
  guard, so the redesign stays accessible.

## Implementation

Organized by area, not execution order.

### 1. Foundation — design tokens & shared utilities

**File**: `src/styles/tokens.css`

Rebuild the token layer into a modern design system:

- **Color**: add a Harvard-crimson primary ramp, refine the teal into an
  interactive/accent ramp, add a neutral gray ramp (text/border/surface), a dark
  surface token for inverted bands, and semantic tokens (`--color-primary`,
  `--color-accent`, `--color-surface`, `--color-surface-elevated`,
  `--color-on-dark`, etc.). Preserve the existing token *names* already referenced
  across components (`--color-accent`, `--color-bg`, `--color-fg`,
  `--color-border`, `--color-title`, `--color-bg-blue`, `--color-muted`,
  `--color-faint`) so nothing breaks, and remap their values to the new system.
- **Type**: replace `--font-sans`/`--font-title` with Inter (body) + a display
  family (headings). Add a fluid type scale (`--text-xs … --text-5xl` via
  `clamp()`), tighten heading `letter-spacing`/`line-height`, set a comfortable
  body line-height. Bump default body weight off 300 to 400.
- **Space / radius / shadow / motion**: expand the spacing scale, add a radius
  scale (`--radius-sm/md/lg/pill`), add elevation shadows
  (`--shadow-sm/md/lg`), and add motion tokens (`--ease`, `--dur`) for consistent
  transitions.
- **Shared classes**: redesign `.s-section` (more generous, asymmetric-friendly
  padding), `.s-title` (remove the `::before/::after` flanking rules; restyle as a
  large display heading), add a new `.s-eyebrow`/`.s-kicker` class for the kicker
  label, restyle `.s-btn` (modern radius, weight, hover lift/shadow, a
  `.s-btn--ghost`/secondary variant), and add reusable `.s-card` (surface, radius,
  shadow, hover depth) and `.s-reveal` (scroll-reveal initial state) utilities the
  components can opt into.

### 2. Global shell — header, nav, footer

**File**: `src/layouts/BaseLayout.astro`

- Update the Google Fonts `<link>` to load Inter + the chosen display family.
- Replace the centered, dipping-shield header with a **sticky header that condenses
  on scroll** (shrinks padding, gains a subtle shadow/translucent backdrop on
  scroll via a tiny inline script + a `data-scrolled` attribute). Modernize the nav
  (wordmark/shield left, nav links right, restyled Chapters dropdown with the new
  shadow/radius tokens). Keep the `nav` data wiring and `withBase` usage intact.
- Redesign the footer into a richer multi-column band (brand blurb, quick links,
  social) on the dark surface token, still driven by the `settings` singleton —
  `footerText` stays, layout becomes contemporary.
- Add a small global scroll-reveal bootstrap so any element with `.s-reveal`
  animates in (reusing the gallery reveal pattern; see item 7).

### 3. Homepage hero & inverted photo bands

**Files**: `src/components/landing/Hero.astro`, `src/components/landing/GetInvolved.astro`

- Hero: rework into an **asymmetric editorial hero** — large display headline,
  kicker label, mission paragraph constrained to a readable measure, primary +
  secondary CTA. Replace the flat `rgba(0,0,0,0.39)` overlay with a directional
  gradient overlay for legibility and depth; keep the parallax `<img>` and
  `initParallax`, softened.
- GetInvolved: same inverted-band modernization (gradient overlay, kicker +
  display heading via the new `.s-title`/`.s-eyebrow`, refreshed button).

### 4. Homepage content sections

**Files**: `src/components/landing/WhatsappCommunity.astro`,
`UpcomingEvents.astro`, `SupportUs.astro`, `EventGallery.astro`, `ContactUs.astro`

- Restyle each to the new system: kicker + display heading, generous spacing,
  card/grid treatments where appropriate, and `.s-reveal` on entry.
- WhatsApp section: turn the two-step apply flow into a cleaner numbered/stepped
  card layout on the light brand band.
- ContactUs: modernize the social-link row (icon buttons with hover depth).
- EventGallery: keep the existing staggered reveal (`initGalleryReveal`,
  `galleryStaggerDelay`) but update the grid/card styling and hover.

### 5. Cards — events & board

**Files**: `src/components/EventCard.astro`, `src/components/BoardMemberCard.astro`,
`src/components/landing/BoardOfDirectors.astro`,
`src/components/landing/UpcomingEvents.astro`

- EventCard: convert the inline-styled `<article>` into the shared `.s-card` look —
  elevation, hover lift, refined date/accent treatment, clearer "Learn more"
  affordance. Preserve the `upcoming`/`past` variant logic and `formatEventDate`.
- BoardMemberCard + BoardOfDirectors grid: modern portrait cards with depth/hover,
  refreshed lockup spacing. Preserve the image-fallback empty state and the
  `sortBoardMembers` / `filterActiveBoardMembers` ordering.

### 6. Chapter, events, blog, and 404 pages

**Files**: `src/components/ChapterHero.astro`, `ChapterPage.astro`,
`ChapterHeader.astro`, `ChapterEvents.astro`, `ChapterConnect.astro`,
`ChapterLeads.astro`, `ChapterLinks.astro`, `ChapterSignUp.astro`,
`src/components/EventsPage.astro`, `src/components/EventsSection.astro`,
`src/pages/events.astro`, `src/pages/chapters/[slug].astro`,
`src/pages/blog/[slug].astro`, `src/pages/404.astro`

- ChapterHero: mirror the new homepage hero (kicker + display heading, gradient
  overlay) — it currently duplicates the old Hero treatment, so it should track the
  same redesign.
- Restyle the chapter sub-components, the events listing, and the 404 page to the
  new tokens/utilities.
- **Blog**: refactor `src/pages/blog/[slug].astro` to render inside `BaseLayout`
  (drop its bare `<html>`/`<head>`) and apply a clean modern long-form **article
  layout** (readable measure, refined headings/links/`time`, back-link as a styled
  control).

### 7. Scroll-reveal helper

**New file** (or extend existing): a small `initReveal()` in `src/lib/` that
adds the `is-visible` class to `.s-reveal` elements via `IntersectionObserver`,
respecting `prefers-reduced-motion`.

Prefer **extending the existing `src/lib/gallery.ts`** (which already implements an
`IntersectionObserver` reveal with `initGalleryReveal` and `galleryStaggerDelay`)
into a generic reveal rather than introducing a parallel implementation. Wire it up
once from `BaseLayout` so every `.s-reveal` element across the site animates in.

## Reused existing code

- `initParallax`, `parallaxEnabled`, `parallaxOffset` from `src/lib/parallax.ts`
  (glossary: `initParallax`, `parallaxEnabled`, `parallaxOffset`) — keep parallax,
  soften it; reuse the reduced-motion guard.
- `initGalleryReveal`, `galleryStaggerDelay`, `galleryRevealImmediately` from
  `src/lib/gallery.ts` (glossary: `initGalleryReveal`, `galleryStaggerDelay`,
  `galleryRevealImmediately`) — the IntersectionObserver reveal pattern to extend
  into the site-wide `.s-reveal` helper.
- `formatEventDate`, `splitEvents`, `toEventDate` from `src/lib/events.ts`
  (glossary: `formatEventDate`, `splitEvents`, `toEventDate`) — event card/listing
  formatting, unchanged.
- `sortBoardMembers`, `filterActiveBoardMembers` from `src/lib/team.ts`
  (glossary: `sortBoardMembers`, `filterActiveBoardMembers`) — board ordering,
  unchanged.
- `withBase` from `src/lib/url.ts` — proxy-safe asset/link URLs, used throughout.
- `settings` / `nav` singletons from `src/lib/site.ts` — footer/header data wiring,
  unchanged.
- `BoardMemberCard` (glossary: `BoardMemberCard`) and `EventCard` — restyled in
  place and kept as the single source for their respective cards.
- The `.s-section` / `.s-title` / `.s-btn` shared classes in `tokens.css` — kept as
  the shared vocabulary, redesigned in place so every consumer updates at once.

## Scenarios to Demonstrate

- **Homepage, full redesign** — hero + all sections with realistic board members
  and a mix of upcoming/past events, showing the new type, palette, spacing, cards,
  and inverted photo bands.
- **Sticky header condense** — header in its default (top) state vs. its condensed
  scrolled state.
- **Board section with members** vs. **empty board fallback** (graphic + "announced
  soon" state) under the new card styling.
- **Upcoming events present** vs. **no upcoming events** (only past / empty) to
  exercise the redesigned `EventCard` variants and empty state.
- **Chapter page** with a hero image (new hero treatment) vs. a chapter **without**
  a hero image (ChapterHeader fallback).
- **Blog post** rendered in the new `BaseLayout`-wrapped article layout (long body
  vs. short body).
- **404 page** in the new styling.
- **Reduced motion** — homepage with `prefers-reduced-motion: reduce`, confirming
  reveal/parallax are disabled gracefully.
- **Mobile** — homepage hero and nav at a narrow viewport.

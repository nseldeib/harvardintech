---
title: "Events & Chapters Pages"
mode: ui
createdAt: "2026-06-13T13:40:02Z"
source: manual
dependsOn: ["landing-page-faithful-reproduction"]
---

## Summary

> **Stack note (updated):** the project scaffolded on the **Astro +
> GitHub Pages** stack, not Next.js. Routes are `src/pages/**`; chapter/about
> content lives in the `pages` content collection; the Events page reads the
> `events` collection. Treat the Next.js paths below as intent — they'll be
> mapped to Astro equivalents when this plan is picked up.

Complete the public site's remaining top-level pages so every item in the nav
resolves to a real page: a full **Events** page and the four **Chapters** pages
(NYC, San Francisco, L.A., Japan). All content stays static (sourced from the
`content/` modules established in the landing-page plan); no database. This
finishes the faithful reproduction of the public marketing site.

## Key Decisions

- **Reuse the static content model.** Events page reads the same
  `content/events.ts` the landing page's UpcomingEvents section uses, so there is
  one source of truth. Chapters get a new `content/chapters.ts` module.
- **One route per nav target.** `/events` and `/chapters/[slug]` (or explicit
  `/chapters/nyc`, `/chapters/sf`, `/chapters/la`, `/chapters/japan`) so static
  export emits a file per chapter.
- **Faithful, not redesigned.** Mirror whatever the live site shows on these
  pages.

## Implementation

### 1. Events page

**New file**: `app/events/page.tsx`

Full events listing (upcoming + past), reusing the `Event` type and
`content/events.ts`. Reuse the landing page's `UpcomingEvents` presentation
where it fits; add a past-events section.

### 2. Chapters content + pages

**New file**: `content/chapters.ts` — `Chapter[]` (slug, city, blurb, leads,
links) seeded from the live site.

**New files**: `app/chapters/[slug]/page.tsx` (+ `generateStaticParams`) or
explicit per-city routes, plus a `ChapterPage` component. Wire the nav dropdown
(from the landing plan's `SiteNav`) to these routes.

## Reused existing code

- `content/events.ts`, `Event` type, and `UpcomingEvents` component from
  `landing-page-faithful-reproduction` (cite glossary entries once registered).
- `SiteNav` / `SiteFooter` layout shell from the landing plan.

## Scenarios to Demonstrate

- Events page with upcoming + past events.
- Events page empty state.
- Each chapter page rendered (NYC / SF / L.A. / Japan).
- Chapter page with missing optional fields (no leads listed).

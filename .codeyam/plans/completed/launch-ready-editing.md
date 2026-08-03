---
title: "Launch-Ready Editing"
mode: ui
createdAt: "2026-08-03T18:58:15Z"
source: manual
---

## Summary

Close the gap between "the site is built" and "Nicole maintains it herself" — the
condition the HIT team needs met before they will approve moving
`harvardintech.com` off Strikingly.

Three things ship together:

1. **Every section on the homepage and the campaign pages gets a
   Show / Coming soon / Hidden control** Nicole operates from `/admin`. This is
   the mechanism the phased launch runs on: content that is not ready on cutover
   day goes out as "coming soon" or disappears, and she turns it on later without
   a developer.
2. **The copy that is currently unreachable from `/admin` becomes editable** —
   the homepage hero slides and stat strip, the Momentum Fund accomplishment and
   gift-pillar cards, and the Donate destination.
3. **Her edits stop being one keystroke from the public.** `src/data/cms.json`
   repoints to `staging`, so a save lands on the gated review site and reaches
   the world only through the existing **Promote review → live** button.

The domain cutover itself is NOT in this plan. It stays as
`migrate-harvardintech-com-off-strikingly`, which runs after this one — its DNS
sequence is unchanged and its `MX`/SPF-preservation rule still governs.

## Key Decisions

- **Everything editable becomes a content collection, not a package fork.**
  The CMS models exactly two singletons (`settings.json`, `nav.json`) and
  renders five scalar settings fields; `donatePage.json`, `sponsorPage.json` and
  `volunteerPage.json` are invisible to it, and so are `homeStats`,
  `googleAnalyticsId` and the custom head/body HTML on `settings.json`. Rather
  than extend `@codeyam/cms` to model arbitrary singletons — a fork of a
  dependency this repo only patches for bug fixes — each editable thing becomes a
  collection, which is the surface the package already renders well and which
  `testimonials`, `donors` and `sponsors` already use. It also gives every card
  Draft, Order and per-scenario seeding for free.

- **`homeSections` is `momentumSections` for the homepage.** The reorderable
  Momentum Fund page already proves the pattern: one markdown entry per band,
  `kind` selecting the renderer, `order` moving it, `draft` hiding it, and
  `src/lib/momentumSections.ts` validating `kind` so a typo costs one section
  rather than the deploy. The homepage gets the same model over its thirteen
  bands. Reusing the pattern means the editor-facing explanation in
  `docs/editing-the-site.md` already applies.

- **"Coming soon" is a toggle, not a typed value.** The CMS has no select
  control — `CUSTOM_FIELD_TYPES` stops at
  text/number/textarea/date/image/boolean/list — so a three-state field would
  have to be free text validated in a lib, the way `kind` and `layout` are.
  That is right for a developer-ish value and wrong for an editor who would have
  to type `coming-soon` exactly. Instead the third state is a **`comingSoon`
  boolean beside the existing Draft toggle**: Draft off + coming-soon off =
  shown, coming-soon on = placeholder band, Draft on = gone. Two switches an
  editor can reason about, both backed by controls the package actually ships.

- **Hiding a section hides its menu item.** `src/lib/nav.ts` already derives the
  Chapters and Communities groups from content precisely so a menu entry can
  never outlive what it points at. Section visibility joins that rule, so
  "Hidden" cannot leave a nav link aimed at a band that is not on the page.

- **Production keeps its committed content.** This is an established site, not a
  greenfield one: `src/content/` holds 11 posts, 8 events, 6 chapters and 5 board
  members that are meant to ship. The new collections are seeded from the values
  already in `settings.json` / `donatePage.json` / the component defaults, so the
  migration is invisible on the rendered page — the diff is where the values
  live, not what they say.

- **Google Analytics, the custom head/body HTML, and the sponsor/volunteer page
  copy are deliberately out of scope.** They have the same "data but no input"
  shape and would be the natural follow-up, but none of them blocks the
  migration and each widens this change materially.

## Implementation

### 1. Section visibility — the phased-launch mechanism

**New file**: `src/content/homeSections/*.md` — one entry per homepage band
(`hero`, `stats`, `events`, `chapters`, `focus`, `content-hub`, `board`,
`get-involved`, `giving`, `whatsapp`, `support`, `gallery`, `contact`), each
carrying `kind`, `order`, optional `draft`, optional `comingSoon`.

**File**: `src/content/config.ts` — declare the `homeSections` collection, and
add `comingSoon: z.boolean().optional()` to the collections whose entries are
individually phaseable (`momentumSections`, `homeSections`). Absent means shown,
matching how `draft` already works, so nothing needs migrating.

**File**: `src/data/collections.json` — the editor's view of both: `homeSections`
as a collection with a `Coming soon` toggle, and the same toggle appended to
`momentumSections`. `src/data/collections.test.ts` already pins the two files
against each other, so a field added to one and not the other fails the suite
rather than being discovered by an editor who cannot find the input.

**New file**: `src/lib/homeSections.ts` — the `momentumSections.ts` counterpart:
order the entries, drop an unknown `kind` with a `console.warn`, and resolve each
entry to one of three states. Pure and framework-free, with
`src/lib/homeSections.test.ts` covering shown / coming-soon / hidden, an unknown
kind, and a blank `order`.

**New file**: `src/components/ComingSoon.astro` — the placeholder band: the
section's heading plus one editable line, styled to read as deliberate rather
than broken.

**File**: `src/pages/index.astro` — compose the bands from `homeSections`
instead of the fixed list of thirteen components it hardcodes today.

**File**: `src/lib/nav.ts` — drop nav items whose target is a hidden section,
extending the existing derive-don't-hand-list rule. `src/lib/nav.test.ts` covers
it.

### 2. The copy that is not reachable from `/admin`

**New collections**, each declared in `config.ts` + `collections.json` and seeded
from where the value lives today:

- `heroSlides` — from the hardcoded defaults in
  `src/components/landing/HeroCarousel.astro:33-52`. Fields: image, kicker,
  title, lede, a `ctas` list, order, draft. `index.astro` renders
  `<HeroCarousel />` with no props today, so the defaults are the live content.
- `stats` — from `settings.json`'s `homeStats`. Fields: value, label, order,
  draft.
- `accomplishments` and `pillars` — from `donatePage.json`. `pillars` keeps its
  `icon` as free text validated against the three drawn glyphs, matching how
  `kind` and `layout` are handled.

**File**: `src/data/donatePage.json` — `donateUrl` moves to a `pageCopy` entry so
Nicole can point the Donate button at a real platform herself.
`src/lib/giving.ts` is already built for exactly this switch and needs no change.

**Files**: `src/components/landing/HeroCarousel.astro`,
`src/components/landing/Stats.astro`,
`src/components/donate/MomentumAccomplishments.astro`,
`src/components/donate/GiftPillars.astro` — all four are already prop-driven with
defaults, so each takes its data from the new collection and keeps its default as
the empty-collection fallback. No markup changes.

**File**: `src/lib/site.ts` — drop the `homeStats` / card-array members from the
singleton types as they move out.

### 3. Edits land on review, not on the world

**File**: `src/data/cms.json` — `repo.branch` → `staging`.

As configured today this is a live hazard, not a nicety: at the cutover `main`
becomes `harvardintech.com`, so a CMS save would publish straight to the public
site with no review step.

**Files**: `CMS_SETUP.md`, `docs/nicole-review.md`, `DEPLOY_SETUP.md` — bring
them into line with reality. `CMS_SETUP.md` currently contradicts itself on the
commit branch (`staging` in one paragraph, `main` in another), claims GA is
settable in the CMS when no such input exists, and `DEPLOY_SETUP.md` still shows
the staging-track setup steps 3 and 4 as unchecked although both tracks deployed
green on 2026-08-03.

## Reused existing code

- `momentumSections` end to end — the collection, `src/lib/momentumSections.ts`
  (glossary; test: `src/lib/momentumSections.test.ts`), and its
  free-text-validated-in-a-lib convention. `homeSections` is the same shape
  applied to the homepage.
- `publishedEntries` from `src/lib/drafts.ts` (test: `src/lib/drafts.test.ts`) and
  `resolveIncludeDrafts` from `src/lib/draftVisibility.ts` (test:
  `src/lib/draftVisibility.test.ts`) — the draft rule and the per-track
  visibility switch. `comingSoon` layers on top; neither changes.
- The derive-the-menu-from-content rule in `src/lib/nav.ts` (test:
  `src/lib/nav.test.ts`) — visibility joins the rule that already keeps Chapters
  and Communities honest.
- `resolveGiveHref` from `src/lib/giving.ts` (test: `src/lib/giving.test.ts`) —
  written for the donation-platform switch and reused unchanged.
- `src/data/collections.test.ts` — the two-file contract between `config.ts` and
  `collections.json`; every new field is pinned by it automatically.
- The `content-collection` seed adapter — the new collections are seedable per
  scenario the moment they exist, which is what makes the coming-soon and hidden
  states demonstrable.
- Existing scenarios **Stats Band**, **Hero Carousel**, **CMS Site Settings**,
  **MomentumStats - Campaign Figures** as the before-state for the captures.

**Existing-implementation survey.** Grepped before proposing new files:

- **`comingSoon` / section visibility** — nothing anywhere in `src/`. `draft` is
  the only phasing flag, and it is two-state.
- **`homeSections` / `src/lib/homeSections.ts`** — do not exist.
  `src/pages/index.astro` hardcodes its thirteen bands in source order.
- **`heroSlides`, `stats`, `accomplishments`, `pillars` collections** — do not
  exist. The data lives in `HeroCarousel.astro`'s prop defaults,
  `settings.json:homeStats`, and `donatePage.json` respectively.
- **A settings input for `homeStats` / `googleAnalyticsId`** — none.
  `SETTINGS_FIELDS` in `@codeyam/cms` declares five scalars; unknown keys are
  round-tripped by `extractSettingsExtras` but never rendered.
- **Webinars / Podcasts nav gap** — already closed. `nav.json`'s Programs group
  holds one item, "All Events". `docs/scoping/README.md` items 4 and 13 are stale
  on this point.

## Scenarios to Demonstrate

- **Homepage, launch-ready** — every band shown, the state the world sees at
  cutover.
- **A band set to Coming soon** — the placeholder reading as deliberate, beside
  finished sections.
- **A band Hidden** — the section gone AND its menu item gone with it, which is
  the pair that has to hold.
- **Homepage with corrected stats** — the stat strip driven by the collection
  rather than by `settings.json`, proving the figures are now hers.
- **Hero with one slide vs. three** — the carousel driven by content, including
  the single-slide case where there is nothing to rotate.
- **Momentum Fund cards edited** — accomplishment and pillar text changed from
  the CMS.
- **Donate with the email fallback vs. a real platform URL** — the switch
  `resolveGiveHref` was written for, finally reachable from `/admin`.
- **Empty state** — no testimonials, no donors, only example sponsors. The
  launch-day default, and what a visitor most likely sees on day one.
---
title: "ne -- Donor Recognition Wall"
mode: ui
createdAt: "2026-07-31T15:23:53Z"
prefix: "ne"
source: manual
dependsOn: ["ne--momentum-fund-page-analytics-layout-and-editable-sections"]
---

## Summary

Nicole asked for donor recognition: "in addition to awarding founding donor badges, we would
also like to list donors on our website in a creative and interactive way." Nothing like this
exists — the repo has no donor concept at all (the only "donor" hit anywhere is a Donorbox
mention in the review to-dos), and `/donate` ends at the closing CTA. This plan adds a
`donors` content collection an editor manages in the CMS, a `Donor Recognition` wall on the
Momentum Fund page grouped by giving tier with a distinct Founding Donor badge, and light
interactivity — tier filter chips and a card that reveals the donor's note — that degrades to
a plain readable list with JavaScript off. Because production starts with zero donors, the
empty state is the default view and is designed as such, the same way the sponsor wall and the
volunteer grid already are.

## Key Decisions

- **Donors are a collection, not a JSON list.** One markdown entry per donor means Nicole adds
  a donor in /admin with the workflow she already uses for chapters and sponsors, and the
  Draft toggle holds an entry back until the gift clears.
- **Tiers reuse the sponsor-wall model exactly.** A donor's `tier` matches the `id` of a tier
  declared in `donatePage.json`, an unmatched or untagged donor collects in a trailing group
  rather than vanishing, and within a tier the order is the site-wide `order`-then-name rule.
  `groupSponsorsByLevel` already encodes all of that — the donor grouping is its sibling, not
  a new invention.
- **Founding Donor is a badge, not a tier.** Nicole treats them separately ("in addition to
  awarding founding donor badges"). A boolean `founding` flag renders the badge on whichever
  tier the donor sits in, so a founding donor is not forced into a giving level that
  misstates their gift.
- **Anonymity is first-class.** An `anonymous` flag renders "Anonymous donor" while keeping
  the real name in the entry for the team's records. Publishing a name someone asked to
  withhold is the one failure mode of a donor wall that cannot be undone by an edit, so it is
  built in rather than handled by convention.
- **Interactive means CSS-first.** Filter chips and note reveal are a ~30-line vanilla module
  in the `src/lib/gallery.ts` / `src/lib/parallax.ts` mould (pure predicate + tiny init), not
  a hydrated island. Every donor's name is in the static HTML, so the wall is complete for
  search engines, screen readers, and no-JS visitors.
- **It lands as a Momentum Fund section.** The wall is a `kind: donors` entry in the
  `momentumSections` collection this plan's prerequisite introduces — so Nicole can move it up
  or down the page or hide it herself, which is exactly the control she asked about in the same
  round of feedback. Hence the dependency on the Momentum Fund page plan.

## Implementation

### 1. The `donors` collection

**File**: `src/content/config.ts`

A `donors` collection loaded with the same `glob({ base: `${root}/donors` })` pattern:

- `name` (required), `tier` (optional, matches a tier `id`), `founding` (optional boolean),
  `anonymous` (optional boolean), `note` (optional short line shown on reveal), `url`
  (optional, e.g. LinkedIn), `photo` (optional), `order` (optional), `draft` (optional).
  The markdown body is an optional longer thank-you the card can expand into.

**File**: `src/data/collections.json`

Register it for the CMS — `label: "Donors"`, `singular: "Donor"` — with hints that carry the
rules the free-text field types cannot: `tier` ("Matches a giving tier id on the Momentum Fund
page"), `anonymous` ("Hides the name on the site; the entry keeps it for our records"),
`founding` ("Shows the Founding Donor badge").

### 2. Tier + copy declarations

**File**: `src/data/donatePage.json` and `DonatePageCopy` in `src/lib/site.ts`

Add `donorsTitle`, `donorsIntro`, `donorsEmptyMessage`, and `donorTiers` — `{ id, name,
description? }`, mirroring `sponsorPage.json`'s `levels`. Seed with a starting ladder
(e.g. Founding Circle / Sustaining / Supporting) that the team can rename without a code
change, since the ids are what donors match on.

### 3. Grouping + display rules

**New file**: `src/lib/donors.ts`

Pure and framework-free, modelled directly on `src/lib/sponsors.ts`:

- `groupDonorsByTier(donors, tiers)` — declared tiers in declaration order, unmatched/untagged
  donors in a trailing group, `order`-then-name within a group, empty groups omitted.
- `donorDisplayName(donor)` — `"Anonymous donor"` when `anonymous`, otherwise the name.
- `foundingDonors(donors)` — the badge-holders, for the count in the section intro.
- `matchesTier(donor, tierId)` — the predicate the filter chips use, shared by the server
  render and the client script so the two cannot disagree.

**New file**: `src/lib/donors.test.ts` — grouping order, unmatched-tier fallback, anonymity
(including that `anonymous` wins over a `url` link — an anonymous donor must not be
identifiable through their link), founding filter, empty input.

### 4. The wall

**New files**: `src/components/donate/DonorWall.astro`, `DonorCard.astro`,
`DonorWallEmpty.astro`, `FoundingBadge.astro`

- `DonorWall` — heading, intro, filter chips (All + one per tier that has donors), then the
  grouped bands. Renders `DonorWallEmpty` when there are no published donors.
- `DonorCard` — name (or "Anonymous donor"), tier label, optional photo/monogram initial
  reusing the `initials` helper, the Founding badge when flagged, and the note revealed on
  hover/focus/tap. A donor with a `url` links out (never when anonymous).
- `DonorWallEmpty` — the production default: `donorsEmptyMessage` plus the existing
  `GiveButton`, so the band reads as an invitation rather than a gap.
- `FoundingBadge` — small crimson badge, `title`/`aria-label` explaining what it means; not
  colour-alone.

**New file**: `src/lib/donorFilter.ts` + `src/lib/donorFilter.test.ts` — `initDonorFilter()`
in the shape of `initGalleryReveal`: no-ops when the section is absent, toggles `hidden` on
cards by tier, keeps chips `aria-pressed`, and leaves everything visible if it never runs.

### 5. Put it on the page

**New file**: `src/content/momentumSections/donors.md` — `kind: donors`, ordered after
`testimonials`, before the closing CTA.

**File**: `src/components/MomentumFundPage.astro` — add `donors` to the `kind` → renderer map
and accept the donor list as a prop.

**File**: `src/pages/donate.astro` — load the `donors` collection with `publishedEntries(…,
INCLUDE_DRAFTS)` and group it with `groupDonorsByTier`.

### 6. Scenario states

**File**: `src/pages/isolated-components/[name].astro` — register `DonorWall`, `DonorCard`,
`DonorWallEmpty`, and `FoundingBadge` states so each renders in isolation, including the
empty default and a long realistic wall.

## Reused existing code

- `groupSponsorsByLevel` and `hasPlaceholderSponsors` in `src/lib/sponsors.ts` (glossary
  entries: `groupSponsorsByLevel`, `hasPlaceholderSponsors`) — the tier-grouping rules,
  unmatched-tier tolerance, and the empty-band convention are lifted from here.
- `sortByOrder` / `byOrder` from `src/lib/order.ts` (glossary entries: `sortByOrder`, `byOrder`).
- `publishedEntries` + `INCLUDE_DRAFTS` (glossary entries: `publishedEntries`, `INCLUDE_DRAFTS`).
- `initials` from `src/lib/team.ts` (glossary entry: `initials`) — the photo-less monogram,
  already used by `BoardMemberCard`.
- `initGalleryReveal` / `galleryStaggerDelay` in `src/lib/gallery.ts` (glossary entries:
  `initGalleryReveal`, `galleryStaggerDelay`) — the progressive-enhancement pattern the filter
  script follows.
- `GiveButton` (`src/components/donate/GiveButton.astro`) and `resolveGiveHref`
  (`src/lib/giving.ts`, glossary entry: `resolveGiveHref`) — the empty state's CTA, still
  correct while there is no donation platform.
- `SponsorWall` (`src/components/sponsor/…`) and its scenarios
  (`sponsorwall-no-partners-yet`, `sponsorwall-real-partners`) as the visual and
  empty-state-first precedent.
- `altFor` from `src/lib/media.ts` (glossary entry: `altFor`) for donor photos.

**Existing-implementation survey.** Grepped the repo for any donor/recognition/badge
implementation before proposing one: none exists — no `donors` collection, no donor component,
no badge component, and no `founding` field anywhere. The only nearby thing is the sponsor
wall, which is a *different* audience (organizations, logos, partnership levels) and stays
separate; this plan reuses its rules rather than overloading it.

## Scenarios to Demonstrate

- Donor wall empty — the production default, reading as an invitation with the Give CTA.
- A first Founding Donor only: one badge, one tier, no filter chips worth showing.
- A rich wall: three tiers, ~20 donors, several Founding badges, mixed photos and monograms.
- An anonymous donor beside named ones — name withheld, tier and badge still shown, no link.
- A donor whose `tier` matches no declared tier → visible in the trailing group, not dropped.
- Filter chips in use: one tier selected, others hidden, `aria-pressed` correct.
- Note reveal on hover/focus, and the same card with JS off — note present, nothing broken.
- The Momentum Fund page end-to-end with the wall between testimonials and the closing CTA,
  and the same page with the wall moved above testimonials by an Order edit.
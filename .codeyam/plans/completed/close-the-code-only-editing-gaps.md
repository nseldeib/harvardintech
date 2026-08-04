---
title: "Close the Code-Only Editing Gaps"
mode: ui
createdAt: "2026-08-03T23:29:58Z"
source: manual
---

## Summary

Four things on this site are data with nowhere to edit them. Nicole can change
the sponsor *entries* but not the sponsorship page's headline or its partnership
levels; she can change the Momentum Fund's middle sections but not the photo
header above them or the closing ask below; she can type a Bio into every board
member's entry and it appears nowhere on the site; and the Google Analytics ID
and verification-tag boxes sit in a settings file the editor renders no inputs
for.

Each is the same shape, and it is a shape this repo has already solved once. The
`launch-ready-editing` cycle moved the accomplishment cards, the gift pillars,
and the donation URL out of `donatePage.json` into content collections, then
grafted them back onto the copy object in the route so every component below kept
the exact props it always took. That plan named these four as the deliberate
follow-up:

> **Google Analytics, the custom head/body HTML, and the sponsor/volunteer page
> copy are deliberately out of scope.** They have the same "data but no input"
> shape and would be the natural follow-up.

This is that follow-up. When it lands there is nothing left on the list of
"ask the team to change this" except the site's colors, fonts, and layout.

## Key Decisions

- **Migrate the values, not the components.** Every loader returns the shape the
  consuming component already takes, and the route grafts it onto the same `copy`
  object. `MomentumFundPage`, `VolunteerPage`, `SponsorPage` and their children
  are untouched below the route. The diff is where the values live, not what
  they say or how they render — so the rendered page is byte-identical on the
  first commit and every existing scenario still passes.

- **Keep the JSON singletons as the fallback.** `loadDonateUrl(fallback)` already
  establishes this: the collection wins, the committed JSON backs it up. That is
  what makes a single-entry collection safe. If an editor deletes the only
  "Volunteer page" entry — which the CMS lets her do, since it has no notion of a
  required singleton — the page renders the committed copy rather than a blank
  hero. The alternative (a build-time error on a missing entry) turns an ordinary
  editing mistake into a broken deploy.

- **Sponsorship levels become their own collection.** A level carries
  `benefits: string[]` *inside* the list of levels, and the CMS supports a
  repeatable list of scalars at top level only — a list inside a list is not
  expressible. One entry per level makes `benefits` a top-level list and matches
  the shape Nicole already uses for pillars and accomplishments. A level's `id`
  stays the stable key a sponsor's `tier` matches on, so renaming a level is a
  copy edit and changing its `id` re-homes its sponsors — the rule
  `sponsorPage.json` already documents.

- **One collection per page, not one shared "Page settings".** The CMS renders
  every declared field for every entry in a collection, so folding volunteer,
  sponsor, and analytics fields into the existing `pageCopy` collection would show
  Nicole the sponsorship headline while she edits the volunteer page. Separate
  single-entry collections cost a few more sidebar rows and keep each screen
  showing only its own page's fields. This applies to the analytics keys too:
  they get their own `siteIntegrations` collection rather than riding along on
  `pageCopy`, which stays exactly what its name says — the Momentum Fund page's
  settings, and nothing else's.

- **The Momentum Fund frame joins `pageCopy`, and stays out of the reorderable
  middle.** `MomentumFundPage` deliberately fixes the hero and the closing CTA
  as a frame around the sections an editor can drag: "a page whose hero could be
  dragged to the bottom is a page an editor can break." Making the frame's *copy*
  editable does not change that — it stays a frame, it just stops being a code
  change. The donate `pageCopy` entry already exists and already holds the
  donation URL, so the frame's fields belong on it.

- **Bios render on the board that ships.** `BoardMemberCard.astro` looks like the
  board card and has its own scenarios, but nothing on the site renders it — the
  live board inlines its own markup in `BoardOfDirectors.astro`. Bios go into the
  component that actually ships. The orphan is surfaced in the journal rather
  than silently left as a second, diverging implementation.

- **A bio is optional and usually absent.** All five directors have `bio: ''`
  today and production starts empty, so "no bio" is the default rendering, not an
  edge case. The grid must look deliberate with zero bios, with two of five, and
  with five long ones — that is three of this feature's scenarios.

## Implementation

### 1. Volunteer page copy

**New**: `src/content/volunteerPage/volunteer.md` — the current contents of
`src/data/volunteerPage.json` as frontmatter, `benefits` as a list of
`{title, body}` rows.

**New**: `src/lib/volunteerPageContent.ts` — `loadVolunteerCopy(fallback)`,
returning `VolunteerPageCopy`. The `donatePageContent.ts` split: the thin
`astro:content` edge, kept out of the components.

**File**: `src/content/config.ts` — declare the collection.
**File**: `src/data/collections.json` — the editor's view of it.
**File**: `src/pages/volunteer.astro`, `src/pages/volunteer/projects/[slug].astro`
— load from content, fall back to the singleton.

### 2. Sponsorship page copy and levels

**New**: `src/content/sponsorPage/sponsor.md` — headline, intro, hero image, the
wall and inquiry copy, the disclaimer.
**New**: `src/content/sponsorLevels/{presenting,chapter,event,community}.md` —
one entry per level, `benefits` a top-level list, `order` for the wall's
top-down reading order.

**New**: `src/lib/sponsorPageContent.ts` — `loadSponsorCopy(fallback)` and
`loadSponsorLevels(fallback)`, the second re-attaching levels to the copy object
so `groupSponsorsByLevel` and `hasPlaceholderSponsors` keep their exact inputs.

**File**: `src/content/config.ts`, `src/data/collections.json`,
`src/pages/sponsor.astro`.

### 3. Analytics and the custom head/body HTML

**New**: `src/content/siteIntegrations/site.md` — `googleAnalyticsId`,
`customHeadHtml`, `customBodyHtml`, seeded from `settings.json`'s current values
(the real GA4 id ships today — this migration must not turn analytics off).

**File**: `src/content/config.ts`, `src/data/collections.json` — declare it as
its own single-entry collection rather than folding the three keys onto
`pageCopy`. Same reason the volunteer and sponsor pages get their own
collections: the CMS renders every declared field for every entry, so a shared
`pageCopy` would put a Google Analytics box on the Momentum Fund page's editing
screen and a hero headline on the integrations screen. Keeping them apart is
what makes each screen show only its own fields.

**New**: `src/lib/integrationsContent.ts` — `loadIntegrations(fallback)`, with
`settings.json` as the fallback so a deleted entry cannot silently unhook
analytics from every page.

**File**: `src/components/Analytics.astro`, `src/components/HeadExtras.astro`,
and the two shells that inject `customBodyHtml` before `</body>`. These are
components rather than routes, so they read the collection in their own
frontmatter — Astro allows top-level await there.

The raw-HTML boxes stay the power-user escape hatch they are documented to be:
the snippet runs on every page, so the field hint has to say so.

### 4. The Momentum Fund frame

**File**: `src/content/pageCopy/donate.md` — add the hero headline (named +
generic), subhead, hero image, and the closing band's title, body, and CTA label
alongside the `donateUrl` it already carries.
**File**: `src/lib/donatePageContent.ts` — extend to return the frame,
same graft.
**File**: `src/pages/donate.astro` — no component below it changes.

### 5. Board bios

**File**: `src/components/landing/BoardOfDirectors.astro` — render `member.bio`
under the role. No schema change and no `collections.json` change: `bio` is
already in the `team` Zod schema and already an input on the built-in team
editor. This is a display change only.

**File**: `src/content/team/*.md` — the five directors keep `bio: ''`; the empty
rendering is the state that ships.

### 6. Tests

**File**: `src/data/collections.test.ts` — the existing contract (every field the
editor renders is a real schema key, in both directions) extends to the three new
collections and the widened `pageCopy`. This is what catches a field added to one
file and not the other.

**File**: `src/lib/site.test.ts` — the singletons keep loading from the data root
and these tests keep passing; they now describe the fallback rather than the
primary source.

**New**: `src/lib/volunteerPageContent.test.ts`,
`src/lib/sponsorPageContent.test.ts`, `src/lib/integrationsContent.test.ts` —
each covering the entry-present case, the entry-absent fallback, and the
blank-field fallback.

## Scenarios

Production starts empty, so several of these are the default view rather than an
edge case.

- **Board of Directors** — no bios (today's state), two of five with bios, all
  five with long bios. The mixed state is where the grid breaks.
- **Volunteer page** — copy edited from /admin, and the entry-deleted fallback.
- **Sponsorship levels** — the four levels from content, and a level renamed
  from /admin to prove the `id` keeps its sponsors.
- **Momentum Fund frame** — an edited hero headline and closing band.
- **/admin screens** — the new Volunteer page, Sponsorship page, Sponsorship
  levels, and Site integrations editors, so "Nicole can edit this now" is a thing
  you can look at rather than a claim.
---
title: "Confirm Every Collection Is Fully Editable In The CMS"
mode: ui
createdAt: "2026-08-19T19:58:56Z"
source: manual
---

## Summary

Confirm that every piece of content on harvardintech.com is editable, viewable,
and findable in the CMS — and fix the places where it is not — before upgrading
`@codeyam/cms` from 0.7.1 to 0.9.0. The upgrade is deliberately NOT in this plan:
auditing first gives the upgrade a clean, known-good baseline to diff against,
which is what the 0.7.0 upgrade lacked when it silently dropped three collections.

Three strands, one pass:

1. **Spot-check the nine completed `ns--` plans** so "done" means the feature
   still works, not that a file sits in `completed/`.
2. **Close the content-coverage gaps** the exploration found — real copy that is
   live on the site and that only a developer can change.
3. **Correct the documentation** that tells an editor the wrong thing about
   which of those two categories a given piece of copy is in.

## What the audit already found

The field-level story is **stronger than expected**. `src/data/collections.test.ts`
already asserts, for every registered collection, that every key in the Zod schema
has an editor input and that every declared editor field is a real schema key —
in both directions. `EXEMPT_SCHEMA_KEYS` is `{}`, so there are zero escapes. All
21 content collections are reachable in /admin (20 registered + `pages` as a CMS
builtin). **Nothing needs building there, and this plan must not rebuild that guard.**

The hole is one the existing test cannot see, because it only compares
*collections* against *schemas*. The site also reads three JSON singletons —
`donatePage.json`, `volunteerPage.json`, `sponsorPage.json` — through
`readSingleton()` in `src/lib/site.ts`. `src/lib/pageCopyMerge.ts` merges a CMS
entry over the JSON, so the JSON is the fallback and the collection is the
override. That merge is sound and stays. But a JSON key with **no corresponding
CMS field** is copy an editor can never reach, and no test looks for it.

Diffing the three singletons against the registry:

- `volunteerPage.json` — **fully covered.** Every key has a CMS field.
- `sponsorPage.json` — covered except `levels`, which correctly moved into the
  `sponsorLevels` collection. Confirm the JSON copy is dead weight, then remove it.
- `donatePage.json` — **15 keys with no CMS field.** Several migrated correctly
  into their own collections (`accomplishments`, `pillars`, `stats`) and their
  leftover JSON is stale fallback. The rest is live, developer-only copy:
  `donorsTitle`, `donorsIntro`, `donorsEmptyMessage`, `donorTiers`,
  `networkTitle`, `networkTagline`, `networkSearchTitle`, `shareMessage`,
  `campaignName`. The Momentum Network band — the newest work on the page —
  shipped its entire copy surface as code-only.

## Key Decisions

- **Audit before upgrade, as the user chose.** Landing the 0.9.0 upgrade on top
  of unknown coverage means any collection it drops looks the same as a gap that
  was always there. Fix the baseline, then upgrade against it.

- **Classify each uncovered key before touching it.** A key with no CMS field is
  one of two very different things: *stale fallback* whose real home is now a
  collection (delete it) or *live code-only copy* (give it a field). Guessing
  costs an editor a field that does nothing, or a deletion that blanks a heading.
  Each of the 15 gets traced to what actually renders it.

- **Extend the guard to the singletons.** The reason this gap survived is that
  the parity test compares collections to schemas and nothing compares the JSON
  singletons to the registry. A third direction — every key in a merged singleton
  either has a CMS field or is explicitly recorded as retired — is what stops the
  next feature from shipping code-only copy. Extraction of the comparison helpers
  out of the test file (they are defined inside the test today, so nothing else
  can use them) happens at Deconstruct.

- **Documentation is part of the deliverable, not a footnote.** The site-editing
  guide has a "Still code-only" list that is wrong in both directions: it tells
  Nicole the sponsorship and volunteer page copy are code-only when both are fully
  editable today, and it omits the donor-wall and Momentum Network copy that
  genuinely is. A wrong list is worse than no list — she would ask the team for an
  edit she can already make herself, and never think to ask for the one she can't.

- **Report, do not silently repair, a half-landed plan.** If a spot-check finds a
  plan that did not fully land, that is a finding to surface, not scope to absorb.

## Scope

**In:** the coverage audit and its fixes; the spot-checks; the guard extension;
the documentation correction.

**Out:** the 0.9.0 upgrade and the fate of the 849-line reorder-arrows patch —
a separate pass, immediately after this one.

## Data states / scenarios

Production starts empty, as always; each scenario carries its own seed.

- **Empty** — the admin dashboard and a collection list with no entries: day one.
- **Sparse** — a collection with two or three entries: the list and the editor.
- **Rich** — enough entries to exercise search, the draft/published split, and
  the reorder arrows.
- **Edge** — an entry with every optional field blank (the "missing optional
  frontmatter" case the schemas were written for), and one with a very long title
  against the list layout.
- **The gap made visible** — the Momentum Fund page-settings editor showing the
  donor-wall and Momentum Network fields that do not exist there today.
---
title: "NS -- Fix The Stale Editing Notes On The Momentum Fund Section Entries"
mode: ui
createdAt: "2026-08-17T21:30:19Z"
prefix: "NS"
source: manual
---

## Summary

The notes inside the `momentumSections` entries tell an editor where to go to
edit each band's content, and three of them now name a screen that does not
exist. `pillars.md`, `accomplishments.md`, and `donors.md` all say the content is
edited under "Settings → Momentum Fund page copy". The pillar cards and the
accomplishment figures have since moved into their own collections, the
`pageCopy` collection is labelled **Page settings** in the CMS (not "Momentum
Fund page copy"), and the admin dashboard groups collections **by page** rather
than under a Settings menu — so the instruction is wrong about the content, wrong
about the screen name, and wrong about the navigation. It is also authoritative-
looking prose an editor has every reason to trust, which is what makes it worse
than no note. Rewrite the four notes to describe where each band's content
actually lives, and add a drift guard so the next migration cannot quietly leave
them stale again.

## Key Decisions

- **Fix all four entries in one pass, not just `pillars.md`.** They are one
  concern — the same sentence pattern, written at the same time, made wrong by
  the same migration. Fixing the one that was noticed and leaving two identically
  wrong notes beside it would be the worse outcome, and a reviewer looking at one
  diff would want the others in it.

- **Add a test, because prose is exactly what rots unnoticed.** Nothing today
  connects these notes to the registry they describe, so the CMS migration that
  invalidated them broke no build and failed no test. The guard is the same
  species as `src/lib/collectionPlacement.test.ts`, which exists for the same
  reason in the same repo: hand-maintained config that mirrors something else,
  and an editor who gets sent somewhere wrong by a link that looks authoritative.

- **Guard the screen NAME, not the whole sentence.** The test resolves every CMS
  screen a note names against the real `label` values in
  `src/data/collections.json`. That is the part that is machine-checkable and the
  part that actually went wrong; asserting on the prose itself would fail on
  every future wording change and teach the next author to delete the test.

- **Say plainly which fields the CMS cannot reach.** The donor wall's intro,
  giving levels, and empty-state message are still keys in
  `src/data/donatePage.json` with no editor input anywhere — the CMS `pageCopy`
  collection renders ten fields and none of them are these. A note that quietly
  omitted that would send an editor hunting for a control that does not exist, so
  each note names the developer-only fields explicitly.

- **Tell editors the heading is now the section's own field.** Since the bands
  started using `sectionHeading`, the Heading box on the section entry overrides
  the shared title from `donatePage.json` — which is precisely the control an
  editor needs to tell two duplicated bands apart, and none of the four notes
  mentions it. This is the one place the rewrite adds guidance rather than just
  correcting it, and it is worth it: the notes are read at the exact moment that
  question comes up.

- **Do not widen this into making the developer-only fields editable.** Adding
  `donorsIntro`, `donorTiers`, and `donorsEmptyMessage` to the CMS is a real gap
  and a reasonable next plan, but it is a schema-and-registry change with its own
  migration, and bundling it would hold a four-file text correction behind it.

## Implementation

### 1. The pillars band note

**File**: `src/content/momentumSections/pillars.md`

Rewrite the body (frontmatter untouched). It should say that the cards are edited
in the **Momentum Fund gift pillars** collection — grouped under `/donate` on the
admin dashboard — that this entry decides where the band sits and, via its
Heading field, what the band is called, and that **Card group** here plus
**Group** on each card is what makes a duplicated band show different cards.
Blank on both sides shows the ungrouped cards, which is how the band reads today.

### 2. The accomplishments band note

**File**: `src/content/momentumSections/accomplishments.md`

Same correction: the figures are entries in the **Momentum Fund accomplishments**
collection, not page copy. The heading comes from this entry's Heading field,
falling back to `accomplishmentsTitle` in `src/data/donatePage.json` when blank.
Card grouping works exactly as it does for pillars.

### 3. The donor wall note

**File**: `src/content/momentumSections/donors.md`

The names come from the **Donors** collection and the heading from this entry's
Heading field. The intro, the giving levels, and the "no donors yet" message are
**not editable in the CMS** — they are `donorsIntro`, `donorTiers`, and
`donorsEmptyMessage` in `src/data/donatePage.json`, which needs a developer. Say
so directly; that is the whole value of this note.

### 4. The testimonials band note

**File**: `src/content/momentumSections/testimonials.md`

Not wrong today, but incomplete in the same way: add that the heading comes from
this entry's Heading field (falling back to `testimonialsTitle`), so all four
notes describe the same controls consistently. Keep the existing, accurate
sentence about the band hiding itself until a quote exists.

### 5. The drift guard

**New file**: `src/lib/sectionNotes.test.ts`

A standalone test file with no module beside it, exactly like
`src/lib/collectionPlacement.test.ts`. It reads the `momentumSections` entry
files and `src/data/collections.json` from disk with `node:fs` and asserts that
every CMS screen the notes name is a real collection label.

- Build the set of valid screen names from `collections.json` — every
  collection label, plus the built-in screen names an entry might sensibly
  reference.
- Scan each entry body for screen references. Match the **bolded / quoted screen
  name** form the rewritten notes use, so the check keys on the deliberate
  reference rather than on any capitalised phrase in ordinary prose.
- Assert the set of unresolved names is empty, reporting the entry filename
  alongside each so a failure names the file to fix.

Keep the file's header comment in the style of `collectionPlacement.test.ts`:
what rots, why nothing else catches it, and that this test is the reminder.

## Reused existing code

- `src/lib/collectionPlacement.test.ts` — the model for step 5 in every respect:
  a test-only file with no module, reading `src/data/collections.json` via
  `node:fs`, guarding hand-maintained config that mirrors something else, with a
  header comment naming the rot it exists to catch.
- `src/data/collections.json` — the registry whose the label values
  carry the authority for what a CMS screen is called. The three labels this plan
  turns on: **Page settings** (`pageCopy`), **Momentum Fund gift pillars**
  (`pillars`), and **Momentum Fund accomplishments** (`accomplishments`).
- `src/data/donatePage.json` — where `accomplishmentsTitle`, `pillarsTitle`,
  `testimonialsTitle`, `donorsTitle`, `donorsIntro`, `donorTiers`, and
  `donorsEmptyMessage` actually live; the notes cite it as the developer-only
  fallback.
- `sectionHeading` from `src/lib/momentumSections.ts` (glossary entry:
  `sectionHeading`) — the rule the corrected notes describe: the section's own
  Heading wins, the shared title is the fallback.
- `cardsInGroup` and `normalizeGroup` from `src/lib/sectionGroups.ts` (glossary
  entries: `cardsInGroup`, `normalizeGroup`) — the grouping rule the pillars and
  accomplishments notes describe, including that blank matches blank and that
  matching is trimmed and case-insensitive.
- `src/lib/dashboardGrouping.test.ts` — confirms the dashboard groups collections
  by the page they build (`paths` maps `pillars`, `accomplishments`, `donors`,
  and `pageCopy` to `/donate`), which is why the corrected notes say "grouped
  under /donate" rather than "under Settings".

**Existing-implementation survey.** Grepped for an existing guard over these
notes before proposing one: `grep -rn "Momentum Fund page copy" src/` returns the
three stale entry bodies and **nothing else** — no test, no doc, no lint rule
references the phrase, which is why the migration that invalidated it was silent.
No existing test reads `src/content/momentumSections/` at all. The nearest
existing guards are `src/lib/collectionPlacement.test.ts` (registry `paths` vs
real routes) and `src/data/collections.test.ts` (registry fields vs Zod schema);
both guard registry-against-code, and neither looks at content prose. There is no
existing helper for resolving a screen name to a collection label to reuse.

## Reproduction Test

Pins the stale guidance: an entry note naming a CMS screen that does not exist.

**Target**: `src/lib/sectionNotes.test.ts` (new) — created by step 5, run with
`codeyam-editor editor refresh-tests --test sectionNotes`.

```ts
// Every CMS screen these notes name must be a real collection in the registry —
// the editor is being sent somewhere, and it has to exist.
it('names only CMS screens that exist in the registry', () => {
  expect(unresolvedScreenReferences()).toEqual([]);
});
```

Status: PROPOSED — confirm red at execution. Expected failure: three entries
(`pillars.md`, `accomplishments.md`, `donors.md`) name "Momentum Fund page copy",
which matches no collection label in `src/data/collections.json` — the pageCopy
collection is labelled "Page settings" — so the array is non-empty and the
`toEqual([])` assertion fails, listing the three filenames.

Note for execution: the helper and its reference-matching shape are written as
part of step 5, so confirming the red means writing the scanner against the
CURRENT (stale) bodies first, watching it report the three files, and only then
rewriting the notes in steps 1–4 to turn it green.

## Scenarios to Demonstrate

- **The CMS sections list** — the `momentumSections` entries showing their
  corrected notes, which is where an editor actually reads them.
- **The pillars section entry** — its note in the editor, naming the Momentum
  Fund gift pillars collection and explaining the Card group pairing, next to the
  Card group field it describes.
- **The donor wall entry** — its note naming the three fields that need a
  developer, so the limitation is visible at the point of confusion.
- **A duplicated pillars band** — the two-band state that prompted this, with the
  note that now explains how to make the second band distinct.
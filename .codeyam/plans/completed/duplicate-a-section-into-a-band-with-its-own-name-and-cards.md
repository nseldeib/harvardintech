---
title: "Duplicate A Section Into A Band With Its Own Name And Cards"
mode: ui
createdAt: "2026-08-13T21:31:14Z"
source: manual
dependsOn: ["live-givebutter-goal-meter-on-the-momentum-fund-page"]
---

## Summary

Let an editor duplicate a Momentum Fund section in /admin and end up with a
genuinely distinct band — not a verbatim second copy. Three parts, one outcome:
a **Duplicate** action on every CMS entry row that opens the create form
prefilled from the source entry (so renaming happens before the copy exists);
a per-section **heading** that names the band both in the CMS list and on the
page, so two `pillars` rows are distinguishable at a glance; and a **group**
tag on the card collections so each band shows its own cards. Without the third
part the first two produce "What Your Support Powers" and "How Your Support Will
Be Used" rendering the identical three cards — `loadPillars()` returns every
pillar entry to every `pillars` band today.

## Key Decisions

- **Duplicate opens the prefilled create form; it does not silently clone.**
  The action is a link to `/admin/new/<collection>?from=<slug>` with every field,
  the body, and a free slug (`pillars` → `pillars-2`) already filled in. That
  answers "rename a duplicated section" directly — the rename happens in the
  form, before the file exists, rather than as a second edit afterwards — and it
  reuses the create form's existing slug-collision check, required-field gate,
  and staging path instead of inventing a parallel one.
- **Duplicate is offered on every collection, not just sections.** It lives in
  the shared entry-row action cluster, so it works for pillar cards, blog posts,
  and events too. Gating it to one collection would cost extra code to make the
  feature smaller. Preview rows are the one exclusion: they already carry their
  own action set, and copying a preview's `previewOf` marker would mint a second
  unlisted clone.
- **The CMS changes go through the existing `patch-package` patch.** `@codeyam/cms`
  is an npm dependency, and this repo already carries a 534-line patch against it
  for the reorder arrows — including one added file (`OrderArrows.tsx`). The
  Duplicate action follows the same route, and its pure logic is unit-tested from
  this repo by importing `@codeyam/cms/lib/…`, the convention
  `src/lib/mediaCommitGuard.test.ts` and `src/lib/dashboardGrouping.test.ts`
  already establish for pinning a dependency's contract.
- **One field names the band in both places.** `momentumSections` already
  declares `title`, and the CMS already uses it as the row label (falling back to
  the slug — which is why the card bands read as bare "pillars" / "accomplishments"
  in /admin today). So the fix is not a new field: it is letting the slot bands
  USE the title they can already carry, as the row label and as the band's
  on-page heading, falling back to the shared copy heading when blank. Two
  fields — one for the CMS list, one for the page — would let them disagree.
- **Cards are assigned to a band by a free-text group, matched blank-to-blank.**
  A section with no group shows the cards with no group, which is exactly the
  page as it renders today — so this ships with zero content migration and no
  visual change until an editor deliberately splits the cards. A section naming a
  group shows that group's cards.
- **Group is free text, like `kind` and `layout` before it.** Groups are invented
  by the editor as they split a band, so there is no fixed list a `select` could
  offer. The site validates instead of the schema: a group matching no card
  renders an empty band and logs a build-time advisory, the same treatment
  `/donate` already gives an unrecognized `kind`.
- **Sequenced behind the goal-meter plan.** Both plans edit
  `src/lib/momentumSections.ts`, `src/content/config.ts`,
  `src/data/collections.json`, and `src/components/MomentumFundPage.astro` in
  adjacent places. The overlap is mechanical, not semantic, but running them in
  order avoids a conflict for no cost — hence `dependsOn`.

## Implementation

### 1. The Duplicate action (CMS patch)

**File**: `patches/@codeyam+cms+0.5.0.patch`

Every change below is made under `node_modules/@codeyam/cms/`, then captured
with `npx patch-package @codeyam/cms`, exactly as the reorder-arrows work was.
The patch touches the files below. They live inside the dependency, not in this
repo's own `src/` — edit them in place under `node_modules/`, then regenerate the
patch:

- **`node_modules/@codeyam/cms/src/lib/entryDuplicate.ts`** (new file, added by
  the patch alongside the existing added `OrderArrows.tsx`). Pure helpers: `nextFreeSlug(slug, existingSlugs)`
  producing `pillars-2`, then `pillars-3` (never colliding, never re-using a
  slug already staged); `duplicateLabel(label)` appending a "(copy)" suffix the
  editor is expected to replace; and `duplicateValues(fields, data)`, which
  copies every field verbatim except the preview marker `previewOf`.
- **`node_modules/@codeyam/cms/src/components/admin/EntryRowActions.tsx`** — a "Duplicate" control in the
  DEFAULT action state, beside Edit. An anchor, not a staged action, for the
  same reason Edit is one: it navigates to the create form and leaves no trace
  in the pending-changes store. Absent on preview rows.
- **`node_modules/@codeyam/cms/src/components/admin/EntryRow.tsx`** — builds the
  Duplicate href from the row's collection and slug.
- **the dynamic-collection route under
  `node_modules/@codeyam/cms/src/pages/admin/new/`** (the bracketed `collection`
  param) — reads `?from=<slug>`, loads that
  entry's raw markdown, parses it with the existing `frontmatter` helpers, and
  hands the values, body, and suggested slug to the editor island. An unknown or
  missing `from` falls back to the ordinary blank create form rather than
  erroring — a stale bookmark must not be a dead end.
- **`node_modules/@codeyam/cms/src/components/admin/NewEntryEditor.tsx`** — accept optional
  `initialValues` / `initialBody` / `initialSlug` props, defaulting to today's
  `emptyFieldValues` behaviour. Note `hasAnyInput` already returns true for a
  prefilled form, which is what makes the required-field errors show
  immediately — correct here, since the form is not untouched.

Duplicating an ordered entry copies its `order` verbatim; the list's existing
label tiebreak keeps the pair stable, and the reorder arrows move the copy. That
is deliberately simpler than guessing where the duplicate belongs.

### 2. Name the band once, use it twice

**File**: `src/lib/momentumSections.ts`

Add `sectionHeading(section, fallback)` — the section's own `title` when set,
otherwise the shared copy heading passed in. Pure and tested here rather than
inlined in the component, like `tintedFlags` and `resolveLayout` beside it.

**File**: `src/components/MomentumFundPage.astro`

Pass `sectionHeading(section, copy.pillarsTitle)` to `GiftPillars`, and the same
treatment for the accomplishments, testimonials, and donors bands. The shared
`donatePage.json` headings stay as the fallback, so an existing section with no
title renders exactly as it does now.

**File**: `src/data/collections.json`

Rewrite the `momentumSections.title` hint: it currently says "Narrative sections
only", which is the instruction that stops an editor naming a duplicated band.
It should say the heading names the band on the page AND in this list, and that
leaving it blank keeps the standard heading.

### 3. Card groups

**File**: `src/content/config.ts`

- Add `group: z.string().optional()` to the `pillars` and `accomplishments`
  schemas — which band this card belongs to.
- Add `group: z.string().optional()` to `momentumSections` — which cards this
  band shows.

**File**: `src/data/collections.json`

Add the matching `group` field to all three collections: `text`, optional, with
hints that say what to type and that blank means the default band.
`src/data/collections.test.ts` enforces this parity in both directions, so a
schema key with no editor input fails the build just as an editor input with no
schema key does.

**New file**: `src/lib/sectionGroups.ts`

`cardsInGroup(cards, group)` — the matching rule, in one pure place because both
card loaders need it: trims both sides, and matches blank-to-blank so a band with
no group shows the cards with no group. Also `emptyGroups(sections, cards)` for
the build advisory below.

**File**: `src/lib/donatePageContent.ts`

`loadPillars` and `loadAccomplishments` take an optional group and filter through
`cardsInGroup` before sorting. Called with no group they behave exactly as today.

**File**: `src/pages/donate.astro`

The card loaders currently run once at the route and are grafted onto `copy`.
With groups, each band needs its own list — load the full card sets once, then
let the page component select per section (passing the whole set plus the
section's group down, rather than re-reading the collection per band). Extend
the existing advisory `console.warn` with a line for any published section whose
group matches no card, so a typo costs an empty band and a log line rather than a
silent gap.

**File**: `src/components/MomentumFundPage.astro`

The `pillars` and `accomplishments` cases select their cards with `cardsInGroup`
before rendering.

### 4. Tests

**New file**: `src/lib/sectionGroups.test.ts`

The matching rule: blank section group selects blank-group cards; a named group
selects only its own; whitespace and case differences do not silently split a
group; a group matching nothing yields an empty list rather than falling back to
every card (the fallback would make a typo look like it worked).

**File**: `src/lib/momentumSections.test.ts`

`sectionHeading`: the section's title wins; blank and whitespace-only fall back
to the shared heading; no fallback and no title yields nothing rather than the
string "undefined".

**New file**: `src/lib/entryDuplicate.test.ts`

Imports `@codeyam/cms/lib/entryDuplicate` and pins the patched contract, the way
`src/lib/mediaCommitGuard.test.ts` pins `mediaLibrary`: `nextFreeSlug` skips
taken slugs and keeps counting; `duplicateValues` copies every field but drops
`previewOf`. A header comment must say this covers a LOCAL PATCH, so a future
`@codeyam/cms` upgrade that drops or reworks the module fails here loudly instead
of silently removing the button.

**File**: `src/data/collections.test.ts`

No new test needed — the existing both-directions drift guard covers the three
new `group` fields automatically. Confirm it passes.

## Reused existing code

- `src/lib/momentumSections.ts` (glossary entries: `orderedSections`,
  `tintedFlags`, `resolveLayout`) — the pure-rules module the heading helper
  joins; the duplicate is just another entry, so ordering and validation need no
  change.
- `loadPillars`, `loadAccomplishments` from `src/lib/donatePageContent.ts`
  (glossary entries: `loadPillars`, `loadAccomplishments`) — the two loaders that
  gain the optional group filter.
- `sortByOrder` from `src/lib/order.ts` (glossary entry: `sortByOrder`) — card
  ordering is unchanged; filtering happens before it.
- `publishedEntries` from `src/lib/drafts.ts` (glossary entry:
  `publishedEntries`) — draft filtering is unchanged, so a duplicated section can
  be built up in Draft before it is shown.
- `src/data/collections.test.ts` — the existing schema/registry drift guard that
  will catch a `group` field added to one side only.
- `src/lib/mediaCommitGuard.test.ts` and `src/lib/dashboardGrouping.test.ts` —
  the established pattern for unit-testing CMS-package internals from this repo,
  which the duplicate-helper test copies.
- `patches/@codeyam+cms+0.5.0.patch` — the existing local patch (reorder arrows,
  including one added component file) that this work extends rather than
  starting a second patching mechanism.
- Inside the CMS package (under node_modules, reached through the patch above):
  the create-flow helpers in its lib/newEntry module — the blank-form builder,
  the create-status gate, and the new-entry change builder — plus its frontmatter
  parser and the entry-label helper in lib/entryEditor that already falls back to
  the slug. The prefilled form is the existing create flow with different
  starting values, not a new pipeline.

**Existing-implementation survey.** Before writing this plan: `grep -rn
"duplicate\|clone" node_modules/@codeyam/cms/src` returns only preview-clone
prose — there is no duplicate/copy action in the CMS today, so nothing here
duplicates an existing feature. `momentumSections` already declares `title`
(currently hinted "Narrative sections only" and ignored by every card band), so
the naming half of this plan REUSES an existing field rather than adding one; the
only genuinely new fields are `group` on `pillars`, `accomplishments`, and
`momentumSections`, and no equivalent grouping, tag, or category field exists on
any of the three. The CMS row label already falls back to the slug (see the
entry-label helper in the package's lib/entryEditor), which is why duplicated
card bands would otherwise both read as their filenames.

## Scenarios to Demonstrate

- **Two pillar bands, different cards** — `/donate` with "What Your Support
  Powers" and "How Your Support Will Be Used" as separate sections, each showing
  its own group. The outcome the request describes.
- **The CMS sections list with both rows** — the Momentum Fund sections list
  showing the original and the duplicate under their own names rather than as two
  "pillars" rows.
- **The prefilled create form** — `/admin/new/momentumSections?from=pillars`
  with every field carried over, a free slug suggested, and the title ready to be
  renamed before anything is created.
- **Duplicate on an ordinary collection** — the action on a blog post or pillar
  card row, showing it is not a Momentum-Fund-only affordance.
- **A duplicated band still in Draft** — the copy built up privately while the
  live page is unchanged.
- **A group that matches no card** — the band renders empty and the build logs
  the advisory, instead of silently falling back to every card.
- **Nothing grouped yet** — today's `/donate` rendering unchanged, proving the
  blank-to-blank rule ships with no content migration.
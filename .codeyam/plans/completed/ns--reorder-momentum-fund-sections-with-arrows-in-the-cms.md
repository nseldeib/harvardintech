---
title: "NS -- Reorder Momentum Fund Sections With Arrows In The CMS"
mode: ui
createdAt: "2026-08-07T21:34:37Z"
prefix: "NS"
source: manual
---

## Summary

Give the Momentum Fund section list in the CMS a pair of ↑ / ↓ arrows on every
row, so an editor reorders `/donate` by clicking rather than by typing numbers
into an Order box and working out what the other five sections are numbered.
The arrows land on the page the editor already uses —
`/admin/momentumSections` — and a move stages the same kind of pending change
an archive or delete already stages, so the reorder rides the normal Publish
review and lands as one commit.

`/admin` is injected entirely by `@codeyam/cms` (its integration factory takes
only `route` / `ensureReactRenderer`; the dashboard, the entry list, and every
row component are package files), so this ships as a `patch-package` patch
against `@codeyam/cms@0.4.0` plus a repo-side guard test — the loop this repo
has already run once and documented.

## Key Decisions

- **The arrows go on `/admin/momentumSections`, in the package's own entry
  list.** Not a new repo-owned admin page, not an inline control on the public
  `/donate` page. Both were considered and rejected in favour of the page the
  editor already opens.
- **Delivered as `patches/@codeyam+cms+0.4.0.patch`.** There is no extension
  seam: `codeyamCms(options)` in `node_modules/@codeyam/cms/integration/index.ts`
  accepts only `route` and `ensureReactRenderer`, and `ADMIN_ROUTES` injects all
  ten admin routes from package files. This repo has run this exact loop before —
  `patches/@codeyam+cms+0.2.2.patch` carried the media-commit guard and the
  dashboard grouping until 0.4.0 shipped them upstream and commit `abc5872`
  deleted the patch. `patch-package` is still in `postinstall`, and
  `.github/workflows/deploy.yml` runs `npm ci` on both tracks, so the patch
  applies on every install including CI.
- **Scope by capability, not by collection name.** Any collection whose
  registry entry declares a `number` field named `order` gets the ordered list
  and the arrows. That is 13 collections today — `chapters`, `communities`,
  `sponsors`, `donors`, `projects`, `testimonials`, `momentumSections`,
  `homeSections`, `heroSlides`, `stats`, `accomplishments`, `pillars`,
  `sponsorLevels`. Collections without one (`blog`, `pages`, `events`, `team`,
  `pageCopy`, …) render exactly as they do today. Naming one collection in the
  patch would have made the feature a special case that the next ordered
  collection has to ask for again.
- **A move STAGES pending changes; it does not commit.** `stageChange` from
  `@codeyam/cms/lib/pendingChangesStore`, the same store `EntryRow` uses for
  archive / delete, so a reorder shows the row badge and Undo, appears in the
  Publish review with the rest of the batch, and lands as one commit. This is
  deliberately *not* the cutover runbook's model (`src/lib/cutoverTicks.ts`
  commits immediately) — that is right for one boolean nobody reviews, and
  wrong for a reorder an editor should be able to look at and back out of.
- **Renumber the whole visible list 1..N on every move, rather than swapping two
  values.** Blank, duplicate, and gapped `order` values all converge to a clean
  sequence on the first click. Only entries whose number actually changed are
  staged, so a single move usually stages two files, not six.
- **An ordered collection renders as ONE ordered list, not Drafts-then-
  Published.** For a collection whose whole point is sequence, the list should
  read as the page does. The draft state moves onto the row as a chip, since
  today the only signal that an entry is a draft is the group heading it sits
  under. Un-ordered collections keep `groupByDraft` untouched.
- **Arrows hide while the search box holds a query.** A filtered list is not the
  order, and moving row 2 above row 1 of a filtered view has no honest meaning.
- **A repo-side guard test pins the behaviour to the dependency.**
  `patch-package` matches patches to versions by filename, so the next
  `@codeyam/cms` bump silently drops this unless something fails. That is the
  exact risk `abc5872`'s commit message names, and `src/lib/mediaCommitGuard.test.ts`
  is the pattern for answering it: a test in this repo that holds the dependency
  to its contract and fails at CI time.
- **File the same change upstream and delete the patch when it lands.** The
  documented lifecycle from `abc5872`. The plan's last step is the follow-up,
  not a promise to remember.

## Implementation

### 1. Patch the CMS entry list

**New file**: `patches/@codeyam+cms+0.4.0.patch` (new)

Generated with `npx patch-package @codeyam/cms` after making the edits below in
`node_modules/@codeyam/cms/`. The patch spans these package files:

**`src/lib/entryList.ts`** — the pure half, beside the existing `groupByDraft`:

- `hasOrderField(fields)` — true when the resolved field list declares a
  `number` field named `order`.
- `entryOrder(raw)` — the entry's `order` as a number, or `undefined`, read via
  `parseEntry` from `src/lib/frontmatter.ts`.
- `sortByEntryOrder(items)` — order ascending, unnumbered last, label as the
  tiebreak. Mirrors the site-side rule in `src/lib/order.ts` so the admin list
  and `/donate` agree about what "first" means; a collection where nobody has
  set an order still sorts by label, exactly as the list does today.
- `moveEntry(items, index, delta)` — the moved sequence.
- `renumberEntries(items)` — `[{ slug, order }]` for the rows whose number
  changed, so the caller stages the minimum set of files.

All four are pure and unit-testable, which is what makes step 2 possible.

**`src/lib/entryActions.ts`** — `buildOrderChange(collection, slug, raw, order,
keyOrder)`, alongside `buildArchiveChange` / `buildUnarchiveChange` /
`buildDeleteChange`. `parseEntry` → set `data.order` → `serializeEntry` with the
collection's `keyOrder`, returning a `PendingChange` of kind `edit`. Using
`keyOrder` is what keeps a consumer-declared field from being reshuffled by a
reorder, the same reason the archive path takes it.

**`src/pages/admin/[collection]/index.astro`** — pass
`ordered={hasOrderField(def.fields)}` to `EntryListSearch`. `fieldOrder(def.fields)`
is already computed on this page and already forwarded as `keyOrder`.

**`src/components/admin/EntryListSearch.tsx`** — when `ordered` and the query is
empty, render one `EntryListSection` over `sortByEntryOrder(items)` with the
arrow handlers wired; otherwise the existing `groupByDraft` split, unchanged.
The move handler calls `moveEntry` → `renumberEntries` → one `stageChange`
per changed row, and holds the reordered sequence in local state so the list
reflects the move immediately (the underlying markdown only changes at publish).

**`src/components/admin/EntryListSection.tsx` / `EntryRow.tsx`** — optional
`canUp` / `canDown` / `onUp` / `onDown`, plus a "Draft" chip on the row when the
section is rendering an ordered (ungrouped) list. `RowControls.tsx` is the
existing ↑ / ↓ / ✕ cluster used by the nav and social-link editors; it always
renders the remove button, so add a two-button `OrderArrows.tsx` beside it
reusing `iconBtnStyle` from `configEditorStyles.ts` rather than bending
`RowControls` to an optional remove.

### 2. Guard the patched behaviour from this repo

**New file**: `src/lib/cmsOrderControls.test.ts` (new)

Modelled on `src/lib/mediaCommitGuard.test.ts` — including its header, which
states plainly that the test covers a dependency's contract rather than this
repo's code. It imports the helpers from `@codeyam/cms/lib/entryList` and
`@codeyam/cms/lib/entryActions` and asserts:

- `hasOrderField` is true for the `momentumSections` field list out of
  `src/data/collections.json` and false for `blog`'s.
- `sortByEntryOrder` puts an unnumbered entry last and breaks ties by label.
- `moveEntry` + `renumberEntries` on the six real Momentum Fund sections
  produce a 1..6 sequence and report only the rows that moved.
- `buildOrderChange` round-trips an entry's frontmatter with the new `order`
  and leaves the markdown body and the other keys intact.

If a future `@codeyam/cms` release drops the patch, these fail at CI instead of
the arrows quietly disappearing from `/admin`.

### 3. Point the Order field's hint at the arrows

**File**: `src/data/collections.json`

The `momentumSections` `order` field currently hints *"Change this to move a
section up or down."* — which stops being the primary instruction. Reword it so
the box reads as the precise control and the arrows as the ordinary one. Same
edit for `homeSections`, whose hint has the same job.

### 4. Record the patch and its lifecycle

**File**: `CMS_SETUP.md`

The "The admin app" section states *"There is no hand-written admin code in this
repo."* That stays true — a patch is not hand-written admin code — but the file
is where an editor or a future maintainer looks to understand `/admin`, so it
must name the patch, say what it adds, and state that it is filed upstream and
deleted on the release that carries it. Check `docs/nicole-review.md` for the
same treatment: it named the previous patch file and tracked its upstream fate.

### 5. File the change upstream

Open the equivalent PR against `codeyam-ai/codeyam-cms` (a different repo, so
outside this plan's build) and delete `patches/@codeyam+cms+0.4.0.patch` on the
release that carries it, exactly as `abc5872` did for 0.2.2 → 0.4.0. The guard
test in step 2 survives the deletion — that is when it starts earning its keep.

## Reused existing code

- `sortByOrder` and `byOrder` from `src/lib/order.ts` (glossary entries:
  `sortByOrder`, `byOrder`) — the site-side ordering rule the patched admin sort
  is written to agree with (order ascending, unnumbered last).
- `orderedSections` from `src/lib/momentumSections.ts` (glossary entry:
  `orderedSections`) — what `/donate` actually does with these numbers, and the
  reason the admin list must not invent a different rule.
- `commitAll` / `cachedToken` usage in `src/lib/cutoverTicks.ts` — the repo's
  existing precedent for repo-owned code driving a CMS-authenticated write.
  Referenced as the *rejected* model here (immediate commit vs. staged change),
  and named so the difference is a decision rather than an oversight.
- `src/lib/mediaCommitGuard.test.ts` — the shape and the header voice for the
  new dependency-contract test.
- `stageChange` / `discardChange` / `loadChanges` from
  `@codeyam/cms/lib/pendingChangesStore`, `buildArchiveChange` and friends from
  `@codeyam/cms/lib/entryActions`, `parseEntry` / `serializeEntry` from
  `@codeyam/cms/lib/frontmatter`, `fieldOrder` from `@codeyam/cms/lib/entryEditor`,
  `iconBtnStyle` from `@codeyam/cms/components/admin/configEditorStyles`.

### Existing-implementation survey

Grepped `@codeyam/cms@0.4.0` for an existing reorder affordance before proposing
one. `RowControls.tsx` (↑ / ↓ / ✕), `useListDrag.ts`, `useNavDrag.ts`,
`reorderInArray` / `moveDraftField` / `reorderDraftField` all exist — but every
one of them serves the *config* editors: nav items, nav children, social links,
and the collection builder's field rows. Nothing in the collection **entry list**
sorts by, reads, or writes `order`: `pages/admin/[collection]/index.astro` sorts
`items` by `label` and `EntryListSearch` groups them drafts-first. The only
reorder affordance a content entry has today is the numeric Order box in the
entry editor. So there is no equivalent implementation to extend or duplicate —
the pure helpers are new, and the presentational parts reuse what the config
editors already use.

## Scenarios to Demonstrate

- The Momentum Fund section list in `/admin`, ordered 1..6 as the page renders
  them, arrows on every row — the state an editor lands on.
- Top row's ↑ and bottom row's ↓ disabled at the ends of the list.
- One move applied: the list resequenced, two rows badged as staged with Undo,
  and the publish counter reading two changes ready to publish.
- A search query typed into the box: the filtered list with no arrows.
- An ordered collection holding a drafted section — the Draft chip on its row,
  in sequence rather than in a separate group.
- The Blog list (no `order` field): unchanged Drafts / Published grouping, no
  arrows — the regression guard for the 13-vs-the-rest split.
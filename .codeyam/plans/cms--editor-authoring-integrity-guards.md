---
title: "cms -- Editor Authoring Integrity Guards"
mode: ui
createdAt: "2026-07-27T21:15:08Z"
prefix: "cms"
source: manual
---

## Summary

Two places where the CMS lets an editor save something the site then silently
ignores.

**Events tagged to a chapter.** `src/pages/chapters/[slug].astro:31` links an
event to its chapter with an exact string match — `event.data.chapter ===
chapter.id` — and `src/data/collections.json:88` declares `chapter` as a plain
`text` input. So an editor types the chapter's *slug* by hand into a free-text
box, and any deviation (`New York City` instead of `nyc`, a trailing space, a
capital) drops the event off the chapter page with no error anywhere: the entry
validates, the build succeeds, `/events` still lists it, and only the chapter
page is quietly missing it. Compounding this, `src/content/events/` does not
exist at all — the collection is fully wired into three routes and declared in
the CMS registry, but has never held a file, so the first event an editor
creates is also the first exercise of this path.

**Fields the editor cannot see.** `src/data/collections.test.ts` guards one
direction of the schema/registry contract: a registry field with no key in
`src/content/config.ts`. The other direction is unguarded — a key in
`config.ts` with no input in `collections.json` renders on the site but is
invisible in `/admin`, so an editor has no way to set it and no way to know it
exists. The two directions are currently in sync; nothing keeps them that way.

## Key Decisions

- **Guard the chapter tag in this repo; the real fix is a package feature.**
  The correct answer is a select/reference field so the CMS renders a dropdown
  of chapters instead of a text box, but `@codeyam/cms` has no such field type —
  `FieldType` in `node_modules/@codeyam/cms/src/lib/entryEditor.ts:17` is
  `text | textarea | date | number | boolean | image | list`, with no relation
  member. That is raised separately as a package feature request. Until it
  lands, catch the typo here.

- **Warn, never fail the build.** `.github/workflows/deploy.yml:50` runs
  `npm run build`, which is `astro check && astro build` — so a hard failure on
  an unmatched chapter slug would stop the deploy of content an editor just
  published through the CMS, turning a cosmetic mistake into a dead site update.
  Emit a clear `console.warn` from the chapters route instead (visible in the
  Actions build log and in `astro dev`), and put the assertion in vitest, which
  the deploy workflow does not run.

- **Create the events directory with a `.gitkeep`, not a placeholder event.**
  Git cannot track an empty directory, and inventing a fake event on a real
  organization's site is worse than an empty collection. A `.gitkeep` makes the
  directory exist and be tracked; the `glob` loader's `**/*.md` pattern ignores
  it. Whether the currently-missing directory produces an Astro warning today
  is to be confirmed empirically at execution — the fix is the same either way.

- **The reverse drift guard reuses the existing parser, not a new one.**
  `schemaKeysFor` in `src/data/collections.test.ts:65-88` already extracts a
  collection's top-level Zod keys by walking brace depth. The new check is the
  set difference in the other direction over the same inputs, so both directions
  can never disagree about what the schema says.

- **The reverse guard needs an exemption list, and it must be explicit.** Some
  schema keys legitimately have no editor input: `draft` is implicit on every
  collection (`entryEditor.ts:43`), and the `chapters` collection is fully
  declared in the registry while the four built-ins get their core fields from
  the package's `CONTENT_FIELDS`, not from `collections.json`. So the check must
  compare against *resolved* editor fields — package built-ins plus registry
  `builtins` extras plus the registry `seo` group — with `draft` exempted by
  name. A hand-waved "every key must appear in collections.json" would fail
  immediately on `title`, which is exactly the kind of false alarm that gets a
  guard deleted.

## Implementation

### 1. Give the events collection a home

**New file**: `src/content/events/.gitkeep`

Empty file. Its only job is to make `src/content/events/` — the `base` the
`events` loader globs at `src/content/config.ts:87` — exist in the repo, so the
directory the CMS writes an event into is already there.

### 2. The chapter-tag helper

**File**: `src/lib/events.ts`

Add a pure helper alongside `splitEvents` / `formatEventDate`, in the same
data-in-data-out style:

- `unmatchedChapterTags(events, chapterIds)` — the distinct, non-empty `chapter`
  values that match no chapter id, in first-seen order. Events with no `chapter`
  at all are correctly excluded: an untagged event belongs to no chapter on
  purpose, which is the documented behavior at
  `src/pages/chapters/[slug].astro:27-28`.

Widen the local `EventLike` interface with an optional `chapter?: string`, or
accept the minimal structural shape — whichever keeps the existing `EventLike`
consumers (`EventsPage.astro`, `ChapterEvents.astro`, `EventCard.astro`)
unchanged.

### 3. Surface the mismatch where it happens

**File**: `src/pages/chapters/[slug].astro`

In `getStaticPaths` (the one place that already holds both the full events list
and the full chapters list), call `unmatchedChapterTags` and `console.warn` once
with the offending values and a one-line explanation that these events will not
appear on any chapter page. Advisory only — no throw, no filtering change, and
the existing per-chapter `filter` at line 31 is untouched.

### 4. Both directions of the schema/registry contract

**File**: `src/data/collections.test.ts`

Add the reverse check beside the existing `unknownFields` one:

- `missingFields(schemaKeys, editorFieldNames, exempt)` — schema keys with no
  editor input, minus the exemptions.
- A `describe` block asserting it reports nothing for all five collections,
  building each collection's editor field list the way the admin resolves it:
  the package's `CONTENT_FIELDS` for a built-in, the registry `collections`
  entry for `chapters`, plus the registry's `builtins` extras and `seo` group in
  both cases. Import the package's field lists from
  `@codeyam/cms/lib/entryEditor` rather than restating them, so a package
  upgrade that adds a built-in field cannot leave this test asserting a stale
  picture.
- Unit cases for `missingFields` itself, in the style of the existing
  `unknownFields` block: healthy state, a field that drifted out of the editor,
  an exempted key, and the two degenerate empties.

### 5. Note it in the setup doc

**File**: `CMS_SETUP.md`

The "When you add a content field, add it in both files" paragraph currently
states the failure modes in prose. Add one line: both directions are now pinned
by `src/data/collections.test.ts`, so a field added to only one file fails the
test suite rather than being discovered later. Also add a sentence to the
Events section noting that `chapter` must be the chapter's slug (the filename
without `.md`), not its city name, until the CMS offers a chapter picker.

## Reused existing code

- `schemaKeysFor`, `declaredFieldNames`, `unknownFields` from
  `src/data/collections.test.ts:31-88` — the reverse guard is the mirror of the
  parser and comparison already there
- `EventLike`, `splitEvents`, `toEventDate` from `src/lib/events.ts` (glossary
  entries: `splitEvents`, `toEventDate`, `formatEventDate`) — the helper joins
  this module rather than starting a new one
- `publishedEntries` from `src/lib/drafts.ts` (glossary entry:
  `publishedEntries`) — already applied at `src/pages/chapters/[slug].astro:29`
  before the chapter filter, so the warning covers exactly the events that
  would have rendered
- `CONTENT_FIELDS` / `SEO_FIELDS` from
  `node_modules/@codeyam/cms/src/lib/entryEditor.ts:94-137`, reachable via the
  package's published `./lib/*` export — the built-in editor field lists the
  reverse guard compares against

**Existing-implementation survey.** No chapter-slug validation exists anywhere
today: the only reads of `event.data.chapter` are the filter at
`src/pages/chapters/[slug].astro:31`, and `src/lib/events.ts` has no
chapter-aware helper. `src/content/events/` genuinely does not exist (verified
by listing `src/content/`, which holds only `blog`, `chapters`, `pages`, `team`
and `config.ts`). On the registry side, `src/data/collections.test.ts` contains
`unknownFields` but no counterpart in the schema→editor direction.

## Reproduction Test

Pins that a mistyped chapter tag disappears without a trace.

**Target**: `src/lib/events.test.ts` — run with
`codeyam-editor editor refresh-tests --test events`.

```ts
// An event tagged with a chapter's display name instead of its slug matches no
// chapter and vanishes from every chapter page — today with no signal at all.
it("names a chapter tag that matches no chapter", () => {
  const events = [
    { title: "NYC Panel", date: "2026-09-01", chapter: "New York City" },
    { title: "London Meetup", date: "2026-09-02", chapter: "london" },
    { title: "Open Call", date: "2026-09-03" },
  ];

  expect(unmatchedChapterTags(events, ["nyc", "london"])).toEqual(["New York City"]);
});
```

Status: PROPOSED — confirm red at execution. Expected failure: `src/lib/events.ts`
exports no `unmatchedChapterTags`, so the named import is undefined and the call
throws `unmatchedChapterTags is not a function` before the `toEqual` runs.

## Scenarios to Demonstrate

- **A correctly tagged event** — appearing under "Upcoming Events in London" on
  its chapter page, the working path
- **The same event tagged `London` instead of `london`** — absent from the
  chapter page, still listed on `/events`, with the build warning naming it
- **An untagged event** — on `/events` and the landing page, on no chapter page,
  and *not* reported as a mismatch
- **An empty events collection** — today's state, with the directory now present
  and every events surface rendering its empty state cleanly
- **A schema field with no editor input** — the reverse drift guard naming a key
  an editor could never fill in
- **The current, in-sync registry** — both guards green, the no-regression state
---
title: "NS -- The Momentum Network Supporter Data Model"
mode: ui
createdAt: "2026-08-18T00:33:58Z"
prefix: "NS"
source: manual
---

## Summary

Give a supporter the fields The Momentum Network needs to draw them as a node:
the Harvard school and graduation year the selected-node panel displays, the
location the "Find your place in the network" search filters on, and the
supporter's own "why I contributed" message the share badge pre-populates. Add
them to the `donors` collection, its CMS editor, and the site's anonymity rule —
which currently protects a name and a link and must now also protect a school, a
year, and a city. Purely additive: the live donor wall renders exactly as it does
today, so this lands before the visualization exists and is what unblocks it.

## Key Decisions

- **Additive only — nothing about the current wall changes.** The tier bands,
  cards, avatars, and chips keep working untouched. The network replaces them in
  a later plan, and until it does the page must not regress. This is also why
  `photo` is left alone here even though the design direction forbids portraits
  and avatars: it still feeds `DonorAvatar` on the live wall, and it retires when
  the wall does, not before.

- **Extend anonymity to the new fields, through ONE function rather than
  field-by-field.** `donorLinkHref` already documents the principle: a LinkedIn
  URL beside "Anonymous donor" identifies someone as surely as printing the name
  would, so anonymity that stopped at the name would be anonymity in appearance
  only. School plus graduation year plus city is a stronger identifier than a
  URL — in a community this size it is frequently unique. So the plan adds
  `donorPublicIdentity(donor)`, returning the whole set of reader-facing identity
  fields at once with every one suppressed for an anonymous supporter. A single
  function is the point: three separate getters is three chances for a future
  component to reach past one, and the failure mode is publishing something
  against an explicit request, which no later edit takes back.

- **School is a CMS dropdown backed by permissive schema text.** Exactly the
  treatment `kind`, `layout`, and `icon` already get: `z.string().optional()` in
  the schema so a hand-edited file or a scenario seed cannot fail the build, a
  `select` in the registry so an editor picks rather than types, and a code list
  that `src/lib/selectOptions.test.ts` keeps in step with the registry options.
  This matters more here than for the existing three, because "Find your school"
  is a **search** feature: free text would split Harvard Business School across
  "HBS", "Business School", and "Harvard Business School", and a search that
  silently misses supporters is worse than no search.

- **Location stays free text.** Supporters are global and the set is open-ended,
  so there is no list a dropdown could offer. This is the same reasoning `group`
  carries on the section collections.

- **The "why" message is its own field, not `note`.** `note` is documented as
  "Their words, or ours about them" and is written by whoever maintains the wall.
  The share message needs specifically the supporter's own words, because §5 of
  the direction turns on it: *"If the person did not submit a 'why I contributed'
  message, automatically remove that line."* A field with two possible authors
  cannot answer "did the supporter submit one?", so conflating them would make
  that rule unimplementable.

- **Graduation year is a number.** It sorts and filters correctly, and the CMS
  renders a number input. Noted as an assumption to confirm: this models **one**
  degree per supporter, and the direction document says "graduation year"
  singular. An alum with a College degree and an HBS degree can only be filed
  under one, which is a real limitation to surface before it becomes 200 rows of
  data.

- **Giving levels are retained.** `tier`, `donorTiers`, and `groupDonorsByTier`
  all stay exactly as they are. The direction document never mentions levels and
  treats every node as "Founding Supporter", but the decision here is that they
  survive and are expressed differently in the network — node size, cluster, or
  brightness — which is a visualization concern and belongs in that plan, not
  this one. No schema change is needed to support it.

## Open question this plan cannot settle

**The school list needs the team's confirmation before an editor uses it.** The
plan proposes the schools to seed the dropdown with, but a missing school is a
supporter who cannot be filed correctly, and the fix after the fact is editing
rows one at a time. The execution step should confirm the list against how
Harvard Alumni in Tech actually describes its membership — in particular whether
extension-school and cross-registration alumni are included, and whether the
label should be the full school name or the common abbreviation, since the
dropdown value is what the search matches on and what the node panel prints.

Proposed starting list, to confirm: Harvard College, Harvard Business School,
Harvard Law School, Harvard Medical School, Harvard Kennedy School, Harvard
Graduate School of Design, Harvard Graduate School of Education, Harvard
Division of Continuing Education, Harvard Divinity School, Harvard T.H. Chan
School of Public Health, Harvard School of Dental Medicine, Harvard John A.
Paulson School of Engineering and Applied Sciences, Harvard Graduate School of
Arts and Sciences.

## Implementation

### 1. The supporter identity rules

**File**: `src/lib/donors.ts`

- Extend `DonorLike` with `school?: string`, `gradYear?: number`,
  `location?: string`, and `why?: string`, each documented with what reads it —
  the node panel, the search, the share message — so the next reader knows why a
  field exists before finding its consumer.
- Add `HARVARD_SCHOOLS` as an `as const` list, in the shape `SECTION_KINDS` and
  `PILLAR_ICONS` already use, with a comment recording that the list is the
  authority the CMS dropdown and the search both read.
- Add `resolveSchool(value?)`: the matching school, or `undefined` for blank or
  unrecognized. Trimmed and case-insensitive, matching `normalizeGroup`'s
  reasoning in `src/lib/sectionGroups.ts` — an editor is not owed an empty result
  for a capitalization difference. Falls back to `undefined` rather than a
  default, since there is no sensible school to guess.
- Add `donorPublicIdentity(donor)`: returns `{ name, school, gradYear, location }`
  where `name` is `donorDisplayName(donor)` and the other three are `undefined`
  whenever `anonymous === true`. Document it as the ONLY way reader-facing code
  should reach these fields, in the same voice `donorDisplayName` already uses
  for exactly this reason.
- Add `donorWhy(donor)`: the trimmed message, or `undefined` when blank or
  whitespace-only — the predicate the share rule's "remove that line" depends on.
  Suppressed for an anonymous supporter as well: a personal statement is
  identifying, and often more so than the fields above it.

### 2. Tests for the identity rules

**File**: `src/lib/donors.test.ts`

Extend in the file's existing style:

- `resolveSchool` — matches an exact name; matches with different case and
  surrounding whitespace; returns `undefined` for blank, absent, and an
  unrecognized value.
- `donorPublicIdentity` — returns every field for a named supporter; returns the
  anonymous label **and drops school, year, and location together** for an
  anonymous one. That second test is the load-bearing one in this plan and its
  comment should say so: it is the difference between anonymity and the
  appearance of it.
- `donorWhy` — returns the message; returns `undefined` for blank,
  whitespace-only, and absent; returns `undefined` for an anonymous supporter
  even when a message is present.
- A guard that every entry in `HARVARD_SCHOOLS` is unique and non-blank, so a
  duplicated or empty dropdown option cannot ship.

### 3. The schema

**File**: `src/content/config.ts`

Add `school: z.string().optional()`, `gradYear: z.number().optional()`,
`location: z.string().optional()`, and `why: z.string().optional()` to the
`donors` collection. Comment `school` with the same "permissive on purpose"
reasoning the `momentumSections` block above it carries, and `why` with how it
differs from `note` — the two look interchangeable and are not.

Note the coupling: `src/data/collections.test.ts` asserts in both directions that
every schema key has an editor input and every editor field is a real schema key,
so steps 3 and 4 land together or the suite fails.

### 4. The CMS fields

**File**: `src/data/collections.json`

Add four fields to the `donors` collection, after `note` and before `url`, so the
identity fields read as one block:

- **School** — `select`, optional, options from `HARVARD_SCHOOLS`. Hint: shown on
  the supporter's node and used by "find your school"; hidden for an anonymous
  gift.
- **Class year** — `number`, optional. Hint: the graduation year shown beside the
  school; hidden for an anonymous gift.
- **Location** — `text`, optional. Hint: city or region, used by the network's
  location search; hidden for an anonymous gift.
- **Why I gave** — `textarea`, optional. Hint: the supporter's **own** words, used
  to pre-fill the message when they share their badge, and left out entirely when
  blank. Say explicitly that this is different from Note, which is the line the
  team writes for the wall.

Every one of the four hints must state that the field is hidden for an anonymous
gift. That is the field-level restatement of the rule in step 1, at the moment an
editor is deciding whether to type something in.

### 5. Keep the dropdown honest

**File**: `src/lib/selectOptions.test.ts`

Add `['donors', 'school']` to the `it.each` table of enum-shaped fields, and add
the `HARVARD_SCHOOLS` case to the block that asserts the registry options equal
the code list. Without this the two copies drift, which is the exact failure that
file exists to prevent.

## Reused existing code

- `donorDisplayName` from `src/lib/donors.ts` (glossary entry:
  `donorDisplayName`) — called by the new public-identity resolver rather than
  reimplemented,
  so there is one anonymity rule for the name.
- `donorLinkHref` from `src/lib/donors.ts` (glossary entry: `donorLinkHref`) —
  the precedent and the documented argument this plan extends: suppress anything
  that identifies, not merely the name.
- `ANONYMOUS_DONOR_LABEL` from `src/lib/donors.ts` — the standing label, unchanged.
- `groupDonorsByTier` from `src/lib/donors.ts` (glossary entry:
  `groupDonorsByTier`) — untouched; giving levels survive this plan intact.
- `normalizeGroup` from `src/lib/sectionGroups.ts` (glossary entry:
  `normalizeGroup`) — the trimmed, lowercased matching convention the new school
  resolver follows.
- `resolveLayout` from `src/lib/momentumSections.ts` (glossary entry:
  `resolveLayout`) — the shape of a resolver over a fixed list; the new school
  resolver differs only in returning `undefined` rather than a default, and its
  comment should say why.
- `src/lib/selectOptions.test.ts` — the existing drift guard step 5 extends
  rather than duplicates.
- `src/data/collections.test.ts` — the existing bidirectional registry/schema
  guard; it covers the four new fields once steps 3 and 4 land, so no new test is
  needed there.
- `PILLAR_ICONS` from `src/lib/pillars.ts` — the `as const` code-list shape the
  new school list copies.

**Existing-implementation survey.** Checked the `donors` collection for anything
equivalent before adding fields. It carries `name`, `tier`, `founding`,
`anonymous`, `note`, `url`, `photo`, `order`, and `draft` — **none** of which
holds a school, a graduation year, or a location, and no other collection on the
site does either (`team` carries `role` and a bio, `donors` is the only
person-with-affiliation collection on /donate). `note` is the only near-miss and
is deliberately not reused, for the reason given in Key Decisions. There is no
existing school or year list anywhere in `src/lib/` to reuse, and no existing
helper that filters identity by anonymity beyond `donorDisplayName` and
`donorLinkHref`, both of which this plan builds on rather than replaces.

## Scenarios to Demonstrate

- **A fully filled-in supporter** — the donor entry in the CMS with school, class
  year, location, and "why I gave" all completed, showing the four new controls
  in place.
- **An anonymous supporter** — the same entry with "List anonymously" switched
  on, and the resolved public identity showing the anonymous label with school,
  year, location, and the why-message all withheld. The privacy guarantee, made
  visible.
- **The school dropdown** — the Donors editor showing School as a picker rather
  than a text box, so an editor cannot invent a spelling the search will miss.
- **A supporter with nothing filled in** — the entry as every existing donor
  looks today: four blank optional fields, no validation error, nothing broken.
  The proof this ships without migrating content.
- **The live donor wall, unchanged** — /donate rendering exactly as it does now.
  The regression floor for a plan that is meant to be invisible until the network
  arrives.
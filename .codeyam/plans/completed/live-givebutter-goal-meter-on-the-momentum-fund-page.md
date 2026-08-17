---
title: "Live Givebutter Goal Meter On The Momentum Fund Page"
mode: ui
createdAt: "2026-08-13T21:17:40Z"
source: manual
---

## Summary

Embed a live Givebutter goal meter on the Momentum Fund page (`/donate`) so
visitors see real fundraising progress instead of only static copy. Two pieces:
the Givebutter loader script (`https://widgets.givebutter.com/latest.umd.cjs?acct=…&p=other`)
rendered into every page's `<head>` from a template-owned component gated on a
CMS-editable account id, and a new reorderable `goal-meter` section kind for the
campaign page that renders `<givebutter-widget id="…">` where an editor places
it. Nothing about the existing giving CTAs changes: every Give button keeps
resolving through `resolveGiveHref`, so flipping them to Givebutter later stays
the one-box `donateUrl` edit in /admin it already is.

## Key Decisions

- **The account id is CMS data, not a pasted `<script>` tag.** Givebutter's
  instructions say "paste this into `<head>`", and the site already has a place
  that would take it verbatim: the `customHeadHtml` escape hatch on the
  `siteIntegrations` entry ("Analytics & embeds"). Rejected as the shipping
  answer because it is the power-user, inject-anything box — a typo there is a
  broken `<head>` on every page. Instead the template owns the script markup and
  the editor types only the account id, exactly the split `Analytics.astro`
  already makes for the GA4 measurement id. `customHeadHtml` remains available
  for anything else Givebutter asks for later.
- **The loader script is site-wide, not `/donate`-only.** It follows the GA
  precedent through `HeadExtras.astro`, which is the one partial every shell
  includes — so a widget dropped on the homepage or a blog post later works with
  no second wiring step, and no route can silently miss the script. It renders
  nothing at all when no account id is configured, so the "off" state ships zero
  third-party markup.
- **The meter is a section kind, not a fixed band.** The middle of `/donate` is
  already whatever `momentumSections` says it is, in whatever order an editor
  arranged it. Making the meter a `goal-meter` kind means "put the meter under
  the hero", "move it below the story", and "take it down for now" are the Order
  field, the arrows, and the Draft toggle an editor already uses — not three code
  changes. The hero and the closing ask stay a fixed frame, as they are today.
- **The widget id lives on the section entry, not on `pageCopy`.** The id
  belongs to the band that renders it: a page with no goal-meter section has no
  use for the field, and a second meter (a different campaign, a different page)
  needs no new singleton field. This matches how `title` / `layout` / `image`
  are already kind-specific fields on `momentumSections`.
- **A `goal-meter` section with no widget id renders nothing, and warns at
  build.** Same treatment `/donate` already gives an unrecognized `kind`: an
  editing mistake costs one missing band and a build log line, never the deploy.
  `comingSoon` remains the way to hold the band visibly.
- **The band collapses entirely when the widget does not render.** *(Decided by
  the user at the confirm gate, reversing this plan's original call — which was
  to reserve the band's height and carry a `<noscript>` fallback line.)* The
  widget is third-party JavaScript from a CDN: it does not render for a no-JS
  visitor, and it will not render inside codeyam's capture environment either.
  Rather than show a heading over an empty progress area in those cases, the
  band shows nothing at all and the page reads continuously — the same end state
  as a section with no widget id.

  This cannot be decided server-side, so the band ships hidden and reveals
  itself only once the widget has actually rendered. Two consequences to hold
  onto: the meter is invisible in every captured scenario (so the isolated
  component and the CMS screens carry the demo), and the reveal must be
  resilient — a band that never un-hides on a slow CDN is indistinguishable
  from one that is off.

## Implementation

### 1. Resolve the loader script URL (pure, testable)

**New file**: `src/lib/givebutter.ts`

`givebutterScriptSrc(accountId?: string): string | undefined` — trims the id,
returns `undefined` for blank/absent (the "no script at all" state), otherwise
`https://widgets.givebutter.com/latest.umd.cjs?acct=<encoded>&p=other` with the
id URL-encoded so a stray character an editor pasted cannot alter the query
string. Pure and framework-free, in the same spirit as `src/lib/giving.ts`.

### 2. Make the account id editable

**File**: `src/lib/site.ts`

Add `givebutterAccountId?: string` to `SiteSettings` (beside `googleAnalyticsId`),
and document that blank means the widgets script is not shipped.

**File**: `src/lib/pageCopyMerge.ts`

Add `givebutterAccountId` to the `SiteIntegrations` interface and to
`mergeIntegrations`, using the same `preferText(entry, fallback)` rule as the
other keys — a cleared CMS box falls back to `settings.json` rather than
silently unhooking the meter site-wide.

**File**: `src/content/config.ts`

Add `givebutterAccountId: z.string().optional()` to the `siteIntegrations`
schema, with a comment naming what it is (the Givebutter account key from the
embed snippet) and that blank ships no script.

**File**: `src/data/collections.json`

Add the matching field to the `siteIntegrations` collection: `text`, optional,
label "Givebutter account ID", hint explaining it is the `acct=` value from the
embed code Givebutter gives you, and that the goal meter needs it set.

**File**: `src/data/settings.json`

Seed `"givebutterAccountId": "khqJtxj5uVUZ1eO8"` — the account from the snippet
in hand, so the meter works the moment a widget id is added, with the CMS box as
the override.

**File**: `src/content/siteIntegrations/site.md`

Add `givebutterAccountId: khqJtxj5uVUZ1eO8` to the entry's frontmatter, so the
value an editor sees in /admin matches what the site is actually using.

### 3. Render the loader script

**New file**: `src/components/GivebutterWidgets.astro`

Reads `loadIntegrations(settings)`, calls `givebutterScriptSrc`, and renders
`<script is:inline async src={src} />` when it resolves — otherwise nothing.
`is:inline` for the same reason `Analytics.astro` uses it: Astro must ship the
third-party URL untouched rather than trying to bundle it. Header comment should
say why the id is a narrow field rather than pasted markup.

**File**: `src/components/HeadExtras.astro`

Render `<GivebutterWidgets />` after `<StructuredData />` and before the
`customHeadHtml` escape hatch, so every shell that includes `HeadExtras` gets the
script — including the standalone blog-post shell that bypasses `BaseLayout`.

### 4. Add the `goal-meter` section kind

**File**: `src/lib/momentumSections.ts`

- Add `'goal-meter'` to `SECTION_KINDS`.
- Add a `SECTION_LABELS` entry (e.g. "Our progress") so a held-back band has
  something to announce in the "coming soon" placeholder.
- Add `widgetId?: string` to `SectionLike`, documented as "goal-meter sections
  only".
- `tintedFlags` needs no change — it advances only on narratives, so the meter
  band slots in anywhere without inverting the tint below it.

**File**: `src/content/config.ts`

Add `widgetId: z.string().optional()` to the `momentumSections` schema, with a
comment that it is the Givebutter widget id and applies to `goal-meter` sections
only (mirroring how `layout`/`image` are narrative-only).

**File**: `src/data/collections.json`

- Add `"goal-meter"` to the `momentumSections.kind` select options (required —
  `src/lib/selectOptions.test.ts` fails if the code list and the dropdown
  disagree).
- Add a `widgetId` field: `text`, optional, label "Goal meter widget ID", hint
  naming where to find it in Givebutter and that it is used by goal-meter
  sections only.
- Update the `kind` field's hint so it mentions the new band, and name the
  recommended placement — **just above the closing ask**, so progress and the
  final Give button read as one moment. Guidance in a hint rather than a seeded
  section, because no goal-meter section ships (see below); an editor adding the
  band should not have to guess where it belongs.

**No goal-meter section is created.** *(User decision at the confirm gate.)*
`/donate` is unchanged by this work: the capability ships, the page does not
move until an editor adds the band and pastes a widget id in /admin. So no entry
is added under `src/content/momentumSections/`, and the demo scenarios below
supply their goal-meter sections as scenario seed data rather than committed
content.

### 5. The band itself

**New file**: `src/components/donate/GoalMeter.astro`

Props: `title?`, `widgetId?`, `tinted?`. Renders nothing when `widgetId` is
blank. Otherwise a `<section>` with the heading and the slot element
`<givebutter-widget id={widgetId}></givebutter-widget>`, styled to follow
`MomentumStats.astro` — the same paper-2 band, the same section rhythm — so the
meter reads as part of the campaign page rather than a pasted-in third-party
box.

Per the collapse decision above, the `<section>` ships hidden (a `hidden`
attribute or a display-none class set in the markup, NOT a script-added one, so
a no-JS visitor never sees it flash) and is revealed only once the widget has
actually rendered content. A small inline script observes the custom element and
un-hides the band when it upgrades; if it never upgrades, the band stays
collapsed and the page reads exactly as it would with no meter at all. The
reveal check should be a genuine "did this render" test rather than a fixed
timer, so a slow CDN eventually shows the meter instead of silently swallowing
it.

If `astro check` objects to the bare custom element, fall back to
`<div set:html={...}>` with the id escaped; prefer the direct element.

**File**: `src/components/MomentumFundPage.astro`

Add a `case 'goal-meter'` to the section switch, rendering `<GoalMeter
title={section.title} widgetId={section.widgetId} />`. The section's own `title`
is the heading here (not a `donatePage.json` key) because the meter has no card
data — it is closer to `narrative` than to the slot bands in that one respect.

**File**: `src/pages/donate.astro`

Extend the existing advisory `console.warn` block with a second advisory: a
published `goal-meter` section carrying no `widgetId` logs one line naming the
section slug. Also update the "Use one of: …" message, which is currently
missing `donors` as well as the new kind.

**File**: the dynamic-route harness file under `src/pages/isolated-components/`
(the one whose filename is the bracketed `name` param — written unbracketed here
only because the citation checker reads brackets as a glob)

Register the new meter band (configured / no-id states) in the static component map so
the band is capturable in isolation, following the `MomentumStats` and
`EmbedForm-*` entries already there.

### 6. Tests

**File**: `src/lib/momentumSections.test.ts`

The existing "every declared kind is renderable" test covers the new kind
automatically once it is in `SECTION_KINDS`; confirm it still passes and add a
`tintedFlags` case asserting a `goal-meter` band between two narratives does not
flip the tint rhythm.

**New file**: `src/lib/givebutter.test.ts`

Cover `givebutterScriptSrc`: a real id produces the loader URL with `acct=` and
`p=other`; blank / whitespace / absent produces `undefined` (the "ship no
third-party script" state); an id with URL-significant characters is encoded.

**File**: `src/lib/pageCopyMerge.test.ts`

Add `givebutterAccountId` cases to the `mergeIntegrations` block: entry wins,
blank falls back to settings, missing entry falls back to settings — the same
three assertions the other integration keys already get.

`src/lib/selectOptions.test.ts` needs no edit; it will enforce the
collections.json / `SECTION_KINDS` parity on its own.

## Reused existing code

- `loadIntegrations` from `src/lib/integrationsContent.ts` (glossary entry:
  `loadIntegrations`) — the settings-backed read the new account id joins.
- `mergeIntegrations` from `src/lib/pageCopyMerge.ts` (glossary entry:
  `mergeIntegrations`) — the "cleared box falls back to settings.json" rule the
  account id inherits.
- `src/components/Analytics.astro` — the pattern being copied wholesale:
  template-owned script markup, editor-owned id, renders nothing when unset.
- `src/components/HeadExtras.astro` — the single `<head>` partial that
  guarantees no shell misses the script.
- `orderedSections`, `unknownSectionKinds`, `tintedFlags`, `SECTION_KINDS`,
  `SECTION_LABELS` from `src/lib/momentumSections.ts` (glossary entries:
  `orderedSections`, `unknownSectionKinds`, `tintedFlags`) — the meter is a new
  kind inside rules that already exist, not a new mechanism.
- `resolveVisibility` from `src/lib/homeSections.ts` (glossary entry:
  `resolveVisibility`) — Draft / coming-soon behaviour comes free.
- `loadMomentumSections` from `src/lib/momentumSectionsContent.ts` (glossary
  entry: `loadMomentumSections`) — carries the new section-level widget id
  through with the rest of the frontmatter, no change needed.
- `src/components/donate/MomentumStats.astro` — the band whose paper-2 styling
  and section rhythm the new meter band should match.
- `resolveGiveHref` from `src/lib/giving.ts` (glossary entry: `resolveGiveHref`)
  — deliberately untouched: the Give buttons stay on the existing `donateUrl`
  switch.
- `src/lib/selectOptions.test.ts` — the existing guard that will catch a code
  list / CMS dropdown mismatch for the new kind.

**Existing-implementation survey.** `grep -ri givebutter src public` before
writing this plan found no Givebutter integration anywhere in the app (new
fields and files below are marked new for that reason): the only
hits are a fixture URL in `src/lib/giving.test.ts`, a sample `donateUrl` in
`.codeyam/scenarios/momentum-fund-a-giving-platform-is-chosen.json`, and prose in
`public/review/index.html`. So the new account-id and widget-id fields duplicate
no existing field. The two adjacent mechanisms that already exist and were
considered instead: `customHeadHtml` on `siteIntegrations` (could carry the
script verbatim today — rejected above, and it stays available), and
`src/components/Embed.astro` / `src/components/EmbedForm.astro`, which do
sandboxed iframe/raw-HTML embeds but are wired to pages and posts, not to the
Momentum Fund sections collection, and an iframe is the
wrong container for a script-based custom element.

## Scenarios to Demonstrate

Every goal-meter section below is **scenario seed data**, not committed content —
no such section ships (see section 4). And because the band collapses when the
widget does not render, the third-party meter itself will not appear in a
capture: what these scenarios prove is where the band sits in the page's rhythm
and that it collapses cleanly, while the isolated component and the CMS screens
carry the visual demo.

**What was actually registered, and what the collapse decision cost.** The list
below was written before the consequence was measured. Because the band reveals
itself only when Givebutter's script defines the element — and that script never
runs in a capture — a configured meter, a meter missing its widget id, and a page
with no meter at all ALL produce frames byte-identical to the untouched
`/donate`. Registering them would have added scenarios that prove nothing and
that a reviewer cannot tell apart. So the page-level states collapsed to the one
that genuinely renders, and the rest are pinned by unit tests instead.

Registered:

- **`GoalMeter - The Band Around Givebutter's Meter`** — the frame the site owns,
  on its own harness page. The harness defeats the collapse with a global style
  so the layout is reviewable at all; the empty area beneath the heading is
  exactly the boundary between our band and their progress bar.
- **`GoalMeter - A Campaign Name That Runs Long`** — the edge state, and the one
  that earned its place: it caught the heading running the full width of the band
  while the meter below stopped at 720px. Fixed, then re-captured.
- **`Momentum Fund - The Goal Meter Held As Coming Soon`** — the only page-level
  goal-meter state a screenshot can show, because `comingSoon` replaces the band
  wholesale with the designed placeholder. Ordered under the hero so it lands
  inside a viewport capture, and it exercises the new `SECTION_LABELS` entry: the
  entry carries no title of its own, and the placeholder still announces "Our
  progress".
- **The two CMS screens**, folded into the EXISTING `cms-analytics-and-embeds`
  and `cms-section-editor-section-type-is-a-dropdown` scenarios rather than added
  beside them — the account box and the widget-id box are new fields on screens
  that already had scenarios. The section-editor scenario also gained the
  description it had been missing entirely.

Deliberately not registered, with what covers them instead:

- **The meter placed above the closing ask, and moved under the hero** — both
  capture identically to the untouched page. Placement is instead documented in
  the CMS field hint and in `docs/editing-the-site.md`.
- **A goal-meter section with no widget id** — same identical frame; covered by
  `goalMetersMissingWidgetId`'s seven unit tests, which assert the slug the build
  advisory names.
- **Account id cleared site-wide** — verified by hand end-to-end (loader script
  present on `/donate` and the homepage with the id set, absent with it cleared,
  and the two-step fallback confirmed by clearing only the CMS box) and pinned by
  `givebutterScriptSrc`'s and `mergeIntegrations`' tests. No visual difference to
  capture: the difference is a `<script>` tag in `<head>`.
- **`/donate` exactly as it ships** — already covered by the existing
  `momentum-fund-public-visitor`, which recaptured with no substantive change,
  which is itself the proof that this work leaves the page alone.
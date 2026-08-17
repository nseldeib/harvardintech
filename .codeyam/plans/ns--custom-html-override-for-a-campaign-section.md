---
title: "NS -- Custom HTML Override For A Campaign Section"
mode: ui
createdAt: "2026-08-17T20:00:05Z"
prefix: "NS"
source: manual
---

## Summary

Give every Momentum Fund campaign section (`/donate`) a **"Use custom HTML for
this section"** toggle and a **Custom HTML** box. With the toggle off — the state
of every section that exists today — the section keeps its current fields and
renders exactly as it does now. With the toggle on, that one section's entire
frontend output is replaced by the administrator's markup: no heading, no image,
no rendered body, no cards, no button, and no wrapping container or spacing
unless the administrator writes those elements themselves. No other section on
the page is affected, and the page ships with no content migration.

Both fields are saved on the section's own entry and stay editable. Turning the
override on deletes nothing: the heading, image, layout, cards, and markdown body
stay exactly where they are, and turning the toggle back off brings the original
section back unchanged. A preview route renders one section's custom HTML on its
own — and does so whether or not the toggle is on — so an administrator can paste
markup, save it, look at it, and only then decide to switch the section over.

## Key Decisions

- **An explicit boolean toggle, not "on because the box has text in it."** The
  toggle is what lets an administrator draft markup, leave it saved, and switch
  the section back to its standard layout without deleting the work — and back on
  again without retyping it. It also makes the on-state deliberate: with an
  implicit rule, one stray character pasted into a textarea silently deletes a
  live section's entire design.

- **Stored on the section, and non-destructive by construction.** Both fields are
  ordinary frontmatter on that one section's entry file, so the markup is saved
  with the section it belongs to, versioned in git with it, and editable later
  through the same form. Nothing in this plan *writes* content: the override is a
  render-time branch and every code path it touches is read-only, so there is no
  mechanism by which turning it on could clear a title, an image, a layout, a
  card group, or a markdown body. Switching the toggle off therefore restores the
  original section exactly — not "regenerates" it, since it was never gone. Step 6
  is the one place this could have gone wrong and deliberately does not: it skips
  *rendering* an overridden narrative's body, and never removes it from the file.

- **The override applies to every section kind.** The request is for any
  individual section. Because the branch sits ahead of the `kind` switch in
  `src/components/MomentumFundPage.astro`, it costs one condition rather than
  seven, so a `pillars` band is overridable for the same reason a `narrative` is.

- **Output is fully bare — no wrapper, no padding, no max-width, no tint.** The
  requirement is that the standard container and spacing must not appear unless
  the custom HTML includes them, so the markup is injected verbatim via an Astro
  `<Fragment set:html>` with nothing around it. The administrator owns every
  pixel of that band, including its full-bleed edges and its vertical rhythm
  against the sections above and below. This is the deliberate trade for total
  control: malformed markup (an unclosed tag) can now disturb the sections after
  it, which is exactly why the toggle is explicit and why the CMS hint says the
  HTML is used as written and is not checked.

- **Toggle on with an empty box renders nothing.** That is the literal reading of
  "replace the entire output" and it is also a real editing state — the toggle
  flipped before the markup is pasted in. It is *silent*, though, and therefore
  indistinguishable from a section that broke, which is precisely the situation
  `goalMetersMissingWidgetId` already exists to name on this page. It gets the
  same treatment: a build-time advisory naming the slug, never a build failure.

- **`kind` is untouched, so no other section moves.** `tintedFlags` alternates
  the tinted band by counting `narrative` sections only. An overridden section
  keeps its `kind`, so it keeps its place in that count and every other section's
  tint stays exactly as it is today. Had the override swapped the section to a
  new `custom` kind, turning it on would have inverted the tint on every band
  below it — a direct violation of "do not affect any other campaign section."

- **Visibility still wins over the override.** `draft` and `comingSoon` are
  checked before the custom-HTML branch: a section held back stays held back
  however it is styled. The override changes what a *shown* section draws, not
  whether it is shown.

- **No sanitization, by design and consistent with the site.** This is an
  administrator-only field on content the team commits and reviews in git.
  `src/components/Embed.astro` and the site-wide `customHeadHtml` /
  `customBodyHtml` settings already inject operator-authored markup verbatim
  through `set:html`. A sanitizer on this one field would be inconsistent and
  would silently strip the `<script>`-based widgets that are much of why an
  administrator wants an escape hatch. The CMS hint carries the warning instead.

- **The rules are pure functions in `src/lib/momentumSections.ts`, not checks
  inlined in the component** — matching how `resolveLayout`, `sectionHeading`,
  and `tintedFlags` already live there: one testable fact per rule, unit-tested
  without Astro.

## Preview: what the existing architecture can and cannot do

Surveyed before deciding, because "if the admin architecture supports one without
major complexity" is a question about the `@codeyam/cms` package, not about this
repo. There are exactly two preview mechanisms and **neither** can show custom
HTML:

- **The in-editor live preview pane** (`EntryPreview.tsx` in the package, rendered
  beside the form by `EntryEditor.tsx`) is hardcoded to the article shape: it
  reads `coverImage` / `photo`, `title`, a date/role/location meta line, and the
  markdown body, and renders those four things. It takes no per-collection or
  per-field extension, so there is no seam through which a `customHtml` value
  could reach it. Teaching it this field means editing a package component.

- **The staged preview** (`?preview=1` on a real page, `stagedPreviewPatch.ts`)
  patches staged values into the already-rendered DOM via
  `el.textContent = value`. It can change the *text* of an element the page
  already draws; it cannot replace a section's subtree with new markup, and
  `textContent` would escape the HTML rather than render it. It also depends on
  `data-cms-*` markers for exact patching, and this site emits **none** (grepped:
  zero occurrences under `src/`), so `/donate` is patched by shape only.

  **This is worth calling out as a live footgun**, not just a gap: an
  administrator who stages an override and opens `?preview=1` sees the section's
  *standard* layout, because nothing in the patch path knows about the field. The
  preview is not merely unhelpful, it is misleading. Step 8's route and the field
  hint are how an administrator is pointed somewhere truthful instead.

So an in-admin preview is package work — a new field-preview capability in
`@codeyam/cms` plus a dependency upgrade — which is exactly the "major
complexity" the request excluded. **Instead this plan ships a preview this repo
can own outright** (step 8): a route that renders one saved section on its own,
using the very same rendering path `/donate` uses.

The important design choice there: the route renders the section's custom HTML
**whether or not the toggle is on**. That is what makes it a preview rather than
a confirmation. The workflow it creates is the whole point — paste the markup,
save it with the toggle still off so the live page is untouched, open the preview
and look at it, adjust, and only flip the toggle when it is right. It also means
an administrator can keep checking saved markup for a section that is currently
running its standard layout.

## Known constraint: the CMS cannot hide the box or render a code editor

Recorded here because it shapes what step 4 can deliver, and it is a package
limit rather than a choice.

The editor's field contract is `FieldDef` in
`node_modules/@codeyam/cms/src/lib/entryEditor.ts`. A field carries `name`,
`label`, `type`, `optional`, `hint`, `options` (select only), `fields` (list
rows), and `group` (`'seo'` only). There is **no** conditional-visibility
property, **no** control over input height, and **no** `code` field type — the
type list stops at text / number / textarea / date / image / boolean / list /
select. Fields render unconditionally, in declaration order.

So, within this repo:

- **"Toggle or checkbox"** — delivered exactly, as a `boolean` field.
- **"Large textarea labeled Custom HTML"** — delivered as a `textarea` labeled
  `Custom HTML`. Its rendered height is the editor's standard textarea height;
  this repo cannot set it.
- **"Display the textarea *when* the toggle is on"** — **not deliverable here.**
  Both fields render at all times, adjacent, with the hint on each explaining the
  pairing. Nothing breaks: the textarea is simply inert while the toggle is off,
  which is also what makes drafting-then-switching-off work.
- **"Code editor"** (syntax highlighting, bracket matching) — **not deliverable
  here.** It would need a new `code` field type in the CMS package.
- **A preview inside the admin form** — **not deliverable here**, for the reasons
  in the preview section above. Step 8 ships a preview route instead.

Making the box conditional or a real code editor means shipping a new field
capability in the `@codeyam/cms` package (a `showWhen` property and/or a `code`
type) and upgrading this site's dependency — a separate deliverable in a
different repo, deliberately out of scope for this plan. This plan delivers the
full behavior; the two gaps above are presentation of the admin control only,
and both are named so the outcome is not a surprise at review.

## Implementation

### 1. The override rules and their advisories

**File**: `src/lib/momentumSections.ts`

- Add `useCustomHtml?: boolean` and `customHtml?: string` to the `SectionLike`
  interface, documented like `widgetId` and `group` beside it — including that,
  unlike those two, these apply to every kind.
- Add `customSectionHtml(section)`: returns the trimmed `customHtml` when
  `useCustomHtml === true` **and** the markup holds something; otherwise
  `undefined`. This one function is the whole override rule — the component asks
  it, and the two states it collapses (toggle off, and toggle on with nothing to
  draw) both mean "this function returns nothing", which is why the component
  needs no second condition. Whitespace-only counts as blank, the convention
  `sectionHeading` already uses directly above it.
- Add `customHtmlSectionsWithNoMarkup(sections)`: the slugs of sections whose
  toggle is on but whose box is blank — the silent state named above. Same
  signature and same slug fallback as `goalMetersMissingWidgetId`, which it sits
  beside and deliberately mirrors.
- Add `sectionsWithIgnoredFields(sections)`: for each section with the toggle on,
  which of its standard fields the override makes inert — `title`, `image`,
  `layout`, `widgetId`, `group`, and (for `narrative`) its markdown body.
  Returns `{ slug, ignored: string[] }[]`, and skips sections where nothing is
  actually shadowed so a clean override produces no noise. This is what saves an
  administrator who edits the Heading of an overridden section and cannot work
  out why the page does not change.

### 2. Unit tests for the three rules

**File**: `src/lib/momentumSections.test.ts`

Extend with `describe` blocks in the file's existing comment-the-why style:

- `customSectionHtml` — returns the markup with the toggle on; returns
  `undefined` with the toggle **off even when the box holds markup** (the
  headline guarantee: saved-but-inactive markup does not render, which is what
  makes the toggle worth having); returns `undefined` for an absent toggle (every
  section on the page today); returns `undefined` for empty and whitespace-only
  markup with the toggle on; trims surrounding whitespace; and works for a
  non-`narrative` kind, proving the override is not narrative-only.
- `customHtmlSectionsWithNoMarkup` — names a section with the toggle on and a
  blank box; ignores a section with the toggle on and real markup; ignores a
  section with markup but the toggle off; falls back to `(unnamed section)` for a
  section with no slug, matching `goalMetersMissingWidgetId`.
- `sectionsWithIgnoredFields` — names a section whose heading is shadowed; names
  the markdown body for a `narrative`; reports nothing for an overridden section
  with no other content set; reports nothing for a section with a heading and the
  toggle off, which is the state of every section on the page today and therefore
  proof the advisory stays silent on the current content.

### 3. The section schema

**File**: `src/content/config.ts`

Add `useCustomHtml: z.boolean().optional()` and `customHtml: z.string().optional()`
to the `momentumSections` collection schema, commented at the density of the
`widgetId` and `group` comments above them: what the pair does, that it applies
to every kind, that absent means "render normally", and that
`src/lib/momentumSections.ts` holds the rule. `useCustomHtml` is a second boolean
beside `comingSoon` and `draft` for the same reason those two are booleans — the
CMS field types have no tri-state control.

Note the coupling: `src/data/collections.test.ts` asserts in **both directions**
that every schema key has an editor input and every editor field is a real schema
key. Step 3 without step 4 fails the suite — they land together.

### 4. The CMS toggle and box

**File**: `src/data/collections.json`

Append two fields to the `momentumSections` collection, **last and in this
order**, after `comingSoon`. Fields render in declaration order and cannot be
conditionally hidden, so the toggle must sit immediately above the box it
governs, and the pair belongs below the ordinary controls rather than between
Heading and Layout.

```json
{
  "name": "useCustomHtml",
  "label": "Use custom HTML for this section",
  "type": "boolean",
  "optional": true,
  "hint": "Advanced. Switch ON to replace everything this section normally shows with your own HTML from the box below. The heading, image, body, cards, and button are not shown, and neither is the usual background, page width, or spacing — your HTML is the whole section. Leave OFF for the standard layout; the box below is kept but ignored, so you can switch back and forth without losing your work."
},
{
  "name": "customHtml",
  "label": "Custom HTML",
  "type": "textarea",
  "optional": true,
  "hint": "The HTML for this section, used only while the toggle above is ON. It is used exactly as written and is not checked, so a mistake here — an unclosed tag, for example — shows up on the live page and can affect the sections below it. Include your own container and spacing: none is added around it. Leaving this blank with the toggle ON makes the section show nothing at all."
}
```

`textarea` is the right type: it is what `embedHtml` already uses for
operator-authored markup in this same registry, and per the constraint section
above it is the largest input the field contract offers.

### 5. Wire the override into the page

**File**: `src/components/MomentumFundPage.astro`

Inside the `sections.map()`, **after** the two `resolveVisibility` checks and
**before** `switch (section.kind)`:

```jsx
const html = customSectionHtml(section);
if (html) return <Fragment set:html={html} />;
```

`<Fragment set:html>` and not a wrapping element — that is the "no container, no
spacing" requirement expressed in one line, and the same construct
`src/layouts/BaseLayout.astro` already uses for `customBodyHtml`. Import
`customSectionHtml` alongside the existing `sectionHeading` / `tintedFlags`
imports.

The ordering is load-bearing and deserves a comment beside it: `draft` and
`comingSoon` still win over the override, and the override wins over `kind`,
which is what makes it an override rather than an eighth kind. Nothing else in
the map changes — `tinted` is still computed from the full list and still
consumed by the sections that draw a band, so the tint on every other section is
untouched.

### 6. Skip the markdown render for an overridden narrative

**File**: `src/lib/momentumSectionsContent.ts`

The `Content:` line renders the body only for `kind === 'narrative'`; extend that
condition so a narrative whose output is being replaced does not pay for
`render(entry)` at all. Small, but it also makes the loaded data honest: an
overridden section carries no `Content` for any future caller to draw by
accident.

### 7. The build-time advisories

**File**: `src/pages/donate.astro`

Add two more advisory warning blocks beside the existing three, following the
wording shape of the `goalMetersMissingWidgetId` and `emptyGroups` blocks
directly above them — advisory only, never build-failing:

- Sections with the toggle on and an empty box, naming each slug, and saying that
  the section shows nothing: either paste the HTML in or switch the toggle off.
- Sections whose override is shadowing fields an administrator has filled in,
  naming each slug and the specific fields, and pointing at the toggle as the way
  to get the standard layout back.

### 8. The preview route

**New file**: `src/pages/section-preview/[slug].astro`

A route that renders one Momentum Fund section on its own, so an administrator
can look at custom HTML before committing the section to it.

- `getStaticPaths` over the `momentumSections` collection, one path per entry,
  keyed on the entry id — the same `slug` the advisories in step 7 name, so a
  warning in the build log and a preview URL identify a section the same way.
- Renders the section's custom HTML bare via `<Fragment set:html>` — the exact
  construct step 5 uses, so what the preview shows and what the page would render
  cannot drift.
- **Deliberately ignores the toggle**: it previews `customHtml` whenever the box
  holds markup, `useCustomHtml` on or off. This is what lets an administrator
  check saved markup on a section still running its standard layout, and it is
  the difference between a preview and a confirmation. Because it reads the field
  directly rather than through step 1's override rule, the frontmatter comment
  should say so and say why — a future reader will otherwise assume the rule was
  forgotten.
- When the box is empty, render a short plain-language note saying there is no
  custom HTML saved for this section yet, rather than a blank page that reads as
  a broken route.
- No `BaseLayout`: the preview must show what the markup does on its own, and
  wrapping it in the site nav and footer would put chrome around a band whose
  whole point is that it has none.

**File**: `src/lib/sitePages.ts`

Add `'section-preview'` to `RESERVED_PAGE_SLUGS`, beside `'isolated-components'`.
That list is enforced by a test, so a new route directory fails the suite until
it is registered — which is the intended prompt, not an obstacle. Registering it
also keeps an editor from creating a CMS page that would collide with the route.

**File**: `src/data/collections.json` (the Custom HTML box's hint, added in step 4)

Extend the hint with where to look: the preview lives at
`/section-preview/<section-name>`, it works whether or not the toggle is on, and
it is the way to check custom HTML — because the admin's own Preview button
cannot show it (see the preview section above).

Two things this route deliberately is not. It is not authenticated: it renders
only content already committed to the repo and already public via `/donate`, so
it exposes nothing new — the same standing as `isolated-components`, which it
sits beside in the reserved list. And it is not live-as-you-type: it previews
what has been **saved**, which is the honest limit of a route that reads the
content collection, and is why the workflow above is save-then-look.

### 9. An isolated capture frame

**New file**: `src/pages/isolated-components/CustomSection.astro`

Follows `src/pages/isolated-components/GiftPillars-DuplicatedBand.astro`: import
`src/styles/tokens.css`, wrap the output in `<div id="codeyam-capture">`, and —
importantly — resolve the markup by passing a realistic section object through
the step 1 override rule rather than hardcoding the HTML string. Hardcoding would
let the capture pass even if the toggle were never consulted, which is the one
thing this frame exists to show. Use a snippet the standard bands cannot draw (a
full-bleed sponsor logo strip, or a bespoke pledge table) so the capture reads as
custom at a glance.

## Reused existing code

- `resolveVisibility` from `src/lib/homeSections.ts` (glossary entry:
  `resolveVisibility`) — unchanged; the override branch sits after it so `draft`
  and `comingSoon` keep winning.
- `tintedFlags` from `src/lib/momentumSections.ts` (glossary entry:
  `tintedFlags`) — unchanged and deliberately so; its narrative-only counter is
  why an overridden section must keep its `kind`, and why no other section's tint
  moves.
- `sectionHeading` from `src/lib/momentumSections.ts` (glossary entry:
  `sectionHeading`) — the trim-to-blank convention step 1's override rule copies.
- `goalMetersMissingWidgetId` from `src/lib/momentumSections.ts` (glossary entry:
  `goalMetersMissingWidgetId`) — the closest existing precedent, and copied
  twice: it is the same "deliberate but silent, so name the slug" situation, and
  it supplies both the signature of step 1's blank-markup advisory and the shape
  of step 7's warning.
- `orderedSections` from `src/lib/momentumSections.ts` (glossary entry:
  `orderedSections`) — unchanged; an overridden section keeps a known `kind`, so
  it is still ordered and still not dropped.
- `preferText` from `src/lib/pageCopyMerge.ts` — the site-wide precedent for
  "whitespace-only counts as empty"; cited as the convention, not imported
  (`src/lib/momentumSections.ts` stays dependency-light, importing only
  `src/lib/order.ts`).
- `src/layouts/BaseLayout.astro` — the `<Fragment set:html>` construct step 5
  uses, already the site's way of injecting operator-authored markup with no
  wrapping element.
- `src/components/Embed.astro` — the existing `set:html` + `.trim()` pattern for
  operator-authored markup, and the model for the "raw escape hatch, unsanitized
  on purpose" comment the new code should carry.
- `src/data/collections.json` — the `embedHtml` built-in extra, the precedent for
  a `textarea` holding operator-authored HTML in this registry.
- `src/data/collections.test.ts` — the existing bidirectional registry/schema
  guard already covers both new fields once steps 3 and 4 land; no new test is
  needed there.
- `src/pages/isolated-components/GiftPillars-DuplicatedBand.astro` — the
  isolated-frame pattern step 9 follows.
- `src/lib/sitePages.ts` — `RESERVED_PAGE_SLUGS`, the existing registry (and its
  enforcing test) that step 8's new route directory joins, exactly as
  `isolated-components` already does.
- `src/lib/momentumSectionsContent.ts` — `loadMomentumSections`, already used by
  both `/donate` and the isolated-component harness; step 8's route reads the
  collection the same way rather than hand-rolling a third pipeline.
- `src/lib/drafts.ts` and `src/lib/draftVisibility.ts` (`publishedEntries`,
  `INCLUDE_DRAFTS`) — unchanged, and the reason a drafted section is previewable
  in `astro dev` and on the review track but absent from the public build.

**Existing-implementation survey.** Grepped for a per-section HTML override
before proposing one. Raw-HTML injection already exists on this site in two
places, and **neither** overlaps this field:

- `customHeadHtml` / `customBodyHtml` (`src/lib/pageCopyMerge.ts`,
  `src/layouts/BaseLayout.astro`) — **site-wide** settings for analytics and
  verification tags, injected on every page. Not per-section, not per-page.
- `embedHtml` (`src/components/Embed.astro`, declared as a built-in extra on
  `pages` / `blog` / `events` in `src/data/collections.json`) — **per-page/post**
  frontmatter for a single third-party widget, rendered inside an `.embed-html`
  div within a page's body. Not available on `momentumSections` at all, and not a
  replacement for a section's layout.

Nothing on `momentumSections` today provides or approximates this: the schema's
fields are `kind`, `title`, `layout`, `image`, `widgetId`, `group`, `order`, plus
the `comingSoon` and `draft` booleans. There is no existing field, threshold, or
dimension this duplicates. There is likewise no existing conditional-field or
code-editor capability in the CMS package to reuse — see the constraint section
above.

## Scenarios to Demonstrate

- **Toggle off — nothing changes** — the current `/donate` page, no section
  overridden. The regression floor: adding two fields changes nothing an
  administrator has not asked for.
- **Toggle off with markup saved in the box** — the section renders its standard
  layout and the markup does not appear. The guarantee that makes drafting safe,
  and the single most important scenario in this list.
- **Turn it on, then turn it off again** — the same section shown three times:
  standard layout, overridden, and standard layout restored. The heading, image,
  and body come back identical because they never went anywhere. This is the
  reversibility promise, demonstrated end to end.
- **A narrative fully replaced** — the `story` section's toggle on, showing a
  full-bleed custom band with no heading, no photo, no rendered body, and none of
  the standard padding or max-width; it runs edge to edge because the markup
  says so.
- **A card band fully replaced** — a `pillars` section overridden, proving the
  override is not narrative-only and that the cards are gone rather than drawn
  beneath the markup.
- **One section overridden, the rest untouched** — the page with a single
  overridden section in the middle: every other band keeps its layout, its
  spacing, and its tint exactly as before.
- **Toggle on, box empty** — the section renders nothing at all, and the build
  output names its slug so the state is diagnosable rather than mysterious.
- **Visibility beats the override** — an overridden section also marked "Show as
  coming soon" renders the placeholder; marked Draft it disappears entirely.
- **The ignored-fields advisory** — build output naming a section whose Heading
  and Image are shadowed by its override.
- **The preview route with the toggle off** — markup saved but not live: the
  preview shows the custom band, while `/donate` still shows the section's
  standard layout. The two side by side are the feature's core workflow.
- **The preview route with nothing saved** — the plain-language "no custom HTML
  saved for this section yet" note rather than a blank page.
- **The CMS editor** — the `momentumSections` form showing "Use custom HTML for
  this section" and the Custom HTML box last, in that order, both always visible,
  with their hints explaining the pairing and naming the preview URL.

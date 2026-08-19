---
title: "NS -- Hero Banner: Photo, Video, Or Custom HTML With Live Personalization"
mode: ui
createdAt: "2026-08-19T14:22:10Z"
prefix: "NS"
source: manual
---

## Summary

Give the `/donate` hero banner three mutually exclusive modes instead of two.
Today it is a photo, optionally overlaid by a looping video. This adds a third:
**custom HTML**, written by an administrator in Page settings, which replaces the
entire banner — no photo, no video, no scrim, no headline, no Give button, and no
container or padding unless the markup supplies them. The two existing modes are
untouched: a page with the toggle off renders exactly what it renders today.

Because the campaign email links to `/donate?name=<first name>`, custom HTML has
to be able to greet a visitor by name the same way the built-in headline already
does. So the banner also gains a small, documented **personalization token
vocabulary** — `data-first-name`, `data-if-name`, `data-if-no-name` — that works
inside custom markup and is filled in the browser from the same sanitized `?name=`
value the headline uses. Nothing about the security posture changes: the name is
still rejected unless it is plausibly a first name, and it is still written with
`textContent`, never `innerHTML`.

## Key Decisions

- **Three modes, not a stack.** Photo and video compose today on purpose — the
  photo is the video's poster and its fallback. Custom HTML does not join that
  stack: it *replaces* the banner. A custom banner that still painted the hero
  photo behind it would make every custom design fight a background the author
  did not ask for, and the whole point of the escape hatch is that the author owns
  every pixel of the band.

- **An explicit boolean toggle, not "on because the box has text in it."** The
  same decision, for the same reasons, that the queued section-level override plan
  made: the toggle is what lets an administrator draft markup, leave it saved, and
  switch the banner back to the photo without deleting the work. With an implicit
  rule one stray character pasted into a textarea silently deletes the campaign's
  hero.

- **Deliberately NOT built on the section-level override.** That plan is queued
  and not yet built (no `customHtml` exists anywhere under `src/` today), and even
  once it lands it would not reach here: the hero is explicitly *not* a
  `momentumSections` entry — the page component and the collection schema both say
  so, because a hero an editor could drag to the bottom of the page is a page an
  editor can break. So this plan carries its own toggle on `pageCopy`, and the two
  features stay independent in both directions. The field naming
  (`useHeroCustomHtml` / `heroCustomHtml`) deliberately echoes that plan's
  `useCustomHtml` / `customHtml` so the two read as one idea.

- **The personalization tokens are attributes, not string placeholders.** The
  headline uses `{name}` because it is a plain-text field. Custom HTML is markup,
  and a `{name}` substring replacement on markup would have to run over the raw
  HTML — where a hostile or clumsy value lands inside an attribute or a tag and the
  `textContent` guarantee is gone. Attribute hooks invert that: the browser parses
  the markup first, and the script then writes only into text nodes of elements the
  author explicitly marked. The value can never become markup.

- **Three tokens, because two states need naming, not one.** `data-first-name`
  fills the element's text with the visitor's first name; whatever the author typed
  inside it stands as the fallback when there is no name. `data-if-name` and
  `data-if-no-name` hide their element in the other case. Without the last two,
  "Nicole, let's go further together" degrades to "friend, let's go further
  together" and the author has no way to write two genuinely different sentences —
  which is the actual reason the built-in headline carries two fields rather than
  one.

- **The token scan runs over the whole document, not a hero wrapper.** Giving the
  custom markup a wrapping element to hang `data-hero-personalize` on would
  contradict the "no container, no padding" requirement in the same breath as
  stating it. Scanning `document` costs one selector, keeps the custom markup
  genuinely bare, and has the useful side effect that the same tokens will work in
  any operator-authored HTML on the page — including a section-level override, if
  that plan lands later.

- **The DOM work lives in its own tested module.** The existing personalization
  module stays pure and DOM-free; the new `heroPersonalizeDom` does the element
  walking and is unit-tested against jsdom, exactly as the Momentum Network's DOM
  module and its test already are. The alternative — more logic inline in the
  component's `<script>` — is the one part of this feature that has real branching
  and is the part that would go untested.

- **The scenario hook moves from a server-side pin to a client-side one.** The
  hero today pins the personalized headline server-side via `previewName` and sets
  `data-preview="true"` so the script leaves it alone. That cannot work for custom
  HTML — the markup is opaque to the server. So the hero emits `data-preview-name`
  and the script prefers it over `?name=`. The existing headline path is unchanged
  (still pinned, still skipped), so no current scenario changes behaviour; the new
  attribute exists so a screenshot can capture a *personalized custom banner*,
  which is otherwise uncapturable.

- **No sanitization of the markup itself, consistent with the site.** This is an
  administrator-only field on content committed and reviewed in git, and the site
  already injects operator-authored markup verbatim in the embed component and in
  the site-wide `customHeadHtml` / `customBodyHtml` settings. A sanitizer here
  would be inconsistent and would strip exactly the `<script>`-based widgets an
  administrator wants an escape hatch for. The `?name=` value is a different matter
  and stays sanitized — it comes from a stranger, the markup does not.

- **Toggle on with an empty box renders no hero at all**, which is the literal
  reading of "replace the banner" and is also a real mid-edit state. It is silent,
  and therefore indistinguishable from something broken — so it gets the treatment
  `goalMetersMissingWidgetId` already establishes on this page: a build-time
  advisory naming the field, never a build failure.

## Implementation

### 1. The banner-mode rule

**New file**: `src/lib/heroBanner.ts`

Pure and framework-free, matching `src/lib/momentumSections.ts` in style and
dependency weight.

- `HERO_BANNER_MODES = ['image', 'video', 'custom'] as const` and a
  `HeroBannerMode` type.
- `resolveHeroBanner({ useHeroCustomHtml, heroCustomHtml, video, image })` →
  `{ mode: HeroBannerMode; customHtml?: string }`. Returns `custom` with the
  trimmed markup only when the toggle is `true` **and** the markup holds something;
  otherwise `video` when a video path is set, otherwise `image`. Whitespace-only
  markup counts as blank — the convention `sectionHeading` already uses.
- `heroCustomHtmlIsBlank({ useHeroCustomHtml, heroCustomHtml })` → boolean, for the
  advisory in step 8. Named as a predicate rather than returning a slug list
  because the hero is a singleton; there is nothing to name but the field.

One function decides the mode so the component holds no precedence logic, and so
"custom beats video beats image" is a fact a test can pin rather than a reading of
JSX.

### 2. Unit tests for the mode rule

**New file**: `src/lib/heroBanner.test.ts`

In the comment-the-why style of `src/lib/momentumSections.test.ts`:

- `image` with neither video nor custom markup — the page as it renders today.
- `video` when a video path is set and the toggle is off.
- `custom` when the toggle is on with markup, **even when both an image and a
  video are set** — the precedence guarantee, and the single most important case
  here.
- `image` / `video` when the toggle is OFF but the box holds markup — saved-but-
  inactive markup does not render, which is what makes the toggle worth having.
- `image` when the toggle is on and the box is blank or whitespace-only, with
  `heroCustomHtmlIsBlank` returning true for the same input — the two halves of the
  silent state, pinned together so a change to one cannot drift from the other.
- Markup is returned trimmed.

### 3. The personalization tokens

**New file**: `src/lib/heroPersonalizeDom.ts`

`applyNameTokens(root: ParentNode, name: string | null): void`

- `[data-first-name]` — when `name` is non-null, set `el.textContent = name`. When
  null, leave the element exactly as authored, so the author's own text is the
  fallback. Never `innerHTML`.
- `[data-if-name]` — removed from the document when `name` is null.
- `[data-if-no-name]` — removed when `name` is non-null.
- Removal rather than `display: none`, so the hidden branch leaves the
  accessibility tree as well as the layout, and so a no-JS visitor's page (where
  neither branch is removed) is the only case that shows both — which is why the
  field hint tells authors to write the no-name branch as the one that still reads
  correctly beside the other.

Document that this function is called with an already-sanitized name and does no
sanitizing of its own — `src/lib/personalize.ts` owns that, and splitting it would
create two places to get it wrong.

### 4. Unit tests for the tokens

**New file**: `src/lib/heroPersonalizeDom.test.ts`

jsdom-backed, following `src/lib/momentumNetworkDom.test.ts`: build a fragment of
representative custom markup, run `applyNameTokens`, assert the DOM.

- Fills every `[data-first-name]` in the fragment, not just the first.
- Leaves the authored fallback text in place when `name` is null.
- Writes as TEXT: seed the name `<b>x</b>` (which `sanitizeFirstName` would never
  return, so this is the belt-and-braces case) and assert the element has no child
  elements and the literal string as its text.
- Removes `[data-if-name]` with no name; removes `[data-if-no-name]` with a name;
  keeps each in the opposite case.
- Does nothing and throws nothing on a fragment carrying none of the three
  attributes — the state of every page on the site.

### 5. The copy type, the schema, and the CMS fields

**File**: `src/lib/site.ts`

Add `useHeroCustomHtml?: boolean` and `heroCustomHtml?: string` to
`DonatePageCopy`, documented beside `heroVideo` at the density of the comments
already there: what they do, that custom HTML replaces the banner rather than
layering on it, and that the personalization tokens are how a name reaches it.

**File**: `src/content/config.ts`

Add both keys to the `pageCopy` collection schema, after `heroVideo`, with the
same comment density as the `heroVideo` block above them. `useHeroCustomHtml` is a
`z.boolean().optional()`; `heroCustomHtml` a `z.string().optional()`.

**File**: `src/data/collections.json`

Append two fields to the `pageCopy` collection immediately after `heroVideo` —
toggle first, box second, since the editor renders fields in declaration order and
cannot conditionally hide one. Hints must carry: that the toggle replaces the whole
banner; that nothing is added around the markup; that the photo and video are not
shown while it is on; that clearing the toggle brings the banner back unchanged;
and the three personalization tokens with a worked example, e.g.

```html
<h1><span data-first-name="">friend</span>, let's go further together.</h1>
<p data-if-name="">Thanks for opening our email.</p>
<p data-if-no-name="">Welcome — take a look at what we're building.</p>
```

The registry test asserts in both directions that every schema key has an editor
input and every editor field is a real schema key, so the schema and the registry
land together or the suite fails.

### 6. The merge rule

**File**: `src/lib/pageCopyMerge.ts`

Extend `mergeDonateFrame` with both fields.

- `heroCustomHtml` follows `heroVideo` exactly — `preferText(entry.heroCustomHtml,
  fallback.heroCustomHtml)` with **no key in `donatePage.json`**, so clearing the
  box in /admin actually clears it rather than resurrecting a committed value. The
  existing comment above `heroVideo` explains this trade; extend it to cover both
  rather than writing a second copy of it.
- `useHeroCustomHtml` is a boolean, so `preferText` does not apply: pass
  `entry.useHeroCustomHtml` straight through. Comment why — a boolean has no
  "blank" to fall back from, and an `??` chain onto a JSON fallback would make the
  toggle un-turn-off-able for the same reason `heroVideo` needed the treatment
  above.

**File**: `src/lib/pageCopyMerge.test.ts`

Extend the existing `mergeDonateFrame` cases: the markup passes through; a cleared
box yields `undefined` rather than a JSON value; the toggle passes through as
`false` (not swallowed into `undefined`), which is the case that would silently
strand a banner nobody can turn off.

### 7. The hero component

**File**: `src/components/donate/MomentumHero.astro`

- Accept `customHtml?: string` and `useCustomHtml?: boolean` props.
- Call `resolveHeroBanner` in the frontmatter and branch on `mode` **before** the
  existing markup: in `custom` mode render `<Fragment set:html={customHtml} />` and
  nothing else — no `<section>`, no scrim, no `hero-in`, no `GiveButton`. Same
  construct the base layout already uses for `customBodyHtml`, and the "no
  container, no spacing" requirement expressed in one line.
- Emit `data-preview-name` on a hidden marker the script can read (e.g.
  `<span hidden data-hero-preview-name={previewName} />`) in `custom` mode only, so
  the standard banner keeps its current server-side pin and no existing scenario
  changes.
- Extend the `<script>`: resolve the name once — the `previewName` marker first,
  then `nameFromSearch(window.location.search)` through `sanitizeFirstName` — then
  run the existing headline upgrade (unchanged, still skipped when `data-preview`
  is set) and call `applyNameTokens(document, name)`.
- Update the file's header comment. It currently documents two modes and states
  that "`image` does not step aside when `video` is set"; it must now also say that
  **custom HTML does** step aside from both, and why the fallback reasoning that
  justifies the photo/video stack deliberately does not extend to it.

### 8. Wiring and the advisory

**File**: `src/components/MomentumFundPage.astro`

Pass `customHtml={copy.heroCustomHtml}` and
`useCustomHtml={copy.useHeroCustomHtml}` into the hero. Nothing else in this
component changes.

**File**: `src/pages/donate.astro`

Add a fourth advisory `console.warn` beside the three already there, worded like
the `goalMetersMissingWidgetId` block: the custom-banner toggle is on with an empty
box, so the page renders no hero at all — paste the HTML in or switch the toggle
off. Advisory only, never build-failing.

### 9. Isolated capture frames

**New file**: `src/pages/isolated-components/MomentumHero-CustomHtml.astro`

**New file**: `src/pages/isolated-components/MomentumHero-CustomHtmlPersonalized.astro`

Follow the existing `src/pages/isolated-components/MomentumHero-Video.astro`:
import `src/styles/tokens.css`, wrap in `<div id="codeyam-capture">`, and pass a
realistic custom banner through the real component with `useCustomHtml` set — never
a hardcoded HTML string rendered directly, which would let the capture pass even if
the mode rule were never consulted. The second frame additionally sets
`previewName`, so the capture shows the name-filled branch and the `data-if-name`
paragraph, which is the state the campaign email actually produces.

## Reused existing code

- `sanitizeFirstName`, `heroGreeting`, `nameFromSearch` from
  `src/lib/personalize.ts` (glossary entries: `sanitizeFirstName`, `heroGreeting`,
  `nameFromSearch`) — unchanged. The custom-HTML path reuses the identical
  rejection rule rather than adding a second one, which is the whole reason the
  tokens are safe.
- `mergeDonateFrame` from `src/lib/pageCopyMerge.ts` (glossary entry:
  `mergeDonateFrame`) — extended, and its `heroVideo` clause is the exact
  precedent for the clearable `heroCustomHtml` field.
- `preferText` from `src/lib/pageCopyMerge.ts` — the site-wide "whitespace-only
  counts as empty" rule, used directly for the markup field.
- `goalMetersMissingWidgetId` from `src/lib/momentumSections.ts` (glossary entry:
  `goalMetersMissingWidgetId`) — the shape of step 8's advisory: deliberate but
  silent, so name it in the build log rather than failing the build.
- `sectionHeading` from `src/lib/momentumSections.ts` (glossary entry:
  `sectionHeading`) — the trim-to-blank convention `resolveHeroBanner` copies.
- `src/lib/momentumNetworkDom.ts` and `src/lib/momentumNetworkDom.test.ts` — the
  existing precedent for a DOM-touching module unit-tested under jsdom; steps 3
  and 4 follow it rather than inventing a second approach.
- `src/layouts/BaseLayout.astro` — the `<Fragment set:html>` construct step 7
  uses, already the site's way of injecting operator-authored markup with no
  wrapping element.
- `src/components/Embed.astro` — the existing `set:html` + `.trim()` pattern for
  operator-authored markup, and the model for the "raw escape hatch, unsanitized on
  purpose" comment the new code should carry.
- `src/data/collections.test.ts` — the bidirectional registry/schema guard already
  covers both new fields once step 5 lands; no new test is needed there.
- `src/pages/isolated-components/MomentumHero-Video.astro` and
  `src/pages/isolated-components/MomentumHero-VideoMissing.astro` — the frame
  pattern step 9 follows, including passing props through the real component.
- `resolveGiveHref` from `src/lib/giving.ts`, via
  `src/components/donate/GiveButton.astro` — untouched, and worth naming: a custom
  banner draws no Give button, so an author who wants a giving CTA writes their own
  `<a>` and owns its destination. The field hint should say so.

**Existing-implementation survey.** Grepped for an existing custom-HTML or
banner-mode capability before proposing one. Three raw-HTML injection points exist
on this site and **none** covers the hero:

- `customHeadHtml` / `customBodyHtml` (in `src/lib/pageCopyMerge.ts`, injected by
  `src/layouts/BaseLayout.astro`) — **site-wide** tags on every page. Not per-page,
  not a banner.
- `embedHtml` (rendered by `src/components/Embed.astro`, declared as a built-in
  extra on `pages` / `blog` / `events` in `src/data/collections.json`) —
  **per-page** frontmatter for one third-party widget, rendered inside an
  `.embed-html` div in the page body. Not available on `pageCopy` at all.
- `useCustomHtml` / `customHtml` on `momentumSections` — **planned, not built**.
  That plan is selected but unexecuted: `grep -rn 'customHtml' src/` returns
  nothing today, and the `momentumSections` schema in `src/content/config.ts`
  carries only `kind`, `title`, `layout`, `image`, `widgetId`, `group`, `order`,
  `comingSoon`, `draft`. Even once built it would not reach the hero, which is not
  a section.

The `pageCopy` hero fields today are `heroHeadlineNamed`, `heroHeadlineGeneric`,
`heroSubhead`, `heroImage`, `heroVideo`. There is no existing mode field, toggle,
or personalization-token mechanism this duplicates.

## Scenarios to Demonstrate

- **Photo banner — nothing changes.** `/donate` with the toggle off and no video:
  the hero exactly as it renders today. The regression floor.
- **Video banner — still unchanged.** The toggle off with a video path set: the
  looping backdrop over the photo, precisely as the existing video frame captures
  it now.
- **Toggle off with markup saved in the box.** The standard photo banner renders
  and the markup does not appear anywhere. The guarantee that makes drafting safe,
  and the most important scenario in this list.
- **Custom banner, generic visitor.** The toggle on: a bespoke banner with no
  photo, no scrim, no standard padding, running edge to edge because the markup
  says so — showing the author's fallback text and the `data-if-no-name`
  paragraph.
- **Custom banner, personalized.** The same banner with `previewName` set to
  `Nicole`: `data-first-name` filled, the `data-if-name` line shown, the
  `data-if-no-name` line gone.
- **Turn it on, then turn it off again.** The same page three times — photo
  banner, custom banner, photo banner restored identically, because the photo,
  headline, and subhead were never touched.
- **A hostile `?name=`.** `/donate?name=<script>alert(1)</script>` with the custom
  banner on: the value is rejected, the fallback text stands, and no markup is
  injected — the page is identical to the generic visitor's.
- **Toggle on, box empty.** The page renders with no hero at all, and the build
  output names the field so the state is diagnosable rather than mysterious.
- **The CMS editor.** The `pageCopy` form for /donate showing "Use custom HTML for
  the hero banner" and the Custom HTML box directly after Hero video, both always
  visible, with the hint carrying the three personalization tokens.
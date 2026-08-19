---
title: "NS -- Rebuild The Momentum Fund Page To The Campaign Design"
mode: ui
createdAt: "2026-08-19T14:25:37Z"
prefix: "NS"
source: manual
dependsOn: ["ns--hero-banner-photo-video-or-custom-html-with-live-personalization"]
---

## Summary

Rebuild `/donate` to the campaign design at
<https://www.subscribepage.com/a3d9j8>. The page keeps everything that makes it
editable — the reorderable `momentumSections` middle, the collections behind each
band, the hero and closing frame — and changes how every band *looks* and what it
*says*: an uppercase kicker over a large serif sentence-heading on every band,
navy and gold accent bands breaking up the paper ones, a two-column prose treatment
with a pull-quote card, a bordered four-up evidence strip, a numbered three-up gift
grid, and photo-led testimonial and closing bands.

Two bands are genuinely new: a gold **mission** band above the narrative, and a
closing ask that pairs a photo with the copy. Two more get real content for the
first time — the Givebutter progress band (built, but never added to the page) and
the testimonials band (built, but empty in production), which gains the two quotes
the mockup shows.

The palette is a hybrid, by decision: the site's Atlas crimson, ink, paper and
Crimson Pro stay as the base, and the mockup's navy, gold, teal and aqua join them
as campaign-page accent tokens. `/donate` gains the mockup's rhythm and weight
without seceding from harvardintech.com.

## Key Decisions

- **Hybrid palette — Atlas base, campaign accents.** The mockup runs on navy
  `#031a36`, gold `#f6c768`, teal `#049ca4`, hot pink `#ff315b`, cream `#f8f4ee`
  and Georgia. Adopting it whole would give the campaign page a typeface and a
  brand the rest of the site does not share, and `/donate` is linked from the site
  nav — a visitor crosses that boundary in one click. So the type stays Crimson Pro
  + Inter, the primary action stays Harvard crimson, and the mockup's navy, gold,
  teal and aqua enter as new tokens used for **band backgrounds and accents only**.
  Every structural decision in the mockup — band order, kicker-over-heading,
  bordered grids, photo treatments, spacing — is adopted unchanged, because that is
  what carries the design.

- **Every new band is a section kind, not hardcoded composition.** The mission
  band becomes a `mission` kind rather than markup inside `MomentumFundPage.astro`,
  so an editor can reorder it, rename it, draft it, and rewrite its prose exactly
  like every other band. The alternative — composing the new design directly in the
  page component — would match the mockup faster and quietly undo the editability
  the last several plans on this page were about.

- **The mockup's "impact" band is the existing `testimonials` band redesigned, not
  a new kind.** In the mockup, "Every number represents a story / One connection can
  change what's possible" sits over two photo-led quotes. That is a heading, a lede,
  and the testimonials collection — three things the page already models. Adding an
  `impact` kind would create a second band that renders testimonials, and an editor
  would have two indistinguishable options in the kind dropdown. Instead
  `testimonials` gains a kicker and a rendered markdown lede, and its cards become
  the alternating photo/quote rows. **This is the one place the answer to "new
  section kinds" was applied with judgment rather than literally**, and it is called
  out here so the choice is reviewable.

- **The narrative band gets a fourth layout rather than a fourth component.** The
  mockup's "Why support…" band is two columns of prose with a pull-quote beneath —
  no photo. `resolveLayout` already normalizes `image-left` / `image-right` /
  `text-only`, so this is a `columns` value in the same list, degrading to
  `text-only` like any other unrecognized input. One new string, no new renderer,
  and the CMS dropdown picks it up through the existing select-options test.

- **The progress band keeps the Givebutter widget.** The mockup draws its own bar
  with `$5,000 / $50,000` hardcoded and says in its own footnote that "the
  production meter will sync automatically with Givebutter." The site already
  shipped that sync as `GoalMeter.astro`. A hand-drawn bar on a static build cannot
  know the real raised figure, so replacing the widget would trade live numbers for
  a number that is wrong the day after it is typed. The band adopts the mockup's
  navy-and-gold chrome around the widget instead, and keeps the collapse-if-the-
  script-never-arrives behaviour untouched.

- **Gift pillars become numbered, and the icon field is removed rather than left
  dead.** The mockup replaces the three icon badges with `01` / `02` / `03` derived
  from card order. Keeping the `icon` field in the CMS while nothing renders it
  would leave an editor a control that silently does nothing — the exact failure
  the `sectionsWithIgnoredFields` idea exists to prevent elsewhere. So the field,
  its resolver, its glyph component, its test, and its isolated frame all go. This
  is the most reversible decision in the plan and the easiest to disagree with; it
  is a separate implementation step so it can be dropped without touching the rest.

- **The Momentum Network's visualization is not touched.** It shipped two commits
  ago, it is 27KB of bespoke canvas work, and the mockup only changes the band
  *around* it — kicker, heading, italic accent line, navy background, CTA. Restyling
  the chrome and leaving the visualization alone is what keeps this plan from
  swallowing that one.

- **Each band owns its background; the alternating tint stays for narratives
  only.** `tintedFlags` alternates the tinted band by counting `narrative` sections,
  which was right when the page was mostly prose. The mockup assigns a fixed
  background per band (gold mission, white evidence, navy progress, aqua impact,
  cream gifts, navy network, aqua close). Those are set by each component, so
  `tintedFlags` keeps working and keeps mattering exactly where it still applies —
  two `narrative` bands would still alternate. Changing it would move every band's
  background on a page that no longer wants alternation.

- **The kicker reuses the site's existing `.kick` class, not a new one.** Atlas
  already defines an uppercase mono kicker in `src/styles/tokens.css`, and
  `SponsorHero.astro`, `EventGallery.astro`, `VolunteerHero.astro` and
  `MomentumAccomplishments.astro` already use it. The mockup's eyebrow is the same
  idea; it needs colour modifiers (gold on navy, teal on aqua, white on the hero),
  not a parallel implementation.

- **The Colorado testimonial ships with a portrait gap, named rather than
  papered over.** `public/images/team/jessica-li.png` exists; there is no photo for
  Mohammed Ally anywhere in `public/images/`. `TestimonialCard.astro` already
  renders without a `photo`, so the entry ships photo-less and the plan names the
  file to drop in. Substituting a stock or unrelated face on a real person's
  attributed quote is not a thing to do quietly.

## Reference: the target structure

Captured from the mockup's own markup so this plan does not depend on the
subscribepage URL staying up. Band order, kicker → heading, and background:

| # | Band | Kicker | Heading | Background |
|---|---|---|---|---|
| 1 | Hero (frame) | The Momentum Fund | `{name}`, let's go further together. | navy photo + left gradient |
| 2 | Mission (new) | Our mission | Helping exceptional people *go further together.* | gold |
| 3 | Narrative "why" | Why support Harvard Alumni in Tech? | We are at an important turning point. | paper |
| 4 | Accomplishments | What we've accomplished so far | Momentum already exists. | white, bordered 4-up |
| 5 | Goal meter | Campaign progress · Live from Givebutter | Our first gifts are already building momentum. | navy + gold |
| 6 | Testimonials | Every number represents a story | One connection can change what's possible. | aqua, photo-led rows |
| 7 | Pillars | What your gift powers | Three ways support moves the Harvard Alumni in Tech community forward. | cream, bordered 3-up, numbered |
| 8 | Donors / Network | The people behind the fund | The Momentum Network | navy |
| 9 | Close (frame) | The Momentum Fund | Become part of the foundation. | aqua, photo left |

Structural details worth keeping: the hero copy is left-aligned in a
`min(760px, 68%)` column over a left-to-right navy gradient rather than centred
over a flat scrim; the evidence and gift grids are single-pixel bordered cells with
a crimson top rule rather than rounded cards; the testimonial quote sits under a
2px crimson rule with a 64px round portrait bordered in gold; event photos carry a
navy caption bar; and the closing band is a two-column split with a 20px gold rule
between photo and copy.

## Implementation

### 1. Campaign accent tokens

**File**: `src/styles/tokens.css`

Add the campaign accents to `:root` beneath the Atlas palette, commented as
`/donate`-scoped by convention (the file is the project's declared token source, so
they belong here rather than in a second stylesheet):
`--momentum-navy: #031a36`, `--momentum-navy-2: #081326`,
`--momentum-gold: #f6c768`, `--momentum-teal: #049ca4`,
`--momentum-aqua: #dcefeb`, `--momentum-cream: #f8f4ee`.

Add colour modifiers beside the existing `.kick` rule — `.kick--light`,
`.kick--gold`, `.kick--teal` — so every band's kicker is the same element with a
different accent. Do not change `.kick`'s own size, tracking, or family.

### 2. Section kicker, the `mission` kind, and the `columns` layout

**File**: `src/lib/momentumSections.ts`

- Add `'mission'` to `SECTION_KINDS` and a `SECTION_LABELS.mission` entry
  (`'Our mission'`) so a held-back mission band can name itself.
- Add `'columns'` to `SECTION_LAYOUTS`. `resolveLayout` needs no change — the new
  value is simply now in the accepted list, and anything unrecognized still falls
  back to `text-only`.
- Add `kicker?: string` to `SectionLike`, documented as applying to every kind
  (unlike `layout`, `image`, and `widgetId`, which are kind-specific).
- Add `sectionKicker(section, fallback?)` mirroring `sectionHeading` exactly —
  trim-to-blank, `undefined` when there is nothing to draw. A separate function
  rather than reusing `sectionHeading` because the two fall back to different
  things, and because a band with a heading and no kicker is a normal state.

**File**: `src/lib/momentumSections.test.ts`

Extend, in the file's existing comment-the-why style: `mission` is kept by
`orderedSections` and is not reported by `unknownSectionKinds`; `columns` survives
`resolveLayout` and a typo of it still degrades to `text-only`; `sectionKicker`
returns the trimmed value, falls back, and treats whitespace-only as blank;
`tintedFlags` is unchanged by a `mission` section sitting between two narratives
(the regression that a new kind could silently cause).

**File**: `src/content/config.ts`

Add `kicker: z.string().optional()` to the `momentumSections` schema, and
`linkLabel` / `linkUrl` (both optional strings) for the goal-meter band's "View the
campaign →" link. Comment them at the density of the `widgetId` and `group` blocks
above: which kinds use them, and that blank means "draw nothing".

**File**: `src/data/collections.json`

Add the matching `momentumSections` fields — `kicker` (text), `linkLabel` (text),
`linkUrl` (text) — and add `mission` to the `kind` select's options and `columns`
to the `layout` select's options. `src/lib/selectOptions.test.ts` asserts both
option lists equal `SECTION_KINDS` and `SECTION_LAYOUTS` exactly, and
`src/data/collections.test.ts` asserts the schema/registry pair in both directions,
so steps 2's three files land together or the suite fails.

### 3. Render markdown bodies for `mission` and `testimonials`

**File**: `src/lib/momentumSectionsContent.ts`

The `Content:` line renders the body only for `kind === 'narrative'`. Extend it to
`mission` and `testimonials`, which now carry prose of their own. Replace the
hardcoded comparison with a small `KINDS_WITH_BODY` set in
`src/lib/momentumSections.ts` so the fact lives beside the kinds it names and is
unit-testable, and update the comment above it — it currently asserts that the slot
bands draw content only from `donatePage.json` and the testimonials collection,
which stops being true here.

### 4. The mission band

**New file**: `src/components/donate/MomentumMission.astro`

Props: `kicker`, `title`, and the rendered body via slot. Gold background
(`--momentum-gold`), `.kick` with the default crimson accent, a serif heading
bounded to ~760px, and one paragraph of body copy in navy — the mockup's
`mission-band`. The heading supports an emphasized tail (`*go further together.*`
in markdown renders as `<em>`), which the component styles in crimson at the same
weight, so the accent is an authoring choice rather than a hardcoded span.

**File**: `src/components/MomentumFundPage.astro`

Add the `mission` case to the kind switch, passing `sectionKicker(section)`,
`sectionHeading(section)` and the body slot. Add `kicker` to the props each existing
band already receives (steps 5–10).

### 5. The narrative band

**File**: `src/components/donate/MomentumNarrative.astro`

- Accept and render `kicker` above the heading.
- Add the `columns` mode: full-width, no figure, prose in a two-column grid
  collapsing to one below 820px.
- Restyle the heading to the mockup's serif sentence scale
  (`clamp(38px, 4.5vw, 62px)`, tight tracking, navy) instead of the current
  800-weight sans.
- Restyle the slotted `blockquote` from a left-ruled inline quote to the mockup's
  white card — 28px/32px padding, 5px crimson left border, serif, sitting 48px
  below the prose.

### 6. The evidence band

**File**: `src/components/donate/MomentumAccomplishments.astro`

Take `kicker` as a prop instead of the hardcoded `<span class="kick">Momentum</span>`
it currently emits, add the large serif heading, and replace the
`auto-fit/minmax(240px)` grid with the mockup's four-up bordered strip (single-pixel
top and left rules on the grid, right and bottom on each cell) on a white band.

**File**: `src/components/donate/AccomplishmentCard.astro`

Card chrome to match: `min-height: 260px`, `#f6f3f0` fill, 3px crimson top rule
(already present), uppercase tracked label, serif body. Mostly a spacing and
sizing pass — this card is already the closest component to its mockup counterpart.

### 7. The progress band

**File**: `src/components/donate/GoalMeter.astro`

Add `kicker`, `linkLabel` and `linkUrl` props. Navy background
(`--momentum-navy-2`) with the mockup's soft gold radial, a gold `.kick--gold`, a
white serif heading left-aligned, and the optional gold underlined link on the
right of the same row, wrapping beneath the heading on narrow screens. The widget
sits below in its existing 720px column. **The collapse behaviour is unchanged** —
still `is-collapsed` until `customElements.whenDefined('givebutter-widget')`
resolves — so a blocked CDN still leaves no stranded band, which now matters more
because the band has a kicker and a link that would otherwise strand with it.

### 8. The impact / testimonials band

**File**: `src/components/donate/MomentumTestimonials.astro`

- Accept `kicker` and a body slot (the lede), rendered above the quotes.
- Replace the three-up card grid with alternating full-width rows: photo column and
  copy column, swapping sides on each successive testimonial, collapsing to
  photo-then-quote on one column below 820px.
- Aqua band background (`--momentum-aqua`).
- The band still renders nothing when the collection is empty — the existing
  guarantee, and now also true of its kicker and lede.

**File**: `src/components/donate/TestimonialCard.astro`

Restyle to the mockup's quote: no rounded card, a 2px crimson top rule, serif quote
at 19px, and a footer pairing a 64px round portrait bordered in gold with an
uppercase tracked cite block of name / affiliation / role. Accept the new
`affiliation`, `eventPhoto` and `eventCaption` props; the event photo renders as a
`<figure>` with a navy caption bar, and its absence simply drops the photo column.

**File**: `src/content/config.ts` and **File**: `src/data/collections.json`

Add `affiliation`, `eventPhoto` (image) and `eventCaption` to the `testimonials`
collection schema and editor fields.

### 9. The numbered gift grid

**File**: `src/components/donate/GiftPillars.astro`

Add `kicker`, the large serif heading, cream band background, and the mockup's
bordered three-up grid (`min-height: 320px` cells, single-pixel rules, translucent
white fill), collapsing to two columns with the last card spanning both below
820px.

**File**: `src/components/donate/GiftPillarCard.astro`

Take a `number` prop (the 1-based position, zero-padded by the parent) and render it
as the crimson `01` label where the icon badge is today. Drop the `PillarIcon`
import and the `icon` prop.

### 10. Remove the pillar icon

**Delete**: `src/components/donate/PillarIcon.astro`,
`src/pages/isolated-components/PillarIcon.astro`, `src/lib/pillars.ts`,
`src/lib/pillars.test.ts`.

**File**: `src/lib/site.ts` — drop the `PillarIcon` type and the `icon` key from
`DonatePageCopy['pillars']`.

**File**: `src/lib/donatePageContent.ts` — drop the `resolvePillarIcon` import and
the `icon` mapping in `loadPillars`, and the paragraph of comment explaining why the
field was free text.

**File**: `src/content/config.ts` and **File**: `src/data/collections.json` — remove
`icon` from the `pillars` collection schema and editor fields.

**File**: `src/data/donatePage.json` — remove the three `icon` keys.

Deliberately its own step: if the icons are wanted after all, drop this step and
keep step 9's numeral as an addition rather than a replacement.

### 11. The hero frame

**File**: `src/components/donate/MomentumHero.astro`

- Accept and render a `kicker` above the headline.
- Left-align the content in a `min(760px, 68%)` column, `min-height: 680px`,
  replacing the centred 900px block.
- Replace the flat two-stop scrim with the mockup's left-to-right navy gradient
  plus a soft bottom lift, keeping `z-index: 1` under the content and over the
  video so every existing fallback path (404, blocked autoplay, reduced motion) is
  unaffected.
- Serif headline at the mockup's scale; subhead at 18px in 82%-white.

This is the same file the hero-banner-modes plan edits. That plan is the
prerequisite: it introduces the mode branch that this styling sits inside, so the
custom-HTML banner correctly ignores every rule above.

### 12. The network band chrome

**File**: `src/components/donate/MomentumNetwork.astro`

Band-level only: navy background with the mockup's crimson radial, `.kick--light`
kicker, white serif `h2`, and an italic accent `h3` in the hot accent beneath it
(the mockup's "A grid, lit from within."). The existing tagline prop supplies that
line. **No change below the band header** — the visualization, its controls, the
supporter roll, and the search keep their current markup and behaviour.

Add `kicker` and keep every existing prop; `MomentumFundPage.astro` passes
`sectionKicker(section)` through.

### 13. The closing frame

**File**: `src/components/donate/MomentumClose.astro`

Replace the centred dark band with the mockup's two-column split: photo on the left
at `min-height: 520px` with a 20px gold right rule, copy on the right on aqua with a
teal `.kick--teal` kicker, navy serif heading, two body paragraphs, a navy button
carrying a `↗` glyph, and an uppercase tracked tagline beneath. Collapses to photo-
over-copy below 820px with the gold rule moving to the bottom edge.

New props: `kicker`, `image`, `tagline`. `body` splits on blank lines into
paragraphs so the mockup's two sentences do not need two fields.

**File**: `src/lib/site.ts`, **File**: `src/lib/pageCopyMerge.ts`,
**File**: `src/content/config.ts`, **File**: `src/data/collections.json`

Add `heroKicker`, `ctaKicker`, `ctaImage`, `ctaTagline` to `DonatePageCopy`, to
`mergeDonateFrame` (all via `preferText` against the JSON fallback, matching
`ctaTitle` / `ctaBody` beside them), to the `pageCopy` schema, and to the editor
fields.

**File**: `src/lib/pageCopyMerge.test.ts` — extend the `mergeDonateFrame` cases to
cover the four new fields, including that a cleared box falls back to the JSON
value (the opposite of `heroVideo`'s rule, and the reason the two are commented
differently).

### 14. Page copy and section content

**File**: `src/data/donatePage.json`

- `heroKicker`: `The Momentum Fund`
- `heroSubhead`: `Help build the foundation Harvard Alumni in Tech needs to sustain
  its momentum and serve a growing global community.`
- `ctaLabel`: `Become a Founding Supporter` — one field, so this relabels the hero,
  network and closing buttons together, which is what the mockup shows.
- `ctaKicker`: `The Momentum Fund`; `ctaTitle`: `Become part of the foundation.`;
  `ctaBody`: the mockup's two sentences separated by a blank line;
  `ctaTagline`: `One community. Shared momentum. A stronger network.`;
  `ctaImage`: an existing community photo from `public/images/gallery/`.
- Pillar card copy: `tech professionals` → `technology professionals`, matching the
  mockup.

**New file**: `src/content/momentumSections/mission.md` — `kind: mission`,
`order: 1`, kicker `Our mission`, title `Helping exceptional people *go further
together.*`, body the mockup's one paragraph, plus the editing note every section
entry in this collection carries.

**File**: `src/content/momentumSections/why.md` — kicker `Why support Harvard
Alumni in Tech?`, title `We are at an important turning point.`, `layout: columns`,
`order: 2`, and the body rewritten to the mockup's two prose columns plus the
closing pull-quote (`> The future of this network will not be built by chance…`).
The current `image: /images/gallery/event-04.jpg` is dropped with the photo layout.

**File**: `src/content/momentumSections/accomplishments.md` — kicker `What we've
accomplished so far`, title `Momentum already exists.`, `order: 3`.

**New file**: `src/content/momentumSections/goal-meter.md` — `kind: goal-meter`,
`order: 4`, kicker `Campaign progress · Live from Givebutter`, title `Our first
gifts are already building momentum.`, `linkLabel: View the campaign`,
`linkUrl` pointing at the Givebutter campaign. **`widgetId` is left blank and is a
named gap**: the band renders nothing and logs the existing advisory until the real
id is pasted in. Blank is deliberately not guessed — a wrong id renders someone
else's meter.

**File**: `src/content/momentumSections/testimonials.md` — kicker `Every number
represents a story`, title `One connection can change what's possible.`, `order: 5`,
body the mockup's lede paragraph.

**Delete**: `src/content/momentumSections/story.md`. Its heading ("And Every Number
Represents a Story") and its theme move into the testimonials band above, which is
where the mockup puts them; keeping it would render the same idea twice. Git retains
the copy. If a softer landing is wanted, set `draft: true` instead — but note a
drafted section still renders on the review track, so the duplicate would be visible
to Nicole.

**File**: `src/content/momentumSections/pillars.md` — kicker `What your gift
powers`, title `Three ways support moves the Harvard Alumni in Tech community
forward.`, `order: 6`.

**File**: `src/content/momentumSections/donors.md` — kicker `The people behind the
fund`, title `The Momentum Network`, `order: 7`.

**New file**: `src/content/testimonials/jessica-li.md` — the mockup's SF quote,
`name: Jessica Li`, `affiliation: Harvard University Alumni · Class of 2019`,
`role: San Francisco Event Lead`, `photo: /images/team/jessica-li.png`,
`eventCaption: Leaders in Engineering · San Francisco`, `order: 1`.

**New file**: `src/content/testimonials/mohammed-ally.md` — the mockup's Colorado
quote, `name: Mohammed Ally`, `affiliation: Harvard Extension School Alumni · Class
of 2023`, `role: HIT Colorado Co-Event Lead`, `eventCaption: HIT Colorado
Co-working Afternoon · Improper City`, `order: 2`, **no `photo`** — see the gap
below.

Every `momentumSections` entry in this repo carries a body explaining to an editor
what the band does and where its content lives. Those notes must be updated
wherever this plan changes the answer — in particular `story.md`'s deletion and the
new kicker field. Note that a queued plan
(`ns--fix-the-stale-editing-notes-on-the-momentum-fund-section-entries`) is already
in flight over these same notes; reconcile rather than overwrite.

### 15. Named content gaps

Not blockers — the page renders correctly without them — but they are the
difference between this page and the mockup, so they belong in the plan rather than
in a reviewer's head:

- **Mohammed Ally's portrait.** No file exists under `public/images/`. Drop one at
  `public/images/team/mohammed-ally.png` and add `photo:` to his entry.
- **The Givebutter widget id** for the progress band (step 14).
- **Event photos.** The mockup uses a four-image SF gallery and a Colorado event
  photo. Until real ones are supplied, point `eventPhoto` at the closest existing
  `public/images/gallery/event-*.jpg` and note the substitution in the entry body.
- **The closing band photo** — likewise from the existing gallery until a chosen
  one arrives.

### 16. Isolated capture frames

Following `src/pages/isolated-components/GiftPillars-DuplicatedBand.astro` — import
`src/styles/tokens.css`, wrap in `<div id="codeyam-capture">`, pass realistic props
through the real components:

**New**: `MomentumMission.astro`, `MomentumNarrative-Columns.astro`,
`GoalMeter-WithLink.astro`, `MomentumTestimonials-PhotoRows.astro`,
`GiftPillars-Numbered.astro`, `MomentumClose-Split.astro`.

**Update**: the existing `GiftPillars.astro`, `GiftPillarCard.astro`,
`MomentumTestimonials.astro`, `MomentumClose.astro`, `MomentumStats.astro`,
`GoalMeter.astro` and `GoalMeter-LongTitle.astro` frames for the changed props.
**Delete**: `PillarIcon.astro` (step 10).

## Reused existing code

- `orderedSections`, `unknownSectionKinds`, `tintedFlags`, `sectionHeading`,
  `resolveLayout`, `goalMetersMissingWidgetId`, `SECTION_KINDS`, `SECTION_LABELS`,
  `SECTION_LAYOUTS` from `src/lib/momentumSections.ts` (glossary entries:
  `orderedSections`, `unknownSectionKinds`, `tintedFlags`, `sectionHeading`,
  `resolveLayout`, `goalMetersMissingWidgetId`) — the whole section machinery is
  extended, not replaced. `sectionKicker` is modelled directly on `sectionHeading`.
- `resolveVisibility` from `src/lib/homeSections.ts` (glossary entry:
  `resolveVisibility`) — unchanged; `draft` and `comingSoon` keep winning ahead of
  the kind switch, including for the new `mission` kind.
- `cardsInGroup` / `selectGroup` from `src/lib/sectionGroups.ts` and `emptyGroups`
  — unchanged; the numbered pillars still select by group, so a duplicated gift
  band still numbers from `01` within its own band.
- `sortByOrder` from `src/lib/order.ts` (glossary entry: `sortByOrder`) — the
  testimonial rows alternate sides by their sorted index, so the ordering rule that
  already exists is what drives the layout.
- `mergeDonateFrame` and `preferText` from `src/lib/pageCopyMerge.ts` (glossary
  entry: `mergeDonateFrame`) — the four new frame fields follow the `ctaTitle` /
  `ctaBody` clause exactly, not the `heroVideo` one.
- `loadAccomplishments`, `loadPillars`, `loadDonateUrl`, `loadDonateFrame` from
  `src/lib/donatePageContent.ts` — unchanged apart from dropping the pillar icon
  mapping.
- `loadMomentumSections` from `src/lib/momentumSectionsContent.ts` — extended in
  step 3 only; both `/donate` and the isolated harness keep reading sections through
  it rather than growing a second pipeline.
- `publishedEntries` / `INCLUDE_DRAFTS` from `src/lib/drafts.ts` and
  `src/lib/draftVisibility.ts` — unchanged, and the reason the new mission and
  goal-meter sections can be drafted into the review track before going public.
- `resolveGiveHref` from `src/lib/giving.ts` via
  `src/components/donate/GiveButton.astro` (glossary entry: `resolveGiveHref`) —
  unchanged. Relabelling every button is one `ctaLabel` edit precisely because this
  already centralises the destination.
- `withBase` from `src/lib/url.ts` and `altFor` from `src/lib/media.ts` — the
  existing helpers every new image in this plan goes through, so the GitHub Pages
  subpath keeps working.
- `.kick`, `.wrap`, `.sec`, `.sec-head` in `src/styles/tokens.css` — the Atlas
  editorial idiom the new bands adopt rather than re-inventing; already used by
  `src/components/sponsor/SponsorHero.astro`,
  `src/components/landing/EventGallery.astro`,
  `src/components/volunteer/VolunteerHero.astro` and
  `src/components/donate/MomentumAccomplishments.astro`.
- `src/lib/selectOptions.test.ts` and `src/data/collections.test.ts` — the existing
  guards that force the new kind, the new layout and every new field to appear in
  both the schema and the editor registry; no new test is needed in either.
- `src/pages/isolated-components/GiftPillars-DuplicatedBand.astro` — the frame
  pattern step 16 follows.

**Existing-implementation survey.** Checked before proposing new fields:

- A **kicker** already exists site-wide as the `.kick` class and as a `kicker`
  field on `volunteerPage` and `sponsorPage` in `src/data/collections.json` — but
  **not** on `momentumSections`, whose schema carries only `kind`, `title`,
  `layout`, `image`, `widgetId`, `group`, `order`, `comingSoon`, `draft`. This plan
  adds the field there and reuses the class.
- A **goal meter** is fully built (`src/components/donate/GoalMeter.astro`, the
  `goal-meter` kind, `widgetId`, and the `goalMetersMissingWidgetId` advisory) and
  is simply **not on the page** — no entry exists in
  `src/content/momentumSections/`. This plan adds the entry rather than a second
  meter.
- **Testimonials** are fully built (`src/components/donate/MomentumTestimonials.astro`,
  `src/components/donate/TestimonialCard.astro`, the collection, the
  `testimonials` kind) with the
  collection deliberately empty — `src/content/testimonials/` holds only a
  `.gitkeep`. This plan restyles and seeds rather than rebuilds.
- **Per-band backgrounds** have no existing mechanism beyond `tintedFlags`'
  narrative alternation; each component sets its own, which is what the mockup
  needs and what the existing components already do (`MomentumStats` and
  `GoalMeter` both hardcode `--paper-2`).
- No existing `mission` kind, `columns` layout, `affiliation` / `eventPhoto` /
  `eventCaption` testimonial field, or `ctaImage` / `ctaTagline` / `heroKicker` /
  `ctaKicker` page-copy field. Nothing here duplicates a field that already exists.

## Scenarios to Demonstrate

- **The full page, generic visitor** — `/donate` end to end in the new design, all
  nine bands in order. The headline deliverable.
- **The full page, personalized** — the same page with `previewName` set, showing
  the hero greeting a named subscriber over the new left-aligned navy gradient.
- **The mission band** — the gold band with its crimson-emphasized heading tail,
  captured on its own.
- **The narrative in `columns` layout** — two columns of prose with the white
  pull-quote card beneath, and no photo.
- **The narrative still in `image-right`** — proof the new layout is an addition,
  not a replacement, and that existing narrative sections are unaffected.
- **The evidence strip** — the four bordered cells with crimson top rules, and the
  same band at two columns below 820px.
- **The progress band with a widget id** — navy and gold chrome, kicker, heading
  and the gold "View the campaign" link, with the Givebutter widget inside.
- **The progress band with no widget id** — the band renders nothing at all and the
  build names the section, exactly as today. The kicker and link do not strand.
- **The impact band with two testimonials** — alternating photo/quote rows on aqua,
  with the SF quote showing a portrait and the Colorado quote showing the
  portrait-less fallback.
- **The impact band with an empty collection** — nothing renders, kicker and lede
  included, which is production today.
- **The numbered gift grid** — `01` / `02` / `03` in the bordered cream grid, and a
  second grouped gift band numbering from `01` again within itself.
- **The network band** — new navy chrome, kicker, white heading and italic accent
  line, with the visualization inside visibly unchanged.
- **The closing band** — the aqua split with the gold rule, the navy `↗` button and
  the tagline; and the same band with no `ctaImage`, falling back to copy alone.
- **A section reordered and a section drafted** — the mission band moved below the
  narrative, and the progress band drafted, proving the redesign did not cost any
  editability.
- **The CMS editor** — the `momentumSections` form showing the new Kicker field and
  `mission` in the section-type dropdown, and the `pageCopy` form showing the four
  new frame fields.
- **Mobile at 390px** — the whole page in one column: hero copy full-width, prose
  single-column, evidence and gift grids at two columns with the last gift card
  spanning, testimonial photo above its quote, closing photo above its copy.
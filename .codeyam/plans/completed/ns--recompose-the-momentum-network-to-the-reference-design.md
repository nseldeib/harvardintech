---
title: "NS -- Recompose The Momentum Network To The Reference Design"
mode: ui
createdAt: "2026-08-20T15:39:48Z"
prefix: "NS"
source: manual
---

## Summary

Recompose The Momentum Network on `/donate` to the reference design the team
supplied: a black field of small crimson lights at real density, the campaign
heading overlaid on the artwork rather than stacked above it, and one bottom rail
carrying the find-your-place search, a live supporter count, and the giving CTA.
Hovering a light previews who it is; clicking still opens the badge that already
ships.

Nothing about who may be shown changes. Every reader-facing field continues
through `donorPublicIdentity`, the SVG stays server-rendered with the supporter
roll beneath it, and every string stays editable in the CMS.

## What this is NOT

The reference is **not** deck direction 01. Direction 01 is "Power grid at
night" — school junctions on a 4-column grid with each supporter hung off its
school by one feeder line, cream nodes on near-black with hot-pink trunk lines.
That is verified against every committed version of
`.codeyam/design/donor-network/src/variations.js`; the direction has never
rendered anything else, and the deck runs at 200 supporters where the reference
shows 100 with EMPTY/25/50/100 toggles.

The reference is a nearest-neighbour lattice — which is what `MomentumNetwork`
**already** draws. `nearestNeighborEdges` was the fix for Nicole's "it should
look like nodes, not a constellation" note. So this plan restyles and recomposes
shipped work; it does not port a deck direction, and it does not revisit the
topology.

## Root cause of the density gap

The band does not look sparse because of the palette. It looks sparse because of
a sizing interaction that magnifies a small canvas:

- `networkViewBox(count)` returns `sqrt(count * AREA_PER_SUPPORTER * ASPECT)`,
  clamped up by `MIN_VIEWBOX_WIDTH = 340`.
- At 19 supporters that computes to ~297, so it clamps to **340 x 212**.
- The SVG draws with `preserveAspectRatio="xMidYMid slice"`, which crops and
  scales that box to cover a stage of `clamp(22rem, 38vw, 34rem)`.

The result is a fraction of an already-tiny network, magnified — oversized dots
with large gaps, which is precisely what the current screenshots show. The floor
exists for a good reason (one supporter must not render as one enormous disc),
so it stays; what changes is that the drawn field no longer depends on the real
count alone.

## Key Decisions

- **Ambient points, and they are visibly second-class.** The team chose a field
  that reads full from day one. Real supporters draw bright with a bloom; ambient
  points draw dim, small, and flat. They are not clickable, not focusable, carry
  no haystack, appear in no detail record, are absent from the supporter roll,
  and are excluded from the count. The tagline names them for what they are. A
  page that implied more supporters than exist would be a page that lies about
  who gave, which no later edit takes back — so the honesty is structural, not a
  matter of styling restraint.

- **The count is always the real number.** It reads from `donors.length`, never
  from the drawn point total. This is the single assertion that keeps the ambient
  field from becoming a misrepresentation.

- **Crimson on black, per the team's choice.** `NETWORK_COLORS.background` moves
  from `#031731` to near-black and the node crimson stays Harvard `#A51034`. The
  module's existing warning still applies and is why the blooms stay dim: crimson
  bloomed at low opacity over navy mixed to a purple-magenta wash, a colour the
  direction rules out by name. Black lowers that risk but does not remove it, so
  bloom opacity is capped and the connections stay the cooler tone that keeps the
  stacked light in family.

- **The heading moves onto the artwork; the kicker and roll do not.** The
  reference overlays only the headline and its tagline. The supporter roll stays
  in `.wrap` below, because it is the accessibility guarantee and belongs in the
  page's normal reading order, not over a dark field.

- **Hover previews, click opens.** Hover shows name, school and class year — the
  card in the reference. Click keeps the existing panel with the share message
  and the LinkedIn/Facebook links. Hover has no touch equivalent, which is
  exactly why click cannot be replaced by it.

- **Density toggles are not shipped.** EMPTY/25/50/100 is deck furniture for
  walking a reviewer through campaign growth. On the live page it would let a
  visitor fake the supporter count.

- **`.network-stage` is already full-bleed.** It sits outside `.wrap` and spans
  the band today. The composition work is the taller stage, the overlaid heading,
  and the rail — not a break-out.

## Anonymity, unchanged and re-checked

`momentumNetworkDom.test.ts` asserts that a `data-selectable="false"` node opens
no panel, matches no search, and ignores its slug in `?supporter=`. The hover
card reads that same flag, so an anonymous supporter is drawn, counted, and
still cannot be previewed, opened, searched or linked. This extends the existing
rule rather than adding a parallel one; no new guard is introduced, and no tested
invariant is contradicted.

## Implementation

### 1. Palette and field

**File**: `src/lib/momentumNetwork.ts`

- Move `NETWORK_COLORS.background` to near-black; keep `node`, `edge`, `active`
  semantics and their documented meanings.
- Add ambient point generation: seeded from the same PRNG stream so the field is
  reproducible, positioned to fill the drawn box, returned as their own list so
  no consumer can mistake one for a supporter.
- Size the drawn field so the visible density matches the reference at low real
  counts, rather than letting `slice` magnify the `MIN_VIEWBOX_WIDTH` floor.

### 2. Composition

**File**: `src/components/donate/MomentumNetwork.astro`

- Overlay heading and tagline on the stage, left-aligned, with a legibility
  gradient behind them.
- Taller stage.
- Bottom rail: search left; count and `GiveButton` right.
- Ambient layer rendered beneath the edges, `aria-hidden`, non-interactive.
- Hover card element, populated from the existing details payload.

### 3. Hover wiring

**File**: `src/lib/momentumNetworkDom.ts`

- Extend the existing `pointerenter` handler (already present for the sound
  pulse) to position and fill the hover card; clear on `pointerleave`. Guard on
  `data-selectable`.

### 4. Copy — schema, registry, defaults

- New keys for the count label and the rail CTA label in
  `src/content/config.ts`, registered in `src/data/collections.json` so an editor
  can reach them, with defaults in `src/data/donatePage.json` and
  `src/content/pageCopy/donate.md`.
- Pass them through `src/components/MomentumFundPage.astro`.

## Scenarios

| Scenario | State it pins |
|---|---|
| Day one, the grid unlit | Production default — ambient field, invitation, CTA, count reads zero |
| The first gift | One real light among ambient points |
| Nineteen supporters | The realistic near-term state, at reference density |
| The campaign at scale | ~100+, the reference's density |
| A supporter hovered | The new preview card |
| A supporter selected | Hover card into full badge, gold node |
| Anonymity among named | Present and indistinguishable, inert and unsearchable |

## Trade-offs

- **Ambient points are a real cost.** They make the picture read full before the
  campaign is, and no amount of styling fully removes the possibility that a
  casual reader reads density as popularity. The count, the roll and the tagline
  are the three places that keep the page honest, and all three must stay
  correct. If the team later prefers truth over fullness, removing the ambient
  layer is a one-line change and the rest of this plan stands.
- **Black is a stronger break from the campaign page than navy was.** The band
  sits between light ones and will read as a hard cut. That is what the reference
  does, and it is the team's choice.
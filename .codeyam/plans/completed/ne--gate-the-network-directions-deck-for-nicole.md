---
title: "ne -- Gate The Network Directions Deck For Nicole"
mode: ui
createdAt: "2026-08-05T16:59:18Z"
prefix: "ne"
source: manual
---

## Summary

The nine-directions design deck is deployed and **publicly readable right now**:
`https://nseldeib.github.io/harvardintech/donor-network.html` returns HTTP 200 to
anyone, with no passphrase. Jared wants to send the link to Nicole, so it needs a
gate first.

`public/donor-network.html` is a raw file in `public/`, copied verbatim into
`dist/`, so no Astro component ever touches it — which is why the site-wide
`PreviewGate.astro` does not apply. `public/review/index.html` hit this same wall
in July and solved it by inlining its own always-on gate; this plan follows that
precedent exactly.

Nicole will send her reactions in a separate doc, so the in-page reviewer
feedback (per-card 1–10 rating, comment boxes, overall notes, export/clear) comes
out entirely. It was built on the assumption that a published artifact cannot post
anywhere — true, but moot once feedback arrives by another channel, and nine
rating sliders on a page nobody will type into is just noise between her and the
designs.

## Key Decisions

- **An always-on inline gate, NOT `PreviewGate.astro`.** The site-wide gate keys
  off `PREVIEW_GATE`, which `deploy.yml` deliberately leaves unset on the public
  track. At the Strikingly cutover `main` becomes `harvardintech.com`, so a deck
  relying on that gate would **silently un-gate itself** at exactly the moment the
  site becomes public. Internal design exploration must stay private permanently,
  which means the gate cannot be env-conditional. This is presumably why
  `/review/index.html` hand-rolled its own rather than reusing the component.

- **Deterrent-level privacy, and the page says so.** The passphrase ships in the
  page source; anyone who opens dev tools can read the directions. It stops search
  engines, casual browsing, and a forwarded link — not a determined viewer. That is
  acceptable here because the 200 supporters are fabricated by `build-donors.py`
  and no real donor data exists yet. Real per-person auth (Cloudflare Access) stays
  available as a follow-on and is out of scope.

- **The passphrase is `crimson2026`, shared with the rest of the review site.**
  One passphrase for everything a reviewer opens. To avoid pasting the literal a
  third time (it already lives in `previewGate.ts` and `review/index.html`),
  `build.py` reads the default out of `src/lib/previewGate.ts` and fails loudly if
  it cannot find it — a build that cannot resolve the passphrase must not emit a
  page with an empty one.

- **Scenarios drive the real gate rather than bypassing it.** The earlier idea of a
  `localhost` bypass is dropped: `project-review-unlocked-status` already captures
  a gated static page by filling `#pass` and clicking `#enter` in its
  `interactions`. Reusing that keeps the captured page byte-identical to the
  deployed one, with no screenshot-only code path.

- **`noindex` as well, even though `robots.txt` already covers it.** The deployed
  review track serves `Disallow: /` (verified live), so crawlers are already warned
  off today. But `robots.txt` flips to `Allow: /` at the cutover while this page
  stays internal, so the meta tag has to be on the page itself to outlive that.

- **Edit `src/`, never the generated outputs.** `build.py` owns
  `public/donor-network.html` and `artifact-body.html`. Hand-editing either is the
  drift the build script exists to prevent.

## Implementation

### 1. The gate

**File**: `.codeyam/design/donor-network/src/shell.html`

Add `#gate` markup above `.deck` and wrap the existing deck in `#content`,
mirroring `public/review/index.html:127-140`: a centred box with an `#pass`
password input, an `#enter` button, and an `#err` line. Include the same
"deterrent, please don't forward" note the review page carries in its footer, so
Nicole understands the sharing model.

The unlock script goes in `shell.html` as its own inline `<script>`, not in
`shell.js`: `build.py` concatenates every JS source into one trailing `<script>`
tag, and the gate has to run before the deck paints. Key it on `sessionStorage`
under `hait-network-ok` — its own key, so unlocking the deck does not silently
unlock `/review/` or vice versa.

**File**: `.codeyam/design/donor-network/src/shell.css`

Gate styles, reusing the deck's existing crimson tokens. `#content { display: none }`
until unlocked.

**File**: `.codeyam/design/donor-network/build.py`

- Read the passphrase default out of `src/lib/previewGate.ts` and substitute it
  into the gate script; raise if the pattern does not match.
- Add `<meta name="robots" content="noindex, nofollow">` to the `PUBLIC_OUT` head.
  Not to `ARTIFACT_OUT` — the Artifact publisher supplies its own `<head>`, which
  is why that output gets only a `<title>` line today.
- Fix `TITLE`: it says "eight directions" for nine.

### 2. Remove the reviewer feedback

**File**: `.codeyam/design/donor-network/src/shell.js`

Delete `buildFeedback()` and its call, the session-notes block, the `exportBtn`
and `clearBtn` handlers, and the now-unused `KEY` / `load()` / `saveAll()` / `data`
state. Update the module's header comment, which currently describes collecting
ratings. The overlay, keyboard navigation, and card mounting are untouched.

**File**: `.codeyam/design/donor-network/src/shell.html`

Drop the "Export all feedback" / "Clear feedback" buttons, the "Rate each 1–10"
note, and the `#sessionNotes` textarea. Keep "Click any card to open it
full-screen" and add a line telling Nicole where to send comments.

**File**: `.codeyam/design/donor-network/src/shell.css`

Remove the `.fb-*` block (`shell.css:223-294`).

`engine.js`'s **"Download supporter card"** stays — that is a feature of the
directions being evaluated, not a review mechanism.

### 3. Link it from the internal review index

**File**: `public/review/index.html`

Add a card linking to `/donor-network.html`, so there is one internal link that
reaches everything under review. Hand-edited: this page is not generated.

### 4. Regenerate

`python3 .codeyam/design/donor-network/build.py` — rewrites
`public/donor-network.html` and `artifact-body.html`. Both are committed.

## Reused existing code

- `public/review/index.html:30-58` (gate CSS), `:127-140` (gate markup),
  `:380-415` (unlock script) — the pattern being followed.
- `.codeyam/scenarios/project-review-unlocked-status.json` — the `interactions`
  shape that captures a gated static page.
- `src/lib/previewGate.ts` — source of the passphrase default.
- The deck's existing crimson tokens in `shell.css`.

## Scenarios to Demonstrate

- **Supporter Network - Nine Directions** (existing, re-capture): gains the
  fill-`#pass` / click-`#enter` interactions. Re-capturing is required regardless
  of the gate — removing the rating panel from every card changes the deck's
  layout, so the committed Desktop and Mobile screenshots are stale.
- **Supporter Network - Gate Locked** (new): the passphrase prompt with the deck
  blurred behind it — what a stranger with the URL sees. Desktop and Mobile, since
  the link is as likely to be opened on a phone.

The deck carries no seed. Its data states (day-one empty, sparse, rich, full 200)
are switchable inside the page from inlined illustrative data, because a published
artifact runs under a CSP that blocks every external host.

## Out of scope (this cycle)

- **Real authentication** (Cloudflare Pages + Access, per-person email OTP). The
  documented-but-not-chosen alternative in the two-track publishing plan; still the
  answer if deterrent-level privacy proves insufficient.
- **Keeping internal artifacts off the public build at cutover.** `public/` ships
  wholesale, so `/review/`, `/donor-network.html` and the 13 mockups under
  `/design-review-4ece6c14/` will all land on `harvardintech.com` behind nothing
  but their own inline gates. Worth a checklist item on
  `migrate-harvardintech-com-off-strikingly`, not a change here.
- **Acting on Nicole's answers.** The three open questions the deck raises (tiers
  with no dollar input, `school`/`gradYear` absent from `DonorLike`, the anonymity
  contract vs. search) stay open questions on the page.
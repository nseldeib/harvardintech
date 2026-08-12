# Supporter recognition — the review page

The single page Nicole is sent about supporter recognition. Served at
`/donor-network.html` on the gated deploy, and linked from the internal
`/review/` status page so one link reaches everything under review.

Three parts, in the order they have to be read:

1. **The wall as it stands (W1–W5).** What is shipped on `/donate` today. This
   section exists because it was the gap: the one part of supporter recognition
   that is actually built was the one part the review never pointed at, so nine
   alternatives were being judged against nothing. It shows the REAL component,
   through the screenshots the committed scenarios already capture —
   `donor-wall-three-levels-and-twenty-names` and
   `donor-wall-empty-the-invitation`, inlined by `build.py`. A redrawn wall would
   diverge from the shipped one on the first fix, and the copy that diverges is
   always the one already sent to the reviewer. If either scenario is renamed,
   `build.py` fails loudly rather than emitting a broken `<img>`.
2. **Nine directions (01–09).** Seven readings of Nicole's note plus two
   off-brief controls, each carrying a different candidate name so the naming
   question is judged in place.
3. **The spreadsheet import (I1–I4).** A walkthrough, not working software. Its
   rules live in `src/lib/donorImport.js` with tests; see below.

Everything reviewable carries a quotable id, and the four families cannot
collide in a doc — `W` for what is built, bare numbers for the directions, `I`
for the import steps, `Q` for the open questions. The open questions used to
render as a bare `1.`–`4.` list, which meant "3" was ambiguous against direction
`03` the moment anyone wrote it down.

## The page is passphrase-gated, and the gate is its own

`shell.html` carries an always-on passphrase prompt. Three things about it are
easy to get wrong:

- **It does not use `PreviewGate.astro`.** It cannot — this is a raw `public/`
  file, so no Astro component ever renders it. More importantly it *should* not:
  that component keys off `PREVIEW_GATE`, which `deploy.yml` deliberately leaves
  unset on the public track, so an inherited gate would un-gate this deck at the
  Strikingly cutover — exactly when internal design exploration must stay
  private. `public/review/index.html` hand-rolls its own gate for the same
  reason.
- **The passphrase is not written here.** `shell.html` holds a
  `__PASSPHRASE__` token that `build.py` replaces with the default parsed out of
  `src/lib/previewGate.ts`, so rotating it there moves this deck, `/review/` and
  the gated site build together. `build.py` fails loudly rather than emitting a
  gate that opens on the empty string.
- **The gate covers the deck; it does not hide it.** `#content` is never
  `display: none`, because the nine miniatures mount on load and the engine
  measures its container — a hidden deck would build nine zero-height canvases
  and unlock to an empty page.

Deterrent-level privacy: the directions are still in the page source. It stops
search engines (helped by the `noindex` meta `build.py` emits), casual browsing,
and a forwarded link — not a determined viewer. Acceptable because no real donor
data exists here; see "The data is not real" below. Real per-person access
control means a host that can check a password server-side.

The scenario captures type the passphrase (`fill #pass`, `click #enter`) rather
than bypassing it, so what is screenshotted is the page as it actually ships.

## It collects nothing

The deck once carried a 1–10 rating and comment box per card plus a text-file
export. Nicole sends reactions in a separate doc, so all of it was removed —
nine sliders nobody will touch only sit between her and the designs.

That decision stands, and the page now leans into it rather than merely living
with it: the closing section is an outline mirroring every id, meant to be pasted
into the doc and typed under. The feedback path is the doc; the page's job is to
make starting that doc take one click instead of twenty minutes of transcription.

The copy button uses `document.execCommand('copy')` on a selection rather than
`navigator.clipboard`. The async Clipboard API is gated by permissions policy, so
in an iframe without an explicit grant it does not simply fail — it logs a policy
violation, which fails scenario captures. `execCommand` is subject to no such
policy, works from a `file://` open, and degrades into something useful rather
than into nothing: a refused copy still leaves the outline selected.

## The import rules live in src/, like everything else pure here

`src/lib/donorImport.js` (UMD, inlined by `build.py`, imported by
`src/lib/donorImport.test.ts` — 25 tests). Same arrangement and same reason as
`donorNetwork.js` and `reviewGate.js`: one copy, and vitest's `include` is
`src/**` so a module parked in `.codeyam/` is a module no test can reach.

The rule it really enforces is that an import may not GUESS. `tier`, `founding`
and `anonymous` come back as unresolved decisions on every run — they are
properties of the file's SHAPE, not of any row, so a spreadsheet where every row
is spotless still stops in the same place. A summary that hid them on a clean
file would report success for a job it did a third of, and each wrong guess has a
specific cost: a misstated giving level, a badge nobody earned, or a name
published against an explicit request to withhold it. Only the last is
unrecoverable, which is why re-importing someone who is anonymous on the wall is
the one duplicate that blocks rather than merely asks.

## The outline is generated, and the ids are one rule

`src/lib/reviewOutline.js` (UMD, same arrangement) holds the id vocabulary and
builds the doc outline from the **live** directions list the deck renders its
cards from — not a transcription of it. Rename a direction and a hand-copied
outline keeps the old name; because the outline is what the reviewer types into,
that staleness lands in their feedback rather than in a build. A test asserts
every id family appears, so adding a `W6` without an outline line fails.

`directionLabel` exists because the page contradicted itself. `variations.js`
carries `num` as a NUMBER, so the card badge and the full-screen bar rendered
`3` while the contents list, the open questions, this README and the outline all
said `03`. An id scheme whose whole purpose is that a reviewer writing "3" means
exactly one thing cannot afford to label the card differently from the line they
type under, so both now go through the one rule.

`upload-sample.json` is the stand-in for the bi-weekly spreadsheet. Every row in
it earns its place by being a case the importer must decide something about —
padding and case, a dropped accent, a suffix that may be a relative, a school
written out in full, a missing class year, an anonymity request sitting in the
name column, a blank name. Fourteen clean rows would let the walkthrough claim a
success it never had to work for.

## Regenerating

```
python3 .codeyam/design/donor-network/build-donors.py   # only to reshuffle the data
python3 .codeyam/design/donor-network/build.py          # after any src/ edit
```

`build.py` writes two outputs and both are committed:

| Output | Why it exists |
|---|---|
| `public/donor-network.html` | A complete document, so the codeyam preview can navigate to it and a reviewer can open it from a `file://` path if a link ever fails. |
| `artifact-body.html` | The same page **without** `<!doctype>/<html>/<head>/<body>` — the Artifact publisher supplies that skeleton itself and nests a second `<html>` badly if handed one. |

They are generated rather than hand-maintained because two hand-edited copies of
a page this size diverge on the first fix, and the one that diverges is always
the one already sent to the reviewer. **Edit `src/`, never the outputs.**

## Why everything is inlined

The donor data, the CSS, and the rules module are all inlined rather than
fetched. A published artifact runs under a CSP that blocks every external host,
and a `file://` open blocks even a same-directory `fetch()`. Inlining is the only
form that works in all three places the page has to render.

## Where the logic lives

The pure rules — the anonymity contract, milestone crossing, even-thinning, the
seeded PRNG — are in **`src/lib/donorNetwork.js`**, not here. They sit under
`src/` because vitest's `include` is `src/**`: a module parked beside the
exploration in `.codeyam/` is a module no test can reach. `build.py` inlines that
file verbatim and `src/lib/donorNetwork.test.ts` covers it, so there is one copy
rather than two that can quietly disagree about who may be looked up by name.

## The data is not real

`donors.json` is 200 fabricated supporters from `build-donors.py`, seeded so
regenerating never reshuffles the network under a screenshot someone has already
commented on. The first eighteen names are the curated set already committed in
`src/pages/isolated-components/[name].astro`, reused so the explorations show the
same people the existing donor-wall scenarios show. **No real donor appears
anywhere in this directory** — Harvard in Tech has no donor list yet, and
production starts empty and stays empty until the first upload.

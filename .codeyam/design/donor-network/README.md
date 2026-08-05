# Supporter network — design explorations

Nine directions for the Harvard in Tech supporter recognition page, built from
Nicole's note. Served at `/donor-network.html` on the gated deploy, and linked
from the internal `/review/` status page so one link reaches everything under
review.

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

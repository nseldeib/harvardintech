#!/usr/bin/env python3
"""Assemble the donor-network exploration page from src/ into two outputs.

Two outputs from one source because the page has two audiences with
incompatible packaging rules:

  public/donor-network.html         a complete document, so the codeyam preview
                                    can navigate to it and Nicole can open it
                                    from a file:// path if a link ever fails.
                                    A flat file rather than a directory with an
                                    index.html: Astro's dev server serves
                                    public/ without directory-index resolution,
                                    so `/donor-network/` 404s in the preview
                                    even though GitHub Pages would resolve it.

  artifact-body.html                the same page WITHOUT <!doctype>/<html>/
                                    <head>/<body>, because the Artifact
                                    publisher supplies that skeleton itself and
                                    nests a second <html> badly if handed one.

Keeping them generated rather than hand-maintained is the whole point: two
hand-edited copies of a thousand-line page diverge on the first fix, and the
one that diverges is always the one already sent to the reviewer.

The donor data is inlined rather than fetched — a published artifact runs under
a CSP that blocks every external host, and a file:// open blocks even a
same-directory fetch(). Inlining is the only form that works in all three
places the page has to render.

Usage: python3 build.py
"""

import base64
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PUBLIC_OUT = os.path.join(REPO, "public", "donor-network.html")
ARTIFACT_OUT = os.path.join(HERE, "artifact-body.html")
PREVIEW_GATE_TS = os.path.join(REPO, "src", "lib", "previewGate.ts")
SHOTS = os.path.join(REPO, ".codeyam", "scenarios", "screenshots")

TITLE = "Harvard in Tech — Supporter recognition review"

# The wall section shows the REAL component, by way of the screenshots the
# committed scenarios already capture. Not a redrawn approximation: two copies of
# a page diverge on the first fix and the one that diverges is always the one
# already sent to the reviewer — the same reasoning that makes this whole page
# generated rather than hand-maintained.
#
# They are inlined as data URIs rather than referenced from public/ because this
# body also ships as `artifact-body.html`, which renders under a CSP that blocks
# every external host, and because the page has to survive a `file://` open. It
# costs a few hundred KB; a review page that renders everywhere is worth it.
WALL_SHOTS = {
    "__WALL_CAPTURE__": "donor-wall-three-levels-and-twenty-names--desktop.png",
    "__WALL_EMPTY_CAPTURE__": "donor-wall-empty-the-invitation--desktop.png",
}

# The page is an internal design artifact that must never be indexed. Note this
# is belt-and-braces rather than the only protection today: the gated review
# deploy already serves `Disallow: /` from src/pages/robots.txt.ts. But that
# flips to `Allow: /` at the Strikingly cutover while this deck stays internal,
# so the directive has to live on the page itself to outlive the switch.
ROBOTS_META = '<meta name="robots" content="noindex, nofollow">'

PASSPHRASE_TOKEN = "__PASSPHRASE__"


def read(*parts):
    with open(os.path.join(SRC, *parts), encoding="utf-8") as f:
        return f.read()


def passphrase():
    """The review site's shared passphrase, read from `src/lib/previewGate.ts`.

    Parsed rather than duplicated so rotating it in one place moves this deck,
    `public/review/index.html` and the gated site build together. Raises rather
    than falling back to a literal: a build that cannot resolve the passphrase
    must not quietly emit a page whose gate opens on the empty string.
    """
    with open(PREVIEW_GATE_TS, encoding="utf-8") as f:
        source = f.read()

    match = re.search(
        r"PREVIEW_GATE_PASSPHRASE\s*=\s*[\s\S]*?\|\|\s*'([^']+)'", source
    )
    if not match:
        raise SystemExit(
            f"could not find the PREVIEW_GATE_PASSPHRASE default in {PREVIEW_GATE_TS}. "
            "It moved or was rewritten — fix this parse rather than hardcoding the "
            "passphrase here, or the gate will drift from the rest of the review site."
        )

    value = match.group(1)
    # A blank passphrase must never reach the page. `passphraseAccepted` refuses
    # one at the point of decision too, but failing here means a broken build
    # rather than a deployed page that opens for anyone who clicks the button.
    if not value.strip():
        raise SystemExit(
            f"the PREVIEW_GATE_PASSPHRASE default in {PREVIEW_GATE_TS} is blank. "
            "Refusing to emit a gate that opens on an empty string."
        )
    return value


def wall_shot(filename):
    """One committed scenario screenshot, as a data URI.

    Raises rather than emitting a blank `src`: the wall section is the review's
    "here is what you already have", and a broken image there would silently turn
    it into a page of assertions about a wall the reviewer cannot see. A missing
    capture means the scenario was renamed or dropped, which is worth failing the
    build over.
    """
    path = os.path.join(SHOTS, filename)
    if not os.path.exists(path):
        raise SystemExit(
            f"missing scenario screenshot {filename} under .codeyam/scenarios/screenshots. "
            "The wall section shows the real component through its captured scenarios, so "
            "re-capture that scenario rather than removing the image — a review page that "
            "describes a wall without showing it is the gap this section exists to close."
        )
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode("ascii")


def build_body():
    with open(os.path.join(HERE, "donors.json"), encoding="utf-8") as f:
        data = json.load(f)

    # The stand-in for the bi-weekly spreadsheet. Inlined for the same reason the
    # supporters are: the page must render with nothing fetchable.
    with open(os.path.join(HERE, "upload-sample.json"), encoding="utf-8") as f:
        upload = json.load(f)

    # The pure rules live under src/ so vitest can reach them (its `include` is
    # `src/**`), and are inlined here rather than fetched — a published artifact
    # runs under a CSP that blocks every host, and a file:// open blocks even a
    # same-directory fetch. One file, two consumers, no second copy to drift.
    with open(os.path.join(REPO, "src", "lib", "donorNetwork.js"), encoding="utf-8") as f:
        rules = f.read()

    # The import walkthrough's rules, from src/ for exactly the same reasons —
    # one copy, and vitest can reach it there (src/lib/donorImport.test.ts).
    with open(os.path.join(REPO, "src", "lib", "donorImport.js"), encoding="utf-8") as f:
        import_rules = f.read()

    # The id vocabulary + the doc outline. Inlined BEFORE shell.js and import.js
    # because both call into it at parse time — shell.js to label every card,
    # import.js to render the outline.
    with open(os.path.join(REPO, "src", "lib", "reviewOutline.js"), encoding="utf-8") as f:
        outline_rules = f.read()

    # The gate's accept/refuse rule, from src/ for the same reason: one copy, and
    # vitest can reach it there. It is emitted in its own <script> BEFORE the
    # markup, because the gate script is inline in shell.html and runs at parse
    # time — the bundle below the markup would not be defined yet.
    with open(os.path.join(REPO, "src", "lib", "reviewGate.js"), encoding="utf-8") as f:
        gate_rules = f.read()

    # The gate's passphrase is substituted in rather than written in shell.html,
    # so the source carries no copy of it to drift from previewGate.ts.
    shell = read("shell.html")
    if PASSPHRASE_TOKEN not in shell:
        raise SystemExit(
            f"shell.html no longer contains {PASSPHRASE_TOKEN}. Either the gate was "
            "removed — in which case delete this substitution too — or the token was "
            "renamed and this page would ship a gate that opens on the literal string."
        )
    shell = shell.replace(PASSPHRASE_TOKEN, passphrase())

    # The wall captures. Substituted rather than referenced so the section works
    # from a file:// open and under an artifact CSP, same as everything else here.
    for token, filename in WALL_SHOTS.items():
        if token not in shell:
            raise SystemExit(
                f"shell.html no longer contains {token}. Either the wall section was "
                "removed — in which case drop this substitution too — or the token was "
                "renamed and the page would ship an <img> pointing at a literal string."
            )
        shell = shell.replace(token, wall_shot(filename))

    parts = [
        "<style>",
        read("shell.css"),
        read("engine.css"),
        read("variations.css"),
        read("review.css"),
        "</style>",
        "<script>",
        gate_rules,
        "</script>",
        shell,
        "<script>",
        "window.HIT_DATA = " + json.dumps(data, ensure_ascii=False) + ";",
        "window.HIT_UPLOAD = " + json.dumps(upload, ensure_ascii=False) + ";",
        rules,
        import_rules,
        outline_rules,
        read("engine.js"),
        read("variations.js"),
        read("shell.js"),
        read("import.js"),
        "</script>",
    ]
    return "\n".join(parts)


def main():
    body = build_body()

    os.makedirs(os.path.dirname(PUBLIC_OUT), exist_ok=True)
    with open(PUBLIC_OUT, "w", encoding="utf-8") as f:
        f.write(
            "<!doctype html>\n<html lang=\"en\">\n<head>\n"
            "<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
            # PUBLIC_OUT only: ARTIFACT_OUT has no <head> of its own to put this
            # in — the Artifact publisher supplies the skeleton, which is why
            # that output gets a bare <title> line and nothing else.
            f"{ROBOTS_META}\n"
            f"<title>{TITLE}</title>\n"
            "</head>\n<body>\n" + body + "\n</body>\n</html>\n"
        )

    with open(ARTIFACT_OUT, "w", encoding="utf-8") as f:
        f.write(f"<title>{TITLE}</title>\n" + body + "\n")

    for p in (PUBLIC_OUT, ARTIFACT_OUT):
        print(f"wrote {os.path.relpath(p, REPO)} ({os.path.getsize(p):,} bytes)")


if __name__ == "__main__":
    main()

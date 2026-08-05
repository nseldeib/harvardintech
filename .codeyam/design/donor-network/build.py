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

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "src")
REPO = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
PUBLIC_OUT = os.path.join(REPO, "public", "donor-network.html")
ARTIFACT_OUT = os.path.join(HERE, "artifact-body.html")

TITLE = "Harvard in Tech — Powering the Network: eight directions"


def read(*parts):
    with open(os.path.join(SRC, *parts), encoding="utf-8") as f:
        return f.read()


def build_body():
    with open(os.path.join(HERE, "donors.json"), encoding="utf-8") as f:
        data = json.load(f)

    # The pure rules live under src/ so vitest can reach them (its `include` is
    # `src/**`), and are inlined here rather than fetched — a published artifact
    # runs under a CSP that blocks every host, and a file:// open blocks even a
    # same-directory fetch. One file, two consumers, no second copy to drift.
    with open(os.path.join(REPO, "src", "lib", "donorNetwork.js"), encoding="utf-8") as f:
        rules = f.read()

    parts = [
        "<style>",
        read("shell.css"),
        read("engine.css"),
        read("variations.css"),
        "</style>",
        read("shell.html"),
        "<script>",
        "window.HIT_DATA = " + json.dumps(data, ensure_ascii=False) + ";",
        rules,
        read("engine.js"),
        read("variations.js"),
        read("shell.js"),
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
            f"<title>{TITLE}</title>\n"
            "</head>\n<body>\n" + body + "\n</body>\n</html>\n"
        )

    with open(ARTIFACT_OUT, "w", encoding="utf-8") as f:
        f.write(f"<title>{TITLE}</title>\n" + body + "\n")

    for p in (PUBLIC_OUT, ARTIFACT_OUT):
        print(f"wrote {os.path.relpath(p, REPO)} ({os.path.getsize(p):,} bytes)")


if __name__ == "__main__":
    main()

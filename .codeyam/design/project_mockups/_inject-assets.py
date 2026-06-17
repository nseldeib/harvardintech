#!/usr/bin/env python3
"""Inject real Harvard Alumni in Tech assets as base64 data URIs into mockup HTML.
Replaces __TOKEN__ placeholders so mockups render the real logo, board headshots,
and chapter photography in both the sandboxed panel and a direct file:// open.
Usage: python3 _inject-assets.py <mockup1.html> [mockup2.html ...]
"""
import base64, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
A = os.path.join(HERE, "_realassets")
TOKENS = {
    "__LOGO__":          f"{A}/logo-red.png",        # real HIT lockup (crimson on transparent)
    "__SHIELD__":        f"{A}/harvard-shield.png",
    "__PHOTO_BEN__":     f"{A}/ben-wei.png",
    "__PHOTO_PETER__":   f"{A}/peter-boyce.png",
    "__PHOTO_KRYSIA__":  f"{A}/krysia-lenzo.png",
    "__PHOTO_JESSICA__": f"{A}/jessica-li.png",
    "__PHOTO_NADIA__":   f"{A}/nadia-eldeib.png",
    "__CHAP_NYC__":      f"{A}/chap-nyc.jpg",
    "__CHAP_SF__":       f"{A}/chap-san-francisco.jpg",
    "__CHAP_LA__":       f"{A}/chap-la.jpg",
    "__CHAP_JAPAN__":    f"{A}/chap-japan.jpg",
}

def data_uri(path):
    ext = os.path.splitext(path)[1].lstrip(".").lower()
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
    with open(path, "rb") as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode("ascii")

uris = {tok: data_uri(p) for tok, p in TOKENS.items() if os.path.exists(p)}

for target in sys.argv[1:]:
    with open(target, "r", encoding="utf-8") as f:
        html = f.read()
    n = 0
    for tok, uri in uris.items():
        c = html.count(tok)
        if c:
            html = html.replace(tok, uri); n += c
    with open(target, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"{os.path.basename(target)}: injected {n} asset reference(s)")

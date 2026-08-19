---
kind: donors
order: 6
---

The donor recognition wall. The names come from **Donors** — on the admin
dashboard that collection sits under /donate, alongside this one.

This entry decides where the wall sits on the page and, via its Heading field,
what the wall is called. It sits after the member quotes and before the closing
ask, so a reader meets the people already behind the fund immediately before
being asked to join them. Move it with the Order field or hide it with the Draft
toggle.

Everything else on the wall is NOT editable in the CMS: the intro paragraph, the
giving levels, the "no donors yet" message, and the heading used when Heading is
blank are `donorsIntro`, `donorTiers`, `donorsEmptyMessage`, and `donorsTitle` in
`src/data/donatePage.json`. Changing any of them needs a developer — **Page
settings** does not carry them, so there is nowhere in the CMS to look.

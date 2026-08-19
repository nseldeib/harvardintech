---
kind: donors
kicker: The people behind the fund
title: The Momentum Network
order: 7
---

The donor recognition wall and the network visualization. The names come from
**Donors** — on the admin dashboard that collection sits under /donate, alongside
this one.

This entry decides where the wall sits on the page and, via its Heading and
Kicker fields, what the wall is called. It sits after the member quotes and
before the closing ask, so a reader meets the people already behind the fund
immediately before being asked to join them. Move it with the Order field or hide
it with the Draft toggle.

Everything else on the wall is NOT editable in the CMS: the intro paragraph, the
giving levels, the "no donors yet" message, the italic line under the heading,
and the heading used when Heading is blank are `donorsIntro`, `donorTiers`,
`donorsEmptyMessage`, `networkTagline`, and `donorsTitle` in
`src/data/donatePage.json`. Changing any of them needs a developer — **Page
settings** does not carry them, so there is nowhere in the CMS to look.

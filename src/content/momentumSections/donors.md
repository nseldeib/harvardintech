---
kind: donors
kicker: The people behind the fund
title: A grid, *lit from within*.
order: 7
---

The donor recognition wall and the network visualization. The names come from
**Donors** — on the admin dashboard that collection sits under /donate, alongside
this one.

This band is now the page's HERO — the first thing anyone sees on /donate, in
place of the photo banner. Because of that, its position is fixed: the Order
field no longer moves it and the Draft toggle no longer hides it, the same way
the closing ask cannot be dragged around. A campaign page whose opening frame
can be moved to the bottom, or switched off entirely, is one an edit can break.

What this entry still controls is the WORDS: its Heading and Kicker are the
headline and eyebrow drawn over the artwork. The heading understands
`*asterisks*` — text between them is set in crimson italic, which is how
"A grid, *lit from within*." gets its emphasis.

Everything else on the wall is NOT editable in the CMS: the intro paragraph, the
giving levels, the "no donors yet" message, the italic line under the heading,
and the heading used when Heading is blank are `donorsIntro`, `donorTiers`,
`donorsEmptyMessage`, `networkTagline`, and `donorsTitle` in
`src/data/donatePage.json`. Changing any of them needs a developer — **Page
settings** does not carry them, so there is nowhere in the CMS to look.

---
kind: goal-meter
kicker: Campaign progress
title: Our first gifts are already building momentum.
linkLabel: View the campaign
linkUrl: ''
raised: '$47,500'
goal: '$100,000'
percent: 47
order: 5
---

The fundraising progress band, and the one place on this page carrying figures
somebody has to maintain by hand.

THE NUMBERS BELOW ARE PLACEHOLDERS AND ARE NOT THE REAL CAMPAIGN TOTALS.
Replace Raised, Goal and Percent with the true figures before this page is
published, or clear all three — an empty band is honest, a wrong one is not.

There are two ways this band can draw itself, and they never both apply:

- Widget id set — Givebutter's own widget renders the meter and reports the
  live total. Nothing needs maintaining, which is why this is the better mode
  once a campaign exists. Raised, Goal and Percent are ignored entirely.
- Widget id blank, figures filled in — the band draws its own bar from
  Raised, Goal and Percent. Percent is what the bar is actually drawn to; it is
  not calculated from the other two, so if you change the money you must change
  the percentage as well or the picture will contradict the numbers beside it.

With no widget id and no figures the band renders nothing at all, which is what
it did before these fields existed.

THIS BAND SHOWS NOTHING until the Goal meter widget ID box above is filled in.
That is deliberate rather than broken: the ID is the one thing that cannot be
guessed, because a wrong one would display someone else's campaign meter on our
page. Get it from Givebutter — Dashboard, your campaign, Share, Embed — and copy
the `id=` value out of the code they give you.

The Goal meter link address is blank for the same reason — it points at the
Givebutter campaign page, and guessing it would send readers somewhere wrong. The
link needs BOTH boxes filled to appear, so "View the campaign" sitting in the
text box on its own draws nothing.

The Kicker and both link boxes belong to this band and disappear with it, so a
blank widget ID leaves nothing stranded on the page.

---
title: "Add The Cutover Runbook To The Nicole Handoff And Correct Stale Claims"
mode: backend
createdAt: "2026-08-07T12:01:15Z"
source: manual
---

## Summary

Add the domain cutover runbook to the Nicole handoff doc, and correct the two
claims in it that drifted out of date.

`docs/nicole-review.md` is the ready-to-send briefing for an external reviewer.
It listed four links; the runbook has been live since the stuck Pages deploy
drained, and a briefing that omits it hands her an incomplete picture of what
she is being asked to look at.

## What was stale

Checked every factual claim in the doc against committed content rather than
trusting it. Two were wrong:

- **Board bios.** The doc said the live site "has none to reproduce" and listed
  bios as wholly outstanding. Two of the five are now written (Ben Wei, Nadia
  Eldeib). Telling her nothing is written invites her to redo work already done.
- **Chapter count.** The doc said "the 5 cities"; there are six committed
  chapters — Boston/Cambridge, DC-DMV, London, NYC, Seattle, SF Bay Area.

One claim I expected to be stale was not. The doc says her volunteer project
still has no photo; a first check suggested otherwise, but that check was a
faulty grep — with a single file `grep -c` omits the filename, so the filter
never applied. The committed entry has no `image:` field and is `draft: true`,
exactly as the doc describes. Left alone.

Everything else verified accurate: three sponsors all flagged as examples, donors
and testimonials both empty, `donateUrl` blank so the Give button still opens an
email, the CMS committing to `staging`, the promote workflow present, and all
four referenced files existing. All five links return 200.

## Key Decisions

- **Lead the runbook entry with what we need back, not with what it is.** The
  page's reason for existing, from her side, is that five decisions are hers and
  D1 blocks the other four steps. The note names the GoDaddy login question
  directly rather than inviting her to go and find it.

- **Say that the first step changes nothing.** "Nothing can start until you
  answer" reads as pressure; pairing it with the fact that step one only reads
  the current settings makes the ask concrete and small.

- **Correct the password line.** It said "the site and the todos page use
  crimson2026" — true when there were two gated surfaces, misleading now there
  are four. It now says everything except the content editor.

- **Record that the runbook is excluded from the public build**, not merely
  gated. It names where the domain's records live, so the distinction between
  "hidden" and "not built" is worth stating where someone deciding what to share
  will read it.

## Out of scope

- Sending anything to Nicole. This prepares the note; the send is a human call.
- The domain cutover itself, and the three unwritten bios.
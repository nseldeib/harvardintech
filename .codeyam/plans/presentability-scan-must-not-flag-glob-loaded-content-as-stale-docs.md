---
title: "Presentability scan must not flag glob-loaded content as stale docs"
mode: backend
createdAt: "2026-07-30T19:50:11Z"
source: manual
---

## Summary

`/codeyam-audit` step 6 (the presentability pass) surfaces "stale docs" as
deletion candidates using a *referenced-by* heuristic: a tracked file that no
other tracked file imports or links to. That heuristic is structurally wrong for
**glob-loaded content collections**, which are never imported by anything — the
loader discovers them at build time from a directory pattern.

So every content entry in the project is reported as a deletion candidate,
forever, on every run. On this repo that was 8 event entries backing 6 live
pages; following the scan's suggestion literally would delete real site content.
Observed during the 2026-07-30 audit run, where the finding had to be dismissed
by hand after reading `src/content.config.ts` to prove the entries were live.

There are two layers, and this plan does the one that is actionable here.

## Key Decisions

- **Fix the procedure doc in this repo; file the tool fix upstream.**
  `.claude/skills/codeyam-audit/finalize-procedure.md` is tracked here, so the
  GOTCHA lands immediately and protects the next run. The scan itself lives in
  `codeyam-editor`, a different repo — the real exclusion belongs there, but it
  cannot be written from this one. Do the reachable half now rather than
  deferring both.
- **A GOTCHA, not a new step.** Step 6 already says "ask the user about anything
  uncertain." What was missing is the specific knowledge that makes this class
  *not* uncertain: glob-loaded content always looks unreferenced, so absence of
  references is not evidence of deadness. That is a note attached to the existing
  step, not new procedure.
- **Name the verification, not just the caveat.** The GOTCHA should say how to
  confirm in one command — check the content config for a
  `glob({ pattern, base })` loader covering the flagged path — so the next run
  resolves it in seconds instead of re-deriving it.
- **Upstream: detect from config, not a path convention.** When the scan is
  fixed, `src/content/` is the Astro default but the loader's `base` is
  configurable (this repo computes it from a `root` variable). `stack.json`
  already records `data.contentDir`; that plus the `glob()` call sites is the
  honest source of truth. Hard-coding `src/content/**` would miss a project that
  relocated its collections.

## Risks / Notes

- Over-excluding would hide genuinely dead content — an event entry for a
  cancelled event is real debt. But content lifecycle is a CMS concern, not a
  presentability one, so "not a *doc* candidate" is the right framing.
- The scan is advisory and never deletes, so this is a false-positive cost, not a
  data-loss risk. It earns a fix because a scan the operator learns to skim is a
  scan that will miss the one real finding.

## Verification

- The GOTCHA appears under step 6 of `finalize-procedure.md` and names both the
  symptom (content entries listed as stale docs) and the one-command check.
- A fresh `/codeyam-audit` run on this repo dismisses the 8 event entries by
  citing the GOTCHA, without re-reading the content config from scratch.
- Upstream, once the scan is fixed: `presentability-scan` reports 0 stale-doc
  candidates here rather than 8; a genuinely orphaned markdown file outside the
  content dirs is still reported; and a project whose content lives outside
  `src/content/` is also excluded, proving the detection is config-driven.

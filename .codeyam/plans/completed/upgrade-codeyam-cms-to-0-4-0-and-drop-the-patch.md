---
title: "Upgrade codeyam CMS To 0.4.0 And Drop The Patch"
mode: ui
createdAt: "2026-08-07T02:00:38Z"
source: manual
---

## Summary

Upgrade `@codeyam/cms` 0.2.2 → 0.4.0 and **delete the patch**. This is the
downstream half of the work whose upstream half is
[codeyam-ai/codeyam-cms#4](https://github.com/codeyam-ai/codeyam-cms/pull/4),
merged by Jared and published as 0.4.0.

Verified before planning, not assumed: 0.4.0 contains both upstreamed features
(`unbackedManifestRecords` / `UnbackedMediaError` in the commit path, and
`entryPagePath` / `SLUG_TOKEN` / `groupCardsByPage` for placement), and a
file-by-file comparison of the patched tree against the published 0.4.0 tree
shows **nothing the patch added is missing**. The patch is redundant, not merely
inconvenient, so deleting it removes a mechanism rather than a protection.

## Why deleting the patch is the point

`patch-package` matches patches to versions by filename. For as long as the
guard lived in `patches/@codeyam+cms+0.2.2.patch`, every future version bump was
one forgotten rebase away from silently dropping a data-integrity fix — and the
bug it prevents is invisible at publish time, because the CMS truthfully reports
the upload succeeded. The failure only surfaces later as a broken image an editor
cannot fix from the UI. Carrying that risk was acceptable while the fix was ours
alone; now that it is released, carrying it would be negligent.

## Key Decisions

- **Keep `mediaCommitGuard.test.ts`.** It stops being a test of our patch and
  becomes a test of our *dependency* — a downstream canary that fails at CI time
  if a future `@codeyam/cms` reworks or drops the guard. That is worth more now
  than it was before, because we no longer control the code it guards. Its
  header currently says the fix "ships as a patch this repo applies on install";
  that sentence becomes false on this change and gets rewritten rather than left
  to mislead the next reader.

- **Keep `patch-package` in `postinstall`.** With `patches/` empty it is a
  no-op costing one no-op invocation per install, and removing it means the next
  person who needs a patch has to rediscover the wiring. Low cost to keep, real
  cost to remove.

- **Take 0.3.0's publish-flow work too.** 0.4.0 subsumes 0.3.0, so this upgrade
  also brings the plain-language change summaries and the published-baseline
  fix. Both land on Nicole's actual workflow, so both get demonstrated rather
  than assumed — the agreed scope from the earlier planning round still holds.

- **Recapture rather than trust.** The 15 existing CMS scenarios render
  `/admin`, which this changes. A frame that does *not* move is evidence the
  upgrade did not reach it, so the diffs get read rather than accepted.

## Implementation

### 1. The upgrade

- `package.json`: `@codeyam/cms` `0.2.2` → `0.4.0`.
- `git rm patches/@codeyam+cms+0.2.2.patch`.
- `npm install` — `postinstall` runs `patch-package`, which should now report
  nothing to apply rather than a version mismatch.
- Confirm the installed tree carries the guard and the placement exports, so the
  deletion provably lost nothing.

### 2. Prove nothing regressed

Five test files in this repo exercise the CMS API directly and are the real
acceptance criteria:

- `mediaCommitGuard.test.ts` — the guard, now against the released package.
- `collectionPlacement.test.ts` and `dashboardGrouping.test.ts` — the placement
  feature against this site's real 21-entry `paths` map.
- `collections.test.ts`, `deployMarker.test.ts` — the surrounding contract.

Full suite green is the bar; the guard test passing against an unpatched
`node_modules` is the specific thing that proves the upstream landed correctly.

### 3. Docs that name the patch

- `src/lib/mediaCommitGuard.test.ts` header — rewrite the "ships as a patch"
  paragraph to describe the canary role.
- `docs/nicole-review.md` — names `patches/@codeyam+cms+0.2.2.patch` when
  explaining the photo fix, and says it "should be filed upstream so the patch
  can eventually be dropped". That is now done; the doc should say so rather
  than point at a file that no longer exists.

### 4. Scenarios

- Recapture the 15 existing CMS scenarios and read the diffs.
- Add scenarios for what 0.4.0 changes for an editor: the publish review with
  plain-language change summaries instead of a raw diff, the same screen with
  the diff disclosure open (the diff moved, it did not vanish), and a
  post-publish edit demonstrating that a second edit on a still-open page no
  longer reads as a co-editor conflict.

## Out of scope

- Any further upstream work on `@codeyam/cms`.
- The domain cutover, the runbook, and `deploy.yml`. `harvardintech.com` remains
  Strikingly's.
- The other session's queued per-chapter-galleries plan and its unpushed commits.
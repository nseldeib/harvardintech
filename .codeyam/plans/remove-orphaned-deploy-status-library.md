---
title: "Remove Orphaned Deploy Status Library"
mode: ui
createdAt: "2026-07-28T11:05:21Z"
source: manual
---

## Summary

Delete the site's own deploy-status implementation, which the CMS migration
orphaned, while **keeping** the `/deploy-status.json` marker endpoint that a
companion `@codeyam/cms` change will consume.

`src/lib/deployStatus.ts` (268 lines, 9 glossary entries, 31 registered tests in
`src/lib/deployStatus.test.ts`) exists to drive a deploy banner in the site's own
`/admin` dashboard. That dashboard and its `src/components/admin/DeployStatus.astro`
were retired when `@codeyam/cms` took over `/admin`, so the module is now
referenced by nothing except its own test file. It is dead code that still runs
31 tests on every suite and occupies 9 glossary entries, making the project's
index describe a subsystem the site no longer has.

`src/pages/deploy-status.json.ts` is a different case and stays. It is a
build-time marker — `GITHUB_SHA` baked into a prerendered JSON file — and it is
the only mechanism that proves **CDN propagation**, because a changed `commit`
in the *served* file means the new bytes are genuinely being served. The
package's deploy tracking polls the GitHub Pages builds API instead, which can
report a build complete slightly before the CDN serves it. The endpoint has no
consumer today, but the decision is to wire it into the CMS rather than lose that
capability, so it is retained here and its now-false comment is corrected.

## Key Decisions

- **Delete `deployStatus.ts` and its test; keep the endpoint.** The library is
  the site-side reimplementation of something the package now owns — the
  package's `deployStateFromBuild` / `deploySteps` drive the same
  Committed → Building → Live → Failed progression from the Pages API. The
  marker endpoint is not a reimplementation; it is a capability the package does
  not have. Those are different things and get different treatment.
- **Do not port the library into the package as part of this plan.** The
  marker-consuming helpers — `markerUrl`, `deployBaseFromPath`, and
  `computeBanner`'s marker handling — are the reference implementation for the
  companion `@codeyam/cms` plan that adds CDN-propagation confirmation. Deleting
  them here does not lose them: they remain in git history at this commit, and
  the package plan cites them. Keeping dead code in the consumer as a
  copy-source for a different repo would be the wrong way to preserve it.
- **Fix the endpoint's comment in the same change.** It currently says "The
  admin polls it and treats a change in `commit` as proof the new content is
  genuinely live". That admin no longer exists, so the comment now describes a
  consumer that was deleted — actively misleading to the next reader, who would
  reasonably conclude the endpoint is load-bearing today. It must say the marker
  is retained for the CMS to consume, and that nothing polls it yet.
- **Deregister rather than orphan the index entries.** Deleting the files
  without removing their 9 glossary entries and 31 registered tests leaves the
  registries describing files that do not exist, which the audit gate will flag
  on the next session. Use `editor remove-test` / the glossary reconciliation
  the workflow already runs, not hand-editing of `.codeyam/*.json`.
- **No behavior change to the live site.** Nothing renders `deployStatus.ts`, so
  no page changes. The endpoint keeps prerendering to the same URL with the same
  shape, so any external consumer that does exist keeps working — which also
  means this cleanup is safe to land regardless of whether the companion package
  change ever ships.

## Implementation

### 1. Delete the orphaned library and its test

**Delete**: `src/lib/deployStatus.ts` and `src/lib/deployStatus.test.ts`

Confirm before deleting that the only remaining references are between these two
files. At the time of writing, a repo-wide grep for `deployStatus` outside
`src/lib/deployStatus*` returns nothing — no component, page, layout, or
scenario imports it, and the isolated-components registry has no `DeployStatus`
entry (its fixtures were removed with the retired admin components).

### 2. Deregister its tests and glossary entries

**Files**: `.codeyam/test-registry.json`, `.codeyam/glossary.json` (via the
editor CLI, not by hand)

The 31 registered tests in `deployStatus.test.ts` and the 9 glossary entries
whose `filePath` is `src/lib/deployStatus.ts` — `computeBanner`,
`deployBaseFromPath`, `mapRunPhase`, `markerUrl`, `parseBackendRepo`,
`pickLatestDeployRun`, `relativeTime`, `runStartedMs`, `viewSiteUrl` — must go
with the source. Use `codeyam-editor editor remove-test --key <k>` for the tests
and let the workflow's glossary reconciliation drop the entries, so the indexes
stay consistent rather than being hand-edited into a state the next audit
disputes.

### 3. Correct the endpoint's comment

**File**: `src/pages/deploy-status.json.ts`

Keep the route, the `prerender = true`, and the response shape exactly as they
are. Rewrite the comment block so it no longer claims the site's admin polls it.
State instead: the marker is a build-time proof of CDN propagation (a changed
`commit` in the *served* file means the new bytes are live, which a GitHub Pages
"build complete" can precede); nothing consumes it today; it is retained for
`@codeyam/cms` to consume — see the companion package plan. Keep the existing
explanation of the `GITHUB_SHA` / `GITHUB_RUN_ID` fallback to `"local"`, which
remains accurate.

### 4. Verify the suite shrinks cleanly

After deletion the suite should drop by exactly the 31 tests in
`deployStatus.test.ts` (203 → 172 at the time of writing) with no other test
affected, and `npm run build` should still emit `/deploy-status.json` in `dist/`.
Both are the check that the deletion was surgical rather than load-bearing.

## Reused existing code

- `src/pages/deploy-status.json.ts` — retained unchanged apart from its comment;
  the marker contract (`commit`, `runId`, `builtAt`) is what the companion
  package plan will consume
- `deployStateFromBuild` / `deploySteps` / `stageFromBuildStatus` from
  `@codeyam/cms` (`node_modules/@codeyam/cms/src/lib/githubPages.ts`) — the
  package-side deploy tracking that already replaces the deleted library's
  banner logic, which is why deleting it loses no editor-facing capability
- `DeployStatus` from `@codeyam/cms`
  (`node_modules/@codeyam/cms/src/components/admin/DeployStatus.tsx`) — the
  in-drawer stepper editors now see after committing
- `codeyam-editor editor remove-test` — the supported way to drop registered
  tests, already used elsewhere in this project's workflow

**Existing-implementation survey:** grepped the repo for every `deployStatus` /
`deploy-status` reference before writing this plan. Outside the two files being
deleted, the only hit is `src/pages/deploy-status.json.ts` itself (its own
comment). No component, page, doc, workflow, scenario, or screenshot references
the library; the deploy-status scenarios and screenshots were already removed
when the retired admin components were deleted. The `@codeyam/cms` package
contains no reference to `deploy-status.json`, which is precisely the gap the
companion package plan addresses.

## Scenarios to Demonstrate

- **Admin deploy stepper after a commit** — the package's Committed → Building →
  Live progression, showing the editor-facing capability that survives this
  deletion
- **The site with no deploy banner** — any public page, confirming nothing
  visual depended on the deleted library
- **`/deploy-status.json` still served** — the built marker file with its
  `commit` / `runId` / `builtAt` shape intact after the cleanup
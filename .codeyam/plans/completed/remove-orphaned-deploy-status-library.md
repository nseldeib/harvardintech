---
title: "Remove Orphaned Deploy Status Library"
mode: ui
createdAt: "2026-07-28T11:05:21Z"
source: manual
---

## Summary

Upgrade `@codeyam/cms` to 0.2.0 and delete the site's own deploy-status
implementation, which the CMS migration orphaned — including the
`/deploy-status.json` marker endpoint, which 0.2.0 now injects itself.

**Amended 2026-07-29, at the confirm gate.** This plan was written against
`@codeyam/cms` 0.1.0 and kept the marker endpoint on the grounds that the
package lacked one. That is no longer true: 0.2.0 ships
`src/pages/deploy-status.json.ts` and injects it at the public
`/deploy-status.json`. The version bump is therefore part of this change, and
the endpoint is deleted rather than retained.

`src/lib/deployStatus.ts` (268 lines, 9 glossary entries, 31 registered tests in
`src/lib/deployStatus.test.ts`) exists to drive a deploy banner in the site's own
`/admin` dashboard. That dashboard and its `src/components/admin/DeployStatus.astro`
were retired when `@codeyam/cms` took over `/admin`, so the module is now
referenced by nothing except its own test file. It is dead code that still runs
31 tests on every suite and occupies 9 glossary entries, making the project's
index describe a subsystem the site no longer has.

`src/pages/deploy-status.json.ts` goes too. It is a build-time marker —
`GITHUB_SHA` baked into a prerendered JSON file — that proves **CDN
propagation**, because a changed `commit` in the *served* file means the new
bytes are genuinely being served, which a GitHub Pages "build complete" can
precede. That capability is not lost with the file: `@codeyam/cms` 0.2.0 ships
the same marker, injected by the integration at the same public URL, with the
same `{ commit, runId, builtAt }` payload — plus `Cache-Control: no-cache`
headers the site's copy lacks, and the payload logic extracted into a testable
`buildDeployMarker`. Keeping the site's file would only mean the package's
version never runs, since Astro gives a file-based route precedence over an
injected one.

## Key Decisions

- **Upgrade to `@codeyam/cms@^0.2.0` first.** The existing `^0.1.0` range cannot
  resolve 0.2.0 — a caret on a `0.x` version pins the minor — so `npm update`
  alone will not move it and the range itself has to change. The upgrade is
  additive: no files were removed between the two versions, and `exports`,
  `bin`, and `peerDependencies` are byte-identical, so no re-run of the
  `integrate` CLI is required and there is no `public/admin` copy in this repo
  to re-sync.
- **Delete `deployStatus.ts`, its test, and the endpoint.** All three are
  site-side reimplementations of things the package now owns: its
  `deployStateFromBuild` / `deploySteps` drive the same
  Committed → Building → Live → Failed progression from the Pages API, and as of
  0.2.0 its injected route serves the marker. None of the three is a capability
  the package lacks.
- **Do not port the library into the package as part of this plan.** The
  companion `@codeyam/cms` change this plan anticipated has already shipped in
  0.2.0, so the marker-consuming helpers — `markerUrl`, `deployBaseFromPath`,
  and `computeBanner`'s marker handling — no longer have a downstream consumer
  to seed. Deleting them loses nothing: they remain in git history at this
  commit. Keeping dead code in the consumer as a copy-source for a different
  repo would be the wrong way to preserve it.
- **The endpoint's stale comment is resolved by deleting the file, not by
  rewriting it.** It currently says "The admin polls it and treats a change in
  `commit` as proof the new content is genuinely live" — an admin that no longer
  exists, so the comment describes a deleted consumer. Under the original plan
  that comment had to be corrected; now the file carrying it goes away, and the
  package's own version documents the same contract accurately.
- **Deregister rather than orphan the index entries.** Deleting the files
  without removing their 9 glossary entries and 31 registered tests leaves the
  registries describing files that do not exist, which the audit gate will flag
  on the next session. Use `editor remove-test` / the glossary reconciliation
  the workflow already runs, not hand-editing of `.codeyam/*.json`.
- **No behavior change to the public site.** Nothing renders `deployStatus.ts`,
  so no page changes. `/deploy-status.json` keeps prerendering to the same URL
  with the same shape — served by the package's injected route instead of the
  site's file — so any external consumer keeps working. `/admin` DOES change:
  0.2.0 adds concurrent-edit drift warnings, a clearer commit-failure notice,
  and an upload-destination picker in the media library. That is what makes this
  a UI-mode change rather than a pure dependency bump.

## Implementation

### 0. Upgrade the package

**Files**: `package.json`, `package-lock.json`

Change the `@codeyam/cms` range from `^0.1.0` to `^0.2.0` and install. Confirm
`npm ls @codeyam/cms` reports 0.2.0 and that `astro check` and the suite pass
BEFORE deleting anything, so any later failure is unambiguously attributable to
the deletion rather than to the bump.

### 1. Delete the orphaned library, its test, and the endpoint

**Delete**: `src/lib/deployStatus.ts`, `src/lib/deployStatus.test.ts`, and
`src/pages/deploy-status.json.ts`

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

### 3. Confirm the injected marker took over

**No file** — this is a verification step, not an edit.

With the site's `src/pages/deploy-status.json.ts` deleted, `@codeyam/cms`'s
`injectDeployMarkerRoute` is what mounts `/deploy-status.json`. Confirm the
built `dist/deploy-status.json` still carries `commit`, `runId`, and `builtAt`.
The one difference to expect is on a LOCAL build: the site's version emitted
`runId: null` when `GITHUB_RUN_ID` was unset, the package's emits `"local"`. On
CI both read the real run id, so the deployed marker is byte-comparable.

### 4. Verify the suite shrinks cleanly

After deletion the suite should drop by exactly the 31 tests in
`deployStatus.test.ts` (203 → 172 at the time of writing) with no other test
affected, and `npm run build` should still emit `/deploy-status.json` in `dist/`.
Both are the check that the deletion was surgical rather than load-bearing.

## Reused existing code

- `deploy-status.json.ts` + `buildDeployMarker` / `readBuildStampEnv` from
  `@codeyam/cms` 0.2.0 (`src/pages/deploy-status.json.ts`, `src/lib/buildEnv.ts`)
  — the injected marker route that replaces the site's copy, on the same
  `commit` / `runId` / `builtAt` contract
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
when the retired admin components were deleted. At the time of writing the
`@codeyam/cms` package contained no reference to `deploy-status.json` — the gap
the companion package plan addressed. **That gap is now closed in 0.2.0**, which
is why the endpoint is deleted here rather than retained.

## Scenarios to Demonstrate

- **Admin deploy stepper after a commit** — the package's Committed → Building →
  Live progression, showing the editor-facing capability that survives this
  deletion
- **The site with no deploy banner** — any public page, confirming nothing
  visual depended on the deleted library
- **`/deploy-status.json` still served** — the built marker file with its
  `commit` / `runId` / `builtAt` shape intact after the cleanup, now produced by
  the package's injected route rather than a site file
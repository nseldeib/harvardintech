---
title: "ne -- Discarding a Staged Image Orphans Its Manifest Record (@codeyam/cms)"
mode: ui
createdAt: "2026-07-31T16:13:22Z"
prefix: "ne"
source: manual
---

## Summary

Nicole's "it says it uploaded successfully but the photo doesn't show up" has a concrete
root cause, and it is upstream in `@codeyam/cms`. An upload stages **two** changes that must
travel together — the image bytes (`public/images/<name>`, base64) and the manifest record
(`src/data/media.json`) — but the two review surfaces wire their per-change **Discard**
button straight to the raw `discardChange(path)`, which removes exactly one path. Discard the
image half in the review list and the manifest record stays staged, publishes on its own, and
the site is left with a record pointing at a file that was never committed: a broken `<img>`,
i.e. "nothing shows up". The upload genuinely did succeed, which is why the UI said so.

The media-aware discard that keeps the pair in sync, `discardUpload`, already exists — it is
just called from exactly one place (`MediaLibrary.tsx:70`, the gallery card's remove button).
This plan routes every discard of a media path through the paired logic, handles the reverse
orphan (discarding the manifest alone, which would commit bytes no record names), and adds a
publish-time invariant so a mismatched pair can never commit silently again.

**Evidence on `main`.** Commit `dd73c8c` ("Update 2 content entries via CodeYam CMS") added
three manifest records — `volunteers.webp`, `volunteers-2.webp`, `gallery/volunteers.webp`,
all with byte-identical `sizeBytes: 126240` / `originalSizeBytes: 2091397` / `1200x1200`, i.e.
the same photo uploaded three times — but only **one** blob, `public/images/volunteers.webp`.
The other two files exist on no ref in the repo. The commit message is generated from
`changes.length`, and "2 content entries" means exactly two changes were in the staging set at
commit time: one blob plus the manifest. The other two blobs were discarded from the review
list while their records were not.

**Scope.** This is a package fix. Every file below is in
`github.com/codeyam-ai/codeyam-cms` under `packages/cms/`, which is **not** checked out here —
this repo consumes `@codeyam/cms@0.2.2` from the npm registry. Paths in the Implementation
section are package-repo-relative and cannot be verified from this tree; confirm each at
execution. The consuming-repo side of the same incident (repairing the two ghost records,
adding `missingMediaFiles` + `npm run check:media`) is already covered by the queued plan
`ne--volunteer-project-detail-pages-and-the-missing-photo` and is deliberately not duplicated
here. That plan's step 7 says to "file the ghost-record behaviour upstream" — this is that
filing, with the cause now identified precisely rather than attributed to a vague publish
failure.

**Also reported, already planned.** "The thumbnail for a newly added project doesn't link to
the full description" is the second half of the same queued plan (a missing
`/volunteer/projects/<slug>` route plus an unlinked card). No new plan is needed for it.

## Key Decisions

- **Fix at one seam, not at each call site.** A new `discardStagedChange(path)` in
  `mediaStaging.ts` routes by path — media paths get the paired logic, everything else falls
  through to the existing `discardChange`. Both review surfaces call it, so a future third
  review surface is correct by construction. Patching `PublishPage` and `StagingBar`
  independently would leave the same trap set for the next one.
- **The seam needs no new props.** `discardUpload(committed, filename)` needs the committed
  manifest, which the review surfaces do not receive — but they do not need it plumbed in:
  `buildManifestChange` stores `serializeManifest(committed)` as the staged change's
  `original`, so the committed manifest is recoverable from the staging set itself. This keeps
  the fix inside `mediaStaging.ts` instead of threading a manifest prop through
  `PublishPage` → `ChangeGroupList` → `ChangeGroup` → `ChangeDiffCard`.
- **Do NOT put the pairing in `pendingChangesStore`.** That module is deliberately the generic
  "only place that touches localStorage" and knows nothing about media. Media semantics belong
  in `mediaStaging.ts`, which is where the other half of the pair already lives.
- **Both directions, not just the reported one.** Discarding the manifest change currently
  leaves the image blobs staged, which commits bytes no record names. That is the milder
  orphan — the disk scan adopts unrecorded images, so nothing visibly breaks — but it is the
  same bug mirrored, and fixing one direction while leaving the other is how it comes back.
- **A publish-time invariant as the second layer.** The discard fix closes the known path; the
  invariant closes the class. Publishing a manifest that names a file which is neither
  committed nor staged is never correct, and the failure is silent and lands in git history —
  worth blocking at the commit boundary rather than trusting every future staging mutation.
- **Block, don't auto-repair.** The invariant refuses the publish and names the offending
  records rather than quietly dropping them from the manifest. Silently editing an editor's
  staged manifest during publish is how you get a second class of surprise; the CMS already
  has this posture for drift (`StaleBaselineError` refuses rather than merging).
- **`discardChange` stays public and unchanged.** The singleton editors (nav, settings,
  collections, cms config, entry rows) each own exactly one path and are correct as they are.

## Implementation

> All paths are relative to the `codeyam-cms` repo's `packages/cms/` directory and are
> **unverified from this tree** — confirm each one exists at execution before editing.

### 1. Path-routing discard

**File**: `src/lib/mediaStaging.ts`

Add `discardStagedChange(path: string): void`, the single entry point every review surface
calls:

- **An image blob** (`path` starts with `` `${MEDIA_DIR}/` ``) → recover the filename by
  stripping the prefix, recover the committed manifest from the staged manifest change's
  `original` (parse it; on absent-or-corrupt fall back to `discardChange(path)` alone rather
  than throwing — a blob with no manifest change staged has no record to pair with), then call
  the existing `discardUpload(committed, filename)`.
- **The manifest** (`path === MEDIA_MANIFEST_PATH`) → see step 4.
- **Anything else** → `discardChange(path)`, unchanged behaviour.

Export it alongside the existing `stageUpload` / `discardUpload` / `reorderMedia`.

Note the existing `discardUpload` already does the right thing once it has `committed`,
including discarding the manifest change outright when removing the record returns the
manifest to its committed state (`sameAssets`) — so discarding the *only* staged upload
correctly leaves an empty staging set rather than a no-op manifest edit.

### 2. Wire the publish page

**File**: `src/components/admin/PublishPage.tsx`

Line ~260 passes `onDiscard={discardChange}` into `ChangeGroupList`. Swap it for
`discardStagedChange` and drop the now-unused `discardChange` import (line ~40) if nothing
else in the file uses it. No change to `ChangeGroupList` / `ChangeGroup` / `ChangeDiffCard` —
they already take `(path: string) => void` and stay media-agnostic.

### 3. Wire the staging bar

**File**: `src/components/admin/StagingBar.tsx`

Two call sites: the `onDiscard={discardChange}` prop (line ~220) and the direct
`discardChange(path)` (line ~184). Both become `discardStagedChange`. Check what the line-184
caller is doing first — if it is a discard-all or a post-commit clear rather than a
single-change discard, leave it alone and say so.

### 4. The reverse orphan

**File**: `src/lib/mediaStaging.ts`

When `discardStagedChange` is asked to drop `MEDIA_MANIFEST_PATH`, also discard every staged
image blob whose record exists only in the staged manifest — precisely the set the existing
private `stagedAdditions(committed, staged)` already computes. Those blobs have no record
without the manifest change, so keeping them staged would commit unrecorded bytes. Blobs
belonging to records that are also in the committed manifest (a re-upload over an existing
name) are left staged: their record survives the discard, so the pair is still intact.

`stagedAdditions` is currently module-private; keep it private and call it directly rather
than widening the module's surface.

### 5. Publish-time invariant

**New file**: `src/lib/mediaIntegrity.ts` *(new)*

A pure `orphanedMediaRecords(changes, committedManifest, knownFiles)` returning the manifest
records the staged manifest names that have neither a staged blob nor an entry in
`knownFiles` (the files already on the branch). Pure and injectable so it unit-tests without
a network or a DOM — the same shape as `detectDrift` in `staleCheck.ts`.

**File**: `src/lib/githubCommit.ts`

Call it inside `commitAll`, in the same pre-flight position as the existing drift check
(step 0, before any blob is created, so a refusal mutates nothing), and throw a typed
`OrphanedMediaError` listing the record filenames. Follow the `StaleBaselineError` pattern
exactly: a named class, an `isOrphanedMediaError` guard, and a human-readable message.

Sourcing `knownFiles` needs care — `commitAll` has a repo target and a token, so it can read
the tree, but adding an unconditional tree read to every publish is a real cost. Preferred:
derive it from the committed manifest the change's `original` already carries (a record in the
committed manifest is by definition a file that was committed), and treat that as the
`knownFiles` set — no extra API call. Confirm that reasoning holds at execution; if it does
not, gate the check behind the presence of a staged manifest change so non-media publishes are
untouched.

**File**: `src/components/admin/CommitErrorNotice.tsx`

Render the new error the way the drift error is rendered — name the affected images and say
what to do (re-upload them, or discard the manifest change and start over). An editor should
never see a raw message here.

### 6. Release and consume

**File**: `packages/cms/package.json` (version bump) and this repo's `package.json` /
`package-lock.json` once published.

The consuming site pins `@codeyam/cms@^0.2.2`, so a `0.2.3` patch is picked up by a plain
`npm install`. Note the prior migration gotcha: the lockfile keeps a `file:` resolution unless
the tarball is deleted and the dep installed explicitly — verify `package-lock.json` resolves
to `registry.npmjs.org` after the bump, as it does today.

## Reused existing code

All in the package, not this repo:

- `discardUpload` (`src/lib/mediaStaging.ts`) — already implements the paired discard,
  including the `sameAssets` no-op collapse. The fix is to *route to it*, not to reimplement.
- `stagedManifest` / `stagedAdditions` (`src/lib/mediaStaging.ts`, both private) — recovering
  the committed manifest and identifying this session's staged additions.
- `MEDIA_DIR`, `MEDIA_MANIFEST_PATH`, `assetRepoPath`, `serializeManifest`, `buildImageChange`,
  `buildManifestChange` (`src/lib/mediaLibrary.ts`) — path conventions and the change builders
  the reproduction test uses to seed a realistic staging set without a canvas.
- `discardChange` / `stageChange` / `loadChanges` (`src/lib/pendingChangesStore.ts`) — the
  generic store, called through, not modified.
- `StaleBaselineError` + `isStaleBaselineError` + the step-0 pre-flight position in
  `commitAll` (`src/lib/githubCommit.ts`) — the template for the new orphan refusal.
- `detectDrift` (`src/lib/staleCheck.ts`) — the template for a pure, injectable integrity
  check.

In **this** repo, the read side is untouched: `altFor` and `readMediaManifest`
(`src/lib/media.ts`, glossary entries `altFor`, `readMediaManifest`, tested in
`src/lib/media.test.ts`) already tolerate a manifest record with no file, which is why the page
renders a broken image rather than failing the build.

**Existing-implementation survey.** Grepping the package for `discardUpload` and
`discardChange` across `src/components/` and `src/lib/`: `discardUpload` has exactly **one**
caller (`MediaLibrary.tsx:70`); `discardChange` has nine, of which two are the review surfaces
this plan re-routes (`PublishPage.tsx:40,260` and `StagingBar.tsx:184,220`) and the rest are
single-path singleton editors that are already correct. No path-routing discard exists
anywhere in the package, and no module compares a staged manifest against staged or committed
files — `mediaLibrary.ts` has `mergeLibrary`'s scan-vs-manifest drop rule, but that runs on
the *server's* view of what is on disk, never on the staging set. So both additions
(`discardStagedChange`, `orphanedMediaRecords`) are genuinely new rather than duplicates.

## Reproduction Test

Pins the reported bug: discarding a staged image from the review list must not leave its
manifest record behind, because that record publishes alone and becomes a broken image.

**Target**: `packages/cms/src/lib/mediaStaging.test.ts` in the `codeyam-cms` repo — the
published tarball ships no test files, so confirm the exact filename and the repo's runner
invocation at execution rather than assuming this path. Seeding the staging set through
`buildImageChange` / `buildManifestChange` keeps the test in jsdom with no canvas and no
`File`, so it does not depend on `compressImageFile`.

```ts
// Discarding a staged image from the review list must remove its manifest record
// too — an orphaned record publishes alone and renders as a broken image.
it('discards the manifest record along with a staged image blob', () => {
  const committed = { assets: [] };
  const asset = {
    filename: 'volunteers.webp',
    url: '/images/volunteers.webp',
    sizeBytes: 126240,
  };
  stageChange(buildImageChange(asset, 'AAAA'));
  stageChange(buildManifestChange(committed, { assets: [asset] }));

  discardStagedChange('public/images/volunteers.webp');

  expect(loadChanges()).toEqual([]);
});
```

Status: PROPOSED — confirm red at execution. Expected failure: `discardStagedChange` is not
exported from `mediaStaging.ts`, so the import fails and the suite errors before the assertion
runs. Once it exists but merely delegates to `discardChange`, the assertion fails with the
staged `src/data/media.json` change still present — the orphan itself. The fixture mirrors the
real record committed in `dd73c8c` (same filename and byte size) rather than an invented shape.

A second test worth adding in the same file for step 4: stage two uploads, discard
`src/data/media.json`, and assert both blobs go with it.

## Scenarios to Demonstrate

- Upload one image, open the review list, discard the image → staging set is empty; no
  manifest record survives.
- Upload three copies of the same photo (Nicole's actual sequence: root, root again → deduped
  to `-2`, then into `gallery/`), discard two of them in the review list → the manifest names
  exactly the one remaining image, and publishing commits one blob and one matching record.
- Upload two images, discard the **manifest** change → both blobs are unstaged with it.
- Re-upload over an image that already exists on the branch, then discard the manifest change
  → the blob stays staged, because its record lives in the committed manifest.
- A publish carrying a manifest record with neither a staged blob nor a committed file → the
  orphan refusal, with the offending filename named in `CommitErrorNotice`.
- A publish with no media changes at all → completely unaffected, no extra API calls.
- Discard a non-media change (an entry, nav, settings) from the review list → identical
  behaviour to today.
- The gallery's own card remove button → unchanged; it already routed through `discardUpload`.
// The manifest-record/image-bytes invariant, tested against the @codeyam/cms
// commit path we depend on.
//
// This is the regression Nicole hit: she uploaded a volunteer photo from /admin,
// the publish landed `dd73c8c` — "Update 2 content entries via CodeYam CMS" —
// and that ONE commit carried three new records in `src/data/media.json` but only
// ONE file under `public/images/`. An upload stages the blob and the manifest
// edit as two independent PendingChanges, and nothing bound them together, so
// losing the blob published a record naming a file that does not exist. The site
// then renders a broken `<img>` the editor cannot fix from the UI.
//
// The fix now lives upstream, released in @codeyam/cms 0.4.0 — it shipped here
// as a patch-package patch until then, and the patch is gone. These tests stay,
// and their job changed: they no longer cover our own code, they hold a
// DEPENDENCY to its contract. If a future @codeyam/cms reworks or drops the
// guard, they fail at CI time rather than at Nicole's next upload.
//
// That is worth more now than it was when the code was ours, not less. The bug
// is invisible at publish time — the CMS truthfully reports the upload
// succeeded — so nothing else in this repo would notice the guard going missing
// until an editor found a broken image she could not fix from the UI.
import { describe, it, expect } from 'vitest';
import { unbackedManifestRecords } from '@codeyam/cms/lib/mediaLibrary';
import { commitAll, isUnbackedMediaError } from '@codeyam/cms/lib/githubCommit';
import type { PendingChange } from '@codeyam/cms/lib/pendingChanges';

/** The committed manifest as it stood before Nicole's upload, trimmed to one record. */
const BEFORE = JSON.stringify({
  assets: [{ filename: 'team/peter-boyce.png', url: '/images/team/peter-boyce.png', alt: 'Peter Boyce' }],
});

/** The manifest her publish actually wrote: three new volunteer records. */
const AFTER_THREE = JSON.stringify({
  assets: [
    { filename: 'team/peter-boyce.png', url: '/images/team/peter-boyce.png', alt: 'Peter Boyce' },
    { filename: 'volunteers.webp', url: '/images/volunteers.webp', sizeBytes: 126240 },
    { filename: 'volunteers-2.webp', url: '/images/volunteers-2.webp', sizeBytes: 126240 },
    { filename: 'gallery/volunteers.webp', url: '/images/gallery/volunteers.webp', sizeBytes: 126240 },
  ],
});

function manifestChange(original: string, updated: string): PendingChange {
  return {
    collection: 'media',
    slug: 'media.json',
    path: 'src/data/media.json',
    title: 'Media library',
    original,
    updated,
    kind: 'edit',
  } as PendingChange;
}

function imageChange(filename: string): PendingChange {
  return {
    collection: 'media',
    slug: filename,
    path: `public/images/${filename}`,
    title: filename,
    original: '',
    updated: 'UklGRg==',
    kind: 'edit',
    encoding: 'base64',
  } as PendingChange;
}

describe('unbackedManifestRecords', () => {
  // The exact shape of dd73c8c: three records added, one blob staged. The two
  // records whose bytes went missing are the ones that became broken images.
  it('reports records the commit adds without their image bytes', () => {
    const changes = [manifestChange(BEFORE, AFTER_THREE), imageChange('volunteers.webp')];

    expect(unbackedManifestRecords(changes)).toEqual(['volunteers-2.webp', 'gallery/volunteers.webp']);
  });

  // The healthy upload must not trip the guard, or every publish would be blocked.
  it('passes an upload whose bytes are staged alongside its record', () => {
    const oneRecord = JSON.stringify({
      assets: [
        { filename: 'team/peter-boyce.png', url: '/images/team/peter-boyce.png', alt: 'Peter Boyce' },
        { filename: 'volunteers.webp', url: '/images/volunteers.webp', sizeBytes: 126240 },
      ],
    });
    const changes = [manifestChange(BEFORE, oneRecord), imageChange('volunteers.webp')];

    expect(unbackedManifestRecords(changes)).toEqual([]);
  });

  // Alt-text edits, reorders, and removals rewrite the manifest without adding
  // records. Only ADDED records have to prove they brought bytes — a guard that
  // fired on metadata edits would block the most common media change there is.
  it('ignores a manifest edit that adds no records', () => {
    const reordered = JSON.stringify({
      assets: [{ filename: 'team/peter-boyce.png', url: '/images/team/peter-boyce.png', alt: 'Peter Boyce, board member' }],
    });

    expect(unbackedManifestRecords([manifestChange(BEFORE, reordered)])).toEqual([]);
  });

  // A staging set with no manifest change at all (an ordinary content edit) is
  // none of this guard's business.
  it('ignores a staging set that does not touch the manifest', () => {
    const entry = {
      collection: 'projects',
      slug: 'newsletter-editor',
      path: 'src/content/projects/newsletter-editor.md',
      title: 'Newsletter editor',
      original: 'a',
      updated: 'b',
      kind: 'edit',
    } as PendingChange;

    expect(unbackedManifestRecords([entry])).toEqual([]);
  });
});

describe('commitAll media guard', () => {
  // The guard must refuse BEFORE writing anything, so a refused publish mutates
  // nothing on the branch — the same fail-closed policy as the drift check.
  //
  // @codeyam/cms 0.13.0 reworked HOW it decides, and this test moved with it —
  // which is the job the header describes. `unbackedManifestRecords` now yields
  // CANDIDATES, and the guard probes the branch for each one, refusing only the
  // filenames that come back 404. That closed a false positive: bytes published
  // minutes ago are already on the branch while the build-time manifest baseline
  // still predates them, so they read as unbacked while being perfectly backed.
  //
  // So the assertion that moved is "no network call at all" → "no MUTATING call":
  // the probe is a read, and reads are what the new guard is made of. Counting
  // every call would now fail on a guard that works, which is the failure mode
  // this file exists to avoid.
  it('refuses to publish a record with no bytes, before writing anything', async () => {
    const changes = [manifestChange(BEFORE, AFTER_THREE), imageChange('volunteers.webp')];
    let mutating = 0;
    const fetchFn = ((_url: string, init?: { method?: string }) => {
      const method = init?.method ?? 'GET';
      if (method !== 'GET') mutating += 1;
      // Every probe 404s: on this branch none of the candidate blobs exist, which
      // is precisely Nicole's case — the manifest record landed, the bytes did not.
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
    }) as Parameters<typeof commitAll>[4];

    const err = await commitAll(
      [{ path: 'src/data/media.json', content: AFTER_THREE }],
      'Update 2 content entries via CodeYam CMS',
      { owner: 'nseldeib', repo: 'harvardintech', branch: 'main' },
      'token',
      fetchFn,
      [],
      { changes, overwriteDrift: true },
    ).catch((e) => e);

    expect(isUnbackedMediaError(err)).toBe(true);
    expect(err.filenames).toEqual(['volunteers-2.webp', 'gallery/volunteers.webp']);
    // Names the files so the editor knows which upload to redo.
    expect(err.message).toContain('volunteers-2.webp');
    // The refusal cost the branch nothing: reads to decide, no writes.
    expect(mutating).toBe(0);
  });
});

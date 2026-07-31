// The manifest-record/image-bytes invariant, tested against the patched
// @codeyam/cms commit path (see patches/@codeyam+cms+0.2.2.patch).
//
// This is the regression Nicole hit: she uploaded a volunteer photo from /admin,
// the publish landed `dd73c8c` — "Update 2 content entries via CodeYam CMS" —
// and that ONE commit carried three new records in `src/data/media.json` but only
// ONE file under `public/images/`. An upload stages the blob and the manifest
// edit as two independent PendingChanges, and nothing bound them together, so
// losing the blob published a record naming a file that does not exist. The site
// then renders a broken `<img>` the editor cannot fix from the UI.
//
// Tested here rather than upstream because the fix ships as a patch this repo
// applies on install: if a future @codeyam/cms drops or reworks the guard, these
// fail and we find out at CI time instead of at Nicole's next upload.
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
  // The guard must fire BEFORE any network call, so a refused publish mutates
  // nothing on the branch — the same fail-closed policy as the drift check.
  it('refuses to publish a record with no bytes, before touching GitHub', async () => {
    const changes = [manifestChange(BEFORE, AFTER_THREE), imageChange('volunteers.webp')];
    let called = 0;
    const fetchFn = (() => {
      called += 1;
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}), text: () => Promise.resolve('') });
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
    expect(called).toBe(0);
  });
});

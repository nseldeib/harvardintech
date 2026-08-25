// THIS NOW HOLDS A RELEASED DEPENDENCY TO ITS CONTRACT, NOT A LOCAL PATCH.
//
// It used to cover `@codeyam/cms/lib/entryDuplicate`, a module this repo ADDED
// to the CMS by patch so an editor could copy an entry from its row. Its old
// header said, in as many words, that a future upgrade could "drop or rework the
// module" and that the failure would be silent.
//
// The 0.7.1 → 0.13.0 upgrade was that event, and it resolved the GOOD way:
// **0.13.0 ships Duplicate natively**, as `lib/duplicateEntry`. The feature was
// not removed from the product — it moved from our patch into the dependency,
// which is the lifecycle CMS_SETUP.md describes and the third time this repo has
// completed it (media guard at 0.4.0, deploy watch at 0.5.0, Duplicate here).
// Our copy was deleted because keeping both would mean two `duplicateHref`
// exports with different signatures in the same component — which is exactly
// what broke the first attempt at this upgrade.
//
// Upstream's is not a copy of ours and is better than what it replaced: ours put
// the source behind a `?from=<slug>` param and shipped a `sources` map with
// every static list page so the create form could resolve it; upstream stashes
// the raw markdown in `sessionStorage` and carries only a key in the URL, so the
// page ships nothing extra. Not one symbol survived, so this file could not be
// re-pointed assertion-for-assertion — what follows tests the REPLACEMENT.
//
// Keeping it is the point. The reason the old header gave is unchanged and now
// applies to code we no longer control: if a later release reworks or drops
// Duplicate, the button stops appearing in /admin with no build error and
// nothing in this repo to notice. Same canary, new bird.
import { describe, it, expect } from 'vitest';
import {
  copyLabel,
  uniqueSlug,
  duplicateHref,
  duplicateParamOf,
} from '@codeyam/cms/lib/duplicateEntry';

describe('duplicate: the copy is distinguishable from its source', () => {
  // The whole point of Duplicate is a SECOND entry. A copy carrying the source's
  // title would sit in the list as an identical twin, and the editor's first job
  // would be working out which row is which.
  it('marks the copied title as a copy', () => {
    expect(copyLabel('Momentum Fund')).toBe('Momentum Fund copy');
  });

  // A blank label stays blank rather than becoming a bare " copy": an untitled
  // entry is already stopped by the create form's required-field gate, and
  // " copy" alone reads as a title rather than as the absence of one.
  it('leaves a blank title blank', () => {
    expect(copyLabel('')).toBe('');
    expect(copyLabel('   ')).toBe('   ');
  });
});

describe('duplicate: the copy never overwrites an existing entry', () => {
  // The expensive failure. Slugs are file paths, so a copy reusing a taken slug
  // would not sit beside the original — it would REPLACE it at publish, and the
  // original's content would be gone with no warning at any point in the flow.
  it('keeps a free slug as-is', () => {
    expect(uniqueSlug('mission', ['donors', 'pillars'])).toBe('mission');
  });

  // The first collision suffixes rather than failing, so duplicating an entry
  // never asks the editor to invent a name before they have seen the copy.
  it('suffixes a taken slug', () => {
    expect(uniqueSlug('mission', ['mission'])).toBe('mission-2');
  });

  // Duplicating the same entry repeatedly has to keep finding free slugs — the
  // suffix itself can collide, and stopping at `-2` would overwrite the copy
  // made a moment earlier.
  it('keeps counting past a taken suffix', () => {
    expect(uniqueSlug('mission', ['mission', 'mission-2', 'mission-3'])).toBe('mission-4');
  });
});

describe('duplicate: the row hands off to the create form', () => {
  // The hand-off is a URL, so it is the one part of the flow that survives a
  // page load — and the create page is STATIC, so the query param is the only
  // thing that can tell the island a duplicate is in progress.
  it('points at the create form carrying the source slug', () => {
    expect(duplicateHref('/admin/new/momentumSections', 'donors')).toBe(
      '/admin/new/momentumSections?duplicate=donors',
    );
  });

  // A slug carrying a space or a slash would otherwise break the query string
  // or read as a path segment, and the create form would receive a truncated
  // key that matches no stored seed.
  it('encodes a slug that needs it', () => {
    expect(duplicateHref('/admin/new/blog', 'a b/c')).toBe('/admin/new/blog?duplicate=a%20b%2Fc');
  });

  // The other half of the hand-off: the create page is static, so reading the
  // param back is the only way the island learns a duplicate is in progress.
  it('reads the slug back off the query string', () => {
    expect(duplicateParamOf('?duplicate=donors')).toBe('donors');
  });

  // A plain "+ New" must open a BLANK form. If an absent or empty param read as
  // anything other than null, every new entry would start life prefilled from
  // whichever entry was copied last.
  it('reads no duplicate from a bare or empty query string', () => {
    expect(duplicateParamOf('')).toBeNull();
    expect(duplicateParamOf('?other=1')).toBeNull();
    expect(duplicateParamOf('?duplicate=')).toBeNull();
  });
});

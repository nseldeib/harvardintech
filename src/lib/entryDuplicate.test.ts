// THIS COVERS A LOCAL PATCH, NOT OUR OWN CODE.
//
// `@codeyam/cms/lib/entryDuplicate` does not exist upstream. It is added by
// `patches/@codeyam+cms+0.5.0.patch` in this repo — the same patch that carries
// the reorder arrows — so every symbol imported below lives inside a dependency
// we are locally modifying.
//
// That is exactly why these tests are here. A future `@codeyam/cms` upgrade
// regenerates `node_modules` and can drop or rework the module, and the failure
// mode is SILENT: the Duplicate button simply stops appearing in /admin, with no
// build error and nothing in this repo to notice. These tests turn that into a
// loud CI failure instead of something an editor discovers months later.
//
// The pattern is the one `mediaCommitGuard.test.ts` and `dashboardGrouping.test.ts`
// already establish for pinning a dependency's contract from this repo.
import { describe, it, expect } from 'vitest';
import {
  canDuplicate,
  duplicateHref,
  duplicateLabel,
  duplicateValues,
  nextFreeSlug,
} from '@codeyam/cms/lib/entryDuplicate';

/** The momentumSections field set, trimmed to what these tests exercise. */
const FIELDS = [
  { name: 'kind' },
  { name: 'title' },
  { name: 'group' },
  { name: 'layout' },
  { name: 'order' },
  { name: 'draft' },
];

describe('nextFreeSlug', () => {
  // Counts from 2 because the SOURCE is the first one — a `-1` suffix would
  // imply the original was numbered too.
  it('suggests the source slug numbered from two', () => {
    expect(nextFreeSlug('pillars', ['pillars'])).toBe('pillars-2');
  });

  // Keeps counting past every taken slug rather than stopping at the first gap,
  // so duplicating twice in a row cannot suggest the same name twice.
  it('skips slugs already taken and keeps counting', () => {
    expect(nextFreeSlug('pillars', ['pillars', 'pillars-2'])).toBe('pillars-3');
    expect(nextFreeSlug('pillars', ['pillars', 'pillars-2', 'pillars-3'])).toBe('pillars-4');
  });

  // Duplicating a duplicate counts on from the base rather than growing a second
  // suffix, so an editor never ends up with `pillars-2-2`.
  it('counts on from the base when the source is itself numbered', () => {
    expect(nextFreeSlug('pillars-2', ['pillars', 'pillars-2'])).toBe('pillars-3');
  });

  // The list the caller passes includes staged-but-unpublished slugs, so a
  // suggestion cannot collide with a duplicate created moments earlier.
  it('avoids a slug that exists only as a staged change', () => {
    expect(nextFreeSlug('pillars', ['pillars', 'pillars-2', 'pillars-4'])).toBe('pillars-3');
  });

  // Nothing taken at all still numbers from two — the source's own slug being
  // absent from the list does not make `-1` correct.
  it('numbers from two even when no slug is taken', () => {
    expect(nextFreeSlug('events', [])).toBe('events-2');
  });
});

describe('duplicateLabel', () => {
  // The suffix is a PROMPT to rename, not a final name — but an editor who
  // duplicates and immediately saves still gets two rows they can tell apart.
  it('marks the copied label as a copy', () => {
    expect(duplicateLabel('What Your Support Powers')).toBe('What Your Support Powers (copy)');
  });

  // A blank label stays blank so the create form's own missing-title gate is what
  // the editor meets, rather than a row named "(copy)" with nothing in front.
  it('leaves a blank or whitespace-only label blank', () => {
    expect(duplicateLabel('')).toBe('');
    expect(duplicateLabel('   ')).toBe('');
  });

  // Surrounding whitespace is trimmed before the suffix is appended.
  it('trims the source label before appending the suffix', () => {
    expect(duplicateLabel('  Why Support Harvard in Tech?  ')).toBe(
      'Why Support Harvard in Tech? (copy)',
    );
  });
});

describe('duplicateValues', () => {
  // Verbatim is the contract — including `order`, so the copy appears beside its
  // source where the editor is already looking and the reorder arrows move it.
  it('copies every declared field verbatim, order included', () => {
    const data = { kind: 'pillars', title: 'What Your Support Powers', group: 'powers', order: 2 };
    expect(duplicateValues(FIELDS, data)).toEqual(data);
  });

  // The preview markers identify the SOURCE file's role as a preview clone, not
  // its content. Copying them would mint a second unlisted clone of the same
  // target — which is the one thing this action must never do.
  it('drops the preview markers rather than minting a second clone', () => {
    const data = {
      kind: 'pillars',
      title: 'A preview',
      previewOf: 'pillars',
      previewCreatedAt: '2026-08-01',
      previewLock: 'ciphertext',
    };
    const out = duplicateValues([...FIELDS, { name: 'previewOf' }], data);
    expect(out).not.toHaveProperty('previewOf');
    expect(out).not.toHaveProperty('previewCreatedAt');
    expect(out).not.toHaveProperty('previewLock');
    expect(out.title).toBe('A preview');
  });

  // Scoped to the registry's declared fields, so a stray key cannot be carried
  // into a file the editor has no input for and therefore cannot change.
  it('ignores keys the collection registry does not declare', () => {
    const out = duplicateValues(FIELDS, { kind: 'pillars', mysteryKey: 'from a hand-edit' });
    expect(out).toEqual({ kind: 'pillars' });
  });

  // A field the source never set stays unset rather than arriving as undefined,
  // which would serialize an empty key into the new file's frontmatter.
  it('omits fields the source entry does not carry', () => {
    const out = duplicateValues(FIELDS, { kind: 'pillars' });
    expect(Object.keys(out)).toEqual(['kind']);
  });

  // A boolean false is a real value, not an absent one — a drafted source must
  // duplicate as published if that is what it says.
  it('preserves falsy values that are genuinely set', () => {
    const out = duplicateValues(FIELDS, { kind: 'pillars', draft: false, order: 0 });
    expect(out).toEqual({ kind: 'pillars', draft: false, order: 0 });
  });
});

describe('canDuplicate', () => {
  // Every ordinary row offers it — gating the action to one collection would be
  // extra code to make the feature smaller.
  it('allows duplicating an ordinary entry', () => {
    expect(canDuplicate(false)).toBe(true);
  });

  // The one exclusion: a preview is a clone at an unguessable URL, and copying
  // one would mint a second unlisted clone of the same target.
  it('refuses to duplicate a preview row', () => {
    expect(canDuplicate(true)).toBe(false);
  });
});

describe('duplicateHref', () => {
  // A link to the create form, not a staged action — so opening it and changing
  // your mind leaves nothing in the pending-changes store to undo.
  it('points at the create form for the row collection', () => {
    expect(duplicateHref('momentumSections', 'pillars')).toBe(
      '/admin/new/momentumSections?from=pillars',
    );
  });

  // Slugs come from filenames, so an unusual character must survive the round
  // trip rather than truncating the query.
  it('encodes the source slug', () => {
    expect(duplicateHref('blog', 'a b&c')).toBe('/admin/new/blog?from=a%20b%26c');
  });
});

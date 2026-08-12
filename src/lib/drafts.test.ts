import { describe, it, expect } from 'vitest';
import { isLocked, isPreview, publishedEntries, routableEntries, type DraftableEntry } from './drafts';

/** Minimal stand-in for a content-collection entry: an id plus a `data` bag. */
type Entry = DraftableEntry & {
  id: string;
  data: { title?: string; draft?: boolean; previewOf?: string; previewLock?: string };
};

const entry = (id: string, draft?: boolean): Entry => ({
  id,
  data: draft === undefined ? { title: id } : { title: id, draft },
});

/** A preview clone of `previewOf`, optionally password-protected and optionally
 * carrying its source's draft flag (which a real clone does). */
const preview = (
  id: string,
  previewOf: string,
  opts: { draft?: boolean; lock?: string } = {},
): Entry => ({
  id,
  data: {
    title: id,
    previewOf,
    ...(opts.draft === undefined ? {} : { draft: opts.draft }),
    ...(opts.lock === undefined ? {} : { previewLock: opts.lock }),
  },
});

describe('publishedEntries', () => {
  // the reproduction case: an entry flagged draft is withheld from the published listing
  it('omits draft entries from the blog listing in production', () => {
    const entries = [
      { id: 'live-post', data: { title: 'Live', draft: false } },
      { id: 'wip-post', data: { title: 'WIP', draft: true } },
    ];
    expect(publishedEntries(entries).map((e) => e.id)).toEqual(['live-post']);
  });

  // the same draft entry is kept when the caller asks for drafts, which is how dev previews work
  it('keeps draft entries when includeDrafts is true', () => {
    const entries = [entry('live-post', false), entry('wip-post', true)];
    expect(publishedEntries(entries, true).map((e) => e.id)).toEqual(['live-post', 'wip-post']);
  });

  // no-regression guard: every existing entry has no draft key at all and must stay published
  it('treats a missing draft key as published', () => {
    const entries = [entry('welcome'), entry('summit-recap')];
    expect(publishedEntries(entries).map((e) => e.id)).toEqual(['welcome', 'summit-recap']);
  });

  // a hand-edited file may spell out draft false even though the CMS only ever writes true
  it('treats an explicit draft false as published', () => {
    expect(publishedEntries([entry('nyc', false)]).map((e) => e.id)).toEqual(['nyc']);
  });

  // a collection where every entry is drafted publishes nothing rather than falling back to all
  it('returns an empty array when every entry is a draft', () => {
    const entries = [entry('wip-one', true), entry('wip-two', true)];
    expect(publishedEntries(entries)).toEqual([]);
  });

  // an empty collection is not an error condition
  it('returns an empty array for an empty collection', () => {
    expect(publishedEntries([])).toEqual([]);
    expect(publishedEntries([], true)).toEqual([]);
  });

  // relative order is preserved so a caller can sort before or after filtering
  it('preserves the order of the surviving entries', () => {
    const entries = [entry('a'), entry('skipped', true), entry('b'), entry('c')];
    expect(publishedEntries(entries).map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  // returns a new array in both branches, so a caller chaining sort cannot mutate the collection
  it('does not mutate the input array', () => {
    const entries = [entry('live'), entry('wip', true)];
    const filtered = publishedEntries(entries);
    const passthrough = publishedEntries(entries, true);
    expect(entries).toHaveLength(2);
    expect(filtered).not.toBe(entries);
    expect(passthrough).not.toBe(entries);
  });

  // only an exact boolean true hides an entry, so a stray truthy string does not silently unpublish
  it('hides an entry only when draft is exactly true', () => {
    const entries = [{ id: 'stringy', data: { draft: 'true' as unknown as boolean } }];
    expect(publishedEntries(entries).map((e) => e.id)).toEqual(['stringy']);
  });

  // THE preview-link invariant on the listing side. A preview page exists to be
  // reachable ONLY by the token URL someone was handed, so a listing that showed
  // it would publish the very thing the token protects.
  it('omits preview pages from a listing', () => {
    const entries = [entry('welcome'), preview('preview-abc', 'welcome')];
    expect(publishedEntries(entries).map((e) => e.id)).toEqual(['welcome']);
  });

  // includeDrafts governs the DRAFT flag only. A preview is hidden for a
  // different reason, so the review track — which shows drafts — still must not
  // list previews.
  it('still omits previews when includeDrafts is true', () => {
    const entries = [entry('welcome'), entry('wip', true), preview('preview-abc', 'welcome')];
    expect(publishedEntries(entries, true).map((e) => e.id)).toEqual(['welcome', 'wip']);
  });
});

describe('routableEntries', () => {
  // the mirror image of the listing rule, and the reason preview links resolve
  // at all: the page must be BUILT even though nothing links to it
  it('builds a page for a preview that no listing shows', () => {
    const entries = [entry('welcome'), preview('preview-abc', 'welcome')];
    expect(publishedEntries(entries).map((e) => e.id)).toEqual(['welcome']);
    expect(routableEntries(entries).map((e) => e.id)).toEqual(['welcome', 'preview-abc']);
  });

  // a preview clone carries its source's draft flag; hiding it was never the
  // point, so it stays routable even in a production build that drops drafts
  it('builds a preview even when it also carries draft true', () => {
    const entries = [entry('welcome'), preview('preview-abc', 'welcome', { draft: true })];
    expect(routableEntries(entries).map((e) => e.id)).toEqual(['welcome', 'preview-abc']);
  });

  // routes and listings must agree about ordinary drafts, or the review track
  // links to pages the public build never generated
  it('follows the draft rule for everything that is not a preview', () => {
    const entries = [entry('live'), entry('wip', true)];
    expect(routableEntries(entries).map((e) => e.id)).toEqual(['live']);
    expect(routableEntries(entries, true).map((e) => e.id)).toEqual(['live', 'wip']);
  });

  // input order survives, so a route file can sort before or after
  it('preserves input order and does not mutate the input', () => {
    const entries = [entry('a'), preview('preview-x', 'a'), entry('b')];
    const routed = routableEntries(entries);
    expect(routed.map((e) => e.id)).toEqual(['a', 'preview-x', 'b']);
    expect(routed).not.toBe(entries);
    expect(entries).toHaveLength(3);
  });

  // a collection with no previews behaves exactly as publishedEntries does, so
  // adopting this in a getStaticPaths changes nothing until a link is minted
  it('matches publishedEntries when the collection has no previews', () => {
    const entries = [entry('a'), entry('b', true), entry('c')];
    expect(routableEntries(entries).map((e) => e.id)).toEqual(
      publishedEntries(entries).map((e) => e.id),
    );
  });
});

describe('isPreview', () => {
  // `previewOf` is the ONLY marker — a slug that merely looks like one is not enough
  it('is true only for an entry carrying previewOf', () => {
    expect(isPreview(preview('preview-abc', 'welcome'))).toBe(true);
    expect(isPreview(entry('welcome'))).toBe(false);
    expect(isPreview(entry('welcome', true))).toBe(false);
  });
});

describe('isLocked', () => {
  // the distinction the blog route branches on: an unlocked preview renders its
  // markdown, a locked one holds ciphertext that must never reach <Content />
  it('separates a password-protected preview from an ordinary one', () => {
    expect(isLocked(preview('preview-locked', 'welcome', { lock: 'v1.600000.c2FsdA==.aXY=' }))).toBe(
      true,
    );
    expect(isLocked(preview('preview-open', 'welcome'))).toBe(false);
  });

  // an ordinary page is never locked, whatever its draft state
  it('is false for a page that is not a preview at all', () => {
    expect(isLocked(entry('welcome'))).toBe(false);
    expect(isLocked(entry('wip', true))).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { publishedEntries, type DraftableEntry } from './drafts';

/** Minimal stand-in for a content-collection entry: an id plus a `data` bag. */
type Entry = DraftableEntry & { id: string; data: { title?: string; draft?: boolean } };

const entry = (id: string, draft?: boolean): Entry => ({
  id,
  data: draft === undefined ? { title: id } : { title: id, draft },
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
});

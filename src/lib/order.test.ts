import { describe, it, expect } from 'vitest';
import { byOrder, sortByOrder } from './order';

describe('byOrder', () => {
  // The happy path: a jumbled list of ordered entries comes back ascending.
  it('sorts ascending by order', () => {
    const sorted = [{ order: 3 }, { order: 1 }, { order: 2 }].sort(byOrder);
    expect(sorted.map((x) => x.order)).toEqual([1, 2, 3]);
  });

  // An entry with no order sorts LAST, not first — the core guarantee.
  it('sorts entries without an order last', () => {
    // The bug this guards: `order ?? 0` would hoist unordered entries to the
    // front, so a project an editor never numbered would outrank #1.
    const sorted = [{ id: 'none' }, { id: 'first', order: 1 }].sort(byOrder);
    expect(sorted.map((x) => x.id)).toEqual(['first', 'none']);
  });

  // Order 0 is a real position, not a stand-in for missing — it must rank
  // ahead of an unordered entry, which a truthiness check would get wrong.
  it('treats order 0 as ordered, not as missing', () => {
    const sorted = [{ id: 'none' }, { id: 'zero', order: 0 }].sort(byOrder);
    expect(sorted.map((x) => x.id)).toEqual(['zero', 'none']);
  });

  // Negative order values still sort numerically, below the positives.
  it('handles negative order values', () => {
    const sorted = [{ order: 1 }, { order: -5 }].sort(byOrder);
    expect(sorted.map((x) => x.order)).toEqual([-5, 1]);
  });
});

describe('sortByOrder', () => {
  // The wrapper sorts without mutating its input, so a caller's array is safe.
  it('returns a new array and leaves the source untouched', () => {
    const source = [{ order: 2 }, { order: 1 }];
    const sorted = sortByOrder(source);
    expect(sorted.map((x) => x.order)).toEqual([1, 2]);
    expect(source.map((x) => x.order)).toEqual([2, 1]);
    expect(sorted).not.toBe(source);
  });

  // With no orders at all, the sort is stable — the CMS's authored order wins.
  it('preserves input order among entries that all lack an order', () => {
    const source: { id: string; order?: number }[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(sortByOrder(source).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });

  // A tie on order preserves input order, so equal-ranked entries stay put.
  it('preserves input order among entries sharing the same order', () => {
    const source = [
      { id: 'a', order: 1 },
      { id: 'b', order: 1 },
    ];
    expect(sortByOrder(source).map((x) => x.id)).toEqual(['a', 'b']);
  });

  // The empty list is a valid input — the production default for both collections.
  it('returns an empty array unchanged', () => {
    expect(sortByOrder([])).toEqual([]);
  });
});

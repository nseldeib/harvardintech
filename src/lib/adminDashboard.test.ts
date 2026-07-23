import { describe, it, expect } from 'vitest';
import {
  ADMIN_COLLECTIONS,
  dashboardTotals,
  dashboardSummaryText,
  type CollectionCard,
} from './adminDashboard';

const card = (
  collection: CollectionCard['collection'],
  label: string,
  count: number,
): CollectionCard => ({ collection, label, count });

describe('ADMIN_COLLECTIONS', () => {
  // The dashboard covers every folder collection, in display order.
  it('lists the editable folder collections in order', () => {
    expect(ADMIN_COLLECTIONS.map((c) => c.collection)).toEqual([
      'events',
      'team',
      'chapters',
      'blog',
      'pages',
      'projects',
      'testimonials',
    ]);
  });

  // Every entry has a non-empty human label for its card.
  it('gives every collection a non-empty label', () => {
    for (const def of ADMIN_COLLECTIONS) {
      expect(def.label.length).toBeGreaterThan(0);
    }
  });
});

describe('dashboardTotals', () => {
  // Sums every card's count and reports how many collections there are.
  it('sums counts and reports the collection count', () => {
    const cards = [
      card('events', 'Events', 3),
      card('team', 'Team', 5),
      card('chapters', 'Chapters', 4),
    ];
    expect(dashboardTotals(cards)).toEqual({ total: 12, collectionCount: 3 });
  });

  // An empty card list totals zero across zero collections.
  it('returns zeros for an empty card list', () => {
    expect(dashboardTotals([])).toEqual({ total: 0, collectionCount: 0 });
  });

  // Collections with a zero count still count toward collectionCount but add nothing.
  it('counts empty collections without adding to the total', () => {
    const cards = [card('blog', 'Blog', 0), card('pages', 'Pages', 0)];
    expect(dashboardTotals(cards)).toEqual({ total: 0, collectionCount: 2 });
  });
});

describe('dashboardSummaryText', () => {
  // The populated summary reports total entries and collection count.
  it('summarizes a populated dashboard', () => {
    expect(dashboardSummaryText(14, 5)).toBe(
      'Managing 14 content entries across 5 collections.',
    );
  });

  // A single entry uses the singular "entry".
  it('uses the singular entry for a count of one', () => {
    expect(dashboardSummaryText(1, 5)).toBe(
      'Managing 1 content entry across 5 collections.',
    );
  });

  // Zero entries shows the empty-state nudge, not a "0 entries" sentence.
  it('shows the empty-state nudge when there is no content', () => {
    expect(dashboardSummaryText(0, 5)).toBe(
      'No content yet — open the editor to create your first entry.',
    );
  });

  // A negative total is treated as empty, guarding against bad input.
  it('treats a negative total as empty', () => {
    expect(dashboardSummaryText(-2, 5)).toBe(
      'No content yet — open the editor to create your first entry.',
    );
  });
});

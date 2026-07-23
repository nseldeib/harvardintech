// Pure, framework-free helpers for the /admin CRM dashboard. Kept out of any
// `.astro` component so they can be unit-tested under vitest. No DOM, no Astro
// or `astro:content` imports — the page loads collection lengths via
// getCollection and hands the resulting counts here. Data in, data out.

/** A Sveltia collection name that maps 1:1 to a `src/content/<name>/` folder. */
export type CollectionName =
  | 'events'
  | 'team'
  | 'chapters'
  | 'blog'
  | 'pages'
  | 'projects'
  | 'testimonials';

export interface CollectionDef {
  /** Sveltia collection name — also the editor deep-link segment and content folder. */
  collection: CollectionName;
  /** Human label shown on the dashboard card. */
  label: string;
}

export interface CollectionCard extends CollectionDef {
  /** Number of entries currently in the collection. */
  count: number;
}

/**
 * The editable collections shown on the dashboard, in display order. Mirrors
 * the folder collections in `public/admin/editor/config.yml` and
 * `src/content/config.ts` (the two singletons, `settings`/`nav`, are edited in
 * the CMS but are not counted here since they are single files, not folders).
 */
export const ADMIN_COLLECTIONS: readonly CollectionDef[] = [
  { collection: 'events', label: 'Events' },
  { collection: 'team', label: 'Team' },
  { collection: 'chapters', label: 'Chapters' },
  { collection: 'blog', label: 'Blog' },
  { collection: 'pages', label: 'Pages' },
  { collection: 'projects', label: 'Volunteer Projects' },
  { collection: 'testimonials', label: 'Testimonials' },
];

/**
 * Total entries across all cards plus how many collections there are. Used for
 * the dashboard's one-line summary.
 */
export function dashboardTotals(cards: CollectionCard[]): {
  total: number;
  collectionCount: number;
} {
  return {
    total: cards.reduce((sum, c) => sum + c.count, 0),
    collectionCount: cards.length,
  };
}

/**
 * The dashboard summary sentence. With zero total entries it nudges the editor
 * to create the first one; otherwise it reports the counts with correct
 * singular/plural grammar for a single entry.
 */
export function dashboardSummaryText(total: number, collectionCount: number): string {
  if (total <= 0) {
    return 'No content yet — open the editor to create your first entry.';
  }
  const entryWord = total === 1 ? 'entry' : 'entries';
  return `Managing ${total} content ${entryWord} across ${collectionCount} collections.`;
}

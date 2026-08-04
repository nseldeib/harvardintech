import * as fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { groupCardsByPage, type CollectionCard } from '@codeyam/cms/lib/adminDashboard';

// `groupCardsByPage` turns the flat collection grid into "here is what builds
// each page", which is the question an editor actually arrives with. These tests
// pin the grouping rules, then check the grouping this site's real `paths` map
// produces — the part that has to stay sensible as collections are added.

const card = (collection: string, total = 1): CollectionCard => ({
  collection,
  label: collection,
  total,
  published: total,
  draft: 0,
});

describe('groupCardsByPage', () => {
  // The core of the fix: an editor looking at /donate sees the collections that
  // build it gathered, instead of scattered through an A-to-Z list.
  it('puts collections that share a page together', () => {
    const groups = groupCardsByPage([card('pillars'), card('blog'), card('donors')], {
      pillars: '/donate',
      donors: '/donate',
      blog: '/blog/:slug',
    });
    const donate = groups.find((g) => g.key === '/donate');
    expect(donate?.cards.map((c) => c.collection)).toEqual(['pillars', 'donors']);
  });

  // These have no single shared page to group under, so they share a heading
  // that states the thing worth knowing: adding an entry adds a page.
  it('collects every per-entry collection under one "own page" group', () => {
    const groups = groupCardsByPage([card('blog'), card('chapters')], {
      blog: '/blog/:slug',
      chapters: '/chapters/:slug',
    });
    const own = groups.find((g) => g.key === 'own-page');
    expect(own?.cards.map((c) => c.collection)).toEqual(['blog', 'chapters']);
    expect(own?.label).toBe('Each entry has its own page');
  });

  // Site-wide settings are not part of any page and must not be filed under one.
  it('separates collections that have no page of their own', () => {
    const groups = groupCardsByPage([card('siteIntegrations')], { siteIntegrations: null });
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('no-page');
    expect(groups[0].label).toBe('Site-wide settings');
  });

  // Order walks an editor from the page they are most often looking at outward.
  it('leads with the homepage, then other pages, then own-page, then site-wide', () => {
    const groups = groupCardsByPage(
      [card('siteIntegrations'), card('blog'), card('pillars'), card('heroSlides')],
      {
        siteIntegrations: null,
        blog: '/blog/:slug',
        pillars: '/donate',
        heroSlides: '/',
      },
    );
    expect(groups.map((g) => g.key)).toEqual(['/', '/donate', 'own-page', 'no-page']);
  });

  // The homepage gets a name; other pages get the path an editor can read off
  // their own address bar, which is more use than an invented label.
  it('labels the homepage in words and other pages by their path', () => {
    const groups = groupCardsByPage([card('heroSlides'), card('pillars')], {
      heroSlides: '/',
      pillars: '/donate',
    });
    expect(groups[0].label).toBe('Homepage');
    expect(groups[1].label).toBe('/donate');
  });

  // Grouping must not reshuffle within a group — the caller decides that order.
  it('preserves the caller’s card order within a group', () => {
    const groups = groupCardsByPage([card('c'), card('a'), card('b')], {
      c: '/donate',
      a: '/donate',
      b: '/donate',
    });
    expect(groups[0].cards.map((x) => x.collection)).toEqual(['c', 'a', 'b']);
  });

  // The two must agree, or a card would be filed under a group whose link
  // behaviour contradicts it.
  it('treats an undeclared collection as having its own page, matching publicUrl', () => {
    const groups = groupCardsByPage([card('mystery')], {});
    expect(groups[0].key).toBe('own-page');
  });

  // A site that declares no placements renders exactly the grid it did before.
  it('returns a single group when nothing is declared, so the grid stays flat', () => {
    const groups = groupCardsByPage([card('a'), card('b')], {});
    expect(groups).toHaveLength(1);
  });

  // A brand-new site has no collections yet and must not crash the dashboard.
  it('handles no cards at all', () => {
    expect(groupCardsByPage([], {})).toEqual([]);
  });
});

describe('this site’s dashboard grouping', () => {
  const registry = JSON.parse(fs.readFileSync('src/data/collections.json', 'utf8')) as {
    collections: { id: string }[];
    paths?: Record<string, string | null>;
  };
  const all = [
    ...new Set([...registry.collections.map((c) => c.id), 'pages', 'blog', 'events', 'team']),
  ].map((id) => card(id));
  const groups = groupCardsByPage(all, registry.paths ?? {});

  // The guarantee that matters most: grouping is a rearrangement, never a filter.
  // A dropped collection would be invisible to the editor with no error anywhere.
  it('loses no collection to grouping', () => {
    const grouped = groups.flatMap((g) => g.cards.map((c) => c.collection));
    expect(grouped.sort()).toEqual(all.map((c) => c.collection).sort());
  });

  // The worst case on this site — six collections build one page, which is
  // exactly the situation a flat list made impossible to reason about.
  it('gathers the six Momentum Fund collections under /donate', () => {
    const donate = groups.find((g) => g.key === '/donate');
    expect(donate?.cards.map((c) => c.collection).sort()).toEqual([
      'accomplishments',
      'donors',
      'momentumSections',
      'pageCopy',
      'pillars',
      'testimonials',
    ]);
  });

  // team is declared as /#board — an anchor on the homepage rather than a page
  // of its own. It must group WITH the homepage, or an editor looking at the
  // front page finds three of its four collections and guesses about the fourth.
  it('gathers the homepage collections, including the board, under the homepage', () => {
    // `team` is declared as `/#board` — an anchor on the homepage rather than a
    // page of its own, which is where a director's tile actually renders. It
    // must group WITH the homepage, or an editor looking at the front page finds
    // three of its four collections and has to guess about the fourth.
    const home = groups.find((g) => g.key === '/');
    expect(home?.cards.map((c) => c.collection).sort()).toEqual([
      'heroSlides',
      'homeSections',
      'stats',
      'team',
    ]);
    expect(groups.some((g) => g.key === '/#board')).toBe(false);
  });

  // The real ordering on this site, not just the synthetic fixtures above.
  it('opens on the homepage and closes on site-wide settings', () => {
    expect(groups[0].key).toBe('/');
    expect(groups[groups.length - 1].key).toBe('no-page');
  });
});

describe('anchors group with their page', () => {
  // An anchor names a band within a page, not a page — so it groups with that
  // page rather than forming a group of its own.
  it('files an anchored placement under the page it is an anchor on', () => {
    const groups = groupCardsByPage([card('heroSlides'), card('team')], {
      heroSlides: '/',
      team: '/#board',
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('/');
    expect(groups[0].cards.map((c) => c.collection)).toEqual(['heroSlides', 'team']);
  });

  // The same rule away from the homepage, so it is a rule and not a special case.
  it('groups an anchor on a non-homepage page with that page', () => {
    const groups = groupCardsByPage([card('pillars'), card('donors')], {
      pillars: '/donate',
      donors: '/donate#wall',
    });
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('/donate');
  });
});

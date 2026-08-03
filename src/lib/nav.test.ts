import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  chapterNavItems,
  withChapterGroup,
  communityNavItems,
  withCommunityItems,
  internalNavUrls,
  unresolvedNavUrls,
  withoutHiddenSections,
} from './nav';
import { publishedEntries } from './drafts';
import type { NavItem } from './site';

// The menu an editor sees before any chapter is derived into it: the four
// hand-authored groups from `nav.json`, minus the Chapters group this feature
// removes.
const HAND_AUTHORED: NavItem[] = [
  { label: 'Programs', children: [{ label: 'All Events', url: '/events' }] },
  { label: 'Communities', children: [{ label: 'WhatsApp', url: '/#community' }] },
];

/** A chapter as the layout passes it in: `{ slug, ...data }`, the same shape
 *  `index.astro` builds for the "Our chapters" section. */
function chapter(slug: string, city: string, order?: number) {
  return { slug, city, order };
}

/** A raw collection entry, for exercising the draft rule end to end. */
function entry(slug: string, city: string, order?: number, draft?: boolean) {
  return { id: slug, data: { city, order, draft } };
}

describe('chapterNavItems', () => {
  // THE REPRODUCTION TEST. A chapter that exists in the collection must appear
  // in the menu even though nav.json has never heard of it — the drift that
  // leaves a published chapter unreachable from the header.
  it('includes a chapter that nav.json does not list', () => {
    const chapters = [chapter('miami', 'Miami', 6)];

    const items = withChapterGroup(HAND_AUTHORED, chapterNavItems(chapters));
    const group = items.find((i) => i.label === 'Chapters');

    expect(group?.children).toEqual([{ label: 'Miami', url: '/chapters/miami' }]);
  });

  // Menu order must match the "Our chapters" cards exactly, or the two surfaces
  // list the same chapters in different sequences on the same page.
  it('orders by the order field, falling back to city for ties and absent values', () => {
    const chapters = [
      chapter('seattle', 'Seattle', 5),
      chapter('boston-cambridge', 'Boston & Cambridge', 1),
      chapter('zurich', 'Zurich'), // no order — sorts last
      chapter('austin', 'Austin'), // no order — ties with Zurich, city breaks it
      chapter('nyc', 'New York City', 2),
    ];

    expect(chapterNavItems(chapters).map((i) => i.label)).toEqual([
      'Boston & Cambridge',
      'New York City',
      'Seattle',
      'Austin',
      'Zurich',
    ]);
  });

  // The label and the url come from different fields. Building the url from the
  // city would 404 for every chapter whose display name is not its slug.
  it('builds the url from the slug, not the city', () => {
    expect(chapterNavItems([chapter('dc-dmv', 'DC & DMV Area', 4)])).toEqual([
      { label: 'DC & DMV Area', url: '/chapters/dc-dmv' },
    ]);
  });

  // Production started with an empty chapters collection, so the no-chapters
  // path is a real state, not a hypothetical.
  it('returns no items for no chapters', () => {
    expect(chapterNavItems([])).toEqual([]);
  });
});

describe('draft visibility', () => {
  const entries = [
    entry('london', 'London', 3),
    entry('miami', 'Miami', 6, true),
  ];

  // The rule every other route already applies: drafts are visible under
  // `astro dev` (and therefore the codeyam preview) and absent from the build.
  const derive = (includeDrafts: boolean) =>
    chapterNavItems(
      publishedEntries(entries, includeDrafts).map((c) => ({ slug: c.id, ...c.data })),
    ).map((i) => i.label);

  // A drafted chapter has no published page, so linking to it from the built
  // site would be a menu entry pointing at a 404.
  it('omits a drafted chapter from the production menu', () => {
    expect(derive(false)).toEqual(['London']);
  });

  // The other half of the same rule: an editor previewing a draft needs to see
  // it in the menu, or they cannot check their work before publishing.
  it('shows a drafted chapter while authoring', () => {
    expect(derive(true)).toEqual(['London', 'Miami']);
  });
});

describe('withChapterGroup', () => {
  const chapterItems = [{ label: 'London', url: '/chapters/london' }];

  // Pins today's menu order. Deriving the group is only invisible to visitors if
  // it lands in the same slot the hand-listed group occupied.
  it('inserts the group directly after Programs', () => {
    const items = withChapterGroup(HAND_AUTHORED, chapterItems);

    expect(items.map((i) => i.label)).toEqual(['Programs', 'Chapters', 'Communities']);
  });

  // Programs is editable in the CMS, so it can be renamed or deleted. That must
  // degrade to a sensible position rather than throwing or dropping Chapters.
  it('appends the group when there is no Programs item', () => {
    const items = withChapterGroup(
      [{ label: 'Communities', children: [{ label: 'WhatsApp', url: '/#community' }] }],
      chapterItems,
    );

    expect(items.map((i) => i.label)).toEqual(['Communities', 'Chapters']);
  });

  // An empty dropdown renders as a caret that opens onto nothing, and the CMS
  // serializer collapses it back to a plain link — so omit the group entirely.
  it('omits the group entirely when there are no chapters', () => {
    const items = withChapterGroup(HAND_AUTHORED, []);

    expect(items.map((i) => i.label)).toEqual(['Programs', 'Communities']);
    expect(items.find((i) => i.label === 'Chapters')).toBeUndefined();
  });

  // The layout passes the shared `nav.items` singleton straight in; mutating it
  // would corrupt the menu for every later reader in the same process.
  it('does not mutate the caller list', () => {
    const original = [...HAND_AUTHORED];
    withChapterGroup(HAND_AUTHORED, chapterItems);

    expect(HAND_AUTHORED).toEqual(original);
  });
});

/** A community as the layout passes it in: `{ slug, ...data }`. */
function community(slug: string, name: string, order?: number) {
  return { slug, name, order };
}

describe('communityNavItems', () => {
  // Communities have no `order` in practice, so alphabetical-by-name is the
  // ordering the menu actually uses — the same rule the chapters roster relies
  // on now that its numeric pins are gone.
  it('orders alphabetically by name when nothing is pinned', () => {
    const items = communityNavItems([community('founders', 'Founders'), community('ai', 'AI')]);

    expect(items.map((i) => i.label)).toEqual(['AI', 'Founders']);
  });

  // The pin still wins when an editor sets one, matching chapterNavItems, so the
  // two derivations cannot disagree about what `order` means.
  it('honours an order pin ahead of the unpinned entries', () => {
    const items = communityNavItems([
      community('ai', 'AI'),
      community('founders', 'Founders', 1),
    ]);

    expect(items.map((i) => i.label)).toEqual(['Founders', 'AI']);
  });

  // Label and url come from different fields: building the url from the name
  // would 404 for any community whose display name is not its slug.
  it('builds the url from the slug, not the name', () => {
    expect(communityNavItems([community('ai', 'AI')])).toEqual([
      { label: 'AI', url: '/communities/ai' },
    ]);
  });

  // Production starts with an empty communities collection, so this is the
  // day-one state, not a hypothetical.
  it('returns no items for no communities', () => {
    expect(communityNavItems([])).toEqual([]);
  });
});

describe('withCommunityItems', () => {
  const communityItems = [{ label: 'Founders', url: '/communities/founders' }];

  // The asymmetry with Chapters: Communities is an editor-owned group that
  // already lists WhatsApp by hand, so derived items JOIN it rather than replace
  // it. Losing the hand-authored link is the failure this pins.
  it('appends derived items after the hand-authored ones', () => {
    const items = withCommunityItems(HAND_AUTHORED, communityItems);
    const group = items.find((i) => i.label === 'Communities');

    expect(group?.children).toEqual([
      { label: 'WhatsApp', url: '/#community' },
      { label: 'Founders', url: '/communities/founders' },
    ]);
  });

  // Merging must not disturb the rest of the menu — the group stays in its slot.
  it('leaves the surrounding menu order untouched', () => {
    const items = withCommunityItems(HAND_AUTHORED, communityItems);

    expect(items.map((i) => i.label)).toEqual(['Programs', 'Communities']);
  });

  // Communities is editable in the CMS, so it can be renamed or deleted. A
  // published community must still reach the header rather than vanish.
  it('creates the group when nav.json no longer has one', () => {
    const items = withCommunityItems(
      [{ label: 'Programs', children: [{ label: 'All Events', url: '/events' }] }],
      communityItems,
    );

    expect(items.map((i) => i.label)).toEqual(['Programs', 'Communities']);
    expect(items[1].children).toEqual(communityItems);
  });

  // With no communities the authored group is left exactly as the editor wrote
  // it — including the case where there is no group to create.
  it('returns the menu unchanged when there are no communities', () => {
    expect(withCommunityItems(HAND_AUTHORED, [])).toEqual(HAND_AUTHORED);
    expect(withCommunityItems([], [])).toEqual([]);
  });

  // The layout passes the shared `nav.items` singleton straight in. Pushing onto
  // the group's own `children` array would corrupt the menu for every later
  // reader in the same process — the group must be copied, not mutated.
  it('does not mutate the caller list or its groups', () => {
    const original = JSON.parse(JSON.stringify(HAND_AUTHORED));
    withCommunityItems(HAND_AUTHORED, communityItems);

    expect(HAND_AUTHORED).toEqual(original);
  });
});

describe('internalNavUrls', () => {
  // The guard is only as good as its reach: menu links live up to three levels
  // deep, and an external link has no local page to resolve against.
  it('collects site-internal urls at every level and skips external ones', () => {
    const items: NavItem[] = [
      { label: 'Programs', children: [{ label: 'All Events', url: '/events' }] },
      {
        label: 'Content Hub',
        children: [
          { label: 'Blog', url: '/blog/welcome' },
          { label: 'Medium', url: 'https://medium.com/harvard-in-tech' },
        ],
      },
      {
        label: 'Membership',
        children: [
          { label: 'About', children: [{ label: 'Mission', url: '/#about' }] },
        ],
      },
    ];

    expect(internalNavUrls(items)).toEqual(['/events', '/blog/welcome', '/#about']);
  });
});

describe('withoutHiddenSections', () => {
  const menu = (): NavItem[] => [
    { label: 'Programs', children: [{ label: 'All Events', url: '/events' }] },
    {
      label: 'Membership',
      children: [
        {
          label: 'About',
          children: [
            { label: 'Mission', url: '/#about' },
            { label: 'Board', url: '/#board' },
          ],
        },
      ],
    },
  ];

  // The headline guarantee: hiding a band takes its menu link with it, so a
  // visitor can never follow a link to a section that is not on the page.
  it('drops a link to a hidden band', () => {
    const [, membership] = withoutHiddenSections(menu(), ['/#board']);
    expect(membership.children![0].children).toEqual([{ label: 'Mission', url: '/#about' }]);
  });

  // Section visibility governs homepage anchors only — a link to /events is a
  // different page and must survive untouched.
  it('leaves links to real pages alone', () => {
    const [programs] = withoutHiddenSections(menu(), ['/#board']);
    expect(programs.children).toEqual([{ label: 'All Events', url: '/events' }]);
  });

  // A group emptied by the removal would render as a caret opening onto nothing
  // — the same thing `withChapterGroup` avoids for an empty chapter list.
  it('drops a dropdown left empty by the removal', () => {
    const pruned = withoutHiddenSections(menu(), ['/#about', '/#board']);
    expect(pruned.map((i) => i.label)).toEqual(['Programs']);
  });

  // The overwhelmingly common case: no hidden bands, so the menu passes through.
  it('returns the menu unchanged when nothing is hidden', () => {
    expect(withoutHiddenSections(menu(), [])).toEqual(menu());
  });

  // The menu is built from nav.json data other call sites read; pruning must copy.
  it('does not mutate the input tree', () => {
    const items = menu();
    withoutHiddenSections(items, ['/#board']);
    expect(items).toEqual(menu());
  });

  // A group that never had children is a plain link the CMS serializer already
  // collapsed; emptiness pruning must not swallow it.
  it('keeps an item that has no children to begin with', () => {
    const items: NavItem[] = [{ label: 'Donate', url: '/donate' }];
    expect(withoutHiddenSections(items, ['/#board'])).toEqual(items);
  });
});

describe('unresolvedNavUrls', () => {
  const known = ['/', '/events', '/blog/welcome'];

  // A fragment is a position on a page, not a separate route — treating it as
  // one would report every anchor link in nav.json as dead.
  it('resolves a fragment against its page', () => {
    expect(unresolvedNavUrls(['/events#webinars'], known)).toEqual([]);
  });

  // Four of the real menu links are bare `/#anchor` jumps into the home page,
  // so this is the most common shape the guard sees.
  it('resolves a bare fragment against the home page', () => {
    expect(unresolvedNavUrls(['/#about'], known)).toEqual([]);
  });

  // The whole point of the guard: a link whose page was drafted, renamed, or
  // deleted must be reported rather than silently shipped.
  it('reports a url with no page behind it', () => {
    expect(unresolvedNavUrls(['/blog/deleted-post'], known)).toEqual([
      '/blog/deleted-post',
    ]);
  });

  // An editor typing `/events/` in the CMS means the same page as `/events`;
  // failing on the slash would be a false alarm they cannot act on.
  it('ignores a trailing slash difference', () => {
    expect(unresolvedNavUrls(['/events/'], known)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Integrity guard over the COMMITTED nav.json and the real content on disk.
// Follows the pattern in `src/data/collections.test.ts`: read the shipped files
// rather than a fixture, so the guard fails when someone drafts, renames, or
// deletes the page a hand-authored menu link points at. `/blog/welcome` — one
// specific post, hard-linked from Content Hub — is the live example this pins.
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '../..');

function isDraft(file: string): boolean {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(file, 'utf-8'));
  return /^draft:\s*true\s*$/m.test(frontmatter?.[1] ?? '');
}

/** Routes from `src/pages`: the static `.astro` files, skipping dynamic
 *  `[slug]` routes and the isolated-component harness. */
function staticRoutes(): string[] {
  const dir = path.join(REPO_ROOT, 'src/pages');
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.astro') && !e.name.includes('['))
    .map((e) => (e.name === 'index.astro' ? '/' : `/${e.name.replace(/\.astro$/, '')}`));
}

/** The published slugs of a collection — the filenames a `[slug]` route turns
 *  into pages, minus the drafts that get no page in the built site. */
function collectionEntries(collection: string): string[] {
  const dir = path.join(REPO_ROOT, 'src/content', collection);
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md') && !isDraft(path.join(dir, name)))
    .map((name) => name.replace(/\.md$/, ''));
}

/** Routes a `[slug]` page generates from a published collection. */
function collectionRoutes(collection: string, prefix: string): string[] {
  return collectionEntries(collection).map((slug) => `${prefix}/${slug}`);
}

describe('committed nav.json', () => {
  const nav = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'src/data/nav.json'), 'utf-8'),
  ) as { items: NavItem[] };

  // Runs against the shipped nav.json and the real content on disk, so it
  // catches the live case: Content Hub points at the single post /blog/welcome.
  it('points every internal link at a page that exists', () => {
    const known = [
      ...staticRoutes(),
      ...collectionRoutes('blog', '/blog'),
      ...collectionRoutes('chapters', '/chapters'),
    ];

    expect(unresolvedNavUrls(internalNavUrls(nav.items), known)).toEqual([]);
  });

  // The duplication this feature removes: chapters are derived from the
  // collection now, so a hand-listed copy in nav.json can only go stale.
  it('no longer hand-lists the chapters', () => {
    expect(nav.items.find((i) => i.label === 'Chapters')).toBeUndefined();
  });

  // Communities are derived too, so the same rule applies: the group keeps its
  // hand-authored WhatsApp link and nothing else pointing at a community page.
  it('does not hand-list the communities', () => {
    const group = nav.items.find((i) => i.label === 'Communities');

    expect(group?.children?.some((c) => c.url?.startsWith('/communities/'))).toBe(false);
  });

  // Every derived link must land on a page too — the derivation is exactly where
  // a slug typo would produce a menu entry with no route behind it.
  it('derives community links that all resolve to a page', () => {
    const communities = collectionEntries('communities').map((slug) => ({
      slug,
      name: slug,
    }));
    const urls = internalNavUrls(communityNavItems(communities));

    expect(urls.length).toBeGreaterThan(0);
    expect(unresolvedNavUrls(urls, collectionRoutes('communities', '/communities'))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The committed chapter roster. The menu order is DERIVED from the content, so
// these assert the content, not a fixture: nothing else notices if someone
// re-pins `order` on one chapter and quietly breaks the alphabetical roster.
// ---------------------------------------------------------------------------
describe('committed chapters', () => {
  function frontmatter(collection: string, slug: string): string {
    const file = path.join(REPO_ROOT, 'src/content', collection, `${slug}.md`);
    return /^---\r?\n([\s\S]*?)\r?\n---/.exec(fs.readFileSync(file, 'utf-8'))?.[1] ?? '';
  }

  const slugs = collectionEntries('chapters');

  // An `order:` on any chapter sorts it ahead of every unpinned one, so a single
  // re-added pin silently un-alphabetizes the whole menu.
  it('pins no chapter with an order, so the roster sorts alphabetically', () => {
    const pinned = slugs.filter((slug) => /^order:/m.test(frontmatter('chapters', slug)));

    expect(pinned).toEqual([]);
  });

  // The roster the team asked for, in the order a visitor sees it.
  it('lists the six chapters alphabetically by city', () => {
    const chapters = slugs.map((slug) => ({
      slug,
      city: /^city:\s*(.+)$/m.exec(frontmatter('chapters', slug))?.[1].trim() ?? '',
    }));

    expect(chapterNavItems(chapters).map((i) => i.label)).toEqual([
      'Boston & Cambridge',
      'DC and DMV Area',
      'London',
      'New York City',
      'Seattle / Pacific Northwest',
      'SF & Bay Area',
    ]);
  });
});

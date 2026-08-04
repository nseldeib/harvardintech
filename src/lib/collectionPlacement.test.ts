import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { entryPagePath, SLUG_TOKEN } from '@codeyam/cms/lib/publicUrl';

// The `paths` map in collections.json tells the CMS where each collection
// appears on the site, which is what makes "View on site" point somewhere real
// instead of guessing `/<collection>/<slug>`. It is hand-maintained config that
// mirrors `src/pages/`, so it rots the moment a route is added or moved and
// nobody remembers to update it — the editor then gets sent to a 404 by a link
// that looks authoritative. These tests are the reminder.

const registry = JSON.parse(fs.readFileSync('src/data/collections.json', 'utf8')) as {
  collections: { id: string }[];
  builtins?: Record<string, unknown>;
  paths?: Record<string, string | null>;
};

// The built-in collections the CMS renders cards for regardless of the registry
// (`ADMIN_COLLECTIONS` in the package's adminDashboard).
const BUILTIN_COLLECTIONS = ['pages', 'blog', 'events', 'team'];

const declaredCollections = [
  ...new Set([...registry.collections.map((c) => c.id), ...BUILTIN_COLLECTIONS]),
];

describe('collections.json paths map', () => {
  // Absence is not a neutral default: with no map every collection falls back
  // to the /<collection>/<slug> guess, which is wrong for most of them.
  it('is present — without it every collection falls back to the wrong guess', () => {
    expect(registry.paths).toBeDefined();
  });

  // A collection with no placement gets the legacy guess silently, so a newly
  // added collection must be caught here rather than by an editor hitting a 404.
  it('gives every collection the admin can show a placement', () => {
    const missing = declaredCollections.filter((id) => !(id in (registry.paths ?? {})));
    expect(missing).toEqual([]);
  });

  // A placement for a deleted collection is dead config that reads as coverage.
  it('declares no placement for a collection that does not exist', () => {
    const known = new Set(declaredCollections);
    const orphans = Object.keys(registry.paths ?? {}).filter((id) => !known.has(id));
    expect(orphans).toEqual([]);
  });

  // A :slug template promises a page per entry, which on a static build means a
  // real dynamic route file. Catches a collection whose route was renamed.
  it('points every per-entry template at a route file that exists', () => {
    const routeFor: Record<string, string> = {
      '/:slug': 'src/pages/[slug].astro',
      '/blog/:slug': 'src/pages/blog/[slug].astro',
      '/chapters/:slug': 'src/pages/chapters/[slug].astro',
      '/communities/:slug': 'src/pages/communities/[slug].astro',
      '/volunteer/projects/:slug': 'src/pages/volunteer/projects/[slug].astro',
    };

    for (const [collection, template] of Object.entries(registry.paths ?? {})) {
      if (typeof template !== 'string' || !template.includes(SLUG_TOKEN)) continue;
      const route = routeFor[template];
      expect(route, `no known route file for template ${template} (${collection})`).toBeDefined();
      expect(fs.existsSync(path.join(process.cwd(), route)), `${route} is missing`).toBe(true);
    }
  });

  // A template with no slug token says every entry appears on this one page.
  // If that page does not exist the link 404s just as surely as a bad route.
  it('points every shared-page template at a page that exists', () => {
    const pageFor: Record<string, string> = {
      '/': 'src/pages/index.astro',
      '/#board': 'src/pages/index.astro',
      '/donate': 'src/pages/donate.astro',
      '/events': 'src/pages/events.astro',
      '/sponsor': 'src/pages/sponsor.astro',
      '/volunteer': 'src/pages/volunteer.astro',
    };

    for (const [collection, template] of Object.entries(registry.paths ?? {})) {
      if (typeof template !== 'string' || template.includes(SLUG_TOKEN)) continue;
      const page = pageFor[template];
      expect(page, `no known page for template ${template} (${collection})`).toBeDefined();
      expect(fs.existsSync(path.join(process.cwd(), page)), `${page} is missing`).toBe(true);
    }
  });

  // It sets analytics and the custom head/body HTML, which apply to every page,
  // so there is no single page to send an editor to. Claiming otherwise is the
  // misdirection the no-page state exists to prevent.
  it('marks siteIntegrations as having no page of its own', () => {
    expect(registry.paths?.siteIntegrations).toBeNull();
  });
});

describe('entryPagePath against this site’s real placements', () => {
  const template = (collection: string) => registry.paths?.[collection];

  // Pages ship at the root, so the legacy /pages/<slug> guess would 404.
  it('resolves a page entry to the site root, not a /pages/ prefix', () => {
    expect(entryPagePath('pages', 'about', template('pages'))).toBe('/about');
  });

  // The legacy guess was /projects/<slug>, which has never existed on this site.
  it('resolves a volunteer project to its real nested route', () => {
    expect(entryPagePath('projects', 'social-media', template('projects'))).toBe(
      '/volunteer/projects/social-media',
    );
  });

  // Every pillar is a card on /donate; none has a page of its own, so they all
  // resolve to the same path rather than to invented per-entry URLs.
  it('sends every gift pillar to the one page they all render on', () => {
    expect(entryPagePath('pillars', 'community', template('pillars'))).toBe('/donate');
    expect(entryPagePath('pillars', 'events', template('pillars'))).toBe('/donate');
  });

  // A director renders as a tile in the homepage board band, not on their own
  // page, so the link points at that band's anchor.
  it('sends a board member to the homepage band rather than a page of their own', () => {
    expect(entryPagePath('team', 'jane-doe', template('team'))).toBe('/#board');
  });

  // Null placement resolves to null rather than to a plausible-looking URL.
  it('reports siteIntegrations as having nowhere to go', () => {
    expect(entryPagePath('siteIntegrations', 'site', template('siteIntegrations'))).toBeNull();
  });

  // A site that has declared no placements must behave exactly as before, so
  // this fix is safe to adopt incrementally.
  it('still falls back to the legacy guess for an undeclared collection', () => {
    expect(entryPagePath('somethingNew', 'x', undefined)).toBe('/somethingNew/x');
  });
});

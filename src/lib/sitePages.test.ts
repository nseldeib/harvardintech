import { describe, expect, it } from 'vitest';
import {
  RESERVED_PAGE_SLUGS,
  isReservedPageSlug,
  pageRouteEntries,
  pageSeo,
  shadowedPageSlugs,
  shadowedSlugWarning,
} from './sitePages';

describe('shadowedPageSlugs', () => {
  // The common case: a normal page slug is not reserved and routes normally.
  it('passes an ordinary page slug through', () => {
    expect(shadowedPageSlugs(['about', 'privacy', 'code-of-conduct'])).toEqual([]);
  });

  // The failure this guard exists for — the page would build and never appear.
  it('catches a page that would be shadowed by a hand-built route', () => {
    expect(shadowedPageSlugs(['about', 'donate', 'volunteer'])).toEqual(['donate', 'volunteer']);
  });

  // /blog and /chapters are directories of dynamic routes, so a page slugged
  // blog collides with the whole subtree — easy to miss when scanning for a
  // blog.astro that does not exist.
  it('catches a page shadowed by a route DIRECTORY, not just a leaf route', () => {
    // /blog and /chapters are directories of dynamic routes. A page slugged
    // `blog` collides with the whole subtree, which is easy to miss when
    // scanning for `blog.astro` and finding nothing.
    expect(shadowedPageSlugs(['blog', 'chapters'])).toEqual(['blog', 'chapters']);
  });

  // The gated review site lives at /review as a static folder, so no Astro route
  // declares it and a src/pages scan would call this slug free.
  it('catches a page shadowed by a file served verbatim from public/', () => {
    // The gated review site lives at /review as a static folder — no Astro route
    // declares it, so a src/pages scan would call this slug free.
    expect(shadowedPageSlugs(['review', 'images'])).toEqual(['review', 'images']);
  });

  // The CMS injects it, so it is absent from src/pages entirely. A page slugged
  // admin would shadow the editor's own dashboard everywhere the editor runs.
  it('catches /admin, which only exists on dev + the review track', () => {
    // The CMS injects it, so it is absent from src/pages entirely. A page
    // slugged `admin` would work in a public build and shadow the editor's own
    // dashboard everywhere the editor actually runs.
    expect(shadowedPageSlugs(['admin'])).toEqual(['admin']);
  });

  // An editor typing /About into a slug box has made the same collision as one
  // typing about, so normalization happens before comparison.
  it('ignores case and surrounding slashes, because a slug box accepts both', () => {
    expect(shadowedPageSlugs(['/Donate/', 'EVENTS', ' volunteer '])).toEqual([
      '/Donate/',
      'EVENTS',
      ' volunteer ',
    ]);
  });

  // Order and identity are what let the warning name the slug to rename.
  it('returns the offending slugs in input order, so a message can name them', () => {
    expect(shadowedPageSlugs(['about', 'events', 'privacy', 'donate'])).toEqual([
      'events',
      'donate',
    ]);
  });

  // The function is a filter, so a caller passing repeats should see every
  // offending position rather than a collapsed set.
  it('reports a slug once per occurrence rather than de-duplicating', () => {
    // Two entries can carry the same slug only if two files share a stem, which
    // cannot happen — but the function is a filter, and a caller passing a list
    // with repeats should see every offending position.
    expect(shadowedPageSlugs(['donate', 'donate'])).toEqual(['donate', 'donate']);
  });

  // Lets the shadow rule be exercised without depending on this site's routes.
  it('accepts an injected reserved list, so the rule is testable in isolation', () => {
    expect(shadowedPageSlugs(['about', 'shop'], ['shop'])).toEqual(['shop']);
  });

  // The boundary: with nothing reserved, nothing can be shadowed.
  it('treats an empty reserved list as nothing being reserved', () => {
    expect(shadowedPageSlugs(['donate', 'events'], [])).toEqual([]);
  });

  // No pages means no collisions and no warning.
  it('handles an empty page list', () => {
    expect(shadowedPageSlugs([])).toEqual([]);
  });
});

describe('RESERVED_PAGE_SLUGS', () => {
  // A route missing from this list is a route a page can silently shadow.
  it('covers every hand-built top-level route the site ships', () => {
    for (const slug of ['donate', 'events', 'sponsor', 'volunteer', '404']) {
      expect(RESERVED_PAGE_SLUGS).toContain(slug);
    }
  });

  // A duplicate is a sign the list was edited by hand without checking.
  it('holds no duplicates', () => {
    expect(new Set(RESERVED_PAGE_SLUGS).size).toBe(RESERVED_PAGE_SLUGS.length);
  });

  // Comparison normalizes the input; the reserved list must not need it too.
  it('is already normalized — lowercase and slash-free', () => {
    for (const slug of RESERVED_PAGE_SLUGS) {
      expect(slug).toBe(slug.trim().toLowerCase());
      expect(slug.startsWith('/')).toBe(false);
    }
  });
});

describe('isReservedPageSlug', () => {
  // The single-slug form must agree with the list form.
  it('is true for a taken slug and false for a free one', () => {
    expect(isReservedPageSlug('donate')).toBe(true);
    expect(isReservedPageSlug('about')).toBe(false);
  });
});

describe('shadowedSlugWarning', () => {
  // A clean build must print no warning at all, or the warning becomes noise.
  it('says nothing when nothing is shadowed', () => {
    expect(shadowedSlugWarning([])).toBeNull();
  });

  // The message is read by whoever is watching a deploy log, not by whoever
  // wrote the page, so it has to be actionable on its own.
  it('names the offending slug and where to fix it', () => {
    const message = shadowedSlugWarning(['donate']);
    expect(message).toContain('"donate"');
    expect(message).toContain('/admin');
  });

  // Grammar, because a warning that reads as broken English reads as a bug.
  it('reads as singular for one slug and plural for several', () => {
    expect(shadowedSlugWarning(['donate'])).toContain('1 page uses');
    expect(shadowedSlugWarning(['donate'])).toContain('Rename it');
    expect(shadowedSlugWarning(['donate', 'events'])).toContain('2 pages use');
    expect(shadowedSlugWarning(['donate', 'events'])).toContain('Rename them');
  });

  // Naming only the first would send an editor round the loop once per bad page.
  it('lists every offending slug, not just the first', () => {
    const message = shadowedSlugWarning(['donate', 'events']);
    expect(message).toContain('"donate"');
    expect(message).toContain('"events"');
  });
});

describe('pageRouteEntries', () => {
  const entry = (id: string) => ({ id, data: { title: id } });

  // The happy path: nothing is dropped and nothing is warned about.
  it('routes every page when no slug is taken', () => {
    const pages = [entry('about'), entry('privacy')];
    const result = pageRouteEntries(pages);
    expect(result.routable.map((p) => p.id)).toEqual(['about', 'privacy']);
    expect(result.shadowed).toEqual([]);
    expect(result.warning).toBeNull();
  });

  // Emitting it would make Astro fail the whole build over one bad slug.
  it('drops a shadowed page rather than emitting a duplicate route', () => {
    const result = pageRouteEntries([entry('about'), entry('donate')]);
    expect(result.routable.map((p) => p.id)).toEqual(['about']);
    expect(result.shadowed).toEqual(['donate']);
  });

  // A silent drop is the original bug in a new place; the loss must be reported.
  it('warns about what it dropped', () => {
    const result = pageRouteEntries([entry('donate')]);
    expect(result.warning).toContain('"donate"');
  });

  // Callers rely on collection order; filtering must not reshuffle it.
  it('preserves input order among routable pages', () => {
    const result = pageRouteEntries([entry('privacy'), entry('donate'), entry('about')]);
    expect(result.routable.map((p) => p.id)).toEqual(['privacy', 'about']);
  });

  // A site with no pages yet builds cleanly and warns about nothing.
  it('handles an empty collection', () => {
    const result = pageRouteEntries([]);
    expect(result.routable).toEqual([]);
    expect(result.warning).toBeNull();
  });

  // The degenerate case still produces a valid empty route list, not a crash.
  it('drops every page when they are all shadowed', () => {
    const result = pageRouteEntries([entry('donate'), entry('events')]);
    expect(result.routable).toEqual([]);
    expect(result.shadowed).toEqual(['donate', 'events']);
  });

  // Lets the routing rule be exercised without depending on this site's routes.
  it('accepts an injected reserved list so the rule is testable in isolation', () => {
    const result = pageRouteEntries([entry('about'), entry('shop')], ['shop']);
    expect(result.routable.map((p) => p.id)).toEqual(['about']);
  });

  // The route needs the entry itself for props, so identity must survive.
  it('carries the whole entry through, not just its slug', () => {
    // The route needs the entry itself for props, so identity must survive.
    const pages = [entry('about')];
    expect(pageRouteEntries(pages).routable[0]).toBe(pages[0]);
  });
});

describe('pageSeo', () => {
  // An editor who fills in the SEO fields expects them to win.
  it('prefers the explicit SEO overrides', () => {
    expect(
      pageSeo({
        title: 'About',
        description: 'Visible lede',
        metaTitle: 'About Harvard Alumni in Tech',
        metaDescription: 'Search description',
      }),
    ).toEqual({
      title: 'About Harvard Alumni in Tech',
      description: 'Search description',
      image: undefined,
    });
  });

  // An editor who leaves them blank expects their real title, not an empty tag.
  it('falls back to the page’s own title and description', () => {
    expect(pageSeo({ title: 'About', description: 'Visible lede' })).toEqual({
      title: 'About',
      description: 'Visible lede',
      image: undefined,
    });
  });

  // The CMS writes an empty string when an editor clears the SEO title box. A
  // bare ?? would keep it and publish a page with no <title> at all.
  it('treats a cleared override as absent, never as an empty title', () => {
    // The CMS writes '' when an editor empties the SEO title box. A bare `??`
    // would keep that and publish a page with no <title> at all.
    expect(pageSeo({ title: 'About', metaTitle: '' }).title).toBe('About');
    expect(pageSeo({ title: 'About', metaTitle: '   ' }).title).toBe('About');
  });

  // Same rule as the title: clearing the box restores the fallback.
  it('treats a cleared meta description as absent so the lede is used', () => {
    expect(pageSeo({ title: 'About', description: 'Visible lede', metaDescription: '' }).description).toBe(
      'Visible lede',
    );
  });

  // So <SEO /> can fall through to the site default rather than emit an empty tag.
  it('leaves description undefined when the page has neither', () => {
    expect(pageSeo({ title: 'About' }).description).toBeUndefined();
  });

  // A blank share image must not override the site default with nothing.
  it('passes the share image through and drops a blank one', () => {
    expect(pageSeo({ title: 'A', ogImage: '/images/x.png' }).image).toBe('/images/x.png');
    expect(pageSeo({ title: 'A', ogImage: '' }).image).toBeUndefined();
  });

  // The one field with no acceptable empty outcome.
  it('always returns a title, because a page without one is unusable', () => {
    expect(pageSeo({ title: 'About' }).title).toBe('About');
  });
});

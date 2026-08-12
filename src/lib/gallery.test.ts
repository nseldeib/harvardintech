import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  galleryColumns,
  galleryRevealImmediately,
  galleryStaggerDelay,
  toGalleryPhotos,
  visibleGalleryPhotos,
} from './gallery';

describe('galleryRevealImmediately', () => {
  // Capable browser, no reduced-motion preference: animate the tiles in.
  it('animates when IntersectionObserver exists and motion is allowed', () => {
    expect(
      galleryRevealImmediately({ reducedMotion: false, hasIntersectionObserver: true }),
    ).toBe(false);
  });

  // Reduced-motion preference wins even on a capable browser.
  it('reveals immediately when the user prefers reduced motion', () => {
    expect(
      galleryRevealImmediately({ reducedMotion: true, hasIntersectionObserver: true }),
    ).toBe(true);
  });

  // No IntersectionObserver (old browser / SSR) → reveal immediately so the
  // gallery never gets stuck invisible.
  it('reveals immediately when IntersectionObserver is unavailable', () => {
    expect(
      galleryRevealImmediately({ reducedMotion: false, hasIntersectionObserver: false }),
    ).toBe(true);
  });

  // Both unfavorable → still reveal immediately.
  it('reveals immediately when both reduced motion and no observer', () => {
    expect(
      galleryRevealImmediately({ reducedMotion: true, hasIntersectionObserver: false }),
    ).toBe(true);
  });
});

describe('galleryStaggerDelay', () => {
  // The first column has no delay.
  it('returns zero for the first column', () => {
    expect(galleryStaggerDelay(0)).toBe(0);
    expect(galleryStaggerDelay(5)).toBe(0);
  });

  // Each column within a row adds 60ms.
  it('staggers later columns by 60ms each', () => {
    expect(galleryStaggerDelay(1)).toBe(60);
    expect(galleryStaggerDelay(4)).toBe(240);
  });

  // The delay wraps per row, so tiles in the same column share a delay.
  it('wraps the delay per row of five columns', () => {
    expect(galleryStaggerDelay(6)).toBe(60);
    expect(galleryStaggerDelay(9)).toBe(240);
  });

  // A custom column count changes the wrap point.
  it('respects a custom column count', () => {
    expect(galleryStaggerDelay(3, 3)).toBe(0);
    expect(galleryStaggerDelay(4, 3)).toBe(60);
  });
});

describe('initGalleryReveal', () => {
  // jsdom lacks matchMedia; stub it so `prefers-reduced-motion` answers `reduce`.
  function stubMatchMedia(reduce: boolean) {
    window.matchMedia = vi.fn((query: string) => {
      const matches = query.includes('prefers-reduced-motion') ? reduce : false;
      return { matches, media: query } as MediaQueryList;
    }) as unknown as typeof window.matchMedia;
  }

  // Mount a gallery with `count` tiles inside the #gallery section.
  function mountGallery(count: number) {
    const tiles = Array.from(
      { length: count },
      () => '<figure class="gallery-item"></figure>',
    ).join('');
    document.body.innerHTML = `<section id="gallery">${tiles}</section>`;
    return document.querySelectorAll<HTMLElement>('#gallery .gallery-item');
  }

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  // Reduced motion: every tile is revealed immediately (in-view), no observer.
  it('reveals every tile immediately under reduced motion', async () => {
    stubMatchMedia(true);
    const tiles = mountGallery(3);
    const { initGalleryReveal } = await import('./gallery');
    initGalleryReveal();
    tiles.forEach((el) => expect(el.classList.contains('in-view')).toBe(true));
  });

  // No IntersectionObserver: fall back to revealing every tile immediately.
  it('reveals every tile immediately when IntersectionObserver is missing', async () => {
    stubMatchMedia(false);
    const original = (window as { IntersectionObserver?: unknown }).IntersectionObserver;
    delete (window as { IntersectionObserver?: unknown }).IntersectionObserver;
    const tiles = mountGallery(2);
    const { initGalleryReveal } = await import('./gallery');
    initGalleryReveal();
    tiles.forEach((el) => expect(el.classList.contains('in-view')).toBe(true));
    (window as { IntersectionObserver?: unknown }).IntersectionObserver = original;
  });

  // Capable browser, motion allowed: tiles are observed, not revealed up front.
  it('observes tiles instead of revealing them when animation is enabled', async () => {
    stubMatchMedia(false);
    const observe = vi.fn();
    (window as { IntersectionObserver?: unknown }).IntersectionObserver = vi.fn(() => ({
      observe,
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as unknown as typeof IntersectionObserver;
    const tiles = mountGallery(4);
    const { initGalleryReveal } = await import('./gallery');
    initGalleryReveal();
    expect(observe).toHaveBeenCalledTimes(4);
    tiles.forEach((el) => expect(el.classList.contains('in-view')).toBe(false));
  });

  // No gallery tiles on the page → a clean no-op, not a throw.
  it('is a no-op when there are no gallery tiles', async () => {
    stubMatchMedia(false);
    document.body.innerHTML = '<section id="gallery"></section>';
    const { initGalleryReveal } = await import('./gallery');
    expect(() => initGalleryReveal()).not.toThrow();
  });
});

describe('toGalleryPhotos', () => {
  // The landing page's shape: plain srcs, no captions.
  it('normalizes a list of plain srcs', () => {
    expect(toGalleryPhotos(['/images/a.jpg', '/images/b.jpg'])).toEqual([
      { src: '/images/a.jpg' },
      { src: '/images/b.jpg' },
    ]);
  });

  // The CMS shape: an image plus the editorial caption the lightbox shows.
  it('normalizes CMS rows and keeps the caption', () => {
    expect(toGalleryPhotos([{ image: '/images/a.jpg', caption: 'Spring mixer' }])).toEqual([
      { src: '/images/a.jpg', caption: 'Spring mixer' },
    ]);
  });

  // Both shapes reach the same prop, so both must survive one pass.
  it('accepts a mixed list', () => {
    expect(toGalleryPhotos(['/images/a.jpg', { image: '/images/b.jpg' }])).toEqual([
      { src: '/images/a.jpg' },
      { src: '/images/b.jpg' },
    ]);
  });

  // The case this filter exists for: the CMS list control adds a row before a
  // photo is picked. Rendering it gives a tile with no image — and a lightbox
  // that opens onto nothing.
  it('drops rows with a missing or blank image', () => {
    expect(
      toGalleryPhotos([{ image: '' }, { image: '   ' }, {}, { image: '/images/a.jpg' }]),
    ).toEqual([{ src: '/images/a.jpg' }]);
  });

  // A whitespace-only caption is no caption; it would render an empty
  // figcaption that still takes space under the photo.
  it('treats a blank caption as absent', () => {
    expect(toGalleryPhotos([{ image: '/images/a.jpg', caption: '   ' }])).toEqual([
      { src: '/images/a.jpg', caption: undefined },
    ]);
  });

  // An empty gallery is a real state — a chapter mid-curation.
  it('returns nothing for an empty list', () => {
    expect(toGalleryPhotos([])).toEqual([]);
  });
});

describe('galleryColumns', () => {
  // A small chapter gallery should fill its row rather than leave holes.
  it('uses one column per photo below the maximum', () => {
    expect(galleryColumns(3)).toBe(3);
  });

  // The shared 40-photo wall stays on the full-width grid.
  it('clamps to the maximum for a large gallery', () => {
    expect(galleryColumns(40)).toBe(5);
  });

  // Exactly at the boundary.
  it('returns the maximum when the count equals it', () => {
    expect(galleryColumns(5)).toBe(5);
  });

  // A zero-column grid is not a thing — an empty list must not produce an
  // invalid grid-template.
  it('floors at one column', () => {
    expect(galleryColumns(0)).toBe(1);
    expect(galleryColumns(-3)).toBe(1);
  });

  // The ceiling is a parameter so a caller can ask for a narrower grid.
  it('honours a custom maximum', () => {
    expect(galleryColumns(10, 3)).toBe(3);
  });
});

describe('visibleGalleryPhotos', () => {
  const photos = toGalleryPhotos(['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg']);

  // The load state for a capped gallery.
  it('returns the first cap photos when collapsed', () => {
    expect(visibleGalleryPhotos(photos, { cap: 2 })).toHaveLength(2);
  });

  // After "Show all N photos".
  it('returns everything when expanded', () => {
    expect(visibleGalleryPhotos(photos, { cap: 2, expanded: true })).toHaveLength(4);
  });

  // The landing page passes no cap and must keep rendering all 40. This is the
  // case that stops the cap from becoming a silent default.
  it('returns everything when no cap is given', () => {
    expect(visibleGalleryPhotos(photos)).toHaveLength(4);
  });

  // A cap larger than the gallery is not an error, just uncapped in practice.
  it('returns everything when the cap exceeds the count', () => {
    expect(visibleGalleryPhotos(photos, { cap: 99 })).toHaveLength(4);
  });

  // Pure: the caller renders from this and must not have its source mutated.
  it('does not mutate the input', () => {
    visibleGalleryPhotos(photos, { cap: 1 });
    expect(photos).toHaveLength(4);
  });
});

import { describe, it, expect, vi, afterEach } from 'vitest';
import { galleryRevealImmediately, galleryStaggerDelay } from './gallery';

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

describe('initReveal', () => {
  // jsdom lacks matchMedia; stub it so `prefers-reduced-motion` answers `reduce`.
  function stubMatchMedia(reduce: boolean) {
    window.matchMedia = vi.fn((query: string) => {
      const matches = query.includes('prefers-reduced-motion') ? reduce : false;
      return { matches, media: query } as MediaQueryList;
    }) as unknown as typeof window.matchMedia;
  }

  // Mount `count` elements carrying the site-wide `.s-reveal` opt-in class.
  function mountReveal(count: number) {
    const els = Array.from({ length: count }, () => '<div class="s-reveal"></div>').join('');
    document.body.innerHTML = els;
    return document.querySelectorAll<HTMLElement>('.s-reveal');
  }

  afterEach(() => {
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  // Reduced motion: every reveal element is shown immediately (is-visible).
  it('reveals every element immediately under reduced motion', async () => {
    stubMatchMedia(true);
    const els = mountReveal(3);
    const { initReveal } = await import('./gallery');
    initReveal();
    els.forEach((el) => expect(el.classList.contains('is-visible')).toBe(true));
  });

  // No IntersectionObserver: fall back to revealing every element immediately.
  it('reveals every element immediately when IntersectionObserver is missing', async () => {
    stubMatchMedia(false);
    const original = (window as { IntersectionObserver?: unknown }).IntersectionObserver;
    delete (window as { IntersectionObserver?: unknown }).IntersectionObserver;
    const els = mountReveal(2);
    const { initReveal } = await import('./gallery');
    initReveal();
    els.forEach((el) => expect(el.classList.contains('is-visible')).toBe(true));
    (window as { IntersectionObserver?: unknown }).IntersectionObserver = original;
  });

  // Capable browser, motion allowed: elements are observed, not revealed up front.
  it('observes elements instead of revealing them when animation is enabled', async () => {
    stubMatchMedia(false);
    const observe = vi.fn();
    (window as { IntersectionObserver?: unknown }).IntersectionObserver = vi.fn(() => ({
      observe,
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    })) as unknown as typeof IntersectionObserver;
    const els = mountReveal(4);
    const { initReveal } = await import('./gallery');
    initReveal();
    expect(observe).toHaveBeenCalledTimes(4);
    els.forEach((el) => expect(el.classList.contains('is-visible')).toBe(false));
  });

  // No reveal elements on the page → a clean no-op, not a throw.
  it('is a no-op when there are no reveal elements', async () => {
    stubMatchMedia(false);
    document.body.innerHTML = '<main></main>';
    const { initReveal } = await import('./gallery');
    expect(() => initReveal()).not.toThrow();
  });
});

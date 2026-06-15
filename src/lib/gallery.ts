// Fade-in-on-scroll for the Event Gallery, matching harvardintech.com: each
// photo starts faded + shifted down and animates into place as it scrolls into
// view, staggered per grid column. Mirrors the parallax.ts split — the pure
// helpers below carry the reveal decision and the stagger math so they can be
// unit-tested without a DOM; `initGalleryReveal()` is the thin, idempotent
// wiring. No DOM access in the helpers — data in, data out.

// Whether to reveal every tile immediately instead of animating them in. We
// skip the IntersectionObserver animation when the user prefers reduced motion,
// or when the browser has no IntersectionObserver (old browsers / SSR) so the
// gallery never gets stuck invisible.
export function galleryRevealImmediately(opts: {
  reducedMotion: boolean;
  hasIntersectionObserver: boolean;
}): boolean {
  return opts.reducedMotion || !opts.hasIntersectionObserver;
}

// The per-tile transition delay (ms) that staggers the fade-in across the grid.
// Tiles in the same column share a delay so each column ripples in together;
// `columns` is the current grid column count (5 on desktop).
export function galleryStaggerDelay(index: number, columns = 5): number {
  return (index % columns) * 60;
}

// Idempotent DOM wiring. No-op under SSR / vitest (no window/document). Reveals
// every tile immediately when animation is disabled (reduced motion or no
// IntersectionObserver); otherwise observes each tile and adds `in-view` as it
// scrolls into the viewport, unobserving once revealed.
export function initGalleryReveal(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const items = document.querySelectorAll<HTMLElement>('#gallery .gallery-item');
  if (items.length === 0) return;

  const immediate = galleryRevealImmediately({
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    hasIntersectionObserver: 'IntersectionObserver' in window,
  });

  if (immediate) {
    items.forEach((el) => el.classList.add('in-view'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
  );
  items.forEach((el) => io.observe(el));
}

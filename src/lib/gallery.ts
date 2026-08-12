// Fade-in-on-scroll for the Event Gallery, matching harvardintech.com: each
// photo starts faded + shifted down and animates into place as it scrolls into
// view, staggered per grid column. Mirrors the parallax.ts split — the pure
// helpers below carry the reveal decision and the stagger math so they can be
// unit-tested without a DOM; `initGalleryReveal()` is the thin, idempotent
// wiring. No DOM access in the helpers — data in, data out.

/** One photo in a gallery: the image src, plus optional editorial caption. */
export interface GalleryPhoto {
  src: string;
  caption?: string;
}

/**
 * Normalize either call shape into one list.
 *
 * The landing page passes `string[]` and a chapter passes the CMS's
 * `{ image, caption? }` rows. Accepting both here rather than changing
 * `EventGallery`'s prop type is what lets one code path render the grid without
 * breaking the existing call sites or the captured `event-gallery` scenario.
 *
 * Rows with a blank or missing `image` are dropped: the CMS list control can
 * add a row before a photo is picked, and a half-filled row would otherwise
 * render a tile with no image — and, worse, open a lightbox onto nothing.
 */
export function toGalleryPhotos(
  input: readonly (string | { image?: string; caption?: string })[],
): GalleryPhoto[] {
  return input
    .map((row) =>
      typeof row === 'string'
        ? { src: row.trim() }
        : { src: (row?.image ?? '').trim(), caption: row?.caption?.trim() || undefined },
    )
    .filter((p) => p.src !== '');
}

/**
 * How many columns to render for `count` photos.
 *
 * A chapter with three photos should render three columns, not five with two
 * holes — the shared 40-photo wall is the only gallery big enough to fill the
 * grid, and it stays at `max`. Floored at 1 so an empty list cannot produce a
 * zero-column grid.
 */
export function galleryColumns(count: number, max = 5): number {
  return Math.max(1, Math.min(count, max));
}

/**
 * The photos to render given the collapsed/expanded state.
 *
 * `cap` absent means "show everything", which is what keeps the landing page's
 * 40-photo wall uncapped — the cap is opt-in per call site rather than a
 * default, so adding it here could never silently truncate the homepage.
 */
export function visibleGalleryPhotos(
  photos: readonly GalleryPhoto[],
  opts: { expanded?: boolean; cap?: number } = {},
): GalleryPhoto[] {
  const { expanded = false, cap } = opts;
  if (expanded || cap === undefined || cap < 0) return [...photos];
  return photos.slice(0, cap);
}

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
//
// Safe to call AGAIN after new tiles mount. "Show all N photos" appends tiles
// long after load, and they would otherwise stay permanently faded out because
// the original call had already queried and observed only the first `cap`.
// Tiles already revealed are skipped, so a re-run costs one extra query and
// never double-observes.
export function initGalleryReveal(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const items = document.querySelectorAll<HTMLElement>(
    '#gallery .gallery-item:not(.in-view)',
  );
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

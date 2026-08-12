// Click-to-enlarge for gallery photos, built on the native `<dialog>`.
//
// Mirrors the gallery.ts / parallax.ts split this site already uses: the pure
// helpers below carry the decisions so they unit-test without a DOM, and
// `initLightbox()` is the thin, idempotent wiring.
//
// `showModal()` rather than a hand-rolled overlay. It gives focus trapping,
// Esc-to-close, an inert background and the top layer for free — precisely the
// parts a hand-rolled modal gets wrong. There is no existing modal anywhere in
// `src/` to reuse, so this is new either way; native is the smaller new thing.
//
// Progressive enhancement, in the shape the rest of the site uses: no client
// framework, a dependency-free `<script>` over `data-*` hooks. Without JS — or
// on a browser with no `HTMLDialogElement` — the tiles stay plain images and
// the gallery is fully usable. The enlargement is additive, never load-bearing.

/** What a keypress should do while the lightbox is open. */
export type LightboxAction = 'close' | 'next' | 'prev';

/**
 * Map a `KeyboardEvent.key` to a lightbox action, or `null` to ignore it.
 *
 * `<dialog>` closes itself on Escape, so mapping it here is deliberate
 * redundancy: it keeps ONE close path that also runs our own teardown, rather
 * than having the native cancel and our handler drift apart.
 */
export function lightboxKeyAction(key: string): LightboxAction | null {
  switch (key) {
    case 'Escape':
      return 'close';
    case 'ArrowRight':
      return 'next';
    case 'ArrowLeft':
      return 'prev';
    default:
      return null;
  }
}

/**
 * The index `delta` steps from `current`, wrapping at both ends.
 *
 * Wrapping rather than clamping because a lightbox is a carousel, not a list:
 * arrowing past the last photo should reach the first, and a disabled arrow at
 * each end would be a dead control the user has to notice.
 *
 * Returns 0 for an empty gallery so a caller cannot index into nothing.
 */
export function nextPhotoIndex(current: number, count: number, delta: number): number {
  if (count <= 0) return 0;
  return (((current + delta) % count) + count) % count;
}

/**
 * Idempotent DOM wiring.
 *
 * No-ops under SSR / vitest (no window/document) and on any browser without
 * `HTMLDialogElement`, which is what keeps the un-enhanced gallery usable
 * rather than half-bound. Guarded by a `data-` flag so calling it twice — which
 * happens when "Show all" re-runs the gallery wiring — does not double-bind.
 */
export function initLightbox(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (typeof window.HTMLDialogElement === 'undefined') return;

  const galleries = document.querySelectorAll<HTMLElement>('[data-lightbox-scope]');

  galleries.forEach((scope) => {
    const dialog = scope.querySelector<HTMLDialogElement>('dialog[data-lightbox]');
    if (!dialog || typeof dialog.showModal !== 'function') return;

    const img = dialog.querySelector<HTMLImageElement>('[data-lightbox-image]');
    const caption = dialog.querySelector<HTMLElement>('[data-lightbox-caption]');
    if (!img) return;

    // Resolved at CLICK time, never captured in a closure. The over-cap photos
    // are in the DOM from the start but hidden, and "Show all" reveals them
    // in place — so a list captured on the first call would leave the original
    // tiles arrowing around 12 photos while the grid shows 14.
    const visibleButtons = () =>
      Array.from(scope.querySelectorAll<HTMLButtonElement>('[data-lightbox-open]')).filter(
        (button) => !button.closest('.gallery-item')?.hasAttribute('hidden'),
      );

    const buttons = visibleButtons();
    if (buttons.length === 0) return;

    const show = (index: number) => {
      const current = visibleButtons();
      const button = current[index];
      if (!button) return;
      scope.dataset.lightboxIndex = String(index);
      img.src = button.dataset.full ?? '';
      img.alt = button.dataset.alt ?? '';
      const text = button.dataset.caption ?? '';
      if (caption) {
        caption.textContent = text;
        caption.hidden = text === '';
      }
      if (!dialog.open) dialog.showModal();
    };

    const step = (delta: number) =>
      show(
        nextPhotoIndex(
          Number(scope.dataset.lightboxIndex ?? '0'),
          visibleButtons().length,
          delta,
        ),
      );

    buttons.forEach((button) => {
      if (button.dataset.lightboxBound === '1') return;
      button.dataset.lightboxBound = '1';
      button.addEventListener('click', () => show(visibleButtons().indexOf(button)));
    });

    // Everything below binds once per gallery, not once per tile.
    if (scope.dataset.lightboxBound === '1') return;
    scope.dataset.lightboxBound = '1';

    dialog
      .querySelector<HTMLButtonElement>('[data-lightbox-close]')
      ?.addEventListener('click', () => dialog.close());
    dialog
      .querySelector<HTMLButtonElement>('[data-lightbox-next]')
      ?.addEventListener('click', () => step(1));
    dialog
      .querySelector<HTMLButtonElement>('[data-lightbox-prev]')
      ?.addEventListener('click', () => step(-1));

    dialog.addEventListener('keydown', (event) => {
      const action = lightboxKeyAction(event.key);
      if (!action) return;
      event.preventDefault();
      if (action === 'close') dialog.close();
      else step(action === 'next' ? 1 : -1);
    });

    // Clicking the backdrop closes. The dialog element's own box covers the
    // whole viewport, so a click landing on the dialog itself — rather than on
    // any child — is a backdrop click.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}

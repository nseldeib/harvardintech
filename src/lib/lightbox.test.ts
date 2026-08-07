import { describe, it, expect, afterEach } from 'vitest';
import { lightboxKeyAction, nextPhotoIndex } from './lightbox';

describe('lightboxKeyAction', () => {
  // Escape closes. `<dialog>` also cancels on Escape by itself; mapping it
  // here keeps ONE close path so the native cancel and our handler can't drift.
  it('maps Escape to close', () => {
    expect(lightboxKeyAction('Escape')).toBe('close');
  });

  // The two arrows move through the gallery.
  it('maps the arrow keys to next and prev', () => {
    expect(lightboxKeyAction('ArrowRight')).toBe('next');
    expect(lightboxKeyAction('ArrowLeft')).toBe('prev');
  });

  // Anything else is ignored rather than swallowed — the handler calls
  // preventDefault only on a mapped key, so Tab still moves focus inside the
  // dialog and the browser's own shortcuts keep working.
  it('ignores unrelated keys', () => {
    expect(lightboxKeyAction('Enter')).toBeNull();
    expect(lightboxKeyAction('a')).toBeNull();
    expect(lightboxKeyAction(' ')).toBeNull();
  });

  // Key names are case-sensitive in the DOM; a lowercase spelling is not a
  // KeyboardEvent.key value and must not match.
  it('does not match a lowercased key name', () => {
    expect(lightboxKeyAction('escape')).toBeNull();
  });
});

describe('nextPhotoIndex', () => {
  // The ordinary forward and backward steps.
  it('steps forward and backward within range', () => {
    expect(nextPhotoIndex(1, 5, 1)).toBe(2);
    expect(nextPhotoIndex(3, 5, -1)).toBe(2);
  });

  // Arrowing past the last photo reaches the first. A lightbox is a carousel,
  // not a list — a disabled arrow at the end is a dead control.
  it('wraps forward past the last photo', () => {
    expect(nextPhotoIndex(4, 5, 1)).toBe(0);
  });

  // And the same in reverse, which is where a naive `%` returns a negative
  // index and the caller reads `undefined`.
  it('wraps backward past the first photo', () => {
    expect(nextPhotoIndex(0, 5, -1)).toBe(4);
  });

  // A single-photo gallery has nowhere to go; both arrows stay put rather
  // than producing an out-of-range index.
  it('stays put in a one-photo gallery', () => {
    expect(nextPhotoIndex(0, 1, 1)).toBe(0);
    expect(nextPhotoIndex(0, 1, -1)).toBe(0);
  });

  // An empty gallery must not yield an index the caller would index into.
  it('returns zero for an empty gallery', () => {
    expect(nextPhotoIndex(0, 0, 1)).toBe(0);
    expect(nextPhotoIndex(3, -1, -1)).toBe(0);
  });

  // A delta larger than the gallery still lands in range — the modulo runs
  // once, so this is the guard against a multi-step jump escaping the list.
  it('keeps a delta larger than the gallery in range', () => {
    expect(nextPhotoIndex(0, 3, 7)).toBe(1);
    expect(nextPhotoIndex(0, 3, -7)).toBe(2);
  });
});

describe('initLightbox', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  // Mount a gallery of `total` tiles where the last `hiddenCount` are the
  // over-cap ones the "Show all" control reveals.
  function mountGallery(total: number, hiddenCount = 0) {
    const tiles = Array.from({ length: total }, (_, i) => {
      const hidden = i >= total - hiddenCount ? ' hidden' : '';
      return `<figure class="gallery-item"${hidden}>
        <button data-lightbox-open data-full="/p${i}.jpg" data-alt="photo ${i}"
          data-caption="${i === 0 ? 'First one' : ''}"></button>
      </figure>`;
    }).join('');
    document.body.innerHTML = `<section data-lightbox-scope data-lightbox-index="0">
      ${tiles}
      <dialog data-lightbox>
        <img data-lightbox-image src="" alt="" />
        <figcaption data-lightbox-caption hidden></figcaption>
        <button data-lightbox-close></button>
        <button data-lightbox-prev></button>
        <button data-lightbox-next></button>
      </dialog>
    </section>`;
  }

  // jsdom has no showModal(); stub it so the open path can run at all.
  function stubShowModal() {
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = function showModal() {
      this.open = true;
    };
    return dialog;
  }

  // Clicking a tile loads that photo and its caption into the dialog.
  it('opens the clicked photo with its caption', async () => {
    mountGallery(3);
    const dialog = stubShowModal();
    const { initLightbox } = await import('./lightbox');
    initLightbox();

    document.querySelectorAll<HTMLButtonElement>('[data-lightbox-open]')[0].click();

    expect(dialog.open).toBe(true);
    expect(document.querySelector<HTMLImageElement>('[data-lightbox-image]')?.src).toContain(
      '/p0.jpg',
    );
    const caption = document.querySelector<HTMLElement>('[data-lightbox-caption]');
    expect(caption?.textContent).toBe('First one');
    expect(caption?.hidden).toBe(false);
  });

  // An uncaptioned photo hides the figcaption rather than rendering an empty
  // one, which would still take space under the image. Astro drops
  // `data-caption=""` entirely, so this is the undefined-dataset path.
  it('hides the caption for a photo that has none', async () => {
    mountGallery(3);
    stubShowModal();
    const { initLightbox } = await import('./lightbox');
    initLightbox();

    document.querySelectorAll<HTMLButtonElement>('[data-lightbox-open]')[1].click();

    const caption = document.querySelector<HTMLElement>('[data-lightbox-caption]');
    expect(caption?.textContent).toBe('');
    expect(caption?.hidden).toBe(true);
  });

  // The regression the visible-button filter exists for: with two over-cap
  // tiles still hidden, arrowing off the last VISIBLE photo wraps to the
  // first rather than stepping onto a photo that isn't in the grid.
  it('arrows only through the visible photos while the rest are hidden', async () => {
    mountGallery(5, 2);
    const scope = document.querySelector<HTMLElement>('[data-lightbox-scope]');
    stubShowModal();
    const { initLightbox } = await import('./lightbox');
    initLightbox();

    // Open the last visible photo (index 2 of the three visible).
    document.querySelectorAll<HTMLButtonElement>('[data-lightbox-open]')[2].click();
    expect(scope?.dataset.lightboxIndex).toBe('2');

    // Wraps to the first VISIBLE photo, not onto the hidden fourth.
    document.querySelector<HTMLElement>('[data-lightbox-next]')?.click();
    expect(scope?.dataset.lightboxIndex).toBe('0');
  });

  // After "Show all" unhides the rest, the ALREADY-BOUND tiles must arrow
  // through the full set. This is why the button list is resolved at click
  // time instead of captured when initLightbox first ran.
  it('extends the arrow range once the hidden photos are revealed', async () => {
    mountGallery(5, 2);
    const scope = document.querySelector<HTMLElement>('[data-lightbox-scope]');
    stubShowModal();
    const { initLightbox } = await import('./lightbox');
    initLightbox();

    document
      .querySelectorAll<HTMLElement>('.gallery-item[hidden]')
      .forEach((tile) => tile.removeAttribute('hidden'));
    initLightbox();

    // Tile 2 was bound on the FIRST call, when only three photos were visible.
    document.querySelectorAll<HTMLButtonElement>('[data-lightbox-open]')[2].click();
    const next = document.querySelector<HTMLElement>('[data-lightbox-next]');
    next?.click();
    expect(scope?.dataset.lightboxIndex).toBe('3');
    next?.click();
    expect(scope?.dataset.lightboxIndex).toBe('4');
  });

  // Re-running the wiring is how "Show all" picks up the revealed tiles, so a
  // second call must not double-bind the tiles that were already bound.
  it('does not rebind a tile on a second call', async () => {
    mountGallery(3);
    stubShowModal();
    const { initLightbox } = await import('./lightbox');
    initLightbox();
    initLightbox();

    // The scope carries the same flag for its own once-per-gallery wiring, so
    // count the tiles specifically rather than every flagged element.
    const bound = document.querySelectorAll('[data-lightbox-open][data-lightbox-bound="1"]');
    expect(bound).toHaveLength(3);
  });

  // A page with no gallery is the common case — every route that isn't a
  // chapter or the landing page. It must be a clean no-op, not a throw.
  it('is a no-op when there is no gallery on the page', async () => {
    document.body.innerHTML = '<main></main>';
    const { initLightbox } = await import('./lightbox');
    expect(() => initLightbox()).not.toThrow();
  });

  // A gallery scope with no tiles yet leaves the dialog unbound rather than
  // wiring arrows that would index into nothing.
  it('leaves an empty gallery unbound', async () => {
    document.body.innerHTML = `<section data-lightbox-scope>
      <dialog data-lightbox><img data-lightbox-image src="" alt="" /></dialog>
    </section>`;
    stubShowModal();
    const { initLightbox } = await import('./lightbox');
    initLightbox();

    expect(document.querySelector('[data-lightbox-scope]')?.getAttribute('data-lightbox-bound'))
      .toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { donorCardVisible, chipPressed, groupVisible, initDonorFilter, ALL_TIERS } from './donorFilter';

describe('donorCardVisible', () => {
  // The default state, and the state the wall renders on the server: everything
  // shown. A filter that started with something hidden would mean the no-JS wall
  // and the JS wall disagreed about what the page contains.
  it('shows every card under the all-donors chip', () => {
    expect(donorCardVisible('leadership', ALL_TIERS)).toBe(true);
    expect(donorCardVisible('other', ALL_TIERS)).toBe(true);
    expect(donorCardVisible('', ALL_TIERS)).toBe(true);
  });

  // The ordinary filter.
  it('shows only the cards in the selected tier', () => {
    expect(donorCardVisible('leadership', 'leadership')).toBe(true);
    expect(donorCardVisible('supporting', 'leadership')).toBe(false);
  });

  // The trailing group's chip selects the cards the SERVER filed there, read off
  // `data-tier` — the client never re-derives which donors were unmatched.
  it('shows the trailing group under its own chip', () => {
    expect(donorCardVisible('other', 'other')).toBe(true);
    expect(donorCardVisible('leadership', 'other')).toBe(false);
  });
});

describe('chipPressed', () => {
  // Exactly one chip reads as pressed, so a screen-reader user is told which
  // filter is active rather than inferring it from what disappeared.
  it('marks only the selected chip as pressed', () => {
    expect(chipPressed('leadership', 'leadership')).toBe(true);
    expect(chipPressed('supporting', 'leadership')).toBe(false);
    expect(chipPressed(ALL_TIERS, ALL_TIERS)).toBe(true);
  });
});

describe('groupVisible', () => {
  // A band whose every card is filtered out is hidden with them — otherwise the
  // wall leaves a heading and a tier description floating over an empty row.
  it('hides a band with no matching cards', () => {
    expect(groupVisible(['supporting', 'supporting'], 'leadership')).toBe(false);
  });

  // The ordinary case: the band the visitor filtered TO must survive the filter.
  it('shows a band that still has a matching card', () => {
    expect(groupVisible(['leadership', 'leadership'], 'leadership')).toBe(true);
  });

  // The unfiltered wall, which is the state the server renders — no band may be
  // hidden before the visitor has chosen anything.
  it('shows every band under the all-donors chip', () => {
    expect(groupVisible(['supporting'], ALL_TIERS)).toBe(true);
  });

  // Degenerate edge: a band with no cards has nothing to show, so it stays
  // hidden rather than defaulting to visible.
  it('hides a band with no cards at all', () => {
    expect(groupVisible([], ALL_TIERS)).toBe(false);
  });
});

/** The markup DonorWall renders: two bands, three cards, a chip per band + All. */
function renderWall(): void {
  document.body.innerHTML = `
    <section data-donor-wall>
      <div class="chips">
        <button data-donor-chip="${ALL_TIERS}" aria-pressed="true">All donors</button>
        <button data-donor-chip="leadership" aria-pressed="false">Leadership Circle</button>
        <button data-donor-chip="supporting" aria-pressed="false">Supporting Donors</button>
      </div>
      <div data-donor-group data-tier="leadership">
        <div data-donor-card data-tier="leadership">Margaret Chen</div>
      </div>
      <div data-donor-group data-tier="supporting">
        <div data-donor-card data-tier="supporting">Kwame Boateng</div>
        <div data-donor-card data-tier="supporting">Elena Marchetti</div>
      </div>
    </section>`;
}

const chip = (tier: string) =>
  document.querySelector<HTMLButtonElement>(`[data-donor-chip="${tier}"]`)!;
const shownCards = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-donor-card]'))
    .filter((el) => !el.hidden)
    .map((el) => el.textContent?.trim());
const shownGroups = () =>
  Array.from(document.querySelectorAll<HTMLElement>('[data-donor-group]'))
    .filter((el) => !el.hidden)
    .map((el) => el.dataset.tier);

describe('initDonorFilter', () => {
  // The wiring must be safe to call from any page that imports the module — the
  // wall is one section of /donate, not the whole page. A throw here would take
  // the entire campaign page down.
  it('does nothing when the wall is not on the page', () => {
    document.body.innerHTML = '<main>No wall here</main>';
    expect(() => initDonorFilter()).not.toThrow();
  });

  // A single-band wall renders no chips, so there is nothing to wire.
  it('does nothing when the wall renders no chips', () => {
    document.body.innerHTML = `
      <section data-donor-wall>
        <div data-donor-group data-tier="leadership">
          <div data-donor-card data-tier="leadership">Margaret Chen</div>
        </div>
      </section>`;
    initDonorFilter();

    expect(shownCards()).toEqual(['Margaret Chen']);
  });

  // The server renders everything visible; init must not change that, or the
  // page would visibly reshuffle the moment the script arrives.
  it('leaves every donor visible on init', () => {
    renderWall();
    initDonorFilter();

    expect(shownCards()).toEqual(['Margaret Chen', 'Kwame Boateng', 'Elena Marchetti']);
    expect(chip(ALL_TIERS).getAttribute('aria-pressed')).toBe('true');
  });

  // The feature itself, end to end through a real click.
  it('shows only the chosen tier, and hides the bands left empty', () => {
    renderWall();
    initDonorFilter();
    chip('supporting').click();

    expect(shownCards()).toEqual(['Kwame Boateng', 'Elena Marchetti']);
    expect(shownGroups()).toEqual(['supporting']);
    expect(chip('supporting').getAttribute('aria-pressed')).toBe('true');
    expect(chip(ALL_TIERS).getAttribute('aria-pressed')).toBe('false');
  });

  // Filtering must be reversible — a visitor who narrows down has to be able to
  // get the whole wall back, which is the one path that leaves donors hidden if
  // it breaks.
  it('restores every donor when the all-donors chip is chosen again', () => {
    renderWall();
    initDonorFilter();
    chip('leadership').click();
    chip(ALL_TIERS).click();

    expect(shownCards()).toEqual(['Margaret Chen', 'Kwame Boateng', 'Elena Marchetti']);
    expect(shownGroups()).toEqual(['leadership', 'supporting']);
  });
});

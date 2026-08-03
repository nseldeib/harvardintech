// The donor wall's tier filter chips and note reveal — progressive enhancement
// in the `./gallery.ts` / `./parallax.ts` mould: pure helpers carrying the
// decisions, plus thin idempotent DOM wiring that no-ops when the section is
// absent.
//
// Every donor's name is already in the static HTML, grouped and headed. This
// script only HIDES cards that do not match a chosen chip, so with JavaScript
// off — or before the module loads — the wall is the complete, readable list it
// always was. Filtering is a convenience for a long wall, never the thing that
// makes the wall render.

/** The chip value meaning "no filter". Chosen to not collide with a tier id,
 *  which is a slug an editor types. */
export const ALL_TIERS = '__all__';

/**
 * Whether a card in `cardTier` should be visible when `selected` is chosen.
 *
 * `ALL_TIERS` shows everything. Otherwise a card matches only its own tier — the
 * client counterpart of `matchesTier`, reading the tier the SERVER already
 * resolved onto the card's `data-tier` (including `other` for the trailing
 * group), so the two cannot disagree about where a donor belongs.
 */
export function donorCardVisible(cardTier: string, selected: string): boolean {
  return selected === ALL_TIERS || cardTier === selected;
}

/** The chip that should read as pressed: exactly the selected one. Kept pure so
 *  the `aria-pressed` bookkeeping is testable without a DOM. */
export function chipPressed(chipTier: string, selected: string): boolean {
  return chipTier === selected;
}

/**
 * Whether a group band still has anything to show under the current filter — a
 * band whose every card is hidden is hidden too, so the wall never leaves a
 * heading floating over an empty row.
 */
export function groupVisible(groupTiers: readonly string[], selected: string): boolean {
  return groupTiers.some((tier) => donorCardVisible(tier, selected));
}

/**
 * Idempotent DOM wiring for the filter chips. No-op under SSR / vitest (no
 * window/document) and no-op when the wall is not on the page or renders no
 * chips — the empty wall and a single-tier wall both fall into that case.
 *
 * Cards are hidden with the `hidden` attribute rather than a class so a hidden
 * card is out of the accessibility tree too: a screen-reader user who filters to
 * one level should hear that level, not the whole wall.
 */
export function initDonorFilter(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const wall = document.querySelector<HTMLElement>('[data-donor-wall]');
  if (!wall) return;

  const chips = Array.from(wall.querySelectorAll<HTMLButtonElement>('[data-donor-chip]'));
  if (chips.length === 0) return;

  const cards = Array.from(wall.querySelectorAll<HTMLElement>('[data-donor-card]'));
  const groups = Array.from(wall.querySelectorAll<HTMLElement>('[data-donor-group]'));

  const apply = (selected: string) => {
    for (const card of cards) {
      card.hidden = !donorCardVisible(card.dataset.tier ?? '', selected);
    }
    for (const group of groups) {
      const groupTiers = Array.from(
        group.querySelectorAll<HTMLElement>('[data-donor-card]'),
      ).map((card) => card.dataset.tier ?? '');
      group.hidden = !groupVisible(groupTiers, selected);
    }
    for (const chip of chips) {
      chip.setAttribute(
        'aria-pressed',
        String(chipPressed(chip.dataset.donorChip ?? '', selected)),
      );
    }
  };

  for (const chip of chips) {
    chip.addEventListener('click', () => apply(chip.dataset.donorChip ?? ALL_TIERS));
  }

  // The chips are inert markup until now, so make the rendered state explicit
  // rather than trusting the server and the script to have agreed by accident.
  apply(ALL_TIERS);
}

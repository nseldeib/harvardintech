// Which cards belong to which band.
//
// A slot section (`pillars`, `accomplishments`) used to show EVERY card in its
// collection, which is why duplicating a `pillars` section produced two bands
// rendering the identical three cards. A `group` on both sides — the section says
// which cards it shows, the card says which band it belongs to — is what makes a
// duplicated band genuinely distinct.
//
// Pure and framework-free like `./momentumSections.ts` beside it: no `fs`, no
// Astro imports, so the matching rule unit-tests directly. It lives here rather
// than inside either card loader because BOTH loaders need the identical rule,
// and a matching rule that drifts between two bands is a bug no screenshot shows.

/** The minimum shape needed to file a card under a band. */
export interface GroupedLike {
  group?: string;
}

/**
 * Normalize a group value so trivial typing differences do not silently split a
 * band. Trimmed and lowercased: an editor who types "Capital Projects" on the
 * section and "capital projects" on the card meant one group, and a rule that
 * disagreed would hand them an empty band with no visible cause.
 */
function normalizeGroup(value?: string): string {
  return value?.trim().toLowerCase() ?? '';
}

/**
 * The cards belonging to `group`, in input order.
 *
 * Blank matches blank: a section with no group shows the cards with no group,
 * which is exactly the page as it renders today — so groups ship with zero
 * content migration and no visual change until an editor deliberately splits a
 * band.
 *
 * A group matching no card yields an EMPTY list rather than falling back to
 * every card. The fallback is the tempting choice and the wrong one: it would
 * make a typo'd group look like it worked, which is the one outcome an editor
 * cannot diagnose from the page. `emptyGroups` turns that empty band into a
 * build-time line instead.
 */
export function cardsInGroup<T extends GroupedLike>(
  cards: readonly T[],
  group?: string,
): T[] {
  const wanted = normalizeGroup(group);
  return cards.filter((card) => normalizeGroup(card.group) === wanted);
}

/**
 * The group filter a card LOADER applies, with the one distinction that matters
 * at its call site: NO ARGUMENT means no filtering at all, while a supplied group
 * — including the empty string — selects that band through {@link cardsInGroup}.
 *
 * The difference is not pedantic. `cardsInGroup(cards, undefined)` matches blank
 * to blank and returns only the UNGROUPED cards, so a loader that always filtered
 * would quietly hide every grouped card from a caller that just wants the
 * collection. `/donate` is exactly that caller: it loads each card set ONCE and
 * lets the page component select per band, so it needs the whole set. Passing no
 * group therefore behaves exactly as the loaders did before groups existed.
 *
 * It lives here rather than beside the loaders because `donatePageContent.ts`
 * imports `astro:content` and so cannot be unit-tested — and this rule is the
 * subtlest one in the feature, which makes it the last one that should be
 * stranded in an untestable module.
 */
export function selectGroup<T extends GroupedLike>(
  cards: readonly T[],
  group?: string,
): T[] {
  return group === undefined ? [...cards] : cardsInGroup(cards, group);
}

/** The minimum shape needed to ask a section which cards it wants. */
export interface GroupedSectionLike {
  kind: string;
  slug?: string;
  group?: string;
}

/**
 * The slugs of sections whose `group` matches no card in the set they draw from,
 * for an advisory `console.warn` at build time — the same shape
 * `unknownSectionKinds` and `goalMetersMissingWidgetId` already use on this page.
 *
 * It exists because the empty band above is SILENT: a section pointing at a group
 * nobody typed renders nothing at all, and that is indistinguishable from a band
 * an editor has not filled in yet. Naming the slug is what makes it diagnosable.
 *
 * Sections with no group are never reported — an ungrouped band matching no
 * ungrouped card is the ordinary empty-collection state, not a typo. `cardsByKind`
 * maps a section kind to the cards that kind draws from; a kind absent from it
 * (`narrative`, `goal-meter`, `donors`) is not card-backed and is skipped.
 */
export function emptyGroups(
  sections: readonly GroupedSectionLike[],
  cardsByKind: Record<string, readonly GroupedLike[]>,
): string[] {
  return sections
    .filter((section) => {
      if (!section.group?.trim()) return false;
      const cards = cardsByKind[section.kind];
      if (!cards) return false;
      return cardsInGroup(cards, section.group).length === 0;
    })
    .map((section) => section.slug ?? '(unnamed section)');
}

// Pure, framework-free helpers for the /sponsor wall. No `fs`, no Astro imports,
// so the rules unit-test directly — the same shape as `./nav.ts` and `./events.ts`.
// The page supplies the data; this module only reshapes it.

/** The minimum shape needed to place a sponsor on the wall: `{ slug, ...data }`. */
export interface SponsorLike {
  slug: string;
  name: string;
  tier?: string;
  logo?: string;
  url?: string;
  placeholder?: boolean;
  order?: number;
}

/** A partnership level as `sponsorPage.json` declares it. */
export interface SponsorLevelLike {
  id: string;
  name: string;
}

/** One rendered band of the wall: a level and the sponsors sitting under it. */
export interface SponsorGroup<T extends SponsorLike = SponsorLike> {
  id: string;
  name: string;
  sponsors: T[];
}

/**
 * Sponsors grouped by partnership level, in the order the levels are declared —
 * so the wall reads top-down from the biggest commitment, matching the order the
 * levels themselves are presented further up the page.
 *
 * Within a level the rule is the site-wide one: the optional `order` pin first,
 * then alphabetically by name, so an unpinned wall stays stable and a new
 * sponsor needs no renumbering.
 *
 * A level with no sponsors is omitted rather than rendered empty — a heading over
 * nothing reads as a gap the team forgot to fill. A sponsor whose `tier` matches
 * no declared level is NOT dropped: it collects under a trailing group so an
 * editor sees their entry on the page (with a visible heading naming the unknown
 * tier) rather than silently losing it to a typo. An untagged sponsor lands there
 * too, which is the common case before anyone has picked a level.
 *
 * Callers pass sponsors already draft-filtered by `publishedEntries`.
 */
export function groupSponsorsByLevel<T extends SponsorLike>(
  sponsors: readonly T[],
  levels: readonly SponsorLevelLike[],
): SponsorGroup<T>[] {
  const byOrderThenName = (a: T, b: T) =>
    (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name);

  const declared = new Set(levels.map((level) => level.id));
  const groups: SponsorGroup<T>[] = [];

  for (const level of levels) {
    const members = sponsors.filter((s) => s.tier === level.id).sort(byOrderThenName);
    if (members.length > 0) {
      groups.push({ id: level.id, name: level.name, sponsors: members });
    }
  }

  const unmatched = sponsors
    .filter((s) => !s.tier || !declared.has(s.tier))
    .sort(byOrderThenName);
  if (unmatched.length > 0) {
    groups.push({ id: 'other', name: 'Other partners', sponsors: unmatched });
  }

  return groups;
}

/**
 * Whether any sponsor on the wall is illustrative.
 *
 * The wall renders a prominent "these are examples" notice when this is true.
 * It is deliberately ANY rather than ALL: one sample entry sitting beside three
 * real partners is exactly the case where a reader would otherwise assume the
 * whole row is real, so the notice has to fire on the mixed state too.
 */
export function hasPlaceholderSponsors(sponsors: readonly SponsorLike[]): boolean {
  return sponsors.some((sponsor) => sponsor.placeholder === true);
}

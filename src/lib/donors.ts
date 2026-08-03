// Pure, framework-free rules for the Momentum Fund donor recognition wall. No
// `fs`, no Astro imports, so they unit-test directly — the same shape as
// `./sponsors.ts`, which this module is deliberately modelled on: the wall's
// grouping, its tolerance for an unmatched tier, and its order-then-name rule
// are the sponsor wall's rules applied to people instead of organizations.
//
// The page supplies the data; this module only reshapes it.

import { byOrder } from './order';
import { initials } from './team';

/** The minimum shape needed to place a donor on the wall: `{ slug, ...data }`. */
export interface DonorLike {
  slug: string;
  name: string;
  tier?: string;
  founding?: boolean;
  anonymous?: boolean;
  note?: string;
  url?: string;
  photo?: string;
  order?: number;
}

/** A giving level as `donatePage.json` declares it. */
export interface DonorTierLike {
  id: string;
  name: string;
  description?: string;
}

/** One rendered band of the wall: a giving level and the donors under it. */
export interface DonorGroup<T extends DonorLike = DonorLike> {
  id: string;
  name: string;
  description?: string;
  donors: T[];
}

/** The group unmatched and untagged donors collect under. */
export const OTHER_TIER_ID = 'other';

/** What the wall shows in place of a name when a donor asked not to be named. */
export const ANONYMOUS_DONOR_LABEL = 'Anonymous donor';

/**
 * Donors grouped by giving level, in the order the levels are declared — so the
 * wall reads top-down from the largest commitment, matching how the levels are
 * presented elsewhere on the page.
 *
 * Within a level the rule is the site-wide one: the optional `order` pin first,
 * then alphabetically by name, so an unpinned wall stays stable and a new donor
 * needs no renumbering. Sorting uses the DISPLAYED name, so anonymous entries
 * sort where a reader sees them rather than where their withheld name would put
 * them — otherwise the alphabetical run visibly breaks at every anonymous card
 * and hints at the hidden name's first letter.
 *
 * A level with no donors is omitted rather than rendered empty — a heading over
 * nothing reads as a gap the team forgot to fill. A donor whose `tier` matches no
 * declared level is NOT dropped: they collect under a trailing group, so an
 * editor sees their entry on the page rather than silently losing it to a typo or
 * to a level that was later renamed. An untagged donor lands there too, which is
 * the common case before anyone has assigned a level.
 *
 * Callers pass donors already draft-filtered by `publishedEntries`.
 */
export function groupDonorsByTier<T extends DonorLike>(
  donors: readonly T[],
  tiers: readonly DonorTierLike[],
): DonorGroup<T>[] {
  const byOrderThenName = (a: T, b: T) =>
    byOrder(a, b) || donorDisplayName(a).localeCompare(donorDisplayName(b));

  const declared = new Set(tiers.map((tier) => tier.id));
  const groups: DonorGroup<T>[] = [];

  for (const tier of tiers) {
    const members = donors.filter((d) => d.tier === tier.id).sort(byOrderThenName);
    if (members.length > 0) {
      groups.push({
        id: tier.id,
        name: tier.name,
        description: tier.description,
        donors: members,
      });
    }
  }

  const unmatched = donors.filter((d) => !d.tier || !declared.has(d.tier)).sort(byOrderThenName);
  if (unmatched.length > 0) {
    groups.push({ id: OTHER_TIER_ID, name: 'Other supporters', donors: unmatched });
  }

  return groups;
}

/**
 * The name to print on the wall.
 *
 * `anonymous` means the donor asked not to be named, so the site shows the
 * standing label while the entry keeps the real name for the team's records.
 * Everything reader-facing goes through here rather than reading `.name`
 * directly — a single component that forgets is a name published against
 * someone's explicit request, which no later edit can take back.
 */
export function donorDisplayName(donor: DonorLike): string {
  return donor.anonymous === true ? ANONYMOUS_DONOR_LABEL : donor.name;
}

/**
 * The outbound link to render for a donor, or `undefined` for none.
 *
 * An anonymous donor's `url` is suppressed even when it is set: a LinkedIn
 * profile beside "Anonymous donor" identifies them just as surely as printing
 * the name would, so anonymity that stopped at the name would be anonymity in
 * appearance only. The field stays on the entry — the team may still want it —
 * it simply never reaches the page.
 */
export function donorLinkHref(donor: DonorLike): string | undefined {
  if (donor.anonymous === true) return undefined;
  return donor.url && donor.url.trim().length > 0 ? donor.url : undefined;
}

/**
 * The photo to render for a donor, or `undefined` for none.
 *
 * The third arm of the anonymity contract, alongside `donorDisplayName` and
 * `donorLinkHref`: a face identifies someone as surely as a name or a profile
 * link, so an anonymous donor's `photo` is suppressed even when it is set. It
 * lives here rather than as a ternary in the card so all three suppressions are
 * in one place — a reader checking "what does anonymous actually hide?" finds
 * the whole answer without reading a component.
 */
export function donorPhoto(donor: DonorLike): string | undefined {
  if (donor.anonymous === true) return undefined;
  return donor.photo && donor.photo.trim().length > 0 ? donor.photo : undefined;
}

/**
 * What to draw in place of a photo: the donor's initials, or a dash when they
 * are anonymous.
 *
 * Initials would leak the withheld name — "RKW" beside "Anonymous donor" names
 * them to anyone who knows them — so an anonymous entry gets a neutral mark
 * instead. Decorative either way: the card renders it `aria-hidden`, since the
 * name is already beside it.
 */
export function donorMonogram(donor: DonorLike): string {
  return donor.anonymous === true ? '—' : initials(donor.name);
}

/**
 * The donors carrying the Founding Donor badge, in input order.
 *
 * Founding is recognition for giving early, not for giving more, so it is a flag
 * across every level rather than a level of its own. The wall's intro uses the
 * count to say how many there are without singling any one of them out.
 */
export function foundingDonors<T extends DonorLike>(donors: readonly T[]): T[] {
  return donors.filter((donor) => donor.founding === true);
}

/**
 * The line the wall prints above the bands about its founding donors, or
 * `undefined` when there are none to talk about.
 *
 * Says what the badge MEANS in a sentence, so a first-time reader learns it once
 * at the top rather than inferring it from a pill they have to hover. Returns
 * `undefined` rather than an empty string for the zero case — the wall's early
 * days, when the badge has no holders and a line about it would be noise.
 */
export function foundingDonorsSummary(count: number): string | undefined {
  if (count <= 0) return undefined;
  const subject = count === 1 ? '1 Founding Donor gave' : `${count} Founding Donors gave`;
  return `${subject} before there was a track record to point to.`;
}

/**
 * Whether the wall is worth putting filter chips on.
 *
 * One band means the chips would read "All donors / Leadership Circle" over a
 * list that already fits on the screen — a control that filters nothing, which
 * is worse than no control at all. Chips earn their place only once there is
 * somewhere else to go.
 */
export function shouldShowTierChips(groups: readonly DonorGroup[]): boolean {
  return groups.length > 1;
}

/**
 * Whether a donor belongs under a given tier id — the predicate behind the filter
 * chips.
 *
 * Shared by the server render and the client filter script on purpose: two copies
 * of "which tier is this donor in?" is two answers that can disagree, and the one
 * a visitor sees would be the client's. `OTHER_TIER_ID` matches exactly the
 * donors `groupDonorsByTier` puts in the trailing group — untagged, or tagged
 * with a level the page does not declare.
 */
export function matchesTier(
  donor: DonorLike,
  tierId: string,
  tiers: readonly DonorTierLike[],
): boolean {
  if (tierId === OTHER_TIER_ID) {
    return !donor.tier || !tiers.some((tier) => tier.id === donor.tier);
  }
  return donor.tier === tierId;
}

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
  /** Which Harvard school they came through — one of `HARVARD_SCHOOLS`. Printed
   *  on the selected-node panel in The Momentum Network, and one of the two
   *  things "find your place in the network" searches on. */
  school?: string;
  /** The year they graduated, shown beside the school. A number so it sorts and
   *  filters; the CMS renders it as a number input. Models ONE degree per
   *  supporter, which is the shape the network's node panel assumes. */
  gradYear?: number;
  /** Where they are now — city or region, free text. The other axis "find your
   *  place in the network" filters on. */
  location?: string;
  /** The supporter's OWN words on why they gave, used to pre-fill the message
   *  when they share their badge. Distinct from `note`, which is the line the
   *  team writes for the wall: the share rule turns on whether the SUPPORTER
   *  submitted one, and a field with two possible authors cannot answer that. */
  why?: string;
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
 * The Harvard schools a supporter can be filed under.
 *
 * This list is the AUTHORITY: the CMS dropdown (`src/data/collections.json`)
 * offers exactly these, `src/lib/selectOptions.test.ts` holds the two copies in
 * step, and the network's "find your school" search matches on the stored value.
 * That last one is why this is a fixed list where `location` is free text —
 * free-typed schools would split Harvard Business School across "HBS",
 * "Business School", and the full name, and a search that silently misses
 * supporters is worse than no search at all.
 *
 * The same `as const` shape as `SECTION_KINDS` and `PILLAR_ICONS`.
 */
export const HARVARD_SCHOOLS = [
  'Harvard College',
  'Harvard Business School',
  'Harvard Law School',
  'Harvard Medical School',
  'Harvard Kennedy School',
  'Harvard Graduate School of Design',
  'Harvard Graduate School of Education',
  'Harvard Division of Continuing Education',
  'Harvard Divinity School',
  'Harvard T.H. Chan School of Public Health',
  'Harvard School of Dental Medicine',
  'Harvard John A. Paulson School of Engineering and Applied Sciences',
  'Harvard Graduate School of Arts and Sciences',
] as const;

export type HarvardSchool = (typeof HARVARD_SCHOOLS)[number];

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
 * Normalize a `school` value to one of `HARVARD_SCHOOLS`, or `undefined`.
 *
 * Trimmed and case-insensitive, following `normalizeGroup` in
 * `./sectionGroups.ts`: an editor is not owed an empty result for a
 * capitalization difference, and a value that arrives from a hand-edited file or
 * a scenario seed should still land where it was meant to.
 *
 * The shape of `resolveLayout` in `./momentumSections.ts`, differing in one way
 * that matters: it falls back to `undefined` rather than a default, because
 * there is no sensible school to guess. Filing someone under the wrong school
 * would be worse than filing them under none — the network's search would show
 * them to the wrong people.
 */
export function resolveSchool(value?: string): HarvardSchool | undefined {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (normalized.length === 0) return undefined;
  return HARVARD_SCHOOLS.find((school) => school.toLowerCase() === normalized);
}

/** The reader-facing identity of a supporter, with anonymity already applied. */
export interface DonorPublicIdentity {
  name: string;
  school?: string;
  gradYear?: number;
  location?: string;
}

/**
 * Everything reader-facing code may print about WHO a supporter is.
 *
 * This is the ONLY way reader-facing code should reach `school`, `gradYear`, and
 * `location` — the same rule `donorDisplayName` states for the name, and for the
 * same reason. `donorLinkHref` already makes the argument: a LinkedIn URL beside
 * "Anonymous donor" identifies someone as surely as printing the name would. A
 * school plus a graduation year plus a city is a STRONGER identifier than that
 * URL — in a community this size it is frequently unique — so all three are
 * withheld together for an anonymous supporter.
 *
 * They are returned as one object rather than as three separate getters
 * deliberately: three getters is three chances for a future component to reach
 * past one of them, and the failure mode is publishing something against an
 * explicit request, which no later edit takes back. Ask for the identity, get
 * the whole of it, correctly filtered.
 *
 * The fields stay on the entry — the team may still want them for their records
 * — they simply never reach the page.
 */
export function donorPublicIdentity(donor: DonorLike): DonorPublicIdentity {
  const name = donorDisplayName(donor);
  if (donor.anonymous === true) return { name };

  return {
    name,
    school: resolveSchool(donor.school),
    gradYear: donor.gradYear,
    location: donor.location && donor.location.trim().length > 0 ? donor.location.trim() : undefined,
  };
}

/**
 * The supporter's own "why I contributed" message, or `undefined` when there
 * isn't one.
 *
 * This is the predicate the share rule depends on: when a supporter did not
 * submit a message, that line is removed from the share badge entirely rather
 * than rendered blank. So "absent", "empty", and "whitespace only" all have to
 * collapse to the same answer — a message of three spaces is not a message.
 *
 * Suppressed for an anonymous supporter as well, alongside the fields in
 * `donorPublicIdentity`. A personal statement about why someone gave is
 * identifying, and often more so than their school or city: it is written in
 * their own voice and frequently names where they work or what happened to them.
 */
export function donorWhy(donor: DonorLike): string | undefined {
  if (donor.anonymous === true) return undefined;
  const trimmed = donor.why?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : undefined;
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

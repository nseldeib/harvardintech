import { describe, it, expect } from 'vitest';
import {
  groupDonorsByTier,
  donorDisplayName,
  donorLinkHref,
  donorPhoto,
  donorMonogram,
  foundingDonors,
  foundingDonorsSummary,
  shouldShowTierChips,
  matchesTier,
  ANONYMOUS_DONOR_LABEL,
  OTHER_TIER_ID,
  type DonorGroup,
  type DonorLike,
  type DonorTierLike,
} from './donors';

const TIERS: DonorTierLike[] = [
  { id: 'leadership', name: 'Leadership Circle' },
  { id: 'sustaining', name: 'Sustaining Donors' },
  { id: 'supporting', name: 'Supporting Donors' },
];

function donor(slug: string, name: string, extra: Partial<DonorLike> = {}): DonorLike {
  return { slug, name, ...extra };
}

describe('groupDonorsByTier', () => {
  // The wall reads top-down from the largest commitment, so the bands follow the
  // declared tier order — NOT the order donors happen to sit in the collection.
  it('orders groups by the declared tier order, not the donor order', () => {
    const donors = [
      donor('c', 'Clara Ndiaye', { tier: 'supporting' }),
      donor('a', 'Aisha Rahman', { tier: 'leadership' }),
      donor('b', 'Ben Wei', { tier: 'sustaining' }),
    ];

    expect(groupDonorsByTier(donors, TIERS).map((g) => g.id)).toEqual([
      'leadership',
      'sustaining',
      'supporting',
    ]);
  });

  // Within a tier the site-wide rule applies: the optional pin first, then
  // alphabetical, so an unpinned wall stays stable as donors are added.
  it('sorts within a tier by the order pin, then by name', () => {
    const donors = [
      donor('z', 'Zara Whitfield', { tier: 'sustaining' }),
      donor('a', 'Aisha Rahman', { tier: 'sustaining' }),
      donor('p', 'Priya Raman', { tier: 'sustaining', order: 1 }),
    ];

    const [group] = groupDonorsByTier(donors, TIERS);
    expect(group.donors.map((d) => d.name)).toEqual([
      'Priya Raman',
      'Aisha Rahman',
      'Zara Whitfield',
    ]);
  });

  // Sorting uses the DISPLAYED name. Sorting by the withheld real name would
  // break the alphabetical run at every anonymous card and hint at the hidden
  // name's first letter — anonymity leaking through the sort order.
  it('sorts an anonymous donor by the label shown, not their withheld name', () => {
    const donors = [
      donor('z', 'Zara Whitfield', { tier: 'leadership' }),
      donor('b', 'Beatrice Ellery', { tier: 'leadership', anonymous: true }),
      donor('m', 'Margaret Chen', { tier: 'leadership' }),
    ];

    // "Anonymous donor" sorts under A, where a reader sees it — not under B.
    const [group] = groupDonorsByTier(donors, TIERS);
    expect(group.donors.map(donorDisplayName)).toEqual([
      ANONYMOUS_DONOR_LABEL,
      'Margaret Chen',
      'Zara Whitfield',
    ]);
  });

  // A heading over nothing reads as a gap someone forgot to fill, so a tier with
  // no donors is omitted entirely rather than rendered empty.
  it('omits a tier that has no donors', () => {
    const donors = [donor('a', 'Aisha Rahman', { tier: 'leadership' })];

    expect(groupDonorsByTier(donors, TIERS).map((g) => g.id)).toEqual(['leadership']);
  });

  // The failure this tolerance exists to prevent: a donor tagged with a level
  // that was renamed or mistyped disappearing from the wall. The gift was real
  // and the editor must be able to SEE the mistake, so the entry lands in a
  // trailing group instead of being dropped.
  it('collects a donor whose tier matches no declared level into a trailing group', () => {
    const donors = [
      donor('a', 'Aisha Rahman', { tier: 'leadership' }),
      donor('l', 'The Lindgren Family', { tier: 'legacy-circle' }),
    ];

    const groups = groupDonorsByTier(donors, TIERS);
    expect(groups.map((g) => g.id)).toEqual(['leadership', OTHER_TIER_ID]);
    expect(groups[1].donors.map((d) => d.name)).toEqual(['The Lindgren Family']);
  });

  // The common case before anyone has assigned levels: no tier at all. It lands
  // in the same trailing group rather than being treated as an error.
  it('puts an untagged donor in the trailing group', () => {
    const groups = groupDonorsByTier([donor('c', 'Clara Ndiaye')], TIERS);

    expect(groups.map((g) => g.id)).toEqual([OTHER_TIER_ID]);
  });

  // Production today: the collection is empty, and the wall renders its
  // invitation state off the back of an empty group list.
  it('returns no groups for no donors', () => {
    expect(groupDonorsByTier([], TIERS)).toEqual([]);
  });

  // With no tiers declared the wall still has to show everyone — every donor is
  // unmatched, so they all collect in the trailing group.
  it('puts every donor in the trailing group when no tiers are declared', () => {
    const donors = [donor('a', 'Aisha Rahman', { tier: 'leadership' })];

    expect(groupDonorsByTier(donors, []).map((g) => g.id)).toEqual([OTHER_TIER_ID]);
  });

  // The tier's description travels with the band so the wall can explain what
  // each level means without the component re-reading the copy.
  it('carries the declared tier description onto its group', () => {
    const tiers: DonorTierLike[] = [
      { id: 'leadership', name: 'Leadership Circle', description: 'A year of planning.' },
    ];

    expect(groupDonorsByTier([donor('a', 'Aisha Rahman', { tier: 'leadership' })], tiers)[0]).toMatchObject(
      { description: 'A year of planning.' },
    );
  });
});

describe('donorDisplayName', () => {
  // The ordinary case.
  it('returns the name for a donor who did not ask for anonymity', () => {
    expect(donorDisplayName(donor('m', 'Margaret Chen'))).toBe('Margaret Chen');
  });

  // The whole point of the flag: the name never reaches the page.
  it('returns the standing label for an anonymous donor', () => {
    expect(donorDisplayName(donor('m', 'Margaret Chen', { anonymous: true }))).toBe(
      ANONYMOUS_DONOR_LABEL,
    );
  });

  // `anonymous: false` is an editor who explicitly toggled it OFF, which means
  // publish the name — it must not be read as "flag present, so hide".
  it('returns the name when anonymity is explicitly off', () => {
    expect(donorDisplayName(donor('m', 'Margaret Chen', { anonymous: false }))).toBe('Margaret Chen');
  });
});

describe('donorLinkHref', () => {
  // The ordinary case: a donor's link reaches the page.
  it('returns the url for a named donor', () => {
    expect(donorLinkHref(donor('m', 'Margaret Chen', { url: 'https://example.com/m' }))).toBe(
      'https://example.com/m',
    );
  });

  // The rule anonymity would be meaningless without: a LinkedIn profile beside
  // "Anonymous donor" identifies them exactly as surely as the name would, so
  // the link is suppressed even though the field is set.
  it('suppresses the url of an anonymous donor', () => {
    expect(
      donorLinkHref(donor('m', 'Margaret Chen', { anonymous: true, url: 'https://example.com/m' })),
    ).toBeUndefined();
  });

  // Nothing to link to.
  it('returns undefined when there is no url', () => {
    expect(donorLinkHref(donor('m', 'Margaret Chen'))).toBeUndefined();
  });

  // A CMS text field that was opened and cleared leaves whitespace, not absence.
  // An `href=" "` renders as a live link to the current page.
  it('treats a blank url as no url', () => {
    expect(donorLinkHref(donor('m', 'Margaret Chen', { url: '   ' }))).toBeUndefined();
  });
});

describe('donorPhoto', () => {
  // The ordinary case: a donor's headshot reaches the card.
  it('returns the photo for a named donor', () => {
    expect(donorPhoto(donor('p', 'Priya Raman', { photo: '/images/p.png' }))).toBe('/images/p.png');
  });

  // The third arm of the anonymity contract: a face identifies someone as surely
  // as a name or a link, so it is withheld even though the field is set.
  it('suppresses the photo of an anonymous donor', () => {
    expect(
      donorPhoto(donor('p', 'Priya Raman', { anonymous: true, photo: '/images/p.png' })),
    ).toBeUndefined();
  });

  // Nothing to show — the card falls back to the monogram.
  it('returns undefined when there is no photo', () => {
    expect(donorPhoto(donor('p', 'Priya Raman'))).toBeUndefined();
  });

  // A CMS image field that was opened and cleared leaves whitespace, and an
  // `<img src=" ">` renders as a broken image rather than falling back.
  it('treats a blank photo as no photo', () => {
    expect(donorPhoto(donor('p', 'Priya Raman', { photo: '  ' }))).toBeUndefined();
  });
});

describe('donorMonogram', () => {
  // The photo-less fallback, shared with the board cards.
  it('returns the initials of a named donor', () => {
    expect(donorMonogram(donor('m', 'Margaret Chen-Alvarez'))).toBe('MC');
  });

  // Initials would leak the withheld name — "RKW" names Robert K. Whitmore to
  // anyone who knows him — so an anonymous entry gets a neutral mark instead.
  it('returns a neutral mark for an anonymous donor rather than their initials', () => {
    const mark = donorMonogram(donor('r', 'Robert K. Whitmore', { anonymous: true }));

    expect(mark).not.toContain('R');
    expect(mark).toBe('—');
  });

  // A household or organization name still yields something to draw.
  it('handles a multi-word name that is not a person', () => {
    expect(donorMonogram(donor('l', 'The Lindgren Family'))).toBe('TL');
  });
});

describe('foundingDonorsSummary', () => {
  // The plural case, which is what the wall shows nearly always.
  it('names the count in the plural', () => {
    expect(foundingDonorsSummary(4)).toBe(
      '4 Founding Donors gave before there was a track record to point to.',
    );
  });

  // The day the first founding gift lands. "1 Founding Donors" would be the
  // wall's first impression, so the singular is not a nicety.
  it('reads correctly for exactly one donor', () => {
    expect(foundingDonorsSummary(1)).toBe(
      '1 Founding Donor gave before there was a track record to point to.',
    );
  });

  // The wall's early days: no badge holders, so no line about them.
  it('returns nothing when no donor carries the badge', () => {
    expect(foundingDonorsSummary(0)).toBeUndefined();
  });

  // Defensive: a negative count is nonsense, and must not render as a sentence.
  it('returns nothing for a negative count', () => {
    expect(foundingDonorsSummary(-1)).toBeUndefined();
  });
});

describe('shouldShowTierChips', () => {
  // The wall the chips exist for.
  it('shows chips once there is more than one band', () => {
    const groups = [
      { id: 'leadership', name: 'Leadership Circle', donors: [] },
      { id: 'supporting', name: 'Supporting Donors', donors: [] },
    ] satisfies DonorGroup[];

    expect(shouldShowTierChips(groups)).toBe(true);
  });

  // One band means the chips would filter nothing — a control worse than none.
  it('hides chips when there is only one band', () => {
    expect(shouldShowTierChips([{ id: 'leadership', name: 'Leadership Circle', donors: [] }])).toBe(
      false,
    );
  });

  // Production today: no donors, no bands, and the empty state renders instead.
  it('hides chips when there are no bands at all', () => {
    expect(shouldShowTierChips([])).toBe(false);
  });
});

describe('foundingDonors', () => {
  // Founding is recognition for giving early, not for giving more — so the badge
  // holders come from every tier, not from one.
  it('returns the flagged donors across every tier', () => {
    const donors = [
      donor('a', 'Aisha Rahman', { tier: 'leadership', founding: true }),
      donor('b', 'Ben Wei', { tier: 'supporting' }),
      donor('c', 'Clara Ndiaye', { tier: 'supporting', founding: true }),
    ];

    expect(foundingDonors(donors).map((d) => d.name)).toEqual(['Aisha Rahman', 'Clara Ndiaye']);
  });

  // The state the wall is in on day one.
  it('returns nothing when no donor is flagged', () => {
    expect(foundingDonors([donor('b', 'Ben Wei')])).toEqual([]);
  });
});

describe('matchesTier', () => {
  // The chips' predicate for a declared level.
  it('matches a donor against their own declared tier', () => {
    const d = donor('a', 'Aisha Rahman', { tier: 'leadership' });

    expect(matchesTier(d, 'leadership', TIERS)).toBe(true);
    expect(matchesTier(d, 'sustaining', TIERS)).toBe(false);
  });

  // The trailing chip has to select exactly the donors the trailing GROUP holds,
  // or filtering to it would show a band the server never built.
  it('matches an unmatched-tier donor against the trailing group', () => {
    const d = donor('l', 'The Lindgren Family', { tier: 'legacy-circle' });

    expect(matchesTier(d, OTHER_TIER_ID, TIERS)).toBe(true);
    expect(matchesTier(d, 'leadership', TIERS)).toBe(false);
  });

  // An untagged donor sits in the trailing group too, so the chip must find them.
  it('matches an untagged donor against the trailing group', () => {
    expect(matchesTier(donor('c', 'Clara Ndiaye'), OTHER_TIER_ID, TIERS)).toBe(true);
  });

  // A donor in a real tier must NOT be swept into the trailing group.
  it('does not match a declared-tier donor against the trailing group', () => {
    expect(matchesTier(donor('a', 'Aisha Rahman', { tier: 'leadership' }), OTHER_TIER_ID, TIERS)).toBe(
      false,
    );
  });
});

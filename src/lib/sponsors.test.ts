import { describe, it, expect } from 'vitest';
import {
  groupSponsorsByLevel,
  hasPlaceholderSponsors,
  type SponsorLike,
  type SponsorLevelLike,
} from './sponsors';

const LEVELS: SponsorLevelLike[] = [
  { id: 'presenting', name: 'Presenting Partner' },
  { id: 'chapter', name: 'Chapter Partner' },
  { id: 'event', name: 'Event Partner' },
];

function sponsor(slug: string, name: string, tier?: string, order?: number): SponsorLike {
  return { slug, name, tier, order };
}

describe('groupSponsorsByLevel', () => {
  // The wall reads top-down from the biggest commitment, so the groups follow the
  // declared level order — NOT the order sponsors happen to sit in the collection.
  it('orders groups by the declared level order, not the sponsor order', () => {
    const sponsors = [
      sponsor('c', 'Cambridge Ventures', 'event'),
      sponsor('a', 'Atlas Cloud', 'presenting'),
      sponsor('b', 'Beacon Labs', 'chapter'),
    ];

    expect(groupSponsorsByLevel(sponsors, LEVELS).map((g) => g.id)).toEqual([
      'presenting',
      'chapter',
      'event',
    ]);
  });

  // Within a level the site-wide rule applies: the optional pin first, then
  // alphabetical, so an unpinned wall stays stable as sponsors are added.
  it('sorts within a level by the order pin, then by name', () => {
    const sponsors = [
      sponsor('z', 'Zenith Systems', 'event'),
      sponsor('a', 'Apex Partners', 'event'),
      sponsor('p', 'Pinned Co', 'event', 1),
    ];

    const [group] = groupSponsorsByLevel(sponsors, LEVELS);
    expect(group.sponsors.map((s) => s.name)).toEqual([
      'Pinned Co',
      'Apex Partners',
      'Zenith Systems',
    ]);
  });

  // A heading over nothing reads as a gap someone forgot to fill, so a level with
  // no sponsors is omitted entirely rather than rendered empty.
  it('omits a level that has no sponsors', () => {
    const sponsors = [sponsor('a', 'Atlas Cloud', 'presenting')];

    expect(groupSponsorsByLevel(sponsors, LEVELS).map((g) => g.id)).toEqual(['presenting']);
  });

  // The typo case. `tier` is free text so levels can be renamed in the CMS, which
  // means a mistyped tier is possible — the sponsor must still reach the page.
  it('collects a sponsor whose tier matches no level instead of dropping it', () => {
    const sponsors = [sponsor('a', 'Atlas Cloud', 'Presenting')];

    const groups = groupSponsorsByLevel(sponsors, LEVELS);
    expect(groups.map((g) => g.id)).toEqual(['other']);
    expect(groups[0].sponsors.map((s) => s.name)).toEqual(['Atlas Cloud']);
  });

  // The common case before anyone has picked a level for a new sponsor.
  it('collects an untagged sponsor into the same trailing group', () => {
    const sponsors = [sponsor('a', 'Atlas Cloud'), sponsor('b', 'Beacon Labs', 'chapter')];

    const groups = groupSponsorsByLevel(sponsors, LEVELS);
    expect(groups.map((g) => g.id)).toEqual(['chapter', 'other']);
    expect(groups[1].sponsors.map((s) => s.name)).toEqual(['Atlas Cloud']);
  });

  // Production starts with an empty sponsors collection, so this is the day-one
  // state rather than a hypothetical — the page shows its empty message instead.
  it('returns no groups for no sponsors', () => {
    expect(groupSponsorsByLevel([], LEVELS)).toEqual([]);
  });

  // Levels are editable copy and can be emptied; every sponsor should still show.
  it('puts every sponsor in the trailing group when no levels are declared', () => {
    const sponsors = [sponsor('a', 'Atlas Cloud', 'presenting')];

    expect(groupSponsorsByLevel(sponsors, []).map((g) => g.id)).toEqual(['other']);
  });
});

describe('hasPlaceholderSponsors', () => {
  // The notice fires on ANY placeholder, not only when every entry is one: a
  // sample sitting beside real partners is exactly when a reader would otherwise
  // assume the whole row is real.
  it('reports true when only some entries are placeholders', () => {
    const sponsors: SponsorLike[] = [
      { slug: 'real', name: 'Atlas Cloud' },
      { slug: 'example', name: 'Example Partner', placeholder: true },
    ];

    expect(hasPlaceholderSponsors(sponsors)).toBe(true);
  });

  // The state the page reaches once the examples are replaced by real partners —
  // the notice must disappear, or it undermines the real ones.
  it('reports false when every entry is a real sponsor', () => {
    const sponsors: SponsorLike[] = [
      { slug: 'atlas', name: 'Atlas Cloud' },
      { slug: 'beacon', name: 'Beacon Labs', placeholder: false },
    ];

    expect(hasPlaceholderSponsors(sponsors)).toBe(false);
  });

  // An empty wall shows its empty message, which is not a claim about anyone.
  it('reports false for no sponsors at all', () => {
    expect(hasPlaceholderSponsors([])).toBe(false);
  });
});

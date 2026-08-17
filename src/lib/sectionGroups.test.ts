// The card-to-band matching rule.
//
// This is the half of "duplicate a section" that makes the copy a DISTINCT band
// rather than a verbatim second one. Before groups, `loadPillars` returned every
// pillar entry to every `pillars` section, so duplicating the band produced two
// headings over the identical three cards.
//
// The rule that needs pinning hardest is the one that is invisible on the page:
// a group matching NO card yields an empty band rather than falling back to every
// card. The fallback is the tempting implementation and the wrong one — it makes a
// typo'd group look like it worked, which is the one outcome an editor cannot
// diagnose from looking at the site.
import { describe, it, expect } from 'vitest';
import { cardsInGroup, selectGroup, emptyGroups } from './sectionGroups';

/** Two bands' worth of cards in one list, the way /donate loads them: once, whole. */
const CARDS = [
  { id: 'connections', group: 'powers' },
  { id: 'knowledge', group: 'powers' },
  { id: 'chapters', group: 'uses' },
  { id: 'ungrouped-a' },
  { id: 'ungrouped-b', group: '' },
];

const ids = (cards: { id: string }[]) => cards.map((c) => c.id);

describe('cardsInGroup', () => {
  // A named group selects only its own cards — the whole point of the field.
  it('selects only the cards naming the same group', () => {
    expect(ids(cardsInGroup(CARDS, 'powers'))).toEqual(['connections', 'knowledge']);
    expect(ids(cardsInGroup(CARDS, 'uses'))).toEqual(['chapters']);
  });

  // Blank matches blank, which is what lets this ship with no content migration:
  // today every card is ungrouped and every band is ungrouped, so the page is
  // unchanged until an editor deliberately splits one.
  it('matches a section with no group to the cards with no group', () => {
    expect(ids(cardsInGroup(CARDS, undefined))).toEqual(['ungrouped-a', 'ungrouped-b']);
  });

  // An absent key and an empty string are the same state to an editor who cleared
  // the box, so they must be the same state here.
  it('treats an absent group, an empty string and whitespace as the same blank', () => {
    expect(ids(cardsInGroup(CARDS, ''))).toEqual(['ungrouped-a', 'ungrouped-b']);
    expect(ids(cardsInGroup(CARDS, '   '))).toEqual(['ungrouped-a', 'ungrouped-b']);
  });

  // An editor typing 'Capital Projects' on the section and 'capital projects' on
  // the card meant one group; a rule that disagreed would hand them an empty band
  // with no visible cause.
  it('ignores surrounding whitespace and letter case on both sides', () => {
    const mixed = [{ id: 'a', group: '  Capital Projects ' }, { id: 'b', group: 'other' }];
    expect(ids(cardsInGroup(mixed, 'capital projects'))).toEqual(['a']);
    expect(ids(cardsInGroup(mixed, 'CAPITAL PROJECTS'))).toEqual(['a']);
  });

  // The load-bearing negative case. Falling back to every card here would make a
  // typo indistinguishable from a working group.
  it('yields an empty list for a group matching nothing rather than every card', () => {
    expect(cardsInGroup(CARDS, 'typo')).toEqual([]);
  });

  // Nothing in, nothing out — no throw on a collection an editor has not filled.
  it('returns an empty list for an empty card set', () => {
    expect(cardsInGroup([], 'powers')).toEqual([]);
    expect(cardsInGroup([], undefined)).toEqual([]);
  });

  // Filtering happens before sorting, so input order must survive it.
  it('preserves input order', () => {
    const reversed = [...CARDS].reverse();
    expect(ids(cardsInGroup(reversed, 'powers'))).toEqual(['knowledge', 'connections']);
  });
});

describe('selectGroup', () => {
  // The distinction the loaders depend on: NO ARGUMENT means no filtering, so a
  // caller that just wants the collection gets all of it. `cardsInGroup` with the
  // same undefined would return only the ungrouped cards, which would quietly
  // hide every grouped card from /donate — the caller that loads each set once
  // and selects per band downstream.
  it('returns every card when no group argument is supplied', () => {
    expect(ids(selectGroup(CARDS))).toEqual([
      'connections',
      'knowledge',
      'chapters',
      'ungrouped-a',
      'ungrouped-b',
    ]);
  });

  // An explicitly blank group is a REQUEST for the ungrouped band, not an absent
  // argument — so it filters where `undefined` does not.
  it('filters to the ungrouped band when given an explicit empty string', () => {
    expect(ids(selectGroup(CARDS, ''))).toEqual(['ungrouped-a', 'ungrouped-b']);
  });

  // With a group it is `cardsInGroup`, unchanged.
  it('delegates to cardsInGroup for a named group', () => {
    expect(ids(selectGroup(CARDS, 'uses'))).toEqual(['chapters']);
  });

  // The no-argument path copies rather than aliasing, so a caller sorting the
  // result in place cannot reorder the collection it was handed.
  it('returns a copy rather than the input array', () => {
    const out = selectGroup(CARDS);
    expect(out).not.toBe(CARDS);
    expect(out).toEqual(CARDS);
  });
});

describe('emptyGroups', () => {
  const BY_KIND = { pillars: CARDS, accomplishments: [{ id: 'stat', group: 'powers' }] };

  // The advisory exists because the empty band is SILENT: a section pointing at a
  // group nobody typed renders nothing, which looks exactly like a band an editor
  // has not filled in yet. The slug is what makes it diagnosable.
  it('names the slug of a section whose group matches no card', () => {
    const sections = [{ kind: 'pillars', slug: 'pillars-2', group: 'typo' }];
    expect(emptyGroups(sections, BY_KIND)).toEqual(['pillars-2']);
  });

  // A section whose group does match is working as intended and must stay quiet,
  // or the advisory becomes noise an editor learns to ignore.
  it('stays silent for a group that matches at least one card', () => {
    const sections = [{ kind: 'pillars', slug: 'pillars', group: 'powers' }];
    expect(emptyGroups(sections, BY_KIND)).toEqual([]);
  });

  // An ungrouped band drawing on an empty collection is the ordinary
  // nothing-published-yet state, not a typo — reporting it would fire on every
  // site that has not filled a card collection.
  it('never reports a section that names no group', () => {
    const sections = [
      { kind: 'pillars', slug: 'pillars' },
      { kind: 'pillars', slug: 'blank', group: '  ' },
    ];
    expect(emptyGroups(sections, { pillars: [] })).toEqual([]);
  });

  // narrative, goal-meter and donors draw on no card set, so they can carry a
  // group without it meaning anything — they must not be reported.
  it('skips section kinds that are not card-backed', () => {
    const sections = [{ kind: 'narrative', slug: 'why', group: 'anything' }];
    expect(emptyGroups(sections, BY_KIND)).toEqual([]);
  });

  // The advisory covers every card-backed kind, matched against its own set: the
  // same group name can be populated for one kind and empty for another.
  it('matches each section against the card set for its own kind', () => {
    const sections = [
      { kind: 'accomplishments', slug: 'acc-uses', group: 'uses' },
      { kind: 'pillars', slug: 'pillars-uses', group: 'uses' },
    ];
    expect(emptyGroups(sections, BY_KIND)).toEqual(['acc-uses']);
  });

  // A section with no slug still has to be nameable in the log line.
  it('falls back to a placeholder when a section carries no slug', () => {
    const sections = [{ kind: 'pillars', group: 'typo' }];
    expect(emptyGroups(sections, BY_KIND)).toEqual(['(unnamed section)']);
  });
});

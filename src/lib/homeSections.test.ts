import { describe, it, expect } from 'vitest';
import {
  HOME_SECTION_ANCHORS,
  HOME_SECTION_KINDS,
  HOME_SECTION_LABELS,
  hiddenSectionAnchors,
  orderedHomeSections,
  resolveVisibility,
  sectionAnchorId,
  unknownHomeSectionKinds,
  type HomeSectionLike,
} from './homeSections';

describe('resolveVisibility', () => {
  // The default, and the state every band ships in: neither toggle switched on.
  // An editor who never opens these fields gets a normal, visible homepage.
  it('shows a band with neither toggle set', () => {
    const band: HomeSectionLike = { kind: 'board' };
    expect(resolveVisibility(band)).toBe('shown');
  });

  // A hand-edited file may spell the flags out rather than omitting them; both
  // spellings of "off" must mean the same thing.
  it('reads an explicit false on both toggles as shown', () => {
    expect(resolveVisibility({ kind: 'board', draft: false, comingSoon: false })).toBe('shown');
  });

  // The middle state: the band is replaced, not removed, so its menu link still
  // lands somewhere.
  it('renders the placeholder when coming-soon is switched on', () => {
    expect(resolveVisibility({ kind: 'gallery', comingSoon: true })).toBe('coming-soon');
  });

  // Draft keeps its site-wide meaning here — off the public build — so an editor
  // learns one rule, not two.
  it('hides a band whose Draft toggle is switched on', () => {
    expect(resolveVisibility({ kind: 'gallery', draft: true })).toBe('hidden');
  });

  // The one combination that must not be read the other way round: a band an
  // editor hid cannot also advertise itself on the public site.
  it('lets Draft win over coming-soon when both are switched on', () => {
    expect(resolveVisibility({ kind: 'gallery', draft: true, comingSoon: true })).toBe('hidden');
  });
});

describe('orderedHomeSections', () => {
  // The headline guarantee, same as the Momentum Fund page: the Order field is
  // what moves a band up or down.
  it('sorts bands by their order field', () => {
    const sections = [
      { kind: 'board', order: 3 },
      { kind: 'hero', order: 1 },
      { kind: 'events', order: 2 },
    ];
    expect(orderedHomeSections(sections).map((s) => s.kind)).toEqual(['hero', 'events', 'board']);
  });

  // A band an editor never numbered sorts LAST rather than jumping to the top of
  // the page — adding one must not silently reshuffle the homepage.
  it('sorts a band with no order after every ordered band', () => {
    const sections = [{ kind: 'contact' }, { kind: 'stats', order: 2 }, { kind: 'hero', order: 1 }];
    expect(orderedHomeSections(sections).map((s) => s.kind)).toEqual(['hero', 'stats', 'contact']);
  });

  // `kind` is free text because the CMS has no select control, so a typo is a
  // normal editing mistake. It costs that one band, never the deploy.
  it('drops a band whose kind matches no component', () => {
    const sections = [{ kind: 'hero', order: 1 }, { kind: 'sponsors', order: 2 }];
    expect(orderedHomeSections(sections).map((s) => s.kind)).toEqual(['hero']);
  });

  // Classification is the caller's job — a coming-soon or hidden band still has
  // a position on the page, so ordering must not quietly filter either out.
  it('keeps coming-soon and hidden bands in the ordered list', () => {
    const sections = [
      { kind: 'gallery', order: 2, comingSoon: true },
      { kind: 'hero', order: 1 },
      { kind: 'support', order: 3, draft: true },
    ];
    expect(orderedHomeSections(sections).map((s) => s.kind)).toEqual([
      'hero',
      'gallery',
      'support',
    ]);
  });

  // Ordering hands back a new array; the caller's list is collection data other
  // call sites read.
  it('does not mutate the input array', () => {
    const sections = [{ kind: 'board', order: 2 }, { kind: 'hero', order: 1 }];
    orderedHomeSections(sections);
    expect(sections.map((s) => s.kind)).toEqual(['board', 'hero']);
  });
});

describe('unknownHomeSectionKinds', () => {
  // De-duplicated and stable so the build warning names each typo once, in the
  // order an editor would find them.
  it('names each unrecognized kind once, in first-seen order', () => {
    const sections = [
      { kind: 'hero' },
      { kind: 'sponsors' },
      { kind: 'Board' },
      { kind: 'sponsors' },
    ];
    expect(unknownHomeSectionKinds(sections)).toEqual(['sponsors', 'Board']);
  });

  // The healthy state: a fully-valid set of bands produces no warning at all.
  it('reports nothing when every kind is known', () => {
    expect(unknownHomeSectionKinds(HOME_SECTION_KINDS.map((kind) => ({ kind })))).toEqual([]);
  });
});

describe('HOME_SECTION_LABELS', () => {
  // The placeholder always has a heading to show, whichever band was held back.
  it('names every band a placeholder can stand in for', () => {
    for (const kind of HOME_SECTION_KINDS) {
      expect(HOME_SECTION_LABELS[kind]).toBeTruthy();
    }
  });
});

describe('sectionAnchorId', () => {
  // The id a placeholder renders has to match the fragment the menu links to, or
  // the link scrolls nowhere.
  it('returns the fragment of the band anchor', () => {
    expect(sectionAnchorId('board')).toBe('board');
    expect(sectionAnchorId('hero')).toBe('about');
    expect(sectionAnchorId('whatsapp')).toBe('community');
  });

  // The anti-drift guarantee: the id is DERIVED from the anchor, so the two can
  // never disagree the way two hand-maintained tables would.
  it('agrees with the anchor table for every linked band', () => {
    for (const [kind, anchor] of Object.entries(HOME_SECTION_ANCHORS)) {
      expect(`/#${sectionAnchorId(kind)}`).toBe(anchor);
    }
  });

  // An `id` attribute that should not be rendered wants undefined, not ''.
  it('returns undefined for a band the menu cannot link to', () => {
    expect(sectionAnchorId('focus')).toBeUndefined();
    expect(sectionAnchorId('giving')).toBeUndefined();
  });

  // A typo'd kind must not produce a bare `#` id on an element nobody links to.
  it('returns undefined for a kind that is not a band at all', () => {
    expect(sectionAnchorId('sponsors')).toBeUndefined();
  });
});

describe('hiddenSectionAnchors', () => {
  // The pair that has to hold: hiding a band takes its menu item with it, so a
  // visitor can never follow a link to a section that is not on the page.
  it('reports the anchor of a hidden band', () => {
    const sections = HOME_SECTION_KINDS.map((kind) => ({ kind, draft: kind === 'board' }));
    expect(hiddenSectionAnchors(sections)).toEqual([HOME_SECTION_ANCHORS.board]);
  });

  // The whole difference between the two states: a coming-soon band is still on
  // the page, so its link still lands somewhere — on the placeholder.
  it('keeps the anchor of a coming-soon band', () => {
    const sections = HOME_SECTION_KINDS.map((kind) => ({ kind, comingSoon: kind === 'board' }));
    expect(hiddenSectionAnchors(sections)).toEqual([]);
  });

  // The healthy state: nothing hidden means no menu item is pruned.
  it('reports nothing when every band is shown', () => {
    expect(hiddenSectionAnchors(HOME_SECTION_KINDS.map((kind) => ({ kind })))).toEqual([]);
  });

  // A band nobody has an entry for is the same broken link as a hidden one. On
  // the public build a drafted band arrives here already filtered out by
  // `publishedEntries`, which is exactly this case.
  it('treats a band with no entry at all as gone', () => {
    expect(hiddenSectionAnchors([{ kind: 'hero' }])).toContain(HOME_SECTION_ANCHORS.board);
  });

  // Only bands the menu actually links to can go stale, so the result is exactly
  // the anchor table's size and carries no undefined holes.
  it('never reports an anchor for a band the menu cannot link to', () => {
    const anchors = hiddenSectionAnchors([]);
    expect(anchors).not.toContain(undefined);
    expect(anchors).toHaveLength(Object.keys(HOME_SECTION_ANCHORS).length);
  });
});

import { describe, it, expect } from 'vitest';
import {
  SECTION_KINDS,
  orderedSections,
  resolveLayout,
  tintedFlags,
  unknownSectionKinds,
} from './momentumSections';

describe('orderedSections', () => {
  // The headline guarantee: the Order field is what moves a section up or down,
  // which is the whole answer to "can I reorder this page?".
  it('sorts sections by their order field', () => {
    const sections = [
      { kind: 'testimonials', order: 5 },
      { kind: 'narrative', order: 1 },
      { kind: 'pillars', order: 4 },
    ];
    expect(orderedSections(sections).map((s) => s.kind)).toEqual([
      'narrative',
      'pillars',
      'testimonials',
    ]);
  });

  // A section an editor never numbered sorts LAST rather than jumping above the
  // numbered ones — adding a section must not silently reshuffle the page.
  it('sorts a section with no order after every ordered section', () => {
    const sections = [
      { kind: 'stats' },
      { kind: 'narrative', order: 2 },
      { kind: 'pillars', order: 1 },
    ];
    expect(orderedSections(sections).map((s) => s.kind)).toEqual([
      'pillars',
      'narrative',
      'stats',
    ]);
  });

  // `kind` is free text because the CMS has no select control, so a typo is a
  // normal editing mistake. It costs that one section, never the page.
  it('drops sections whose kind matches no renderer', () => {
    const sections = [
      { kind: 'narrative', order: 1 },
      { kind: 'narrrative', order: 2 },
      { kind: 'pillars', order: 3 },
    ];
    expect(orderedSections(sections).map((s) => s.kind)).toEqual(['narrative', 'pillars']);
  });

  // Every declared kind is renderable — this fails if SECTION_KINDS and the
  // filter ever drift apart.
  it('keeps every kind it declares support for', () => {
    const sections = SECTION_KINDS.map((kind, i) => ({ kind, order: i }));
    expect(orderedSections(sections)).toHaveLength(SECTION_KINDS.length);
  });

  // Non-mutating, like `sortByOrder` beneath it.
  it('returns a new array and leaves the source untouched', () => {
    const source = [
      { kind: 'pillars', order: 2 },
      { kind: 'narrative', order: 1 },
    ];
    const result = orderedSections(source);
    expect(result).not.toBe(source);
    expect(source.map((s) => s.kind)).toEqual(['pillars', 'narrative']);
  });

  // The empty collection renders an empty middle, not a crash — the state the
  // page is in before any section has been seeded.
  it('returns an empty array unchanged', () => {
    expect(orderedSections([])).toEqual([]);
  });
});

describe('unknownSectionKinds', () => {
  // The advisory the route warns with, so a dropped section is visible in the
  // build log rather than silently missing from the page.
  it('reports kinds that match no renderer', () => {
    const sections = [{ kind: 'narrative' }, { kind: 'gallery' }];
    expect(unknownSectionKinds(sections)).toEqual(['gallery']);
  });

  // One warning per typo, however many entries repeat it.
  it('de-duplicates a repeated unknown kind', () => {
    const sections = [{ kind: 'gallery' }, { kind: 'gallery' }, { kind: 'stats' }];
    expect(unknownSectionKinds(sections)).toEqual(['gallery']);
  });

  // A correct page warns about nothing — no noise in the normal build.
  it('reports nothing when every kind is known', () => {
    expect(unknownSectionKinds(SECTION_KINDS.map((kind) => ({ kind })))).toEqual([]);
  });
});

describe('tintedFlags', () => {
  // Consecutive prose sections need separating, so narratives alternate
  // tinted / untinted down the page.
  it('alternates the tint across narrative sections', () => {
    const flags = tintedFlags([
      { kind: 'narrative' },
      { kind: 'narrative' },
      { kind: 'narrative' },
    ]);
    expect(flags).toEqual([true, false, true]);
  });

  // The bespoke bands carry their own background, so they are never tinted by
  // this rule.
  it('never tints a non-narrative section', () => {
    const flags = tintedFlags([
      { kind: 'stats' },
      { kind: 'pillars' },
      { kind: 'testimonials' },
    ]);
    expect(flags).toEqual([false, false, false]);
  });

  // The counter advances only on narratives. A band sitting between two of them
  // must not flip the rhythm — otherwise an editor inserting the stats band
  // would invert the tint on every section below it.
  it('does not let an interleaved band shift the narrative alternation', () => {
    const flags = tintedFlags([
      { kind: 'narrative' },
      { kind: 'stats' },
      { kind: 'narrative' },
      { kind: 'pillars' },
      { kind: 'narrative' },
    ]);
    expect(flags).toEqual([true, false, false, false, true]);
  });

  // Order-independent and non-mutating: calling twice gives the same answer,
  // which the previous counter-mutating closure could not promise.
  it('returns the same flags when called repeatedly on the same input', () => {
    const sections = [{ kind: 'narrative' }, { kind: 'narrative' }];
    expect(tintedFlags(sections)).toEqual(tintedFlags(sections));
  });

  // One flag per section, so a caller can index straight into the result.
  it('returns one flag per section', () => {
    const sections = [{ kind: 'narrative' }, { kind: 'stats' }, { kind: 'pillars' }];
    expect(tintedFlags(sections)).toHaveLength(sections.length);
  });

  // The empty middle renders nothing at all.
  it('returns an empty array unchanged', () => {
    expect(tintedFlags([])).toEqual([]);
  });
});

describe('resolveLayout', () => {
  // The two layouts Nicole asked for, passed through unchanged.
  it('passes through the image layouts', () => {
    expect(resolveLayout('image-left')).toBe('image-left');
    expect(resolveLayout('image-right')).toBe('image-right');
    expect(resolveLayout('text-only')).toBe('text-only');
  });

  // A blank or absent field is the CMS's normal "not filled in" state.
  it('falls back to text-only for an absent or blank value', () => {
    expect(resolveLayout(undefined)).toBe('text-only');
    expect(resolveLayout('')).toBe('text-only');
    expect(resolveLayout('   ')).toBe('text-only');
  });

  // A typo degrades to readable full-width prose, never an empty column.
  it('falls back to text-only for an unrecognized value', () => {
    expect(resolveLayout('image-middle')).toBe('text-only');
  });

  // Editors type into a free-text box, so casing and stray spaces are expected.
  it('normalizes casing and surrounding whitespace', () => {
    expect(resolveLayout('  Image-Left ')).toBe('image-left');
    expect(resolveLayout('IMAGE-RIGHT')).toBe('image-right');
  });
});

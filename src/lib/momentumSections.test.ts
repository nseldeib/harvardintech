import { describe, it, expect } from 'vitest';
import {
  SECTION_KINDS,
  goalMetersMissingWidgetId,
  orderedSections,
  resolveLayout,
  sectionHeading,
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

  // The CMS renders `kind` as a select, but the schema stays free text, so a
  // stray value can still arrive from a hand-edited file or a scenario seed. It
  // costs that one section, never the page.
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

describe('goalMetersMissingWidgetId', () => {
  // The advisory that makes a silent state diagnosable: a goal meter with no
  // widget id renders nothing, so without the slug in the log an editor cannot
  // tell a deliberately-blank band from one they forgot to finish.
  it('reports the slug of a goal meter carrying no widget id', () => {
    const sections = [
      { slug: 'why', kind: 'narrative' },
      { slug: 'progress', kind: 'goal-meter' },
    ];
    expect(goalMetersMissingWidgetId(sections)).toEqual(['progress']);
  });

  // A finished meter is not a mistake — the normal build must stay quiet.
  it('reports nothing when the goal meter has a widget id', () => {
    const sections = [{ slug: 'progress', kind: 'goal-meter', widgetId: 'MRDbEz' }];
    expect(goalMetersMissingWidgetId(sections)).toEqual([]);
  });

  // Blank and whitespace-only match what the component does with them — both
  // render nothing — so both have to earn the same warning. A meter whose id was
  // cleared, or spacebarred, is exactly the case this advisory exists for.
  it('treats an empty or whitespace-only widget id as missing', () => {
    const sections = [
      { slug: 'blank', kind: 'goal-meter', widgetId: '' },
      { slug: 'spaces', kind: 'goal-meter', widgetId: '   ' },
    ];
    expect(goalMetersMissingWidgetId(sections)).toEqual(['blank', 'spaces']);
  });

  // The field is goal-meter-specific. Every other kind ignores it, so a section
  // that happens to carry no widget id is not a problem and must not be named.
  it('ignores sections of every other kind', () => {
    const sections = [
      { slug: 'why', kind: 'narrative' },
      { slug: 'stats', kind: 'stats' },
      { slug: 'donors', kind: 'donors' },
    ];
    expect(goalMetersMissingWidgetId(sections)).toEqual([]);
  });

  // Every offender gets named, not just the first — an editor fixing one should
  // not have to rebuild to discover the next.
  it('reports every offending meter on a page with more than one', () => {
    const sections = [
      { slug: 'first', kind: 'goal-meter' },
      { slug: 'ok', kind: 'goal-meter', widgetId: 'MRDbEz' },
      { slug: 'second', kind: 'goal-meter' },
    ];
    expect(goalMetersMissingWidgetId(sections)).toEqual(['first', 'second']);
  });

  // A page with no sections at all warns about nothing.
  it('reports nothing for an empty section list', () => {
    expect(goalMetersMissingWidgetId([])).toEqual([]);
  });

  // Sections reach this from a content collection, where the slug is the
  // filename and always present — but the type allows its absence, and a
  // warning naming "undefined" would be worse than useless.
  it('falls back to a readable label when a section has no slug', () => {
    expect(goalMetersMissingWidgetId([{ kind: 'goal-meter' }])).toEqual(['(unnamed section)']);
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

  // The goal meter is the newest interleaved band, and it carries its own
  // paper-2 background like the others — so dropping a meter between two
  // narratives must leave the prose rhythm below it exactly as it was.
  it('does not let a goal meter shift the narrative alternation', () => {
    const flags = tintedFlags([
      { kind: 'narrative' },
      { kind: 'goal-meter' },
      { kind: 'narrative' },
    ]);
    expect(flags).toEqual([true, false, false]);
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

describe('sectionHeading', () => {
  // The reason this exists: the slot bands took their heading from
  // donatePage.json and ignored the title they could already carry, so two
  // pillars sections were indistinguishable on the page AND in the CMS list,
  // where the row label falls back to the slug. Letting a section use its own
  // title is what names a duplicated band.
  it('prefers the section title over the shared fallback heading', () => {
    expect(
      sectionHeading({ title: 'How Your Support Will Be Used' }, 'What Your Gift Powers'),
    ).toBe('How Your Support Will Be Used');
  });

  // An untouched section renders exactly as it did before this change, which is
  // what lets the feature ship with no content migration.
  it('falls back to the shared heading when the section has no title', () => {
    expect(sectionHeading({}, 'What Your Gift Powers')).toBe('What Your Gift Powers');
    expect(sectionHeading({ title: undefined }, 'What Your Gift Powers')).toBe(
      'What Your Gift Powers',
    );
  });

  // Whitespace-only is the CMS's blank, matching every other free-text field on
  // this page — an editor who cleared the box wants the standard heading back.
  it('treats a blank or whitespace-only title as absent', () => {
    expect(sectionHeading({ title: '' }, 'What Your Gift Powers')).toBe('What Your Gift Powers');
    expect(sectionHeading({ title: '   ' }, 'What Your Gift Powers')).toBe('What Your Gift Powers');
  });

  // A real title is passed through as written rather than reformatted.
  it('passes a titled heading through unchanged', () => {
    expect(sectionHeading({ title: 'Why Support Harvard in Tech?' })).toBe(
      'Why Support Harvard in Tech?',
    );
  });

  // Nothing on either side yields undefined, not the string "undefined" — the
  // band components already treat a missing heading as draw-no-heading.
  it('yields undefined when there is neither a title nor a fallback', () => {
    expect(sectionHeading({})).toBeUndefined();
    expect(sectionHeading({ title: '  ' })).toBeUndefined();
  });
});

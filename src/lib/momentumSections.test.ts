import { describe, it, expect } from 'vitest';
import {
  KINDS_WITH_BODY,
  SECTION_KINDS,
  campaignLink,
  giftOrdinal,
  goalMetersMissingWidgetId,
  orderedSections,
  resolveLayout,
  sectionHeading,
  sectionKicker,
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

  // The mission band survives the known-kinds filter. A kind the component
  // renders but this list does not know would be dropped before it ever
  // reached the page — silently, and only in the real build.
  it('keeps a mission section', () => {
    const sections = [
      { kind: 'mission', order: 1 },
      { kind: 'narrative', order: 2 },
    ];
    expect(orderedSections(sections).map((s) => s.kind)).toEqual(['mission', 'narrative']);
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

  // The mission band is a real kind, not an unrecognized one. A new kind that
  // reached only the component and not this list would be DROPPED from the page
  // and warned about — the exact silent failure this guards.
  it('does not report the mission kind', () => {
    expect(unknownSectionKinds([{ kind: 'mission' }])).toEqual([]);
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

  // The mission band paints its own gold ground, so it is never tinted — and,
  // more importantly, it must not advance the counter. A new kind that flipped
  // the tint on every narrative below it is the regression a kind addition can
  // silently cause, and it would move the background of half the page.
  it('is unchanged by a mission band sitting between two narratives', () => {
    const flags = tintedFlags([
      { kind: 'narrative' },
      { kind: 'mission' },
      { kind: 'narrative' },
    ]);
    expect(flags).toEqual([true, false, false]);
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

  // The campaign design's two-column prose treatment. An ADDITION to the list,
  // not a new renderer — which is why it needs no change to this function.
  it('passes through the columns layout', () => {
    expect(resolveLayout('columns')).toBe('columns');
    expect(resolveLayout(' Columns ')).toBe('columns');
  });

  // And a typo OF the new value degrades like any other, rather than rendering
  // a band with two empty columns.
  it('falls back to text-only for a typo of columns', () => {
    expect(resolveLayout('column')).toBe('text-only');
    expect(resolveLayout('two-columns')).toBe('text-only');
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

describe('sectionKicker', () => {
  // The field applies to EVERY kind, unlike layout/image/widgetId, because the
  // campaign design puts an eyebrow over every band on the page.
  it('returns the trimmed kicker', () => {
    expect(sectionKicker({ kicker: '  What your gift powers  ' })).toBe('What your gift powers');
  });

  // Blank means draw nothing — the band as it looked before the field existed.
  // Deliberately NOT borrowing a per-kind label the way sectionHeading does:
  // there is no shared eyebrow to fall back to.
  it('yields undefined for an absent or whitespace-only kicker', () => {
    expect(sectionKicker({})).toBeUndefined();
    expect(sectionKicker({ kicker: '' })).toBeUndefined();
    expect(sectionKicker({ kicker: '   ' })).toBeUndefined();
  });

  // A caller that DOES have something to fall back to can still supply it —
  // the network band passes the campaign name, which is what it drew before.
  it('uses the caller fallback when the kicker is blank', () => {
    expect(sectionKicker({ kicker: '  ' }, 'The Momentum Fund')).toBe('The Momentum Fund');
    expect(sectionKicker({ kicker: 'Our mission' }, 'The Momentum Fund')).toBe('Our mission');
  });
});

describe('campaignLink', () => {
  // The ordinary case: both boxes filled draws the link beside the heading.
  it('returns the trimmed label and url when both are present', () => {
    expect(campaignLink({ linkLabel: ' View the campaign ', linkUrl: ' https://x.test/c ' })).toEqual(
      { label: 'View the campaign', url: 'https://x.test/c' },
    );
  });

  // The rule the goal-meter entry documents to the editor: a label alone draws
  // NOTHING, because a link that goes nowhere is worse than no link. This is
  // the shipped state — goal-meter.md carries the label with a blank url.
  it('draws nothing when the url is missing or blank', () => {
    expect(campaignLink({ linkLabel: 'View the campaign' })).toBeUndefined();
    expect(campaignLink({ linkLabel: 'View the campaign', linkUrl: '   ' })).toBeUndefined();
  });

  // And the mirror: a url with no label has nothing to click.
  it('draws nothing when the label is missing or blank', () => {
    expect(campaignLink({ linkUrl: 'https://x.test/c' })).toBeUndefined();
    expect(campaignLink({ linkLabel: '  ', linkUrl: 'https://x.test/c' })).toBeUndefined();
  });

  // Neither box filled is the band as it renders today.
  it('draws nothing when neither is set', () => {
    expect(campaignLink({})).toBeUndefined();
  });
});

describe('giftOrdinal', () => {
  // Zero-padded to two digits, matching the campaign design's 01 / 02 / 03.
  it('numbers from 01 for the first card', () => {
    expect(giftOrdinal(0)).toBe('01');
    expect(giftOrdinal(1)).toBe('02');
    expect(giftOrdinal(2)).toBe('03');
  });

  // The point of the function: the index is the card's position WITHIN ITS
  // BAND, so a duplicated grouped band restarts at 01 rather than continuing
  // at 04. Passing 0 again is exactly what the second band does.
  it('restarts at 01 for a second band rather than continuing a running count', () => {
    expect(giftOrdinal(0)).toBe('01');
  });

  // Past ninety-nine it grows a digit rather than truncating — the page would
  // be absurd long before this, but dropping a leading digit would be worse.
  it('grows to three digits rather than truncating', () => {
    expect(giftOrdinal(99)).toBe('100');
  });
});

describe('KINDS_WITH_BODY', () => {
  // The kinds whose markdown body is rendered onto the page. `mission` and
  // `testimonials` joined `narrative` when the campaign design gave them prose
  // of their own — a fact about the kinds, so it lives beside them.
  it('contains exactly the kinds that render prose', () => {
    expect([...KINDS_WITH_BODY].sort()).toEqual(['mission', 'narrative', 'testimonials']);
  });

  // The remaining bands still draw every word from donatePage.json and their
  // own collections, so their entry body stays an editing note that never
  // reaches the page. Regressing this would publish those notes to visitors.
  it('excludes the slot bands whose entry body is an editing note', () => {
    for (const kind of ['goal-meter', 'accomplishments', 'pillars', 'donors', 'stats']) {
      expect(KINDS_WITH_BODY.has(kind)).toBe(false);
    }
  });
});

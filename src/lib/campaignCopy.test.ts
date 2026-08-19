import { describe, it, expect } from 'vitest';
import { emphasizedHeading, splitParagraphs } from './campaignCopy';

describe('emphasizedHeading', () => {
  // The headline case: the campaign design accents the tail of the mission
  // band's sentence, and an editor writes that accent as markdown emphasis.
  it('splits a heading around its emphasized clause', () => {
    expect(emphasizedHeading('Helping exceptional people *go further together.*')).toEqual({
      head: 'Helping exceptional people ',
      accent: 'go further together.',
      tail: '',
    });
  });

  // The accent is not required to be the tail — an editor can put it anywhere,
  // and the text on BOTH sides has to survive.
  it('keeps the text on both sides of a mid-sentence accent', () => {
    expect(emphasizedHeading('We are at a *turning point* this year.')).toEqual({
      head: 'We are at a ',
      accent: 'turning point',
      tail: ' this year.',
    });
  });

  // A heading with no emphasis is the ordinary case — every other band's
  // heading — and must render whole and unstyled.
  it('returns the whole heading as head when there is no marker', () => {
    expect(emphasizedHeading('Momentum already exists.')).toEqual({
      head: 'Momentum already exists.',
    });
  });

  // The floor that matters most. A half-typed marker must NOT leak an asterisk
  // onto the page's largest sentence — no accent is better than a stray glyph.
  it('degrades to a plain heading when the marker is never closed', () => {
    expect(emphasizedHeading('Helping people *go further')).toEqual({
      head: 'Helping people *go further',
    });
  });

  // Same floor from the other direction: `**` has nothing between the markers,
  // so it must not produce an empty accent element.
  it('degrades to a plain heading on an empty marker pair', () => {
    expect(emphasizedHeading('Nothing ** here')).toEqual({ head: 'Nothing ** here' });
  });

  // Only the FIRST pair is honoured — this is one deliberate affordance, not a
  // second markdown implementation, and the later asterisks stay as typed.
  it('honours only the first marker pair', () => {
    expect(emphasizedHeading('One *two* three *four*')).toEqual({
      head: 'One ',
      accent: 'two',
      tail: ' three *four*',
    });
  });

  // No heading means draw no heading, matching `sectionHeading` — `undefined`
  // rather than an object the component would have to unpack to find nothing.
  it('returns undefined for a missing or empty heading', () => {
    expect(emphasizedHeading(undefined)).toBeUndefined();
    expect(emphasizedHeading('')).toBeUndefined();
  });
});

describe('splitParagraphs', () => {
  // The reason `ctaBody` is ONE field: two sentences separated by a blank line
  // become two paragraphs with no second schema field to leave half-filled.
  it('splits a body on blank lines into paragraphs', () => {
    expect(splitParagraphs('First paragraph.\n\nSecond paragraph.')).toEqual([
      'First paragraph.',
      'Second paragraph.',
    ]);
  });

  // A body with no blank line is a single paragraph — exactly what this band
  // rendered before the field could hold two.
  it('returns a body with no blank line as one paragraph', () => {
    expect(splitParagraphs('Just the one.')).toEqual(['Just the one.']);
  });

  // A single newline is a soft wrap in a textarea, not a paragraph break;
  // treating it as one would shatter wrapped prose into fragments.
  it('does not split on a single newline', () => {
    expect(splitParagraphs('A wrapped\nsentence.')).toEqual(['A wrapped\nsentence.']);
  });

  // The trailing newline a textarea leaves behind must not render an empty
  // paragraph — that shows up on the page as an unexplained gap.
  it('drops the empty trailing entry a textarea leaves behind', () => {
    expect(splitParagraphs('Only paragraph.\n\n')).toEqual(['Only paragraph.']);
  });

  // Same rule for a doubled blank line, and each paragraph is trimmed so
  // indentation an editor pasted in does not survive into the markup.
  it('collapses extra blank lines and trims each paragraph', () => {
    expect(splitParagraphs('  First.  \n\n\n\n   Second.   ')).toEqual(['First.', 'Second.']);
  });

  // A body that is only whitespace has no paragraphs at all, so the band draws
  // its heading and button with no stranded empty prose block.
  it('returns no paragraphs for a blank or missing body', () => {
    expect(splitParagraphs('   \n\n  ')).toEqual([]);
    expect(splitParagraphs('')).toEqual([]);
    expect(splitParagraphs(undefined)).toEqual([]);
  });
});

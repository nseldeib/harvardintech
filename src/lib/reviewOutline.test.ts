import { describe, expect, it } from 'vitest';
import outline from './reviewOutline.js';

/* Stands in for `window.HIT_VARIATIONS`, in the same shape variations.js uses:
 * a numeric `num`, a display `name`, and a `family` marking the off-brief pair. */
const directions = [
  { num: 1, name: 'Powering the Harvard Alumni in Tech Network', family: 'network' },
  { num: 2, name: 'The Word', family: 'network' },
  { num: 8, name: 'The Names', family: 'off-brief' },
  { num: 9, name: 'Who Showed Up', family: 'off-brief' },
];

describe('directionLabel', () => {
  // The bug this function exists for: variations.js carries `num` as a number,
  // so the card badge rendered "3" while everything else on the page said "03".
  it('pads a single digit so the card matches what the reviewer types', () => {
    expect(outline.directionLabel(1)).toBe('01');
    expect(outline.directionLabel(9)).toBe('09');
  });

  // Padding must not corrupt an id that is already two digits, which is what a
  // tenth direction would be.
  it('leaves a two-digit id alone', () => {
    expect(outline.directionLabel(10)).toBe('10');
    expect(outline.directionLabel(12)).toBe('12');
  });

  // The page hands it whatever the data carries; a numeric string is the likely
  // shape if the fixture is ever authored by hand.
  it('accepts a numeric string', () => {
    expect(outline.directionLabel('3')).toBe('03');
  });

  // A wrong id is worse than a missing one — it points a reviewer's comment at
  // the wrong design.
  it('returns nothing for a value that is not a number', () => {
    expect(outline.directionLabel('none')).toBe('');
    expect(outline.directionLabel(undefined)).toBe('');
    expect(outline.directionLabel(null)).toBe('');
  });
});

describe('reviewOutline', () => {
  // The load-bearing property. The outline IS the feedback interface, so an id
  // shown on the page but absent here is a reaction that has nowhere to land.
  it('names every wall behaviour the page shows', () => {
    const text = outline.reviewOutline(directions);
    outline.WALL_ITEMS.forEach((item: { id: string }) => {
      expect(text).toContain(item.id);
    });
  });

  // Same requirement as the wall items: an id on the page with no line in the
  // outline is a reaction with nowhere to go.
  it('names every open question and every import step', () => {
    const text = outline.reviewOutline(directions);
    [...outline.QUESTION_ITEMS, ...outline.IMPORT_ITEMS].forEach((item: { id: string }) => {
      expect(text).toContain(item.id);
    });
  });

  // Built from the live list rather than a hand-copied one: rename a direction
  // in variations.js and the outline follows, instead of quietly asking the
  // reviewer about a design by a name it no longer has.
  it('takes the direction names from the list it is given', () => {
    const text = outline.reviewOutline(directions);
    expect(text).toContain('01  Powering the Harvard Alumni in Tech Network');
    expect(text).toContain('02  The Word');
  });

  // The two controls exist to test the network metaphor rather than to compete
  // with it, so a reviewer has to be able to tell them apart from the seven.
  it('marks the off-brief controls as controls', () => {
    const text = outline.reviewOutline(directions);
    expect(text).toContain('08  The Names [off-brief control]');
    expect(text).toContain('09  Who Showed Up [off-brief control]');
  });

  // The reviewer pastes this into a document, where trailing spaces survive as
  // invisible junk that shows up when they select a line.
  it('leaves no trailing whitespace on any line', () => {
    const text = outline.reviewOutline(directions);
    text.split('\n').forEach((line: string) => {
      expect(line).toBe(line.replace(/\s+$/, ''));
    });
  });

  // Degrades to a usable outline rather than throwing, so a page that failed to
  // load its variations still gives the reviewer the wall and the questions.
  it('still produces the fixed sections when given no directions', () => {
    const text = outline.reviewOutline([]);
    expect(text).toContain('W1');
    expect(text).toContain('Q4');
    expect(text).toContain('ANYTHING ELSE');
    expect(outline.reviewOutline(undefined)).toContain('W1');
  });
});

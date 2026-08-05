import { describe, expect, it } from 'vitest';
import rules from './donorNetwork.js';

const named = { name: 'Priya Raman', anonymous: false };
const anon = { name: 'Robert K. Whitmore', anonymous: true };

describe('the anonymity contract', () => {
  // The standing label replaces a withheld name everywhere a supporter is
  // rendered, so no surface can publish a name against an explicit request.
  it('prints the standing label instead of a withheld name', () => {
    expect(rules.displayName(named)).toBe('Priya Raman');
    expect(rules.displayName(anon)).toBe('Anonymous supporter');
  });

  // A search box is a new way to undo anonymity that the old donor wall never
  // had: typing a withheld name must not find its owner, even though their
  // node is on the page and counted.
  it('keeps an anonymous supporter out of search results', () => {
    expect(rules.isSearchable(named)).toBe(true);
    expect(rules.isSearchable(anon)).toBe(false);
  });

  // Initials leak the withheld name: "RKW" beside "Anonymous supporter" names
  // them to anyone who knows them, so the anonymous case gets a mark that
  // identifies nobody.
  it('does not leak the withheld name through initials', () => {
    expect(rules.supporterMonogram(named)).toBe('PR');
    expect(rules.supporterMonogram(anon)).toBe('—');
  });

  // Capped at two letters — an avatar that expanded to every initial would
  // spell out a long name rather than abbreviate it.
  it('takes at most two initials, so a long name cannot spell itself out', () => {
    expect(rules.supporterMonogram({ name: 'Maria del Carmen Vargas Ibarra' })).toBe('MD');
  });

  // Names arrive from a bi-weekly spreadsheet upload, where padding and double
  // spaces are normal; they must not produce a blank or malformed monogram.
  it('tolerates the extra whitespace a spreadsheet upload arrives with', () => {
    expect(rules.supporterMonogram({ name: '  Kwame   Boateng ' })).toBe('KB');
  });
});

describe('milestoneCrossed', () => {
  const M = [50, 100, 150, 200];

  // The regression this exists for: the growth step accelerates with the
  // count, so an equality check fired only when the arithmetic happened to
  // land exactly on a milestone. In practice 50/100/150 never showed.
  it('reports a milestone that was stepped over, not just landed on', () => {
    expect(rules.milestoneCrossed(47, 52, M)).toBe(50);
    expect(rules.milestoneCrossed(96, 104, M)).toBe(100);
  });

  // The exact-landing case still has to work — it is the one the old
  // equality check got right, and it must not regress in the other direction.
  it('still reports an exact landing', () => {
    expect(rules.milestoneCrossed(49, 50, M)).toBe(50);
  });

  // Most frames cross nothing; returning a milestone on those would fire the
  // celebration continuously through the whole animation.
  it('reports nothing when the step stays between milestones', () => {
    expect(rules.milestoneCrossed(51, 60, M)).toBeNull();
  });

  // A jump from 40 to 160 passes three milestones. Announcing 150 would skip
  // two moments the campaign wants to mark, so the earliest wins and the
  // caller snaps the count back to it.
  it('reports the lowest milestone when a single step clears several', () => {
    expect(rules.milestoneCrossed(40, 160, M)).toBe(50);
  });

  // A milestone already behind the count must not re-fire, or the animation
  // would celebrate 50 again on every subsequent frame.
  it('does not re-report a milestone already behind the count', () => {
    expect(rules.milestoneCrossed(50, 60, M)).toBeNull();
  });
});

describe('thin', () => {
  // Taking the first four would fill the top of one letterform and leave the
  // rest of the word empty, because the glyph sampler emits points in scan
  // order rather than spread across the glyphs.
  it('spreads the selection across the whole input', () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    expect(rules.thin(items, 4)).toEqual([0, 25, 50, 75]);
  });

  // Early on there are fewer supporters than sample points; everyone must
  // still be placed rather than the list being truncated.
  it('returns everything when asked for more than it has', () => {
    expect(rules.thin([1, 2, 3], 10)).toEqual([1, 2, 3]);
  });

  // Production starts empty and stays empty until the first upload, so a zero
  // count is the state the page ships in, not an edge case.
  it('returns nothing for the day-one empty state', () => {
    expect(rules.thin([1, 2, 3], 0)).toEqual([]);
  });

  // Returns a copy: the sampled point list is reused across re-renders, and a
  // caller mutating it would corrupt every later layout.
  it('copies rather than aliasing, so a caller cannot mutate the source', () => {
    const src = [1, 2, 3];
    rules.thin(src, 5).push(4);
    expect(src).toEqual([1, 2, 3]);
  });
});

describe('rng', () => {
  // Determinism is the point: a network that reshuffles between renders reads
  // as a different design, so a reviewer would be rating noise and a
  // screenshot they already commented on would stop matching the page.
  it('gives the same sequence for the same seed', () => {
    const a = rules.rng(11);
    const b = rules.rng(11);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  // Each direction seeds its own layout, so different seeds must actually
  // diverge or every direction would scatter its nodes identically.
  it('gives different sequences for different seeds', () => {
    expect(rules.rng(11)()).not.toBe(rules.rng(12)());
  });

  // Layouts multiply this by canvas dimensions, so a value outside the unit
  // range would place a supporter off-canvas.
  it('stays at or above zero and below one', () => {
    const r = rules.rng(7);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('shortSchool', () => {
  // The full school names do not fit the labels the layouts have room for.
  it('shortens the schools the upload uses', () => {
    expect(rules.shortSchool('Harvard Business School')).toBe('HBS');
    expect(rules.shortSchool('Harvard College')).toBe('College');
  });

  // An editor typo, or a school nobody has mapped yet, must still reach the
  // page — a blank label loses the supporter's affiliation silently.
  it('passes an unrecognized school through rather than dropping it', () => {
    expect(rules.shortSchool('Harvard Divinity School')).toBe('Harvard Divinity School');
  });
});

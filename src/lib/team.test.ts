import { describe, it, expect } from 'vitest';
import { initials, sortBoardMembers, splitRole, type BoardMemberLike } from './team';

describe('initials', () => {
  // takes the first letter of the first two words, upper-cased
  it('returns two-letter initials for a two-word name', () => {
    expect(initials('Krysia Lenzo')).toBe('KL');
  });

  // a single-word name yields a single initial
  it('returns one letter for a single-word name', () => {
    expect(initials('Madonna')).toBe('M');
  });

  // only the first two words count, even for longer names
  it('uses only the first two words for a three-word name', () => {
    expect(initials('Mary Jane Watson')).toBe('MJ');
  });

  // already-uppercase input stays uppercase
  it('upper-cases lowercase names', () => {
    expect(initials('ben wei')).toBe('BW');
  });

  // collapses extra whitespace rather than emitting blank initials
  it('ignores surrounding and repeated whitespace', () => {
    expect(initials('  Peter   Boyce  ')).toBe('PB');
  });

  // empty input has no initials
  it('returns an empty string for an empty name', () => {
    expect(initials('')).toBe('');
  });
});

describe('sortBoardMembers', () => {
  const make = (name: string, order?: number): BoardMemberLike => ({ name, role: 'r', order });

  // ascending by order field
  it('orders members by ascending order value', () => {
    const sorted = sortBoardMembers([make('C', 3), make('A', 1), make('B', 2)]);
    expect(sorted.map((m) => m.name)).toEqual(['A', 'B', 'C']);
  });

  // members without an order are treated as 0 and sort first
  it('treats a missing order as zero', () => {
    const sorted = sortBoardMembers([make('hasOrder', 2), make('noOrder')]);
    expect(sorted.map((m) => m.name)).toEqual(['noOrder', 'hasOrder']);
  });

  // does not mutate the caller's array
  it('returns a new array without mutating the input', () => {
    const input = [make('B', 2), make('A', 1)];
    const sorted = sortBoardMembers(input);
    expect(input.map((m) => m.name)).toEqual(['B', 'A']);
    expect(sorted).not.toBe(input);
  });

  // an empty list stays empty
  it('returns an empty array for no members', () => {
    expect(sortBoardMembers([])).toEqual([]);
  });
});

describe('splitRole', () => {
  // a role with a separator splits into title and Harvard class lines
  it('splits a role on the middot into two lines', () => {
    expect(splitRole("Founder · Harvard C'08")).toEqual(['Founder', "Harvard C'08"]);
  });

  // surrounding whitespace around the separator is trimmed
  it('trims whitespace around the separator', () => {
    expect(splitRole('Founder·Harvard')).toEqual(['Founder', 'Harvard']);
    expect(splitRole('Founder    ·    Harvard')).toEqual(['Founder', 'Harvard']);
  });

  // a role with no separator renders on a single line
  it('returns a single-element array when there is no separator', () => {
    expect(splitRole('Executive Director')).toEqual(['Executive Director']);
  });

  // more than one separator yields more than two lines
  it('splits every occurrence of the separator', () => {
    expect(splitRole('A · B · C')).toEqual(['A', 'B', 'C']);
  });

  // an empty role yields a single empty line, never throws
  it('returns a single empty string for an empty role', () => {
    expect(splitRole('')).toEqual(['']);
  });
});

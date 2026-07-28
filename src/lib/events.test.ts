import { describe, it, expect } from 'vitest';
import { toEventDate, formatEventDate, splitEvents, unmatchedChapterTags } from './events';

describe('toEventDate', () => {
  // A Date instance passes through unchanged.
  it('returns a Date instance unchanged', () => {
    const d = new Date('2026-09-24T00:00:00Z');
    expect(toEventDate(d)).toBe(d);
  });

  // An ISO date string is parsed into a Date.
  it('parses an ISO date string into a Date', () => {
    const result = toEventDate('2026-09-24T00:00:00Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.valueOf()).toBe(new Date('2026-09-24T00:00:00Z').valueOf());
  });
});

describe('formatEventDate', () => {
  // A UTC-midnight ISO string formats to a long en-US date.
  it('formats an ISO date as Month D, YYYY', () => {
    expect(formatEventDate('2026-09-24T12:00:00Z')).toBe('September 24, 2026');
  });

  // A Date instance formats the same way as the equivalent string.
  it('formats a Date instance the same as its ISO string', () => {
    const d = new Date('2026-01-05T12:00:00Z');
    expect(formatEventDate(d)).toBe('January 5, 2026');
  });

  // Single-digit days are not zero-padded.
  it('does not zero-pad single-digit days', () => {
    expect(formatEventDate('2026-03-01T12:00:00Z')).toBe('March 1, 2026');
  });
});

describe('splitEvents', () => {
  const events = [
    { title: 'Summit', date: '2026-09-24T12:00:00Z' },
    { title: 'Mixer', date: '2026-07-15T12:00:00Z' },
    { title: 'Spring Dinner', date: '2026-03-12T12:00:00Z' },
    { title: 'Winter Panel', date: '2026-01-10T12:00:00Z' },
  ];

  // Events on or after `now` are upcoming, sorted soonest first.
  it('returns upcoming events sorted soonest first', () => {
    const { upcoming } = splitEvents(events, '2026-06-13T00:00:00Z');
    expect(upcoming.map((e) => e.title)).toEqual(['Mixer', 'Summit']);
  });

  // Events before `now` are past, sorted most recent first.
  it('returns past events sorted most recent first', () => {
    const { past } = splitEvents(events, '2026-06-13T00:00:00Z');
    expect(past.map((e) => e.title)).toEqual(['Spring Dinner', 'Winter Panel']);
  });

  // An empty input yields empty upcoming and past lists.
  it('handles an empty event list', () => {
    expect(splitEvents([], '2026-06-13T00:00:00Z')).toEqual({ upcoming: [], past: [] });
  });

  // An event exactly at `now` counts as upcoming, not past.
  it('treats an event exactly at now as upcoming', () => {
    const same = [{ title: 'Now', date: '2026-06-13T00:00:00Z' }];
    const { upcoming, past } = splitEvents(same, '2026-06-13T00:00:00Z');
    expect(upcoming.map((e) => e.title)).toEqual(['Now']);
    expect(past).toEqual([]);
  });

  // When every event is in the future, past is empty.
  it('returns no past events when all are upcoming', () => {
    const { upcoming, past } = splitEvents(events, '2026-01-01T00:00:00Z');
    expect(upcoming).toHaveLength(4);
    expect(past).toHaveLength(0);
  });

  // The original input array is not mutated by sorting.
  it('does not mutate the input array order', () => {
    const input = [...events];
    splitEvents(input, '2026-06-13T00:00:00Z');
    expect(input.map((e) => e.title)).toEqual(['Summit', 'Mixer', 'Spring Dinner', 'Winter Panel']);
  });
});

describe('unmatchedChapterTags', () => {
  // An event tagged with a chapter's display name instead of its slug matches no
  // chapter and vanishes from every chapter page — previously with no signal at all.
  it('names a chapter tag that matches no chapter', () => {
    const events = [
      { title: 'NYC Panel', date: '2026-09-01', chapter: 'New York City' },
      { title: 'London Meetup', date: '2026-09-02', chapter: 'london' },
      { title: 'Open Call', date: '2026-09-03' },
    ];

    expect(unmatchedChapterTags(events, ['nyc', 'london'])).toEqual(['New York City']);
  });

  // The healthy state: every tag matches a chapter, so there is nothing to report.
  it('reports nothing when every tag matches a chapter', () => {
    const events = [
      { title: 'London Meetup', date: '2026-09-02', chapter: 'london' },
      { title: 'Boston Panel', date: '2026-09-03', chapter: 'boston-cambridge' },
    ];

    expect(unmatchedChapterTags(events, ['nyc', 'london', 'boston-cambridge'])).toEqual([]);
  });

  // A trailing space is invisible in the CMS text box but breaks the exact match.
  it('catches a tag that differs only by whitespace', () => {
    const events = [{ title: 'Mixer', date: '2026-09-04', chapter: 'london ' }];

    expect(unmatchedChapterTags(events, ['london'])).toEqual(['london ']);
  });

  // The same typo across several events is named once, in first-seen order.
  it('reports each distinct tag once, in first-seen order', () => {
    const events = [
      { title: 'Second', date: '2026-09-05', chapter: 'Seattle' },
      { title: 'Third', date: '2026-09-06', chapter: 'DC' },
      { title: 'Fourth', date: '2026-09-07', chapter: 'Seattle' },
    ];

    expect(unmatchedChapterTags(events, ['seattle', 'dc-dmv'])).toEqual(['Seattle', 'DC']);
  });

  // A blank tag reads as untagged, not as a mistake worth naming.
  it('treats a blank tag as untagged', () => {
    const events = [
      { title: 'Blank', date: '2026-09-08', chapter: '' },
      { title: 'Spaces', date: '2026-09-09', chapter: '   ' },
    ];

    expect(unmatchedChapterTags(events, ['london'])).toEqual([]);
  });

  // One degenerate edge: nothing to inspect can never report a mismatch.
  it('handles an empty event list', () => {
    expect(unmatchedChapterTags([], ['london'])).toEqual([]);
  });

  // The other degenerate edge, and the state this site launched in: with no
  // chapters published, every tag is unmatched.
  it('reports every tag when there are no chapters at all', () => {
    const events = [{ title: 'Orphan', date: '2026-09-10', chapter: 'london' }];

    expect(unmatchedChapterTags(events, [])).toEqual(['london']);
  });
});

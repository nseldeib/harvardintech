import { describe, it, expect } from 'vitest';
import { shortDate } from './cutoverFormat';

describe('shortDate', () => {
  // The ordinary case: a tick's stored timestamp becomes the caption beside the
  // GitHub login. Asserted on parts rather than one literal string because the
  // separator and order are locale-dependent and the test must not encode the
  // runner's locale as the requirement.
  it('renders a stored timestamp as a day and month', () => {
    const out = shortDate('2026-08-11T14:20:00Z');
    expect(out).toContain('11');
    expect(out).toContain('Aug');
  });

  // The year is deliberately omitted — the whole migration happens inside one
  // window, so a year only costs width in a cramped row.
  it('omits the year', () => {
    expect(shortDate('2026-08-11T14:20:00Z')).not.toContain('2026');
  });

  // The case the function exists for. `cutoverProgress.json` is committed and
  // hand-editable, so a mangled timestamp is reachable — and it must cost the
  // reader a missing date, not an "Invalid Date" string sitting on the page.
  it('returns an empty string for an unparseable value', () => {
    expect(shortDate('not a date')).toBe('');
  });

  // Same policy for an absent value. A record written before the field existed
  // parses to NaN the same way, and must not render either.
  it('returns an empty string for an empty value', () => {
    expect(shortDate('')).toBe('');
  });

  // A date-only string (no time) is still a legitimate ISO value someone might
  // type by hand into the JSON; it must format rather than fall through.
  it('accepts a date without a time component', () => {
    const out = shortDate('2026-12-01');
    expect(out).toContain('Dec');
    expect(out).not.toBe('');
  });
});

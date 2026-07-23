import { describe, it, expect } from 'vitest';
import {
  sanitizeFirstName,
  heroGreeting,
  nameFromSearch,
  MAX_NAME_LENGTH,
} from './personalize';

describe('sanitizeFirstName', () => {
  // The common case: a plain first name passes through unchanged.
  it('accepts an ordinary first name', () => {
    expect(sanitizeFirstName('Nicole')).toBe('Nicole');
  });

  // A merge field often holds the full name; the greeting keeps just the first.
  it('keeps only the first token when a full name is supplied', () => {
    expect(sanitizeFirstName('Nicole Eldeib')).toBe('Nicole');
  });

  // Padding and newlines from a merge field are collapsed away.
  it('trims and collapses whitespace from a merge field', () => {
    expect(sanitizeFirstName('  Nadia \n ')).toBe('Nadia');
  });

  // Real names carry accents, hyphens, and apostrophes — all accepted.
  it('accepts names with accents, hyphens, and apostrophes', () => {
    expect(sanitizeFirstName('José')).toBe('José');
    expect(sanitizeFirstName('Anne-Marie')).toBe('Anne-Marie');
    expect(sanitizeFirstName("O'Brien")).toBe("O'Brien");
    expect(sanitizeFirstName('O’Brien')).toBe('O’Brien');
  });

  // Non-Latin scripts are names too and must not be rejected as "not a name".
  it('accepts non-Latin scripts', () => {
    expect(sanitizeFirstName('李')).toBe('李');
  });

  // Absent, empty, whitespace, or non-string input all resolve to null.
  it('returns null for absent or empty input', () => {
    expect(sanitizeFirstName(null)).toBeNull();
    expect(sanitizeFirstName(undefined)).toBeNull();
    expect(sanitizeFirstName('')).toBeNull();
    expect(sanitizeFirstName('   ')).toBeNull();
    expect(sanitizeFirstName(42 as unknown as string)).toBeNull();
  });

  // The security boundary: /donate?name=<script>… must reject, not truncate to
  // a plausible name and render attacker-chosen text under Harvard's brand.
  it('rejects markup rather than truncating it to a plausible name', () => {
    expect(sanitizeFirstName('<script>alert(1)</script>')).toBeNull();
    expect(sanitizeFirstName('<img src=x onerror=alert(1)>')).toBeNull();
    expect(sanitizeFirstName('Nicole<script>')).toBeNull();
    expect(sanitizeFirstName('"onmouseover="alert(1)')).toBeNull();
  });

  // Guards the ordering bug: length-check must precede first-token extraction,
  // or a long payload with a harmless first word ("Hi …") sneaks through.
  it('rejects a long payload whose first word looks harmless', () => {
    const payload = `Hi ${'<script>'.repeat(20)}`;
    expect(payload.length).toBeGreaterThan(MAX_NAME_LENGTH);
    expect(sanitizeFirstName(payload)).toBeNull();
  });

  // A name at the length cap is kept; one character over is rejected.
  it('rejects a name longer than the maximum', () => {
    expect(sanitizeFirstName('A'.repeat(MAX_NAME_LENGTH + 1))).toBeNull();
    expect(sanitizeFirstName('A'.repeat(MAX_NAME_LENGTH))).toBe('A'.repeat(MAX_NAME_LENGTH));
  });

  // Digits and stray punctuation that no first name contains are rejected.
  it('rejects digits and stray punctuation that no first name has', () => {
    expect(sanitizeFirstName('User123')).toBeNull();
    expect(sanitizeFirstName('{name}')).toBeNull();
    expect(sanitizeFirstName('a@b.com')).toBeNull();
  });
});

describe('heroGreeting', () => {
  const NAMED = 'Hi {name} —';
  const GENERIC = 'To our Harvard Alumni in Tech community —';

  // A valid name fills the {name} slot in the named template.
  it('fills the placeholder with a valid name', () => {
    expect(heroGreeting(NAMED, GENERIC, 'Nicole')).toBe('Hi Nicole —');
  });

  // No name → the generic greeting, so the public link reads correctly.
  it('falls back to the generic greeting with no name', () => {
    expect(heroGreeting(NAMED, GENERIC, null)).toBe(GENERIC);
  });

  // A rejected (hostile) name also falls back to the generic greeting.
  it('falls back to the generic greeting for a rejected name', () => {
    expect(heroGreeting(NAMED, GENERIC, '<script>')).toBe(GENERIC);
  });

  // Whatever the input, a literal "{name}" must never reach the rendered page.
  it('never leaks an unfilled placeholder', () => {
    for (const raw of [null, '', '   ', '<script>', 'x'.repeat(100)]) {
      expect(heroGreeting(NAMED, GENERIC, raw)).not.toContain('{name}');
    }
  });

  // A template with no placeholder can't be personalized, so it uses generic.
  it('uses the generic greeting when the named template has no placeholder', () => {
    expect(heroGreeting('Welcome back', GENERIC, 'Nicole')).toBe(GENERIC);
  });
});

describe('nameFromSearch', () => {
  // Reads `name` out of a bare `?name=…` query string.
  it('reads the name from a bare query string', () => {
    expect(nameFromSearch('?name=Nicole')).toBe('Nicole');
  });

  // Reads `name` out of a full URL alongside other params.
  it('reads the name from a full URL', () => {
    expect(nameFromSearch('https://harvardintech.com/donate?name=Nicole&utm_source=x')).toBe(
      'Nicole',
    );
  });

  // Percent-encoded values are decoded (a merge tag may URL-encode the name).
  it('decodes percent-encoded values', () => {
    expect(nameFromSearch('?name=Anne-Marie%20Dupont')).toBe('Anne-Marie Dupont');
  });

  // A missing `name` param, or no query at all, yields null.
  it('returns null when the parameter or query is absent', () => {
    expect(nameFromSearch('?utm_source=email')).toBeNull();
    expect(nameFromSearch('')).toBeNull();
    expect(nameFromSearch(null)).toBeNull();
  });
});

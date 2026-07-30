// Unit coverage for the deploy-flag on/off rule. This is small but
// security-relevant: `envFlagEnabled` is what decides whether drafts reach the
// public site and whether the review site is gated, so the fail-closed default
// is the behavior worth pinning down.
import { describe, it, expect } from 'vitest';
import { envFlagEnabled } from './envFlag';

describe('envFlagEnabled', () => {
  // The one value that means on. This is what deploy.yml sets for the review track.
  it('is true for the exact string 1', () => {
    expect(envFlagEnabled('1')).toBe(true);
  });

  // The public track sets nothing at all, which must mean off.
  it('is false when the variable is unset', () => {
    expect(envFlagEnabled(undefined)).toBe(false);
  });

  // An env block that assigns an empty value must not count as on.
  it('is false for an empty string', () => {
    expect(envFlagEnabled('')).toBe(false);
  });

  // The explicit off value.
  it('is false for the string 0', () => {
    expect(envFlagEnabled('0')).toBe(false);
  });

  // The important near-miss: 'true' reads as enabled to a human but is
  // deliberately rejected, so only the documented value works and a plausible
  // typo fails closed rather than publishing an ungated site.
  it('is false for the string true', () => {
    expect(envFlagEnabled('true')).toBe(false);
  });

  // Whitespace padding from a hand-edited YAML value is not silently trimmed.
  it('is false for 1 with surrounding whitespace', () => {
    expect(envFlagEnabled(' 1 ')).toBe(false);
  });

  // A typo'd value fails closed rather than being guessed at.
  it('is false for an arbitrary value', () => {
    expect(envFlagEnabled('yes')).toBe(false);
  });
});

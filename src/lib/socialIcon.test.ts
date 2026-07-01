import { describe, it, expect } from 'vitest';
import { socialIconSrc } from './socialIcon';

describe('socialIconSrc', () => {
  // Each known platform maps to its self-hosted asset under public/images/social/.
  it('maps twitter to its self-hosted asset', () => {
    expect(socialIconSrc('twitter')).toBe('/images/social/twitter.png');
  });

  // Facebook resolves to the downloaded facebook icon.
  it('maps facebook to its self-hosted asset', () => {
    expect(socialIconSrc('facebook')).toBe('/images/social/facebook.png');
  });

  // The synthesized e-mail entry resolves to the envelope icon.
  it('maps email to its self-hosted asset', () => {
    expect(socialIconSrc('email')).toBe('/images/social/email.jpg');
  });

  // LinkedIn resolves to its self-hosted crimson glyph (added in the Atlas revamp).
  it('maps linkedin to its self-hosted asset', () => {
    expect(socialIconSrc('linkedin')).toBe('/images/social/linkedin.svg');
  });

  // Lookup is case-insensitive so data-layer casing variations still resolve.
  it('resolves regardless of icon casing', () => {
    expect(socialIconSrc('Twitter')).toBe('/images/social/twitter.png');
    expect(socialIconSrc('FACEBOOK')).toBe('/images/social/facebook.png');
  });

  // An unknown platform returns null so the caller degrades to label-only.
  it('returns null for an unknown icon', () => {
    expect(socialIconSrc('mastodon')).toBeNull();
  });

  // A missing icon value returns null rather than throwing or guessing.
  it('returns null for null, undefined, or empty input', () => {
    expect(socialIconSrc(null)).toBeNull();
    expect(socialIconSrc(undefined)).toBeNull();
    expect(socialIconSrc('')).toBeNull();
  });
});

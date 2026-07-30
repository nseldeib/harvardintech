// Unit coverage for the draft-visibility rule that separates the two publishing
// tracks. Both tracks are PRODUCTION builds — the review site is not `astro dev`
// — so `!import.meta.env.PROD` alone cannot express them, and this is the
// function that does. Getting it wrong in one direction leaks unpublished work
// to harvardintech.com; in the other it makes the review site useless.
import { describe, it, expect } from 'vitest';
import { resolveIncludeDrafts } from './draftVisibility';

describe('resolveIncludeDrafts', () => {
  // The public track: a production build with no opt-in. Drafts must be hidden.
  // This is the case that keeps unpublished work off the live site.
  it('hides drafts on a production build with no opt-in', () => {
    expect(resolveIncludeDrafts(true, undefined)).toBe(false);
  });

  // The review track: also a production build, but explicitly opted in. This is
  // the case the old `!import.meta.env.PROD` inference could not express.
  it('shows drafts on a production build that opts in', () => {
    expect(resolveIncludeDrafts(true, '1')).toBe(true);
  });

  // `astro dev`, and therefore the codeyam preview and every scenario capture:
  // an author sees the entry they are writing without setting anything.
  it('shows drafts on a non-production build', () => {
    expect(resolveIncludeDrafts(false, undefined)).toBe(true);
  });

  // The opt-in is redundant in dev but must not flip the answer.
  it('shows drafts on a non-production build that also opts in', () => {
    expect(resolveIncludeDrafts(false, '1')).toBe(true);
  });

  // Fails closed: a plausible typo in the workflow env block leaves the public
  // site hiding drafts rather than publishing them.
  it('hides drafts on a production build when the opt-in is misspelled', () => {
    expect(resolveIncludeDrafts(true, 'true')).toBe(false);
    expect(resolveIncludeDrafts(true, '0')).toBe(false);
    expect(resolveIncludeDrafts(true, '')).toBe(false);
  });

  // Turning the flag off in dev does NOT hide drafts — the non-production
  // default wins. Hiding drafts while authoring would need a separate opt-out,
  // and deliberately does not exist.
  it('keeps drafts visible in dev even when the opt-in is off', () => {
    expect(resolveIncludeDrafts(false, '0')).toBe(true);
  });
});

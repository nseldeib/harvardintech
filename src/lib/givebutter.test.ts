import { describe, expect, it } from 'vitest';
import { givebutterScriptSrc } from './givebutter';

// The one decision this module makes is whether the site loads Givebutter's code
// at all. That matters more than it looks: the "no account configured" answer is
// the DEFAULT and the shipping state for any site that has not chosen a giving
// platform, and it has to mean no third-party request rather than an empty tag
// pointing at a CDN. So the absent cases get as much attention as the happy one.
describe('givebutterScriptSrc', () => {
  // The configured case: a real account id produces Givebutter's loader with the
  // acct and p parameters their embed snippet carries.
  it('builds the loader URL from an account id', () => {
    expect(givebutterScriptSrc('khqJtxj5uVUZ1eO8')).toBe(
      'https://widgets.givebutter.com/latest.umd.cjs?acct=khqJtxj5uVUZ1eO8&p=other',
    );
  });

  // No account configured at all — the default state of the site. undefined is
  // the caller's signal to render nothing, not to render an empty script tag.
  it('returns undefined when the account id is absent', () => {
    expect(givebutterScriptSrc(undefined)).toBeUndefined();
  });

  // A cleared CMS box arrives as an empty string, and must not produce acct=.
  it('returns undefined for an empty account id', () => {
    expect(givebutterScriptSrc('')).toBeUndefined();
  });

  // Whitespace is what a box someone spacebarred into holds. Same as cleared.
  it('treats a whitespace-only account id as absent', () => {
    expect(givebutterScriptSrc('   ')).toBeUndefined();
  });

  // The id arrives by copy-paste, so surrounding whitespace is routine and must
  // not survive into the URL.
  it('trims surrounding whitespace before building the URL', () => {
    expect(givebutterScriptSrc('  abc123  ')).toBe(
      'https://widgets.givebutter.com/latest.umd.cjs?acct=abc123&p=other',
    );
  });

  // The reason the id is encoded rather than interpolated raw: a pasted value
  // carrying a query-significant character must not be able to add parameters or
  // truncate the ones already there.
  it('encodes characters that would otherwise alter the query string', () => {
    expect(givebutterScriptSrc('a&p=evil')).toBe(
      'https://widgets.givebutter.com/latest.umd.cjs?acct=a%26p%3Devil&p=other',
    );
  });

  // A fragment character would otherwise cut the URL short, dropping p=other.
  it('encodes a hash so it cannot truncate the URL', () => {
    expect(givebutterScriptSrc('a#b')).toBe(
      'https://widgets.givebutter.com/latest.umd.cjs?acct=a%23b&p=other',
    );
  });
});

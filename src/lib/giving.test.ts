import { describe, it, expect } from 'vitest';
import { resolveGiveHref } from './giving';

const EMAIL = 'ben@harvardintech.com';

describe('resolveGiveHref', () => {
  // When a real platform URL is configured, the button points straight at it.
  it('uses the donation platform URL when one is configured', () => {
    expect(
      resolveGiveHref({ donateUrl: 'https://givebutter.com/harvard-in-tech', email: EMAIL }),
    ).toBe('https://givebutter.com/harvard-in-tech');
  });

  // With no platform yet, the button opens a campaign-named giving-inquiry email.
  it('falls back to a giving-inquiry mailto when no URL is set', () => {
    const href = resolveGiveHref({ email: EMAIL, campaignName: 'The Momentum Fund' });
    expect(href).toContain(`mailto:${EMAIL}`);
    expect(href).toContain('Supporting%20The%20Momentum%20Fund');
  });

  // A cleared CMS field arrives as "" and must fall back, not produce href="".
  it('treats an empty donateUrl as unset', () => {
    // The CMS writes "" for a cleared text field, not undefined — so an empty
    // string must not become href="" (which reloads the current page instead
    // of opening the mail client).
    expect(resolveGiveHref({ donateUrl: '', email: EMAIL })).toContain('mailto:');
  });

  // A field holding only spaces is effectively blank and must fall back too.
  it('treats a whitespace-only donateUrl as unset', () => {
    expect(resolveGiveHref({ donateUrl: '   ', email: EMAIL })).toContain('mailto:');
  });

  // A pasted URL with surrounding whitespace is trimmed, not treated as broken.
  it('trims surrounding whitespace from a pasted URL', () => {
    // Editors paste URLs with a trailing space more often than not.
    expect(
      resolveGiveHref({ donateUrl: '  https://donorbox.org/hit  ', email: EMAIL }),
    ).toBe('https://donorbox.org/hit');
  });

  // Without a campaign name the subject uses the org-wide generic wording.
  it('uses a generic subject when no campaign is named', () => {
    const href = resolveGiveHref({ email: EMAIL });
    expect(href).toContain('Supporting%20Harvard%20Alumni%20in%20Tech');
  });

  // Subject spaces are percent-encoded so the mail client parses the query.
  it('encodes the subject so the mail client receives it intact', () => {
    const href = resolveGiveHref({ email: EMAIL, campaignName: 'Momentum Fund 2026' });
    expect(href).not.toContain(' ');
    expect(href).toContain('Momentum%20Fund%202026');
  });
});

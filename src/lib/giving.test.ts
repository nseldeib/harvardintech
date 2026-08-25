import { describe, it, expect } from 'vitest';
import { resolveGiveHref, resolveGiveCtaHref, GIVE_PAGE_PATH } from './giving';

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

// The CAMPAIGN-page CTA, as distinct from the button on the giving page itself.
// The split exists so /give can carry a giving button without that button
// resolving to /give — a page linking to itself.
describe('resolveGiveCtaHref', () => {
  // A configured platform wins outright: a real checkout is a better
  // destination than our own page, and setting the CMS field takes /give out of
  // the path entirely with no code change.
  it('uses the donation platform URL when one is configured', () => {
    expect(resolveGiveCtaHref({ donateUrl: 'https://givebutter.com/hit' })).toBe(
      'https://givebutter.com/hit',
    );
  });

  // The point of the whole split: with no platform, a campaign CTA goes to the
  // giving page rather than straight to a mailto, so a visitor meets the goal
  // and the amounts before being asked for anything.
  it('falls back to the giving page when no platform is configured', () => {
    expect(resolveGiveCtaHref({})).toBe(GIVE_PAGE_PATH);
  });

  // Blank and whitespace-only are treated as absent, matching `resolveGiveHref`
  // — an editor who clears the CMS field leaves an empty string, not undefined.
  it('treats a blank or whitespace-only platform URL as absent', () => {
    expect(resolveGiveCtaHref({ donateUrl: '' })).toBe(GIVE_PAGE_PATH);
    expect(resolveGiveCtaHref({ donateUrl: '   ' })).toBe(GIVE_PAGE_PATH);
  });

  // The two resolvers must DISAGREE when no platform is set — that difference
  // is the entire feature. If this ever passes, /give links to itself.
  it('differs from resolveGiveHref when no platform is configured', () => {
    expect(resolveGiveCtaHref({})).not.toBe(resolveGiveHref({ email: EMAIL }));
  });

  // ...and AGREE when one is, so choosing a platform routes both the campaign
  // CTA and the giving page's own button to the same place.
  it('agrees with resolveGiveHref once a platform is configured', () => {
    const donateUrl = 'https://givebutter.com/hit';
    expect(resolveGiveCtaHref({ donateUrl })).toBe(resolveGiveHref({ donateUrl, email: EMAIL }));
  });
});

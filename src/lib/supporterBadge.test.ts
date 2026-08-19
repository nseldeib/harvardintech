import { describe, it, expect } from 'vitest';
import {
  badgeFor,
  shareMessage,
  supporterPageUrl,
  linkedInShareUrl,
  facebookShareUrl,
  canShareBadge,
  DEFAULT_SHARE_MESSAGE,
  SUPPORTER_PARAM,
  SUPPORTER_MESSAGE_TOKEN,
  DONATION_LINK_TOKEN,
} from './supporterBadge';
import { FOUNDING_SUPPORTER_LABEL } from './momentumNetwork';
import { ANONYMOUS_DONOR_LABEL, type DonorLike } from './donors';

function donor(slug: string, name: string, extra: Partial<DonorLike> = {}): DonorLike {
  return { slug, name, ...extra };
}

const MARGARET = donor('margaret-chen-alvarez', 'Margaret Chen-Alvarez', {
  school: 'Harvard Business School',
  gradYear: 2004,
  location: 'San Francisco, CA',
  founding: true,
  why: 'I got my first board seat through someone I met at a Harvard in Tech dinner.',
});

const DONATION_URL = 'https://givebutter.com/momentum';

describe('badgeFor', () => {
  // The badge is the thing a supporter posts about themselves, so every field
  // on it has to be the one their node panel showed.
  it('carries the supporter identity the badge prints', () => {
    const badge = badgeFor(MARGARET);
    expect(badge.name).toBe('Margaret Chen-Alvarez');
    expect(badge.school).toBe('HBS');
    expect(badge.gradYear).toBe(2004);
    expect(badge.location).toBe('San Francisco, CA');
    expect(badge.standing).toBe(FOUNDING_SUPPORTER_LABEL);
    expect(badge.why).toBe(MARGARET.why);
  });

  // Not every supporter is founding; theirs should read as the level they gave
  // at rather than borrowing a badge they were not given.
  it('shows the giving level for a supporter without the founding badge', () => {
    expect(badgeFor(donor('j', 'Jonathan Feld'), 'Sustaining Donors').standing).toBe(
      'Sustaining Donors',
    );
  });

  // An untagged supporter still needs a word under their name — a blank line
  // there reads as missing data rather than as someone who simply gave.
  it('falls back to a plain label when there is no level either', () => {
    expect(badgeFor(donor('c', 'Clara Ndiaye')).standing).toBe('Supporter');
  });

  // Reads every field through donorPublicIdentity / donorWhy rather than off the
  // entry, so an anonymous supporter's badge cannot carry what the network
  // withholds — even though the network never offers them one.
  it('withholds every identity field for an anonymous supporter', () => {
    const badge = badgeFor(
      donor('r', 'Robert K. Whitmore', {
        anonymous: true,
        school: 'Harvard Law School',
        gradYear: 1998,
        location: 'Greenwich, CT',
        why: 'I would rather the fund got the attention.',
      }),
    );

    expect(badge.name).toBe(ANONYMOUS_DONOR_LABEL);
    expect(badge.school).toBeUndefined();
    expect(badge.gradYear).toBeUndefined();
    expect(badge.location).toBeUndefined();
    expect(badge.why).toBeUndefined();
  });
});

describe('shareMessage', () => {
  // The whole point of collecting a why-message: it reaches the post in the
  // supporter's own voice.
  it('substitutes the supporter own words into the message', () => {
    const text = shareMessage(badgeFor(MARGARET), { donationUrl: DONATION_URL });
    expect(text).toContain(`I contributed because ${MARGARET.why}`);
  });

  // The message is an ask, and the ask needs somewhere to go.
  it('substitutes the donation link', () => {
    const text = shareMessage(badgeFor(MARGARET), { donationUrl: DONATION_URL });
    expect(text).toContain(`Support the Momentum Fund: ${DONATION_URL}`);
  });

  // A literal [SUPPORTER MESSAGE] reaching LinkedIn is the most visible way
  // this feature can fail, and it fails in public on someone's own profile.
  it('never leaves an unreplaced placeholder in the posted text', () => {
    const text = shareMessage(badgeFor(MARGARET), { donationUrl: DONATION_URL });
    expect(text).not.toContain(SUPPORTER_MESSAGE_TOKEN);
    expect(text).not.toContain(DONATION_LINK_TOKEN);
  });

  // THE rule the design direction states outright: with no message from the
  // supporter the line is REMOVED, not left as "I contributed because ." — which
  // is why this takes the template apart by lines instead of substituting an
  // empty string into it.
  it('removes the contributed-because line entirely when the supporter wrote nothing', () => {
    const text = shareMessage(badgeFor(donor('j', 'Jonathan Feld')), {
      donationUrl: DONATION_URL,
    });

    expect(text).not.toContain('I contributed because');
    expect(text).toContain('Harvard Alumni in Tech Momentum Fund');
    expect(text).toContain('If this community has helped you');
  });

  // The blank line above the removed line goes with it, so the message never
  // ships with a double gap where someone's words would have been.
  it('closes the paragraph gap left by the removed line', () => {
    const text = shareMessage(badgeFor(donor('j', 'Jonathan Feld')), {
      donationUrl: DONATION_URL,
    });
    expect(text).not.toContain('\n\n\n');
  });

  // The same treatment for a campaign with no donation link yet — which is the
  // LIVE case, not a defensive one. A line reading "Support the Momentum Fund:"
  // with nothing after it asks a reader to act and gives them nowhere to go.
  it('removes the donation line entirely when no donation url is set', () => {
    const text = shareMessage(badgeFor(MARGARET), { donationUrl: '' });
    expect(text).not.toContain('Support the Momentum Fund');
    expect(text).toContain('I contributed because');
  });

  // Both conditional lines gone at once still has to leave a coherent message
  // rather than a fragment — the two rules must compose.
  it('removes both lines when the supporter wrote nothing and there is no link', () => {
    const text = shareMessage(badgeFor(donor('j', 'Jonathan Feld')));
    expect(text).not.toContain('I contributed because');
    expect(text).not.toContain('Support the Momentum Fund');
    expect(text.trim().length).toBeGreaterThan(0);
  });

  // The message is editable copy in the CMS, so an edited template has to be
  // what actually ships rather than the default silently winning.
  it('uses an editor-supplied template over the shipped default', () => {
    const text = shareMessage(badgeFor(MARGARET), {
      template: `Custom opening.\n\nBecause ${SUPPORTER_MESSAGE_TOKEN}`,
      donationUrl: DONATION_URL,
    });
    expect(text).toContain('Custom opening.');
    expect(text).not.toContain('Harvard Alumni in Tech Momentum Fund');
  });

  // A cleared CMS field must not leave supporters sharing an empty message.
  it('falls back to the shipped default for a blank template', () => {
    expect(shareMessage(badgeFor(MARGARET), { template: '   ', donationUrl: DONATION_URL })).toContain(
      'Harvard Alumni in Tech Momentum Fund',
    );
  });

  // If the default lost a placeholder, every substitution rule below it would
  // pass while doing nothing at all.
  it('ships a default template carrying both placeholders', () => {
    expect(DEFAULT_SHARE_MESSAGE).toContain(SUPPORTER_MESSAGE_TOKEN);
    expect(DEFAULT_SHARE_MESSAGE).toContain(DONATION_LINK_TOKEN);
  });
});

describe('supporterPageUrl', () => {
  // The address a badge is shared as. Without it, "share your badge" posts a
  // link to the campaign page and leaves whoever follows it hunting one dot
  // among many.
  it('names the supporter in the url', () => {
    expect(supporterPageUrl('https://example.com/donate', 'margaret-chen-alvarez')).toBe(
      `https://example.com/donate?${SUPPORTER_PARAM}=margaret-chen-alvarez`,
    );
  });

  // /donate already takes ?name= from the email campaign, so the supporter
  // parameter has to join an existing query rather than replace it.
  it('appends to a url that already carries a query', () => {
    expect(supporterPageUrl('https://example.com/donate?name=Ada', 'ben-wei')).toBe(
      `https://example.com/donate?name=Ada&${SUPPORTER_PARAM}=ben-wei`,
    );
  });

  // A fragment would end up after the query and break the parameter.
  it('drops a fragment rather than appending the query after it', () => {
    expect(supporterPageUrl('https://example.com/donate#donors', 'ben-wei')).toBe(
      `https://example.com/donate?${SUPPORTER_PARAM}=ben-wei`,
    );
  });

  // A slug is editor-controlled, so it cannot be trusted to be url-safe.
  it('encodes a slug that needs it', () => {
    expect(supporterPageUrl('https://example.com/donate', 'a b')).toContain('a%20b');
  });
});

describe('linkedInShareUrl and facebookShareUrl', () => {
  const supporterUrl = supporterPageUrl('https://example.com/donate', 'ben-wei');

  // The share endpoint reads one parameter; an unencoded url silently truncates
  // at the first ampersand and shares the wrong page.
  it('sends LinkedIn the supporter own url, encoded', () => {
    expect(linkedInShareUrl(supporterUrl)).toBe(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(supporterUrl)}`,
    );
  });

  // Same contract on the other network, asserted separately so a change to one
  // helper cannot quietly take the other with it.
  it('sends Facebook the supporter own url, encoded', () => {
    expect(facebookShareUrl(supporterUrl)).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(supporterUrl)}`,
    );
  });

  // Both endpoints compose their own preview from the target page and ignore
  // prefilled body text, so the message must NOT be smuggled into the query
  // where it would be silently dropped — it belongs in the editable field.
  it('carries no message text in either share url', () => {
    expect(linkedInShareUrl(supporterUrl)).not.toContain('contributed');
    expect(facebookShareUrl(supporterUrl)).not.toContain('contributed');
  });
});

describe('canShareBadge', () => {
  // The ordinary case, and the one the whole share feature exists for.
  it('offers a badge to a named supporter', () => {
    expect(canShareBadge(MARGARET)).toBe(true);
  });

  // An anonymous supporter has no badge by design: a shareable badge is a name,
  // a school and a year published to a social network, which is the precise
  // opposite of what they asked for.
  it('refuses an anonymous supporter', () => {
    expect(canShareBadge(donor('r', 'Robert', { anonymous: true }))).toBe(false);
  });

  // Deliberately NOT gated on the donation url. Hiding the whole feature when
  // the campaign has not published a link conflated "nothing to link to" with
  // "this person has nothing to share", and hid the badge on the live site.
  it('still offers a badge when the campaign has no donation link yet', () => {
    expect(canShareBadge(MARGARET)).toBe(true);
  });
});

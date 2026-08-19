// The supporter badge and the message a supporter shares from it.
//
// Pure and framework-free like `./momentumNetwork.ts` beside it: composing the
// share text is a rule with a real branch in it, and a rule with a branch wants
// a test rather than a template literal buried in a component.
//
// Nicole's template arrives separately, so the LAYOUT of the badge is a
// component and deliberately not modelled here. What is modelled is what the
// badge says and what leaves the page when someone shares it — the parts that
// have to be right whatever the layout turns out to be.

import { donorPublicIdentity, donorWhy, type DonorLike } from './donors';
import { shortSchoolLabel, FOUNDING_SUPPORTER_LABEL } from './momentumNetwork';

/** The placeholders the editable `shareMessage` copy carries. */
export const SUPPORTER_MESSAGE_TOKEN = '[SUPPORTER MESSAGE]';
export const DONATION_LINK_TOKEN = '[DONATION LINK]';

/**
 * The message a badge pre-populates its share with, as shipped.
 *
 * Lives here as the fallback for `donatePage.json`'s `shareMessage`, in the
 * pattern the rest of the campaign copy already follows — the team edits it in
 * the CMS, and the site still has something to say if they never do.
 */
export const DEFAULT_SHARE_MESSAGE = [
  'Harvard Alumni in Tech Momentum Fund and help strengthen the network that gives back to the network.',
  '',
  `I contributed because ${SUPPORTER_MESSAGE_TOKEN}`,
  '',
  'If this community has helped you make a connection, discover an opportunity, or move an idea forward, I invite you to join me in helping power what comes next.',
  '',
  `Support the Momentum Fund: ${DONATION_LINK_TOKEN}`,
].join('\n');

/** What the badge prints about the supporter it belongs to. */
export interface SupporterBadge {
  name: string;
  school?: string;
  gradYear?: number;
  location?: string;
  standing: string;
  /** Their own words, or `undefined` — the badge omits the line entirely. */
  why?: string;
}

/**
 * The badge for a supporter, with anonymity already applied.
 *
 * Reads every field through `donorPublicIdentity` / `donorWhy` rather than off
 * the entry, for the reason those functions exist. An anonymous supporter has no
 * badge at all — `badgeFor` still answers, but the network never offers them one
 * (`isSelectableNode` is false), because a shareable badge is a name, a school
 * and a year published to a social network, which is the precise opposite of
 * what they asked for.
 */
export function badgeFor(donor: DonorLike, tierName?: string): SupporterBadge {
  const identity = donorPublicIdentity(donor);
  return {
    name: identity.name,
    school: shortSchoolLabel(identity.school),
    gradYear: identity.gradYear,
    location: identity.location,
    standing: donor.founding === true ? FOUNDING_SUPPORTER_LABEL : (tierName ?? 'Supporter'),
    why: donorWhy(donor),
  };
}

/**
 * The share message for a supporter, ready to post.
 *
 * The rule the direction is explicit about: when a supporter did not submit a
 * "why I contributed" message, the line is REMOVED — not left as "I contributed
 * because ." and not filled with a stand-in sentence they never wrote. Removing
 * the whole line is why this takes the template apart by lines rather than
 * running a substitution over it: replacing the token with an empty string
 * leaves the orphaned "I contributed because" behind, which is the failure this
 * function exists to prevent.
 *
 * The blank line that separated the removed line from the paragraph after it
 * goes with it, so the message never ships with a double gap where someone's
 * words would have been.
 */
export function shareMessage(
  badge: SupporterBadge,
  options: { template?: string; donationUrl?: string } = {},
): string {
  const template = options.template?.trim() ? options.template : DEFAULT_SHARE_MESSAGE;
  const donationUrl = options.donationUrl?.trim() ?? '';
  const lines = template.split('\n');
  const out: string[] = [];

  const dropLine = () => {
    // Take the blank line above it too, so the paragraphs close up rather than
    // leaving a double gap where the removed line was.
    if (out.length > 0 && out[out.length - 1].trim() === '') out.pop();
  };

  for (const line of lines) {
    if (line.includes(SUPPORTER_MESSAGE_TOKEN)) {
      if (!badge.why) {
        dropLine();
        continue;
      }
      out.push(line.replace(SUPPORTER_MESSAGE_TOKEN, badge.why));
      continue;
    }

    if (line.includes(DONATION_LINK_TOKEN)) {
      // The SAME rule the supporter-message line gets, for the same reason: a
      // line reading "Support the Momentum Fund:" with nothing after it asks a
      // reader to act and then gives them nowhere to go. The campaign has no
      // donation URL set yet, so this is the live case rather than a defensive
      // one — and it is why having no URL must not cost a supporter their badge.
      if (donationUrl.length === 0) {
        dropLine();
        continue;
      }
      out.push(line.replace(DONATION_LINK_TOKEN, donationUrl));
      continue;
    }

    out.push(line);
  }

  return out.join('\n').trim();
}

/**
 * The URL that opens the network with THIS supporter's node selected.
 *
 * The address a badge is shared as. Without it "share your badge" posts a link
 * to the campaign page and leaves whoever follows it to find the sharer among a
 * few hundred identical dots — which is not sharing a badge, it is sharing a
 * page. The network reads this parameter on load and opens straight to them.
 */
export function supporterPageUrl(pageUrl: string, slug: string): string {
  const base = pageUrl.split('#')[0];
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${SUPPORTER_PARAM}=${encodeURIComponent(slug)}`;
}

/** The query parameter naming a supporter. One spelling, read by the page and
 *  written by the share link, so the two cannot drift. */
export const SUPPORTER_PARAM = 'supporter';

/**
 * Where "share to LinkedIn" sends a supporter.
 *
 * LinkedIn's share endpoint takes the URL and composes its own preview from the
 * page's own metadata; it does NOT accept prefilled body text. So the message
 * is not smuggled into the query string where it would be silently dropped —
 * the page shows it in an editable field the supporter copies, which is also
 * what makes "editable by supporters" true rather than decorative.
 */
export function linkedInShareUrl(pageUrl: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(pageUrl)}`;
}

/**
 * Where "share to Facebook" sends a supporter.
 *
 * Same shape and the same caveat: Facebook dropped prefilled `quote` support,
 * so the composed message belongs in the copyable field on the page rather than
 * in a parameter that will be ignored.
 */
export function facebookShareUrl(pageUrl: string): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
}

/**
 * Whether the share controls should be offered at all.
 *
 * ONE way to have nothing to share: an anonymous supporter, who has no badge by
 * design. A blank donation URL used to disqualify a badge too, which was wrong
 * on both counts — it hid the whole feature on the live campaign (where the URL
 * is still unset), and it treated "the campaign has not published its donation
 * link" as if it were "this person has nothing to share". `shareMessage` drops
 * the donation line instead, so the badge a supporter shares is always coherent.
 */
export function canShareBadge(donor: DonorLike): boolean {
  return donor.anonymous !== true;
}

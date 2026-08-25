// Where a "give" button points.
//
// Harvard Alumni in Tech has no donation platform yet, so every giving CTA opens a
// pre-addressed inquiry email instead. When a platform is chosen, setting
// `donateUrl` in the CMS switches every button over with no code change — which
// is the whole reason this is one function rather than an inline ternary
// repeated in each giving component.
import { buildMailto } from './mailto';

export interface GiveHrefOptions {
  /** Real donation platform URL. Empty/absent → the mailto fallback. */
  donateUrl?: string;
  /** Address the giving inquiry goes to. */
  email: string;
  /** Names the campaign in the email subject, e.g. "The Momentum Fund". */
  campaignName?: string;
}

/**
 * Resolve the href for a giving CTA: the donation platform when one is
 * configured, otherwise a `mailto:` with a campaign-specific subject.
 */
export function resolveGiveHref({ donateUrl, email, campaignName }: GiveHrefOptions): string {
  const url = donateUrl?.trim();
  if (url) return url;
  const subject = campaignName
    ? `Supporting ${campaignName}`
    : 'Supporting Harvard Alumni in Tech';
  return buildMailto({ to: email, subject });
}

/** The giving page this site serves itself. */
export const GIVE_PAGE_PATH = '/give';

/**
 * Where a giving CTA on a CAMPAIGN page points — as distinct from the button on
 * the giving page itself, which is `resolveGiveHref` above.
 *
 * The two differ because they are asking different things. A CTA on /donate is
 * "take me to where I can give", and the best answer is /give: it states the
 * goal, the amounts and what the money does before asking for anything. The
 * button at the bottom of /give is "I am giving now", and that has to leave the
 * site for the platform — or, until one is configured, open the inquiry email.
 *
 * A configured `donateUrl` still wins outright here, so choosing a platform
 * sends every campaign CTA straight to it and /give stops being in the path.
 * That is deliberate: a real checkout is a better destination than our page, and
 * the CMS switch keeps working exactly as it always did.
 *
 * Without this split the button on /give would resolve to /give and the page
 * would link to itself — the failure this function exists to make impossible.
 */
export function resolveGiveCtaHref({ donateUrl }: Pick<GiveHrefOptions, 'donateUrl'>): string {
  return donateUrl?.trim() || GIVE_PAGE_PATH;
}

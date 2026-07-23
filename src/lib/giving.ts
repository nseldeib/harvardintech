// Where a "give" button points.
//
// Harvard in Tech has no donation platform yet, so every giving CTA opens a
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

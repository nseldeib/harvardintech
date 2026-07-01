// Maps a social link's `icon` field to its self-hosted asset path. The icons
// were downloaded from the original harvardintech.com site (Strikingly
// "persona" theme) and committed under public/images/social/ so the GitHub
// Pages build has no dependency on an external CDN. An unknown or missing icon
// returns null, letting the caller degrade gracefully to a label-only link.

const SOCIAL_ICONS: Record<string, string> = {
  twitter: '/images/social/twitter.png',
  facebook: '/images/social/facebook.png',
  email: '/images/social/email.jpg',
  linkedin: '/images/social/linkedin.svg',
};

export function socialIconSrc(icon: string | null | undefined): string | null {
  if (!icon) return null;
  return SOCIAL_ICONS[icon.toLowerCase()] ?? null;
}

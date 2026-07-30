// The robots.txt policy body, as a pure string builder. Extracted from the
// `src/pages/robots.txt.ts` endpoint so both tracks' output is unit-testable:
// the endpoint resolves the gate from `process.env` at module load, so a test
// importing it could only ever reach one branch. Taking the flag as a parameter
// is the same shape `drafts.ts` uses for `includeDrafts`.
//
// The endpoint keeps origin resolution and response shaping; this owns the
// content.

/**
 * Build a robots.txt body.
 *
 * `disallowAll` selects the track. The gated review origin gets `Disallow: /`
 * and — deliberately — NO `Sitemap:` line: `astro.config.mjs` omits the sitemap
 * integration entirely on that track, so advertising `sitemap-index.xml` there
 * would point crawlers at a 404. A `noindex` origin has nothing to offer a
 * sitemap in any case. The public track gets `Allow: /` plus the sitemap
 * reference.
 */
export function robotsTxtBody(sitemapUrl: string, disallowAll: boolean): string {
  if (disallowAll) {
    return `User-agent: *
Disallow: /
`;
  }

  return `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;
}

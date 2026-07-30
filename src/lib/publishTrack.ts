// Which integrations belong on which publishing track. Extracted out of
// `astro.config.mjs` so the decision is unit-testable: the config file can only
// be exercised by running a real `astro build`, and importing it under vitest
// pulls in Vite/esbuild and fails outright.
//
// Pure predicates over already-resolved booleans — the config file still owns
// reading `process.env` / `process.argv`, this owns what those values mean.

/**
 * Whether the CMS admin (`/admin`) ships in this build.
 *
 * Only the gated review origin and `astro dev` get it. Two reasons, both
 * load-bearing: the admin pages embed each entry's raw markdown in their static
 * HTML while the sign-in gate is client-side only, so wherever `/admin` deploys
 * every draft's full source is publicly fetchable — which would defeat the point
 * of phasing content if it sat on the public domain; and it matches the
 * workflow, where editors work on the review site and promote. Dev keeps it so
 * the codeyam Live Preview retains its admin scenarios.
 */
export function includeCmsIntegration(isDev: boolean, isReviewTrack: boolean): boolean {
  return isDev || isReviewTrack;
}

/**
 * Whether a sitemap is published for this build.
 *
 * Public track only. The review origin is `noindex` and serves `Disallow: /`
 * (see `robotsTxtBody`), so it has nothing to offer a sitemap — and emitting one
 * there would contradict the gate. `robotsTxtBody` omits its `Sitemap:` line on
 * the same track for the same reason; these two must stay in agreement or the
 * review site advertises a URL that 404s.
 */
export function includeSitemapIntegration(isReviewTrack: boolean): boolean {
  return !isReviewTrack;
}

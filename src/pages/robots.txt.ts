// robots.txt as a build-time endpoint, not a static file. A static
// `public/robots.txt` can't know the env-driven deploy URL, so it shipped a
// broken literal `https://<user>.github.io/` placeholder in the Sitemap line.
// This endpoint emits the REAL canonical origin (`context.site`) — the custom
// domain when deployed there, the project-site URL for a subpath deploy — so
// the Sitemap reference is always correct. `@astrojs/sitemap` already produces
// `sitemap-index.xml`; this just points crawlers at it.
import type { APIContext } from 'astro';

export function GET(context: APIContext): Response {
  const site = context.site ?? new URL('/', context.url);
  const sitemapUrl = new URL('sitemap-index.xml', site).href;

  const body = `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

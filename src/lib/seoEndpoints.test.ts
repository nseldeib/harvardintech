// Unit coverage for the SEO/AEO endpoint handlers. The GET functions live in
// `src/pages/*.ts` (Astro endpoints) but are plain functions of an APIContext,
// so they're importable and testable here without the Astro runtime — a test
// file cannot live in `src/pages` itself (Astro would route it). We assert the
// env-driven URL wiring and the settings-derived content, the parts most likely
// to regress (the old static robots.txt shipped a broken placeholder URL).
import { describe, it, expect } from 'vitest';
import { GET as robotsGet } from '../pages/robots.txt';
import { GET as llmsGet } from '../pages/llms.txt';
import { settings } from './site';

// Build a minimal APIContext — the handlers only read `site` and `url`.
function ctx(site: string | undefined, url = 'http://localhost/'): any {
  return { site: site ? new URL(site) : undefined, url: new URL(url) };
}

describe('robots.txt GET', () => {
  // Emits the standard allow-all directives.
  it('allows all crawlers', async () => {
    const body = await (await robotsGet(ctx('https://example.com/'))).text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Allow: /');
  });

  // The Sitemap line uses the env-driven site origin, not a literal placeholder.
  it('points the Sitemap at the configured site origin', async () => {
    const body = await (await robotsGet(ctx('https://example.com/'))).text();
    expect(body).toContain('Sitemap: https://example.com/sitemap-index.xml');
    expect(body).not.toContain('<user>');
  });

  // With no configured site, it falls back to the request origin (never crashes).
  it('falls back to the request origin when site is unset', async () => {
    const body = await (await robotsGet(ctx(undefined, 'https://fallback.test/'))).text();
    expect(body).toContain('Sitemap: https://fallback.test/sitemap-index.xml');
  });

  // Serves as text/plain so crawlers read it verbatim.
  it('responds as text/plain', async () => {
    const res = await robotsGet(ctx('https://example.com/'));
    expect(res.headers.get('Content-Type')).toContain('text/plain');
  });
});

describe('llms.txt GET', () => {
  // Leads with the org name as an H1 and the description as a blockquote.
  it('includes the org name and description from settings', async () => {
    const body = await (await llmsGet(ctx('https://example.com/'))).text();
    expect(body).toContain(`# ${settings.siteTitle}`);
    expect(body).toContain(settings.description);
  });

  // Key pages are emitted as absolute URLs against the configured origin.
  it('lists key pages as absolute URLs', async () => {
    const body = await (await llmsGet(ctx('https://example.com/'))).text();
    expect(body).toContain('## Key pages');
    expect(body).toContain('[Home](https://example.com/)');
    expect(body).toContain('[Events](https://example.com/events)');
  });

  // Contact section surfaces the settings email + social links for citation.
  it('surfaces contact email and socials', async () => {
    const body = await (await llmsGet(ctx('https://example.com/'))).text();
    expect(body).toContain(`Email: ${settings.contactEmail}`);
    for (const s of settings.socials) {
      expect(body).toContain(`${s.label}: ${s.url}`);
    }
  });
});

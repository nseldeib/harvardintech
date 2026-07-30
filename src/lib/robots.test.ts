// Unit coverage for the robots.txt policy body across BOTH publishing tracks.
// The endpoint in `src/pages/robots.txt.ts` reads the gate from `process.env` at
// module load, so `seoEndpoints.test.ts` can only ever exercise the public
// branch; this file is where the gated review-track output is actually pinned.
import { describe, it, expect } from 'vitest';
import { robotsTxtBody } from './robots';

describe('robotsTxtBody public track', () => {
  // The open, indexable site invites every crawler.
  it('allows all crawlers when not disallowing', () => {
    const body = robotsTxtBody('https://harvardintech.com/sitemap-index.xml', false);
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Allow: /');
    expect(body).not.toContain('Disallow: /');
  });

  // The Sitemap line carries the caller's resolved origin, not a placeholder —
  // the regression the original static robots.txt shipped.
  it('points the Sitemap at the url it was given', () => {
    const body = robotsTxtBody('https://harvardintech.com/sitemap-index.xml', false);
    expect(body).toContain('Sitemap: https://harvardintech.com/sitemap-index.xml');
  });
});

describe('robotsTxtBody review track', () => {
  // The gated review origin must tell crawlers to stay out entirely.
  it('disallows all crawlers when gated', () => {
    const body = robotsTxtBody('https://review.harvardintech.com/sitemap-index.xml', true);
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Disallow: /');
    expect(body).not.toContain('Allow: /');
  });

  // The bug this extraction exists to pin: astro.config.mjs omits the sitemap
  // integration on the review track, so emitting a Sitemap line there would
  // advertise a URL that 404s.
  it('omits the Sitemap line entirely when gated', () => {
    const body = robotsTxtBody('https://review.harvardintech.com/sitemap-index.xml', true);
    expect(body).not.toContain('Sitemap:');
    expect(body).not.toContain('sitemap-index.xml');
  });
});

describe('robotsTxtBody formatting', () => {
  // Crawlers parse this line-by-line, so the directive must be on its own line
  // directly beneath the user-agent rather than concatenated onto it.
  it('puts the directive on its own line under the user-agent', () => {
    expect(robotsTxtBody('https://example.com/sitemap-index.xml', false)).toContain(
      'User-agent: *\nAllow: /',
    );
    expect(robotsTxtBody('https://example.com/sitemap-index.xml', true)).toContain(
      'User-agent: *\nDisallow: /',
    );
  });

  // A trailing newline keeps the last directive well-formed for line-based parsers.
  it('ends with a newline on both tracks', () => {
    expect(robotsTxtBody('https://example.com/sitemap-index.xml', false).endsWith('\n')).toBe(true);
    expect(robotsTxtBody('https://example.com/sitemap-index.xml', true).endsWith('\n')).toBe(true);
  });
});

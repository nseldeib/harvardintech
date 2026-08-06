// Unit coverage for the per-track integration decisions that astro.config.mjs
// applies. These matter more than their size suggests: getting the CMS one wrong
// publishes /admin — and with it every draft's raw markdown, since the sign-in
// gate is client-side only — onto the public domain.
import { describe, it, expect } from 'vitest';
import {
  includeCmsIntegration,
  includeCutoverRunbook,
  includeSitemapIntegration,
} from './publishTrack';

describe('includeCmsIntegration', () => {
  // The public production build must NOT ship /admin. This is the case that
  // keeps draft markdown off harvardintech.com.
  it('excludes the CMS from the public build', () => {
    expect(includeCmsIntegration(false, false)).toBe(false);
  });

  // The gated review origin is the one place /admin belongs.
  it('includes the CMS on the review track', () => {
    expect(includeCmsIntegration(false, true)).toBe(true);
  });

  // astro dev keeps /admin so the codeyam Live Preview retains its admin
  // scenarios — the capture suite would lose coverage otherwise.
  it('includes the CMS under astro dev', () => {
    expect(includeCmsIntegration(true, false)).toBe(true);
  });

  // Dev on the review track is not a real deploy shape, but it must not
  // accidentally resolve to excluded.
  it('includes the CMS when both dev and review track are set', () => {
    expect(includeCmsIntegration(true, true)).toBe(true);
  });
});

describe('includeSitemapIntegration', () => {
  // The open, indexable site is the only one a sitemap helps.
  it('publishes a sitemap on the public track', () => {
    expect(includeSitemapIntegration(false)).toBe(true);
  });

  // A noindex origin serving Disallow has nothing to offer a sitemap. This must
  // stay in agreement with robotsTxtBody, which omits its Sitemap line on the
  // same track — disagreement means the review site advertises a URL that 404s.
  it('omits the sitemap on the review track', () => {
    expect(includeSitemapIntegration(true)).toBe(false);
  });
});

describe('includeCutoverRunbook', () => {
  // The load-bearing case. PreviewGate un-gates on the public track, so if this
  // ever returns true here the runbook is not merely visible — it is visible
  // WITHOUT a passphrase, on the domain, naming the project's soft spots. This
  // is the assertion that keeps the page's answer to its own decision D4 true.
  it('excludes the runbook from the public build', () => {
    expect(includeCutoverRunbook(false, false)).toBe(false);
  });

  // The gated review origin is where the team reads it — the same place /admin
  // lives, and for the same reason.
  it('includes the runbook on the review track', () => {
    expect(includeCutoverRunbook(false, true)).toBe(true);
  });

  // Dev keeps it, or the codeyam scenarios that capture the checklist have no
  // route to capture.
  it('includes the runbook under astro dev', () => {
    expect(includeCutoverRunbook(true, false)).toBe(true);
  });

  // Not a real deploy shape; must not resolve to excluded by accident.
  it('includes the runbook when both dev and review track are set', () => {
    expect(includeCutoverRunbook(true, true)).toBe(true);
  });
});

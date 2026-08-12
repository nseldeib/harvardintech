import { describe, it, expect } from 'vitest';
import { gateAppliesTo } from './previewGate';

// Which pages the review track's `crimson2026` passphrase overlay covers.
//
// The gate itself is a deterrent that ships in the client bundle, so these tests
// are not about security strength — they are about the one deliberate hole in
// it. A CMS preview link exists to be handed to an outside reviewer who has no
// account and no reason to hold the site passphrase; gating those URLs would
// mean sending the link and the passphrase together, which hands that reviewer
// the entire unreleased site to read one page. The exemption is the feature.
//
// Kept as a pure predicate rather than a branch inside PreviewGate.astro for the
// reason publishTrack.ts gives: a decision that can only be exercised by a real
// `astro build` is a decision nothing can test.
describe('gateAppliesTo', () => {
  // the ordinary case — every real page on the review origin stays behind the
  // passphrase, which is the whole point of the review track
  it('gates ordinary site pages', () => {
    expect(gateAppliesTo('/')).toBe(true);
    expect(gateAppliesTo('/donate')).toBe(true);
    expect(gateAppliesTo('/blog/welcome')).toBe(true);
    expect(gateAppliesTo('/chapters/nyc')).toBe(true);
  });

  // the exemption: a preview page is reached by an unguessable URL instead
  it('exempts a preview page in any routed collection', () => {
    expect(gateAppliesTo('/blog/preview-7fk3q9wc2mbn5xr8dt4vha6j0e')).toBe(false);
    expect(gateAppliesTo('/chapters/preview-j2x9m5w7qd3fb8kn0rvt6chsa1')).toBe(false);
    expect(gateAppliesTo('/volunteer/projects/preview-abc123')).toBe(false);
  });

  // the shareable list is exempt for the same reason as the pages it links to —
  // gating the index while exempting its targets would be the worst of both
  it('exempts the shareable previews index', () => {
    expect(gateAppliesTo('/previews/qsrwe18v5cm4ccas8pffxktt4c')).toBe(false);
  });

  // the deploy serves under /harvardintech today and a bare domain after the
  // cutover, so the rule must not depend on which one it is
  it('exempts a preview under a base path', () => {
    expect(gateAppliesTo('/harvardintech/blog/preview-7fk3q9wc2mbn5xr8dt4vha6j0e')).toBe(false);
    expect(gateAppliesTo('/harvardintech/previews/qsrwe18v5cm4ccas8pffxktt4c')).toBe(false);
  });

  // Astro emits directory-style URLs, so the same page arrives both ways
  it('exempts a preview with a trailing slash', () => {
    expect(gateAppliesTo('/blog/preview-7fk3q9wc2mbn5xr8dt4vha6j0e/')).toBe(false);
  });

  // the dangerous near-miss: a REAL page whose slug merely contains the word
  // preview must stay gated. Exempting it would silently un-gate ordinary
  // content, which is the failure mode with no visible symptom.
  it('still gates a real page whose slug merely contains "preview"', () => {
    expect(gateAppliesTo('/blog/my-preview-of-2026')).toBe(true);
    expect(gateAppliesTo('/blog/preview')).toBe(true);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { buildDeployMarker, readBuildStampEnv } from '@codeyam/cms/lib/buildEnv';
import {
  DEPLOY_MARKER_ENTRYPOINT,
  DEPLOY_MARKER_PATTERN,
  injectDeployMarkerRoute,
} from '@codeyam/cms/integration';

// Contract guard for the deploy marker this site no longer owns.
//
// `/deploy-status.json` is the build-time proof of CDN propagation: a changed
// `commit` in the *served* file means the new bytes are genuinely live, which a
// GitHub Pages "build complete" can precede. This repo used to implement it
// itself, in `src/pages/deploy-status.json.ts` plus `src/lib/deployStatus.ts`.
// Both were deleted once `@codeyam/cms` 0.2.0 began injecting the same route,
// so the capability now arrives entirely from the package.
//
// That deletion is only safe while the package keeps its side of the bargain,
// and nothing else in this repo checks that it does — a downgrade to 0.1.0 (no
// `deploy-status.json.ts` at all) or a change to the payload shape would remove
// the marker silently, with a green build and a 404 that only shows up in
// production. These tests are the tripwire: they fail at `npm test` rather than
// at deploy time.
//
// Mirrors `src/data/collections.test.ts`, which guards the CMS collection
// registry the same way — a package contract this repo depends on, asserted
// from this repo rather than assumed.
describe('deploy marker contract', () => {
  // On CI both identifiers come straight from the Actions runner environment,
  // which is what makes the served marker change exactly when new bytes ship.
  it('stamps the build commit and run id from the environment', () => {
    const marker = buildDeployMarker(
      { GITHUB_SHA: 'a1b2c3d4e5f6', GITHUB_RUN_ID: '17654321' },
      new Date('2026-07-29T14:00:00.000Z'),
    );

    expect(marker.commit).toBe('a1b2c3d4e5f6');
    expect(marker.runId).toBe('17654321');
  });

  // The payload keys are the contract itself: the site's deleted endpoint
  // emitted exactly these three, so any consumer written against the old file
  // keeps working. A renamed or dropped key is a breaking change.
  it('emits exactly the commit, runId and builtAt keys', () => {
    const marker = buildDeployMarker(
      { GITHUB_SHA: 'deadbeef', GITHUB_RUN_ID: '1' },
      new Date('2026-07-29T14:00:00.000Z'),
    );

    expect(Object.keys(marker).sort()).toEqual(['builtAt', 'commit', 'runId']);
  });

  // Off CI both variables are unset and the marker must be a CONSTANT, so a
  // local build can never look like a fresh deployment to change detection.
  // This is the one place the package differs from the endpoint it replaced:
  // the old site version emitted `runId: null` here.
  it('falls back to the local sentinel for both fields off CI', () => {
    const marker = buildDeployMarker({}, new Date('2026-07-29T14:00:00.000Z'));

    expect(marker.commit).toBe('local');
    expect(marker.runId).toBe('local');
  });

  // An empty string is what a runner writes for a variable that is declared but
  // unpopulated, and it must degrade to the same sentinel — an empty `commit`
  // would compare unequal to itself across builds and fake a deployment.
  it('treats an empty environment variable as off CI', () => {
    const marker = buildDeployMarker(
      { GITHUB_SHA: '', GITHUB_RUN_ID: '' },
      new Date('2026-07-29T14:00:00.000Z'),
    );

    expect(marker.commit).toBe('local');
    expect(marker.runId).toBe('local');
  });

  // `builtAt` comes from the injected clock rather than an internal read, which
  // is what makes the whole payload testable without an Actions runner.
  it('stamps builtAt from the supplied clock as an ISO string', () => {
    const marker = buildDeployMarker(
      { GITHUB_SHA: 'abc', GITHUB_RUN_ID: '2' },
      new Date('2026-07-29T14:00:00.000Z'),
    );

    expect(marker.builtAt).toBe('2026-07-29T14:00:00.000Z');
  });

  // Reading the environment is guarded because `process` is absent in a browser
  // or edge runtime, where an unguarded `process.env` would throw at module
  // scope. Under Node it must still return the real environment object.
  it('reads the build environment without throwing', () => {
    expect(() => readBuildStampEnv()).not.toThrow();
    expect(typeof readBuildStampEnv()).toBe('object');
  });

  // The marker must stay OUTSIDE the admin base. The editor reads it as an
  // anonymous visitor of the deployed site, so mounting it behind the dashboard
  // would stop it witnessing what a reader is actually served.
  it('mounts the marker at the public site root rather than under the admin base', () => {
    expect(DEPLOY_MARKER_PATTERN).toBe('/deploy-status.json');
    expect(DEPLOY_MARKER_PATTERN.startsWith('/admin')).toBe(false);
  });

  // The route is injected by package specifier, not absolute path, so it
  // resolves inside node_modules the way an npm-installed consumer resolves it.
  it('injects the route at the marker pattern using the package entrypoint', () => {
    const injectRoute = vi.fn();

    injectDeployMarkerRoute(injectRoute);

    expect(injectRoute).toHaveBeenCalledTimes(1);
    expect(injectRoute).toHaveBeenCalledWith({
      pattern: DEPLOY_MARKER_PATTERN,
      entrypoint: DEPLOY_MARKER_ENTRYPOINT,
    });
    expect(DEPLOY_MARKER_ENTRYPOINT).toBe('@codeyam/cms/pages/deploy-status.json.ts');
  });
});

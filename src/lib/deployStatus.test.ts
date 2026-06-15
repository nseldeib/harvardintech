import { describe, it, expect } from 'vitest';
import {
  deployBaseFromPath,
  markerUrl,
  viewSiteUrl,
  parseBackendRepo,
  pickLatestDeployRun,
  mapRunPhase,
  computeBanner,
  relativeTime,
  DEPLOY_WORKFLOW_PATH,
  SLOW_AFTER_MS,
  type ActionsRun,
  type DeployMarker,
} from './deployStatus';

describe('deployBaseFromPath', () => {
  // Custom-domain root: the editor sits at base ''.
  it('returns empty base for the custom-domain editor path', () => {
    expect(deployBaseFromPath('/admin/editor/')).toBe('');
  });
  // Custom-domain root: the dashboard sits at base ''.
  it('returns empty base for the custom-domain dashboard path', () => {
    expect(deployBaseFromPath('/admin')).toBe('');
  });
  // Project-subpath mode: everything before /admin is the base for the editor path.
  it('returns the subpath base for the project-subpath editor path', () => {
    expect(deployBaseFromPath('/harvardintech/admin/editor/')).toBe('/harvardintech');
  });
  // Project-subpath mode: everything before /admin is the base for the dashboard path.
  it('returns the subpath base for the project-subpath dashboard path', () => {
    expect(deployBaseFromPath('/harvardintech/admin')).toBe('/harvardintech');
  });
  // A path with no /admin segment has no derivable base.
  it('falls back to empty base when there is no admin segment', () => {
    expect(deployBaseFromPath('/events')).toBe('');
  });
});

describe('markerUrl / viewSiteUrl', () => {
  // At the empty base the marker and view URLs are domain-rooted.
  it('builds root marker and view URLs at the empty base', () => {
    expect(markerUrl('')).toBe('/deploy-status.json');
    expect(viewSiteUrl('')).toBe('/');
  });
  // Under a subpath base both URLs are prefixed with the base.
  it('builds subpath marker and view URLs', () => {
    expect(markerUrl('/harvardintech')).toBe('/harvardintech/deploy-status.json');
    expect(viewSiteUrl('/harvardintech')).toBe('/harvardintech/');
  });
});

describe('parseBackendRepo', () => {
  const CONFIG = `
backend:
  name: github
  repo: jaredcosulich/harvardintech
  branch: main
  auth_methods: [token]
`;
  // The repo and branch are pulled straight out of the CMS config text.
  it('pulls repo and branch out of the CMS config', () => {
    expect(parseBackendRepo(CONFIG)).toEqual({
      repo: 'jaredcosulich/harvardintech',
      branch: 'main',
    });
  });
  // An absent branch defaults to main, matching the CMS default.
  it('defaults the branch to main when omitted', () => {
    expect(parseBackendRepo('backend:\n  repo: owner/repo\n')).toEqual({
      repo: 'owner/repo',
      branch: 'main',
    });
  });
  // No repo means no Actions target, so the parse returns null.
  it('returns null when no repo is configured', () => {
    expect(parseBackendRepo('backend:\n  name: github\n')).toBeNull();
  });
});

describe('mapRunPhase', () => {
  // A missing run is unknown, never a phase.
  it('maps a missing run to unknown', () => {
    expect(mapRunPhase(null)).toBe('unknown');
  });
  // An in-progress run is still building.
  it('maps an in-progress run to building', () => {
    expect(mapRunPhase({ status: 'in_progress' })).toBe('building');
  });
  // A queued run has not started executing yet, so it is building.
  it('maps a queued run to building', () => {
    expect(mapRunPhase({ status: 'queued' })).toBe('building');
  });
  // A completed success is the succeeded phase.
  it('maps a completed success to succeeded', () => {
    expect(mapRunPhase({ status: 'completed', conclusion: 'success' })).toBe('succeeded');
  });
  // A completed failure is the failed phase.
  it('maps a completed failure to failed', () => {
    expect(mapRunPhase({ status: 'completed', conclusion: 'failure' })).toBe('failed');
  });
  // A timed-out completion is treated as a failure.
  it('maps a timed_out completion to failed', () => {
    expect(mapRunPhase({ status: 'completed', conclusion: 'timed_out' })).toBe('failed');
  });
  // A cancelled completion is unknown so it never masquerades as a real failure.
  it('treats a cancelled completion as unknown, not failed', () => {
    expect(mapRunPhase({ status: 'completed', conclusion: 'cancelled' })).toBe('unknown');
  });
});

describe('pickLatestDeployRun', () => {
  const runs: ActionsRun[] = [
    {
      id: 1,
      path: DEPLOY_WORKFLOW_PATH,
      status: 'completed',
      conclusion: 'cancelled',
      run_started_at: '2026-06-15T10:00:00Z',
    },
    {
      id: 2,
      path: DEPLOY_WORKFLOW_PATH,
      status: 'in_progress',
      run_started_at: '2026-06-15T10:05:00Z',
    },
    {
      id: 3,
      path: '.github/workflows/other.yml',
      status: 'in_progress',
      run_started_at: '2026-06-15T10:10:00Z',
    },
  ];
  // The most recent deploy-workflow run wins, ignoring other workflows entirely.
  it('picks the most recent run for the deploy workflow, skipping other workflows', () => {
    const picked = pickLatestDeployRun(runs, { workflowPath: DEPLOY_WORKFLOW_PATH });
    expect(picked?.id).toBe(2);
  });
  // No run for the requested workflow path yields null.
  it('returns null when no run matches the workflow path', () => {
    expect(pickLatestDeployRun(runs, { workflowPath: '.github/workflows/none.yml' })).toBeNull();
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-06-15T12:00:00Z').valueOf();
  // Under a minute reads as just now.
  it('reports just now under a minute', () => {
    expect(relativeTime(now - 30 * 1000, now)).toBe('just now');
  });
  // Exactly one minute uses the singular unit.
  it('reports singular minute', () => {
    expect(relativeTime(now - 60 * 1000, now)).toBe('1 minute ago');
  });
  // Several minutes use the plural unit.
  it('reports plural minutes', () => {
    expect(relativeTime(now - 5 * 60 * 1000, now)).toBe('5 minutes ago');
  });
  // Past an hour it rolls up to hours.
  it('reports hours', () => {
    expect(relativeTime(now - 3 * 60 * 60 * 1000, now)).toBe('3 hours ago');
  });
  // Past a day it rolls up to days.
  it('reports days', () => {
    expect(relativeTime(now - 2 * 24 * 60 * 60 * 1000, now)).toBe('2 days ago');
  });
});

describe('computeBanner', () => {
  const now = new Date('2026-06-15T12:00:00Z').valueOf();
  const baseInput = {
    baselineCommit: 'abc123',
    marker: null as DeployMarker | null,
    runPhase: 'unknown' as const,
    savedAtMs: now - 10 * 1000,
    nowMs: now,
    viewHref: '/',
  };

  // Just after a save with no marker change and no run info, it is deploying.
  it('shows deploying right after a save with marker unchanged and no run info', () => {
    const view = computeBanner(baseInput);
    expect(view.state).toBe('deploying');
    expect(view.title).toMatch(/Deploying/);
  });

  // An in-progress Actions run upgrades the banner to building.
  it('shows building when the Actions run is in progress', () => {
    const view = computeBanner({ ...baseInput, runPhase: 'building' });
    expect(view.state).toBe('building');
  });

  // A marker commit differing from baseline is the authoritative live signal.
  it('flips to live once the marker commit differs from baseline and wins over everything', () => {
    const view = computeBanner({
      ...baseInput,
      runPhase: 'building',
      marker: { commit: 'def456', runId: '99', builtAt: '2026-06-15T11:59:00Z' },
    });
    expect(view.state).toBe('live');
    expect(view.link?.href).toBe('/');
  });

  // The marker-change live signal even overrides a failed run phase.
  it('a marker change wins even when the run reports failed', () => {
    const view = computeBanner({
      ...baseInput,
      runPhase: 'failed',
      marker: { commit: 'def456', runId: '99', builtAt: '2026-06-15T11:59:00Z' },
    });
    expect(view.state).toBe('live');
  });

  // A failed run with an unchanged marker surfaces the failed state and a logs link.
  it('shows failed when the run failed and the marker has not moved', () => {
    const view = computeBanner({
      ...baseInput,
      runPhase: 'failed',
      marker: { commit: 'abc123', runId: '99', builtAt: '2026-06-15T11:00:00Z' },
      runUrl: 'https://github.com/o/r/actions/runs/99',
    });
    expect(view.state).toBe('failed');
    expect(view.link?.href).toContain('/actions/runs/99');
  });

  // A deploy running past the slow threshold escalates to the slow state.
  it('escalates to slow past the threshold', () => {
    const view = computeBanner({
      ...baseInput,
      savedAtMs: now - (SLOW_AFTER_MS + 1000),
    });
    expect(view.state).toBe('slow');
  });

  // With no active save the banner is idle and reports the last deploy time.
  it('shows idle with last-deployed time when there is no active save', () => {
    const view = computeBanner({
      ...baseInput,
      savedAtMs: null,
      marker: { commit: 'abc123', runId: '7', builtAt: '2026-06-15T11:30:00Z' },
    });
    expect(view.state).toBe('idle');
    expect(view.detail).toMatch(/Last deployed/);
  });
});

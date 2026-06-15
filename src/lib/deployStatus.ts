// Pure, framework-free helpers for the CMS deploy-status banner. They carry the
// whole "is my saved change live yet?" decision — base-path derivation, marker
// URLs, the CMS-config repo parse, the Actions-run phase mapping, and the banner
// state machine — as data-in/data-out functions so they can be unit-tested under
// vitest without a DOM. Mirrors the `gallery.ts` / `events.ts` split: the pure
// helpers here are the canonical spec; the `.astro` client island and the
// `public/admin/editor/deploy-status.js` mirror are thin wiring on top.
//
// The signal model is HYBRID. The build-time marker (`/deploy-status.json`,
// which bakes the deployed commit SHA in at build time) is the authoritative
// "live" source — when its commit changes from the baseline captured at save,
// the new content is genuinely served (CDN propagation included). The GitHub
// Actions run phase is strictly ADDITIVE enrichment: it lets the banner say
// "Building…" and, crucially, surface a "Deploy failed" the marker alone can't
// (a failed build just never bumps the SHA).

/** The shape baked into `/deploy-status.json` at build time. */
export interface DeployMarker {
  /** The deployed commit SHA (or `"local"` for a non-CI build). */
  commit: string;
  /** The Actions run id that built this, when known. */
  runId: string | null;
  /** ISO timestamp of when the build ran. */
  builtAt: string;
}

/** A workflow run as returned by the GitHub Actions REST API (subset we read). */
export interface ActionsRun {
  id?: number;
  /** queued | in_progress | waiting | pending | completed | … */
  status?: string | null;
  /** success | failure | cancelled | timed_out | … (only once completed) */
  conclusion?: string | null;
  /** The workflow file path, e.g. `.github/workflows/deploy.yml`. */
  path?: string | null;
  head_branch?: string | null;
  html_url?: string | null;
  run_started_at?: string | null;
  created_at?: string | null;
}

/** Normalised lifecycle phase of the latest deploy run. */
export type RunPhase = 'building' | 'failed' | 'succeeded' | 'unknown';

/** The banner's distinct visual states. */
export type BannerState = 'idle' | 'deploying' | 'building' | 'live' | 'failed' | 'slow';

/** Tone token per state — drives the banner's colour treatment. */
export type BannerTone = 'accent' | 'success' | 'danger' | 'muted';

export interface BannerLink {
  href: string;
  label: string;
}

/** The fully-resolved banner the UI renders. */
export interface BannerView {
  state: BannerState;
  title: string;
  detail: string;
  link?: BannerLink;
}

/** Tone per banner state, shared by the server render and the client island. */
export const BANNER_TONE: Record<BannerState, BannerTone> = {
  idle: 'muted',
  deploying: 'accent',
  building: 'accent',
  live: 'success',
  failed: 'danger',
  slow: 'accent',
};

/** The workflow file whose runs publish the site — the Actions enrichment target. */
export const DEPLOY_WORKFLOW_PATH = '.github/workflows/deploy.yml';

/** Default escalation threshold: a deploy "taking longer than usual" past 3 min. */
export const SLOW_AFTER_MS = 3 * 60 * 1000;

/**
 * Derive the site base path from an admin URL pathname so the marker/view URLs
 * resolve under BOTH base modes: the custom-domain root (`/admin/editor/` →
 * base `''`) and the project subpath (`/harvardintech/admin/editor/` → base
 * `/harvardintech`). Works for the dashboard (`/admin`) and the editor
 * (`/admin/editor/`) alike — everything up to the `/admin` segment is the base.
 */
export function deployBaseFromPath(pathname: string): string {
  const match = pathname.match(/^(.*?)\/admin(?:\/|$)/);
  return match ? match[1] : '';
}

/** The build marker URL for a given base (`''` → `/deploy-status.json`). */
export function markerUrl(base: string): string {
  return `${base}/deploy-status.json`;
}

/** The live-site URL for a given base (`''` → `/`, `/harvardintech` → `/harvardintech/`). */
export function viewSiteUrl(base: string): string {
  return `${base}/`;
}

/**
 * Pull `repo` and `branch` out of the Sveltia/Decap `config.yml` text so the
 * Actions API target isn't hard-coded. Returns null when no `repo:` is present
 * (so the caller silently skips Actions enrichment). `branch` defaults to
 * `main` when absent, matching the CMS default.
 */
export function parseBackendRepo(configYaml: string): { repo: string; branch: string } | null {
  const repo = configYaml.match(/^\s*repo:\s*([^\s#]+)/m)?.[1];
  if (!repo) return null;
  const branch = configYaml.match(/^\s*branch:\s*([^\s#]+)/m)?.[1] ?? 'main';
  return { repo, branch };
}

/** Start time of a run in epoch ms (run_started_at, falling back to created_at). */
function runStartedMs(run: ActionsRun): number {
  const stamp = run.run_started_at ?? run.created_at;
  const ms = stamp ? new Date(stamp).valueOf() : NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Choose the most recent deploy-workflow run from an Actions API list. Filters
 * to runs of `opts.workflowPath`, then takes the latest by start time —
 * tolerating the `cancelled` runs the deploy workflow's `cancel-in-progress`
 * concurrency leaves behind (they stay in the list but a newer run supersedes
 * them). Returns null when no run matches.
 */
export function pickLatestDeployRun(
  runs: ActionsRun[],
  opts: { workflowPath: string },
): ActionsRun | null {
  const matching = runs.filter((r) => r.path === opts.workflowPath);
  if (matching.length === 0) return null;
  return matching.slice().sort((a, b) => runStartedMs(b) - runStartedMs(a))[0];
}

/**
 * Map a run's `status`/`conclusion` to a normalised phase. Anything not yet
 * `completed` is `building`; a completed `success` is `succeeded`; a
 * `failure`/`timed_out` is `failed`. A `cancelled`/`skipped`/`neutral`
 * completion (from `cancel-in-progress`) and a missing run are `unknown` so they
 * never masquerade as a real failure.
 */
export function mapRunPhase(run: ActionsRun | null): RunPhase {
  if (!run || !run.status) return 'unknown';
  if (run.status !== 'completed') return 'building';
  if (run.conclusion === 'success') return 'succeeded';
  if (run.conclusion === 'failure' || run.conclusion === 'timed_out') return 'failed';
  return 'unknown';
}

/** Inputs to the banner state machine. */
export interface ComputeBannerInput {
  /** The live commit captured when the editor saved (null on the ambient dashboard until known). */
  baselineCommit: string | null;
  /** The latest polled marker (null until the first poll resolves). */
  marker: DeployMarker | null;
  /** The Actions enrichment phase (`unknown` when no token / Actions unavailable). */
  runPhase: RunPhase;
  /** When the editor saved, epoch ms; null means no active deploy (ambient/idle). */
  savedAtMs: number | null;
  /** Current time, epoch ms. */
  nowMs: number;
  /** Escalate to `slow` once a deploy has run longer than this. */
  slowAfterMs?: number;
  /** Href for the "View live site" action. */
  viewHref: string;
  /** Href for the failed-run logs (the run's `html_url`), when known. */
  runUrl?: string | null;
}

/**
 * Human "N units ago" for a build timestamp. Coarse on purpose — the banner
 * only needs an at-a-glance freshness, not precision.
 */
export function relativeTime(fromMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - fromMs);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * The banner state machine. Precedence, highest first:
 *   1. marker commit changed from baseline ⇒ `live` (authoritative — the CDN is
 *      genuinely serving the new content; wins over every Actions signal).
 *   2. Actions phase `failed` ⇒ `failed` (the marker alone can't show this — a
 *      failed build just never bumps the SHA).
 *   3. an active deploy that's `building` (Actions) or `deploying` (marker-only),
 *      escalating to `slow` once it has run past `slowAfterMs`.
 *   4. otherwise `idle` — "up to date", with the last build's relative time.
 */
export function computeBanner(input: ComputeBannerInput): BannerView {
  const {
    baselineCommit,
    marker,
    runPhase,
    savedAtMs,
    nowMs,
    slowAfterMs = SLOW_AFTER_MS,
    viewHref,
    runUrl,
  } = input;

  const viewLink: BannerLink = { href: viewHref, label: 'View live site' };

  // 1. Marker change wins outright.
  if (marker && baselineCommit && marker.commit !== baselineCommit) {
    return {
      state: 'live',
      title: '🎉 Your change is live',
      detail: 'The site has finished publishing and is serving your edit.',
      link: viewLink,
    };
  }

  // 2. A failed deploy run (marker hasn't moved).
  if (runPhase === 'failed') {
    return {
      state: 'failed',
      title: 'Deploy failed',
      detail: 'The publish run did not complete. Your change is saved but not yet live.',
      link: runUrl ? { href: runUrl, label: 'View build logs' } : undefined,
    };
  }

  const active = savedAtMs != null;
  const isSlow = active && nowMs - savedAtMs > slowAfterMs;

  // 3. An active deploy in flight.
  if (active) {
    if (isSlow) {
      return {
        state: 'slow',
        title: 'Still deploying…',
        detail: 'This is taking longer than usual. Large changes can take a few extra minutes.',
      };
    }
    if (runPhase === 'building') {
      return {
        state: 'building',
        title: 'Building your change…',
        detail: 'GitHub is building the site. It will be live shortly.',
      };
    }
    return {
      state: 'deploying',
      title: 'Deploying…',
      detail: 'Publishing your change — this usually takes about a minute.',
    };
  }

  // 4. Idle / ambient.
  const builtMs = marker && marker.builtAt ? new Date(marker.builtAt).valueOf() : NaN;
  const when = Number.isNaN(builtMs) ? null : relativeTime(builtMs, nowMs);
  return {
    state: 'idle',
    title: 'Up to date',
    detail: when ? `Last deployed ${when}.` : 'No deploy in progress.',
    link: viewLink,
  };
}

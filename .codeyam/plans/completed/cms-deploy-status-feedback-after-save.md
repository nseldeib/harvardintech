---
title: "cms: Deploy Status Feedback After Save"
mode: ui
createdAt: "2026-06-15T18:00:00Z"
source: manual
prefix: "cms"
---

## Summary

When an editor saves in the CMS (`/admin/editor/`, Sveltia), the change is
committed to `main`, which triggers the GitHub Pages deploy workflow — but the
editor gets no signal that publishing is underway, how long it takes, or when
their edit is actually visible on the live site. They're left refreshing
harvardintech.com guessing. This adds a deploy-status banner to the CMS that, on
save, tells the editor "Deploying — this usually takes about a minute," then
flips to "🎉 Your change is live" once it's genuinely served, with a link to
view it. Detection is **hybrid**: a build-time marker the admin polls is the
reliable backbone (auth-free, confirms the CDN actually updated), enriched —
when a capable GitHub token is available — by the Actions API so the banner can
also show "Building…" and, importantly, "Deploy failed."

## Key Decisions

- **Build marker is the source of truth for "live."** A prerendered
  `/deploy-status.json` bakes the commit SHA in at build time; the admin polls
  it and treats a SHA change as "the new content is actually live" — including
  GitHub Pages CDN propagation, which an Actions "completed" status can precede.
  No extra token scope, and it works in both hosted-token and local-repository
  modes.
- **GitHub Actions API is enrichment, not the backbone.** Polling the deploy
  run (`queued`/`in_progress`/`completed` + `conclusion`) lets the banner show
  "Building…" and surface **build failures** (which the marker alone can't, since
  a failed build just never bumps the SHA). It's strictly additive: the CMS PAT
  is scoped **Contents: Read & Write** and won't have **Actions: Read**, and
  local mode has no token — so the Actions call is wrapped in feature-detection
  and any 401/403/404/absent-token path silently degrades to marker-only.
- **Don't hard-couple to Sveltia internals for the save signal.** Register the
  Decap-compatible `postSave`/`postPublish` listeners for the instant "Deploying"
  banner, but ALSO run a continuous marker watcher so the "now live" toast still
  fires even if the event hook name changes in a future Sveltia version. The
  event hook is the nicety; the watcher is the guarantee.
- **Pure logic in a tested lib; thin wiring at the edges.** The state machine
  and URL/parse helpers live in `src/lib/deployStatus.ts` with vitest coverage
  and drive an Astro dashboard component (the scenario surface). The Sveltia
  editor page is raw `public/` HTML that Astro does not bundle, so its
  `deploy-status.js` carries a minimal mirror of just the calls it needs — the
  lib remains the canonical, tested spec.

## Implementation

### 1. Build-time deploy marker

**New file**: `src/pages/deploy-status.json.ts`

A prerendered Astro endpoint (`export const prerender = true; export function GET()`)
emitting JSON: `{ commit, runId, builtAt }`. Read `process.env.GITHUB_SHA` and
`process.env.GITHUB_RUN_ID` (set automatically in the Actions runner during the
`withastro/action` build) and stamp `builtAt` with the build time. When the env
vars are unset (local `astro build`/dev), fall back to `{ commit: "local",
runId: null, builtAt: <now> }`. Output `output: 'static'` already prerenders
this to `/deploy-status.json` in `dist/`, served by GitHub Pages. No
`deploy.yml` change is needed — `GITHUB_SHA`/`GITHUB_RUN_ID` are default
runner env vars available to the build step.

### 2. Pure status logic (tested)

**New file**: `src/lib/deployStatus.ts`

Framework-free helpers (no DOM), mirroring the `src/lib/gallery.ts` /
`src/lib/events.ts` "pure helpers + thin wiring" split:

- `deployBaseFromPath(pathname)` — derive the site base from the admin URL so
  it works under both the custom-domain base (`/admin/editor/` → base `''`) and
  the project-subpath base (`/harvardintech/admin/editor/` → base
  `/harvardintech`). Splits on `/admin/`.
- `markerUrl(base)` / `viewSiteUrl(base)` — `${base}/deploy-status.json` and
  `${base}/`.
- `parseBackendRepo(configYaml)` — pull `repo` and `branch` out of the CMS
  `config.yml` text so the Actions API target isn't hard-coded (the editor
  script fetches its sibling `./config.yml`).
- `pickLatestDeployRun(runs, { workflowPath })` — choose the most recent run for
  `.github/workflows/deploy.yml` on `main`, tolerating `cancelled` runs from the
  workflow's `cancel-in-progress` concurrency.
- `mapRunPhase(run)` — `'building' | 'failed' | 'succeeded' | 'unknown'` from a
  run's `status`/`conclusion`.
- `computeBanner({ baselineCommit, marker, runPhase, savedAtMs, nowMs, slowAfterMs })`
  — the state machine returning `{ state, title, detail, link? }` where `state`
  ∈ `idle | deploying | building | live | failed | slow`. Rules: a marker
  `commit` that differs from `baselineCommit` ⇒ `live` (authoritative, wins over
  everything); `runPhase==='failed'` while the marker is unchanged ⇒ `failed`;
  otherwise `building` (if the run is known to be running) or `deploying`,
  escalating to `slow` once `nowMs - savedAtMs > slowAfterMs` (~3 min) so a long
  or stuck deploy gets an honest "taking longer than usual" message instead of
  spinning forever.

**New file**: `src/lib/deployStatus.test.ts`

vitest covering `deployBaseFromPath` (both base modes), `parseBackendRepo`,
`mapRunPhase` across statuses/conclusions, `pickLatestDeployRun` with a
cancelled run in the list, and `computeBanner` transitions (deploying → live,
deploying → failed, deploying → slow, and marker-change-wins-over-failed).

### 3. Dashboard status component (scenario surface)

**New file**: `src/components/admin/DeployStatus.astro`

A status banner/pill rendered on the `/admin` dashboard. A small client island
imports the helpers from `src/lib/deployStatus.ts`, captures the baseline live
commit on load, and — when the document is visible — polls `markerUrl(base)`
(cache-busted, `cache: 'no-store'`) on an interval, optionally enriching with
the Actions API (step 5). It renders the `computeBanner` state: a spinner +
"Deploying…/Building…" copy, a green "Live" state with a **View live site**
link, a red "Deploy failed" state linking to the run's `html_url`, and a muted
idle state ("Up to date — last deployed <relative time>"). Pause polling when
`document.hidden`.

**Edit**: `src/pages/admin/index.astro`

Render `<DeployStatus />` near the top of the dashboard (alongside
`DashboardSummary`). On `localhost` the component shows a muted "Local preview —
changes publish when committed and pushed" note instead of polling, since there
is no live deploy locally.

### 4. In-editor banner (the actual save moment)

**New file**: `public/admin/editor/deploy-status.js`

A self-contained ESM module served verbatim (public/ is not bundled, so it can't
import the lib — it carries a minimal mirror of the base-parse + compare + fetch
calls; `src/lib/deployStatus.ts` stays the canonical tested spec). On load it:

- registers `window.CMS.registerEventListener({ name: 'postSave', handler })`
  and the same for `postPublish` (best-effort; wrapped so a missing/renamed API
  is a no-op) — on fire, it records `savedAt`, captures the current live commit
  as the baseline, and shows the "Deploying — usually about a minute" banner;
- runs a continuous marker watcher (also armed independently of the event hook)
  so the "now live" flip is guaranteed; when the polled `commit` differs from the
  baseline, it swaps to "🎉 Your change is live" + a **View live site** link and
  stops;
- best-effort Actions enrichment (step 5) for "Building…"/"Deploy failed";
- injects a fixed-position banner element into the editor DOM (its own node,
  outside Sveltia's app root so Sveltia re-renders don't clobber it).

**Edit**: `public/admin/editor/index.html`

Add `<script type="module" src="./deploy-status.js"></script>` after the Sveltia
script tag, plus a minimal `<style>` for the banner (or inject styles from the
script).

### 5. Optional GitHub Actions enrichment

Inside both the dashboard island and the editor script, behind feature-detection:

- Resolve `{ repo, branch }` via `parseBackendRepo` (editor: fetch `./config.yml`;
  dashboard: same, fetched relative to base).
- Best-effort obtain the GitHub token Sveltia persists for the editor (its
  storage key is version-specific — read defensively and treat absence as "no
  enrichment"). Never log the token.
- `GET https://api.github.com/repos/{repo}/actions/runs?branch={branch}&per_page=10`
  with `Authorization: Bearer <token>` and `Accept: application/vnd.github+json`;
  feed results through `pickLatestDeployRun` + `mapRunPhase`.
- Any `401/403` (token lacks **Actions: Read**), `404`, network error, or
  missing token ⇒ silently skip enrichment and rely on the marker. The banner
  must be fully functional with marker-only signals.

## Reused existing code

- `withBase` from `src/lib/url.ts` — base-aware URLs in the dashboard component
  (glossary entry: `withBase`-family; verify exact name via `glossary-find`).
- The `src/lib/gallery.ts` / `src/lib/events.ts` "pure helpers + `.test.ts` +
  thin wiring" pattern (glossary entries: `galleryRevealImmediately`,
  `splitEvents`) — `src/lib/deployStatus.ts` follows the same shape.
- `src/components/admin/` section-component convention (`DashboardSummary.astro`,
  `CollectionCountGrid.astro`) — `DeployStatus.astro` matches it and slots into
  `src/pages/admin/index.astro` exactly like the existing sections.
- `public/admin/editor/index.html` already loads an external script (the Sveltia
  CDN bundle) and auto-initializes — adding a second `<script>` follows the same
  no-inline-init convention documented in its comment.

## Scenarios to Demonstrate

Captured against the `DeployStatus` dashboard component (the scenario surface),
one per banner state:

- **Deploying** — just saved; marker SHA still matches baseline, no run info yet
  ("Deploying — usually about a minute").
- **Building** — Actions run `in_progress` ("Building your change…").
- **Live** — marker SHA changed from baseline (green "Your change is live" +
  View-site link).
- **Deploy failed** — run `completed`/`failure`, marker unchanged (red state +
  View-logs link).
- **Slow / taking longer** — still deploying past the ~3-minute threshold.
- **Idle / up to date** — no recent save; "Last deployed <relative time>".
- **Local preview** — `localhost` muted note, no polling.

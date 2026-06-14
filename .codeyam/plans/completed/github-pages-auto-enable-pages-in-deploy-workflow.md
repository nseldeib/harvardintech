---
title: "github-pages: Auto-Enable Pages in Deploy Workflow"
mode: ui
createdAt: "2026-06-13T19:26:29Z"
source: manual
prefix: "github-pages"
---

## Summary

The static-site template ships a working `.github/workflows/deploy.yml` that
builds the Astro site and deploys it with `actions/deploy-pages@v4`, but the
deploy job fails on a fresh repo with `HttpError: Not Found (404) ... Ensure
GitHub Pages has been enabled` until someone manually toggles **Settings →
Pages → Source: GitHub Actions**. That manual step is the single remaining
piece of out-of-band setup in an otherwise turnkey template. This plan bakes
the enablement into the workflow itself by adding an `actions/configure-pages`
step with `enablement: true`, so the first push to `main` creates the Pages
site (build type "workflow") automatically. Because token-based enablement can
still be blocked under some org/permission policies, the plan also ships a
clear, copy-paste fallback (one `gh api` call or the UI toggle) and a small
helper script, and rewrites the docs to lead with the now-automatic path.

## Key Decisions

- **Add `actions/configure-pages@v5` with `enablement: true` to the build
  job.** This is GitHub's official, documented way to enable Pages from CI:
  the action calls the Pages REST API to create the site with
  `build_type: workflow` if it doesn't already exist. It's idempotent — a
  no-op on repos where Pages is already configured — so it's safe on every
  push. It runs before the `withastro/action` build so the site exists by the
  time the `deploy` job calls `deploy-pages`.
- **Keep, don't replace, the env-driven base/site config.** `configure-pages`
  also emits a `base_path` output, but this template already drives base/site
  from `DEPLOY_BASE_PATH`/`PAGES_SITE` (see `astro.config.mjs`). We use
  `configure-pages` only for its enablement side effect and do **not** wire its
  outputs into the build, so the two base modes (custom domain vs. project
  subpath) keep working unchanged.
- **Be honest that auto-enable is best-effort, not guaranteed.** The workflow's
  `GITHUB_TOKEN` already has `pages: write`, which is sufficient on personal
  repos and most orgs. But some org policies (or repos created with restricted
  default-token permissions) still reject API-based enablement and return the
  same 404. So the plan ships a documented fallback rather than claiming the
  manual step is gone forever — the goal is "no manual step in the common case,
  with a one-command escape hatch when policy blocks it."
- **Ship a helper script for the fallback** (`scripts/enable-pages.sh`) so the
  escape hatch is one command, not a hand-assembled `gh api` invocation. It
  infers `owner/repo` from the `origin` remote and POSTs `build_type=workflow`.
- **Template-generic, no project-specific values.** All edits stay parameterized
  (placeholders / remote inference) so the change is correct for any repo
  scaffolded from this template, not just `harvardintech`.

## Implementation

### 1. Add the enablement step to the build job

**File**: `.github/workflows/deploy.yml`

In the `build` job, before the `withastro/action@v3` "Build Astro site" step,
add a checkout-adjacent enablement step:

```yaml
      - name: Enable / configure GitHub Pages
        uses: actions/configure-pages@v5
        with:
          enablement: true
```

Notes for implementation:
- It must run in the `build` job (which already has `pages: write` via the
  top-level `permissions:` block) and **before** the build step, so the Pages
  site exists by the time the separate `deploy` job runs `deploy-pages@v4`.
- Do **not** consume the action's `base_path`/`origin` outputs — base/site stay
  driven by `DEPLOY_BASE_PATH`/`PAGES_SITE`. Adding the step purely for its
  enablement side effect keeps the existing two-base-mode logic intact.
- Leave the existing `permissions`, `concurrency`, and `deploy` job as-is.

### 2. Refresh the workflow header comment

**File**: `.github/workflows/deploy.yml`

Update the top-of-file comment block (currently it tells the reader to manually
set Settings → Pages → Source: GitHub Actions as a "one time" step). Reword it
to say the workflow now enables Pages automatically on first push via
`configure-pages` with `enablement: true`, and point to the fallback script /
docs for the rare case where org policy blocks token-based enablement.

### 3. Add a fallback enablement helper script

**New file**: `scripts/enable-pages.sh`

A small, documented bash script that a human can run once if CI auto-enable is
blocked. It should:
- Require `gh` to be installed and authenticated.
- Infer `OWNER/REPO` from `git remote get-url origin` (support both
  `git@github.com:owner/repo.git` and `https://github.com/owner/repo(.git)`
  forms).
- Run `gh api -X POST repos/$OWNER/$REPO/pages -f build_type=workflow` and print
  a friendly success / "already enabled" message (treat the
  "Pages already exists" 4xx as success).
- Be marked executable (`chmod +x`).

This is the codified version of the exact command that resolved the live 404 on
`harvardintech`.

### 4. Rewrite DEPLOY_SETUP.md to lead with the automated flow

**File**: `DEPLOY_SETUP.md`

In the "Configuring GitHub Pages" section, replace the manual 3-step UI
instructions with:
- A short "It's automatic" paragraph: pushing to the default branch runs the
  deploy workflow, which enables Pages (Source: GitHub Actions) for you.
- A "If the first deploy 404s" fallback subsection covering (a) run
  `scripts/enable-pages.sh`, or (b) the manual UI toggle (kept as the
  belt-and-suspenders option), then re-run the workflow
  (`gh workflow run "Deploy to GitHub Pages" --ref <default-branch>`).
Keep the two base-mode (custom domain vs. subpath) instructions unchanged.

### 5. Cross-reference in README

**File**: `README.md`

If README has a deploy/hosting section that references the manual Pages toggle,
update that sentence to note enablement is automatic and link to
`DEPLOY_SETUP.md` for the fallback. (Read first; only touch the deploy-related
lines — skip if README doesn't currently mention Pages setup.)

## Reused existing code

- `.github/workflows/deploy.yml` — the existing build + deploy pipeline
  (`withastro/action@v3` → `actions/deploy-pages@v4`); this plan adds one step
  and a comment, it does not rewrite the pipeline.
- `astro.config.mjs` — the env-driven `base`/`site` logic
  (`DEPLOY_BASE_PATH` / `PAGES_SITE`) stays the source of truth for the base
  path; `configure-pages` outputs are deliberately not wired in.
- `DEPLOY_SETUP.md` — existing two-base-mode setup doc; only the "Configuring
  GitHub Pages" section is rewritten.

## Scenarios to Demonstrate

- **Fresh repo, first push:** Pages has never been enabled → workflow's
  `configure-pages` step creates the site → `deploy-pages` succeeds, no manual
  toggle. (This is the case that currently 404s.)
- **Already-enabled repo:** `configure-pages` is a no-op → deploy succeeds
  unchanged (idempotency).
- **Policy-blocked enablement:** token-based enable is rejected → workflow still
  surfaces the 404, and `scripts/enable-pages.sh` (or the UI toggle) plus a
  re-run resolves it. Demonstrates the documented fallback path.
- **Custom-domain mode unaffected:** with `DEPLOY_BASE_PATH` unset and a
  `public/CNAME` present, base stays `/` and the site publishes at the custom
  domain — confirming `configure-pages` didn't hijack the base config.

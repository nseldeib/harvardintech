---
title: "Two-Track Publishing: Live Site And Private Review Site"
mode: backend
createdAt: "2026-07-30T15:07:08Z"
source: manual
---

## Summary

Today this repo has exactly one deploy target and a preview gate that is an
either/or: `PREVIEW_GATE_ENABLED` in `src/lib/previewGate.ts` is
`Boolean(process.env.DEPLOY_BASE_PATH)`, so the site is *either* a gated WIP
preview at `nseldeib.github.io/harvardintech` *or* a public launch on a custom
domain — never both at once. Every `publishedEntries` call site derives
`includeDrafts` from `!import.meta.env.PROD`, so any deployed build hides drafts
exactly like production does, and there is nowhere for the HIT team to see
in-flight work.

Build a two-track publishing model: a **public track** (`main` →
`harvardintech.com`, drafts hidden, indexable) and a **review track**
(`staging` → `review.harvardintech.com`, drafts visible, passphrase-gated and
`noindex`, hosting `/admin`). Two axes phase a change: the `staging` branch
phases *code*, and the CMS Draft toggle phases *content*. Promotion to live is
a single merge `staging` → `main`.

## Key Decisions

- **The review track gets its own origin, not a subpath of the live site.** The
  obvious cheap option — emit the review build into `dist/preview/` on the same
  Pages site — is not viable for two independently-verified reasons:
  1. `@codeyam/cms` does not support a non-root `base`. It never reads
     `import.meta.env.BASE_URL`, and hard-codes 21 root-absolute internal links
     (`AdminLayout.astro:39-54`, `pages/admin/[collection]/[entry].astro:49`,
     `components/admin/EntryListSection.tsx:49`,
     `components/admin/SearchResultRow.tsx:34`). Under `base: '/preview/'` every
     admin link would resolve to the *public* origin's `/admin`.
  2. The admin pages embed raw entry markdown. `pages/admin/[collection]/index.astro`
     builds `items` from `listEntrySources(collection)` — each carrying the
     entry's `raw` source — and passes them into the `EntryListSearch` island,
     where they serialize into the static HTML. The CMS sign-in gate
     (`lib/authSession.ts`) is client-side only. So on whatever origin `/admin`
     is deployed, **every draft's full markdown is publicly fetchable**. Putting
     it on the public domain would defeat the point of phasing content.
- **Second GitHub repo rather than a new vendor.** `review.harvardintech.com`
  is served by a second repo's Pages site (`nseldeib/harvardintech-review`),
  built from `staging` by this repo's workflow. One repo = one Pages site, so a
  second origin genuinely requires a second repo. Cost: one repo, one deploy
  credential, one DNS `CNAME`. This keeps everything on GitHub Pages as
  requested.
  - *Documented alternative, not chosen:* Cloudflare Pages + Cloudflare Access
    (free for ≤50 users) would give the review track **real authentication** —
    per-person email one-time-PIN, individually revocable — instead of a shared
    client-side passphrase, and would make the raw-markdown exposure above a
    non-issue. Choose it if deterrent-level privacy is not enough; the rest of
    this plan is unchanged apart from the publish step.
- **`/admin` ships only on the review track.** `codeyamCms()` becomes
  conditional in `astro.config.mjs`. This is what makes finding (2) safe, and it
  matches the workflow: editors work on the review site, and promotion publishes.
- **The preview gate stops keying off `DEPLOY_BASE_PATH`.** It becomes an
  explicit `PREVIEW_GATE` env var. The current coupling is precisely what makes
  two simultaneous tracks impossible, and it also means the public track can stay
  gated right up until the domain cutover (see the migration plan) rather than
  un-gating itself the moment `base` becomes `/`.
- **The CMS commits to `staging`.** One direction, one rule: everything lands on
  staging first, and promoting publishes it. `src/data/cms.json` currently names
  `branch: "main"`.
- **Draft visibility becomes explicitly env-driven** rather than a
  `!import.meta.env.PROD` inference, because the review track *is* a production
  build that must show drafts. `publishedEntries` itself stays pure and
  untouched — only how call sites compute the flag changes.

## Implementation

### 1. Decouple the preview gate from the deploy base path

**File**: `src/lib/previewGate.ts`

Replace `PREVIEW_GATE_ENABLED = Boolean(process.env.DEPLOY_BASE_PATH)` with a
read of an explicit `PREVIEW_GATE` env var (`'1'` → on). Keep the module's
server-only contract and the `PREVIEW_GATE_PASSPHRASE` override as-is. Update
the header comment: the gate is no longer "temporary until launch", it is the
review track's standing gate, and `astro dev` still leaves it off so codeyam
scenario captures are never overlaid.

`src/components/PreviewGate.astro` and `src/pages/robots.txt.ts` both read
`PREVIEW_GATE_ENABLED` and need **no change** — the review build gets the
`noindex` meta, the blur overlay, and `Disallow: /` for free, and the public
build reverts to `Allow: /`.

### 2. Make draft visibility env-driven

**New file**: `src/lib/draftVisibility.ts`

Mirror the shape of `previewGate.ts`: a small server-only config module
exporting the resolved flag, plus a pure helper so both halves are unit-testable
without faking the environment (the same rationale `drafts.ts` gives for
`includeDrafts` being a parameter). Drafts show when the build is not a
production build **or** when `INCLUDE_DRAFTS=1`.

**Files**: `src/pages/index.astro`, `src/layouts/BaseLayout.astro`,
`src/pages/events.astro`, `src/pages/donate.astro`, `src/pages/volunteer.astro`,
`src/pages/blog/[slug].astro`, `src/pages/chapters/[slug].astro`,
`src/pages/communities/[slug].astro`

Replace the inline `!import.meta.env.PROD` argument at every `publishedEntries`
call site with the new shared flag. `index.astro` already names a local
`showDrafts` const (line 31) — that is the pattern to generalize. Do not change
`publishedEntries` itself: it is glossary-registered and covered by
`src/lib/drafts.test.ts`.

### 3. Make the CMS integration and sitemap conditional

**File**: `astro.config.mjs`

- Include `codeyamCms()` only when the build is the review track or `astro dev`
  (so the codeyam Live Preview keeps its admin scenarios). Omit it from the
  public build.
- Include `sitemap()` only on the public track — a `noindex`, `Disallow: /`
  origin should not publish a sitemap.
- Add an env-driven `outDir` only if the chosen publish mechanism needs it;
  building the two tracks from two checkouts (below) means the default `dist/`
  is fine for both.
- Leave the existing content-sandbox block, the `NODE_ENV` dev-runtime guard,
  and the `optimizeDeps.include` micromark chain untouched — all three are
  load-bearing and documented as such in that file.

### 4. Publish both tracks from one workflow

**File**: `.github/workflows/deploy.yml`

Trigger on pushes to `main` **and** `staging`, plus `workflow_dispatch`. The job
currently delegates to `withastro/action@v3`, which does checkout + install +
build + artifact upload in one step; two tracks means replacing it with explicit
`actions/setup-node` + `npm ci` + `npm run build` steps so each track gets its
own env.

- **Public track** — checkout `main`; build with `PAGES_SITE` /
  `DEPLOY_BASE_PATH` as today (the migration plan flips these), no
  `PREVIEW_GATE`, no `INCLUDE_DRAFTS`; publish with the existing
  `actions/upload-pages-artifact` + `actions/deploy-pages` pair.
- **Review track** — checkout `staging` into a separate directory; build with
  `PREVIEW_GATE=1`, `INCLUDE_DRAFTS=1`, `PAGES_SITE=https://review.harvardintech.com`,
  no `DEPLOY_BASE_PATH` (base stays `/`, which is what keeps the admin links
  working); write a `CNAME` file containing `review.harvardintech.com` into the
  output; push the built output to `nseldeib/harvardintech-review` using an SSH
  deploy key stored as a repo secret (`REVIEW_DEPLOY_KEY`).

Keep `concurrency: group: pages, cancel-in-progress: true` — but note it now
cancels in-flight *review* deploys too; give the review publish its own
concurrency group if that proves disruptive.

A deploy key is preferred over a PAT: it is scoped to exactly one repo and does
not carry a person's identity.

### 5. Add a one-click promote workflow

**New file**: `.github/workflows/promote.yml`

A `workflow_dispatch` job that merges `staging` into `main` (fast-forward when
possible, otherwise open a PR and stop). This is what turns "promote to live"
into a button rather than a git exercise, which matters because content editors
will be the ones doing it. Do not auto-promote on a schedule — publishing to a
live site should stay a deliberate act.

### 6. Point the CMS at the staging branch

**File**: `src/data/cms.json`

Change `repo.branch` from `main` to `staging`. Every CMS commit then lands on
the review track first. The `auth.token` / `auth.worker` settings are unchanged.

### 7. Create the review repo and the staging branch

Human setup steps, recorded here so the plan is executable end to end:

- Create `nseldeib/harvardintech-review` (contents are entirely generated; it
  needs no source).
- Enable Pages on it (Source: GitHub Actions or the deploy branch, matching the
  push mechanism chosen in step 4), custom domain `review.harvardintech.com`.
- Add one DNS record at GoDaddy: `CNAME review → nseldeib.github.io`. This
  touches nothing about the live Strikingly site and nothing about `MX`.
- Generate the deploy key pair; public half on the review repo (write access),
  private half as `REVIEW_DEPLOY_KEY` in this repo's secrets.
- Branch `staging` off `main` and set it as the default target for CMS commits.

### 8. Document the model

**Files**: `CMS_SETUP.md`, `DEPLOY_SETUP.md`, `docs/scoping/README.md`,
`docs/nicole-review.md`

`CMS_SETUP.md` states commits land in `nseldeib/harvardintech`, branch `main` —
update to `staging` and explain the promote step. `DEPLOY_SETUP.md` documents a
single Pages target — add the review track. `docs/scoping/README.md` item 11
("Publishing / shareable preview access — ✅ Live (gated GitHub Pages)") and its
decision #4 are both resolved by this plan; update the status table.
`docs/nicole-review.md` hands out `nseldeib.github.io/harvardintech` links —
re-point them at `review.harvardintech.com`.

## Reused existing code

- `publishedEntries` from `src/lib/drafts.ts` (glossary entry:
  `publishedEntries`; test: `src/lib/drafts.test.ts`) — the draft-phasing
  primitive already exists and takes an `includeDrafts` parameter for exactly
  this reason. Unchanged by this plan; only its arguments change.
- `PREVIEW_GATE_ENABLED` / `PREVIEW_GATE_PASSPHRASE` from
  `src/lib/previewGate.ts`, rendered by `src/components/PreviewGate.astro` via
  `src/components/HeadExtras.astro` — the whole gate UI, `noindex` meta, and
  session-storage unlock already exist and are reused as-is.
- `GET` from `src/pages/robots.txt.ts` (glossary entry: `GET`; test:
  `src/lib/seoEndpoints.test.ts`) — already emits `Disallow: /` vs `Allow: /`
  off `PREVIEW_GATE_ENABLED`. Reused unchanged.
- `withBase` from `src/lib/url.ts` (glossary entry: `withBase`; test:
  `src/lib/url.test.ts`) — already base-aware for every hand-written internal
  link, so both tracks' links resolve without change.
- The env-driven `base` / `site` wiring in `astro.config.mjs` and the
  `DEPLOY_BASE_PATH` / `PAGES_SITE` vars in `.github/workflows/deploy.yml`.

**Existing-implementation survey.** Grepped for anything equivalent before
proposing new fields:

- **Second deploy target** — none. `.github/workflows/` contains exactly one
  file, `deploy.yml`, with one `build` + one `deploy` job.
- **Include-drafts override** — none. `publishedEntries` accepts `includeDrafts`,
  but all nine call sites hard-code `!import.meta.env.PROD`; no env var, config
  key, or CLI flag reaches it.
- **`outDir` override** — none in `astro.config.mjs`; the default `dist/` is used.
- **Preview-gate env** — `PREVIEW_GATE_PASSPHRASE` already exists as an override;
  there is no on/off env var, which is the gap this plan fills.
- **Branch-based publishing** — none. `deploy.yml` triggers only on
  `push: branches: [main]`.

**Mechanism feasibility.** The two new mechanisms are build-time env vars
(`PREVIEW_GATE`, `INCLUDE_DRAFTS`) read in Astro frontmatter / server-only
modules during `astro build`, which is the same seam `previewGate.ts` already
uses successfully. They are per-*build*, not per-scenario, so the dev-server
caveat about launch-time values does not apply — each track is a separate build
invocation with its own environment.

## Scenarios to Demonstrate

- **Public build, drafted blog post** — a post with `draft: true` is absent from
  the blog index and has no route.
- **Review build, same drafted post** — present in the index and reachable, so
  the HIT team can review it before it goes live.
- **Review build, locked** — first visit shows the passphrase overlay with the
  content blurred behind it.
- **Review build, unlocked** — after entering the passphrase the real site
  renders, including drafts.
- **Review build, `/admin`** — the dashboard is reachable and lists both draft
  and published entries.
- **Public build, `/admin`** — the route does not exist; the 404 page renders.
- **`robots.txt` on each track** — `Allow: /` plus a sitemap reference on the
  public track, `Disallow: /` on the review track.
- **Empty state** — a collection with no entries at all, on both tracks, so the
  draft filter is proven not to be what emptied it.
# Harvard in Tech

A modern, statically-exported [Astro](https://astro.build) rebuild of the
[Harvard in Tech](https://www.harvardintech.com/) website — a faithful
reproduction of the original (built on a no-code tool) using modern technology,
hostable for free on GitHub Pages.

Page content lives in typed
[content collections](https://docs.astro.build/en/guides/content-collections/)
(markdown under `src/content/`) and editable JSON singletons (`src/data/`), not a
runtime database — so there is no server to run.
[**@codeyam/cms**](https://www.npmjs.com/package/@codeyam/cms) edits those same
files: an Astro integration that owns **`/admin`** — content dashboard, entry
editor, media library, site settings, and a publish flow that batches edits into
one GitHub commit. See [`CMS_SETUP.md`](./CMS_SETUP.md) for the two sign-in
paths: **Local** and **Token** (paste a fine-grained GitHub PAT).

## Setup

```bash
npm run setup      # install dependencies (+ Playwright browser for captures)
npm run dev        # http://127.0.0.1:4321
npm run build      # type-check + static build into dist/
npm run test       # component unit tests (vitest + jsdom)
```

A fresh clone works with: `git clone` → `npm run setup` → `npm run dev`.

### Patched dependency

`@codeyam/cms` is pinned to an exact version and carries a local patch in
`patches/`, applied automatically by `patch-package` on `postinstall`. The patch
makes the publish flow refuse to commit a media-library record whose image bytes
went missing during staging — without it an upload can land a `media.json` entry
pointing at a file that was never committed, which the site then renders as a
broken image an editor cannot fix from `/admin`. The version is pinned exactly
because the patch is version-stamped: a floating range would install a version
the patch cannot apply to and break `npm install` for everyone. It is covered by
`src/lib/mediaCommitGuard.test.ts`, so if a future release drops or reworks the
guard, CI says so. The fix belongs upstream; drop the patch once it lands there.

## Project shape

```
src/
  pages/index.astro          # the landing page — composes the section components
  pages/volunteer.astro       # /volunteer — the volunteer pitch + open-projects grid
  pages/volunteer/projects/[slug].astro
                              # /volunteer/projects/<slug> — one page per project,
                              #   where a project's full markdown description renders
  pages/donate.astro          # /donate — the Momentum Fund campaign page
  pages/events.astro          # /events — Luma calendar embed + upcoming/past listing
  components/landing/         # one component per landing section (Hero, Board, …)
  components/volunteer/       # /volunteer sections (hero, benefits, project cards)
  components/donate/          # /donate campaign sections (hero, stats, gift pillars,
                              #   quotes, donor recognition wall)
  layouts/BaseLayout.astro    # site shell: data-driven header/nav + footer + SEO
  content/                    # typed content collections (events, team, chapters,
                              #   communities, pages, blog, projects, sponsors,
                              #   testimonials, donors, momentumSections, and the
                              #   page copy an editor owns: volunteerPage,
                              #   sponsorPage, sponsorLevels, siteIntegrations,
                              #   pageCopy)
  data/                       # settings.json + nav.json singletons, cms.json +
                              #   collections.json (CMS config). volunteerPage,
                              #   sponsorPage and donatePage still live here as the
                              #   FALLBACK behind their collections — the CMS has no
                              #   notion of a required singleton, so a deleted entry
                              #   degrades to this committed copy rather than a blank page
  lib/                        # site.ts, mailto.ts, drafts.ts (draft filtering),
                              #   personalize.ts (?name= hero personalization), giving.ts
  styles/tokens.css           # design tokens (brand blue, Roboto, spacing)
public/images/                # hero/section backgrounds, board graphic, event gallery
                              # (/admin is injected by @codeyam/cms — no admin code in this repo)
```

## Deploy to GitHub Pages

1. In `astro.config.mjs`, set `site` to your Pages URL and `base` to your repo
   path (drop `base` for a `<user>.github.io` root site).
2. Push to `main` — `.github/workflows/deploy.yml` enables Pages automatically
   (Source: **GitHub Actions**), then builds and deploys. No manual Settings →
   Pages toggle in the common case; see [`DEPLOY_SETUP.md`](./DEPLOY_SETUP.md)
   for the fallback if the first deploy 404s.

<!-- codeyam:run-and-edit:start -->
## Develop this project with codeyam-editor

This project is built with [codeyam-editor](https://codeyam.com) — code and runnable data scenarios are authored side by side against a live preview.

```bash
# Clone the repo
git clone https://github.com/nseldeib/harvardintech && cd harvardintech

# Install codeyam-editor
npm install -g @codeyam-editor/codeyam-editor@latest

# Launch the editor (split-screen terminal + live preview)
codeyam-editor start
```
<!-- codeyam:run-and-edit:end -->

<!-- codeyam:scenario-gallery:start -->
## Scenario gallery

States captured as runnable scenarios with codeyam-editor:

### Blog Post - Welcome

<img src=".codeyam/scenarios/screenshots/blog-post-welcome--desktop.png" alt="Blog Post - Welcome" width="280">

### Cutover Runbook - The Records On A Phone

<img src=".codeyam/scenarios/screenshots/cutover-runbook-the-records-on-a-phone--mobile.png" alt="Cutover Runbook - The Records On A Phone" width="280">

### Blog Preview Link - Shared Draft

<img src=".codeyam/scenarios/screenshots/blog-preview-link-shared-draft--desktop.png" alt="Blog Preview Link - Shared Draft" width="280">

### CMS Analytics And Embeds

<img src=".codeyam/scenarios/screenshots/cms-analytics-and-embeds--desktop.png" alt="CMS Analytics And Embeds" width="280">

### CMS Blog List - A Preview Link And A Locked One

<img src=".codeyam/scenarios/screenshots/cms-blog-list-a-preview-link-and-a-locked-one--desktop.png" alt="CMS Blog List - A Preview Link And A Locked One" width="280">

### CMS Chapter Editor - Marked As Draft

<img src=".codeyam/scenarios/screenshots/cms-chapter-editor-marked-as-draft--desktop.png" alt="CMS Chapter Editor - Marked As Draft" width="280">

### CMS Dashboard - Empty

<img src=".codeyam/scenarios/screenshots/cms-dashboard-empty--desktop.png" alt="CMS Dashboard - Empty" width="280">

### CMS Entry Editor - Change Staged For Review

<img src=".codeyam/scenarios/screenshots/cms-entry-editor-change-staged-for-review--desktop.png" alt="CMS Entry Editor - Change Staged For Review" width="280">
<!-- codeyam:scenario-gallery:end -->

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

## Project shape

```
src/
  pages/index.astro          # the landing page — composes the section components
  components/landing/         # one component per landing section (Hero, Board, …)
  layouts/BaseLayout.astro    # site shell: data-driven header/nav + footer + SEO
  content/                    # typed content collections (events, team, chapters, pages, blog)
  data/                       # settings.json + nav.json singletons, cms.json + collections.json (CMS config)
  lib/                        # site.ts, mailto.ts, deployStatus.ts
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
codeyam-editor editor
```
<!-- codeyam:run-and-edit:end -->

<!-- codeyam:scenario-gallery:start -->
## Scenario gallery

States captured as runnable scenarios with codeyam-editor:

### Blog Post - Welcome

<img src=".codeyam/scenarios/screenshots/blog-post-welcome--desktop.png" alt="Blog Post - Welcome" width="280">

### CMS Blog List - Drafts And Published

<img src=".codeyam/scenarios/screenshots/cms-blog-list-drafts-and-published--desktop.png" alt="CMS Blog List - Drafts And Published" width="280">

### CMS Chapter Editor - Marked As Draft

<img src=".codeyam/scenarios/screenshots/cms-chapter-editor-marked-as-draft--desktop.png" alt="CMS Chapter Editor - Marked As Draft" width="280">

### CMS Chapter Editor - New York City

<img src=".codeyam/scenarios/screenshots/cms-chapter-editor-new-york-city--desktop.png" alt="CMS Chapter Editor - New York City" width="280">

### CMS Dashboard - Empty

<img src=".codeyam/scenarios/screenshots/cms-dashboard-empty--desktop.png" alt="CMS Dashboard - Empty" width="280">

### CMS Dashboard - Populated

<img src=".codeyam/scenarios/screenshots/cms-dashboard-populated--desktop.png" alt="CMS Dashboard - Populated" width="280">

### CMS Entry Editor - Change Staged For Review

<img src=".codeyam/scenarios/screenshots/cms-entry-editor-change-staged-for-review--desktop.png" alt="CMS Entry Editor - Change Staged For Review" width="280">

### CMS Entry Editor - New Chapter Form

<img src=".codeyam/scenarios/screenshots/cms-entry-editor-new-chapter-form--desktop.png" alt="CMS Entry Editor - New Chapter Form" width="280">
<!-- codeyam:scenario-gallery:end -->

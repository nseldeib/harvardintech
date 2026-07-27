---
title: "Adopt CodeYam CMS And Retire Sveltia"
mode: ui
createdAt: "2026-07-26T10:29:18Z"
source: manual
---

## Summary

Replace this site's two-part editing stack — the hand-rolled `/admin` CRM
dashboard plus the CDN-loaded Sveltia editor at `/admin/editor/` — with the
installable `@codeyam/cms` package, which owns the whole `/admin` area as an
Astro integration. Editors get one dashboard with entry editing, a media
library, site settings, a publish checklist, and a review-and-commit flow,
instead of a read-only summary page that hands off to a separate CDN app.

The integration has been prototyped end to end against this repo twice and works:
`npx codeyam-cms integrate` patches `astro.config.mjs` cleanly, `/admin` renders
all real content (7 entries across the four built-in collections, plus the 5
chapters once declared), the media library adopts all 67 committed images across
their eight subdirectories with no import step, and `npm run build` produces 87
pages including 30 admin routes — from a real (non-symlinked) package install, so
the static GitHub Pages deploy model is unaffected.

This plan is the consumer-side migration only. Every package capability it
depends on has already shipped.

## Key Decisions

- **Editors sign in with their own GitHub token; the passcode gate is retired.**
  `AdminGate` is a shared-secret deterrent that is compiled into the built JS
  (its own comments say so) and gates a page that was read-only anyway. The
  package's model is a fine-grained PAT per editor, pasted once and held in that
  browser — which is the same model this site's Sveltia setup already documents
  in `CMS_SETUP.md`, so it is not a new burden for existing editors. It is also
  strictly stronger: commits carry each editor's own identity, and access is
  revoked per person from GitHub rather than by rotating a shared passcode
  everyone must be re-told. Magic-link invites were considered and deferred —
  they need the `cms-auth-worker` standing up on Cloudflare, and they attribute
  every commit to the worker instead of the person.
- **Depend on a published `@codeyam/cms`, not a local path.** This is the one
  genuine prerequisite outside this repo. The deploy workflow builds via
  `withastro/action@v3`, which installs from the lockfile in a checkout that has
  no sibling `codeyam-cms` repo — so a `file:../codeyam-cms/packages/cms`
  dependency resolves locally and then fails in CI. A git dependency is not a
  workaround: npm cannot install from a subdirectory of a repo, and the package
  lives at `packages/cms`. Publishing to npm is therefore the prerequisite; the
  packing/install path is already proven, since this plan's verification built
  the whole site from `npm pack` output installed as a real directory. Do not
  start this plan until a real version is installable.
- **Declare `chapters` in `collections.json`, don't make it a built-in.** The
  package's four built-ins (pages/blog/events/team) match this site's schemas
  closely enough that only extras are needed; `chapters` is site-specific and
  belongs in the consumer registry. The exact registry that was proven working —
  `chapters` with its 10 fields including the numeric `order` and the `leads` /
  `links` repeatable lists, the per-built-in extras, and the SEO group — is
  captured in this plan's Implementation section rather than being re-derived.
- **Keep this site's frontmatter key names; adapt the CMS to them.** The content
  uses `metaTitle` / `metaDescription` / `ogImage`, while the package defaults to
  `seoTitle` / `seoDescription` / `socialImage`. Declaring a consumer `seo` group
  in `collections.json` maps the editor onto the existing keys, so no content
  file and no rendering template has to change. Renaming 7 entries' frontmatter
  plus every template that reads it would be a larger, riskier diff for no gain.
- **Retire the local admin subsystem wholesale rather than keeping parts.**
  Every file under `src/components/admin/`, both admin libs, the admin layout,
  and the `public/admin/` Sveltia scaffold exist only to serve the old dashboard.
  Keeping any of them means maintaining a second admin vocabulary alongside the
  package's. The four codeyam scenarios that capture those components go with
  them.
- **`src/pages/deploy-status.json.ts` stays.** It is a public JSON endpoint, not
  part of the admin UI, and the package's own deploy status does not replace it.
  Only the admin-facing `DeployStatus.astro` component is retired.

## Implementation

### 1. Install and wire the package

**Files**: `package.json`, `astro.config.mjs`

Add `@codeyam/cms` at the published version and run
`npx codeyam-cms integrate`. The CLI adds the import and puts `codeyamCms()`
first in the `integrations: []` array, ahead of the existing `react()` and
`sitemap()`. It has been run against this exact config twice with a clean,
two-line diff — the surrounding content-sandbox logic is untouched.

`@astrojs/react` is already a dependency, so the CLI's dependency step is a no-op
beyond adding the package itself.

### 2. Configure the CMS for this repo

**New files**: `src/data/cms.json`, `src/data/collections.json` (both created by
`integrate`, then edited)

In `cms.json`, set the repo target to `nseldeib` / `harvardintech` / `main` —
note the owner is **nseldeib**, not `jaredcosulich` as `CMS_SETUP.md` currently
states. Leave `auth.token: true` and `auth.worker: false`, matching the
token-only decision above.

In `collections.json`, declare:

- **`chapters`** as a custom collection (`singular: "Chapter"`) with fields
  matching `src/content/config.ts` exactly: `city` (text, required), `region`,
  `blurb` (textarea), `heroImage` (image), `tagline`, `showGallery` (boolean),
  `contactEmail`, `order` (**number**), plus two repeatable lists — `leads`
  (`name` required, `role` optional) and `links` (`label`, `url`).
- **`builtins` extras**: `embedUrl` (text) and `embedHtml` (textarea) on both
  `pages` and `blog`; `chapter` (text) on `events`; `active` (boolean) on `team`.
- **`seo`**: `metaTitle` (text), `metaDescription` (textarea), `ogImage` (image),
  all optional, replacing the package defaults.

Every field above renders correctly today — verified in the running admin
against the real entries, including the numeric `order` input and both lists.

### 3. Retire the local admin subsystem

**Delete**: `src/pages/admin/index.astro`, `src/layouts/AdminLayout.astro`, all
eight components under `src/components/admin/` (`AdminGate.astro`,
`AdminGatePrompt.astro`, `AdminHeader.astro`, `CollectionCountCard.astro`,
`CollectionCountGrid.astro`, `DashboardSummary.astro`, `DeployStatus.astro`,
`SignInGuide.astro`), `src/lib/adminDashboard.ts`, `src/lib/adminGate.ts`, their
two test files, and the whole `public/admin/` directory (the Sveltia
`index.html`, `config.yml`, and `deploy-status.js`).

`src/pages/admin/index.astro` in particular is not optional: a file-based route
at `/admin` collides with the package's injected route, and the local one wins.

Check `src/pages/isolated-components/[name].astro` — it is the only remaining
file referencing the admin components, and its component registry must drop the
retired entries or the route will fail to build.

### 4. Remove the four orphaned scenarios

**Delete**: `.codeyam/scenarios/admin-dashboard-empty.json`,
`admin-dashboard-populated.json`, `admingateprompt-initial-empty.json`,
`admingateprompt-masked-entry.json`, and their screenshots.

These capture components that no longer exist. The package ships its own admin
scenarios, so nothing of value is lost. Confirm no other scenario references a
retired component before deleting.

### 5. Drop the passcode from the deploy workflow

**File**: `.github/workflows/deploy.yml`

Remove the `ADMIN_GATE_PASSCODE` env var and its explanatory comment block from
the build step. Note in the plan's completion that the corresponding repo secret
can be deleted from Settings → Secrets, and tell the site owner — leaving a live
secret for a retired gate is the kind of thing that gets rediscovered a year
later and misread as still active.

### 6. Rewrite the setup documentation

**File**: `CMS_SETUP.md`

The document describes Sveltia, its `config.yml`, the token flow through
Sveltia's own sign-in, and the "keeping the schema honest" duplication between
`config.yml` and `src/content/config.ts`. All of it is obsolete — the package
derives the editor from `collections.json`, so that duplication disappears
entirely. Rewrite around: how to get a fine-grained PAT, where to paste it, what
staging/review/commit looks like, and how `collections.json` relates to
`src/content/config.ts`. Fix the repo owner to `nseldeib` while there.

## Reused existing code

- `src/content/config.ts` — the collection schemas stay as the source of truth;
  `collections.json` mirrors them for the editor. Migrating the loaders onto the
  package's `collectionLoader` / `seoFields` helpers is deliberately NOT part of
  this plan: the existing `contentRoot()` + `glob` setup already resolves to the
  same sandbox and works unchanged, so changing it would add risk for no behavior
  difference.
- `src/lib/contentRoot.ts` — this site's content-root redirection, which the
  package's own resolution already honors
- `src/data/settings.json` / `src/data/nav.json` — edited in place by the
  package's settings and nav editors. The three custom keys
  (`googleAnalyticsId`, `customHeadHtml`, `customBodyHtml`) survive a save; this
  was verified by running this repo's real `settings.json` through the shipped
  serializer.
- `public/images/**` — all 67 images are adopted into the media library by
  directory scan, with no manifest to author and no re-upload
- `src/pages/deploy-status.json.ts` — retained unchanged

## Scenarios to Demonstrate

- **Admin dashboard** — the package's `/admin` showing this site's real counts
  across all five collections
- **Chapter entry editor** — a real chapter open, showing the numeric `order`
  input, the `leads` and `links` list rows, and the nested hero image thumbnail
  resolving from `/images/bg/hero-bg.jpg`
- **Media library, adopted** — the 67 existing images grouped by their eight
  directories, on a site that has never uploaded through the CMS
- **Site settings with custom keys** — the settings form, where the three
  consumer-authored keys are absent from the form but preserved on save
- **Token sign-in gate** — the signed-out state an editor first meets, replacing
  the retired passcode prompt
- **Review drawer before commit** — a staged entry edit plus a settings edit
  batched into one commit

## Prerequisites

**All satisfied — this plan is ready to run.**

`@codeyam/cms@0.1.0` was published to npm on 2026-07-26 (MIT, public) and
verified installable from the registry into a clean project, so the CI
resolution problem in Key Decisions is solved: depend on `^0.1.0`, not a local
path. Every package capability this plan uses has also shipped — the numeric
field type, unknown-settings-key preservation, nested media paths, and media
adoption.

Note the package was renamed from `@codeyam-ai/cms` to `@codeyam/cms` before
publishing (the npm scope is `@codeyam`; the GitHub org remains `codeyam-ai`).
Use the `@codeyam/cms` name throughout — an older reference to the `-ai` scope
will not resolve.

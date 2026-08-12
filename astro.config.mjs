// @ts-check
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import codeyamCms from '@codeyam/cms';
import { isPreviewUrl } from '@codeyam/cms/lib/previewPages';
import { includeCmsIntegration, includeSitemapIntegration } from './src/lib/publishTrack';

// --- codeyam content sandbox ---------------------------------------------
// The site's "database" is the committed markdown under `src/content/` and the
// JSON singletons under `src/data/`. codeyam's seed adapter rewrites those per
// scenario, so without isolation a capture/preview would overwrite the
// committed production content. To prevent that, during `astro dev` (the dev
// server codeyam previews and captures against) we point the app at a *sandbox*
// copy under `.codeyam/tmp/content-sandbox/` and seed THAT, never `src/content`.
//
// A production `astro build` (and `astro check`) leaves the env vars unset, so
// it reads `src/content`/`src/data` unchanged — GitHub Pages deploys are
// unaffected. The seed adapter (`.codeyam/seed-adapter.ts`) re-initialises the
// same sandbox from production before each seed, so per-scenario state never
// leaks and production is never touched.
const SANDBOX_REL = '.codeyam/tmp/content-sandbox';
// Where `.codeyam/seed-adapter.ts` snapshots the sandbox after each seed. When
// it exists it is the restore source, so the ACTIVE scenario survives a dev
// server restart instead of being wiped back to production.
//
// That is not a convenience — it is what makes a collection that ships EMPTY
// seedable at all. Astro's glob loader returns early, before it registers its
// file watcher, when a collection's directory has no matching files at boot:
//
//     if (exists && files.length === 0) { logger.warn('No files found…'); return }
//       — node_modules/astro/dist/content/loaders/glob.js
//
// So `donors` and `testimonials` — both empty in production, both populated only
// by a scenario — had no watcher for the whole life of the dev server: a seed
// applied afterwards could never reach the page, and restarting to pick it up
// re-copied production over the seed. Restoring the snapshot puts the seeded
// files on disk BEFORE the loader scans, so the watcher registers and the
// collection renders. Scenario isolation is unaffected: each seed rewrites the
// snapshot, so it always holds exactly the current scenario.
const SNAPSHOT_REL = '.codeyam/tmp/content-sandbox-active';

/** @param {string} projectRoot @returns {{ sandboxContent: string, sandboxData: string }} */
function initContentSandbox(projectRoot) {
  const prodContent = path.join(projectRoot, 'src/content');
  const prodData = path.join(projectRoot, 'src/data');
  const sandboxContent = path.join(projectRoot, SANDBOX_REL, 'content');
  const sandboxData = path.join(projectRoot, SANDBOX_REL, 'data');
  const snapshotContent = path.join(projectRoot, SNAPSHOT_REL, 'content');
  const snapshotData = path.join(projectRoot, SNAPSHOT_REL, 'data');

  // Fresh copy of the active scenario's snapshot (or production when there is
  // none) → sandbox, so the default view renders the committed content and a
  // seeded view survives the restart. `force` keeps the markdown config
  // (`config.ts` lives in src/content, but the loaders read
  // `<root>/<collection>/`, so copying it along is harmless).
  const hasSnapshot = fs.existsSync(snapshotContent);
  for (const [src, dest] of [
    [hasSnapshot ? snapshotContent : prodContent, sandboxContent],
    [hasSnapshot && fs.existsSync(snapshotData) ? snapshotData : prodData, sandboxData],
  ]) {
    fs.rmSync(dest, { recursive: true, force: true });
    if (fs.existsSync(src)) fs.cpSync(src, dest, { recursive: true });
    else fs.mkdirSync(dest, { recursive: true });
  }

  return { sandboxContent, sandboxData };
}

/**
 * Dev-only integration exposing a content-layer refresh endpoint.
 *
 * The seed adapter rewrites markdown inside the sandbox while the dev server is
 * already up. Astro normally notices via its file watcher — but a collection
 * whose directory had NO matching files when the server booted never got a
 * watcher at all (Astro's glob loader returns early in that case, see
 * SNAPSHOT_REL above). Seeding `donors` or `testimonials` for the first time in
 * a session therefore changed nothing on the page.
 *
 * `refreshContent()` re-runs every loader from scratch, which both picks up the
 * new files and registers the watcher that was skipped at boot — so one POST
 * after a seed makes the seeded state real without restarting the server.
 *
 * Refreshing the STORE is only half of it. Astro invalidates the rendered page
 * modules when it sees `.astro/data-store.json` change on disk, and that write
 * lands after `refreshContent()` resolves — so the very next request would still
 * be served from the pre-seed render, which for a capture taken immediately
 * after seeding is precisely the request that matters. The handler therefore
 * also invalidates the data-store virtual module and pushes a full reload before
 * answering, so a 200 means "the next render will see the seed".
 *
 * Dev only: the endpoint exists solely so `.codeyam/seed-adapter.ts` can hit it,
 * and nothing registers it in a production build.
 *
 * @returns {import('astro').AstroIntegration}
 */
function codeyamContentRefresh() {
  // Astro's resolved id for the content-layer data store virtual module. Kept as
  // a literal rather than imported from `astro/dist/...` so this config never
  // depends on Astro's internal module layout; if the id ever changes, the
  // lookup simply misses and the handler falls back to the on-disk-write path.
  const DATA_STORE_MODULE_ID = '\0astro:data-layer-content';

  return {
    name: 'codeyam-content-refresh',
    hooks: {
      'astro:server:setup': ({ server, refreshContent }) => {
        server.middlewares.use('/__codeyam_refresh_content', (_req, res) => {
          Promise.resolve(refreshContent?.({ context: { reason: 'codeyam-seed' } }))
            .then(() => {
              const mod = server.moduleGraph.getModuleById(DATA_STORE_MODULE_ID);
              if (mod) server.moduleGraph.invalidateModule(mod);
              server.ws.send({ type: 'full-reload', path: '*' });
              res.statusCode = 200;
              res.end('ok');
            })
            .catch((err) => {
              // Never take the dev server down over a refresh — the caller
              // treats a non-200 as "fall back to the watcher".
              res.statusCode = 500;
              res.end(String(err));
            });
        });
      },
    },
  };
}

// Only redirect when actually running the dev server — `astro build`/`check`
// (production + CI) must read the committed source.
if (process.argv.includes('dev')) {
  const root = process.cwd();
  const { sandboxContent, sandboxData } = initContentSandbox(root);
  // `??=` so an explicit override (e.g. a future codeyam engine that sets these)
  // always wins over our default convention.
  process.env.CODEYAM_CONTENT_ROOT ??= sandboxContent;
  process.env.CODEYAM_DATA_ROOT ??= sandboxData;

  // Guarantee Vite's dependency optimizer pre-bundles React's *development*
  // JSX runtime. If `astro dev` inherits NODE_ENV=production (or it's already
  // baked into a stale optimize cache), esbuild constant-folds
  // `process.env.NODE_ENV === 'production'` to `true` inside
  // react/jsx-dev-runtime.js, bundling react-jsx-dev-runtime.production.js —
  // where `exports.jsxDEV = void 0`. React islands then crash on hydration with
  // "jsxDEV is not a function". Forcing development mode here (dev-only; build
  // and check leave it untouched) keeps the optimizer on the dev runtime so
  // hydration works. Do not remove — this is the guard, not dead code.
  if (!process.env.NODE_ENV || process.env.NODE_ENV === 'production') {
    process.env.NODE_ENV = 'development';
  }
}

// Astro static-site config for free GitHub Pages hosting.
//
// `output: 'static'` pre-renders every route to plain HTML at build time —
// nothing runs on a server, so the whole `dist/` folder drops onto GitHub
// Pages (or any static host) as-is. When you outgrow static and need
// server-rendered routes, this stays an in-framework upgrade: add an adapter,
// flip `output` to `'server'`, and opt individual routes into SSR with
// `export const prerender = false`. Content collections survive that move
// unchanged, so the codeyam data/scenario model built on them keeps working.
//
// `base`/`site` are env-driven so local dev and the codeyam preview always
// serve from '/', while the Pages CI build can publish under a project subpath.
// Two base modes, chosen by the deploy environment:
// - Custom domain (e.g., harvardintech.com): leave DEPLOY_BASE_PATH unset → base '/'.
// - Default project site (e.g., user.github.io/repo): the deploy workflow sets
//   DEPLOY_BASE_PATH=/<repo-name> and PAGES_SITE=https://<user>.github.io.
// Hand-written internal links are prefixed with import.meta.env.BASE_URL via
// src/lib/url.ts so they resolve under either base.
const base = process.env.DEPLOY_BASE_PATH || '/';
const site = process.env.PAGES_SITE || 'https://nseldeib.github.io';

// --- two-track publishing -------------------------------------------------
// Two builds come out of this one repo (see .github/workflows/deploy.yml).
//
// TODAY both are gated, because harvardintech.com is still Strikingly's:
//   - `main`    → nseldeib.github.io/harvardintech         (reviewed — holds still)
//   - `staging` → nseldeib.github.io/harvardintech-staging (working — moves constantly)
//
// AFTER THE MIGRATION the roles split:
//   - Public track  (`main`    → harvardintech.com):        open, indexable.
//   - Review track  (`staging` → review.harvardintech.com): passphrase-gated,
//     noindex, drafts visible, and the only track that ships /admin.
//
// `isReviewTrack` is a property of the BUILD, not of the branch: PREVIEW_GATE=1
// marks it, and src/lib/previewGate.ts reads the same var for the gate UI. Both
// of today's builds set it, so both are review-track builds and both ship /admin
// — which is why /admin is reachable on the gated preview right now.
const isReviewTrack = process.env.PREVIEW_GATE === '1';
const isDev = process.argv.includes('dev');

// Which integrations belong on which track is decided in src/lib/publishTrack.ts,
// where the rationale lives alongside its tests — this file can only be
// exercised by a real `astro build`, so the decision is kept somewhere unit
// tests can reach. Short version: /admin ships only on the gated review origin
// (its pages embed raw draft markdown behind a client-only sign-in), and the
// sitemap ships only on the public track (see src/pages/robots.txt.ts).
const integrations = [react()];
if (isDev) integrations.push(codeyamContentRefresh());
if (includeCmsIntegration(isDev, isReviewTrack)) integrations.unshift(codeyamCms());
// A preview page is built (its link has to resolve) but must never be ADVERTISED.
// `sitemap.xml` is a public, machine-read file, so a preview left in it publishes
// the exact URL the token exists to hide — and unlike an indexed page, no
// `noindex` can walk that disclosure back. The filter runs on the public track,
// which is the only track that emits a sitemap at all.
if (includeSitemapIntegration(isReviewTrack)) {
  integrations.push(sitemap({ filter: (page) => !isPreviewUrl(page) }));
}

export default defineConfig({
  output: 'static',
  site,
  base,
  integrations,
  // The Astro dev toolbar fires on load and calls Vite's HMR `.send()` before
  // the HMR WebSocket has connected through the fleet editor proxy, throwing
  // "Cannot read properties of undefined (reading 'send')" in the Live Preview.
  //
  // The throw is Vite's rough edge rather than ours: its client guards teardown
  // with `ws?.close()` but leaves `send()` as a bare `ws.send(...)`, so any
  // caller before a successful connect hits an undefined socket. And the
  // connect cannot succeed here — served over HTTPS on the default port, the
  // client derives its socket host as `${hostname}:${''}`, which is not a
  // reachable URL.
  //
  // Disabling the toolbar removes the caller. It is a dev-only overlay that
  // `output: 'static'` ships none of, so nothing about the built site changes.
  devToolbar: { enabled: false },
  vite: {
    optimizeDeps: {
      // @codeyam/cms ships raw `.ts`/`.tsx` (its package exports point at
      // `src/**`), so Vite treats it as SOURCE rather than a pre-bundled dep.
      // Its transitive deps are therefore never scanned, and the admin entry
      // editor's markdown preview pulls `micromark` → `debug`, which is CJS:
      // the browser then fails hydration with "does not provide an export named
      // 'default'". Naming the chain here forces Vite to pre-bundle it to ESM.
      // Dev-only concern — `astro build` bundles these correctly on its own.
      include: ['micromark', 'micromark-extension-gfm', 'debug'],
      // The cutover runbook's tick controls are the first NON-admin islands to
      // import @codeyam/cms client libs, and they import them from a page the
      // dev server had already optimized for. Vite discovered them mid-session,
      // began re-bundling, and served 504s for
      // `.vite/deps/@codeyam_cms_lib_authSession.js` while it did — the page
      // rendered but never hydrated, so every checkbox sat dead.
      //
      // `exclude` rather than `include` because the package exports raw `.ts`
      // (its exports map points at `src/**`), so it is SOURCE: pre-bundling it
      // is what fails, and leaving it to the normal transform pipeline is what
      // the admin routes already do successfully. Its transitive CJS deps are
      // still named in `include` above — that is the part that does need
      // pre-bundling, and the two lists are not in conflict.
      exclude: ['@codeyam/cms'],
    },
  },
});

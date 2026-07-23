// @ts-check
import * as fs from 'node:fs';
import * as path from 'node:path';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

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

/** @param {string} projectRoot @returns {{ sandboxContent: string, sandboxData: string }} */
function initContentSandbox(projectRoot) {
  const prodContent = path.join(projectRoot, 'src/content');
  const prodData = path.join(projectRoot, 'src/data');
  const sandboxContent = path.join(projectRoot, SANDBOX_REL, 'content');
  const sandboxData = path.join(projectRoot, SANDBOX_REL, 'data');

  // Fresh copy of production → sandbox so the default (un-seeded) view renders
  // the committed content. `force` keeps the markdown config (`config.ts` lives
  // in src/content, but the loaders read `<root>/<collection>/`, so copying it
  // along is harmless).
  for (const [src, dest] of [
    [prodContent, sandboxContent],
    [prodData, sandboxData],
  ]) {
    fs.rmSync(dest, { recursive: true, force: true });
    if (fs.existsSync(src)) fs.cpSync(src, dest, { recursive: true });
    else fs.mkdirSync(dest, { recursive: true });
  }

  return { sandboxContent, sandboxData };
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

export default defineConfig({
  output: 'static',
  site,
  base,
  integrations: [react(), sitemap()],
});

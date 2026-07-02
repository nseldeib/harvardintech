# Pre-launch Preview Gate + noindex (site-wide)

## Summary

Gate the **entire deployed WIP site** (not just the review page) behind a
client-side passphrase and mark it `noindex`, so the work-in-progress site can be
shared via a GitHub Pages link with a small trusted group without being fully
public or search-indexed. This is a **temporary pre-launch lock**, designed to be
removed in one place when the site goes live. The standalone review page already
has its own gate; this adds the same protection to every product page.

## Key Decisions

- **Build-only gate.** The gate + noindex activate ONLY in the deployed
  production build (`astro build` on GitHub Pages), never in `astro dev`. This is
  critical: the codeyam preview and every scenario capture run against the dev
  server, so a dev-active gate would overlay every screenshot with the passphrase
  prompt. Gating on the deploy env keeps all scenarios capturing real content.
- **One include point.** `HeadExtras.astro` is already wired into both
  `BaseLayout` and the standalone blog-post shell, so adding the gate + noindex
  there covers every public page (home, events, chapters, blog) with a single
  edit. Admin pages keep their own existing gate; the codeyam
  `isolated-components` harness is intentionally not gated.
- **Deterrent, documented.** Client-side gate = the page HTML is still fetchable
  by a determined viewer; combined with `noindex` + an obscure project URL it is
  "share-only enough" for a WIP. This matches the access model the user chose.
- **Removable at launch in one place.** Controlled by a `PREVIEW_GATE` build env
  var set in the deploy workflow. At real launch, remove that env var (and the
  `noindex`) — no component surgery, and the SEO/robots work already built takes
  over.

## Implementation

### 1. Gate config
**New file**: `src/lib/previewGate.ts`
- `PREVIEW_GATE_ENABLED` = `process.env.PREVIEW_GATE === 'true'` (false in dev).
- `PREVIEW_GATE_PASSPHRASE` = `process.env.PREVIEW_GATE_PASSPHRASE || 'crimson2026'`
  (deterrent; shared out-of-band). Server-only module (build-time).

### 2. The gate + noindex
**New file**: `src/components/PreviewGate.astro`
- Renders nothing when `PREVIEW_GATE_ENABLED` is false.
- When enabled: emits `<meta name="robots" content="noindex, nofollow">` and an
  `is:inline` script that, before paint, checks `sessionStorage`; if not unlocked,
  builds a full-screen crimson passphrase overlay (same UX as the review page) and
  locks scroll until the correct passphrase is entered. Content is behind the
  overlay (deterrent).

**Edit**: `src/components/HeadExtras.astro`
- Include `<PreviewGate />` (first, so noindex + the overlay apply everywhere the
  head partial is used — BaseLayout and the blog shell).

### 3. robots.txt reflects the lock
**Edit**: `src/pages/robots.txt.ts`
- When `PREVIEW_GATE_ENABLED`, emit `User-agent: * / Disallow: /` (keep the
  Sitemap line). When disabled (launch), the existing `Allow: /` behavior returns.

### 4. Turn the gate on for the deploy
**Edit**: `.github/workflows/deploy.yml`
- Add `PREVIEW_GATE: 'true'` to the build step env (alongside DEPLOY_BASE_PATH /
  PAGES_SITE). Removing this line at launch disables the gate.

## Reused existing code

- `HeadExtras.astro` — the single site-wide head include (already in both shells).
- The passphrase-overlay UX mirrors `public/review/index.html`.
- The env-driven build pattern mirrors `astro.config.mjs` (DEPLOY_BASE_PATH etc.).

## Scenarios to Demonstrate

- Because the gate is build-only, dev/preview scenarios render ungated (no change
  to existing captures). The gate itself is verified against a production build
  (`astro build` + serve) rather than a dev scenario.

## Out of scope

- Removing the gate at launch (a one-line env change later).
- Real server-side auth (would require a non-static host).

## Publish (after this lands)

Merge `atlas-homepage-events-revamp` → `main` and push; the deploy workflow builds
with `PREVIEW_GATE=true` and publishes the gated site + gated review page to
`https://nseldeib.github.io/harvardintech/` (review page at `/review/`).

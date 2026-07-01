---
title: "Site Integrations & SEO/AEO"
mode: ui
createdAt: "2026-07-01T19:37:26Z"
source: manual
---

## Summary

Add a cohesive "integrations + discoverability" layer to the site, all driven
through the existing Sveltia CMS (`settings.json` + per-page frontmatter) so
non-developers can manage it. Four capabilities: (1) **Google Analytics** via a
safe, template-controlled Measurement ID field; (2) **Custom HTML** injection —
raw head + before-`</body>` boxes for verification tags, pixels, and chat
widgets; (3) **per-page iframe/HTML embeds** so an editor can drop a video,
form, or map into a specific page or post; and (4) **SEO/AEO** improvements —
schema.org JSON-LD structured data, a fixed env-driven robots.txt, an
`llms.txt` for answer engines, and editable per-page SEO overrides. GA cookie
consent-gating is explicitly **out of scope** here and noted as a follow-up.

## Key Decisions

- **GA gets a dedicated `googleAnalyticsId` field, NOT the raw-HTML box** —
  editors only type a `G-XXXXXXXXXX` id; the template owns the gtag.js markup, so
  it can't break page structure or inject arbitrary code. The raw-HTML boxes
  exist separately for everything else (Search Console verification, LinkedIn/
  Meta pixels, chat widgets) where a typed field per integration isn't practical.
  This is the "bulletproof common case + labeled escape hatch" split.
- **Raw custom HTML is injected with `set:html` at build time** — because the
  site is `output: 'static'`, the snippet is server-rendered into the HTML file,
  so any `<script>` in it executes normally on page load (the "injected scripts
  don't run" rule only applies to runtime `innerHTML`, which this is not). The
  raw-HTML boxes are power-user territory: whoever can edit them runs JS on every
  page. That's acceptable because the CMS is behind GitHub OAuth, edits are
  reviewable git commits, and the editor set is small — but the CMS field hint
  must say so.
- **A shared head partial, not just a `BaseLayout` edit** — blog posts
  (`src/pages/blog/[slug].astro`) render their own `<html>` shell and never
  touch `BaseLayout`, so analytics/JSON-LD/custom-HTML added only to `BaseLayout`
  would silently miss every blog post. A single `HeadExtras.astro` (analytics +
  structured data + custom head HTML) is dropped into both `BaseLayout`'s
  `<head>` and the standalone blog shell; custom **body** HTML is injected before
  `</body>` in both.
- **robots.txt and llms.txt become generated endpoints, not static files** — the
  current `public/robots.txt` ships a broken literal `https://<user>.github.io/`
  placeholder. A static file can't read the env-driven site URL, so both are
  converted to Astro endpoints that emit `Astro.site` at build time (base '/' for
  the custom domain, `https://<user>.github.io` for the project-site deploy).
- **JSON-LD reuses existing settings data** — Organization/WebSite schema is
  built from `settings.siteTitle`, `description`, `contactEmail`, and `socials`
  (mapped to `sameAs`), so there's no new data to maintain; it tracks the CMS.
- **Consent-gating is a follow-up** — GA sets cookies and the footer references a
  "Cookie Policy," so a GDPR/consent banner may be warranted, but it is
  intentionally not built here. Called out so the editor workflow doesn't treat
  its absence as an omission.

## Implementation

Organized by area, not execution order.

### Area A — Google Analytics

#### 1. Add the GA id to settings + types

**File**: `src/data/settings.json`

Add an optional `"googleAnalyticsId": ""` field (empty = analytics off).

**File**: `src/lib/site.ts`

Add `googleAnalyticsId?: string` to the `SiteSettings` interface. Keep it
optional so existing/seeded settings without it still parse.

#### 2. Analytics component

**New file**: `src/components/Analytics.astro`

Renders nothing when `settings.googleAnalyticsId` is empty/absent. When set,
emits the standard two-tag gtag.js snippet: the async loader
(`https://www.googletagmanager.com/gtag/js?id=<id>`) plus an inline
`set:html` config script (`gtag('js', new Date()); gtag('config', '<id>')`).
Reads the id from `../lib/site`.

### Area B — Custom HTML injection (head + body)

#### 3. Add raw-HTML fields to settings + types

**File**: `src/data/settings.json`

Add `"customHeadHtml": ""` and `"customBodyHtml": ""`.

**File**: `src/lib/site.ts`

Add `customHeadHtml?: string` and `customBodyHtml?: string` to `SiteSettings`.

#### 4. Head/body injection

**New file**: `src/components/HeadExtras.astro`

A single leaf component that renders, in order: `<Analytics />`,
`<StructuredData />` (Area D), and `settings.customHeadHtml` via
`<Fragment set:html={...} />` when non-empty. This is the one thing every
route's `<head>` includes.

Custom **body** HTML is injected inline (not via this component) right before
`</body>` in the shells (step 5), also via `set:html`, guarded on non-empty.

#### 5. Wire the shells

**File**: `src/layouts/BaseLayout.astro`

Add `<HeadExtras />` inside `<head>` (after the existing `<SEO />`), and inject
`settings.customBodyHtml` before `</body>`.

**File**: `src/pages/blog/[slug].astro`

This route renders its own `<html>` shell and currently has no `SEO`, analytics,
or injection. Add the shared `<SEO title={post.data.title} ... />` and
`<HeadExtras />` to its `<head>`, and the custom-body injection before
`</body>`. (Verify whether `src/pages/pages/*` or chapter routes also bypass
`BaseLayout`; apply the same partial wherever a standalone `<html>` shell is
rendered. The editor workflow should grep for `<html` under `src/pages` to find
every shell.)

### Area C — Per-page iframe / HTML embeds

#### 6. Reusable embed component

**New file**: `src/components/Embed.astro`

Reuses the existing iframe pattern from `EmbedForm.astro` / `LumaCalendar.astro`:
given an `embedUrl`, render a sandboxed, lazy-loaded, full-width `<iframe>`;
given `embedHtml`, render it via `set:html`. Renders nothing if neither is set.
Prefer the URL form as the safe default.

#### 7. Per-page embed frontmatter

**File**: `src/content/config.ts`

Add optional `embedUrl?: string` and `embedHtml?: string` to the `blog` and
`pages` collection schemas (both currently allow raw HTML in the markdown body,
but a structured field is safer and CMS-friendly).

**File**: `src/pages/blog/[slug].astro` (and the pages route renderer)

After `<Content />`, render `<Embed embedUrl={post.data.embedUrl}
embedHtml={post.data.embedHtml} />`.

### Area D — SEO / AEO

#### 8. JSON-LD structured data

**New file**: `src/components/StructuredData.astro`

Emit an `Organization` + `WebSite` JSON-LD block (`<script type="application/ld+json" set:html=...>`)
built from `settings.siteTitle`, `settings.description`, `settings.contactEmail`,
the site URL (`Astro.site` / canonical), and `settings.socials` mapped to
`sameAs` (omit `sameAs` when there are no socials). Included via `HeadExtras`
(step 4) so it appears on every route, including blog posts.

#### 9. Fix robots.txt (env-driven)

**New file**: `src/pages/robots.txt.ts`

An Astro endpoint that emits `User-agent: * / Allow: /` plus
`Sitemap: <Astro.site>sitemap-index.xml` using the real build-time site URL.

**Delete**: `public/robots.txt`

Remove the static file with the broken `https://<user>.github.io/` placeholder
so the generated endpoint is the single source of truth.

#### 10. llms.txt for answer engines

**New file**: `src/pages/llms.txt.ts`

An Astro endpoint emitting a plain-text AEO summary: org name + description
(from settings), the canonical site URL, and a short list of key routes
(home, /events, chapters, contact email). Keeps LLM answer engines citing
accurate, current facts.

#### 11. Editable per-page SEO overrides

**File**: `src/content/config.ts`

Add optional `metaTitle?`, `metaDescription?`, `ogImage?` to `blog` and `pages`
schemas.

**File**: `src/components/SEO.astro`

Already accepts `title` / `description` / `image` / `canonical` props — no
change to its API needed. Ensure the page/blog renderers pass the frontmatter
overrides (falling back to `post.data.title` etc.) into `<SEO />`.

### Area E — CMS config

#### 12. Expose all new fields in the editor

**File**: `public/admin/editor/config.yml`

Under the `settings` → `general` file collection, add:
- `googleAnalyticsId` — `widget: string`, `required: false`, hint "GA4
  Measurement ID, e.g. G-XXXXXXXXXX. Leave blank to disable."
- `customHeadHtml` — `widget: text` (or `code`), `required: false`, hint
  "Advanced: raw HTML injected into <head> on every page (verification tags,
  pixels). Runs on every page — paste only trusted snippets."
- `customBodyHtml` — `widget: text`, `required: false`, similar hint for the
  end-of-body slot (chat widgets, etc.).

On the `blog` and `pages` collections, add fields for `metaTitle`,
`metaDescription`, `ogImage` (image widget), `embedUrl`, and `embedHtml`, all
`required: false`.

## Reused existing code

- `settings` / `SiteSettings` from `src/lib/site.ts` — extended, not replaced;
  all new site-wide fields hang off the existing singleton reader.
- `SEO.astro` (`src/components/SEO.astro`) — reused as-is for per-page overrides;
  its prop API already covers title/description/image/canonical.
- The iframe embed pattern in `EmbedForm.astro` (glossary entry: `EmbedForm`) and
  `LumaCalendar.astro` — `Embed.astro` follows the same sandboxed/lazy iframe
  shape.
- `withBase` from `src/lib/url.ts` for any internal links emitted by the new
  endpoints.
- `@astrojs/sitemap` (already in `astro.config.mjs`) — the generated
  `robots.txt` points at the `sitemap-index.xml` it already produces; no sitemap
  work needed beyond the robots reference.
- `Astro.site` (from env-driven `site` in `astro.config.mjs`) — the single
  source of the canonical URL for robots.txt, llms.txt, and JSON-LD.

## Scenarios to Demonstrate

- **GA configured** — `googleAnalyticsId` set → gtag.js loader + config script
  present in `<head>`.
- **GA off** — empty id → no analytics markup at all (default state).
- **Custom head + body HTML populated** — a verification `<meta>` in head and a
  chat-widget `<script>` before `</body>` both render verbatim.
- **Custom HTML empty** — no stray/empty injection nodes.
- **JSON-LD, rich org** — settings with full socials → Organization/WebSite
  block with `sameAs` populated from the social links.
- **JSON-LD, no socials** — `sameAs` omitted cleanly, block still valid.
- **robots.txt** — endpoint output shows the real site URL in the `Sitemap:`
  line (both custom-domain '/' and project-subpath deploys).
- **llms.txt** — endpoint emits the org summary + key routes.
- **Blog post with an iframe embed** — `embedUrl` set → sandboxed iframe renders
  after the post body; and a post with no embed renders unchanged.
- **Page with per-page SEO overrides** — `metaTitle`/`metaDescription`/`ogImage`
  set → `<head>` reflects the overrides; a page without them falls back to
  site defaults.
- **Blog post now has SEO/analytics** — confirms the standalone blog shell picks
  up the shared head partial (regression guard for the BaseLayout-bypass issue).

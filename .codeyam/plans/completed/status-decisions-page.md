# Project Status & Decisions Page

## Summary

Build a **standalone, self-contained HTML page** that presents the project's
status and the open decisions for the Harvard Alumni in Tech site migration, so
Nadia can share a link with **non-technical stakeholders** and collect their
input. It is a **project-management artifact**, not part of the product site — so
it lives as a single static file under `public/` (deployed verbatim by GitHub
Pages), styled to match the Harvard crimson brand, with **`noindex`** and a
**client-side password gate** (deterrent-level privacy, per the chosen access
model). Content is derived from `docs/scoping/`.

## Key Decisions

- **Standalone static file, not a product route.** It renders as
  `public/review/index.html` → served at `/review/` on the deploy. Self-contained
  (inline CSS + JS, no imports) so it never couples to the product's components or
  the CMS, mirroring how the design mockups are standalone artifacts.
- **Privacy = deterrent, documented as such.** `<meta name="robots"
  content="noindex">` + a hard-to-guess path + a client-side passphrase gate. The
  gate is a deterrent (source is still fetchable); if real access control is
  needed later, move the artifact to Cloudflare/Netlify with a real password. The
  page itself notes this so reviewers understand the sharing model.
- **Content mirrors `docs/scoping/`.** One card per item: Status · plain-language
  description · Decision needed · Options (pros/cons) · Effort. Plus the top-level
  decisions list. No live data, no build-time coupling — it's a snapshot the
  author refreshes as decisions land.
- **No product-nav entry, no analytics.** It must not appear in the site nav and
  should not fire the site's GA — it's internal.

## Implementation

### 1. The status page
**New file**: `public/review/index.html`

A single self-contained HTML document:
- `<head>`: `noindex` robots meta, page title, inline `<style>` (crimson brand
  palette, system/serif fonts, responsive cards).
- A **passphrase gate**: a small inline `<script>` that hides the content until a
  passphrase is entered (stored expectation is a simple hash/string constant with
  a clear "deterrent only" comment; easy to change or disable).
- **Body sections**:
  1. Header — project name, "internal review — please don't share publicly", last-updated date.
  2. At-a-glance status table (the 11-item summary from the scoping README).
  3. "Decisions we need your input on" — the 5 decisions, each with options + a
     prompt for feedback.
  4. Per-item cards: Homepage, Nav/IA, Chapters, Events, Content Hub, Membership,
     Functionality (done), Member login/SSO, Domain transfer, Content population,
     Publishing/access — each with status badge, description, decision, effort.
  5. Footer — links to the full scoping docs (relative to the repo) + a note that
     this is a living snapshot.

### 2. Keep it out of the product surface
- Confirm it is NOT referenced from `nav.json`, `BaseLayout`, or sitemap. Because
  it is a raw `public/` file (not an Astro route), it is not in the content
  collections and won't be crawled by the sitemap integration; the `noindex` meta
  is the belt-and-suspenders.

### 3. Scoping docs
The `docs/scoping/` markdown (README + harvard-key-sso + domain-transfer-runbook)
is already written; it is committed as part of this feature.

## Reused existing code

- Brand palette/tokens mirror `src/styles/tokens.css` (copied inline, not
  imported — the page is standalone).
- Content is a snapshot of `docs/scoping/README.md` and the two deep-dive docs.

## Scenarios to Demonstrate

- **Status page — gate locked**: initial load shows the passphrase prompt, content hidden.
- **Status page — unlocked**: after the passphrase, the full status + decisions render.

## Out of scope (this cycle)

- Actually publishing/deploying (merge-to-main or branch-deploy) and the final
  access-model confirmation — a separate step once the page is reviewed.
- Any change to the product site's routes, nav, or components.

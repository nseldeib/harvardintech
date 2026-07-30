---
title: "Migrate harvardintech.com Off Strikingly"
mode: backend
createdAt: "2026-07-30T15:08:12Z"
source: manual
dependsOn: ["two-track-publishing-live-site-and-private-review-site"]
---

## Summary

`harvardintech.com` is still served by Strikingly. Move it to this Astro site on
GitHub Pages with **zero downtime** and **no interruption to email**, then retire
Strikingly. The technical change is small — a handful of DNS records at GoDaddy
plus one build-config flip — and the risk is concentrated in a single apex
cutover that is mitigated by low TTLs and by keeping Strikingly live as rollback.

`docs/scoping/domain-transfer-runbook.md` already did the discovery work on
2026-07-02: registrar and DNS are at GoDaddy (not locked inside Strikingly), so
no registrar transfer is needed; email runs on HostGator via `MX →
mail.harvardintech.com` with SPF `include:websitewelcome.com` and must be
preserved untouched. This plan turns that runbook into an executable sequence,
adds the code changes it implies, and folds in the pre-launch cleanup the repo
needs before anything becomes publicly indexable.

## Key Decisions

- **Stage on the real domain before cutting over.** The apex only flips once the
  team has seen the new site working on a real `harvardintech.com` subdomain
  with a real TLS certificate. The two-track plan already stands up
  `review.harvardintech.com` for exactly this, so the staging step is free —
  no separate `new.harvardintech.com` is needed, which is a simplification over
  the original runbook's Phase 1.
- **Never touch `MX`, the `mail.` host record, or the SPF `TXT`.** Only the apex
  `A` records and the `www` `CNAME` change. "Replace all records" is the one
  action that would break `nadia@harvardintech.com` and every other mailbox.
- **Redirects are best-effort, and that is a deliberate accepted loss.** GitHub
  Pages cannot serve a server-side 301. Old Strikingly URLs that do not match a
  new path get a client-side soft redirect from the 404 page — good for humans
  following old links, weak for search engines. The alternative (putting
  Cloudflare in front purely for redirect rules) is not worth the added moving
  part for a site this size; revisit only if the URL inventory turns up
  high-traffic paths that changed.
- **Cut over only after the content "fill or remove" list is closed.**
  `docs/scoping/README.md` item 13 lists placeholder stats, three board members
  missing photos or bios, a blank Luma embed URL, and a single placeholder blog
  post. Those are fine behind a gate and not fine on a public launch.
- **Keep Strikingly paid and configured for several days after cutover.**
  Rollback is then just reverting the apex records — no re-provisioning.

## Implementation

### 1. Re-verify DNS before touching anything

The runbook's record table was captured 2026-07-02 and is the basis for every
step below; re-read it live before making changes. Confirm the apex is still
`A → 54.183.102.22` (Strikingly), `www` still `CNAME →
www.harvardintech.com.s.strikinglydns.com`, and — most importantly — capture the
current `MX` and `TXT` records verbatim so they can be diffed afterwards. Also
confirm who currently holds the GoDaddy login, which the runbook lists as an open
question ("Decisions needed from the team", item 1).

### 2. Inventory the Strikingly URLs and build the redirect map

**New file**: `src/lib/redirects.ts`

Enumerate the live Strikingly site's public URLs and map each to its new path.
`scripts/extract.mjs` already drives Playwright against
`https://www.harvardintech.com/` and can be adapted to crawl and dump the link
graph rather than screenshot sections — reuse it rather than writing a new
crawler.

The module holds the old-path → new-path table plus a pure lookup function, so
the map is unit-testable and reviewable as data. Paths that map 1:1 (`/`,
`/events`, `/blog`) need no entry.

**File**: `src/pages/404.astro`

Add an inline script that looks up `location.pathname` in the map and replaces
the location when it hits. Keep the existing "Go back home" fallback markup for
the misses — the page currently renders a bare 404 with a `withBase('/')` link
and nothing else. Note this is a soft (200 + JS) redirect, not a 301.

### 3. Add the custom-domain marker

**New file**: `public/CNAME` containing `harvardintech.com`

This is the mechanism `DEPLOY_SETUP.md` "Path A: Custom Domain" already
documents. Note it will also be copied into the review track's output; harmless,
since that repo's own `CNAME` (`review.harvardintech.com`, written by the review
publish step) is what governs there — but the review publish step must write its
`CNAME` *after* the copy, not before.

### 4. Flip the public track to custom-domain mode

**File**: `.github/workflows/deploy.yml`

In the public track's build step: drop `DEPLOY_BASE_PATH` (so `base` → `/`) and
set `PAGES_SITE: https://harvardintech.com`. Also drop `PREVIEW_GATE` — this is
the moment the public site becomes genuinely public. `astro.config.mjs` needs no
change; both values are already env-driven and documented for exactly this
switch.

Two things follow automatically and need no further work: `robots.txt` reverts
from `Disallow: /` to `Allow: /` with a correct absolute `Sitemap:` line (it is
built from `context.site`), and `sitemap-index.xml` plus `llms.txt` start
emitting the real domain.

A useful side effect: with `base` back at `/`, the `@codeyam/cms` admin's
root-absolute links (`AdminLayout.astro:39-54` and friends) resolve correctly
again — they are currently broken on the `/harvardintech` subpath deploy.

### 5. Pre-launch cleanup of publicly-served assets

**Directories**: `public/design-review-4ece6c14/`, `public/review/`

Both are served verbatim from `public/` and become reachable on
`harvardintech.com` the moment the gate comes off. `public/design-review-4ece6c14/`
holds thirteen abandoned design mockups; delete it. `public/review/index.html` is
the internal project-status page and carries its own hard-coded passphrase
(`crimson2026`) in client-side JavaScript — move it to the review track or
delete it, but it must not ship on the public domain.

Also audit `public/images/` for anything downloaded from
`custom-images.strikinglycdn.com` by `scripts/download-assets.mjs` that the site
no longer references.

### 6. DNS cutover at GoDaddy

Sequenced, with the low-risk steps first:

1. **A day ahead:** lower the TTL on the apex `A` and `www` `CNAME` records
   (300s) so the change propagates in minutes, not hours.
2. In the repo's **Settings → Pages**, set the custom domain to
   `harvardintech.com`.
3. At GoDaddy, replace the apex `A` records with GitHub's four:
   `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   Optionally add the `AAAA` records. Repoint `CNAME www → nseldeib.github.io`.
   **Leave `MX`, the `mail.` record, and every `TXT` untouched.**
4. Wait for GitHub to issue the certificate, then enable **Enforce HTTPS**.
5. Send a test email to and from an `@harvardintech.com` address to prove mail
   still flows. Do this before declaring the cutover done, not after.

### 7. Post-cutover verification

- `harvardintech.com` and `www.harvardintech.com` both serve the new site over
  HTTPS, no certificate warning.
- `robots.txt` says `Allow: /` and points at the real sitemap;
  `sitemap-index.xml` lists the real URLs.
- A sample of old Strikingly URLs from the step-2 inventory land somewhere
  sensible.
- Google Search Console: the verification meta tag survives (it lives in the CMS
  "Custom `<head>` HTML" field, per `docs/scoping/README.md` item 7); submit the
  new sitemap.
- `review.harvardintech.com` still resolves and is still gated — the cutover must
  not disturb the review track.

### 8. Retire Strikingly

Leave the Strikingly site paid and configured for several days after a clean
cutover. Only then cancel or downgrade. Record the rollback procedure (revert the
apex `A` records to `54.183.102.22` and `www` to the Strikingly `CNAME`) somewhere
the team can reach it without this repo.

### 9. Update the docs to match reality

**Files**: `docs/scoping/domain-transfer-runbook.md`, `docs/scoping/README.md`

The runbook is written in the future tense with open questions; rewrite it as
what was actually done, with the real record values and dates, so it is a record
rather than a proposal. In `docs/scoping/README.md`, item 9 ("Domain transfer —
🟡 Researched, ready") and decision #3 both close out.

## Reused existing code

- The env-driven `base` / `site` switch in `astro.config.mjs` — written for this
  exact cutover ("When a custom domain is configured, drop `DEPLOY_BASE_PATH`
  and point `PAGES_SITE` at the domain") and reused verbatim.
- `GET` from `src/pages/robots.txt.ts` (glossary entry: `GET`; test:
  `src/lib/seoEndpoints.test.ts`) — already flips `Disallow: /` → `Allow: /` and
  emits the correct absolute sitemap URL from `context.site`. No change needed.
- `withBase` from `src/lib/url.ts` (glossary entry: `withBase`; test:
  `src/lib/url.test.ts`) — every hand-written internal link is already
  base-aware, so the `/harvardintech` → `/` change needs no link edits.
- `scripts/extract.mjs` — an existing Playwright driver already pointed at
  `https://www.harvardintech.com/`; adapt it for the URL inventory in step 2.
- `docs/scoping/domain-transfer-runbook.md` — the DNS discovery, the MX-preservation
  rule, and the staged-then-cutover sequence all come from it.
- The `PREVIEW_GATE` env var introduced by the two-track plan (`src/lib/previewGate.ts`)
  — dropping it from the public build is what un-gates the launch.

**Existing-implementation survey.** Grepped before proposing new files:

- **`public/CNAME`** — does not exist; `public/` currently holds only
  `favicon.svg`, `images/`, `review/`, and `design-review-4ece6c14/`.
- **Redirect map / legacy path handling** — none anywhere in `src/`.
  `src/pages/404.astro` is a static 22-line page with no script.
- **Pointers to the old Strikingly site** — `docs/scoping/README.md` item 12
  records a 2026-07-02 audit finding the shipped pages clean; re-verify rather
  than re-audit from scratch.

## Reproduction Test

Not applicable — this is a migration and deployment plan, not a bug fix. The one
piece of genuinely testable logic it adds is the redirect map in
`src/lib/redirects.ts`; give it a vitest file alongside, covering an old path
that maps, an old path that does not, and a path that is already current. The
map's *contents* cannot be pinned until the step-2 URL inventory exists, so the
test is written against the lookup function, not against a guessed table.

## Scenarios to Demonstrate

- **Public launch build** — homepage with no passphrase overlay and no `noindex`,
  the state the world sees at cutover.
- **`robots.txt` after launch** — `Allow: /` plus the `https://harvardintech.com`
  sitemap URL.
- **404 with a mapped legacy path** — an old Strikingly URL that resolves to its
  new home.
- **404 with an unmapped path** — a genuine typo, showing the plain 404 with the
  "Go back home" fallback intact.
- **Review track during and after cutover** — `review.harvardintech.com` still
  gated and still showing drafts, proving the public launch did not disturb it.
- **Homepage with the content list closed out** — real stats, complete board
  roster, a populated events section: the launch-ready state, contrasted with
  today's placeholder-heavy build.
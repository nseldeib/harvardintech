---
title: "Domain Cutover Runbook Page"
mode: ui
createdAt: "2026-07-30T15:08:12Z"
scopedAt: "2026-08-05T22:00:00Z"
source: manual
dependsOn: ["two-track-publishing-live-site-and-private-review-site"]
---

## Summary

Map the Strikingly → GitHub Pages migration as a readable runbook on the gated
review site. **Perform none of it.** No DNS record is touched, no redirect map is
written, no `public/CNAME` is added, no `deploy.yml` flag is flipped.
`harvardintech.com` stays on Strikingly and the preview site stays gated,
exactly as they are today.

This plan began life as an executable nine-step cutover (that body is preserved
below in "Content the page carries" — the steps are re-aimed as the page's
source material rather than discarded). It was rescoped on 2026-08-05: Jared
asked to see the plan mapped out, not run. The migration itself remains queued
work for a later cycle, and this page is what the team will read when that cycle
starts.

The discovery it rests on is real and already done. `docs/scoping/domain-transfer-runbook.md`
established on 2026-07-02 that registrar and DNS are at GoDaddy — not locked
inside Strikingly, so no 5–7 day registrar transfer is needed — and that email
runs on HostGator via `MX → mail.harvardintech.com` with SPF
`include:websitewelcome.com`. That record table is the factual core of the page.

## Key Decisions

- **Two layers, one page.** The audience is genuinely split: Nicole and the team
  need to know what happens and what stays working; whoever sits in the GoDaddy
  console needs exact values. Splitting into two pages means the operator reads
  a summary that has drifted from the steps. One page, plain-language top,
  operator detail below.
- **Email preservation is the headline, not a footnote.** The single action that
  could do real damage is "replace all records" at GoDaddy, which would break
  `nadia@harvardintech.com` and every other mailbox. Every layer of the page
  states it: only the apex `A` records and the `www` `CNAME` change; `MX`, the
  `mail.` host record, and the SPF `TXT` are never touched.
- **Reached from `/review`.** A card on the existing status page, same
  passphrase — sitting next to the row it is the detail behind ("Domain transfer
  — Not started"). Not a separately-shared link: anyone reviewing the project
  should be able to find it.
- **Stable numbering, no state.** Every step and open decision carries an
  identifier the way the donor deck uses W1–W5 / Q1–Q4, so a one-line reaction
  lands exactly where it was meant. The page records nothing — no checkboxes, no
  persistence. A half-ticked checklist in one person's browser is worse than no
  checklist, because it reads as progress that nobody else can see.
- **The two `public/` exposures are named as open decisions, not resolved.**
  Both `public/design-review-4ece6c14/` (20MB, thirteen mockups, `noindex` but no
  passphrase) and `public/review/index.html` (carries `crimson2026` in
  client-side JS) become reachable on `harvardintech.com` the moment the gate
  comes off. The design gallery's unguessable URL *is* its access mechanism and
  it is an active board share, so deleting it breaks a live link. The page
  presents both with their trade-offs and picks neither — Jared settles them
  with the team.
- **Flat file in `public/`, not a directory.** `public/cutover-runbook.html`,
  following `public/donor-network.html`. Astro's dev server serves `public/`
  without directory-index resolution, so `/cutover-runbook/` 404s in the codeyam
  preview even though GitHub Pages would resolve it. This is a constraint the
  donor-network build already learned the hard way.

## Implementation

### 1. The runbook page

**New file**: `public/cutover-runbook.html`

A standalone document with `<meta name="robots" content="noindex, nofollow">`
and its own passphrase gate, matching `public/review/index.html`. Its own
`sessionStorage` key — unlocking the runbook should not also unlock the status
page, the same isolation `donor-network` chose (`src/shell.html:337`). Reuse the
review page's gate markup, styles, and deterrent-only comment rather than
inventing a second visual language; the two pages are read back to back.

Hand-maintained like `public/review/index.html`, not generated like
`donor-network.html`. The generator there exists because that page ships to two
targets with incompatible packaging (a complete document plus an
Artifact-publisher body); this page has one target, so a build step would be
machinery without a job.

Structure:

- **Layer 1 — plain language.** What the move is, that the site is already built
  and this is only about pointing the domain at it, that email keeps flowing
  untouched, the size of the risk window (minutes, with TTLs lowered a day
  ahead), that Strikingly stays paid as rollback, and what is needed from the
  team before anyone can start.
- **Layer 2 — operator detail.** The current-record table, the four GitHub A
  records, the exact sequence, verification, and rollback values. Collapsed by
  default (`<details>`) so layer 1 reads clean, but present on the same page and
  in the same numbering.
- **Open decisions.** Numbered, each with options and trade-offs, no
  recommendation where the call is the team's.

### 2. Entry point

**File**: `public/review/index.html`

Add a card in the "Also under review" section — the section that already holds
the supporter-recognition card — linking to `./cutover-runbook.html`. Same
relative-link form the existing donor-network card uses. The status table's
"Domain transfer from Strikingly" row gains a pointer to it, so the row and its
detail are connected in both directions.

### 3. Content the page carries

The material below is the nine-step sequence from the original plan plus the
2026-07-02 runbook discovery. It is the page's source content — writing it into
the page is the work; executing it is not.

- **Re-verify DNS first.** The record table was captured 2026-07-02; re-read it
  live before touching anything. Confirm the apex is still `A → 54.183.102.22`
  (Strikingly) and `www` still `CNAME → www.harvardintech.com.s.strikinglydns.com`,
  and capture the current `MX` and `TXT` verbatim so they can be diffed
  afterwards. Confirm who holds the GoDaddy login — still an open question.
- **Stage on the real domain before cutting over.** `review.harvardintech.com`
  from the two-track plan already serves this purpose, so no separate
  `new.harvardintech.com` is needed — a simplification over the original
  runbook's Phase 1.
- **Inventory the Strikingly URLs and build a redirect map.** `src/lib/redirects.ts`
  plus a lookup in `src/pages/404.astro`. GitHub Pages cannot serve a
  server-side 301, so this is a client-side soft redirect: good for humans
  following old links, weak for search engines. That loss is deliberate — putting
  Cloudflare in front purely for redirect rules is not worth the moving part at
  this size.
- **Add `public/CNAME`** containing `harvardintech.com` — the mechanism
  `DEPLOY_SETUP.md` "Path A" documents. It also lands in the review track's
  output, which is harmless as long as the review publish step writes its own
  `CNAME` *after* the copy, not before.
- **Flip the public track.** In `.github/workflows/deploy.yml`: drop
  `DEPLOY_BASE_PATH` (so `base` → `/`), set `PAGES_SITE: https://harvardintech.com`,
  drop `PREVIEW_GATE`. `astro.config.mjs` needs no change — both values are
  already env-driven for exactly this switch. Two things follow for free:
  `robots.txt` flips `Disallow: /` → `Allow: /` with a correct absolute
  `Sitemap:` line, and `sitemap-index.xml` plus `llms.txt` start emitting the
  real domain. A useful side effect: with `base` back at `/`, the `@codeyam/cms`
  admin's root-absolute links resolve correctly again — they are currently broken
  on the `/harvardintech` subpath deploy.
- **Pre-launch cleanup of `public/`** — the two exposures above, presented as
  open decisions.
- **DNS cutover at GoDaddy**, low-risk steps first: lower TTLs to 300s a day
  ahead → set the custom domain in Settings → Pages → replace the apex `A`
  records with `185.199.108.153`, `.109.153`, `.110.153`, `.111.153` and repoint
  `CNAME www → nseldeib.github.io`, leaving `MX`/`mail.`/`TXT` untouched → wait
  for the certificate, then enable Enforce HTTPS → **send a test email to and
  from an `@harvardintech.com` address before declaring the cutover done, not
  after.**
- **Post-cutover verification.** Both hosts serve over HTTPS with no certificate
  warning; `robots.txt` says `Allow: /`; a sample of old Strikingly URLs land
  somewhere sensible; the Search Console verification meta tag survives (it
  lives in the CMS "Custom `<head>` HTML" field); and
  `review.harvardintech.com` is still gated — the cutover must not disturb the
  review track.
- **Retire Strikingly** only after several clean days, and record the rollback
  (apex `A` → `54.183.102.22`, `www` → the Strikingly `CNAME`) somewhere the
  team can reach without this repo.

## Explicitly out of scope

Named so the boundary is checkable rather than remembered:

- No `src/lib/redirects.ts`, no URL crawl, no `404.astro` change.
- No `public/CNAME`.
- No `.github/workflows/deploy.yml` change — the site stays gated.
- No DNS record is read from or written to GoDaddy.
- No deletion or relocation of `public/design-review-4ece6c14/` or
  `public/review/index.html`.
- No rewrite of `docs/scoping/domain-transfer-runbook.md` into past tense; it
  stays a proposal because nothing has been done yet.

## Reused existing code

- `public/review/index.html` — the passphrase gate (markup, styles, and the
  DETERRENT-ONLY comment at `:439`), the card/section layout including the
  `cards--wide` modifier added in the last cycle, and the badge vocabulary. The
  runbook page is a sibling of this file, not a new design.
- `.codeyam/design/donor-network/src/shell.html:337` — the per-page
  `sessionStorage` key convention, so each standalone page unlocks
  independently.
- `docs/scoping/domain-transfer-runbook.md` — the DNS discovery table, the
  MX-preservation rule, and the stage-then-cutover shape.
- `docs/scoping/README.md` — item 9 and decision #3, which this page is the
  detail behind.

**Existing-implementation survey.** No cutover runbook page exists: `public/`
holds only `favicon.svg`, `images/`, `review/`, `design-review-4ece6c14/`, and
`donor-network.html`. The `/review` page's "Also under review" section currently
holds exactly one card (supporter recognition).

## Reproduction Test

Not applicable — this is a documentation page, not a bug fix. The page carries no
logic worth a unit test; its correctness is whether the content is true and the
gate holds, which the scenarios below demonstrate.

## Scenarios to Demonstrate

- **Runbook gate locked** — someone with the link and no passphrase. The page
  must reveal nothing behind the overlay.
- **Runbook gate refused** — a wrong passphrase, showing the error state.
- **Runbook unlocked, desktop** — the full page: plain-language layer, the open
  decisions, the numbering.
- **Runbook unlocked, mobile** — the same page narrow. A DNS record table is the
  classic thing that breaks at 375px, so this is the scenario that earns its
  keep.
- **Operator detail expanded** — the collapsed layer-2 sections open, showing the
  record values and the cutover sequence.
- **`/review` carrying the new card** — proving the entry point exists rather
  than asserting it, and that the existing supporter-recognition card still
  sits correctly alongside it.

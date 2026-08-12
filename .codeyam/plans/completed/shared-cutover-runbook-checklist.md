---
title: "Shared Cutover Runbook Checklist"
mode: ui
createdAt: "2026-08-06T14:34:25Z"
source: manual
---

## Summary

Turn the domain cutover runbook from a document the team *reads* into a checklist
the team *works through together*. Today `public/cutover-runbook.html` lays out
nine steps, five decisions, six checks and three rollback values, and records
nothing. This plan gives it shared, repo-backed progress — a tick carries who and
when, and everyone loads the same state — plus the four things the team asked for
to understand what they are approving: per-step risk, a timeline, ownership, and
a recommendation on each open decision.

**Still perform none of the migration.** No DNS record is read or written, no
`public/CNAME` is added, no redirect map is built, no `deploy.yml` track flag is
flipped. `harvardintech.com` stays on Strikingly and the review site stays gated.
The page continues to describe a move that has not happened; it just stops being
unable to record one.

The blocking fact does not change either: **D1 — who holds the GoDaddy login —
has been open since the 2026-07-02 discovery, and it gates S1, which gates
everything.** The page should say that louder after this plan, not quieter.

## Key Decisions

- **Reverse the no-checkbox decision, because its reasoning no longer applies.**
  The previous cycle deliberately shipped no checkboxes: *"a half-ticked checklist
  in one person's browser is worse than no checklist, because it reads as progress
  that nobody else can see."* That objection is about **browser-local** state, and
  it is correct. This plan does not add browser-local state — it adds state
  committed to the repo, so every reader loads the same ticks with real attribution.
  The old decision is superseded on its own terms, not overruled.

- **Attribution is GitHub identity, not a self-reported name.** A tick commits
  under the ticker's own GitHub account (the CMS's existing token model), so
  "Nadia ticked S2 on Aug 8" is recorded by the same mechanism that already
  proves who edited content. No name field to fill in, nothing to fake by
  accident.

- **The page moves out of `public/` and into the site proper.** This is the
  substantive architectural change and it has real costs, listed under
  *Trade-offs* below. It is what makes everything else possible: a raw `public/`
  file is copied verbatim into `dist/` and no Astro component ever renders it, so
  it can read no content, run no tests, and share no state.

- **Review-track only — which answers D4 for this page.** `PreviewGate` un-gates
  on the public track by design, so a plain `src/pages/` route would be *fully
  public* the moment the domain cuts over — strictly worse than today. Instead the
  runbook follows `/admin`: a `publishTrack.ts` predicate keeps it out of the
  public build entirely, so it is never reachable on `harvardintech.com`. D4 asked
  where this page should live after cutover; this settles it as "not on the public
  domain, ever" rather than leaving it for a decision at the riskiest moment.
  D4 remains open for the status page and the design gallery.

- **Optimistic tick, honest latency.** A tick is a commit, then a rebuild — up to
  a minute or two before anyone else sees it. The tick appears immediately for the
  person who made it and the page says plainly that others will see it shortly.
  Silently pretending it is instant is how a shared checklist loses trust the
  first time two people compare screens.

- **Concurrent ticks merge rather than refuse.** `commitAll` already throws
  `StaleBaselineError` when a path moved underneath you — correct for a batch of
  content edits reviewed as a unit, wrong for a single boolean. On conflict the
  page re-reads current state, reapplies only the field being toggled, and commits
  again. Two people ticking different steps never collide; two people ticking the
  same step converge on the same answer.

- **Nothing is ticked to begin with.** Production starts empty in the CodeYam
  model and that is exactly right here: day one is nine open steps and five
  unanswered decisions, because that is the true state of this migration. The
  populated states are scenarios, not seed data.

- **Recommendations, not neutrality, on D1–D5.** Each decision keeps its
  trade-offs and gains a stated suggestion with reasoning. A team reacting to a
  proposal resolves it far faster than a team starting from a blank page. They
  remain the team's decisions; the page stops pretending it has no view.

## Trade-offs accepted

Three properties are lost by moving the page into the site. Recording them so the
loss is a decision rather than a discovery:

1. **No more `file://` open.** `src/lib/reviewGate.js` states the constraint
   outright — a review artifact "has to work from a `file://` open". An Astro
   route cannot. Accepted: this page's job is to be the *live* status of a
   migration, which a downloaded copy actively undermines — a stale runbook opened
   from someone's Downloads folder showing week-old ticks is the failure mode this
   plan exists to prevent. The standalone artifacts that genuinely need `file://`
   (the donor deck, the design gallery) are untouched.

2. **No more independent revocation.** The runbook has its own `sessionStorage`
   key today, so unlocking the status page does not unlock it — each artifact is
   shared and revoked separately. Under the site's `PreviewGate` there is one key
   for the whole review site: one passphrase opens everything. Accepted: the two
   pages already share a passphrase and are already linked to each other in both
   directions, so the separation was nominal.

3. **Astro's `public/` directory-index constraint stops applying.** The prior plan
   chose a flat `public/cutover-runbook.html` because `/cutover-runbook/` 404s in
   the dev server for static files. As a route this no longer binds — but the URL
   changes from `/cutover-runbook.html` to `/cutover-runbook`, so both `/review`
   links and all four existing scenarios must be updated in the same change.

## Implementation

### 1. Progress state — a seedable singleton

**New file**: `src/data/cutoverProgress.json`

Follows the established singleton pattern (`nav.json`, `settings.json`,
`volunteerPage.json`). Shape: one record per step `S1`–`S9` and per decision
`D1`–`D5`, each holding `done`/`answered`, the GitHub login that set it, and an
ISO timestamp. Ships with everything open.

**New file**: `src/lib/cutoverProgress.ts` — reader + pure helpers, built on
`readSingleton` (`src/lib/site.ts`) so it honours the codeyam sandbox redirect via
`dataRoot()`. Pure functions carry the logic worth testing: which steps are
unblocked given which decisions are answered, the roll-up counts, and the
timeline bucketing.

The seed adapter (v5) writes an object-valued seed key verbatim to
`src/data/<key>.json`, so every tick-state scenario is one seed object with no
extra machinery.

### 2. The page

**New**: `src/pages/cutover-runbook/[...path].astro` (dynamic so `getStaticPaths`
can return `[]` on the public track), rendering a `CutoverRunbook` component tree
under `BaseLayout`. The 50KB of authored prose in `public/cutover-runbook.html`
ports across substantially intact — this is a re-housing, not a rewrite. The
hand-rolled gate script is dropped; `PreviewGate` covers it.

**Delete**: `public/cutover-runbook.html` once the route is verified.

**Modify**: `src/lib/publishTrack.ts` — add `includeCutoverRunbook(isDev,
isReviewTrack)` mirroring `includeCmsIntegration`, with its rationale beside the
existing two and a case in `publishTrack.test.ts`.

**Modify**: `public/review/index.html` lines 218 and 244 — both links repoint to
`/cutover-runbook`.

### 3. Ticking

**New**: a React island for the checkbox rows, using the CMS's existing client
libs — `authSession` for identity (`getSession`, `signInWithToken`),
`githubAuth.cachedToken()` for the token, `commitAll` from `githubCommit` to write
`src/data/cutoverProgress.json` to the `staging` branch named in
`src/data/cms.json`.

Read-only for signed-out visitors: everyone sees current state, only repo-write
holders can tick. The sign-in affordance reuses the CMS `AuthGate` pattern rather
than inventing a second one.

`isCodeyamPreviewHost()` already hands localhost and the fleet preview a demo
signed-in session, so scenario captures render the ticking UI without stubbing,
while the real domain still requires a token.

### 4. Content the team asked for

- **Risk per step** — what a bad outcome looks like, how we would know, and how
  fast. Six of the nine touch nothing live; saying that plainly is what makes S5
  and S7 stand out.
- **Timeline** — days-ahead / on-the-day / after, with rough durations, so the
  calendar is visible rather than inferred from a flat list.
- **Ownership** — every step tagged Jared / GoDaddy-login-holder / the team, so
  it is obvious at a glance which steps the team must act on.
- **Recommendations on D1–D5** — a stated suggestion and reasoning per decision.

### 5. Scenarios

Six application scenarios, each a one-object seed:

| Scenario | State |
| --- | --- |
| Nothing started | The production default: nine open steps, D1 unanswered and visibly blocking every one |
| Decisions answered | D1–D5 resolved, steps unblocked — what "ready to go" looks like |
| Partway through | Several steps ticked by different people on different days — shared state working |
| Cutover day | Through S7, checks outstanding |
| Complete | All nine done including S9 |
| The records on a phone | The DNS table at 390px, re-verified after the port — the prior cycle's mobile capture found the "Do not touch" badges scrolled off-screen |

Plus the gate states, re-registered against `PreviewGate` instead of the removed
hand-rolled script.

**Re-register**: all four existing `cutover-runbook-*` scenarios. Their `url`
changes to `/cutover-runbook`, their `pageFilePath` to the new route, and the
unlocked/refused scenarios' `#pass` / `#enter` interactions must retarget
`PreviewGate`'s markup.

## Out of scope

Explicitly not in this cycle, so the boundary stays checkable:

- Any DNS read or write. No `dig` against the live domain, no GoDaddy access.
- `public/CNAME`, redirect map, `src/lib/redirects.ts`, `404.astro` changes.
- Any `deploy.yml` change, including removing `PREVIEW_GATE` or `DEPLOY_BASE_PATH`.
- Resolving D1–D5. The page recommends; the team decides.
- D3/D4 for the design gallery and the status page — this plan removes only the
  runbook itself from the public-track exposure list.
- Migrating `public/donor-network.html` or `public/review/index.html` off their
  hand-rolled gates. The triplication stays; one page moves, two do not.
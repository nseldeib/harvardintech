# Harvard Alumni in Tech — Project Scoping & Decisions

> Working scoping document for the migration from the current Strikingly site to
> this modern, GitHub Pages–hosted site + CRM. This is the source material for a
> non-technical-friendly "status & decisions" page (to be built later).
>
> Last updated: 2026-07-02. Owner: Nadia Eldeib.

## How to read this

Each item below has a **status**, a **plain-language description**, the
**decision(s) needed** from the team, the **options** with trade-offs, and an
**effort** estimate. Two items have their own deep-dive docs:

- [Harvard Key SSO / member login](./harvard-key-sso.md)
- [Domain transfer: Strikingly → GitHub Pages](./domain-transfer-runbook.md)

Effort key: **S** = hours · **M** = 1–3 days · **L** = ~1 week · **XL** =
multi-week / externally gated.

---

## Status at a glance

| # | Item | Status | Effort | Needs a decision? |
|---|---|---|---|---|
| 1 | Homepage (all sections) | ✅ Built | — | No — content only |
| 2 | Navigation / IA | ✅ Built (Substack missing) | S | Minor |
| 3 | Chapters (structure) | ✅ Built | — | No — needs content |
| 4 | Events page | 🟡 Luma built; sections missing | M | **Yes — design** |
| 5 | Content Hub / Communities | ✅ Built (add Substack) | S | Minor |
| 6 | Membership sections | ✅ Built | — | No — content |
| 7 | Google Analytics / SEO / AEO / Custom HTML / iFrame | ✅ Built & shipped | — | No |
| 8 | **Member login / Harvard Key SSO** | ❌ Not built | **XL** | **Yes — big** → [deep dive](./harvard-key-sso.md) |
| 9 | **Domain transfer from Strikingly** | 🟡 Researched, ready | M | Registrar/DNS confirmed → [deep dive](./domain-transfer-runbook.md) |
| 10 | Content population | 🟡 framework ready | M (ongoing) | Yes — client input |
| 11 | Publishing / shareable preview access | ✅ Two-track (live + gated review site) | — | Resolved |
| 12 | Outbound links / no old-site pointers | ✅ Audited & clean | — | No |

**Headline:** the *website* is largely built. The remaining work clusters in
three places: (a) **member login** (the one hard, externally-gated item), (b)
**launch plumbing** (domain + publishing), and (c) **content population** (data
entry, mostly non-technical).

---

## Decisions needed (the short list for your team)

1. **Member login approach** — Pursue Harvard Key directly, use a lighter
   verification (email magic-link / Google sign-in + manual approval), or defer
   login entirely for v1? *(This is the biggest decision — see deep dive.)*
2. **Events page** — Match the richer hbswa.org directory layout, or keep the
   current cleaner Luma-first layout (just add Webinars/Podcasts sections)?
3. **Domain** — Who controls the `harvardintech.com` registrar/DNS today? When
   is the team comfortable cutting over? *(See deep dive.)*
4. ~~**Preview access**~~ — **Resolved.** The preview is no longer a temporary
   pre-launch state that disappears at cutover; a gated site runs permanently
   alongside the live one. Today that is `nseldeib.github.io/harvardintech`
   (reviewed) plus `nseldeib.github.io/harvardintech-staging` (working); after the
   cutover the gated track becomes `review.harvardintech.com`. It keeps the
   deterrent-level gate (client-side passphrase + `noindex` + robots
   `Disallow`). *Still open if the team wants it:* moving the gated track to
   Cloudflare Pages behind Cloudflare Access buys real per-person
   authentication — see [DEPLOY_SETUP.md](../../DEPLOY_SETUP.md).
5. **Content ownership** — Who supplies chapter committees, per-chapter events,
   and podcast/blog entries? *Board photos are no longer part of this question —
   all 5 are in place. Board bios are, but they are optional and post-launch: the
   live site has none to copy, and the board renders correctly without them (see
   item 13).*

---

## Per-item detail

### 4. Events page — 🟡 needs a design decision
- **Built:** Luma calendar embed + Upcoming/Past event lists.
- **Gap:** The nav links to `/events#webinars` and `/events#podcasts`, but those
  sections don't exist yet, and events have no "type" field to split them.
- **Decision:** Replicate the hbswa.org directory-style page, or keep Luma-first
  and just add Webinars/Podcasts sections?
- **Effort:** M. Add an event `type` field + section rendering. If matching
  hbswa's layout exactly, add design time.

### 7. GA / SEO / AEO / Custom HTML / iFrame — 🟡 built, not all editable
Shipped. GA activates from a GA4 ID in `settings.json` (blank = off); custom
head/body HTML covers verification tags, pixels, chat widgets. robots.txt +
llms.txt + JSON-LD are automatic, and per-page SEO overrides work on posts.

**Correction (2026-08-03):** these three keys are *data* but have no input in
/admin — the CMS renders five scalar settings fields (title, public URL,
description, contact email, footer text) and round-trips every other key
untouched. Setting the GA id is still a developer edit. The homepage figures had
the same problem and were moved to a `stats` collection; GA and the custom HTML
boxes are the remaining cases.

### 8. Member login / Harvard Key SSO — ❌ the hard one
See [harvard-key-sso.md](./harvard-key-sso.md). Short version: Harvard Key is
institutional SSO that requires Harvard IT approval and a server-side auth layer
(which a pure static site can't provide). HBS Women's Association got it via a
**paid third-party alumni platform (iModules/Anthology)**, not by building it.
Realistic lighter-weight alternatives exist and are far cheaper/faster.

### 9. Domain transfer — ❌ not started
See [domain-transfer-runbook.md](./domain-transfer-runbook.md). Low technical
effort once you have registrar/DNS access; the risk is coordination and not
breaking existing email (MX records). Recommended approach: stage on a subdomain
first, then cut over the apex with zero downtime.

### 10. Content population — 🟡 framework ready
The biggest *volume* of remaining work, but it's CMS data entry a non-technical
editor can do: chapter committee members, per-chapter events, blog + podcast
entries. Needs the client to provide the content.

Board **photos** are done — all 5 are in place. Board **bios** are the one item
on this list the live site cannot supply (it has none — see item 13), so they are
net-new writing rather than data entry, and optional: the board renders correctly
without them.

### 11. Publishing / shareable preview — ✅ two-track publishing
Two sites are built from this one repo. **Today neither is public** —
harvardintech.com is still Strikingly's — so the split is between a link that
holds still and a link that moves:

- **Reviewed** — `main` → `nseldeib.github.io/harvardintech`. The link the team
  has. Moves only when someone promotes.
- **Staging** — `staging` → `nseldeib.github.io/harvardintech-staging`. Takes
  every commit, so work in progress never disturbs the reviewed link.

Both are passphrase + `noindex` + robots `Disallow` (deterrent-level privacy),
show **drafts**, and serve `/admin`.

**After the domain cutover** the roles split into live and review: `main` →
harvardintech.com (open, indexable, published content only) and `staging` →
`review.harvardintech.com` (gated, drafts visible, the only place `/admin` is
served). The gated track is permanent, not a pre-launch stopgap.

Two axes phase a change: the `staging` branch phases *code*, the CMS Draft toggle
phases *content*. Promotion is one button: **Actions → Promote review → live**.

The gate is now an explicit `PREVIEW_GATE` env var rather than being inferred
from `DEPLOY_BASE_PATH`, so the domain cutover no longer un-gates anything as a
side effect. See [DEPLOY_SETUP.md](../../DEPLOY_SETUP.md) for the one-time review
repo / DNS / deploy-key setup, and [CMS_SETUP.md](../../CMS_SETUP.md) for what
editors do. [nicole-review.md](../nicole-review.md) is the ready-to-send handoff
for an external reviewer — links plus passphrase, kept internal.

### 12. Link & experience audit (2026-07-02) — ✅ clean
- **No pointers to the old Strikingly site** anywhere in the shipped pages.
  Fixed this pass: the "Donate" button (was a 404 `harvardintech.com/donate`) now
  opens a giving-inquiry email — there is **no donation platform yet**, so it
  matches the site's email-based support model until one is chosen; the WhatsApp
  "admissions criteria" link (was the old site) now points to the Google Form.
- **Nav dropdowns + links all resolve** — all `/#…` homepage anchors exist, all
  5 chapter routes render, blog/events/external links (Medium, LinkedIn,
  Newsletter, Eventbrite, Mailchimp) are valid. WhatsApp uses the real Google
  Form + group invite.
- **Two known gaps:** the "Webinars" and "Podcasts" dropdown items jump to
  `/events` (those sections aren't built yet — see item 4). **Substack** is
  intentionally omitted — the channel doesn't exist yet; add it to the Content
  Hub once there's a URL (tracked under "What we need from you" on the review
  page).
- **`/admin`** is a password-gated organizer CRM, not in the public nav — it is
  NOT the member portal (see item 8).

### 13. Content "fill or remove" list — re-checked 2026-08-03
The 2026-07-02 list is largely closed. Current state:

- ~~**Podcasts** / **Webinars**~~ — **Resolved.** `nav.json`'s Programs group
  holds one item, "All Events". Nothing points at a section that does not exist.
- ~~**Events list**~~ — **Resolved.** 8 events entered.
- ~~**Blog**~~ — **Resolved.** 11 posts.
- ~~**Stats**~~ — **Resolved.** The figures are real (8,000+ / 6 / 100+ /
  Est. 2013), not the 1,000+ / 5 / 40+ placeholders this list recorded. They are
  now the `stats` collection, so an editor can correct them.
- **Events calendar** — Luma embed URL still blank; shows the "subscribe on Luma"
  fallback → provide the embed URL, or set the events band to *coming soon*.
- ~~**Board**~~ — **Resolved, with a caveat.** All 5 members have photos, and
  **there are no bios to reproduce**: the live Strikingly board is a single flat
  image with no bio text under it, re-confirmed 2026-08-04. So the board ships
  as photo + name + role, which is exactly what harvardintech.com shows today —
  this is fidelity, not a gap. Bios are a *client-supplied enhancement* with no
  code dependency: the `bio` field is already in the schema
  (`src/content/config.ts`), already editable in /admin, and already rendered by
  `BoardMemberTile.astro` the moment it is filled in. The
  `board-of-directors-two-of-five-bios-written` scenario shows the partially-filled
  state, so trickling bios in one at a time is a supported end state, not a
  broken intermediate one. **Nothing here blocks cutover.**
- **Testimonials / Donors** — both collections are empty. The donor wall renders
  its invitation state by design; the testimonials band renders nothing.
- **Sponsors** — all 3 entries are marked *Example entry*, so the wall carries its
  "examples, not actual sponsors" notice. Fine to ship, but worth a decision.
- **Donate** — no platform. The URL is now editable in /admin (Page settings →
  Momentum Fund page), so choosing one is no longer a code change.

Anything on this list that is not ready at cutover no longer has to be either
shipped broken or removed: set the band to **coming soon** or **Draft** from
/admin and turn it on later. See [editing-the-site.md](../editing-the-site.md).

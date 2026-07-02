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
| 11 | Publishing / shareable preview access | ✅ Live (gated GitHub Pages) | — | Done for WIP |
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
4. **Preview access** — Confirm the "unlisted GitHub Pages + noindex +
   client-side password gate" approach for the shareable preview & status page
   (deterrent-level privacy), or move the preview to a host with real password
   protection (Cloudflare/Netlify).
5. **Content ownership** — Who supplies chapter committees, per-chapter events,
   board bios/photos, and podcast/blog entries?

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

### 7. GA / SEO / AEO / Custom HTML / iFrame — ✅ done
Shipped this session. GA activates by pasting a GA4 ID in the CMS (blank = off).
Custom head/body HTML boxes cover verification tags, pixels, chat widgets.
robots.txt + llms.txt + JSON-LD are automatic. Per-page SEO overrides on posts.

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
editor can do: chapter committee members, per-chapter events, real board
bios/photos, blog + podcast entries. Needs the client to provide the content.

### 11. Publishing / shareable preview — ✅ live (gated)
The site + this review page are deployed to `https://nseldeib.github.io/harvardintech/`
(review at `/review/`), behind a client-side passphrase + `noindex` + robots
`Disallow` (deterrent-level privacy). The gate auto-lifts at the custom-domain
launch (it's keyed off `DEPLOY_BASE_PATH`).

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

### 13. Content "fill or remove" list (2026-07-02)
Placeholders/stubs flagged on the review page ("Content to fill or remove"):
- **Podcasts** — none exists; nav item → remove or create.
- **Webinars** — no section; nav jumps to /events → build or remove.
- **Events calendar** — Luma embed URL blank; shows a "subscribe on Luma"
  fallback → provide the embed URL.
- **Events list** — no events entered → add, or rely on Luma.
- **Stats** — 1,000+ / 5 / 40+ / Est. 2013 are placeholder defaults → verify.
- **Board** — 3 of 5 members missing a photo or bio → complete + confirm roster.
- **Blog** — only a placeholder "Welcome" post → add posts or hide.
- **Donate** — no platform → set one up or keep the email fallback.

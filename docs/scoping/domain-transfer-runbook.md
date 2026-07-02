# Deep Dive: Domain Transfer — Strikingly → GitHub Pages

> How to move `harvardintech.com` from the current Strikingly site to this
> GitHub Pages site with **zero downtime** and **without breaking email**. Low
> technical effort; the real work is access + coordination.

## The one rule that prevents disasters

**Do not touch `MX` records.** If email (e.g. `@harvardintech.com`) runs on this
domain, the `MX` records must be preserved exactly. We only change the records
that point web traffic (`A` / `AAAA` / `CNAME`) — never `MX`, and never blindly
"replace all records."

## Step 0 — Current setup (DISCOVERED 2026-07-02)

Confirmed via live DNS/RDAP lookup:

| What | Value | Action |
|---|---|---|
| **Registrar** | GoDaddy.com, LLC | Keep — no transfer needed |
| **DNS host** | GoDaddy (`ns05/ns06.domaincontrol.com`) | Edit records here (full control) |
| **Apex web** (`harvardintech.com`) | `A → 54.183.102.22` (Strikingly) | **Change** → GitHub Pages IPs |
| **`www`** | `CNAME → www.harvardintech.com.s.strikinglydns.com` (Strikingly) | **Change** → `nseldeib.github.io` |
| **Email** | `MX → mail.harvardintech.com` (SPF `include:websitewelcome.com`, HostGator) | **PRESERVE — do not touch** |
| **SPF/TXT** | `v=spf1 a mx include:websitewelcome.com ~all` | **PRESERVE** (email deliverability) |

**Good news:** DNS lives at GoDaddy (not locked inside Strikingly), so we edit
records directly — **no 5–7 day registrar transfer required.** Email
(`nadia@harvardintech.com` etc.) is hosted separately (HostGator, `mail.` +
`websitewelcome.com`), so as long as we never change the `MX` record, the mail
`A`/host record, or the SPF `TXT`, email keeps flowing through the cutover with
zero interruption. We only touch the apex `A` and the `www` `CNAME`.

## Recommended approach: stage first, then cut over (zero downtime)

Rather than repointing the live domain and hoping, we validate on a subdomain
first so the apex only flips once we've *seen* it working.

### Phase 1 — Publish + test on a staging subdomain
1. Deploy the site to GitHub Pages (see "Publishing the WIP preview" below).
2. Add a **staging subdomain** — e.g. `new.harvardintech.com` — as the GitHub
   Pages custom domain (writes a `CNAME` file in the repo).
3. At the DNS host, add **one** record: `CNAME new → nseldeib.github.io`. This
   touches nothing about the live site or email.
4. Wait for propagation + GitHub's TLS cert, then review the real site on the
   real domain (subdomain) with the team. **The live Strikingly site is
   untouched during all of this.**

### Phase 2 — Cut over the apex (the ~minutes-of-risk window)
Only when everyone's happy:
1. Lower the TTL on the existing web records a day ahead (so changes propagate
   fast).
2. Change the GitHub Pages custom domain to the apex `harvardintech.com` (updates
   `CNAME`).
3. At the DNS host, point the apex at GitHub Pages:
   - `A` records → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`,
     `185.199.111.153`
   - (optional) `AAAA` records → GitHub's IPv6 addresses
   - `CNAME www → nseldeib.github.io`
   - **Leave `MX` and any TXT/verification records alone.**
4. In `astro.config.mjs`, switch to **custom-domain mode**: remove
   `DEPLOY_BASE_PATH` (so `base` → `/`) and set `PAGES_SITE=https://harvardintech.com`.
   Re-deploy.
5. Once GitHub issues the cert, enable **"Enforce HTTPS."**
6. Verify, then **cancel/downgrade Strikingly** (keep it a few days as rollback).

### Rollback
Because Strikingly stays live until Phase 2 and DNS TTLs are low, rollback is
just reverting the apex records. Keep the Strikingly config until the new site is
confirmed stable for a few days.

## SEO / continuity notes

- **Search Console verification** is already handled — paste the verification
  meta tag into the CMS "Custom `<head>` HTML" field (built this session).
- `robots.txt`, `llms.txt`, and `sitemap-index.xml` auto-use the real domain once
  `PAGES_SITE` is set. ✅
- **Redirects:** GitHub Pages can't do server-side 301s. If Strikingly URLs
  differ from the new paths, some link equity may be lost. If the paths mostly
  match (home, /events, /blog), impact is minimal. Worth a quick URL map before
  cutover.

## Publishing the WIP preview (needed before Phase 1, and for sharing now)

The existing workflow deploys **`main` → `nseldeib.github.io/harvardintech`**.
Two things to decide:

1. **Branch:** the WIP is on `atlas-homepage-events-revamp`. To publish it we
   either merge to `main` or point the deploy workflow at the branch/a preview
   path.
2. **Access:** per the access-model decision, the intended approach is **unlisted
   GitHub Pages URL + `noindex` + a client-side password gate** (deterrent-level
   privacy, no new host). ⚠️ Caveat: a client-side gate is a deterrent, not real
   security — the page source is still fetchable by a determined visitor. If the
   preview must be genuinely private, host it on **Cloudflare Pages / Netlify**
   (free tier, real password protection) instead.

## Effort & risk summary

- **Technical effort:** low — a handful of DNS records + one config switch.
- **Real effort:** coordination + access. Confirm who owns the registrar/DNS and
  whether the domain must be transferred out of Strikingly first.
- **Risk:** low *if* we stage first and never touch `MX`. The apex cutover is the
  only brief-risk moment, mitigated by low TTLs + keeping Strikingly as rollback.

## Decisions needed from the team

1. Who controls the `harvardintech.com` registrar and DNS today?
2. Is the domain registered *inside Strikingly* (may require a domain transfer
   first) or at an external registrar (repoint DNS only)?
3. Is there email on `@harvardintech.com` whose `MX` records must be preserved?
4. Target cutover date (after the team signs off on the staged preview).

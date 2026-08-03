# GitHub Pages Deploy Setup

The build agent will ask which setup applies to your project.

## Today: two gated sites, neither public

Until the Strikingly migration `harvardintech.com` is still Strikingly's and is
untouched. Both sites below are private:

| Branch | Origin | Role | Gate | Drafts | `/admin` | Sitemap |
| --- | --- | --- | --- | --- | --- | --- |
| `main` | nseldeib.github.io/harvardintech | **reviewed** | passphrase + `noindex` | **visible** | **served** | none |
| `staging` | nseldeib.github.io/harvardintech-staging | **working** | passphrase + `noindex` | **visible** | **served** | none |

They differ only in **cadence**, not configuration. `staging` takes every commit;
`main` moves only when someone promotes. That is the whole point — the link the
team reviews holds still, so nobody opens it mid-change and finds half-finished
work.

Both builds set `PREVIEW_GATE=1` and `INCLUDE_DRAFTS=1`. **Dropping
`PREVIEW_GATE` is the switch that takes a site public** — do not do it before the
cutover.

The staging site is hosted on the staging repo's own Pages URL rather than
`review.harvardintech.com` on purpose: a custom domain would mean adding a DNS
record to `harvardintech.com`, and that domain stays untouched until the
migration is approved. See "At the cutover" below for the three-line diff.

**Content edits land on `staging` too.** The CMS commits to the branch named in
`src/data/cms.json`, which is `staging`, so an edit from either site's `/admin`
goes through the same promote as a code change. This is what keeps the cutover
safe: `main` becomes the public site, and nothing reaches it except a promote.

The CMS is deliberately not behind the passphrase; it has its own GitHub-token
sign-in and is `noindex, nofollow`. See [docs/nicole-review.md](docs/nicole-review.md).

## At the cutover: the roles swap

When the Strikingly migration is approved, `main` becomes the public site and
`staging` becomes the gated review origin:

| Branch | Origin | Gate | Drafts | `/admin` | Sitemap |
| --- | --- | --- | --- | --- | --- |
| `main` | harvardintech.com | open, indexable | hidden | absent | published |
| `staging` | review.harvardintech.com | passphrase + `noindex` | **visible** | **served** | none |

Two things must change together: `main`'s `PREVIEW_GATE=1` comes off, and a gated
track must still be standing. Removing the gate while nothing else is private
would leave the whole site unprotected.

Moving staging onto `review.harvardintech.com` is three lines in the `staging`
job of `deploy.yml` — drop `DEPLOY_BASE_PATH`, point `PAGES_SITE` at the
subdomain, restore the `CNAME` write — plus one additive GoDaddy record
(`CNAME review → nseldeib.github.io`) and the custom domain set on the staging
repo. That record creates a new subdomain and touches nothing that exists: the
apex `A`, the `www` `CNAME`, the `MX` records, and the SPF `TXT` are all
unaffected, so it cannot disturb the live site or `@harvardintech.com` email.

There is no per-track code — the difference is three environment variables read
by `astro.config.mjs`, `src/lib/previewGate.ts`, and `src/lib/draftVisibility.ts`:

| Variable | `main` today | `staging` today | `main` public | `staging` on its subdomain |
| --- | --- | --- | --- | --- |
| `DEPLOY_BASE_PATH` | `/harvardintech` | `/harvardintech-staging` | drop at domain cutover | unset — base stays `/` |
| `PAGES_SITE` | `https://nseldeib.github.io` | `https://nseldeib.github.io` | `https://harvardintech.com` | `https://review.harvardintech.com` |
| `PREVIEW_GATE` | `1` | `1` | unset | `1` |
| `INCLUDE_DRAFTS` | `1` | `1` | unset | `1` |

`@codeyam/cms` **0.2.1** added base-path support, so the dashboard runs correctly
under a subpath — which is what makes both gated sites above possible.
Before 0.2.1 the admin pages built to the right place but every link inside them
pointed at the origin root, so the CMS was unreachable on a project site. If you
ever see admin links 404 while the pages themselves load, that is the symptom of
an older version; check the installed one before debugging anything else.

Promotion is a merge `staging` → `main`, run from the Actions tab via the
**Promote review → live** workflow (`.github/workflows/promote.yml`).

## Two Base Modes (Chosen at Setup)

Depending on whether your site uses a custom domain or a default subpath, select the correct branch in `astro.config.mjs`:

### Path A: Custom Domain (e.g., harvardintech.com)

1. Set `site` and `base` in `astro.config.mjs`:
   ```javascript
   site: 'https://harvardintech.com', // Your custom domain
   base: '/',
   ```
2. Create a file named `public/CNAME` in your project and write your custom domain name there (e.g., `harvardintech.com` without any protocol).
3. Update your DNS provider with the following records pointing to GitHub's servers:
   - A records:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - CNAME record pointing to `<your-username>.github.io`

### Path B: Default GitHub Pages Subpath (e.g., user.github.io/repo)

1. Set `site` and `base` in `astro.config.mjs`:
   ```javascript
   site: 'https://<username>.github.io',
   base: '/<repo-name>/', // Must end with a trailing slash!
   ```

---

## Configuring GitHub Pages

**It's automatic.** Pushing to the default branch runs `.github/workflows/deploy.yml`,
whose build job enables GitHub Pages for you (Source: **GitHub Actions**) via
`actions/configure-pages` with `enablement: true`. There is no manual
Settings → Pages toggle in the common case — the first deploy creates the site
and publishes it.

### If the first deploy 404s

Some org/permission policies block token-based enablement, so the first run can
still fail with `HttpError: Not Found (404) ... Ensure GitHub Pages has been
enabled`. To recover, do **either**:

- Run the helper once (requires the authenticated `gh` CLI):
  ```bash
  ./scripts/enable-pages.sh
  ```
- **Or** toggle it in the UI: repo **Settings** > **Pages** > **Build and
  deployment** > **Source** → **GitHub Actions**.

Then re-run the workflow:
```bash
gh workflow run "Deploy to GitHub Pages" --ref <default-branch>
```

---

## Staging-track setup (one-time, manual)

The `main` track works as-is. The staging track needs four things that cannot be
done from inside this repo. Until they exist, pushes to `staging` fail at the
"Publish to staging repo" step and **`main` is unaffected** — so this is safe to
leave half-done.

**No DNS step.** The staging site is served from the staging repo's own Pages URL,
so `harvardintech.com` is never touched. Moving it onto
`review.harvardintech.com` is a later, separate change — see "At the cutover".

One GitHub repo hosts exactly one Pages site, so a second origin genuinely
requires a second repo. It holds only generated output; there is no source in it.

1. ✅ **Create the staging repo** — `nseldeib/harvardintech-staging`. **Done, and
   it is PUBLIC.** It has to be: Pages on a private repo requires a paid plan, and
   this account is on the free tier — the API rejects it with *"Your current plan
   does not support GitHub Pages for this repository."* Public costs no privacy
   here, because the repo holds only **generated output** built from
   `nseldeib/harvardintech`, which is itself already public. The privacy is
   carried by the passphrase gate and `noindex`, not by repo visibility (see the
   note below).

2. ✅ **Generate a deploy key** and install both halves. **Done** — a write-access
   deploy key titled *github-actions staging deploy* on the staging repo, with the
   private half stored here as the **`REVIEW_DEPLOY_KEY`** secret. To rotate it:
   ```bash
   ssh-keygen -t ed25519 -C 'harvardintech-staging deploy' -f review_deploy_key -N ''
   gh repo deploy-key add review_deploy_key.pub -R nseldeib/harvardintech-staging -w
   gh secret set REVIEW_DEPLOY_KEY -R nseldeib/harvardintech < review_deploy_key
   rm -f review_deploy_key review_deploy_key.pub
   ```
   A deploy key rather than a personal access token: it is scoped to exactly one
   repo and carries no person's identity, so it survives staff changes.

3. ✅ **Create the `staging` branch** off `main` and push it. **Done** — the branch
   exists on origin and its builds are green.
   ```bash
   git checkout -b staging main && git push -u origin staging
   ```

4. ✅ **Enable Pages on the staging repo** — **Done.** **Settings → Pages →
   Source: Deploy from a branch**, branch **`gh-pages`**, folder `/ (root)`, or:
   ```bash
   gh api -X POST repos/nseldeib/harvardintech-staging/pages \
     -f 'source[branch]=gh-pages' -f 'source[path]=/'
   ```
   **This must come after step 3** — the API refuses with *"The gh-pages branch
   must exist before GitHub Pages can be built"* until the first build has pushed
   it.

Then visit `https://nseldeib.github.io/harvardintech-staging/` — the passphrase
overlay should appear. The passphrase is `crimson2026` unless overridden by a
`PREVIEW_GATE_PASSPHRASE` env var in the workflow.

> **How private is this, really?** The passphrase is a **deterrent, not
> authentication** — it ships in the client bundle, and the admin pages embed
> draft markdown in fetchable HTML. It keeps both gated sites out of search
> results and away from casual visitors. If the content is genuinely sensitive,
> host the gated track on **Cloudflare Pages behind Cloudflare Access** instead
> (free for up to 50 users): per-person email one-time-PIN, individually
> revocable, and the raw-markdown exposure stops mattering. Only the publish step
> of the deploy workflow changes; everything else in this repo is identical.

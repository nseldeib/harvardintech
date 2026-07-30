# GitHub Pages Deploy Setup

The build agent will ask which setup applies to your project.

## Two tracks

`.github/workflows/deploy.yml` publishes two sites out of this one repo. Which
one a push builds is decided by the branch:

| Branch | Origin | Gate | Drafts | `/admin` | Sitemap |
| --- | --- | --- | --- | --- | --- |
| `main` | harvardintech.com | open, indexable | hidden | absent | published |
| `staging` | review.harvardintech.com | passphrase + `noindex` | **visible** | **served** | none |

There is no per-track code — the difference is three environment variables read
by `astro.config.mjs`, `src/lib/previewGate.ts`, and `src/lib/draftVisibility.ts`:

| Variable | Public track | Review track |
| --- | --- | --- |
| `DEPLOY_BASE_PATH` | `/harvardintech` (drop at domain cutover) | unset — base stays `/` |
| `PAGES_SITE` | `https://nseldeib.github.io` | `https://review.harvardintech.com` |
| `PREVIEW_GATE` | unset | `1` |
| `INCLUDE_DRAFTS` | unset | `1` |

The review track keeps `base` at `/` deliberately: `@codeyam/cms` hard-codes
root-absolute `/admin` links and cannot run under a subpath, which is also why
the review site needs its own origin rather than a `/preview/` folder on the
live one.

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

## Review-track setup (one-time, manual)

The public track works as-is. The review track needs five things that cannot be
done from inside this repo. Until they exist, pushes to `staging` fail at the
"Publish to review repo" step and **the public track is unaffected** — so this is
safe to leave undone for a while.

One GitHub repo hosts exactly one Pages site, so a second origin genuinely
requires a second repo. It holds only generated output; there is no source in it.

1. **Create the review repo** — `nseldeib/harvardintech-review`. Private is fine;
   note that a private repo's Pages site is still public unless you are on
   GitHub Enterprise Cloud, which is why the passphrase gate and `noindex` carry
   the privacy here.

2. **Generate a deploy key** and install both halves:
   ```bash
   ssh-keygen -t ed25519 -C 'harvardintech-review deploy' -f review_deploy_key -N ''
   ```
   - Public half (`review_deploy_key.pub`) → review repo → **Settings → Deploy
     keys → Add deploy key**, **Allow write access** checked.
   - Private half (`review_deploy_key`) → *this* repo → **Settings → Secrets and
     variables → Actions → New repository secret**, named **`REVIEW_DEPLOY_KEY`**.
   - Delete both local files afterwards.

   A deploy key rather than a personal access token: it is scoped to exactly one
   repo and carries no person's identity, so it survives staff changes.

3. **Create the `staging` branch** off `main` and push it. The first push builds
   the review site.
   ```bash
   git checkout -b staging main && git push -u origin staging
   ```

4. **Enable Pages on the review repo** — **Settings → Pages → Source: Deploy from
   a branch**, branch **`gh-pages`**, folder `/ (root)`. The branch appears after
   the first successful `staging` build, so do this step after step 3.

5. **Add the DNS record** at GoDaddy: `CNAME` — host `review`, value
   `nseldeib.github.io`. Then set **Custom domain** on the review repo's Pages
   settings to `review.harvardintech.com`. This touches nothing about the live
   site and nothing about `MX` records.

Then visit `https://review.harvardintech.com` — the passphrase overlay should
appear. The passphrase is `crimson2026` unless overridden by a
`PREVIEW_GATE_PASSPHRASE` env var in the workflow.

> **How private is this, really?** The passphrase is a **deterrent, not
> authentication** — it ships in the client bundle, and the admin pages embed
> draft markdown in fetchable HTML. It keeps the review site out of search
> results and away from casual visitors. If the review content is genuinely
> sensitive, host the review track on **Cloudflare Pages behind Cloudflare
> Access** instead (free for up to 50 users): per-person email one-time-PIN,
> individually revocable, and the raw-markdown exposure stops mattering. Only
> step 4 of the deploy workflow changes; everything else in this repo is
> identical.

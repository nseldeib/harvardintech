# GitHub Pages Deploy Setup

The build agent will ask which setup applies to your project.

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

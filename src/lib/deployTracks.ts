// The correspondence between a GitHub Pages project site and the Astro `base`
// it must be built with. Pure and framework-free so the rule is unit-testable
// and so `deployTracks.test.ts` can hold `.github/workflows/deploy.yml` to it —
// the same cross-file-contract shape as `data/collections.test.ts` (CMS registry
// vs content schema) and `components/landing/landing-images.test.ts` (asset
// paths vs the project base).
//
// Why this exists rather than two hand-matched strings in the workflow: a Pages
// project site is served from `<user>.github.io/<repo>/`, so its base must be
// `/<repo>`. Those two values live far apart in `deploy.yml` — an env var near
// the top of a job, a `git push` URL at the bottom — and nothing connects them.
// Rename the repo, or edit one without the other, and the deploy still succeeds:
// the site returns HTTP 200 while every stylesheet, script, and internal link
// 404s, because they are all prefixed with a base that no longer matches the
// URL. That is the exact failure `landing-images.test.ts` was written after, one
// level up.

/**
 * The Astro `base` a GitHub Pages **project site** must be built with.
 *
 * A project site lives at `<user>.github.io/<repo>/`, so the base is the repo
 * name with a leading slash and no trailing one — the shape
 * `DEPLOY_BASE_PATH` is read as in `astro.config.mjs`.
 *
 * Throws on an empty repo name rather than returning `'/'`: a bare `/` is the
 * base of a USER site or a custom domain, so silently returning it would turn a
 * missing repo name into a plausible-looking value that builds every asset URL
 * wrong. Callers pass a literal from config; there is no legitimate empty case.
 */
export function pagesBasePathFor(repo: string): string {
  const trimmed = repo.trim().replace(/^\/+|\/+$/g, '');
  if (trimmed.length === 0) {
    throw new Error('pagesBasePathFor: repo name is required (a project site is served at /<repo>)');
  }
  return `/${trimmed}`;
}

/**
 * The repository name from a git remote URL, or `undefined` when the string
 * holds none.
 *
 * Accepts the SSH form the deploy job uses (`git@github.com:owner/repo.git`) and
 * the HTTPS form, with or without the `.git` suffix. Takes the whole command
 * line rather than a bare URL so the contract test can hand it the workflow's
 * `run:` block directly instead of re-parsing YAML into pieces — the parsing
 * rule then lives here, next to its tests, rather than inside a test file.
 *
 * Returns `undefined` rather than throwing: "this step pushes nowhere" is a
 * real, checkable state (the `main` track publishes via an artifact upload and
 * has no remote at all), and the caller decides whether that is a problem.
 */
export function pushTargetRepo(pushCommand: string): string | undefined {
  const match = pushCommand.match(/github\.com[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\s|$)/);
  return match?.[2];
}

import type { APIRoute } from 'astro';

// Build-time deploy marker. Prerendered to `/deploy-status.json` in `dist/` (the
// site is `output: 'static'`) and served by GitHub Pages as a plain file. The
// admin polls it and treats a change in `commit` as proof the new content is
// genuinely live — including the CDN propagation an Actions "completed" status
// can precede. It is auth-free and works in both hosted-token and
// local-repository modes, which is why it, not the Actions API, is the source of
// truth for "live".
//
// `GITHUB_SHA` / `GITHUB_RUN_ID` are default env vars in the Actions runner
// during the `withastro/action` build, so no `deploy.yml` change is needed. A
// local `astro build`/dev leaves them unset and falls back to a `"local"`
// marker (the dashboard treats localhost as a no-poll preview anyway).
export const prerender = true;

export const GET: APIRoute = () => {
  const commit = process.env.GITHUB_SHA ?? 'local';
  const runId = process.env.GITHUB_RUN_ID ?? null;
  const builtAt = new Date().toISOString();

  return new Response(JSON.stringify({ commit, runId, builtAt }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

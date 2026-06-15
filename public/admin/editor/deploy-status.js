// In-editor deploy-status banner for Sveltia CMS. This is the actual "I just
// saved — is it live yet?" moment: on save it shows "Deploying…", then flips to
// "🎉 Your change is live" once the change is genuinely served, with a link to
// view it.
//
// public/ is copied verbatim by Astro (NOT bundled), so this file CANNOT import
// the canonical helpers in src/lib/deployStatus.ts. It carries a MINIMAL MIRROR
// of just the calls it needs; src/lib/deployStatus.ts remains the canonical,
// vitest-tested spec, and src/components/admin/DeployStatus.astro is the
// captured scenario surface. Keep the two in sync.
//
// Detection is HYBRID and degrades gracefully:
//   - The build marker (/deploy-status.json, commit SHA baked in at build) is
//     the source of truth for "live" — a continuous watcher polls it and flips
//     the banner when the SHA changes from the baseline captured at save. This
//     is armed independently of the CMS event hook, so the "now live" toast
//     fires even if a future Sveltia renames the event.
//   - GitHub Actions enrichment ("Building…", "Deploy failed") is best-effort:
//     any missing token / 401 / 403 / 404 / network error silently falls back
//     to marker-only.
(() => {
  const MARKER_POLL_MS = 5000;
  const SLOW_AFTER_MS = 3 * 60 * 1000;
  const DEPLOY_WORKFLOW_PATH = '.github/workflows/deploy.yml';

  // --- mirror of src/lib/deployStatus.ts (keep in sync) --------------------
  function deployBaseFromPath(pathname) {
    const match = pathname.match(/^(.*?)\/admin(?:\/|$)/);
    return match ? match[1] : '';
  }
  function markerUrl(base) {
    return `${base}/deploy-status.json`;
  }
  function viewSiteUrl(base) {
    return `${base}/`;
  }
  function parseBackendRepo(yaml) {
    const repo = yaml.match(/^\s*repo:\s*([^\s#]+)/m);
    if (!repo) return null;
    const branch = yaml.match(/^\s*branch:\s*([^\s#]+)/m);
    return { repo: repo[1], branch: branch ? branch[1] : 'main' };
  }
  function pickLatestDeployRun(runs, workflowPath) {
    const matching = runs.filter((r) => r.path === workflowPath);
    if (!matching.length) return null;
    const ms = (r) => {
      const v = new Date(r.run_started_at || r.created_at || 0).valueOf();
      return Number.isNaN(v) ? 0 : v;
    };
    return matching.slice().sort((a, b) => ms(b) - ms(a))[0];
  }
  function mapRunPhase(run) {
    if (!run || !run.status) return 'unknown';
    if (run.status !== 'completed') return 'building';
    if (run.conclusion === 'success') return 'succeeded';
    if (run.conclusion === 'failure' || run.conclusion === 'timed_out') return 'failed';
    return 'unknown';
  }
  // Returns { state, title, detail, link } mirroring computeBanner's precedence.
  function computeBanner({ baselineCommit, marker, runPhase, savedAtMs, nowMs, viewHref, runUrl }) {
    const viewLink = { href: viewHref, label: 'View live site' };
    if (marker && baselineCommit && marker.commit !== baselineCommit) {
      return {
        state: 'live',
        title: '🎉 Your change is live',
        detail: 'The site has finished publishing and is serving your edit.',
        link: viewLink,
      };
    }
    if (runPhase === 'failed') {
      return {
        state: 'failed',
        title: 'Deploy failed',
        detail: 'The publish run did not complete. Your change is saved but not yet live.',
        link: runUrl ? { href: runUrl, label: 'View build logs' } : null,
      };
    }
    const active = savedAtMs != null;
    if (active) {
      if (nowMs - savedAtMs > SLOW_AFTER_MS) {
        return {
          state: 'slow',
          title: 'Still deploying…',
          detail: 'This is taking longer than usual. Large changes can take a few extra minutes.',
          link: null,
        };
      }
      if (runPhase === 'building') {
        return {
          state: 'building',
          title: 'Building your change…',
          detail: 'GitHub is building the site. It will be live shortly.',
          link: null,
        };
      }
      return {
        state: 'deploying',
        title: 'Deploying…',
        detail: 'Publishing your change — this usually takes about a minute.',
        link: null,
      };
    }
    return null;
  }
  // ------------------------------------------------------------------------

  const TONE = {
    deploying: '#0ca5a5',
    building: '#0ca5a5',
    slow: '#0ca5a5',
    live: '#2e7d32',
    failed: '#c62828',
  };

  const base = deployBaseFromPath(location.pathname);
  const viewHref = viewSiteUrl(base);

  let savedAtMs = null;
  let baselineCommit = null;
  let runPhase = 'unknown';
  let runUrl = null;
  let lastMarker = null;
  let bannerEl = null;
  let dismissed = false;

  function ensureStyles() {
    if (document.getElementById('deploy-status-styles')) return;
    const style = document.createElement('style');
    style.id = 'deploy-status-styles';
    style.textContent = `
      #cms-deploy-status {
        position: fixed; right: 16px; bottom: 16px; z-index: 99999;
        max-width: 360px; display: flex; gap: 12px; align-items: flex-start;
        padding: 12px 14px; border-radius: 8px; border-left: 4px solid #0ca5a5;
        background: #fff; box-shadow: 0 6px 24px rgba(0,0,0,0.18);
        font-family: 'Roboto', Helvetica, Arial, sans-serif; color: #2e2e2f;
      }
      #cms-deploy-status .cds-icon { flex-shrink: 0; margin-top: 2px; }
      #cms-deploy-status .cds-spinner {
        display: inline-block; width: 16px; height: 16px; border: 2px solid #e3e7ea;
        border-top-color: currentColor; border-radius: 50%; animation: cds-spin .8s linear infinite;
      }
      #cms-deploy-status .cds-glyph { display:inline-block; width:12px; height:12px; border-radius:50%; }
      #cms-deploy-status strong { display: block; font-size: .92rem; }
      #cms-deploy-status .cds-detail { display:block; font-size:.82rem; color:#555; margin-top:2px; }
      #cms-deploy-status a { display:inline-block; margin-top:6px; font-size:.82rem; font-weight:600; color:#3377cc; text-decoration:none; }
      #cms-deploy-status a:hover { text-decoration: underline; }
      #cms-deploy-status .cds-close {
        position:absolute; top:4px; right:8px; cursor:pointer; border:none; background:none;
        font-size:16px; line-height:1; color:#999;
      }
      @keyframes cds-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { #cms-deploy-status .cds-spinner { animation: none; } }
    `;
    document.head.appendChild(style);
  }

  function render(view) {
    if (dismissed) return;
    if (!view) {
      if (bannerEl) {
        bannerEl.remove();
        bannerEl = null;
      }
      return;
    }
    ensureStyles();
    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'cms-deploy-status';
      bannerEl.setAttribute('role', 'status');
      bannerEl.setAttribute('aria-live', 'polite');
      // Own node appended to <body>, OUTSIDE Sveltia's app root, so its
      // re-renders never clobber the banner.
      document.body.appendChild(bannerEl);
    }
    const tone = TONE[view.state] || '#0ca5a5';
    const spinner = view.state === 'deploying' || view.state === 'building' || view.state === 'slow';
    bannerEl.style.borderLeftColor = tone;
    bannerEl.style.color = tone;
    const icon = spinner
      ? '<span class="cds-spinner"></span>'
      : `<span class="cds-glyph" style="background:${tone}"></span>`;
    const link = view.link
      ? `<a href="${view.link.href}" target="_blank" rel="noopener">${view.link.label} →</a>`
      : '';
    bannerEl.innerHTML =
      `<button class="cds-close" aria-label="Dismiss">×</button>` +
      `<span class="cds-icon">${icon}</span>` +
      `<span style="color:#2e2e2f"><strong>${view.title}</strong>` +
      `<span class="cds-detail">${view.detail}</span>${link}</span>`;
    bannerEl.querySelector('.cds-close').addEventListener('click', () => {
      dismissed = true;
      bannerEl.remove();
      bannerEl = null;
    });
  }

  async function fetchMarker() {
    try {
      const res = await fetch(`${markerUrl(base)}?_=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  // Best-effort GitHub token Sveltia persisted. Storage key is version-specific,
  // so scan defensively; absence ⇒ no enrichment. Never logged.
  function readToken() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !/sveltia|decap|netlify-cms/i.test(key) || !/auth|user|token/i.test(key)) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const token = raw.startsWith('{') ? JSON.parse(raw).token : raw;
        if (typeof token === 'string' && token.length > 10) return token;
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  async function refreshRunPhase() {
    try {
      const token = readToken();
      if (!token) return;
      const cfgRes = await fetch('./config.yml', { cache: 'no-store' });
      if (!cfgRes.ok) return;
      const backend = parseBackendRepo(await cfgRes.text());
      if (!backend) return;
      const api = `https://api.github.com/repos/${backend.repo}/actions/runs?branch=${backend.branch}&per_page=10`;
      const res = await fetch(api, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) return;
      const body = await res.json();
      const run = pickLatestDeployRun(body.workflow_runs || [], DEPLOY_WORKFLOW_PATH);
      runPhase = mapRunPhase(run);
      runUrl = run ? run.html_url : null;
    } catch {
      /* degrade to marker-only */
    }
  }

  function update() {
    const view = computeBanner({
      baselineCommit,
      marker: lastMarker,
      runPhase,
      savedAtMs,
      nowMs: Date.now(),
      viewHref,
      runUrl,
    });
    render(view);
  }

  // Continuous marker watcher — armed independently of the CMS event hook so the
  // "now live" flip is GUARANTEED even if the save event never fires.
  async function watch() {
    if (document.hidden) return;
    lastMarker = await fetchMarker();
    if (lastMarker && baselineCommit === null && savedAtMs != null) {
      // First marker after a save with no pre-captured baseline.
      baselineCommit = lastMarker.commit;
    }
    if (savedAtMs != null) await refreshRunPhase();
    update();
  }

  function onSave() {
    savedAtMs = Date.now();
    dismissed = false;
    runPhase = 'unknown';
    runUrl = null;
    // Capture the CURRENT live commit as the baseline; the watcher flips to
    // "live" once the marker reports a different SHA.
    fetchMarker().then((m) => {
      baselineCommit = m ? m.commit : null;
      lastMarker = m;
      update();
    });
    update();
  }

  // Register the Decap-compatible save events (best-effort; a missing/renamed
  // API is a no-op). These give the INSTANT "Deploying" banner; the watcher is
  // the guarantee.
  function registerEvents() {
    try {
      const CMS = window.CMS;
      if (CMS && typeof CMS.registerEventListener === 'function') {
        CMS.registerEventListener({ name: 'postSave', handler: onSave });
        CMS.registerEventListener({ name: 'postPublish', handler: onSave });
      }
    } catch {
      /* no-op */
    }
  }

  // window.CMS may not exist the instant this module runs; retry briefly.
  let tries = 0;
  const reg = setInterval(() => {
    tries += 1;
    if (window.CMS && typeof window.CMS.registerEventListener === 'function') {
      registerEvents();
      clearInterval(reg);
    } else if (tries > 40) {
      clearInterval(reg);
    }
  }, 250);

  setInterval(watch, MARKER_POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) watch();
  });
})();

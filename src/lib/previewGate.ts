// Pre-launch preview gate config. TEMPORARY: locks the deployed WIP site behind a
// passphrase + noindex so it can be shared privately before the real public
// launch. See PreviewGate.astro.
//
// Keyed off DEPLOY_BASE_PATH — the env var the GitHub Pages deploy already sets
// for the *project-site* deploy (`/harvardintech`). This means:
//   - `astro dev` (codeyam preview + every scenario capture): unset → gate OFF,
//     so screenshots are never overlaid by the passphrase prompt.
//   - Project-site deploy (the current WIP preview): set → gate ON.
//   - Real launch on a custom domain: DEPLOY_BASE_PATH is dropped (see
//     astro.config.mjs), so the gate turns OFF automatically — no code change.
// We deliberately do NOT read a dedicated workflow env here, so no change to
// .github/workflows is required to enable it.
//
// Server-only module — read from `.astro` frontmatter, never a client island.

/** True on the gated project-site (preview) deploy; false in dev and at launch. */
export const PREVIEW_GATE_ENABLED = Boolean(process.env.DEPLOY_BASE_PATH);

/**
 * Shared passphrase for the preview gate. A DETERRENT, not real security — it
 * ships in the client bundle. Override per-deploy via PREVIEW_GATE_PASSPHRASE.
 */
export const PREVIEW_GATE_PASSPHRASE =
  process.env.PREVIEW_GATE_PASSPHRASE || 'crimson2026';

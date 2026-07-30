// The on/off rule for build-time deploy flags. One place, because two config
// modules need the identical decision: `previewGate.ts` reads `PREVIEW_GATE` and
// `draftVisibility.ts` reads `INCLUDE_DRAFTS`, and both are set per track by
// .github/workflows/deploy.yml.
//
// Pure and parameterised rather than reading `process.env` itself, so the rule
// is testable without faking the environment — the same shape `drafts.ts` uses
// for `includeDrafts`.

/**
 * True only for the exact string `'1'`. Every other value — unset, empty,
 * `'0'`, `'false'`, and notably `'true'` — is false.
 *
 * Strict on purpose: these flags decide whether drafts reach the PUBLIC site
 * and whether the review site is gated, so a typo in a workflow env block must
 * fail closed (public and gated-off) rather than guess at intent. Accepting
 * `'true'` would make `PREVIEW_GATE: 'ture'` silently publish an ungated site,
 * which is exactly the failure worth designing against.
 */
export function envFlagEnabled(value?: string): boolean {
  return value === '1';
}

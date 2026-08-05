/* The rule behind the review artifacts' passphrase gate: does this typed input
 * open the page?
 *
 * Written in plain JavaScript with a UMD wrapper for the same reason
 * `donorNetwork.js` is — two consumers that cannot share an ES module.
 * `.codeyam/design/donor-network/build.py` inlines this file verbatim into a
 * self-contained page (a review artifact has to work from a `file://` open and
 * under an artifact CSP that blocks every external host, so nothing can be
 * fetched at runtime), while vitest imports it as CommonJS.
 *
 * It lives under `src/` because vitest's `include` is `src/**` — a module parked
 * beside the exploration in `.codeyam/` is a module no test can reach.
 *
 * This is NOT `previewGate.ts`. That module is server-only: it reads
 * `process.env.PREVIEW_GATE` in `.astro` frontmatter to decide whether the whole
 * site build is gated, and it un-gates on the public track by design. This one
 * runs in the browser and decides a single comparison for an artifact whose gate
 * is always on. `previewGate.ts` remains the source of the passphrase VALUE —
 * `build.py` parses its default and substitutes it in.
 */
(function (root, factory) {
  var api = factory();
  root.HIT_GATE = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Whether `typed` should unlock a page gated by `expected`.
   *
   * Surrounding whitespace on the typed value is forgiven: the passphrase is
   * shared out of band and arrives pasted out of an email or a chat message,
   * which carries a trailing space more often than not. Refusing that would
   * read to the reviewer as a wrong passphrase.
   *
   * The comparison stays case-sensitive. A passphrase that ignores case is a
   * materially weaker passphrase, and nothing about pasting a shared string
   * makes case a likely transcription error.
   *
   * An empty `expected` NEVER opens the gate. This is the case worth having a
   * function for: `''.trim() === ''` is true, so the bare comparison this
   * replaces would have let anyone who simply clicked the button straight in,
   * had the build ever substituted an empty passphrase. `build.py` also refuses
   * to emit one — this is the second half of that guard, at the point where the
   * decision is actually made, because the page can outlive the build that
   * produced it.
   */
  function passphraseAccepted(typed, expected) {
    if (typeof expected !== 'string' || expected.trim() === '') return false;
    if (typeof typed !== 'string') return false;
    return typed.trim() === expected;
  }

  return { passphraseAccepted: passphraseAccepted };
});

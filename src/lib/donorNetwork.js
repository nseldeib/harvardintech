/* Pure rules behind the donor-network design explorations.
 *
 * Written once, in plain JavaScript, and used from two places that cannot
 * share an ES module: `.codeyam/design/donor-network/build.py` inlines this
 * file verbatim into a self-contained page (a published artifact runs under a
 * CSP that blocks every external host, so nothing can be fetched at runtime),
 * while vitest imports it as CommonJS. A UMD wrapper is what lets one file
 * serve both — the alternative is two copies of the anonymity rule, and two
 * copies of a privacy rule is one copy that will eventually disagree.
 *
 * It lives under `src/` because vitest's `include` is `src/**` — a module
 * parked beside the exploration in `.codeyam/` is a module no test can reach.
 */
(function (root, factory) {
  var api = factory();
  root.HIT_RULES = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var ANONYMOUS_LABEL = 'Anonymous supporter';

  var SCHOOL_SHORT = {
    'Harvard College': 'College',
    'Harvard Business School': 'HBS',
    'Harvard SEAS': 'SEAS',
    'Harvard Kennedy School': 'HKS',
    'Harvard Law School': 'HLS',
    'Harvard Medical School': 'HMS',
    'Harvard GSD': 'GSD',
    'Harvard GSE': 'GSE',
    'Harvard GSAS': 'GSAS',
    'Harvard Chan School': 'Chan',
    'Harvard Extension School': 'Extension'
  };

  /**
   * Whether a supporter can be found by typing their name.
   *
   * The live site withholds an anonymous donor's name, photo, link and even
   * their initials together (`src/lib/donors.ts`). A search box is a new way to
   * undo all of that at once, so anonymity has to reach it: an anonymous
   * supporter is still a visible node and still counts toward every total and
   * every milestone — withholding the node would make the wall quietly
   * undercount people who asked only not to be named — but they cannot be
   * looked up, and they get no shareable card.
   */
  function isSearchable(donor) {
    return !donor.anonymous;
  }

  /** The name to print, or the standing label when the donor asked not to be named. */
  function displayName(donor) {
    return donor.anonymous ? ANONYMOUS_LABEL : donor.name;
  }

  /**
   * The avatar mark: initials, or a neutral dash when anonymous.
   *
   * Initials leak the withheld name — two letters beside "Anonymous supporter"
   * identifies them to anyone who knows them — so the anonymous case gets a
   * mark that identifies nobody.
   */
  function supporterMonogram(donor) {
    if (donor.anonymous) return '—';
    return String(donor.name).split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  /** Short label for a Harvard school, or the name unchanged if unrecognized. */
  function shortSchool(name) {
    return SCHOOL_SHORT[name] || name;
  }

  /**
   * The milestone the count passed between two frames of the growth animation,
   * or null.
   *
   * Crossing, not landing. The growth step accelerates as the count climbs, so
   * asking whether the new count EQUALS a milestone means 50, 100 and 150 fire
   * only when the arithmetic happens to hit them exactly — in practice never.
   * Only 200 appeared to work, and only because it is clamped.
   */
  function milestoneCrossed(prev, next, milestones) {
    for (var i = 0; i < milestones.length; i++) {
      if (prev < milestones[i] && milestones[i] <= next) return milestones[i];
    }
    return null;
  }

  /**
   * `n` items spread evenly across `items`.
   *
   * Used to place supporters through sampled letterforms. Taking the first `n`
   * instead would fill the top of the first glyph and leave the rest of the
   * word empty, because the sampler emits points in scan order.
   */
  function thin(items, n) {
    if (n <= 0) return [];
    if (items.length <= n) return items.slice();
    var out = [], stride = items.length / n;
    for (var i = 0; i < n; i++) out.push(items[Math.floor(i * stride)]);
    return out;
  }

  /**
   * Seeded PRNG (mulberry32).
   *
   * Layouts must be reproducible: a network that reshuffles between renders
   * reads as a different design, so a reviewer would be rating noise — and a
   * screenshot they already commented on would stop matching the page.
   */
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  return {
    ANONYMOUS_LABEL: ANONYMOUS_LABEL,
    isSearchable: isSearchable,
    displayName: displayName,
    supporterMonogram: supporterMonogram,
    shortSchool: shortSchool,
    milestoneCrossed: milestoneCrossed,
    thin: thin,
    rng: rng
  };
});

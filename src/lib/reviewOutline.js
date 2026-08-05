/* The supporter-recognition review page's id vocabulary, and the doc outline
 * built from it.
 *
 * Plain JavaScript with a UMD wrapper for the same reason `donorNetwork.js`,
 * `reviewGate.js` and `donorImport.js` are: `.codeyam/design/donor-network/
 * build.py` inlines this file verbatim into a self-contained page (a review
 * artifact has to work from a `file://` open and under a CSP that blocks every
 * host), while vitest imports it as CommonJS. It lives under `src/` because
 * vitest's `include` is `src/**`.
 *
 * WHY THE OUTLINE IS CODE AND NOT A STRING IN THE PAGE.
 *
 * The page deliberately collects nothing — a published artifact cannot post
 * anywhere, and a review that needs a backend stops working the moment the link
 * outlives the server. Feedback comes back in a doc instead. That makes the
 * outline the actual interface between the page and the reviewer's notes, and
 * gives it one hard requirement: it must name every id the page shows.
 *
 * An outline hand-written beside the page fails that requirement silently. Add a
 * sixth wall behaviour, rename a direction, and the outline keeps the old list —
 * so the reviewer types under headings that no longer match what they are
 * looking at, and the mismatch surfaces as confusing feedback rather than as a
 * broken build. Generating it from the same direction list the page renders, and
 * testing that every family is covered, is what makes that drift impossible.
 */
(function (root, factory) {
  var api = factory();
  root.HIT_OUTLINE = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* The wall behaviours, in the order the page presents them. Here rather than
   * in the page markup because the outline and the page must show the same set;
   * two hand-maintained lists is one list that will disagree. */
  var WALL_ITEMS = [
    { id: 'W1', label: 'Giving levels are the structure' },
    { id: 'W2', label: 'Founding Donor as a badge across levels' },
    { id: 'W3', label: 'Anonymity withholds name, photo, link, initials' },
    { id: 'W4', label: 'Filter chips and the note reveal' },
    { id: 'W5', label: 'The empty state as designed' }
  ];

  var IMPORT_ITEMS = [
    { id: 'I2', label: 'Duplicate and anonymity handling — right call?' },
    { id: 'I3', label: 'The fields the file cannot answer — see the questions below' },
    { id: 'I4', label: 'A one-band wall with no badges — acceptable to start, or blocking?' }
  ];

  var QUESTION_ITEMS = [
    { id: 'Q1', label: 'What is it called?' },
    { id: 'Q2', label: 'Is $500 the founding threshold, and how does it reach us?' },
    { id: 'Q3', label: 'Anonymous supporter: counted, but not searchable and no card — correct?' },
    { id: 'Q4', label: 'Are school and graduation year public?' }
  ];

  /**
   * A direction's id as the page and the outline both write it: zero-padded.
   *
   * It exists because the two disagreed. `variations.js` carries `num` as a
   * NUMBER, so the card badge and the full-screen bar rendered `3` while the
   * contents list, the open questions, the README and the outline all said `03`.
   * The entire purpose of the id scheme is that a reviewer writing "3" in a doc
   * is unambiguous, so a card labelled differently from the thing they type
   * reintroduces exactly the fuzziness the renumbering removed.
   *
   * Padding is to two digits, which is enough for the nine that exist and the
   * handful a future round might add. A number wider than that is returned
   * unpadded rather than truncated — a wrong id is worse than an unpadded one.
   */
  function directionLabel(num) {
    var n = typeof num === 'number' ? num : parseInt(num, 10);
    if (!isFinite(n)) return '';
    return n < 10 && n >= 0 ? '0' + n : String(n);
  }

  /**
   * The outline a reviewer pastes into a doc.
   *
   * `directions` is the live list the page renders (`window.HIT_VARIATIONS`),
   * not a copy — that is the whole reason this takes an argument. Each entry
   * needs `num` and `name`; `family` marks the two off-brief controls, which are
   * labelled as such so a reviewer knows they are the deliberate counter-examples
   * rather than two more candidates.
   *
   * Returns a plain string with `\n` newlines. No trailing whitespace on any
   * line, because the reviewer pastes this into a document and trailing spaces
   * survive the paste as invisible junk.
   */
  function reviewOutline(directions) {
    var lines = [
      'Harvard in Tech — supporter recognition review',
      'Reviewer:                     Date:',
      '',
      'THE BIG ONE — which direction, and what is it called?',
      '  Pick:                       01-09, or "none of these"',
      '  Name:                       each direction carries a different candidate',
      '  Why:',
      '',
      'THE WALL AS IT STANDS — keep, change, or drop?'
    ];

    WALL_ITEMS.forEach(function (item) {
      lines.push('  ' + item.id + '  ' + item.label + ':');
    });

    lines.push('');
    lines.push('THE DIRECTIONS — anything you want to say about any of them');
    (directions || []).forEach(function (d) {
      var suffix = d.family === 'off-brief' ? ' [off-brief control]' : '';
      lines.push('  ' + directionLabel(d.num) + '  ' + d.name + suffix + ':');
    });

    lines.push('');
    lines.push('THE IMPORT');
    IMPORT_ITEMS.forEach(function (item) {
      lines.push('  ' + item.id + '  ' + item.label);
    });

    lines.push('');
    lines.push('DECISIONS WE NEED');
    QUESTION_ITEMS.forEach(function (item) {
      lines.push('  ' + item.id + '  ' + item.label);
    });

    lines.push('');
    lines.push('ANYTHING ELSE');

    return lines.join('\n');
  }

  return {
    WALL_ITEMS: WALL_ITEMS,
    IMPORT_ITEMS: IMPORT_ITEMS,
    QUESTION_ITEMS: QUESTION_ITEMS,
    directionLabel: directionLabel,
    reviewOutline: reviewOutline
  };
});

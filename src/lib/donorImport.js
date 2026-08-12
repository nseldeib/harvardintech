/* Pure rules behind the supporter-import walkthrough.
 *
 * Same shape and the same reasons as `donorNetwork.js` and `reviewGate.js`:
 * plain JavaScript with a UMD wrapper, because two consumers need it and they
 * cannot share an ES module. `.codeyam/design/donor-network/build.py` inlines
 * this file verbatim into a self-contained review page (a published artifact
 * runs under a CSP that blocks every external host, and a `file://` open blocks
 * even a same-directory fetch, so nothing can be fetched at runtime), while
 * vitest imports it as CommonJS. It lives under `src/` because vitest's
 * `include` is `src/**` — a module parked beside the exploration in `.codeyam/`
 * is a module no test can reach.
 *
 * WHAT THIS IS FOR. The bi-weekly spreadsheet the team receives carries four
 * columns — name, school, class year, email. The donors collection
 * (`src/content/config.ts`) wants `name`, `tier`, `founding`, `anonymous`,
 * `note`, `url`, `photo`, `order`, `draft`. Those two shapes overlap on exactly
 * one field. Everything here exists to make that gap legible instead of letting
 * an importer paper over it:
 *
 *   - `tier` has no input at all — the file carries no dollar amounts.
 *   - `founding` needs its own column, or a rule about WHEN someone gave.
 *   - `anonymous` needs its own column; when it is missing the request turns up
 *     inside the name field instead, which is the worst possible place for it.
 *   - `school` and `gradYear` are the only structure the file offers, and are
 *     not fields on the collection at all — yet three of the nine design
 *     directions are built on them.
 *
 * The rule this module is really enforcing is that an import may not GUESS at
 * any of those. Every one of them is returned as an unresolved decision for a
 * human, because each wrong guess is a specific harm: a misstated giving level,
 * a badge someone did not earn, or a name published against an explicit request
 * to withhold it. The last is the one that cannot be undone by a later edit.
 */
(function (root, factory) {
  var api = factory();
  root.HIT_IMPORT = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Spreadsheet spellings that mean a school the site already has a short form
   * for. Written out because a person filling a form types the full name, while
   * `donorNetwork.js`'s SCHOOL_SHORT is keyed on the site's own spelling — so
   * without this map an ordinary, correct answer arrives as an unknown value. */
  var SCHOOL_ALIASES = {
    'harvard graduate school of design': 'Harvard GSD',
    'graduate school of design': 'Harvard GSD',
    'gsd': 'Harvard GSD',
    'harvard graduate school of education': 'Harvard GSE',
    'graduate school of education': 'Harvard GSE',
    'gse': 'Harvard GSE',
    'harvard graduate school of arts and sciences': 'Harvard GSAS',
    'graduate school of arts and sciences': 'Harvard GSAS',
    'gsas': 'Harvard GSAS',
    'harvard john a. paulson school of engineering and applied sciences': 'Harvard SEAS',
    'school of engineering and applied sciences': 'Harvard SEAS',
    'seas': 'Harvard SEAS',
    'harvard business school': 'Harvard Business School',
    'hbs': 'Harvard Business School',
    'harvard college': 'Harvard College',
    'college': 'Harvard College',
    'harvard kennedy school': 'Harvard Kennedy School',
    'kennedy school': 'Harvard Kennedy School',
    'hks': 'Harvard Kennedy School',
    'harvard law school': 'Harvard Law School',
    'hls': 'Harvard Law School',
    'harvard medical school': 'Harvard Medical School',
    'hms': 'Harvard Medical School',
    'harvard t.h. chan school of public health': 'Harvard Chan School',
    'harvard chan school': 'Harvard Chan School',
    'chan': 'Harvard Chan School',
    'harvard extension school': 'Harvard Extension School',
    'extension': 'Harvard Extension School'
  };

  /* Names that are not names — a supporter using the name column to ask not to
   * be named, because the file has no anonymity column for them to use. Import
   * this literally and the wall carries a card reading "Anonymous" as though
   * that were somebody. */
  var ANONYMITY_MARKERS = [
    'anonymous', 'anon', 'anonymous donor', 'anonymous supporter',
    'private', 'withheld', 'no name', 'prefer not to say', 'n/a'
  ];

  /* The fields the collection wants that this file structurally cannot answer,
   * with the reason each one is unanswerable. Data, not prose, so the review
   * page and the tests read the same list and it cannot drift between them. */
  var UNRESOLVABLE_FIELDS = [
    {
      field: 'tier',
      why: 'The wall groups everyone by giving level, and the upload carries no dollar amounts — so there is no input to derive a level from.',
      needs: 'An amount column, or a decision that the wall stops being organised by level.'
    },
    {
      field: 'founding',
      why: 'Founding Donor is a badge that cuts across every level. Nothing in the file says who has one.',
      needs: 'Its own column, or a rule about WHEN a gift counts as founding — plus a confirmed threshold.'
    },
    {
      field: 'anonymous',
      why: 'Publishing a name someone asked to withhold is the one failure of a supporter wall that an edit cannot undo. The file has no column for the request.',
      needs: 'Its own column. Until there is one, every row is a guess.'
    }
  ];

  /* Fields the file DOES carry that the collection has nowhere to put. The
   * inverse gap, and the one that is easy to miss because the data is present
   * and looks usable. */
  var UNMODELLED_FIELDS = [
    {
      field: 'school',
      why: 'The only structure the file offers, and directions 01, 03 and 09 group by it — but it is not a field on the donors collection.',
      needs: 'A schema addition, and a decision that it is public information.'
    },
    {
      field: 'gradYear',
      why: 'The other axis those three directions are built on. Also absent from the collection.',
      needs: 'A schema addition, and the same public/not-public decision.'
    }
  ];

  /* The spreadsheet's column headings, mapped onto the field names every rule
   * below expects. Data rather than an inline object literal in the page script
   * so that a heading change is a one-line edit here, next to the tests that
   * would catch it, instead of a silent breakage in a file nothing runs. */
  var COLUMN_MAP = {
    Name: 'name',
    School: 'school',
    'Class Year': 'gradYear',
    Email: 'email'
  };

  /**
   * One spreadsheet row, keyed by the field names the rules use.
   *
   * This is the seam worth having a function for. The file arrives with human
   * column headings and every rule below reads `row.gradYear`, so if the team
   * ever renames "Class Year" to "Grad Year" the mapping quietly yields
   * `undefined` — `normalizeGradYear` then returns null for every row, and the
   * import reports "no usable class year" for all fourteen while looking like it
   * worked. A test over this mapping turns that into a failure instead of a
   * plausible-looking result.
   *
   * Unknown columns are dropped rather than passed through: the collection has
   * nowhere to put them, and carrying them would suggest otherwise.
   */
  function mapUploadRow(row) {
    var out = {};
    if (!row || typeof row !== 'object') return out;
    for (var heading in COLUMN_MAP) {
      if (Object.prototype.hasOwnProperty.call(row, heading)) {
        out[COLUMN_MAP[heading]] = row[heading];
      }
    }
    return out;
  }

  /** Every row of an upload, mapped. Tolerates a missing/!array `rows`. */
  function mapUploadRows(rows) {
    if (!rows || typeof rows.map !== 'function') return [];
    return rows.map(mapUploadRow);
  }

  /**
   * A name reduced to the form two spellings of one person share.
   *
   * Trims, collapses inner whitespace, strips diacritics, and lowercases. Each
   * of those is a real way one human arrives twice: a padded cell from a
   * spreadsheet export, "Tomas" for "Tomás", "ROBERT K. WHITMORE" from a form
   * that uppercases. A bare `===` misses all of them and produces a second card
   * for someone already on the wall.
   *
   * Punctuation is deliberately KEPT. "Gregory Tanaka-Lindqvist III" and
   * "Gregory Tanaka Lindqvist" may well be one person, but they may also be
   * father and son, and collapsing them silently merges two supporters into
   * one. That case is surfaced as a possible match for a human instead.
   */
  function normalizeName(value) {
    if (typeof value !== 'string') return '';
    var s = value.normalize ? value.normalize('NFD').replace(/[̀-ͯ]/g, '') : value;
    return s.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  /** Whether the name column is really an anonymity request. */
  function looksAnonymous(value) {
    var n = normalizeName(value).replace(/[.\s]+$/, '');
    return ANONYMITY_MARKERS.indexOf(n) !== -1;
  }

  /**
   * The site's spelling of a school, or null when the cell says nothing.
   *
   * Returns the input unchanged when it is not a spelling we know, rather than
   * dropping it: an unrecognized school is a mapping to confirm, not a value to
   * discard. Losing it silently would empty a supporter out of the three
   * directions that group by school without anyone noticing.
   */
  function normalizeSchool(value) {
    if (typeof value !== 'string' || value.trim() === '') return null;
    var key = value.trim().replace(/\s+/g, ' ').toLowerCase();
    return SCHOOL_ALIASES[key] || value.trim();
  }

  /**
   * A four-digit graduation year, or null.
   *
   * Accepts the apostrophe form a spreadsheet produces ('04, ’04, 04) because
   * it is how people actually write a class year. Two digits are read as
   * 1930-2029 — a Harvard alum's class year is not 2104, and it is not 1904
   * either for anyone the fund will hear from.
   *
   * Returns null rather than a guess for anything else. A wrong year is worse
   * than a missing one here: it places a supporter in the wrong cohort in three
   * of the nine directions, where the error looks exactly like data.
   */
  function normalizeGradYear(value) {
    if (typeof value === 'number' && isFinite(value)) {
      return value >= 1900 && value <= 2100 ? Math.floor(value) : null;
    }
    if (typeof value !== 'string') return null;
    var s = value.trim().replace(/^['’]/, '');
    if (/^\d{4}$/.test(s)) {
      var full = parseInt(s, 10);
      return full >= 1900 && full <= 2100 ? full : null;
    }
    if (/^\d{2}$/.test(s)) {
      var two = parseInt(s, 10);
      return two <= 29 ? 2000 + two : 1900 + two;
    }
    return null;
  }

  /**
   * How one spreadsheet row relates to the supporters already on the wall.
   *
   * Three outcomes, and the middle one is the point:
   *   `new`      — nobody on the wall normalizes to this name.
   *   `duplicate`— an exact match after normalization. Re-importing would put a
   *                second card on the wall for one person.
   *   `possible` — the names differ only by punctuation or a suffix. Might be
   *                the same person, might be a relative. Deciding automatically
   *                either duplicates someone or merges two people, so it does
   *                neither and asks.
   *
   * A `duplicate` whose existing record is anonymous is flagged
   * `existingAnonymous`, because re-importing them is the specific path by
   * which a withheld name gets published: the file has no anonymity column, so
   * a blind overwrite would replace "Anonymous supporter" with the real name
   * sitting right there in the upload.
   */
  function matchExisting(name, existing) {
    var target = normalizeName(name);
    if (target === '') return { status: 'new', match: null, existingAnonymous: false };

    var loose = target.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+(jr|sr|ii|iii|iv)$/, '').replace(/\s+/g, ' ').trim();
    var possible = null;

    for (var i = 0; i < existing.length; i++) {
      var candidate = normalizeName(existing[i].name);
      if (candidate === target) {
        return { status: 'duplicate', match: existing[i], existingAnonymous: !!existing[i].anonymous };
      }
      var candidateLoose = candidate.replace(/[^a-z0-9 ]/g, ' ').replace(/\s+(jr|sr|ii|iii|iv)$/, '').replace(/\s+/g, ' ').trim();
      if (candidateLoose === loose && possible === null) possible = existing[i];
    }

    if (possible) return { status: 'possible', match: possible, existingAnonymous: !!possible.anonymous };
    return { status: 'new', match: null, existingAnonymous: false };
  }

  /**
   * Everything wrong with, or undecidable about, one row.
   *
   * Each issue carries a `severity`: `blocking` means the row cannot become a
   * supporter at all without a human, `review` means it can but a decision was
   * deferred. Nothing here is auto-corrected — that is the whole contract.
   */
  function rowIssues(row, existing) {
    var issues = [];
    var rawName = row.name;

    if (typeof rawName !== 'string' || rawName.trim() === '') {
      issues.push({
        code: 'missing-name',
        severity: 'blocking',
        message: 'No name. It is the one field the wall genuinely requires.'
      });
    } else if (looksAnonymous(rawName)) {
      issues.push({
        code: 'anonymity-in-name',
        severity: 'blocking',
        message: 'The name column is being used to ask for anonymity, because the file has no column for it. Imported literally, the wall shows a card reading “' + rawName.trim() + '” as though that were someone’s name.'
      });
    }

    var match = matchExisting(rawName, existing || []);
    if (match.status === 'duplicate') {
      issues.push({
        code: 'duplicate',
        severity: 'review',
        message: 'Already on the wall as “' + match.match.name + '”. Importing again adds a second card for one person.'
      });
      if (match.existingAnonymous) {
        issues.push({
          code: 'would-unmask',
          severity: 'blocking',
          message: 'That existing supporter is anonymous. The upload carries their real name and no anonymity column, so a blind overwrite publishes the name they asked to withhold — the one mistake here an edit cannot undo.'
        });
      }
    } else if (match.status === 'possible') {
      issues.push({
        code: 'possible-duplicate',
        severity: 'review',
        message: 'Looks like “' + match.match.name + '” already on the wall, but the spellings differ. Same person, or a relative — not a call to make automatically.'
      });
    }

    if (normalizeSchool(row.school) === null) {
      issues.push({
        code: 'missing-school',
        severity: 'review',
        message: 'No school. Directions 01, 03 and 09 group by it, so this supporter has nowhere to sit in three of the nine designs.'
      });
    }
    if (normalizeGradYear(row.gradYear) === null) {
      issues.push({
        code: 'missing-grad-year',
        severity: 'review',
        message: 'No usable class year. Same three directions, the other axis.'
      });
    }

    return issues;
  }

  /** One row, normalized, with everything undecided about it attached. */
  function classifyRow(row, existing) {
    var issues = rowIssues(row, existing);
    var blocking = issues.filter(function (i) { return i.severity === 'blocking'; });
    return {
      raw: row,
      name: typeof row.name === 'string' ? row.name.trim().replace(/\s+/g, ' ') : '',
      school: normalizeSchool(row.school),
      gradYear: normalizeGradYear(row.gradYear),
      match: matchExisting(row.name, existing || []).status,
      issues: issues,
      /* Ready means "nothing about this row needs a human before it lands" —
       * NOT "complete". Tier, founding and anonymous are still unanswered for
       * every row in the file, which is why they are reported once for the
       * whole import rather than as an issue on each row. */
      ready: blocking.length === 0
    };
  }

  /**
   * The whole upload, classified.
   *
   * `unresolvable` and `unmodelled` are returned unconditionally, not only when
   * something goes wrong. They are properties of the FILE FORMAT, not of the
   * rows: a spreadsheet where every row is clean still cannot say who gave at
   * what level, who is a founding donor, or who asked to stay anonymous. An
   * import summary that hid them on a clean file would be reporting success for
   * a job it did a third of.
   */
  function summarizeImport(rows, existing) {
    var classified = (rows || []).map(function (r) { return classifyRow(r, existing || []); });
    return {
      rows: classified,
      total: classified.length,
      ready: classified.filter(function (r) { return r.ready; }).length,
      needsDecision: classified.filter(function (r) { return !r.ready; }).length,
      duplicates: classified.filter(function (r) { return r.match === 'duplicate'; }).length,
      possibleDuplicates: classified.filter(function (r) { return r.match === 'possible'; }).length,
      unresolvable: UNRESOLVABLE_FIELDS,
      unmodelled: UNMODELLED_FIELDS
    };
  }

  return {
    SCHOOL_ALIASES: SCHOOL_ALIASES,
    ANONYMITY_MARKERS: ANONYMITY_MARKERS,
    COLUMN_MAP: COLUMN_MAP,
    mapUploadRow: mapUploadRow,
    mapUploadRows: mapUploadRows,
    UNRESOLVABLE_FIELDS: UNRESOLVABLE_FIELDS,
    UNMODELLED_FIELDS: UNMODELLED_FIELDS,
    normalizeName: normalizeName,
    looksAnonymous: looksAnonymous,
    normalizeSchool: normalizeSchool,
    normalizeGradYear: normalizeGradYear,
    matchExisting: matchExisting,
    rowIssues: rowIssues,
    classifyRow: classifyRow,
    summarizeImport: summarizeImport
  };
});

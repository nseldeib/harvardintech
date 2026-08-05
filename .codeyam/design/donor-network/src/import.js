/* The import walkthrough (I1–I4) and the doc outline.
 *
 * A mockup, and honest about it: nothing here writes anywhere. It exists to put
 * the four undecidable fields in front of a reviewer as a step that stops, rather
 * than as a paragraph they skim.
 *
 * Every judgement it makes comes from `window.HIT_IMPORT` (src/lib/donorImport.js,
 * 25 tests) rather than from this file. That split is the point: the rules are the
 * thing that would survive into a real importer, so they are the thing that is
 * tested, and this file is only the presentation of them. If the two ever
 * disagree, the tested one is right.
 */
(function () {
  'use strict';

  var host = document.getElementById('importSteps');
  if (!host || !window.HIT_IMPORT || !window.HIT_UPLOAD) return;

  var IMPORT = window.HIT_IMPORT;
  var body = document.getElementById('importBody');
  var rail = host.querySelectorAll('.steprail');

  /* Who is "already on the wall" for the purposes of this walkthrough. The first
     twenty of the illustrative supporters — the same people the directions show,
     so a duplicate the walkthrough reports is a duplicate the reviewer can see
     for themselves a few sections up. Robert K. Whitmore is among them and is
     anonymous, which is what makes step I2 land. */
  var existing = (window.HIT_DATA && window.HIT_DATA.donors ? window.HIT_DATA.donors : []).slice(0, 20);

  /* The spreadsheet, mapped from its human column headings onto the names the
     rules read. The mapping itself lives in donorImport.js with the rules that
     consume it, so a renamed heading fails a test rather than quietly emptying
     a column here — the fixture stays looking like the file it stands in for. */
  var rows = IMPORT.mapUploadRows(window.HIT_UPLOAD.rows);

  var summary = IMPORT.summarizeImport(rows, existing);

  function el(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ── I1: the file ──────────────────────────────────────────────────────── */
  function stepFile(root) {
    el('p', 'step-lede', root).textContent =
      'This is what arrives every two weeks. Four columns, ' + rows.length +
      ' rows. Nothing has been read yet — this is the file as received.';

    var wrap = el('div', 'tablewrap', root);
    var table = el('table', 'sheet', wrap);
    var thead = el('thead', null, table);
    var hr = el('tr', null, thead);
    el('th', 'sheet-rownum', hr, '');
    (window.HIT_UPLOAD.columns || []).forEach(function (c) { el('th', null, hr, c); });

    var tbody = el('tbody', null, table);
    (window.HIT_UPLOAD.rows || []).forEach(function (r, i) {
      var tr = el('tr', null, tbody);
      el('td', 'sheet-rownum', tr, String(i + 1));
      (window.HIT_UPLOAD.columns || []).forEach(function (c) {
        var td = el('td', null, tr);
        var value = r[c];
        if (value === '' || value === undefined || value === null) {
          el('span', 'sheet-blank', td, '(blank)');
        } else {
          /* Rendered with the padding intact, because the padding is one of the
             things that makes a duplicate hard to see by eye. */
          td.textContent = value;
        }
      });
    });

    var note = el('div', 'callout callout--plain', root);
    el('div', 'callout-kick', note, 'Before anything is matched');
    el('p', null, note).textContent =
      'There is no amount column, no founding column, and no anonymity column. That is ' +
      'not an oversight in this sample — it is the shape of the file, and it decides ' +
      'everything that happens in I3.';
  }

  /* ── I2: what matched ──────────────────────────────────────────────────── */
  var MATCH_LABEL = { 'new': 'New', 'duplicate': 'Already on the wall', 'possible': 'Possibly a duplicate' };

  function stepMatch(root) {
    el('p', 'step-lede', root).textContent =
      'Each row checked against the ' + existing.length + ' supporters currently on the wall. ' +
      'Names are compared with padding, capitalisation and accents set aside — each of ' +
      'those is a real way one person arrives twice.';

    var stats = el('div', 'stats', root);
    [
      [summary.total, 'rows in the file'],
      [summary.ready, 'could land as-is'],
      [summary.needsDecision, 'need a person'],
      [summary.duplicates, 'already on the wall']
    ].forEach(function (pair) {
      var s = el('div', 'stat', stats);
      el('div', 'stat-n', s, String(pair[0]));
      el('div', 'stat-l', s, pair[1]);
    });

    var wrap = el('div', 'tablewrap', root);
    var table = el('table', 'sheet sheet--matched', wrap);
    var hr = el('tr', null, el('thead', null, table));
    ['Name as filed', 'School', 'Class', 'Status', 'What needs deciding'].forEach(function (c) {
      el('th', null, hr, c);
    });

    var tbody = el('tbody', null, table);
    summary.rows.forEach(function (row) {
      var tr = el('tr', null, tbody);
      tr.className = row.ready ? '' : 'row--blocked';

      var nameCell = el('td', null, tr);
      if (row.name === '') el('span', 'sheet-blank', nameCell, '(blank)');
      else nameCell.textContent = row.name;

      var schoolCell = el('td', null, tr);
      if (row.school === null) el('span', 'sheet-blank', schoolCell, '—');
      else schoolCell.textContent = row.school;

      var yearCell = el('td', null, tr);
      if (row.gradYear === null) el('span', 'sheet-blank', yearCell, '—');
      else yearCell.textContent = String(row.gradYear);

      var statusCell = el('td', null, tr);
      el('span', 'tag tag--' + row.match, statusCell, MATCH_LABEL[row.match]);

      var issueCell = el('td', 'issues', tr);
      if (row.issues.length === 0) {
        el('span', 'issue-none', issueCell, 'Nothing');
      } else {
        row.issues.forEach(function (issue) {
          var line = el('div', 'issue issue--' + issue.severity, issueCell);
          el('span', 'issue-dot', line);
          el('span', null, line, issue.message);
        });
      }
    });

    var note = el('div', 'callout callout--warn', root);
    el('div', 'callout-kick', note, 'The one that cannot be undone');
    el('p', null, note).textContent =
      'One row is someone who is anonymous on the wall today, filed under their real ' +
      'name — because the file has no anonymity column to carry the request. Imported ' +
      'without a person looking, it publishes the name they asked to withhold. Every ' +
      'other mistake on this page can be corrected by an edit; that one cannot.';
  }

  /* ── I3: what the file cannot say ──────────────────────────────────────── */
  function stepGaps(root) {
    el('p', 'step-lede', root).textContent =
      'This step does not depend on the rows. A file where every row was spotless would ' +
      'still stop here, because these are properties of the file\'s shape rather than of ' +
      'anybody in it.';

    var a = el('div', 'gapgroup', root);
    el('div', 'gapgroup-kick', a, 'The wall needs these. The file has no column for them.');
    summary.unresolvable.forEach(function (f) {
      var card = el('div', 'gap', a);
      el('div', 'gap-field', card, f.field);
      el('div', 'gap-why', card, f.why);
      var needs = el('div', 'gap-needs', card);
      el('span', 'gap-needs-kick', needs, 'Needs');
      el('span', null, needs, ' ' + f.needs);
    });

    var b = el('div', 'gapgroup', root);
    el('div', 'gapgroup-kick', b, 'The file has these. The site has nowhere to put them.');
    summary.unmodelled.forEach(function (f) {
      var card = el('div', 'gap gap--inverse', b);
      el('div', 'gap-field', card, f.field);
      el('div', 'gap-why', card, f.why);
      var needs = el('div', 'gap-needs', card);
      el('span', 'gap-needs-kick', needs, 'Needs');
      el('span', null, needs, ' ' + f.needs);
    });

    var note = el('div', 'callout callout--warn', root);
    el('div', 'callout-kick', note, 'Why this is the whole section');
    el('p', null, note).textContent =
      'Two of these are questions on this page already — the founding threshold is Q2, ' +
      'and whether school and class year are public is Q4. They are not blocked on ' +
      'engineering. They are blocked on an answer.';
  }

  /* ── I4: what would actually land ──────────────────────────────────────── */
  function stepLand(root) {
    el('p', 'step-lede', root).textContent =
      'Suppose we import anyway, answering nothing. Here is the wall you would get — ' +
      'and it is worth looking at before choosing between the nine directions, because ' +
      'several of them assume structure this import cannot supply.';

    var list = el('ol', 'lands', root);

    var landed = summary.ready;
    var items = [
      ['' + landed + ' of ' + summary.total + ' supporters land.',
        'The rest each hit something a person has to answer first — a blank name, an ' +
        'anonymity request sitting in the name column, or a re-import that would unmask ' +
        'someone.'],
      ['Every one of them arrives with a name and nothing else.',
        'No giving level, no Founding Donor badge, no anonymity flag, no note, no photo, ' +
        'no link. Those are the fields the file has no column for.'],
      ['So the wall collapses into one band.',
        'A supporter with no giving level falls into the trailing “Other supporters” ' +
        'group. With every supporter untagged there is exactly one group — so the level ' +
        'headings (W1) have nothing to show, and the filter chips (W4) do not appear at ' +
        'all, because they only render when there is more than one band to move between.'],
      ['And the badge disappears.',
        'Founding Donor (W2) is carried by a flag no column sets, so nobody has one — ' +
        'the recognition Nicole specifically asked for is the first thing this import ' +
        'silently drops.'],
      ['Three of the nine directions lose their axis.',
        'Directions 01, 03 and 09 group supporters by school and class year. The file ' +
        'carries both, but the site has no field for either — and two rows in this sample ' +
        'are missing one of them anyway.']
    ];
    items.forEach(function (pair) {
      var li = el('li', null, list);
      el('strong', null, li, pair[0]);
      el('div', 'lands-why', li, pair[1]);
    });

    var note = el('div', 'callout callout--plain', root);
    el('div', 'callout-kick', note, 'What this is not');
    el('p', null, note).textContent =
      'It is not an argument against importing. It is the list of things worth settling ' +
      'first, because each one is cheap to answer now and expensive to retrofit onto a ' +
      'wall that already has supporters on it.';
  }

  var STEPS = [stepFile, stepMatch, stepGaps, stepLand];

  function show(i) {
    body.innerHTML = '';
    var pane = el('div', 'step-pane', body);
    STEPS[i](pane);
    for (var r = 0; r < rail.length; r++) {
      var on = r === i;
      rail[r].classList.toggle('is-on', on);
      rail[r].setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  for (var i = 0; i < rail.length; i++) {
    (function (idx) {
      rail[idx].addEventListener('click', function () { show(idx); });
    })(i);
  }
  show(0);

  /* ── The doc outline ───────────────────────────────────────────────────── */
  var outlineEl = document.getElementById('outlineText');
  if (outlineEl && window.HIT_OUTLINE) {
    /* Built from the SAME list the deck renders its cards from, rather than a
       transcription of it. A hand-copied outline goes stale the first time a
       direction is renamed — and because the outline is what the reviewer types
       into, that staleness lands in their feedback rather than in a build. */
    var outline = window.HIT_OUTLINE.reviewOutline(window.HIT_VARIATIONS);
    outlineEl.textContent = outline;

    var copyBtn = document.getElementById('copyOutline');
    var status = document.getElementById('copyStatus');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        /* Select-then-execCommand rather than navigator.clipboard, deliberately.
           The async Clipboard API is gated by permissions policy, so in an
           iframe without an explicit grant it does not merely fail — it logs a
           policy violation, which is both noise and a capture failure. This path
           is subject to no such policy, works from a file:// open, and degrades
           into something useful rather than into nothing: if the copy is
           refused, the text is still selected and the reviewer presses ⌘C. */
        var range = document.createRange();
        range.selectNodeContents(outlineEl);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        var copied = false;
        try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
        status.textContent = copied
          ? 'Copied. Paste it into a doc.'
          : 'Selected — press ⌘C / Ctrl+C to copy.';
      });
    }
  }
})();

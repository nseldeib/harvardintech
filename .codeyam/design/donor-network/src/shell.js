/* The review deck: builds the cards, mounts a live miniature in each, opens the
   full-screen view, and collects Nicole's ratings.
 *
 * Feedback persists to localStorage and exports as one text file. That is
 * deliberately low-tech: a published page cannot post anywhere (the artifact CSP
 * blocks every external host), and a review that depends on a backend is a
 * review that stops working the moment the link outlives the server. */
(function () {
  'use strict';

  var VARS = window.HIT_VARIATIONS;
  var KEY = 'hitNetworkFeedback_v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function saveAll(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { }
  }
  var data = load();

  function el(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }

  /* ── Cards ────────────────────────────────────────────────────────────── */
  VARS.forEach(function (v) {
    var grid = document.querySelector('.grid[data-family="' + v.family + '"]');
    if (!grid) return;

    var card = el('div', 'card', grid);
    card.setAttribute('data-family', v.family);
    card.setAttribute('data-fb', v.id);
    card.setAttribute('data-name', v.num + ' · ' + v.name);

    var thumb = el('button', 'thumb', card);
    thumb.type = 'button';
    thumb.setAttribute('aria-label', 'Open direction ' + v.num + ': ' + v.name);
    var mount = el('div', 'thumb-mount', thumb);
    el('span', 'badge', thumb).textContent = v.num;
    el('span', 'expand', thumb).textContent = 'Expand ↗';
    el('span', 'thumb-veil', thumb);
    thumb.addEventListener('click', function () { open(v); });

    /* Miniatures render at 110 supporters — enough that the school clusters and
       the ripple rings have real structure to show, still light enough that
       eight of them share one screen without cost. */
    window.HIT.mount(mount, v, { mode: 'preview', count: 110 });

    var meta = el('div', 'meta', card);
    el('div', 'nm', meta).textContent = v.name;
    el('div', 'sys', meta).textContent = v.metaphor;
    el('div', 'why', meta).textContent = v.why;
    buildFeedback(card, meta, v);
  });

  function buildFeedback(card, meta, v) {
    var fb = el('div', 'fb', meta);
    fb.innerHTML =
      '<div class="fb-head"><span class="fb-lab">Your rating</span>'
      + '<span class="fb-val muted">— / 10</span></div>'
      + '<input type="range" class="fb-range" min="1" max="10" step="1" value="5" data-set="0"'
      + ' aria-label="Rating 1 to 10 for ' + window.HIT.escapeHtml(v.name) + '">'
      + '<div class="fb-scale"><span>Not this</span><span>This one</span></div>'
      + '<textarea class="fb-note" rows="2" placeholder="What works, what doesn’t…"></textarea>'
      + '<div class="fb-saved">✓ saved</div>';

    var range = fb.querySelector('.fb-range');
    var val = fb.querySelector('.fb-val');
    var note = fb.querySelector('.fb-note');
    var saved = fb.querySelector('.fb-saved');
    var rec = data[v.id] || {};

    if (rec.rating) {
      range.value = rec.rating;
      val.textContent = rec.rating + ' / 10';
      val.classList.remove('muted');
      range.setAttribute('data-set', '1');
    }
    if (rec.comment) note.value = rec.comment;

    var t;
    function flash() {
      saved.classList.add('show');
      clearTimeout(t);
      t = setTimeout(function () { saved.classList.remove('show'); }, 900);
    }
    function persist() {
      var isSet = range.getAttribute('data-set') === '1';
      data[v.id] = {
        name: card.getAttribute('data-name'),
        rating: isSet ? parseInt(range.value, 10) : null,
        comment: note.value
      };
      saveAll(data);
      flash();
    }
    range.addEventListener('input', function () {
      range.setAttribute('data-set', '1');
      val.textContent = range.value + ' / 10';
      val.classList.remove('muted');
      persist();
    });
    note.addEventListener('input', persist);
  }

  /* ── Session notes ────────────────────────────────────────────────────── */
  var notesEl = document.getElementById('sessionNotes');
  if (notesEl) {
    if (data._notes) notesEl.value = data._notes;
    notesEl.addEventListener('input', function () {
      data._notes = notesEl.value;
      saveAll(data);
    });
  }

  /* ── Overlay ──────────────────────────────────────────────────────────── */
  var overlay = document.getElementById('overlay');
  var stage = document.getElementById('overlayStage');
  var ovNum = document.getElementById('ovNum');
  var ovName = document.getElementById('ovName');
  var ovMeta = document.getElementById('ovMeta');
  var current = -1;

  function open(v) {
    current = VARS.indexOf(v);
    ovNum.textContent = v.num;
    ovName.textContent = v.name;
    ovMeta.textContent = v.metaphor + (v.family === 'off-brief' ? ' · off-brief' : '');
    stage.innerHTML = '';
    var host = el('div', '', stage);
    /* A fresh mount every time rather than a hidden-and-reshown one: the growth
       animation and the focus state should start clean, the way Nicole will see
       it the first time. */
    window.HIT.mount(host, v, { mode: 'full', count: 200 });
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function close() {
    overlay.hidden = true;
    stage.innerHTML = '';
    document.body.style.overflow = '';
    current = -1;
  }
  function step(dir) {
    if (current < 0) return;
    open(VARS[(current + dir + VARS.length) % VARS.length]);
  }

  document.getElementById('ovClose').addEventListener('click', close);
  document.getElementById('ovPrev').addEventListener('click', function () { step(-1); });
  document.getElementById('ovNext').addEventListener('click', function () { step(1); });
  document.addEventListener('keydown', function (e) {
    if (overlay.hidden) return;
    /* Arrow keys move between directions — unless the reviewer is in the search
       box, where they belong to the text cursor. */
    var typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (e.key === 'Escape') close();
    if (!typing && e.key === 'ArrowRight') step(1);
    if (!typing && e.key === 'ArrowLeft') step(-1);
  });

  /* ── Export ───────────────────────────────────────────────────────────── */
  document.getElementById('exportBtn').addEventListener('click', function () {
    var d = load();
    var lines = ['HARVARD IN TECH — SUPPORTER NETWORK, DESIGN FEEDBACK',
      'Exported ' + new Date().toLocaleString(), ''];
    if ((d._notes || '').trim()) {
      lines.push('OVERALL NOTES', '-------------------------', d._notes.trim(), '', '');
    }
    lines.push('PER-DIRECTION FEEDBACK', '-------------------------', '');
    VARS.forEach(function (v) {
      var r = d[v.id] || {};
      lines.push(v.num + ' · ' + v.name + '  (' + v.metaphor + ')');
      lines.push('  Rating: ' + (r.rating != null ? r.rating + '/10' : '—'));
      lines.push('  Comment: ' + ((r.comment || '').trim() || '(no comment)'));
      lines.push('');
    });
    var text = lines.join('\n');
    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(function () { });
    try {
      var blob = new Blob([text], { type: 'text/plain' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'hit-network-feedback.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) { alert(text); }
  });

  document.getElementById('clearBtn').addEventListener('click', function () {
    if (confirm('Clear all feedback saved in this browser?')) {
      localStorage.removeItem(KEY);
      location.reload();
    }
  });
})();

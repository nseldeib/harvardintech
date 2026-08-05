/* The review deck: builds the cards, mounts a live miniature in each, and opens
   the full-screen view.
 *
 * It collects nothing. The deck once carried a 1-10 rating and a comment box per
 * card with a text-file export, built on the assumption that a published page
 * cannot post anywhere — true, but moot: Nicole sends her reactions in a doc, and
 * nine rating sliders nobody will touch only sit between her and the designs. */
(function () {
  'use strict';

  var VARS = window.HIT_VARIATIONS;

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
       nine of them share one screen without cost. */
    window.HIT.mount(mount, v, { mode: 'preview', count: 110 });

    var meta = el('div', 'meta', card);
    el('div', 'nm', meta).textContent = v.name;
    el('div', 'sys', meta).textContent = v.metaphor;
    el('div', 'why', meta).textContent = v.why;
  });

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
})();

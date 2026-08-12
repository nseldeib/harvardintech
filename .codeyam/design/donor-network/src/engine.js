/* Shared runtime for every variation.
 *
 * The eight directions differ in where nodes go and what they look like. They do
 * NOT differ in what the page does: search a name, focus that person, count up
 * through the milestones, hand someone a card they can post. Those behaviours
 * live here once, so a change to how focus dims the network is one edit rather
 * than eight, and so Nicole is comparing visual directions rather than eight
 * slightly different feature sets.
 *
 * A variation supplies: copy, a palette, and a `layout(donors, W, H)` returning
 * node positions and edges. Everything below is generic over that.
 */
(function () {
  'use strict';

  var DATA = window.HIT_DATA;
  var DONORS = DATA.donors;
  var MILESTONES = DATA.milestones;

  /* The pure rules live in src/lib/donorNetwork.js, which build.py inlines
     just above this file and vitest covers directly. Re-declaring them here
     would give the anonymity contract a second copy that no test can see. */
  var R = window.HIT_RULES;
  var rng = R.rng;
  var isSearchable = R.isSearchable;
  var displayName = R.displayName;
  var monogram = R.supporterMonogram;
  var shortSchool = R.shortSchool;
  var thin = R.thin;

  function el(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }
  function svgEl(tag, parent) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (parent) parent.appendChild(n);
    return n;
  }
  function attrs(node, o) {
    for (var k in o) node.setAttribute(k, o[k]);
    return node;
  }


  /* ── Mount ────────────────────────────────────────────────────────────── */

  /* mode 'preview' is the miniature inside a card: the same layout and palette,
     no chrome, no interaction. It exists so the card grid shows what each
     direction actually looks like rather than a label — and because it is the
     real renderer, the thumbnail can never drift from the thing it opens. */
  function mount(container, variation, opts) {
    opts = opts || {};
    var mode = opts.mode || 'full';
    var preview = mode === 'preview';
    var count = opts.count != null ? opts.count : (preview ? 200 : 200);

    container.innerHTML = '';
    /* Add rather than assign: the host element usually carries a positioning
       class of its own (the card's .thumb-mount), and clobbering className
       drops it — which leaves the miniature unpositioned and invisible. */
    container.classList.remove('viz--preview', 'viz--full');
    container.classList.add('viz', 'viz--' + mode);
    container.setAttribute('data-var', variation.id);
    var t = variation.theme || {};
    for (var k in t) container.style.setProperty('--' + k, t[k]);

    var state = {
      variation: variation, container: container, mode: mode,
      count: count, focus: null, nodes: [], byslug: {}, edgesOf: {}
    };

    /* Chrome first, then the body. Building the stage first and inserting the
       head at the front afterwards leaves the search bar appended BELOW the
       visualization, where the profile panel sits on top of it. */
    if (!preview) buildChrome(container, state);

    if (variation.custom) {
      variation.custom(container, state, API);
      state.body = container.querySelector('.viz-custom');
      if (!preview) finishChrome(container, state);
      return state;
    }

    var stage = el('div', 'viz-stage', container);
    state.body = stage;
    /* Composition, declared per direction. Eight centred objects each captioned
       from the top-left is one template used eight times — the layout has to
       vary as much as the artwork, or every direction reads as the same page
       with different contents. */
    container.classList.add('is-type-' + (variation.compose || 'tl'));
    /* Size the coordinate space to the stage's real shape instead of a fixed
       1000x640. A layout drawn at one aspect and displayed at another has to be
       either letterboxed or cropped, and cropping is what cut the root tree off
       at its own seed. Measuring means each layout is composed for the space it
       will actually occupy. */
    var box = stage.getBoundingClientRect();
    var W = 1000;
    var H = box.width > 0
      ? Math.max(360, Math.min(900, Math.round(1000 * box.height / box.width)))
      : 620;
    var svg = svgEl('svg', stage);
    attrs(svg, { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet' });
    svg.setAttribute('class', 'viz-svg');
    state.svg = svg;
    state.W = W; state.H = H;

    /* A camera group wrapping the whole scene. Nicole's note asks that a
       searched supporter "moves into focus" — enlarging the dot in place is
       only half of that, so the camera pans and zooms to bring them to the
       middle. It has to be an ancestor of every layer or the edges and decor
       would stay put while the nodes moved. */
    var cam = svgEl('g', svg); cam.setAttribute('class', 'g-cam');
    var world = svgEl('g', cam); world.setAttribute('class', 'g-world');
    var gDecor = svgEl('g', world); gDecor.setAttribute('class', 'g-decor');
    var gEdges = svgEl('g', world); gEdges.setAttribute('class', 'g-edges');
    var gNodes = svgEl('g', world); gNodes.setAttribute('class', 'g-nodes');
    state.cam = cam; state.world = world;
    state.gDecor = gDecor; state.gEdges = gEdges; state.gNodes = gNodes;

    render(state);
    if (!preview) finishChrome(container, state);
    return state;
  }

  /* The pieces that have to be layered OVER the body, so they are added once
     the body exists rather than ahead of it. */
  function finishChrome(container, state) {
    /* Grain, over everything. Flat vector fills read as software output; a
       little tooth reads as something that was made. */
    el('div', 'viz-grain', container).setAttribute('aria-hidden', 'true');
    state.flash = el('div', 'viz-flash', container);
    buildProfile(container, state);
    if (state.count === 0) showEmpty(state);
  }

  function visibleDonors(count) { return DONORS.slice(0, count); }

  function render(state) {
    var v = state.variation;
    var donors = visibleDonors(state.count);
    /* Bleed: compose the layout on a canvas larger than the frame and centre
       it, so the artwork runs off the edges instead of sitting politely inside
       them. Work that fits entirely within its border reads as an illustration
       of an idea; work that is cropped reads as a view onto something bigger. */
    /* Capped in the miniature. A hard crop is right at full size, where the
       viewer can see the whole field; on a card it leaves a sliver of arc and
       the direction can't be judged from the grid at all. */
    var b = v.bleed || 1;
    if (state.mode === 'preview') b = Math.min(b, 1.1);
    var LW = state.W * b, LH = state.H * b;
    var scene = v.layout(donors, LW, LH, rng(v.seed || 7));
    state.offX = -(LW - state.W) / 2;
    state.offY = -(LH - state.H) / 2;
    state.world.setAttribute('transform',
      'translate(' + state.offX.toFixed(1) + ',' + state.offY.toFixed(1) + ')');

    state.gDecor.innerHTML = '';
    state.gEdges.innerHTML = '';
    state.gNodes.innerHTML = '';
    state.nodes = []; state.byslug = {}; state.edgesOf = {};

    (scene.decor || []).forEach(function (d) {
      var n = svgEl(d.tag, state.gDecor);
      attrs(n, d.attrs || {});
      if (d.cls) n.setAttribute('class', d.cls);
      if (d.text) n.textContent = d.text;
    });

    (scene.edges || []).forEach(function (e, i) {
      var p = svgEl('path', state.gEdges);
      attrs(p, { d: e.d, 'class': 'edge' + (e.cls ? ' ' + e.cls : '') });
      /* Per-edge weight and opacity. A network drawn at one uniform hairline
         reads as a diagram; varying the stroke is what makes a root taper into
         a twig and a trunk line carry more than a service drop. */
      /* Inline style, NOT a presentation attribute: engine.css carries a
         `.edge { stroke-width: 1 }` default, and any CSS rule outranks a
         presentation attribute — so setAttribute here is silently discarded
         and every taper and weight in the set collapses to one hairline. */
      if (e.w != null) p.style.strokeWidth = e.w.toFixed(2);
      if (e.op != null) p.style.opacity = e.op;
      if (e.slug) {
        (state.edgesOf[e.slug] = state.edgesOf[e.slug] || []).push(p);
      }
      if (e.slug2) {
        (state.edgesOf[e.slug2] = state.edgesOf[e.slug2] || []).push(p);
      }
    });

    /* Entrance animation on a deliberate render, but NOT during the growth
       playback — that re-renders ~50 times, and re-running the reveal on every
       frame makes the whole network strobe instead of grow. */
    state.gNodes.classList.toggle('is-entering', state.animateIn !== false);

    scene.nodes.forEach(function (n, i) {
      var g = svgEl('g', state.gNodes);
      g.setAttribute('class', 'node'
        + (n.d.founding ? ' is-founding' : '')
        + (n.d.anonymous ? ' is-anon' : ''));
      g.setAttribute('transform', 'translate(' + n.x.toFixed(1) + ',' + n.y.toFixed(1) + ')');
      g.style.setProperty('--i', i % 90);
      /* A stable per-person variation so the field has texture instead of
         reading as one repeated dot. Keyed off the donor, not the render, so a
         given person is the same size every time. */
      g.style.setProperty('--tw', (2.6 + ((n.d.joinIndex * 37) % 23) / 7).toFixed(2));
      (v.drawNode || drawNodeDefault)(g, n, state);
      if (state.mode !== 'preview') {
        g.style.cursor = 'pointer';
        g.addEventListener('click', function () { focus(state, n.d.slug); });
      }
      n.g = g;
      state.nodes.push(n);
      state.byslug[n.d.slug] = n;
    });

    if (v.drawExtras) v.drawExtras(state, scene);
  }

  function drawNodeDefault(g, n, state) {
    var r = n.r || (n.d.founding ? 5.2 : 3.4);
    attrs(svgEl('circle', g), { r: r + 6, 'class': 'node-halo' });
    attrs(svgEl('circle', g), { r: r, 'class': 'node-dot' });
  }

  /* ── Chrome: search, milestones, counts ───────────────────────────────── */

  function buildChrome(container, state) {
    var v = state.variation;
    /* An oversized direction numeral bled off the right edge. It gives every
       direction a compositional anchor besides the graph itself — the thing
       that makes a page look art-directed rather than plotted. */
    var ghost = el('div', 'viz-ghost', container);
    ghost.textContent = v.num < 10 ? '0' + v.num : String(v.num);
    ghost.setAttribute('aria-hidden', 'true');

    /* The kicker runs up the left edge as a rail rather than sitting above the
       headline: it frees the corner for the title and gives every direction a
       fixed vertical anchor the artwork can be composed against. */
    var rail = el('div', 'viz-rail', container);
    rail.textContent = v.kicker;

    var head = el('div', 'viz-head', container);
    var h = el('h2', 'viz-title', head);
    h.innerHTML = v.headline;
    if (v.sub) el('p', 'viz-sub', head).textContent = v.sub;

    var bar = el('div', 'viz-bar', container);

    /* Search sits in the design, not in the reviewer chrome, because how a
       direction presents "find your place in the network" is part of what is
       being judged. */
    var sw = el('div', 'viz-search', bar);
    var input = el('input', 'viz-input', sw);
    input.type = 'search';
    input.placeholder = 'Find your place in the network…';
    input.setAttribute('aria-label', 'Search supporters by name');
    var results = el('div', 'viz-results', sw);
    state.input = input;

    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase();
      results.innerHTML = '';
      if (!q) { results.classList.remove('open'); return; }
      var hits = visibleDonors(state.count).filter(function (d) {
        return isSearchable(d) && d.name.toLowerCase().indexOf(q) >= 0;
      }).slice(0, 6);
      if (!hits.length) {
        var none = el('div', 'viz-result viz-result--none', results);
        none.textContent = 'No supporter by that name in the network yet.';
      }
      hits.forEach(function (d) {
        var r = el('button', 'viz-result', results);
        r.type = 'button';
        r.innerHTML = '<span>' + escapeHtml(d.name) + '</span><em>'
          + escapeHtml(shortSchool(d.school)) + ' &rsquo;' + String(d.gradYear).slice(2) + '</em>';
        r.addEventListener('click', function () {
          focus(state, d.slug);
          input.value = d.name;
          results.classList.remove('open');
        });
      });
      results.classList.add('open');
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; results.classList.remove('open'); clearFocus(state); }
      if (e.key === 'Enter') {
        var first = results.querySelector('.viz-result:not(.viz-result--none)');
        if (first) first.click();
      }
    });

    var meter = el('div', 'viz-meter', bar);
    var num = el('span', 'viz-count', meter);
    num.textContent = state.count;
    el('span', 'viz-count-label', meter).textContent = 'supporters';
    state.countEl = num;

    var ctrls = el('div', 'viz-ctrls', bar);
    /* The four states the brief actually asks a design to survive: day one,
       a handful, a crowd, and the 200 milestone. */
    [['Empty', 0], ['12', 12], ['150', 150], ['200', 200]].forEach(function (p) {
      var b = el('button', 'viz-chip', ctrls);
      b.type = 'button';
      b.textContent = p[0];
      b.addEventListener('click', function () { setCount(state, p[1]); });
    });
    var play = el('button', 'viz-chip viz-chip--play', ctrls);
    play.type = 'button';
    play.textContent = '▶ Grow to 200';
    play.addEventListener('click', function () { playGrowth(state); });

  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Always hand `custom` the viz container, never the host it created: the host
     looks up `.viz-custom` inside what it is given, so passing the host itself
     makes it build a second one nested in the first. */
  function redraw(state) {
    if (state.variation.custom) state.variation.custom(state.container, state, API, true);
    else render(state);
  }

  function setCount(state, n) {
    state.count = n;
    clearFocus(state);
    if (state.countEl) state.countEl.textContent = n;
    redraw(state);
    if (n === 0) showEmpty(state); else hideEmpty(state);
  }

  /* Production starts empty and stays empty until the first upload, so every
     direction has to be judged on the state it will spend its first week in —
     not only on the state with 200 nodes in it. */
  function showEmpty(state) {
    hideEmpty(state);
    /* Over the body only — covering the whole container would hide the
       headline, and the headline is most of what the empty state IS. */
    var e = el('div', 'viz-empty', state.body || state.container);
    e.innerHTML = '<div class="viz-empty-in"><div class="viz-kick">Day one</div>'
      + '<p>' + escapeHtml(state.variation.emptyLine
        || 'The network has no supporters yet. The first gift starts it.')
      + '</p><span class="viz-empty-cta">Become a founding supporter</span></div>';
    state.emptyEl = e;
  }
  function hideEmpty(state) {
    if (state.emptyEl && state.emptyEl.parentNode) state.emptyEl.parentNode.removeChild(state.emptyEl);
    state.emptyEl = null;
  }

  /* Milestone animation. Nicole asked for 50 / 100 / 150 / 200; the growth runs
     continuously and pauses to name each one as it lands, because the point she
     made is that the milestones are moments, not labels on an axis. */
  function playGrowth(state) {
    if (state.playing) return;
    state.playing = true;
    clearFocus(state);
    hideEmpty(state);
    var n = 0;
    var step = function () {
      if (!state.playing) return;
      var prev = n;
      n += Math.max(1, Math.round(n / 22) + 1);

      /* Snap to a milestone we STEPPED OVER rather than requiring an exact
         landing. The increment accelerates with the count, so asking for
         `n === 50` means the 50/100/150 flashes fire only when the arithmetic
         happens to land there — in practice never, and only 200 showed because
         it is clamped. Nicole asked for all four. */
      var hit = R.milestoneCrossed(prev, n, MILESTONES);
      if (hit != null) n = hit;
      if (n >= 200) { n = 200; hit = 200; }

      setCountQuiet(state, n);
      if (hit != null) {
        milestoneFlash(state, hit);
        if (n >= 200) { state.playing = false; return; }
        setTimeout(step, 950);
      } else {
        setTimeout(step, 26);
      }
    };
    step();
  }
  function setCountQuiet(state, n) {
    state.count = n;
    if (state.countEl) state.countEl.textContent = n;
    state.animateIn = false;
    redraw(state);
    state.animateIn = true;
  }
  function milestoneFlash(state, n) {
    if (!state.flash) return;
    /* Not "founding supporters" — founding is the early cohort, not everyone
       who has given by the time the count reaches 200. */
    state.flash.innerHTML = '<div class="viz-flash-in"><strong>' + n + '</strong><span>'
      + (n >= 200 ? 'supporters' : 'supporters and growing') + '</span></div>';
    state.flash.classList.add('on');
    state.container.classList.add('is-milestone');
    setTimeout(function () {
      state.flash.classList.remove('on');
      state.container.classList.remove('is-milestone');
    }, 800);
  }

  /* ── Focus + profile + shareable card ─────────────────────────────────── */

  function focus(state, slug) {
    var n = state.byslug[slug];
    if (!n) return;
    if (n.d.anonymous) return; /* nothing to open: there is no name to show */
    clearFocus(state, true);
    state.focus = slug;
    state.container.classList.add('is-focused');
    if (n.g) n.g.classList.add('is-focus');
    (state.edgesOf[slug] || []).forEach(function (p) { p.classList.add('is-lit'); });
    moveCamera(state, n);
    showProfile(state, n.d);
  }

  /* Pan and zoom so the focused supporter sits in the clear. Framed left of
     centre and a little high: the profile card occupies the lower right, and
     centring exactly would put the person underneath their own card. */
  function moveCamera(state, n) {
    if (!state.cam || n.x == null) return;
    var s = 1.85;
    var sx = n.x + state.offX, sy = n.y + state.offY;
    var tx = state.W * 0.38 - sx * s, ty = state.H * 0.44 - sy * s;
    state.cam.setAttribute('transform',
      'translate(' + tx.toFixed(1) + ',' + ty.toFixed(1) + ') scale(' + s + ')');
  }
  function resetCamera(state) {
    if (state.cam) state.cam.setAttribute('transform', '');
  }

  function clearFocus(state, keepPanel) {
    state.container.classList.remove('is-focused');
    state.nodes.forEach(function (n) { if (n.g) n.g.classList.remove('is-focus'); });
    Object.keys(state.edgesOf).forEach(function (k) {
      state.edgesOf[k].forEach(function (p) { p.classList.remove('is-lit'); });
    });
    state.focus = null;
    resetCamera(state);
    if (!keepPanel && state.profile) state.profile.classList.remove('open');
  }

  function buildProfile(container, state) {
    var p = el('div', 'viz-profile', container);
    state.profile = p;
  }

  function showProfile(state, d) {
    var p = state.profile;
    if (!p) return;
    p.innerHTML = '';
    var close = el('button', 'viz-profile-x', p);
    close.type = 'button';
    close.setAttribute('aria-label', 'Close');
    close.textContent = '×';
    close.addEventListener('click', function () { clearFocus(state); if (state.input) state.input.value = ''; });

    var card = el('div', 'viz-card', p);
    var av = el('div', 'viz-card-av', card);
    av.textContent = monogram(d);
    var body = el('div', 'viz-card-body', card);
    el('div', 'viz-card-name', body).textContent = displayName(d);
    el('div', 'viz-card-meta', body).textContent =
      shortSchool(d.school) + ' · Class of ' + d.gradYear;
    if (d.founding) {
      var badge = el('span', 'viz-card-badge', body);
      badge.textContent = 'Founding Supporter';
    }
    if (d.note) {
      var q = el('p', 'viz-card-note', body);
      q.textContent = '“' + d.note + '”';
    }
    var actions = el('div', 'viz-card-actions', p);
    var dl = el('button', 'viz-card-btn', actions);
    dl.type = 'button';
    dl.textContent = '↓ Download supporter card';
    dl.addEventListener('click', function () { downloadCard(state, d); });
    var sh = el('button', 'viz-card-btn viz-card-btn--ghost', actions);
    sh.type = 'button';
    sh.textContent = 'Share';
    sh.addEventListener('click', function () { shareCard(state, d); });

    p.classList.add('open');
  }

  /* The shareable card is drawn rather than screenshotted so it comes out at a
     fixed 1080 square whatever the viewer's screen is — the size a social post
     actually wants. */
  function renderCardCanvas(state, d) {
    var S = 1080;
    var c = document.createElement('canvas');
    c.width = S; c.height = S;
    var g = c.getContext('2d');
    var t = state.variation.theme || {};
    var bg = t.cardBg || t.bg || '#1e1a1b';
    var fg = t.cardFg || '#ffffff';
    var accent = t.accent || '#a41034';

    g.fillStyle = bg; g.fillRect(0, 0, S, S);

    /* A few strands of the network behind the name, so the card reads as a
       piece of the thing rather than a generic certificate. */
    var r = rng(d.joinIndex * 977);
    g.strokeStyle = accent; g.globalAlpha = 0.22; g.lineWidth = 2;
    var pts = [];
    for (var i = 0; i < 26; i++) pts.push([r() * S, r() * S]);
    pts.forEach(function (a, i) {
      var b = pts[(i + 3) % pts.length];
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    });
    g.globalAlpha = 0.5;
    pts.forEach(function (a) {
      g.beginPath(); g.fillStyle = accent; g.arc(a[0], a[1], 4, 0, 6.284); g.fill();
    });
    g.globalAlpha = 1;

    g.fillStyle = accent;
    g.font = '600 26px "JetBrains Mono", ui-monospace, monospace';
    g.fillText('HARVARD IN TECH', 88, 150);

    g.fillStyle = fg;
    g.font = '800 84px "Helvetica Neue", Helvetica, Arial, sans-serif';
    wrap(g, d.name, 88, 420, S - 176, 92);

    g.fillStyle = fg; g.globalAlpha = 0.7;
    g.font = '400 34px "Times New Roman", Times, serif';
    g.fillText(shortSchool(d.school) + ' · Class of ' + d.gradYear, 88, 520);
    g.globalAlpha = 1;

    if (d.founding) {
      g.fillStyle = accent;
      g.fillRect(88, 570, 340, 56);
      g.fillStyle = '#fff';
      g.font = '700 22px "JetBrains Mono", ui-monospace, monospace';
      g.fillText('FOUNDING SUPPORTER', 108, 606);
    }

    g.fillStyle = fg; g.globalAlpha = 0.85;
    g.font = 'italic 400 36px "Times New Roman", Times, serif';
    wrap(g, d.note ? '“' + d.note + '”' : 'Powering the Harvard alumni in tech network.',
      88, 760, S - 176, 48);
    g.globalAlpha = 1;

    g.fillStyle = accent;
    g.fillRect(88, S - 120, 64, 8);
    g.fillStyle = fg; g.globalAlpha = 0.55;
    g.font = '400 24px "JetBrains Mono", ui-monospace, monospace';
    g.fillText('harvardintech.com', 88, S - 70);

    return c;
  }

  function wrap(g, text, x, y, maxW, lh) {
    var words = String(text).split(/\s+/), line = '', yy = y;
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (g.measureText(test).width > maxW && line) { g.fillText(line, x, yy); yy += lh; line = w; }
      else line = test;
    });
    if (line) g.fillText(line, x, yy);
  }

  function downloadCard(state, d) {
    var c = renderCardCanvas(state, d);
    try {
      var a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = 'hit-supporter-' + d.slug + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) { /* a download blocked by the host is not worth an alert */ }
  }

  function shareCard(state, d) {
    var c = renderCardCanvas(state, d);
    if (navigator.share && c.toBlob) {
      c.toBlob(function (blob) {
        var file = new File([blob], 'hit-supporter-' + d.slug + '.png', { type: 'image/png' });
        var payload = {
          title: 'Harvard in Tech',
          text: displayName(d) + ' is powering the Harvard alumni in tech network.'
        };
        if (navigator.canShare && navigator.canShare({ files: [file] })) payload.files = [file];
        navigator.share(payload).catch(function () { });
      });
    } else {
      downloadCard(state, d);
    }
  }

  /* ── Layout helpers shared by more than one direction ─────────────────── */

  /* Type as a container for the network. Renders a word to an offscreen canvas
     and returns points inside the letterforms, so supporters can BE the
     typography rather than sit in a chart beside it. Canvas is the only way to
     get glyph interiors — SVG can clip to text, but clipping hides nodes that
     fall outside instead of placing them where they belong, which leaves the
     count wrong and the letters half-empty. */
  function glyphPoints(text, W, H, opts) {
    opts = opts || {};
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var fam = "900 {S}px 'Helvetica Neue', Helvetica, Arial, sans-serif";
    var size = H * (opts.heightFrac || 0.6);
    g.font = fam.replace('{S}', size);
    var wide = g.measureText(text).width;
    var maxW = W * (opts.widthFrac || 0.9);
    if (wide > maxW) { size *= maxW / wide; g.font = fam.replace('{S}', size); }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#000';
    g.fillText(text, W / 2, H * (opts.cy || 0.5));

    var img = g.getImageData(0, 0, W, H).data;
    var step = opts.step || 3;
    var pts = [];
    for (var y = 0; y < H; y += step) {
      for (var x = 0; x < W; x += step) {
        if (img[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
      }
    }
    return pts;
  }

  /* Halftone: a coarse grid over the glyph, each cell carrying how much of it
     the letterform covers, so dot size can vary the way a printed halftone
     does rather than every dot being identical. */
  function halftoneCells(text, W, H, cell, opts) {
    opts = opts || {};
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var fam = "900 {S}px 'Helvetica Neue', Helvetica, Arial, sans-serif";
    var size = H * (opts.heightFrac || 0.72);
    g.font = fam.replace('{S}', size);
    var wide = g.measureText(text).width;
    var maxW = W * (opts.widthFrac || 0.88);
    if (wide > maxW) { size *= maxW / wide; g.font = fam.replace('{S}', size); }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#000';
    g.fillText(text, W / 2, H * (opts.cy || 0.5));

    var img = g.getImageData(0, 0, W, H).data;
    var cells = [];
    for (var y = cell / 2; y < H; y += cell) {
      for (var x = cell / 2; x < W; x += cell) {
        var hit = 0, tot = 0;
        for (var dy = -cell / 2; dy < cell / 2; dy += 2) {
          for (var dx = -cell / 2; dx < cell / 2; dx += 2) {
            var px = Math.round(x + dx), py = Math.round(y + dy);
            if (px < 0 || py < 0 || px >= W || py >= H) continue;
            tot++;
            if (img[(py * W + px) * 4 + 3] > 128) hit++;
          }
        }
        if (tot && hit / tot > 0.12) cells.push({ x: x, y: y, cov: hit / tot });
      }
    }
    return cells;
  }

  var API = {
    DONORS: DONORS, MILESTONES: MILESTONES,
    rng: rng, el: el, svgEl: svgEl, attrs: attrs,
    displayName: displayName, monogram: monogram, isSearchable: isSearchable,
    shortSchool: shortSchool, escapeHtml: escapeHtml,
    visibleDonors: visibleDonors, focus: focus,
    glyphPoints: glyphPoints, halftoneCells: halftoneCells, thin: thin,
    schools: function (donors) {
      var m = {};
      donors.forEach(function (d) { (m[d.school] = m[d.school] || []).push(d); });
      return m;
    },
    decade: function (y) { return Math.floor(y / 10) * 10; }
  };

  window.HIT = {
    mount: mount, DONORS: DONORS, MILESTONES: MILESTONES, api: API,
    displayName: displayName, shortSchool: shortSchool, escapeHtml: escapeHtml
  };
})();

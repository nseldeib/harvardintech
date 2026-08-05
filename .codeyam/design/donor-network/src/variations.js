/* The nine directions.
 *
 * These are graphic compositions, not charts. The distinction is the whole
 * point of the set: an earlier pass drew each idea as a technical diagram — a
 * grid schematic, a PCB, a cluster scatter — and every one of them read as
 * infrastructure documentation rather than as something you would put on a
 * page people are meant to feel something about. What survived that pass were
 * the two that were designed rather than plotted: the concentric rings (06)
 * and the typographic honour roll (07). The rest are rebuilt to that bar.
 *
 * The rule each direction follows: the 200 supporters MAKE the graphic. They
 * are the letterforms, the weave, the line, the bloom — not points scattered
 * on top of one. All eight stay inside the site's committed Atlas palette
 * (crimson #a41034 on ink or warm paper, Helvetica display, Times serif,
 * JetBrains Mono labels).
 */
(function () {
  'use strict';

  var A = window.HIT.api;
  var TAU = Math.PI * 2;
  var GOLDEN = Math.PI * (3 - Math.sqrt(5));

  function path(pts) {
    return pts.map(function (p, i) {
      return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }).join(' ');
  }
  function quad(a, c, b) {
    return 'M' + a[0].toFixed(1) + ' ' + a[1].toFixed(1)
      + ' Q' + c[0].toFixed(1) + ' ' + c[1].toFixed(1)
      + ' ' + b[0].toFixed(1) + ' ' + b[1].toFixed(1);
  }

  /* ── 1 · Power grid ───────────────────────────────────────────────────
     Nicole's own metaphor, taken literally: a network of nodes on a power
     grid. Drawn as a grid looks at night from above rather than as a wiring
     schematic — substations as points of light, transmission lines carrying
     visible current, everything else dark. An earlier pass rendered this with
     pylon glyphs and silkscreen labels and it read as infrastructure
     documentation; the subject was right and the register was wrong. */
  var grid = {
    id: 'grid', num: 1, family: 'network',
    compose: 'tl', bleed: 1.16,
    name: 'Powering the Harvard Alumni in Tech Network',
    metaphor: 'Power grid at night',
    why: 'Nicole\'s metaphor, literally: nodes on a power grid. Seen the way a grid looks from the air after dark — the schools are the bright junctions, and you can watch the current move between them.',
    kicker: 'Direction 01 · Power grid',
    headline: 'A grid, <em>lit from within</em>.',
    sub: 'Each school is a junction; each supporter a light hung off it. The current running between them is what the fund pays for.',
    emptyLine: 'The grid is built and dark. The first gift energizes the first junction.',
    seed: 5,
    theme: {
      bg: '#07070a', fg: '#fff6ee', muted: 'rgba(255,246,238,.5)',
      line: 'rgba(255,246,238,.14)', accent: '#ff2d55',
      node: '#ffd9a8', edge: 'rgba(255,217,168,.3)', cardBg: '#07070a',
      'bg-image':
        'radial-gradient(58% 44% at 32% 34%, rgba(255,45,85,.22) 0%, transparent 64%),'
        + 'radial-gradient(50% 40% at 74% 68%, rgba(255,170,90,.16) 0%, transparent 62%)'
    },
    layout: function (donors, W, H, rnd) {
      var schools = A.schools(donors);
      var names = Object.keys(schools).sort(function (a, b) {
        return schools[b].length - schools[a].length;
      });
      var subs = {}, decor = [], edges = [], nodes = [];
      var cols = 4;
      var rows = Math.ceil(names.length / cols);

      names.forEach(function (s, i) {
        var c = i % cols, r = Math.floor(i / cols);
        var x = W * (c + 0.5) / cols + (rnd() - 0.5) * W * 0.1;
        var y = H * (r + 0.5) / rows + (rnd() - 0.5) * H * 0.12;
        subs[s] = [x, y];
        /* A junction is a bloom of light, not a labelled box — size carries
           how many people are on it, so the map has hierarchy without a key. */
        var mag = 16 + Math.sqrt(schools[s].length) * 9;
        decor.push({ tag: 'circle', cls: 'junction-glow', attrs: { cx: x, cy: y, r: mag } });
        decor.push({ tag: 'circle', cls: 'junction', attrs: { cx: x, cy: y, r: 3.6 } });
      });

      /* Trunk lines: a dim standing conductor with a short bright dash
         travelling the identical path. One dashed line on its own reads as a
         dotted border; two layers read as current. */
      var order = names.slice();
      for (var i = 0; i < order.length; i++) {
        var a = subs[order[i]], b = subs[order[(i + 1) % order.length]];
        var d = path([a, b]);
        edges.push({ d: d, cls: 'trunk-base', w: 1, op: 0.3 });
        edges.push({ d: d, cls: 'trunk-pulse', w: 2 });
      }

      donors.forEach(function (d) {
        var s = subs[d.school];
        var ang = rnd() * TAU;
        var rad = 30 + rnd() * 76;
        var x = s[0] + Math.cos(ang) * rad * 1.4;
        var y = s[1] + Math.sin(ang) * rad * 0.9;
        nodes.push({ d: d, x: x, y: y, r: d.founding ? 3.6 : 2.2 });
        edges.push({
          d: path([[x, y], s]), slug: d.slug, cls: 'feeder',
          w: d.founding ? 0.9 : 0.5, op: 0.16 + rnd() * 0.2
        });
      });
      return { nodes: nodes, edges: edges, decor: decor };
    },
    drawNode: function (g, n) {
      A.attrs(A.svgEl('circle', g), { r: n.r + 8, 'class': 'node-halo' });
      A.attrs(A.svgEl('circle', g), { r: n.r, 'class': 'node-dot' });
    }
  };

  /* ── 2 · Letterform network ───────────────────────────────────────────
     The word is built out of the people. Type and network stop being two
     things on one page — the supporters ARE the headline, and the sentence
     only exists because enough of them turned up to spell it. */
  var letterform = {
    id: 'letterform', num: 2, family: 'network',
    compose: 'bl', bleed: 1.0,
    name: 'The Word',
    metaphor: 'Letterform network',
    why: 'The supporters spell the word. Type and network are the same object, so the headline literally cannot exist without enough people to form it — and you watch it resolve as the network grows.',
    kicker: 'Direction 02 · Letterform',
    headline: 'The word is made of <em>the people</em>.',
    sub: 'Two hundred supporters, positioned to spell what they paid for. Below fifty the word is unreadable; that is the point.',
    emptyLine: 'Nothing to spell it with yet. The first gift places the first point.',
    seed: 11,
    /* Five letters, not eight. Two hundred points spread across POWERING gives
       ~25 per letter, which is under the threshold where a glyph reads — the
       word has to be short enough that each letter gets enough people. */
    word: 'POWER',
    theme: {
      bg: '#0d0b0c', fg: '#ffffff', muted: 'rgba(255,255,255,.55)',
      line: 'rgba(255,255,255,.15)', accent: '#e01b41',
      node: '#ffffff', edge: 'rgba(255,255,255,.3)', cardBg: '#0d0b0c',
      'bg-image': 'radial-gradient(80% 70% at 50% 46%, rgba(224,27,65,.24) 0%, transparent 64%)'
    },
    layout: function (donors, W, H, rnd) {
      var nodes = [], edges = [];
      var pts = A.thin(
        A.glyphPoints(this.word, W, H, { heightFrac: 0.68, widthFrac: 0.9, cy: 0.5, step: 3 }),
        donors.length
      );
      donors.forEach(function (d, i) {
        var p = pts[i] || [W / 2, H / 2];
        nodes.push({
          d: d,
          x: p[0] + (rnd() - 0.5) * 4,
          y: p[1] + (rnd() - 0.5) * 4,
          r: d.founding ? 6.5 : 4.6
        });
      });
      /* Short links only. Long ones would web across the counters of the
         letters and close them up, and a filled 'O' stops being an 'O'. */
      nodes.forEach(function (n, i) {
        var best = null, bd = 1e9;
        for (var j = i + 1; j < Math.min(nodes.length, i + 14); j++) {
          var dx = n.x - nodes[j].x, dy = n.y - nodes[j].y;
          var dd = dx * dx + dy * dy;
          if (dd < bd) { bd = dd; best = j; }
        }
        if (best != null && bd < 1600) {
          edges.push({
            d: path([[n.x, n.y], [nodes[best].x, nodes[best].y]]),
            slug: n.d.slug, slug2: nodes[best].d.slug, w: 0.8, op: 0.4
          });
        }
      });
      return { nodes: nodes, edges: edges, decor: [] };
    }
  };

  /* ── 2 · Woven circle ─────────────────────────────────────────────────
     Every supporter sits on the rim; the threads inside connect people from
     the same school. The density in the middle is not decoration — it is how
     many shared affiliations there actually are. */
  var weave = {
    id: 'weave', num: 3, family: 'network',
    compose: 'tl', bleed: 1.34,
    name: 'Founders Circle',
    metaphor: 'Woven circle',
    why: 'A literal circle, woven. Threads join people from the same school, so the pattern in the middle is the community\'s actual shape — and it is beautiful before you know that.',
    kicker: 'Direction 03 · Weave',
    headline: 'The <em>Founders Circle</em>, woven.',
    sub: 'Everyone sits on the rim in the order they gave. Each thread joins two supporters from the same school — the pattern is what the community has in common.',
    emptyLine: 'An empty circle. Nothing to weave with until the first gift.',
    seed: 23,
    theme: {
      bg: '#0a0a0f', fg: '#f6f5f2', muted: 'rgba(246,245,242,.5)',
      line: 'rgba(246,245,242,.14)', accent: '#e0244b',
      node: '#f6f5f2', edge: 'rgba(224,36,75,.5)', cardBg: '#0a0a0f',
      'bg-image': 'radial-gradient(58% 62% at 50% 50%, rgba(224,36,75,.16) 0%, transparent 68%)'
    },
    layout: function (donors, W, H, rnd) {
      var nodes = [], edges = [], decor = [];
      var cx = W / 2, cy = H / 2;
      var R = Math.min(W, H) * 0.42;
      var n = donors.length;

      decor.push({ tag: 'circle', cls: 'rim', attrs: { cx: cx, cy: cy, r: R } });

      var at = {};
      donors.forEach(function (d, i) {
        var a = (i / Math.max(1, n)) * TAU - Math.PI / 2;
        var x = cx + Math.cos(a) * R * 1.34, y = cy + Math.sin(a) * R;
        at[d.slug] = [x, y];
        nodes.push({ d: d, x: x, y: y, r: d.founding ? 4.4 : 2.6 });
      });

      /* One thread per adjacent pair within a school, bowed toward the middle.
         Joining every pair would fill the circle solid; chaining them keeps the
         weave open enough to read as threads. */
      var schools = A.schools(donors);
      Object.keys(schools).forEach(function (s) {
        var m = schools[s];
        for (var i = 0; i < m.length - 1; i++) {
          var a = at[m[i].slug], b = at[m[i + 1].slug];
          if (!a || !b) continue;
          edges.push({
            d: quad(a, [cx + (rnd() - 0.5) * R * 0.3, cy + (rnd() - 0.5) * R * 0.3], b),
            slug: m[i].slug, slug2: m[i + 1].slug,
            w: 0.7, op: 0.22 + rnd() * 0.16, cls: 'thread'
          });
        }
      });
      return { nodes: nodes, edges: edges, decor: decor };
    }
  };

  /* ── 3 · One line ─────────────────────────────────────────────────────
     "Every gift starts with one person" drawn as exactly that: a single
     unbroken stroke that begins hairline-thin at the first supporter and is
     eight times heavier by the two-hundredth. Growth you can see in the
     weight of the line rather than in a number. */
  var oneline = {
    id: 'oneline', num: 4, family: 'network',
    compose: 'tr', bleed: 1.06,
    name: 'Founding Momentum Donors (2026)',
    metaphor: 'One continuous line',
    why: 'One unbroken stroke through all 200 supporters, thickening as it goes. The most literal drawing of "every gift starts with one person" — and the only one where growth is visible without counting.',
    kicker: 'Direction 04 · One line',
    headline: 'One line, <em>getting stronger</em>.',
    sub: 'A single stroke through every supporter in the order they gave. It starts as a hairline and ends eight times heavier — the line is the fund.',
    emptyLine: 'The line has not been started. The first gift draws it.',
    seed: 37,
    theme: {
      bg: '#f7f4ef', fg: '#1e1a1b', muted: 'rgba(30,26,27,.55)',
      line: 'rgba(30,26,27,.15)', accent: '#a41034',
      node: '#1e1a1b', edge: 'rgba(164,16,52,.9)', cardBg: '#1e1a1b',
      'bg-image': 'radial-gradient(72% 60% at 84% 96%, rgba(164,16,52,.14) 0%, transparent 62%)'
    },
    layout: function (donors, W, H, rnd) {
      var nodes = [], edges = [], decor = [];
      var n = donors.length;
      /* Few, long rows. More rows would pack the serpentine tighter and turn
         the stroke into hatching — the direction only works if the line stays
         a line you can follow from one end to the other. */
      var rows = Math.max(2, Math.min(5, Math.round(Math.sqrt(n / 9))));
      var padX = W * 0.09, padY = H * 0.2;
      var xL = padX, xR = W - padX;
      var gap = (H - padY * 2) / (rows - 1);
      var turnR = gap / 2;

      /* The path is built as real geometry — straight runs joined by half-turns
         — and then sampled at even arc length. Placing supporters row-by-row
         instead leaves a hard 180° reversal at each row end, and a ribbon with
         thickness cannot round a zero-radius corner: it folds through itself. */
      var segs = [], totalLen = 0;
      for (var r = 0; r < rows; r++) {
        var y = padY + r * gap;
        var a = r % 2 ? [xR, y] : [xL, y];
        var b = r % 2 ? [xL, y] : [xR, y];
        segs.push({ line: true, a: a, b: b, len: Math.abs(xR - xL) });
        if (r < rows - 1) {
          segs.push({
            line: false, cx: b[0], cy: y + turnR, r: turnR,
            a0: -Math.PI / 2, a1: r % 2 ? -Math.PI * 1.5 : Math.PI / 2,
            len: Math.PI * turnR
          });
        }
      }
      segs.forEach(function (s) { totalLen += s.len; });

      var at = function (t) {
        var target = t * totalLen, acc = 0;
        for (var i = 0; i < segs.length; i++) {
          var s = segs[i];
          if (acc + s.len >= target || i === segs.length - 1) {
            var u = s.len ? (target - acc) / s.len : 0;
            u = Math.max(0, Math.min(1, u));
            if (s.line) {
              return [s.a[0] + (s.b[0] - s.a[0]) * u, s.a[1] + (s.b[1] - s.a[1]) * u];
            }
            var ang = s.a0 + (s.a1 - s.a0) * u;
            return [s.cx + Math.cos(ang) * s.r, s.cy + Math.sin(ang) * s.r];
          }
          acc += s.len;
        }
        return [xL, padY];
      };

      /* Sampled finely for the ribbon outline, independently of where the 200
         supporters land — the outline needs enough points to stay smooth
         around the turns even when only twelve people have given. */
      var STEPS = 420;
      var hwAt = function (t) { return 1.2 + t * 13; };
      var Lside = [], Rside = [];
      for (var i = 0; i <= STEPS; i++) {
        var t = i / STEPS;
        var p = at(t);
        var q = at(Math.min(1, t + 0.002));
        var dx = q[0] - p[0], dy = q[1] - p[1];
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        var nx = -dy / len, ny = dx / len, hw = hwAt(t);
        Lside.push([p[0] + nx * hw, p[1] + ny * hw]);
        Rside.push([p[0] - nx * hw, p[1] - ny * hw]);
      }
      decor.push({
        tag: 'path', cls: 'ribbon',
        attrs: {
          d: path(Lside) + ' L' + Rside.reverse().map(function (p) {
            return p[0].toFixed(1) + ' ' + p[1].toFixed(1);
          }).join(' L') + ' Z'
        }
      });

      donors.forEach(function (d, i) {
        var t = n === 1 ? 0 : i / (n - 1);
        var p = at(t);
        nodes.push({ d: d, x: p[0], y: p[1], r: d.founding ? 3.4 : 2.6 });
        if (i > 0) {
          var pPrev = at((i - 1) / Math.max(1, n - 1));
          /* Carried at zero opacity purely so focus has a segment to light:
             the ribbon is one shape and cannot highlight a single person. */
          edges.push({
            d: path([pPrev, p]), cls: 'stroke',
            slug: d.slug, slug2: donors[i - 1].slug,
            w: hwAt(t) * 2, op: 0
          });
        }
      });
      return { nodes: nodes, edges: edges, decor: decor };
    },
    drawNode: function (g, n) {
      A.attrs(A.svgEl('circle', g), { r: 7, 'class': 'node-halo' });
      /* Marks sit ON the stroke, so a visible dot per supporter punches 200
         holes in it and the continuous line reads as a dashed one. Only
         founding supporters get a standing mark; everyone else appears when
         they are focused and is otherwise part of the line. */
      A.attrs(A.svgEl('circle', g), {
        r: n.d.founding ? 4.2 : 3, 'class': 'node-dot' + (n.d.founding ? '' : ' is-quiet')
      });
    }
  };

  /* ── 4 · Bloom ────────────────────────────────────────────────────────
     Each gift is a soft field of colour rather than a dot, and the fields
     overlap and multiply. Nobody reads as a data point; the depth in the
     middle is simply what happens when enough people show up. */
  var bloom = {
    id: 'bloom', num: 5, family: 'network',
    compose: 'tr', bleed: 1.18,
    name: 'Community of Supporters',
    metaphor: 'Overlapping bloom',
    why: 'No dots, no lines. Every gift is a soft field of colour and they multiply where they overlap — so density reads as warmth instead of as a data point. The least clinical of the set.',
    kicker: 'Direction 05 · Bloom',
    headline: 'Every gift <em>casts light</em>.',
    sub: 'Each supporter is a field rather than a point. Where they overlap the colour deepens — the community is the part where everyone is standing close together.',
    emptyLine: 'No light yet. The first gift is the first glow.',
    seed: 53,
    theme: {
      bg: '#fdfaf6', fg: '#241a1c', muted: 'rgba(36,26,28,.55)',
      line: 'rgba(36,26,28,.14)', accent: '#a41034',
      node: '#a41034', edge: 'transparent', cardBg: '#241a1c',
      'bg-image': 'radial-gradient(60% 60% at 50% 52%, rgba(255,214,180,.5) 0%, transparent 70%)'
    },
    layout: function (donors, W, H, rnd) {
      var nodes = [];
      var schools = A.schools(donors);
      var names = Object.keys(schools).sort(function (a, b) {
        return schools[b].length - schools[a].length;
      });
      var cx = W / 2, cy = H / 2;
      /* Schools gather into loose clouds so the picture has structure without
         drawing a single boundary — the grouping is felt, not labelled. */
      names.forEach(function (s, si) {
        var a = si * GOLDEN * 1.6;
        var rad = Math.sqrt(si / Math.max(1, names.length)) * Math.min(W, H) * 0.36;
        var gx = cx + Math.cos(a) * rad * 1.5;
        var gy = cy + Math.sin(a) * rad;
        schools[s].forEach(function (d, j) {
          var aa = j * GOLDEN;
          var rr = Math.sqrt(j / schools[s].length) * (34 + schools[s].length * 1.5);
          nodes.push({
            d: d,
            x: gx + Math.cos(aa) * rr * 1.35 + (rnd() - 0.5) * 16,
            y: gy + Math.sin(aa) * rr + (rnd() - 0.5) * 16,
            r: (d.founding ? 62 : 40) + rnd() * 22
          });
        });
      });
      return { nodes: nodes, edges: [], decor: [] };
    },
    drawNode: function (g, n) {
      A.attrs(A.svgEl('circle', g), { r: n.r * 0.34, 'class': 'node-halo' });
      A.attrs(A.svgEl('circle', g), { r: n.r, 'class': 'bloom-field' });
      /* A small solid core keeps a focused supporter findable — a blurred
         field alone gives the eye nothing to land on. */
      A.attrs(A.svgEl('circle', g), { r: n.d.founding ? 3.4 : 2.2, 'class': 'node-dot' });
    }
  };

  /* ── 5 · Halftone milestone ───────────────────────────────────────────
     The count draws itself. Every supporter is one dot of a printed halftone,
     so the numeral is made of exactly the people it counts — and it visibly
     resolves as the network grows toward each milestone. */
  var halftone = {
    id: 'halftone', num: 6, family: 'network',
    compose: 'bl', bleed: 1.02,
    name: 'Founding Supporters Showcase',
    metaphor: 'Halftone numeral',
    why: 'The milestone number IS the network — one dot per supporter, printed as a halftone. It resolves from noise into a legible numeral as the count climbs, which makes 50/100/150/200 land as events rather than labels.',
    kicker: 'Direction 06 · Halftone',
    headline: 'The number <em>draws itself</em>.',
    sub: 'One dot per supporter, set as a printed halftone. At twelve it is a scatter; by two hundred it is a number you can read across a room.',
    emptyLine: 'Nothing to print with. The first gift lays the first dot.',
    seed: 71,
    theme: {
      bg: '#12100f', fg: '#faf7f2', muted: 'rgba(250,247,242,.5)',
      line: 'rgba(250,247,242,.15)', accent: '#e01b41',
      node: '#faf7f2', edge: 'transparent', cardBg: '#12100f',
      'bg-image': 'radial-gradient(74% 66% at 50% 50%, rgba(224,27,65,.2) 0%, transparent 66%)'
    },
    layout: function (donors, W, H, rnd) {
      var nodes = [];
      var n = donors.length;
      /* The cell scales with the population so the numeral stays filled: a
         fixed grid would leave 12 supporters as three stray dots in a corner
         instead of a small, complete number. */
      var cell = Math.max(11, Math.min(46, Math.sqrt((W * H * 0.16) / Math.max(1, n))));
      var cells = A.halftoneCells(String(n), W, H, cell, { heightFrac: 0.62, widthFrac: 0.8 });
      var picked = A.thin(cells, n);
      donors.forEach(function (d, i) {
        var c = picked[i] || { x: W / 2, y: H / 2, cov: 1 };
        nodes.push({
          d: d, x: c.x, y: c.y,
          r: Math.max(1.6, (cell / 2) * (0.42 + c.cov * 0.6))
        });
      });
      return { nodes: nodes, edges: [], decor: [] };
    },
    drawNode: function (g, n) {
      A.attrs(A.svgEl('circle', g), { r: n.r + 5, 'class': 'node-halo' });
      A.attrs(A.svgEl('circle', g), { r: n.r, 'class': 'node-dot' });
    }
  };

  /* ── 6 · Concentric ripples ───────────────────────────────────────────
     Kept from the previous round — the restraint is the reason it works.
     Arrival order as the organizing principle, so a bi-weekly upload has a
     visible, recurring effect on the shape. */
  var ripple = {
    id: 'ripple', num: 7, family: 'network',
    compose: 'tl', bleed: 1.46,
    name: 'Donor Honor Roll',
    metaphor: 'Concentric ripples',
    why: 'Laid out by when you gave, so each upload visibly pushes the network outward. The milestones land as completed rings rather than as a number changing.',
    kicker: 'Direction 07 · Ripple',
    headline: 'It started with <em>one gift</em>, and moved outward.',
    sub: 'Rings are arrival order — the centre gave first. Every upload adds to the outer edge, so the shape of the network is a record of how it grew.',
    emptyLine: 'Still water. The first gift is the stone.',
    seed: 89,
    theme: {
      bg: '#f6f3f1', fg: '#1e1a1b', muted: 'rgba(30,26,27,.55)',
      line: 'rgba(30,26,27,.15)', accent: '#a41034',
      node: '#1e1a1b', edge: 'rgba(30,26,27,.12)', cardBg: '#1e1a1b',
      'bg-image': 'radial-gradient(48% 62% at 50% 50%, rgba(164,16,52,.14) 0%, rgba(164,16,52,.03) 45%, transparent 72%)'
    },
    layout: function (donors, W, H, rnd) {
      var nodes = [], edges = [], decor = [];
      var cx = W / 2, cy = H / 2;
      var maxR = Math.min(W, H) * 0.44;
      var ringOf = function (i) { return Math.floor(Math.sqrt(i * 1.35)); };
      var maxRing = ringOf(Math.max(1, donors.length - 1));

      for (var r = 1; r <= maxRing; r++) {
        var t = r / maxRing;
        decor.push({
          tag: 'ellipse', cls: 'ripple-ring',
          attrs: {
            cx: cx, cy: cy, rx: (maxR * t) * 1.55, ry: maxR * t,
            'stroke-opacity': (0.5 - t * 0.34).toFixed(3),
            'stroke-width': (1.5 - t * 0.9).toFixed(2)
          }
        });
      }
      decor.push({ tag: 'circle', cls: 'origin-glow', attrs: { cx: cx, cy: cy, r: 26 } });
      decor.push({ tag: 'circle', cls: 'origin-ring', attrs: { cx: cx, cy: cy, r: 13 } });
      decor.push({
        tag: 'text', cls: 'origin-label', text: 'THE FIRST GIFT',
        attrs: { x: cx, y: cy + 40, 'text-anchor': 'middle' }
      });

      donors.forEach(function (d, i) {
        var ring = ringOf(i);
        var rad = maxR * (ring / Math.max(1, maxRing));
        var inRing = i - Math.ceil((ring * ring) / 1.35);
        var perRing = Math.max(1, Math.ceil(((ring + 1) * (ring + 1) - ring * ring) / 1.35));
        var a = (inRing / perRing) * TAU + ring * 0.6;
        var x = cx + Math.cos(a) * rad * 1.55;
        var y = cy + Math.sin(a) * rad;
        nodes.push({ d: d, x: x, y: y, r: d.founding ? 4.6 : 3 });
        if (i > 0) {
          edges.push({
            d: path([[cx, cy], [x, y]]), slug: d.slug, cls: 'spoke',
            w: 0.5, op: Math.max(0.05, 0.34 - (ring / maxRing) * 0.26)
          });
        }
      });
      return { nodes: nodes, edges: edges, decor: decor };
    }
  };

  /* ── 7 · Marquee honour roll (off-brief) ──────────────────────────────
     Kept from the previous round. No graph at all — a masthead at poster
     scale, founding names carrying the composition. */
  var marquee = {
    id: 'marquee', num: 8, family: 'off-brief',
    /* The off-brief pair get descriptive labels rather than one of Nicole's
       five candidates: each of hers is carried by exactly one direction, so a
       name can be judged in place instead of appearing twice. */
    name: 'The Names',
    metaphor: 'Marquee typography',
    why: 'Deliberately off-brief: no nodes, no lines, type doing all the work at poster scale. Tests whether the network metaphor is earning its keep.',
    kicker: 'Direction 08 · Off-brief',
    headline: 'Just the <em>names</em>.',
    sub: 'No diagram. The connections are implied by the company you keep on the page — the oldest version of a donor wall, at full volume.',
    emptyLine: 'A blank masthead, waiting for the first name.',
    seed: 101,
    theme: {
      bg: '#141011', fg: '#ffffff', muted: 'rgba(255,255,255,.5)',
      line: 'rgba(255,255,255,.14)', accent: '#e01b41',
      node: '#ffffff', edge: 'transparent', cardBg: '#141011',
      'bg-image': 'radial-gradient(70% 55% at 12% -8%, rgba(224,27,65,.26) 0%, transparent 62%)'
    },
    custom: function (container, state, api) {
      var host = container.querySelector('.viz-custom');
      if (!host) host = api.el('div', 'viz-custom marquee-wrap', container);
      host.innerHTML = '';
      state.nodes = []; state.byslug = {}; state.edgesOf = {};
      api.visibleDonors(state.count).forEach(function (d) {
        var s = api.el('span', 'marquee-name' + (d.founding ? ' is-founding' : '')
          + (d.anonymous ? ' is-anon' : ''), host);
        s.textContent = api.displayName(d);
        var n = { d: d, g: s };
        state.nodes.push(n);
        state.byslug[d.slug] = n;
        if (state.mode !== 'preview' && !d.anonymous) {
          s.style.cursor = 'pointer';
          s.addEventListener('click', function () { api.focus(state, d.slug); });
        }
      });
    }
  };

  /* ── 8 · Strata (off-brief) ───────────────────────────────────────────
     Off-brief the other way: no graph, no rim, no scatter. The schools stack
     as bands whose depth is how many people came from each — a designed
     stratigraphy rather than a bar chart, with the supporters' own reasons
     set alongside. */
  var strata = {
    id: 'strata', num: 9, family: 'off-brief',
    compose: 'tr', bleed: 1.0,
    name: 'Who Showed Up',
    metaphor: 'Stacked strata',
    why: 'Off-brief the other way: the schools stack as bands, deepest first, each band made of its own supporters. Reads as a poster of who showed up rather than as a chart of it.',
    kicker: 'Direction 09 · Off-brief',
    headline: 'Who actually <em>showed up</em>.',
    sub: 'One band per school, deepest first, each built from the people in it. The only direction whose shape comes straight out of the spreadsheet.',
    emptyLine: 'No strata yet. The first gift lays down the first band.',
    seed: 127,
    theme: {
      bg: '#faf8f5', fg: '#1e1a1b', muted: 'rgba(30,26,27,.55)',
      line: 'rgba(30,26,27,.12)', accent: '#a41034',
      node: '#1e1a1b', edge: 'transparent', cardBg: '#1e1a1b',
      'bg-image': 'linear-gradient(180deg, rgba(164,16,52,.08) 0%, transparent 40%)'
    },
    custom: function (container, state, api) {
      var host = container.querySelector('.viz-custom');
      if (!host) host = api.el('div', 'viz-custom strata-wrap', container);
      host.innerHTML = '';
      state.nodes = []; state.byslug = {}; state.edgesOf = {};
      var donors = api.visibleDonors(state.count);
      var schools = api.schools(donors);
      var names = Object.keys(schools).sort(function (a, b) {
        return schools[b].length - schools[a].length;
      });
      var top = names.length ? schools[names[0]].length : 1;

      names.forEach(function (s, i) {
        var m = schools[s];
        var band = api.el('div', 'strat', host);
        /* Band depth is the count, so the picture is the distribution — the
           thing a reader would otherwise have to add up from a legend. */
        band.style.flexGrow = String(m.length);
        band.style.setProperty('--shade', (0.1 + (1 - i / Math.max(1, names.length)) * 0.72).toFixed(3));

        var lab = api.el('div', 'strat-label', band);
        api.el('span', 'strat-name', lab).textContent = api.shortSchool(s);
        api.el('span', 'strat-count', lab).textContent = m.length;

        var lane = api.el('div', 'strat-lane', band);
        m.forEach(function (d) {
          var t = api.el('span', 'strat-tick' + (d.founding ? ' is-founding' : '')
            + (d.anonymous ? ' is-anon' : ''), lane);
          t.title = api.displayName(d);
          var n = { d: d, g: t };
          state.nodes.push(n);
          state.byslug[d.slug] = n;
          if (state.mode !== 'preview' && !d.anonymous) {
            t.style.cursor = 'pointer';
            t.addEventListener('click', function () { api.focus(state, d.slug); });
          }
        });
      });

      var quote = donors.filter(function (d) { return d.note && !d.anonymous; }).slice(-1)[0];
      if (quote && state.mode !== 'preview') {
        var q = api.el('blockquote', 'strat-quote', host);
        api.el('p', null, q).textContent = '“' + quote.note + '”';
        api.el('cite', null, q).textContent = quote.name + ' · ' + api.shortSchool(quote.school)
          + ' ’' + String(quote.gradYear).slice(2);
      }
    }
  };

  window.HIT_VARIATIONS = [grid, letterform, weave, oneline, bloom, halftone, ripple, marquee, strata];
})();

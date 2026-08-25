// Pure, framework-free rules behind The Momentum Network — the visualization
// that replaces the donor recognition wall on /donate.
//
// No `fs`, no Astro imports, no DOM: the layout, the search and the
// selected-node detail all unit-test directly, the same shape `./donors.ts` and
// `./sectionGroups.ts` already take. The DOM wiring that draws this lives in
// `./momentumNetworkDom.ts`, in the `./donorFilter.ts` mould.
//
// Anonymity is NOT re-implemented here. Every reader-facing field comes from
// `donorPublicIdentity` / `donorDisplayName` in `./donors.ts`, which is the one
// tested authority for what an anonymous supporter withholds. A second copy of
// that rule is a copy that eventually disagrees, and the failure mode is
// publishing something against an explicit request.

import {
  donorDisplayName,
  donorPublicIdentity,
  resolveSchool,
  HARVARD_SCHOOLS,
  type DonorLike,
} from './donors';

/**
 * The palette, exactly as the design direction specifies it.
 *
 * Named rather than inlined in the component because three of the four carry a
 * MEANING that the CSS alone would not record: crimson is a supporter, teal is
 * the connection between them, gold is the one node currently under the
 * pointer or selected. The direction also rules colours OUT — no magenta,
 * purple or cobalt — which is a constraint a future edit can only respect if it
 * can see the whole palette in one place.
 */
export const NETWORK_COLORS = {
  /** Near-black — the ground the whole grid sits on.
   *
   *  Moved off the earlier deep navy for the reference design. The warning this
   *  module already carried still applies, and is why the blooms stay dim:
   *  crimson bloomed at low opacity mixes toward the purple-magenta wash the
   *  direction rules out by name. Black lowers that risk; it does not remove it. */
  background: '#07070A',
  /** Harvard burgundy/crimson — a supporter. */
  node: '#A51034',
  /** Teal — the connections, and the energy moving along them. */
  edge: '#04979E',
  /** Gold — selected, hovered, or newly activated. Never more than a few at once. */
  active: '#F6C76B',
} as const;

/**
 * The logical canvas every layout is computed in.
 *
 * Fixed rather than measured so the layout is resolution-independent: the SVG
 * scales it with a viewBox, which means the same supporters produce the same
 * picture on a phone and a 4K monitor, and a captured screenshot stays valid
 * when the container width changes.
 */
export const NETWORK_VIEWBOX = { width: 1000, height: 620 } as const;

/** Roughly the area one supporter occupies, in viewBox units.
 *
 *  This single number is what makes the network read as a NETWORK. Whether a
 *  picture looks like "dense digital infrastructure" or like "stars floating in
 *  space" is not decided by colour — it is the ratio of node size to the gap
 *  between nodes. Hold that ratio fixed and the design reads correctly at every
 *  scale; let the canvas stay fixed while the count varies and it degrades into
 *  a constellation exactly when the campaign is youngest and the page matters
 *  most. ~52 units between neighbours against a ~4 unit node is the ratio the
 *  direction's density was composed at. */
const AREA_PER_SUPPORTER = 2900;

/** The canvas proportions — the reference design's wide cinematic band. */
const NETWORK_ASPECT = 2.2;

/**
 * The floor on the drawn field, and the fix for the density bug.
 *
 * This used to be 340, which is smaller than the box any realistic campaign
 * produces, so it read as a harmless guard against one supporter rendering as
 * one enormous disc. It was not harmless. `networkViewBox` returns ~348 units
 * at nineteen supporters, so the field sat AT the floor — and the SVG draws
 * with `preserveAspectRatio="xMidYMid slice"`, which crops that tiny box and
 * magnifies it to cover a full-bleed stage. The result was a fraction of an
 * already-small network, blown up: oversized dots with canyons between them,
 * which is what the band actually looked like on /donate.
 *
 * Raised to the design canvas itself. The frame is now the composition's at
 * every count, real supporters spread across it, and `ambientField` fills the
 * space they do not yet occupy. The original concern is still handled — one
 * supporter in a 1100-unit frame is one small light, which is correct.
 */
const MIN_VIEWBOX_WIDTH = 1100;

/**
 * The viewBox for a network of `count` supporters.
 *
 * Grows with the square root of the count, so the SPACING between supporters
 * stays constant while the picture gets bigger — 19 supporters fill their frame
 * as densely as 200 fill theirs. The SVG scales whatever it is given to the
 * container, so a smaller box simply means each supporter is drawn larger on
 * screen, which is the correct answer for a young campaign: fewer people,
 * shown bigger, still connected.
 *
 * This is also what satisfies "fill the central canvas" and "avoid large empty
 * areas" without special-casing either — a canvas sized to its contents has no
 * room left over to be empty.
 */
export function networkViewBox(count: number): { width: number; height: number } {
  if (count <= 0) return { ...NETWORK_VIEWBOX };
  const area = count * AREA_PER_SUPPORTER;
  const width = Math.max(MIN_VIEWBOX_WIDTH, Math.round(Math.sqrt(area * NETWORK_ASPECT)));
  return { width, height: Math.round(width / NETWORK_ASPECT) };
}

/**
 * One unlit point in the field. NOT a supporter, and deliberately not shaped
 * like one — no slug, no school, no `selectable`, no `founding`. There is
 * nothing here for a consumer to mistake for a person, which is the point: the
 * type itself is the first line of the honesty guarantee.
 */
export interface AmbientPoint {
  x: number;
  y: number;
  r: number;
}

/** A filament between two ambient points, in absolute coordinates.
 *
 *  Coordinates rather than indices, unlike `NetworkEdge`. A supporter edge is
 *  indexed because the DOM has to find the two nodes it joins and light them;
 *  nothing ever looks one of these up, so carrying indices would only invite a
 *  future reader to think it could. */
export interface AmbientEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** The unlit field, drawn and wired. */
export interface AmbientField {
  points: AmbientPoint[];
  edges: AmbientEdge[];
}

/** Area per point in the unlit field, well below `AREA_PER_SUPPORTER`.
 *
 *  The field is what carries the reference design's density, and it has to be
 *  denser than the supporters ever are: the picture reads as a lattice, and a
 *  lattice needs enough points that each one's neighbours are CLOSE. At the
 *  supporter spacing the same field reads as scattered dots with long lines
 *  strung between them — which is the look this whole change exists to fix. */
const AREA_PER_AMBIENT = 850;

/**
 * The unlit points behind the real supporters.
 *
 * The campaign starts empty and will hold a few dozen people for a long while,
 * and the reference design is a FIELD — its impact comes from density. Drawing
 * nineteen lights in a frame composed for two hundred does not read as a young
 * network; it reads as a broken graphic. So the frame is filled: real
 * supporters draw bright with a bloom, and these draw dim, small and flat
 * behind them.
 *
 * The honesty of that is structural rather than a matter of styling restraint.
 * These points carry no identity, appear in no detail record and no search
 * haystack, are absent from the supporter roll, and are NEVER counted — the
 * count on the page reads `donors.length`. A reader can see there is a field;
 * nothing tells them the field is people.
 *
 * They also RECEDE. The target is a constant density, so the number returned is
 * the frame's capacity minus the supporters already in it: at nineteen
 * supporters most of the field is ambient, and as real gifts arrive the ambient
 * points give way to them one for one until, at campaign scale, there are none
 * left. The picture fills with actual people over time rather than staying
 * padded forever.
 */
export function ambientField(
  realCount: number,
  width: number,
  height: number,
  rnd: () => number,
): AmbientField {
  const capacity = Math.round((width * height) / AREA_PER_AMBIENT);
  const needed = Math.max(0, capacity - Math.max(0, realCount));
  if (needed === 0) return { points: [], edges: [] };

  // A jittered grid rather than uniform random placement. Random points clump
  // and leave holes — at this density that reads as a mistake in the artwork
  // rather than as a field, and the holes are exactly the "large empty areas"
  // the direction rules out. A grid with each point knocked off its cell centre
  // keeps the spacing even while never looking ruled.
  const cols = Math.max(2, Math.round(Math.sqrt(needed * (width / height))));
  const rows = Math.max(2, Math.ceil(needed / cols));
  const cellWidth = width / cols;
  const cellHeight = height / rows;

  const points: AmbientPoint[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      points.push({
        x: (col + 0.5) * cellWidth + (rnd() - 0.5) * cellWidth * 0.8,
        y: (row + 0.5) * cellHeight + (rnd() - 0.5) * cellHeight * 0.8,
        // Varied so the field has depth instead of reading as one flat screen
        // of identical dots. Still under a supporter's 3.2 — but not by much,
        // because in the reference the unlit points are the same SIZE as the
        // lit ones and it is the glow, not the diameter, that separates them.
        r: 1.3 + rnd() * 1.1,
      });
    }
  }

  // Wired along the grid — right and down — rather than by nearest-neighbour
  // search. The jitter is smaller than a cell, so a point's grid neighbours ARE
  // its nearest ones, which means an O(n) walk produces the same lattice a
  // distance sort would at a fraction of the cost. That matters: the field runs
  // to several hundred points, and this is computed on every render.
  const edges: AmbientEdge[] = [];
  const at = (row: number, col: number) => points[row * cols + col];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const from = at(row, col);
      if (col + 1 < cols) {
        const to = at(row, col + 1);
        edges.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y });
      }
      if (row + 1 < rows) {
        const to = at(row + 1, col);
        edges.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y });
      }
      // One diagonal per cell, so the lattice reads as triangulated rather than
      // as graph paper. Alternating direction by parity keeps it from becoming
      // a visible corduroy of parallel lines running one way across the field.
      if (row + 1 < rows && col + 1 < cols) {
        const down = (row + col) % 2 === 0;
        const to = down ? at(row + 1, col + 1) : at(row + 1, col);
        const start = down ? from : at(row, col + 1);
        edges.push({ x1: start.x, y1: start.y, x2: to.x, y2: to.y });
      }
    }
  }

  return { points, edges };
}

/** Short labels for the node panel, keyed on the values `HARVARD_SCHOOLS` holds.
 *
 *  The panel prints the school beside a graduation year in a narrow column, and
 *  "Harvard John A. Paulson School of Engineering and Applied Sciences" is 66
 *  characters — it wraps to three lines and pushes the year out of view. The
 *  STORED value stays the full name (it is what the search matches and what the
 *  CMS offers); this is a display concern only.
 *
 *  Deliberately rebuilt against `HARVARD_SCHOOLS` rather than reused from the
 *  design exploration's `donorNetwork.js`, whose keys ('Harvard SEAS', 'Harvard
 *  GSD', 'Harvard Chan School') are names that list does not contain — every
 *  lookup there would miss and print the long name anyway.
 */
export const SCHOOL_SHORT_LABELS: Record<string, string> = {
  'Harvard College': 'College',
  'Harvard Business School': 'HBS',
  'Harvard Law School': 'HLS',
  'Harvard Medical School': 'HMS',
  'Harvard Kennedy School': 'HKS',
  'Harvard Graduate School of Design': 'GSD',
  'Harvard Graduate School of Education': 'GSE',
  'Harvard Division of Continuing Education': 'DCE',
  'Harvard Divinity School': 'HDS',
  'Harvard T.H. Chan School of Public Health': 'Chan',
  'Harvard School of Dental Medicine': 'HSDM',
  'Harvard John A. Paulson School of Engineering and Applied Sciences': 'SEAS',
  'Harvard Graduate School of Arts and Sciences': 'GSAS',
};

/**
 * The short label for a school, or `undefined` when there is no school.
 *
 * Falls back to the value as given rather than to nothing: a school that
 * predates this map still prints, just at full length. Losing the school
 * entirely would be worse than printing it long.
 */
export function shortSchoolLabel(school?: string): string | undefined {
  const resolved = resolveSchool(school);
  if (resolved) return SCHOOL_SHORT_LABELS[resolved] ?? resolved;
  const trimmed = school?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

/**
 * A headline with `*asterisked*` runs turned into `<em>`, everything else
 * escaped.
 *
 * The band's heading wants one emphasised phrase in a different colour — "A
 * grid, *lit from within*." — and the heading is a single CMS string. The
 * alternatives were both worse: splitting it into two fields makes an editor
 * assemble a sentence out of parts and forbids them moving the emphasis, and
 * hardcoding the span in the component takes the heading away from the CMS
 * entirely, which is the thing several plans on this page exist to prevent.
 *
 * Escaping runs FIRST and on the whole string, so the only markup that can
 * reach the page is the `<em>` this function puts there. The value is
 * repo-committed rather than user-submitted, which lowers the stakes but does
 * not remove them — a CMS writes this field, and `set:html` is a loaded gun
 * pointed at whatever it is handed.
 */
export function headlineHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  // Non-greedy, and refuses to span an asterisk, so an unclosed `*` is left as
  // a literal asterisk rather than swallowing the rest of the heading.
  return escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

/** One supporter, placed. */
export interface NetworkNode {
  slug: string;
  /** Position in `NETWORK_VIEWBOX` space. */
  x: number;
  y: number;
  /** Drawn radius. Founding supporters read larger and brighter. */
  r: number;
  founding: boolean;
  /** Whether a pointer can open this node's panel — false for anonymous. */
  selectable: boolean;
  /** The resolved school, or `undefined`. Drives clustering, not display. */
  school?: string;
}

/** One connection. Indices into the node list, so an edge cannot outlive a node. */
export interface NetworkEdge {
  a: number;
  b: number;
}

export interface NetworkLayout {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
}

/**
 * Seeded PRNG (mulberry32).
 *
 * The layout MUST be reproducible. A network that reshuffles on every render is
 * a different picture each time a visitor loads the page, and — more
 * practically — a screenshot the team has already reviewed would stop matching
 * what ships. Same supporters in, same picture out.
 */
export function networkRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Where each school's cluster sits on the canvas.
 *
 * Laid on a grid sized to the number of schools present and then jittered, so
 * the clusters read as organic rather than as a table of dots. The grid is what
 * guarantees the direction's "fill the central canvas / no large empty areas":
 * scattering centres at random reliably leaves a bare corner and crowds
 * somewhere else, which is the thing the brief rules out.
 *
 * Bigger schools are placed first, so when the count does not divide evenly the
 * densest clusters take the interior cells rather than the edges.
 */
export function clusterCentres(
  schools: readonly string[],
  width: number,
  height: number,
  rnd: () => number,
): Record<string, [number, number]> {
  const centres: Record<string, [number, number]> = {};
  if (schools.length === 0) return centres;

  // Phyllotaxis — the spiral a sunflower packs its seeds on — rather than a
  // grid. A grid of `ceil(sqrt(n))` columns leaves its last row part-empty
  // whenever the count is not a perfect square, and with thirteen schools that
  // is a visibly bare corner: precisely the "large empty area" the direction
  // rules out. The golden angle instead fills the ellipse evenly at ANY count,
  // and fills it without the rows and columns a grid leaves legible in the
  // finished picture — which is also what "organic" asks for.
  const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
  // Centred. An earlier pass biased this right to keep supporters out from under
  // a copy column that overlaid the artwork; the copy now lives in its own band
  // above the graphic, so the whole frame is the picture's again and anything
  // other than centred would leave the dead margin the direction rules out.
  const cx = width / 2;
  const cy = height / 2;
  const radiusX = width * 0.41;
  const radiusY = height * 0.41;

  schools.forEach((school, i) => {
    // sqrt on the radius is what makes the fill EVEN — without it the seeds
    // crowd the centre and thin toward the edge.
    const r = Math.sqrt((i + 0.5) / schools.length);
    const theta = i * GOLDEN_ANGLE;
    const x = cx + Math.cos(theta) * r * radiusX + (rnd() - 0.5) * width * 0.05;
    const y = cy + Math.sin(theta) * r * radiusY + (rnd() - 0.5) * height * 0.05;
    centres[school] = [x, y];
  });

  return centres;
}

/**
 * The schools present among these supporters, densest first.
 *
 * Reads through `resolveSchool` so a hand-edited or seeded value in the wrong
 * case still lands in its real cluster instead of founding a cluster of one.
 */
export function schoolsPresent(donors: readonly DonorLike[]): string[] {
  const counts = new Map<string, number>();
  for (const donor of donors) {
    const school = resolveSchool(donor.school);
    if (!school) continue;
    counts.set(school, (counts.get(school) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || HARVARD_SCHOOLS.indexOf(a[0] as never) - HARVARD_SCHOOLS.indexOf(b[0] as never))
    .map(([school]) => school);
}

/**
 * Every supporter placed on the canvas.
 *
 * A supporter sits in their school's cluster, at a jittered offset scaled to how
 * many share it — so a large school spreads rather than piling its members on
 * one point. A supporter with NO school is not dropped and not hidden in a
 * corner: they are placed across the middle of the canvas, where the clusters
 * overlap, so they wire into the network like everyone else. Their gift counts
 * the same, and a visualization that quietly omitted them would undercount the
 * community it exists to show.
 */
export function placeNodes(
  donors: readonly DonorLike[],
  centres: Record<string, [number, number]>,
  width: number,
  height: number,
  rnd: () => number,
): NetworkNode[] {
  const perSchool = new Map<string, number>();
  for (const donor of donors) {
    const school = resolveSchool(donor.school);
    if (school) perSchool.set(school, (perSchool.get(school) ?? 0) + 1);
  }

  return donors.map((donor) => {
    const school = resolveSchool(donor.school);
    const centre = school ? centres[school] : undefined;
    const founding = donor.founding === true;

    let x: number;
    let y: number;

    if (centre) {
      // Spread scales with the square root of the cluster size — linear scaling
      // makes a big school swallow its neighbours, and no scaling makes it a
      // blob — and is expressed as a FRACTION of the canvas, because the canvas
      // itself now grows with the supporter count. An absolute spread tuned at
      // campaign scale would, in a young network's smaller frame, throw every
      // cluster on top of every other.
      const spread = width * (0.035 + Math.sqrt(perSchool.get(school!) ?? 1) * 0.022);
      const angle = rnd() * Math.PI * 2;
      // sqrt on the radius gives an even fill of the disc rather than a ring
      // with a crowded centre.
      const radius = Math.sqrt(rnd()) * spread;
      x = centre[0] + Math.cos(angle) * radius * 1.25;
      y = centre[1] + Math.sin(angle) * radius;
    } else {
      x = width * (0.3 + rnd() * 0.4);
      y = height * (0.28 + rnd() * 0.44);
    }

    return {
      slug: donor.slug,
      x: clamp(x, width * 0.04, width * 0.96),
      y: clamp(y, height * 0.06, height * 0.94),
      r: founding ? 4.6 : 3.2,
      founding,
      selectable: isSelectableNode(donor),
      school,
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Connections: every node wired to its `k` nearest neighbours.
 *
 * THE load-bearing decision in this module, and the one the design feedback
 * turns on. The exploration gave each supporter a single line back to their
 * school's junction, which is why it read as "a constellation of stars" — a
 * point with one thread to a hub is a star on a string, not a node. Nearest-
 * neighbour wiring instead produces what the direction asks for: several
 * connections per node, dense webs inside a school, and — because clusters
 * overlap — edges that cross between schools without anyone having to author
 * them.
 *
 * Edges are undirected and deduplicated, so a mutual nearest pair yields ONE
 * connection rather than a double-drawn line that renders visibly brighter than
 * its neighbours and implies a relationship that is not there.
 */
export function nearestNeighborEdges(nodes: readonly NetworkNode[], k = 3): NetworkEdge[] {
  const seen = new Set<string>();
  const edges: NetworkEdge[] = [];

  nodes.forEach((node, i) => {
    const neighbours = nodes
      .map((other, j) => ({ j, d: (other.x - node.x) ** 2 + (other.y - node.y) ** 2 }))
      .filter((entry) => entry.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, k);

    for (const { j } of neighbours) {
      const key = i < j ? `${i}:${j}` : `${j}:${i}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a: Math.min(i, j), b: Math.max(i, j) });
    }
  });

  return edges;
}

/**
 * The whole picture: supporters placed and wired.
 *
 * `seed` is exposed so a scenario can pin a layout it has already been reviewed
 * at. Callers pass donors already draft-filtered by `publishedEntries`.
 */
export function networkLayout(
  donors: readonly DonorLike[],
  options: { width?: number; height?: number; seed?: number; neighbours?: number } = {},
): NetworkLayout & {
  viewBox: { width: number; height: number };
  clusters: NetworkCluster[];
  ambient: AmbientField;
} {
  const box = networkViewBox(donors.length);
  const width = options.width ?? box.width;
  const height = options.height ?? box.height;
  const rnd = networkRng(options.seed ?? 5);

  // Centres are computed HERE and passed down rather than recomputed inside
  // `placeNodes`, so the glow blooms and the supporters they sit under are
  // placed from the same draw of the same seeded stream. Computing them twice
  // would advance the PRNG differently and drift the light away from the people.
  const schools = schoolsPresent(donors);
  const centres = clusterCentres(schools, width, height, rnd);
  const nodes = placeNodes(donors, centres, width, height, rnd);
  // Four, not three: the direction asks each node to "connect to several
  // surrounding nodes". Three produces a spanning web with visible chains in it;
  // four closes those chains into the overlapping clusters the brief describes,
  // and is still short of the point where every node reaches across the canvas
  // and the whole thing turns into a mesh.
  return {
    nodes,
    edges: nearestNeighborEdges(nodes, options.neighbours ?? 4),
    viewBox: { width, height },
    clusters: schools.map((school) => {
      const members = nodes.filter((node) => node.school === school).length;
      return {
        x: centres[school][0],
        y: centres[school][1],
        // Square-rooted so a large school glows WIDER but not proportionally
        // brighter — the light is a hint of where people gather, not a chart.
        // Kept modest: a bloom much wider than the cluster it sits under stops
        // reading as that cluster's light and becomes fog over the whole band.
        r: width * (0.035 + Math.sqrt(members) * 0.018),
      };
    }),
    // Drawn LAST from the shared stream, so adding the field cannot shift a
    // single supporter or bloom that was placed before it — the reviewed
    // picture stays the picture.
    ambient: ambientField(nodes.length, width, height, rnd),
  };
}

/** A soft bloom of light under a cluster. Decorative — it carries no data a
 *  reader has to decode, and nothing is labelled by it. */
export interface NetworkCluster {
  x: number;
  y: number;
  r: number;
}

/**
 * Whether a node can be opened into the supporter panel.
 *
 * An anonymous supporter is a node — their gift strengthens the network and
 * withholding it would make the picture undercount people who asked only not to
 * be named — but the panel prints a school, a graduation year and a location,
 * and that trio identifies someone in a community this size about as surely as
 * their name. So the node is drawn and counted, and it does not open.
 */
export function isSelectableNode(donor: DonorLike): boolean {
  return donor.anonymous !== true;
}

/** What the panel shows for the selected supporter. */
export interface NetworkNodeDetail {
  name: string;
  school?: string;
  gradYear?: number;
  location?: string;
  /** 'Founding Supporter', or the giving level for everyone else. */
  standing?: string;
}

/** The standing line: the badge the direction names, or the level they gave at. */
export const FOUNDING_SUPPORTER_LABEL = 'Founding Supporter';

/**
 * The panel content for a supporter.
 *
 * Every identity field is read through `donorPublicIdentity`, so anonymity is
 * applied once, upstream, rather than re-checked here. `standing` is the one
 * addition: the direction treats every node as a Founding Supporter, but the
 * giving levels survived the data-model plan, so a supporter without the badge
 * shows the level they actually gave at instead of an empty line.
 */
export function networkNodeDetail(
  donor: DonorLike,
  tierName?: string,
): NetworkNodeDetail {
  const identity = donorPublicIdentity(donor);
  return {
    name: identity.name,
    school: shortSchoolLabel(identity.school),
    gradYear: identity.gradYear,
    location: identity.location,
    standing: donor.founding === true ? FOUNDING_SUPPORTER_LABEL : tierName,
  };
}

/**
 * Whether a supporter matches the "find your place in the network" search.
 *
 * Matches on school and location only — the two axes the direction names. Case-
 * and whitespace-insensitive substring, so "london" finds "London, United
 * Kingdom" and "hbs" finds nothing while "business" finds Harvard Business
 * School. The school is matched against BOTH the stored full name and its short
 * label, because a supporter who knows themselves as "SEAS" should not have to
 * type "John A. Paulson".
 *
 * An anonymous supporter never matches, whatever the query. That is the same
 * rule `isSelectableNode` states, applied to the other way in: a search box that
 * confirmed "yes, someone from Harvard Law School class of 1998 in Greenwich
 * gave" would undo the anonymity the node itself protects.
 *
 * A blank query matches EVERYONE — the resting state of the search box is not a
 * filter, so an empty field must not empty the network.
 */
export function matchesNetworkSearch(donor: DonorLike, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return true;
  // Belt and braces. `donorPublicIdentity` below already withholds every field
  // this matches on, so today this line changes no outcome — it is here because
  // the haystack is the kind of thing a later change extends (a name, a note),
  // and the moment it does, this is what keeps the search from becoming a way
  // to confirm who gave.
  if (!isSelectableNode(donor)) return false;

  const identity = donorPublicIdentity(donor);
  const haystacks = [
    identity.school,
    shortSchoolLabel(identity.school),
    identity.location,
  ];

  return haystacks.some((value) => value !== undefined && value.toLowerCase().includes(needle));
}

/**
 * The supporters a query selects, in input order.
 *
 * Returns everyone for a blank query rather than nobody, matching
 * `matchesNetworkSearch` — the distinction that makes the search a highlight
 * rather than a destructive filter.
 */
export function searchNetwork<T extends DonorLike>(
  donors: readonly T[],
  query: string,
): T[] {
  return donors.filter((donor) => matchesNetworkSearch(donor, query));
}

/**
 * The line under the search box reporting what a query found.
 *
 * Says "no supporters" rather than "0 results" for the miss, because the miss is
 * a real answer on this page — a visitor searching their own school before
 * anyone from it has given should read a sentence, not a count of nothing.
 */
export function searchSummary(matches: number, query: string): string | undefined {
  if (query.trim().length === 0) return undefined;
  if (matches === 0) return 'No supporters here yet — yours would be the first.';
  return matches === 1 ? '1 supporter in the network' : `${matches} supporters in the network`;
}

/**
 * The names to print beneath the canvas, alphabetically by displayed name.
 *
 * The visualization is an SVG built by script; with JavaScript off it is an
 * empty frame. The wall this replaces was static HTML with every name under a
 * real heading, so shipping the canvas alone would delete every supporter from
 * the page for anyone without JavaScript or reading with a screen reader. This
 * list is what keeps the recognition — the point of the whole band — independent
 * of whether the graphic runs.
 *
 * Sorted by the DISPLAYED name for the reason `groupDonorsByTier` already
 * documents: sorting anonymous entries by their withheld real name breaks the
 * alphabetical run exactly where they sit and hints at the hidden first letter.
 */
export function supporterRoll<T extends DonorLike>(donors: readonly T[]): T[] {
  return [...donors].sort((a, b) => donorDisplayName(a).localeCompare(donorDisplayName(b)));
}

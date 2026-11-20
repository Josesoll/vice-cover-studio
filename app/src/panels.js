// panels.js — Vice Cover Studio panel layouts.
// Every layout is a set of polygons in relative (0..1) space. The shapes lean
// on strong diagonals, the way bold game posters slice a scene into wedges.
// getLayout scales the polygons to real pixels for whatever canvas aspect is
// in use, so the same layout reads well square, portrait or landscape.

export const LAYOUTS = [
  { id: 'wedge', name: 'Classic Wedge', blurb: 'Four diagonal wedges' },
  { id: 'story', name: 'Cover Story', blurb: 'Big hero + three beats' },
  { id: 'sixpack', name: 'Six Pack', blurb: 'Six stacked moments' },
  { id: 'duo', name: 'Duo', blurb: 'Two-scene split' },
];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Relative polygon sets. Each builder receives the canvas aspect (w / h) and
// nudges its seams: wide canvases push the vertical seams outward, tall
// canvases give the hero more height.
const BUILDERS = {
  wedge(aspect) {
    const s = aspect >= 1 ? 0.1 : 0.06; // diagonal lean
    const mx = aspect >= 1 ? 0.56 : 0.52;
    return [
      [[0, 0], [0.64, 0], [mx, 0.52], [0, 0.56]],
      [[0.64, 0], [1, 0], [1, 0.46], [mx, 0.52]],
      [[0, 0.56], [mx, 0.52], [mx - s, 1], [0, 1]],
      [[mx, 0.52], [1, 0.46], [1, 1], [mx - s, 1]],
    ];
  },
  story(aspect) {
    const edge = aspect >= 1 ? 0.6 : 0.56;
    const lean = 0.07;
    return [
      [[0, 0], [edge, 0], [edge - lean, 1], [0, 1]],
      [[edge, 0], [1, 0], [1, 0.34], [edge - lean * 0.4, 0.36]],
      [[edge - lean * 0.4, 0.36], [1, 0.34], [1, 0.67], [edge - lean * 0.75, 0.69]],
      [[edge - lean * 0.75, 0.69], [1, 0.67], [1, 1], [edge - lean, 1]],
    ];
  },
  sixpack(aspect) {
    const mid = aspect >= 1 ? 0.52 : 0.5;
    const lean = 0.045;
    const rows = [[0, 0.335], [0.335, 0.67], [0.67, 1]];
    const out = [];
    rows.forEach(([y0, y1], r) => {
      const dir = r % 2 === 0 ? 1 : -1;
      out.push([[0, y0], [mid + lean * dir, y0], [mid, y1], [0, y1]]);
      out.push([[mid + lean * dir, y0], [1, y0], [1, y1], [mid, y1]]);
    });
    return out;
  },
  duo(aspect) {
    const lean = aspect >= 1 ? 0.14 : 0.1;
    return [
      [[0, 0], [1, 0], [1, 0.5 - lean / 2], [0, 0.5 + lean / 2]],
      [[0, 0.5 + lean / 2], [1, 0.5 - lean / 2], [1, 1], [0, 1]],
    ];
  },
};

/** Panels for layout `id` on a w x h canvas: pixel polygons with centres. */
export function getLayout(id, w, h) {
  const build = BUILDERS[id] || BUILDERS.wedge;
  const rel = build(w / Math.max(1, h));
  return rel.map((pts, i) => {
    const points = pts.map(([x, y]) => ({ x: x * w, y: y * h }));
    const cx = points.reduce((n, p) => n + p.x, 0) / points.length;
    const cy = points.reduce((n, p) => n + p.y, 0) / points.length;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return {
      index: i,
      points,
      cx,
      cy,
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  });
}

/** How many panels a layout has (handy before a canvas size is known). */
export function panelCount(id) {
  return (BUILDERS[id] || BUILDERS.wedge)(1).length;
}

/** True when (x, y) sits inside a polygon given as [{x, y}, ...]. */
export function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    const crosses = a.y > y !== b.y > y;
    if (crosses && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Index of the panel under (x, y), or -1 when the point misses them all. */
export function hitTest(panels, x, y) {
  for (let i = panels.length - 1; i >= 0; i--) {
    if (pointInPolygon(x, y, panels[i].points)) return i;
  }
  return -1;
}

/** A Path2D tracing a panel polygon, ready for ctx.clip() / ctx.stroke(). */
export function panelPath(points) {
  const path = new Path2D();
  points.forEach((p, i) => (i === 0 ? path.moveTo(p.x, p.y) : path.lineTo(p.x, p.y)));
  path.closePath();
  return path;
}

export { clamp };

// src/engine/geometry/wallFaces.ts
import type { Wall, WallNode } from '@/types/wall';
import type { Room, EdgeType } from '@/types/project';

function pos(id: string, nodes: WallNode[]): { x: number; y: number } {
  return nodes.find(n => n.id === id) ?? { x: 0, y: 0 };
}

function shoelaceArea(pts: { x: number; y: number }[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    s += pts[i]!.x * pts[j]!.y - pts[j]!.x * pts[i]!.y;
  }
  return s / 2;
}

/** djb2 hash — stable room ID from sorted node IDs. */
function faceId(nodeIds: string[]): string {
  const s = [...nodeIds].sort().join('\0');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `wf-${h.toString(36)}`;
}

/**
 * Derive Room[] from a wall/node graph using planar half-edge face traversal.
 *
 * Algorithm: for each directed half-edge (u→v), the next edge in the face cycle
 * is the outgoing edge from v with the smallest clockwise angle from the reversed
 * incoming direction (v→u). Interior faces (positive shoelace area in SVG coords)
 * become Room objects. The outer unbounded face (negative area) is discarded.
 *
 * Rooms are computed on the fly and never persisted.
 */
export function wallsToRooms(walls: Wall[], nodes: WallNode[]): Room[] {
  if (walls.length === 0 || nodes.length === 0) return [];

  type HE = { from: string; to: string };
  const halfEdges: HE[] = walls.flatMap(w => [
    { from: w.node1Id, to: w.node2Id },
    { from: w.node2Id, to: w.node1Id },
  ]);

  const out = new Map<string, HE[]>();
  for (const he of halfEdges) {
    if (!out.has(he.from)) out.set(he.from, []);
    out.get(he.from)!.push(he);
  }

  const nextHE = (he: HE): HE | null => {
    const u = pos(he.from, nodes);
    const v = pos(he.to, nodes);
    const θRev = Math.atan2(u.y - v.y, u.x - v.x);
    let best: HE | null = null;
    let bestCw = Infinity;
    for (const e of (out.get(he.to) ?? [])) {
      if (e.to === he.from) continue;
      const w = pos(e.to, nodes);
      const θOut = Math.atan2(w.y - v.y, w.x - v.x);
      const cw = ((θRev - θOut) + 2 * Math.PI) % (2 * Math.PI);
      if (cw < bestCw) { bestCw = cw; best = e; }
    }
    return best;
  };

  const visited = new Set<string>();
  const key = (he: HE) => `${he.from}→${he.to}`;
  type FacePt = { nodeId: string; x: number; y: number };
  const faces: FacePt[][] = [];

  for (const start of halfEdges) {
    if (visited.has(key(start))) continue;
    const cycle: HE[] = [];
    let cur: HE | null = start;
    while (cur && !visited.has(key(cur))) {
      visited.add(key(cur));
      cycle.push(cur);
      cur = nextHE(cur);
    }
    if (cur && key(cur) === key(start) && cycle.length >= 3) {
      faces.push(cycle.map(he => { const p = pos(he.from, nodes); return { nodeId: he.from, x: p.x, y: p.y }; }));
    }
  }

  // Interior faces: positive shoelace area (SVG Y-down: CW winding = positive)
  const interior = faces.filter(pts => shoelaceArea(pts) > 0);

  // Sort top-left → bottom-right for stable naming
  interior.sort((a, b) => {
    const cya = a.reduce((s, p) => s + p.y, 0) / a.length;
    const cyb = b.reduce((s, p) => s + p.y, 0) / b.length;
    if (Math.abs(cya - cyb) > 1) return cya - cyb;
    return (a.reduce((s, p) => s + p.x, 0) / a.length) - (b.reduce((s, p) => s + p.x, 0) / b.length);
  });

  return interior.map((pts, idx) => ({
    id: faceId(pts.map(p => p.nodeId)),
    name: `Pièce ${idx + 1}`,
    points: pts.map(p => ({ x: p.x, y: p.y })),
    edges: pts.map(() => 'WALL' as EdgeType),
    partitions: [],
    excludedZones: [],
  }));
}

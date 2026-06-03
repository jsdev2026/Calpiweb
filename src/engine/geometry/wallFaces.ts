// src/engine/geometry/wallFaces.ts
import type { Wall, WallNode, WallExcludedZone } from '@/types/wall';
import type { Room, EdgeType } from '@/types/project';
import { pointInPolygon } from '@/engine/geometry/polygon';

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
export function wallsToRooms(
  walls: Wall[],
  nodes: WallNode[],
  excludedZones: WallExcludedZone[] = [],
): Room[] {
  if (walls.length === 0 || nodes.length === 0) return [];

  // O(1) lookups; missing-node guard below ensures no undefined access
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Drop walls that reference a node not present in the graph
  const validWalls = walls.filter(w => nodeMap.has(w.node1Id) && nodeMap.has(w.node2Id));

  const getPos = (id: string) => nodeMap.get(id)!;

  type HE = { from: string; to: string };
  const halfEdges: HE[] = validWalls.flatMap(w => [
    { from: w.node1Id, to: w.node2Id },
    { from: w.node2Id, to: w.node1Id },
  ]);

  const out = new Map<string, HE[]>();
  for (const he of halfEdges) {
    if (!out.has(he.from)) out.set(he.from, []);
    out.get(he.from)!.push(he);
  }

  const nextHE = (he: HE): HE | null => {
    const u = getPos(he.from);
    const v = getPos(he.to);
    const θRev = Math.atan2(u.y - v.y, u.x - v.x);
    let best: HE | null = null;
    let bestCw = Infinity;
    for (const e of (out.get(he.to) ?? [])) {
      if (e.to === he.from) continue;
      const w = getPos(e.to);
      const θOut = Math.atan2(w.y - v.y, w.x - v.x);
      const cw = ((θRev - θOut) + 2 * Math.PI) % (2 * Math.PI);
      if (cw < bestCw) { bestCw = cw; best = e; }
    }
    return best;
  };

  const visited = new Set<string>();
  const key = (he: HE) => `${he.from}\x00${he.to}`;
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
      faces.push(cycle.map(he => { const p = getPos(he.from); return { nodeId: he.from, x: p.x, y: p.y }; }));
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

  return interior.map((pts, idx) => {
    const facePts = pts.map(p => ({ x: p.x, y: p.y }));
    const roomZones = excludedZones.filter(zone => {
      if (zone.points.length < 3) return false;
      const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
      const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
      return pointInPolygon({ x: cx, y: cy }, facePts);
    });

    return {
      id: faceId(pts.map(p => p.nodeId)),
      name: `Pièce ${idx + 1}`,
      points: pts.map(p => ({ x: p.x, y: p.y })),
      edges: pts.map(() => 'WALL' as EdgeType),
      partitions: [],
      excludedZones: roomZones,
    };
  });
}

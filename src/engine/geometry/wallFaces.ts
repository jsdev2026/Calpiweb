// src/engine/geometry/wallFaces.ts
import type { Wall, WallNode, WallExcludedZone } from '@/types/wall';
import type { Room, EdgeType } from '@/types/project';
import { pointInPolygon } from '@/engine/geometry/polygon';

/** djb2 hash — stable room ID from sorted node IDs. */
function faceId(nodeIds: string[]): string {
  const s = [...nodeIds].sort().join('\0');
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return `wf-${h.toString(36)}`;
}

export interface FaceCycle {
  nodeIds: string[];
  wallIds: string[]; // wallIds[i] = mur entre nodeIds[i] et nodeIds[(i+1) % n]
}

/** Retire itérativement les murs pendants (nœud de degré 1) jusqu'à stabilité. */
function pruneLeaves(walls: Wall[]): Wall[] {
  let current = walls;
  while (true) {
    const degree = new Map<string, number>();
    for (const w of current) {
      degree.set(w.node1Id, (degree.get(w.node1Id) ?? 0) + 1);
      degree.set(w.node2Id, (degree.get(w.node2Id) ?? 0) + 1);
    }
    const next = current.filter(
      (w) => w.isDoor || (degree.get(w.node1Id) !== 1 && degree.get(w.node2Id) !== 1),
    );
    if (next.length === current.length) return current;
    current = next;
  }
}

/**
 * Retourne tous les cycles de faces intérieures du graphe de murs
 * via traversée half-edge. Gère les T-junctions (nœuds 3+ arêtes).
 */
export function wallFaceCycles(walls: Wall[], nodes: WallNode[]): FaceCycle[] {
  if (walls.length === 0 || nodes.length === 0) return [];

  const coreWalls = pruneLeaves(walls);
  if (coreWalls.length === 0) return [];

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const validWalls = coreWalls.filter(w => nodeMap.has(w.node1Id) && nodeMap.has(w.node2Id));
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

  // Lookup wallId depuis (from, to) en O(1)
  const wallLookup = new Map<string, string>();
  for (const wall of validWalls) {
    wallLookup.set(`${wall.node1Id}\x00${wall.node2Id}`, wall.id);
    wallLookup.set(`${wall.node2Id}\x00${wall.node1Id}`, wall.id);
  }

  const visited = new Set<string>();
  const key = (he: HE) => `${he.from}\x00${he.to}`;
  const cycles: FaceCycle[] = [];

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
      const pts = cycle.map(he => { const p = getPos(he.from); return { x: p.x, y: p.y }; });
      let s = 0;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        s += pts[i]!.x * pts[j]!.y - pts[j]!.x * pts[i]!.y;
      }
      if (s / 2 > 0) {
        cycles.push({
          nodeIds: cycle.map(he => he.from),
          wallIds: cycle.map(he => wallLookup.get(`${he.from}\x00${he.to}`) ?? ''),
        });
      }
    }
  }

  return cycles;
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
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const getPos = (id: string) => { const n = nodeMap.get(id)!; return { x: n.x, y: n.y }; };
  const wallMap = new Map(walls.map(w => [w.id, w]));

  const cycles = wallFaceCycles(walls, nodes);

  // Tri top-left → bottom-right pour nommage stable
  cycles.sort((a, b) => {
    const ptsA = a.nodeIds.map(getPos);
    const ptsB = b.nodeIds.map(getPos);
    const cya = ptsA.reduce((s, p) => s + p.y, 0) / ptsA.length;
    const cyb = ptsB.reduce((s, p) => s + p.y, 0) / ptsB.length;
    if (Math.abs(cya - cyb) > 1) return cya - cyb;
    return (ptsA.reduce((s, p) => s + p.x, 0) / ptsA.length) -
           (ptsB.reduce((s, p) => s + p.x, 0) / ptsB.length);
  });

  return cycles.map((cycle, idx) => {
    const facePts = cycle.nodeIds.map(id => getPos(id));
    const roomZones = excludedZones.filter(zone => {
      if (zone.nodes.length < 3) return false;
      const cx = zone.nodes.reduce((s, n) => s + n.x, 0) / zone.nodes.length;
      const cy = zone.nodes.reduce((s, n) => s + n.y, 0) / zone.nodes.length;
      return pointInPolygon({ x: cx, y: cy }, facePts);
    });
    return {
      id: faceId(cycle.nodeIds),
      name: `Pièce ${idx + 1}`,
      points: facePts,
      edges: cycle.wallIds.map(wid => (wallMap.get(wid)?.isDoor ? 'DOOR' : 'WALL') as EdgeType),
      partitions: [],
      excludedZones: roomZones.map(zone => ({
        id: zone.id,
        points: zone.nodes.map(n => ({ x: n.x, y: n.y })),
        label: zone.label,
      })),
    };
  });
}

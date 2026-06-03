import type { Wall, WallNode, AutoCotation } from '@/types/wall';
import type { Point } from '@/types/plan';
import { computeCornerGeometry } from './wallGeometry';
import { formatCm } from '@/utils/formatters';

// ── Constantes ────────────────────────────────────────────────────────────
const COTE_OFFSET_EXT = 400; // mm depuis la face extérieure
const COTE_OFFSET_INT = 200; // mm depuis la face intérieure, vers l'intérieur
const COTE_OFFSET_ISO = 300; // mm depuis l'axe, mur isolé

// ── Helpers géométriques ──────────────────────────────────────────────────

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function nodePos(id: string, nodes: WallNode[]): Point {
  const n = nodes.find((n) => n.id === id);
  return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
}

function wallDir(wall: Wall, nodes: WallNode[]): Point {
  const p1 = nodePos(wall.node1Id, nodes);
  const p2 = nodePos(wall.node2Id, nodes);
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return len < 1e-10 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
}

// ── detectClosedPolygons ──────────────────────────────────────────────────

/**
 * Trouve les polygones fermés simples dans le graphe de murs.
 * Limitation MVP : abandonne si un nœud a plus d'une arête disponible (T-junction).
 */
export function detectClosedPolygons(
  walls: Wall[],
  _nodes: WallNode[],
): Array<{ wallIds: string[]; nodeIds: string[] }> {
  // Adjacence : nodeId → [{wallId, otherNodeId}]
  const adj = new Map<string, { wallId: string; otherNodeId: string }[]>();
  for (const wall of walls) {
    for (const [from, to] of [[wall.node1Id, wall.node2Id], [wall.node2Id, wall.node1Id]] as [string, string][]) {
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from)!.push({ wallId: wall.id, otherNodeId: to });
    }
  }

  const result: Array<{ wallIds: string[]; nodeIds: string[] }> = [];
  const visitedWalls = new Set<string>();

  for (const wall of walls) {
    if (visitedWalls.has(wall.id)) continue;

    const startNodeId = wall.node1Id;
    const wallIds = [wall.id];
    const nodeIds = [startNodeId];
    let current = wall.node2Id;
    let prev = startNodeId;
    let valid = true;

    while (current !== startNodeId) {
      if (nodeIds.includes(current)) { valid = false; break; }
      nodeIds.push(current);

      const edges = (adj.get(current) ?? []).filter((e) => e.otherNodeId !== prev);
      if (edges.length !== 1 || visitedWalls.has(edges[0]!.wallId)) {
        valid = false; break;
      }

      wallIds.push(edges[0]!.wallId);
      prev = current;
      current = edges[0]!.otherNodeId;

      if (wallIds.length > walls.length) { valid = false; break; }
    }

    if (valid && wallIds.length >= 3) {
      for (const wId of wallIds) visitedWalls.add(wId);
      result.push({ wallIds, nodeIds });
    }
  }

  return result;
}

// ── Helpers internes pour computeAutoCotations ────────────────────────────

/** Détermine si plus est intérieur (côté le plus proche du centroïde). */
function plusIsInterior(
  poly: { points: Point[] },
  centroid: Point,
): boolean {
  const midPlus:  Point = { x: (poly.points[0]!.x + poly.points[1]!.x) / 2,
                             y: (poly.points[0]!.y + poly.points[1]!.y) / 2 };
  const midMinus: Point = { x: (poly.points[2]!.x + poly.points[3]!.x) / 2,
                             y: (poly.points[2]!.y + poly.points[3]!.y) / 2 };
  return dist(midPlus, centroid) < dist(midMinus, centroid);
}

/** Normale intérieure du mur (côté le plus proche du centroïde). */
function interiorNormal(
  wall: Wall,
  nodes: WallNode[],
  poly: { points: Point[] } | undefined,
  centroid: Point,
): Point {
  const d = wallDir(wall, nodes);
  const nPlus: Point = { x: -d.y, y: d.x };
  if (!poly || poly.points.length < 4) return nPlus;
  return plusIsInterior(poly, centroid) ? nPlus : { x: -nPlus.x, y: -nPlus.y };
}

/**
 * Calcule le coin intérieur de la pièce au nœud partagé entre wallA et wallB.
 * = intersection des droites (face intérieure de wallA) et (face intérieure de wallB).
 * Le sens des directions dA / dB est indifférent (droites infinies).
 */
function interiorCorner(
  nodeId: string,
  wallA: Wall, dA: Point, intNormA: Point,
  wallB: Wall, dB: Point, intNormB: Point,
  nodes: WallNode[],
): Point {
  const N = nodePos(nodeId, nodes);
  const pA: Point = { x: N.x + intNormA.x * wallA.thickness / 2,
                      y: N.y + intNormA.y * wallA.thickness / 2 };
  const pB: Point = { x: N.x + intNormB.x * wallB.thickness / 2,
                      y: N.y + intNormB.y * wallB.thickness / 2 };
  const denom = cross(dA, dB);
  if (Math.abs(denom) < 1e-6) return pA; // murs parallèles
  const diff: Point = { x: pB.x - pA.x, y: pB.y - pA.y };
  const t = cross(diff, dB) / denom;
  return { x: pA.x + t * dA.x, y: pA.y + t * dA.y };
}

// ── computeAutoCotations ──────────────────────────────────────────────────

export function computeAutoCotations(walls: Wall[], nodes: WallNode[]): AutoCotation[] {
  const polys    = computeCornerGeometry(walls, nodes);
  const polyMap  = new Map(polys.map((p) => [p.wallId, p]));
  const rooms    = detectClosedPolygons(walls, nodes);
  const wallsInRooms = new Set<string>();
  const result: AutoCotation[] = [];

  for (const room of rooms) {
    for (const wId of room.wallIds) wallsInRooms.add(wId);

    // Centroïde du polygone de la pièce
    const n = room.nodeIds.length;
    const centroid: Point = {
      x: room.nodeIds.reduce((s, id) => s + nodePos(id, nodes).x, 0) / n,
      y: room.nodeIds.reduce((s, id) => s + nodePos(id, nodes).y, 0) / n,
    };

    for (let i = 0; i < room.wallIds.length; i++) {
      const wallId = room.wallIds[i]!;
      const wall   = walls.find((w) => w.id === wallId);
      const poly   = polyMap.get(wallId);
      if (!wall || !poly || poly.points.length < 4) continue;

      const dir     = wallDir(wall, nodes);
      const nPlus: Point = { x: -dir.y, y: dir.x };
      const plusIsInt = plusIsInterior(poly, centroid);

      // ── Anchors extérieurs (coins WallPolygon côté le plus éloigné) ──
      const extPt1  = plusIsInt ? poly.points[3]! : poly.points[0]!;
      const extPt2  = plusIsInt ? poly.points[2]! : poly.points[1]!;
      const extNorm = plusIsInt
        ? { x: -nPlus.x, y: -nPlus.y }
        : nPlus;

      result.push({
        wallId, side: 'exterior',
        anchor1: extPt1, anchor2: extPt2,
        normal: extNorm, offset: COTE_OFFSET_EXT,
        label: formatCm(dist(extPt1, extPt2)),
      });

      // ── Anchors intérieurs (intersection des faces intérieures adjacentes) ──
      const intNorm = plusIsInt ? nPlus : { x: -nPlus.x, y: -nPlus.y };

      const node1Id  = room.nodeIds[i]!;
      const node2Id  = room.nodeIds[(i + 1) % n]!;
      const adjIdx1  = (i - 1 + room.wallIds.length) % room.wallIds.length;
      const adjIdx2  = (i + 1) % room.wallIds.length;
      const adjWall1 = walls.find((w) => w.id === room.wallIds[adjIdx1]!);
      const adjWall2 = walls.find((w) => w.id === room.wallIds[adjIdx2]!);

      if (!adjWall1 || !adjWall2) continue;

      const intNorm1 = interiorNormal(adjWall1, nodes, polyMap.get(adjWall1.id), centroid);
      const intNorm2 = interiorNormal(adjWall2, nodes, polyMap.get(adjWall2.id), centroid);
      const dir1     = wallDir(adjWall1, nodes);
      const dir2     = wallDir(adjWall2, nodes);

      const intAnchor1 = interiorCorner(node1Id, wall, dir, intNorm, adjWall1, dir1, intNorm1, nodes);
      const intAnchor2 = interiorCorner(node2Id, wall, dir, intNorm, adjWall2, dir2, intNorm2, nodes);

      result.push({
        wallId, side: 'interior',
        anchor1: intAnchor1, anchor2: intAnchor2,
        normal: intNorm, offset: COTE_OFFSET_INT,
        label: formatCm(dist(intAnchor1, intAnchor2)),
      });
    }
  }

  // ── Murs isolés ───────────────────────────────────────────────────────
  for (const wall of walls) {
    if (wallsInRooms.has(wall.id)) continue;
    const p1 = nodePos(wall.node1Id, nodes);
    const p2 = nodePos(wall.node2Id, nodes);
    const d  = dist(p1, p2);
    if (d < 1) continue;
    const dir: Point    = { x: (p2.x - p1.x) / d, y: (p2.y - p1.y) / d };
    const normal: Point = { x: -dir.y, y: dir.x };
    result.push({
      wallId: wall.id, side: 'isolated',
      anchor1: p1, anchor2: p2,
      normal, offset: COTE_OFFSET_ISO,
      label: formatCm(d),
    });
  }

  return result;
}

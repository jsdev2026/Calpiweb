import type { Point } from '@/types/plan';
import type { DimConstraintType, Room } from '@/types/project';
import type { FaceSnapPoint } from '@/components/plan/DrawingCanvas';
import { distance } from '@/engine/geometry/polygon';

/**
 * Retourne la normale unitaire de l'arête (prev→vtx ou vtx→next) la plus
 * perpendiculaire à la direction curseur→vtx.
 */
export function bestEdgeNormal(
  cursor: Point,
  vtx: Point,
  prev: Point,
  next: Point,
): Point {
  const toCursor = { x: cursor.x - vtx.x, y: cursor.y - vtx.y };
  const normalOf = (a: Point, b: Point): Point => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    return { x: -dy / len, y: dx / len };
  };
  const n1 = normalOf(prev, vtx);
  const n2 = normalOf(vtx, next);
  const dot1 = n1.x * toCursor.x + n1.y * toCursor.y;
  const dot2 = n2.x * toCursor.x + n2.y * toCursor.y;
  return Math.abs(dot1) >= Math.abs(dot2) ? n1 : n2;
}

/**
 * Trouve le FaceSnapPoint le plus proche sur les nœuds (vertices) des rooms.
 * Remplace findNearestFaceSnap (qui projetait le curseur sur tout le segment).
 * Snap threshold : 80 world-units / scale.
 */
export function findNearestVertexSnapImpl(
  cursor: Point,
  rooms: Room[],
  scale: number,
  wallThickness: number,
): FaceSnapPoint | null {
  const threshold = 80 / scale;
  let best: { snap: FaceSnapPoint; dist: number } | null = null;

  for (const room of rooms) {
    const pts = room.points;
    const n = pts.length;
    if (n < 2) continue;
    for (let i = 0; i < n; i++) {
      const vtx  = pts[i]!;
      const dist = distance(cursor, vtx);
      if (dist > threshold) continue;

      const prev = pts[(i - 1 + n) % n]!;
      const next = pts[(i + 1) % n]!;
      const halfPrev  = (room.edgeThicknesses?.[(i - 1 + n) % n] ?? wallThickness) / 2;
      const halfNext  = (room.edgeThicknesses?.[i] ?? wallThickness) / 2;
      const halfThick = Math.max(halfPrev, halfNext);

      const wallNormal = bestEdgeNormal(cursor, vtx, prev, next);

      const candidates: Array<{ face: 'INSIDE' | 'AXIS' | 'OUTSIDE'; pos: Point }> = [
        { face: 'INSIDE',  pos: { x: vtx.x + wallNormal.x * halfThick, y: vtx.y + wallNormal.y * halfThick } },
        { face: 'AXIS',    pos: vtx },
        { face: 'OUTSIDE', pos: { x: vtx.x - wallNormal.x * halfThick, y: vtx.y - wallNormal.y * halfThick } },
      ];

      let bestFace: FaceSnapPoint | null = null;
      let bestFaceDist = Infinity;
      for (const { face, pos } of candidates) {
        const d = distance(cursor, pos);
        if (d < bestFaceDist) {
          bestFaceDist = d;
          bestFace = { roomId: room.id, vertexIdx: i, face, worldPos: pos, wallNormal };
        }
      }
      if (bestFace && (!best || dist < best.dist)) {
        best = { snap: bestFace, dist };
      }
    }
  }

  return best ? best.snap : null;
}

/**
 * Calcule la valeur affichée brute (en cm, sans correction faceOffset) pour un
 * nouveau dimensionnement selon le type forcé.
 */
export function computeDimDisplayedValue(
  fromWorld: Point,
  toWorld: Point,
  dimType: DimConstraintType,
): number {
  const dx = Math.abs(toWorld.x - fromWorld.x);
  const dy = Math.abs(toWorld.y - fromWorld.y);
  const rawMm =
    dimType === 'H_DISTANCE' ? dx :
    dimType === 'V_DISTANCE' ? dy :
    Math.sqrt(dx * dx + dy * dy);
  return rawMm / 10;
}

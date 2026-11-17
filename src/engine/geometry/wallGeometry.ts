// src/engine/geometry/wallGeometry.ts
import type { Wall, WallNode } from '@/types/wall';
import type { Point } from '@/types/plan';

export interface WallPolygon {
  wallId: string;
  /** 4 world-coord points: [+n-node1, +n-node2, -n-node2, -n-node1] */
  points: Point[];
}

export interface JointLine {
  p1: Point;
  p2: Point;
}

/**
 * Au-delà de MITER_LIMIT × demi-épaisseur, la pointe d'un onglet (angle très aigu) est coupée :
 * la face s'arrête au nœud et le « bouchon » du nœud (computeNodeCaps) comble le vide.
 */
const MITER_LIMIT = 4;

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

/** Normale « à gauche » de u (rotation +90°). */
function left(u: Point): Point {
  return { x: -u.y, y: u.x };
}

function add(p: Point, v: Point, k: number): Point {
  return { x: p.x + v.x * k, y: p.y + v.y * k };
}

/** Bras d'un mur vu depuis un nœud : direction qui s'éloigne du nœud. */
interface Arm {
  wall: Wall;
  /** Direction unitaire partant du nœud */
  u: Point;
  /** Demi-épaisseur */
  h: number;
  /** Longueur du mur */
  len: number;
  /** Angle polaire de u */
  angle: number;
}

/** Extrémités des deux faces d'un bras au nœud, en coordonnées monde. */
interface ArmEnd {
  /** Face à gauche de u */
  left: Point;
  /** Face à droite de u */
  right: Point;
}

interface NodeJoin {
  node: Point;
  /** Bras triés par angle croissant (sens trigonométrique) */
  arms: Arm[];
  ends: Map<string, ArmEnd>;
}

/**
 * Abscisse s (le long de u) où la face de A (P + nA + s·u) coupe la face de B (P + nB + r·v).
 * null si les deux faces sont parallèles.
 */
function faceIntersection(u: Point, offA: Point, v: Point, offB: Point): number | null {
  const denom = cross(u, v);
  if (Math.abs(denom) < 1e-9) return null;
  const diff: Point = { x: offB.x - offA.x, y: offB.y - offA.y };
  return cross(diff, v) / denom;
}

function clampExtension(s: number | null, a: Arm, b: Arm): number {
  if (s === null || !Number.isFinite(s)) return 0;
  const limit = MITER_LIMIT * Math.max(a.h, b.h);
  // Pointe trop longue (angle très aigu) : on coupe au nœud.
  if (s < -limit) return 0;
  // Face intérieure qui dépasserait la longueur du mur : on la borne.
  if (s > a.len) return a.len;
  return s;
}

/**
 * Calcule, pour chaque nœud partagé, l'extrémité des faces de chaque mur.
 * Les murs sont triés autour du nœud ; la face gauche d'un mur rejoint la face droite
 * du mur suivant (sens trigonométrique), la face droite rejoint la face gauche du précédent.
 * Le sens de tracé des murs (node1 → node2) n'a donc plus d'influence.
 */
function computeNodeJoins(walls: Wall[], nodes: WallNode[]): Map<string, NodeJoin> {
  const pos = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  const armsByNode = new Map<string, Arm[]>();

  for (const wall of walls) {
    const p1 = pos.get(wall.node1Id);
    const p2 = pos.get(wall.node2Id);
    if (!p1 || !p2 || wall.node1Id === wall.node2Id) continue;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.1) continue;
    const d = { x: dx / len, y: dy / len };
    const h = wall.thickness / 2;
    const push = (nodeId: string, u: Point) => {
      const list = armsByNode.get(nodeId) ?? [];
      list.push({ wall, u, h, len, angle: Math.atan2(u.y, u.x) });
      armsByNode.set(nodeId, list);
    };
    push(wall.node1Id, d);
    push(wall.node2Id, { x: -d.x, y: -d.y });
  }

  const joins = new Map<string, NodeJoin>();
  for (const [nodeId, arms] of armsByNode) {
    if (arms.length < 2) continue;
    const P = pos.get(nodeId)!;
    arms.sort((a, b) => a.angle - b.angle);
    const ends = new Map<string, ArmEnd>();
    const n = arms.length;

    arms.forEach((a, i) => {
      const next = arms[(i + 1) % n]!; // voisin côté gauche (sens trigo)
      const prev = arms[(i - 1 + n) % n]!; // voisin côté droit
      const la = left(a.u);

      // Face gauche de A ↔ face droite du voisin suivant
      const offAL = { x: la.x * a.h, y: la.y * a.h };
      const lNext = left(next.u);
      const offNextR = { x: -lNext.x * next.h, y: -lNext.y * next.h };
      const sL = clampExtension(faceIntersection(a.u, offAL, next.u, offNextR), a, next);

      // Face droite de A ↔ face gauche du voisin précédent
      const offAR = { x: -la.x * a.h, y: -la.y * a.h };
      const lPrev = left(prev.u);
      const offPrevL = { x: lPrev.x * prev.h, y: lPrev.y * prev.h };
      const sR = clampExtension(faceIntersection(a.u, offAR, prev.u, offPrevL), a, prev);

      ends.set(a.wall.id, {
        left: add(add(P, la, a.h), a.u, sL),
        right: add(add(P, la, -a.h), a.u, sR),
      });
    });

    joins.set(nodeId, { node: P, arms, ends });
  }
  return joins;
}

/**
 * Compute SVG polygon points for each wall.
 * Each wall is a rectangle whose ends are mitred against the adjacent walls at shared nodes.
 * Zero-length walls return empty points.
 */
export function computeCornerGeometry(walls: Wall[], nodes: WallNode[]): WallPolygon[] {
  const joins = computeNodeJoins(walls, nodes);
  const pos = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));

  return walls.map((wall) => {
    const p1 = pos.get(wall.node1Id) ?? { x: 0, y: 0 };
    const p2 = pos.get(wall.node2Id) ?? { x: 0, y: 0 };
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (len < 0.1 || wall.node1Id === wall.node2Id) return { wallId: wall.id, points: [] };

    const d: Point = { x: (p2.x - p1.x) / len, y: (p2.y - p1.y) / len };
    const n = left(d);
    const h = wall.thickness / 2;

    // Au node1, u = d : face +n = gauche. Au node2, u = −d : face +n = droite.
    const e1 = joins.get(wall.node1Id)?.ends.get(wall.id);
    const e2 = joins.get(wall.node2Id)?.ends.get(wall.id);

    return {
      wallId: wall.id,
      points: [
        e1?.left ?? add(p1, n, h),
        e2?.right ?? add(p2, n, h),
        e2?.left ?? add(p2, n, -h),
        e1?.right ?? add(p1, n, -h),
      ],
    };
  });
}

function polygonArea(pts: Point[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) a += cross(pts[i]!, pts[(i + 1) % pts.length]!);
  return a / 2;
}

/**
 * Polygones de « bouchon » aux nœuds partagés : comblent le vide laissé au nœud quand une
 * pointe d'onglet est coupée (angles très aigus) ou quand 3 murs ou plus se rejoignent.
 */
export function computeNodeCaps(walls: Wall[], nodes: WallNode[]): Point[][] {
  const caps: Point[][] = [];
  for (const join of computeNodeJoins(walls, nodes).values()) {
    const pts: Point[] = [];
    for (const arm of join.arms) {
      const e = join.ends.get(arm.wall.id)!;
      pts.push(e.right, e.left);
    }
    if (pts.length >= 3 && Math.abs(polygonArea(pts)) > 1e-6) caps.push(pts);
  }
  return caps;
}

/**
 * Lignes de joint aux nœuds partagés : une ligne par extrémité de mur (face gauche → face droite).
 * Pour deux murs, les deux extrémités coïncident : une seule ligne est conservée.
 */
export function computeJointLines(walls: Wall[], nodes: WallNode[]): JointLine[] {
  const lines: JointLine[] = [];
  const seen = new Set<string>();
  const key = (a: Point, b: Point) => {
    const k = (p: Point) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
    return [k(a), k(b)].sort().join('|');
  };

  for (const join of computeNodeJoins(walls, nodes).values()) {
    // Deux murs alignés de même épaisseur : simple continuité, pas de joint à dessiner.
    if (join.arms.length === 2) {
      const [a, b] = join.arms as [Arm, Arm];
      if (Math.abs(cross(a.u, b.u)) < 1e-6 && a.h === b.h) continue;
    }
    for (const arm of join.arms) {
      const e = join.ends.get(arm.wall.id)!;
      if (Math.hypot(e.left.x - e.right.x, e.left.y - e.right.y) < 1e-6) continue;
      const k = key(e.left, e.right);
      if (seen.has(k)) continue;
      seen.add(k);
      lines.push({ p1: e.left, p2: e.right });
    }
  }
  return lines;
}

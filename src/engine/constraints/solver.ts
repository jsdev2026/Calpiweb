import type { Room, Constraint } from '@/types/project';
import type { Point } from '@/types/plan';

// ── Internal solver representation ────────────────────────────────────────

interface SolverPoint {
  x: number;
  y: number;
  isFixed: boolean;      // FIX constraint → solver cannot move this point at all
  temporaryFix: boolean; // dragged by mouse → solver must respect user input
}

interface SolverConstraint {
  id: string;
  type: string;
  pts: number[]; // indices into SolverPoint[]
  value?: number | { x: number; y: number };
}

// ── Core primitives ────────────────────────────────────────────────────────

/** The priority gate described in the spec: isFixed > temporaryFix > solver. */
function movePoint(p: SolverPoint, tx: number, ty: number): void {
  if (p.isFixed || p.temporaryFix) return;
  p.x = tx;
  p.y = ty;
}

function applyConstraint(c: SolverConstraint, pts: SolverPoint[]): void {
  switch (c.type) {
    case 'COINCIDENT': {
      const p1 = pts[c.pts[0]!];
      const p2 = pts[c.pts[1]!];
      if (!p1 || !p2) return;
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      movePoint(p1, mx, my);
      movePoint(p2, mx, my);
      break;
    }
    case 'HORIZONTAL': {
      const p1 = pts[c.pts[0]!];
      const p2 = pts[c.pts[1]!];
      if (!p1 || !p2) return;
      const my = (p1.y + p2.y) / 2;
      movePoint(p1, p1.x, my);
      movePoint(p2, p2.x, my);
      break;
    }
    case 'VERTICAL': {
      const p1 = pts[c.pts[0]!];
      const p2 = pts[c.pts[1]!];
      if (!p1 || !p2) return;
      const mx = (p1.x + p2.x) / 2;
      movePoint(p1, mx, p1.y);
      movePoint(p2, mx, p2.y);
      break;
    }
    case 'LENGTH': {
      const p1 = pts[c.pts[0]!];
      const p2 = pts[c.pts[1]!];
      if (!p1 || !p2 || typeof c.value !== 'number') return;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const error = ((dist - c.value) / dist) * 0.5;
      movePoint(p1, p1.x + dx * error, p1.y + dy * error);
      movePoint(p2, p2.x - dx * error, p2.y - dy * error);
      break;
    }
    case 'H_DISTANCE': {
      const p1 = pts[c.pts[0]!];
      const p2 = pts[c.pts[1]!];
      if (!p1 || !p2 || typeof c.value !== 'number') return;
      const dx = p2.x - p1.x;
      const target = Math.sign(dx || 1) * c.value;
      const errX = (dx - target) * 0.5;
      movePoint(p1, p1.x + errX, p1.y);
      movePoint(p2, p2.x - errX, p2.y);
      break;
    }
    case 'V_DISTANCE': {
      const p1 = pts[c.pts[0]!];
      const p2 = pts[c.pts[1]!];
      if (!p1 || !p2 || typeof c.value !== 'number') return;
      const dy = p2.y - p1.y;
      const target = Math.sign(dy || 1) * c.value;
      const errY = (dy - target) * 0.5;
      movePoint(p1, p1.x, p1.y + errY);
      movePoint(p2, p2.x, p2.y - errY);
      break;
    }
    case 'POINT_ON_LINE': {
      const p = pts[c.pts[0]!];
      const p1 = pts[c.pts[1]!];
      const p2 = pts[c.pts[2]!];
      if (!p || !p1 || !p2) return;
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 0.001) return;
      const t = Math.max(0, Math.min(1, ((p.x - p1.x) * dx + (p.y - p1.y) * dy) / len2));
      movePoint(p, p1.x + t * dx, p1.y + t * dy);
      break;
    }
  }
}

/** Geometric error for a solved constraint (used for violation detection). */
function residualOf(c: SolverConstraint, pts: SolverPoint[]): number {
  switch (c.type) {
    case 'HORIZONTAL': {
      const p1 = pts[c.pts[0]!], p2 = pts[c.pts[1]!];
      if (!p1 || !p2) return 0;
      return Math.abs(p1.y - p2.y);
    }
    case 'VERTICAL': {
      const p1 = pts[c.pts[0]!], p2 = pts[c.pts[1]!];
      if (!p1 || !p2) return 0;
      return Math.abs(p1.x - p2.x);
    }
    case 'COINCIDENT': {
      const p1 = pts[c.pts[0]!], p2 = pts[c.pts[1]!];
      if (!p1 || !p2) return 0;
      const dx = p1.x - p2.x, dy = p1.y - p2.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    case 'LENGTH': {
      const p1 = pts[c.pts[0]!], p2 = pts[c.pts[1]!];
      if (!p1 || !p2 || typeof c.value !== 'number') return 0;
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      return Math.abs(Math.sqrt(dx * dx + dy * dy) - c.value);
    }
    case 'H_DISTANCE': {
      const p1 = pts[c.pts[0]!], p2 = pts[c.pts[1]!];
      if (!p1 || !p2 || typeof c.value !== 'number') return 0;
      return Math.abs(Math.abs(p2.x - p1.x) - c.value);
    }
    case 'V_DISTANCE': {
      const p1 = pts[c.pts[0]!], p2 = pts[c.pts[1]!];
      if (!p1 || !p2 || typeof c.value !== 'number') return 0;
      return Math.abs(Math.abs(p2.y - p1.y) - c.value);
    }
    case 'POINT_ON_LINE': {
      const p = pts[c.pts[0]!], lp1 = pts[c.pts[1]!], lp2 = pts[c.pts[2]!];
      if (!p || !lp1 || !lp2) return 0;
      const dx = lp2.x - lp1.x, dy = lp2.y - lp1.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 0.001) return 0;
      const t = ((p.x - lp1.x) * dx + (p.y - lp1.y) * dy) / len2;
      const ex = p.x - (lp1.x + t * dx), ey = p.y - (lp1.y + t * dy);
      return Math.sqrt(ex * ex + ey * ey);
    }
    default:
      return 0;
  }
}

// ── Shared internal helpers ────────────────────────────────────────────────

function buildSolverState(
  rooms: Room[],
  constraints: Constraint[],
  temporaryFixKey: string | null,
): { solverPts: SolverPoint[]; solverConstraints: SolverConstraint[]; keyToIdx: Map<string, number> } {
  const solverPts: SolverPoint[] = [];
  const keyToIdx = new Map<string, number>();

  for (const room of rooms) {
    for (let i = 0; i < room.points.length; i++) {
      const key = `${room.id}:${i}`;
      keyToIdx.set(key, solverPts.length);
      solverPts.push({
        x: room.points[i]!.x,
        y: room.points[i]!.y,
        isFixed: false,
        temporaryFix: key === temporaryFixKey,
      });
    }
  }

  for (const c of constraints) {
    if (c.type === 'FIX' && c.pts[0]) {
      const idx = keyToIdx.get(`${c.pts[0].roomId}:${c.pts[0].vertexIdx}`);
      if (idx !== undefined) solverPts[idx]!.isFixed = true;
    }
  }

  const solverConstraints: SolverConstraint[] = constraints
    .filter((c) => c.type !== 'FIX')
    .map((c) => ({
      id: c.id,
      type: c.type,
      pts: c.pts.map((ref) => keyToIdx.get(`${ref.roomId}:${ref.vertexIdx}`) ?? -1),
      value: c.value,
    }))
    .filter((sc) => sc.pts.every((i) => i !== -1));

  return { solverPts, solverConstraints, keyToIdx };
}

function runIterations(
  solverPts: SolverPoint[],
  solverConstraints: SolverConstraint[],
  fixConstraints: Constraint[],
  keyToIdx: Map<string, number>,
  iterations: number,
): void {
  for (let iter = 0; iter < iterations; iter++) {
    // Restore anchor positions at the start of each iteration (spec FIX behaviour)
    for (const c of fixConstraints) {
      if (c.type === 'FIX' && c.pts[0] && typeof c.value === 'object' && c.value !== null && 'x' in c.value) {
        const idx = keyToIdx.get(`${c.pts[0].roomId}:${c.pts[0].vertexIdx}`);
        if (idx !== undefined) {
          solverPts[idx]!.x = (c.value as { x: number; y: number }).x;
          solverPts[idx]!.y = (c.value as { x: number; y: number }).y;
        }
      }
    }
    for (const sc of solverConstraints) applyConstraint(sc, solverPts);
  }
}

function collectPoints(
  rooms: Room[],
  solverPts: SolverPoint[],
  keyToIdx: Map<string, number>,
): Map<string, Point[]> {
  const result = new Map<string, Point[]>();
  for (const room of rooms) {
    result.set(
      room.id,
      room.points.map((p, i) => {
        const idx = keyToIdx.get(`${room.id}:${i}`);
        return idx !== undefined ? { x: solverPts[idx]!.x, y: solverPts[idx]!.y } : { ...p };
      }),
    );
  }
  return result;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Builds a flat solver state from all rooms + constraints, runs 100 iterations
 * of relaxation, and returns updated point arrays keyed by roomId.
 */
export function buildAndSolve(
  rooms: Room[],
  constraints: Constraint[],
  temporaryFixKey: string | null = null,
  iterations = 100,
): Map<string, Point[]> {
  const { solverPts, solverConstraints, keyToIdx } = buildSolverState(rooms, constraints, temporaryFixKey);
  runIterations(solverPts, solverConstraints, constraints, keyToIdx, iterations);
  return collectPoints(rooms, solverPts, keyToIdx);
}

export interface SolveResult {
  points: Map<string, Point[]>;
  /** IDs of constraints whose residual error exceeds the tolerance after solving. */
  violatedIds: string[];
}

const RESIDUAL_TOLERANCE_MM = 1.5;

/**
 * Same as buildAndSolve but also measures per-constraint residual error.
 * Returns violatedIds (non-empty → the proposed state is geometrically inconsistent).
 */
export function solveAndValidate(
  rooms: Room[],
  constraints: Constraint[],
  temporaryFixKey: string | null = null,
  iterations = 100,
  tolerance = RESIDUAL_TOLERANCE_MM,
): SolveResult {
  const { solverPts, solverConstraints, keyToIdx } = buildSolverState(rooms, constraints, temporaryFixKey);
  runIterations(solverPts, solverConstraints, constraints, keyToIdx, iterations);

  const violatedIds: string[] = [];
  for (const sc of solverConstraints) {
    if (residualOf(sc, solverPts) > tolerance) violatedIds.push(sc.id);
  }

  return { points: collectPoints(rooms, solverPts, keyToIdx), violatedIds };
}

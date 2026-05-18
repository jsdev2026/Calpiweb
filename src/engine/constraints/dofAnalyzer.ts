import type { Room, Constraint } from '@/types/project';

export interface VertexDOF {
  cx: boolean; // X axis is determined
  cy: boolean; // Y axis is determined
  isFullyConstrained: boolean; // cx && cy → green, drag blocked
}

export type DOFMap = Map<string, VertexDOF>;

export function ptKey(roomId: string, vertexIdx: number): string {
  return `${roomId}:${vertexIdx}`;
}

/**
 * Propagates degrees-of-freedom across all vertices using the cascade logic
 * described in the spec (Section 4 — Analyseur de Degrés de Liberté).
 *
 * Seeds: FIX → cx=cy=true.
 * Rules (iterated until stable):
 *   HORIZONTAL  → shared cy between the two endpoints
 *   VERTICAL    → shared cx between the two endpoints
 *   COINCIDENT  → merges cx and cy between the two vertices
 *   LENGTH      → if one end is fully fixed AND the other has cx or cy → other becomes fully fixed
 *                 (circle ∩ axis-aligned line = finite set of points)
 */
export function analyzeDOF(rooms: Room[], constraints: Constraint[]): DOFMap {
  const cx = new Map<string, boolean>();
  const cy = new Map<string, boolean>();

  for (const room of rooms) {
    for (let i = 0; i < room.points.length; i++) {
      const k = ptKey(room.id, i);
      cx.set(k, false);
      cy.set(k, false);
    }
  }

  // Seed: FIX constraints give full rigidity
  for (const c of constraints) {
    if (c.type === 'FIX' && c.pts[0]) {
      const k = ptKey(c.pts[0].roomId, c.pts[0].vertexIdx);
      if (cx.has(k)) { cx.set(k, true); cy.set(k, true); }
    }
  }

  let changed = true;
  let iter = 0;
  while (changed && iter < 50) {
    changed = false;
    iter++;

    for (const c of constraints) {
      if (c.pts.length < 2) continue;
      const k1 = ptKey(c.pts[0]!.roomId, c.pts[0]!.vertexIdx);
      const k2 = ptKey(c.pts[1]!.roomId, c.pts[1]!.vertexIdx);

      if (c.type === 'HORIZONTAL') {
        if ((cy.get(k1) || cy.get(k2)) && (!cy.get(k1) || !cy.get(k2))) {
          cy.set(k1, true); cy.set(k2, true); changed = true;
        }
      }

      if (c.type === 'VERTICAL') {
        if ((cx.get(k1) || cx.get(k2)) && (!cx.get(k1) || !cx.get(k2))) {
          cx.set(k1, true); cx.set(k2, true); changed = true;
        }
      }

      if (c.type === 'COINCIDENT') {
        const mcx = (cx.get(k1) ?? false) || (cx.get(k2) ?? false);
        const mcy = (cy.get(k1) ?? false) || (cy.get(k2) ?? false);
        if (mcx && !cx.get(k1)) { cx.set(k1, true); changed = true; }
        if (mcx && !cx.get(k2)) { cx.set(k2, true); changed = true; }
        if (mcy && !cy.get(k1)) { cy.set(k1, true); changed = true; }
        if (mcy && !cy.get(k2)) { cy.set(k2, true); changed = true; }
      }

      if (c.type === 'LENGTH') {
        const p1Full = (cx.get(k1) ?? false) && (cy.get(k1) ?? false);
        const p2Full = (cx.get(k2) ?? false) && (cy.get(k2) ?? false);
        const p1Part = (cx.get(k1) ?? false) || (cy.get(k1) ?? false);
        const p2Part = (cx.get(k2) ?? false) || (cy.get(k2) ?? false);
        if (p1Full && p2Part && !p2Full) { cx.set(k2, true); cy.set(k2, true); changed = true; }
        if (p2Full && p1Part && !p1Full) { cx.set(k1, true); cy.set(k1, true); changed = true; }
      }

      if (c.type === 'H_DISTANCE') {
        if ((cx.get(k1) || cx.get(k2)) && (!cx.get(k1) || !cx.get(k2))) {
          cx.set(k1, true); cx.set(k2, true); changed = true;
        }
      }

      if (c.type === 'V_DISTANCE') {
        if ((cy.get(k1) || cy.get(k2)) && (!cy.get(k1) || !cy.get(k2))) {
          cy.set(k1, true); cy.set(k2, true); changed = true;
        }
      }
    }
  }

  const result: DOFMap = new Map();
  for (const k of cx.keys()) {
    const cxv = cx.get(k) ?? false;
    const cyv = cy.get(k) ?? false;
    result.set(k, { cx: cxv, cy: cyv, isFullyConstrained: cxv && cyv });
  }
  return result;
}

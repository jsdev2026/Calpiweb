// Essai sur la page d'accueil : règles de tracé d'une pièce (fonctions pures, en mm).
import type { Point } from '@/types/plan';

/** Zone de dessin : 10 m × 6,25 m */
export const AREA_W = 10_000;
export const AREA_H = 6_250;
/** Pas d'aimantation (10 cm) */
export const SNAP = 100;
/** Écart angulaire en dessous duquel un mur est redressé (horizontal / vertical) */
export const ORTHO_DEG = 10;
/** Distance (mm) pour « cliquer sur le premier point » et fermer la pièce */
export const CLOSE_RADIUS = 250;
/** Mur le plus court accepté */
export const MIN_WALL = 200;

export const snap = (v: number, step = SNAP) => Math.round(v / step) * step;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Point aimanté : grille de 10 cm, mur redressé s'il est presque horizontal ou vertical. */
export function snapPoint(raw: Point, prev?: Point): Point {
  let p = { x: clamp(snap(raw.x), 0, AREA_W), y: clamp(snap(raw.y), 0, AREA_H) };
  if (prev) {
    const angle = (Math.atan2(Math.abs(p.y - prev.y), Math.abs(p.x - prev.x)) * 180) / Math.PI;
    if (angle < ORTHO_DEG) p = { x: p.x, y: prev.y };
    else if (angle > 90 - ORTHO_DEG) p = { x: prev.x, y: p.y };
  }
  return p;
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

export type AddResult =
  | { kind: 'added'; points: Point[] }
  | { kind: 'closed'; points: Point[] }
  | { kind: 'rejected'; reason: 'too-short' | 'crossing' };

/**
 * Ajoute un angle à la pièce en cours de tracé.
 * Un clic près du premier point (à partir de 3 angles) ferme la pièce.
 */
export function addPoint(points: Point[], raw: Point): AddResult {
  const first = points[0];
  if (first && points.length >= 3 && distance(raw, first) <= CLOSE_RADIUS) {
    const last = points[points.length - 1]!;
    for (let i = 1; i < points.length - 2; i++) {
      if (segmentsCross(last, first, points[i]!, points[i + 1]!))
        return { kind: 'rejected', reason: 'crossing' };
    }
    return { kind: 'closed', points };
  }
  const prev = points[points.length - 1];
  const p = snapPoint(raw, prev);
  if (prev && distance(prev, p) < MIN_WALL) return { kind: 'rejected', reason: 'too-short' };
  if (prev) {
    for (let i = 0; i < points.length - 2; i++) {
      if (segmentsCross(prev, p, points[i]!, points[i + 1]!))
        return { kind: 'rejected', reason: 'crossing' };
    }
  }
  return { kind: 'added', points: [...points, p] };
}

/** Surface (mm²) d'un polygone */
export function polygonArea(points: Point[]): number {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export const formatLength = (mm: number) => `${(mm / 1000).toFixed(2).replace('.', ',')} m`;

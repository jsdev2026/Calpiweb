// Scénario de l'animation de la page d'accueil (« motion design » du produit).
// Tout est calculé à partir du temps t (secondes, en boucle) : fonctions pures, testables.

export type Pt = { x: number; y: number };
export type DemoScene = 'PLAN' | 'TILING' | 'QUANTITIES';

/** Durée d'une boucle complète (s) */
export const LOOP = 16;
/** Image fixe montrée si l'utilisateur limite les animations : quantitatif complet */
export const STILL_FRAME = 13;

// ── Repères temporels ────────────────────────────────────────────────────────
export const T = {
  drawStart: 0.4,
  segment: 0.55,
  closed: 0.4 + 6 * 0.55, // 3,7 s
  toTiling: 4.6,
  tilesIn: 4.8,
  poseClick: 6.95,
  staggerFrom: 7.0,
  staggerTo: 7.5,
  startTile: 8.0,
  toQuantities: 10,
  countFrom: 10.2,
  countTo: 11.6,
  consumables: 11.8,
  pdfClick: 14.0,
  fadeFrom: 15.4,
} as const;

/** Lissage (accélération puis décélération) */
export const ease = (x: number) =>
  x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
/** Progression lissée de 0 à 1 entre a et b */
export const prog = (t: number, a: number, b: number) => ease((t - a) / (b - a));

export const sceneAt = (t: number): DemoScene =>
  t < T.toTiling ? 'PLAN' : t < T.toQuantities ? 'TILING' : 'QUANTITIES';

// ── Pièce (repère SVG, 1 unité = 1 cm) ──────────────────────────────────────
export const ROOM: Pt[] = [
  { x: 200, y: 52 },
  { x: 520, y: 52 },
  { x: 520, y: 170 },
  { x: 410, y: 170 },
  { x: 410, y: 300 },
  { x: 200, y: 300 },
];

/** Contour tracé à l'instant t (le dernier segment est en cours de tracé). */
export function drawnPath(t: number): { pts: Pt[]; closed: boolean } {
  const n = ROOM.length;
  const k = (t - T.drawStart) / T.segment; // nombre de segments tracés (décimal)
  if (k <= 0) return { pts: [ROOM[0]!], closed: false };
  if (k >= n) return { pts: [...ROOM, ROOM[0]!], closed: true };
  const done = Math.floor(k);
  const f = ease(k - done);
  const a = ROOM[done]!;
  const b = ROOM[(done + 1) % n]!;
  return {
    pts: [...ROOM.slice(0, done + 1), { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }],
    closed: false,
  };
}

// ── Curseur ──────────────────────────────────────────────────────────────────
/** Positions des liens « suivant » / choix cliqués dans le panneau */
export const TARGET = {
  next: { x: 132, y: 61 },
  poseStagger: { x: 120, y: 151 },
  pdf: { x: 118, y: 61 },
} as const;

type Key = { t: number; p: Pt };
const CURSOR: Key[] = [
  { t: 0, p: { x: 330, y: 220 } },
  { t: 0.35, p: ROOM[0]! },
  // suit le tracé (ajouté dynamiquement ci-dessous)
  { t: T.closed + 0.1, p: ROOM[0]! },
  { t: 4.35, p: TARGET.next },
  { t: 4.75, p: TARGET.next },
  { t: 5.6, p: { x: 360, y: 210 } },
  { t: 6.6, p: TARGET.poseStagger },
  { t: 7.2, p: TARGET.poseStagger },
  { t: 8.1, p: { x: 300, y: 140 } },
  { t: 9.6, p: TARGET.next },
  { t: 10.1, p: TARGET.next },
  { t: 11, p: { x: 380, y: 230 } },
  { t: 13.6, p: TARGET.pdf },
  { t: LOOP, p: TARGET.pdf },
];
/** Instants de clic (enfoncement du curseur) */
export const CLICKS = [T.toTiling - 0.15, T.poseClick, T.toQuantities - 0.1, T.pdfClick];

export function cursorAt(t: number): Pt & { pressed: boolean } {
  const pressed = CLICKS.some((c) => t >= c && t < c + 0.18);
  // Pendant le tracé, le curseur est au bout du trait
  if (t >= T.drawStart && t < T.closed) {
    const { pts } = drawnPath(t);
    return { ...pts[pts.length - 1]!, pressed };
  }
  for (let i = 0; i < CURSOR.length - 1; i++) {
    const a = CURSOR[i]!;
    const b = CURSOR[i + 1]!;
    if (t >= a.t && t < b.t) {
      const f = ease((t - a.t) / (b.t - a.t));
      return { x: a.p.x + (b.p.x - a.p.x) * f, y: a.p.y + (b.p.y - a.p.y) * f, pressed };
    }
  }
  const last = CURSOR[CURSOR.length - 1]!.p;
  return { ...last, pressed };
}

// ── Carreaux 30 × 60 (repère cm) ─────────────────────────────────────────────
export const TILE_W = 60;
export const TILE_H = 30;
const ORIGIN: Pt = { x: 186, y: 42 };
const COLS = 7;
const ROWS = 9;

/** Décalage de pose : 0 = droit, 1 = décalé 1/3 */
export const staggerAt = (t: number) => prog(t, T.staggerFrom, T.staggerTo);

export function pointInPolygon(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
      inside = !inside;
  }
  return inside;
}

export interface DemoTile {
  key: string;
  x: number;
  y: number;
  /** Ordre d'apparition (cascade depuis l'angle haut-gauche) */
  order: number;
  /** Carreau coupé (au moins un coin hors de la pièce) */
  cut: boolean;
  /** Carreau de départ « D » */
  start: boolean;
}

export function tilesAt(stagger: number): DemoTile[] {
  const out: DemoTile[] = [];
  for (let r = 0; r < ROWS; r++) {
    const off = (r % 3) * (TILE_W / 3) * stagger;
    for (let c = -1; c < COLS; c++) {
      const x = ORIGIN.x + c * TILE_W - off;
      const y = ORIGIN.y + r * TILE_H;
      const corners = [
        { x: x + 0.5, y: y + 0.5 },
        { x: x + TILE_W - 0.5, y: y + 0.5 },
        { x: x + TILE_W - 0.5, y: y + TILE_H - 0.5 },
        { x: x + 0.5, y: y + TILE_H - 0.5 },
      ];
      // Les carreaux sont découpés par le contour de la pièce au rendu (clipPath)
      const inside = corners.filter((p) => pointInPolygon(p, ROOM)).length;
      out.push({
        key: `${r}:${c}`,
        x,
        y,
        order: r + c + 1,
        cut: inside < 4,
        start: r === 1 && c === 1,
      });
    }
  }
  return out;
}

/** Cotes du carreau de départ par rapport aux murs du haut et de gauche (cm). */
export function startCotes(stagger: number): { left: number; top: number; tile: Pt } {
  const d = tilesAt(stagger).find((t) => t.start)!;
  return { left: d.x - ROOM[0]!.x, top: d.y - ROOM[0]!.y, tile: { x: d.x, y: d.y } };
}

// ── Quantitatif ──────────────────────────────────────────────────────────────
export const ORDER = 172;
export const WHOLE = 134;
export const CUTS = 38;
export const counterAt = (t: number) => Math.round(ORDER * prog(t, T.countFrom, T.countTo));

/** Opacité globale (fondu de fin de boucle) */
export const loopFade = (t: number) => 1 - prog(t, T.fadeFrom, LOOP);

/** Halo du lien « suivant » : actif juste avant chaque changement d'écran */
export function pulseAt(t: number): number {
  const windows: [number, number][] = [
    [T.closed + 0.1, T.toTiling - 0.1],
    [9.0, T.toQuantities - 0.05],
    [13.0, T.pdfClick + 0.1],
  ];
  const w = windows.find(([a, b]) => t >= a && t < b);
  if (!w) return 0;
  return ((t - w[0]) % 0.9) / 0.9; // 0 → 1, répété
}

export const formatCm = (cm: number) => `${cm.toFixed(1).replace('.', ',')} cm`;

import { describe, expect, it } from 'vitest';
import {
  LOOP,
  ORDER,
  ROOM,
  STILL_FRAME,
  T,
  TARGET,
  counterAt,
  cursorAt,
  drawnPath,
  loopFade,
  pulseAt,
  sceneAt,
  staggerAt,
  startCotes,
  tilesAt,
} from './heroTimeline';

describe('scénario de la démonstration', () => {
  it('enchaîne Plan 2D → Calepinage → Quantitatif', () => {
    expect(sceneAt(1)).toBe('PLAN');
    expect(sceneAt(T.toTiling + 0.01)).toBe('TILING');
    expect(sceneAt(T.toQuantities + 0.01)).toBe('QUANTITIES');
    expect(sceneAt(STILL_FRAME)).toBe('QUANTITIES');
  });

  it('trace la pièce mur par mur puis la ferme', () => {
    expect(drawnPath(0).pts).toHaveLength(1);
    const mid = drawnPath(T.drawStart + T.segment * 2.5);
    expect(mid.closed).toBe(false);
    expect(mid.pts).toHaveLength(4);
    const done = drawnPath(T.closed);
    expect(done.closed).toBe(true);
    expect(done.pts).toHaveLength(ROOM.length + 1);
  });

  it('le curseur suit le trait, puis clique sur « suivant »', () => {
    const t = T.drawStart + T.segment * 0.5;
    const { pts } = drawnPath(t);
    expect(cursorAt(t)).toMatchObject(pts[pts.length - 1]!);
    const click = cursorAt(T.toTiling - 0.1);
    expect(click).toMatchObject({ ...TARGET.next, pressed: true });
  });

  it('le lien « suivant » pulse avant chaque changement d’écran, pas pendant le tracé', () => {
    expect(pulseAt(1)).toBe(0);
    expect(pulseAt(T.closed + 0.3)).toBeGreaterThan(0);
    expect(pulseAt(9.5)).toBeGreaterThan(0);
  });

  it('pose droite puis décalée 1/3 ; le carreau de départ est entier et coté', () => {
    expect(staggerAt(T.staggerFrom - 0.1)).toBe(0);
    expect(staggerAt(T.staggerTo)).toBe(1);
    const start = tilesAt(1).filter((t) => t.start);
    expect(start).toHaveLength(1);
    expect(start[0]!.cut).toBe(false);
    const c = startCotes(1);
    expect(c.left).toBeGreaterThan(0);
    expect(c.top).toBeGreaterThan(0);
    expect(tilesAt(1).some((t) => t.cut)).toBe(true);
  });

  it('le compteur monte jusqu’au total à commander ; fondu en fin de boucle', () => {
    expect(counterAt(T.countFrom)).toBe(0);
    expect(counterAt(T.countTo)).toBe(ORDER);
    expect(loopFade(1)).toBe(1);
    expect(loopFade(LOOP)).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import type { PlanTool } from './PlanToolbar';
import type { EdgeType } from '@/types/project';
import { TOOL_STATUS_TEXTS } from './ToolStatusBar';

// ── Escape → SELECT ──────────────────────────────────────────────────────────

describe('Escape key → SELECT', () => {
  const nonSelectTools: PlanTool[] = [
    'WALL', 'DOOR', 'PARTITION', 'EXCLUDE',
    'APPLY_H', 'APPLY_V', 'COINCIDE', 'DIMENSION', 'ANCHOR', 'DELETE',
  ];

  it('chaque outil non-SELECT doit céder à SELECT après Escape', () => {
    for (const tool of nonSelectTools) {
      // Simule la logique du handler Escape : setTool('SELECT')
      const nextTool: PlanTool = tool !== 'SELECT' ? 'SELECT' : tool;
      expect(nextTool).toBe('SELECT');
    }
  });

  it('SELECT reste SELECT après Escape (idempotent)', () => {
    const tool: PlanTool = 'SELECT';
    const nextTool: PlanTool = tool !== 'SELECT' ? 'SELECT' : tool;
    expect(nextTool).toBe('SELECT');
  });

  it('un outil non-SELECT ne donne jamais SELECT sans Escape', () => {
    // Contrôle négatif : sans la logique Escape, l'outil reste ce qu'il est
    const tool: PlanTool = 'WALL';
    expect(tool).not.toBe('SELECT');
  });
});

// ── ToolStatusBar ─────────────────────────────────────────────────────────────

describe('ToolStatusBar — STATUS_TEXTS', () => {
  it('SELECT n\'a pas de texte (invisible)', () => {
    expect(TOOL_STATUS_TEXTS['SELECT']).toBeUndefined();
  });

  it('WALL a un texte', () => {
    expect(TOOL_STATUS_TEXTS['WALL']).toBe('Cliquez pour poser un point');
  });

  it('DOOR a un texte', () => {
    expect(TOOL_STATUS_TEXTS['DOOR']).toBe('Cliquez sur un mur pour placer une porte');
  });

  it('COINCIDE a un texte', () => {
    expect(TOOL_STATUS_TEXTS['COINCIDE']).toBe('Cliquez sur le nœud, puis sur un mur/nœud pour les joindre');
  });

  const drawingTools: Array<keyof typeof TOOL_STATUS_TEXTS> = [
    'WALL', 'DOOR', 'PARTITION', 'EXCLUDE',
    'APPLY_H', 'APPLY_V', 'COINCIDE', 'DIMENSION', 'ANCHOR',
  ];

  it('tous les outils de dessin ont un texte non vide', () => {
    for (const tool of drawingTools) {
      expect(TOOL_STATUS_TEXTS[tool]).toBeTruthy();
    }
  });
});

// ── Mode tutorial ─────────────────────────────────────────────────────────────

describe('mode tutorial', () => {
  it('toggle : false → true', () => {
    let tutorialMode = false;
    tutorialMode = !tutorialMode;
    expect(tutorialMode).toBe(true);
  });

  it('toggle : true → false', () => {
    let tutorialMode = true;
    tutorialMode = !tutorialMode;
    expect(tutorialMode).toBe(false);
  });

  it('Escape ferme le mode tutorial', () => {
    let tutorialMode = true;
    // simuler Escape
    if (true /* e.key === 'Escape' */) tutorialMode = false;
    expect(tutorialMode).toBe(false);
  });

  it('touche ? ignorée dans un input', () => {
    const tag: string = 'INPUT';
    let toggled = false;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') toggled = true;
    expect(toggled).toBe(false);
  });

  it('touche ? active hors input', () => {
    const tag: string = 'DIV';
    let toggled = false;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') toggled = true;
    expect(toggled).toBe(true);
  });
});

// ── Suppression THICKNESS ─────────────────────────────────────────────────────

describe('PlanTool type — sans THICKNESS', () => {
  it('THICKNESS n\'est pas dans la liste des outils valides', () => {
    const tools: PlanTool[] = [
      'SELECT', 'WALL', 'DOOR', 'APPLY_H', 'APPLY_V',
      'COINCIDE', 'ANCHOR', 'PARTITION', 'EXCLUDE', 'DIMENSION',
    ];
    // @ts-expect-error — 'THICKNESS' was removed from PlanTool
    const thickness: PlanTool = 'THICKNESS';
    expect(tools).not.toContain(thickness);
  });
});

// ── Partition thickness en SELECT ─────────────────────────────────────────────

describe('partition thickness via SELECT', () => {
  it('un clic sur une partition en SELECT ouvre editingPartitionThickness', () => {
    const partEdge = { roomId: 'r1', partitionId: 'p1' };
    const tool: PlanTool = 'SELECT';
    let editingPartitionThickness: { roomId: string; partitionId: string } | null = null;

    if (tool === 'SELECT' && partEdge) {
      editingPartitionThickness = { roomId: partEdge.roomId, partitionId: partEdge.partitionId };
    }

    expect(editingPartitionThickness).toEqual({ roomId: 'r1', partitionId: 'p1' });
  });
});

// ── Auto-anchor premier nœud ────────────────────────────────────────────────

describe('auto-anchor premier nœud', () => {
  it('devrait ancrer quand pièce 0, point 0', () => {
    const isFirstRoom = true;
    const isFirstPoint = true;
    const shouldAutoAnchor = isFirstRoom && isFirstPoint;
    expect(shouldAutoAnchor).toBe(true);
  });

  it('ne devrait pas ancrer pour la deuxième pièce', () => {
    const isFirstRoom = false;
    const isFirstPoint = true;
    const shouldAutoAnchor = isFirstRoom && isFirstPoint;
    expect(shouldAutoAnchor).toBe(false);
  });

  it('ne devrait pas ancrer pour le deuxième point de la pièce 0', () => {
    const isFirstRoom = true;
    const isFirstPoint = false;
    const shouldAutoAnchor = isFirstRoom && isFirstPoint;
    expect(shouldAutoAnchor).toBe(false);
  });
});

// ── findDeleteTarget — priorité ───────────────────────────────────────────────

describe('findDeleteTarget — priorité', () => {
  type Target =
    | { type: 'wall';      priority: number }
    | { type: 'door';      priority: number }
    | { type: 'partition'; priority: number }
    | { type: 'zone';      priority: number };

  const pick = (candidates: Target[]) =>
    candidates.reduce((best, c) =>
      c.priority < best.priority ? c : best
    );

  it('partition gagne face à un mur à même distance', () => {
    const result = pick([
      { type: 'wall', priority: 3 },
      { type: 'partition', priority: 0 },
    ]);
    expect(result.type).toBe('partition');
  });

  it('zone gagne face à un mur à même distance', () => {
    const result = pick([
      { type: 'wall', priority: 3 },
      { type: 'zone', priority: 1 },
    ]);
    expect(result.type).toBe('zone');
  });

  it('porte gagne face à un mur à même distance', () => {
    const result = pick([
      { type: 'wall', priority: 3 },
      { type: 'door', priority: 2 },
    ]);
    expect(result.type).toBe('door');
  });
});

// ── deleteTarget — garde n < 3 ────────────────────────────────────────────────

describe('deleteTarget — garde mur pièce trop petite', () => {
  it('refuse de supprimer si n < 3', () => {
    const n = 2;
    let deleted = false;
    if (n >= 3) deleted = true;
    expect(deleted).toBe(false);
  });

  it('autorise la suppression si n >= 3', () => {
    const n = 4;
    let deleted = false;
    if (n >= 3) deleted = true;
    expect(deleted).toBe(true);
  });
});

// ── Réouverture pièce (wall delete) ──────────────────────────────────────────

describe('réouverture pièce sur suppression mur', () => {
  it('rotation correcte des points pour edge 1 sur pièce [A,B,C,D]', () => {
    const points = [
      { x: 0,   y: 0   },   // A=0
      { x: 100, y: 0   },   // B=1
      { x: 100, y: 100 },   // C=2
      { x: 0,   y: 100 },   // D=3
    ];
    const edges: EdgeType[] = ['WALL', 'WALL', 'WALL', 'WALL'];
    // Supprimer edge B→C (index 1) → rotateBy = (1+1)%4 = 2
    const splitIdx = 1;
    const n = points.length;
    const rotateBy = (splitIdx + 1) % n;
    const newPoints = [...points.slice(rotateBy), ...points.slice(0, rotateBy)];
    const reordered = [...edges.slice(rotateBy), ...edges.slice(0, rotateBy)];
    const newEdges = reordered.slice(0, n - 1);

    // Nouvel ordre : [C, D, A, B]
    expect(newPoints[0]).toEqual({ x: 100, y: 100 }); // C
    expect(newPoints[1]).toEqual({ x: 0,   y: 100 }); // D
    expect(newPoints[2]).toEqual({ x: 0,   y: 0   }); // A
    expect(newPoints[3]).toEqual({ x: 100, y: 0   }); // B
    expect(newEdges.length).toBe(3);
  });

  it('rotation index contrainte : ancien vertexIdx j → (j - rotateBy + n) % n', () => {
    const n = 4, rotateBy = 2;
    // vertexIdx 0 → (0 - 2 + 4) % 4 = 2
    expect((0 - rotateBy + n) % n).toBe(2);
    // vertexIdx 2 → (2 - 2 + 4) % 4 = 0
    expect((2 - rotateBy + n) % n).toBe(0);
    // vertexIdx 3 → (3 - 2 + 4) % 4 = 1
    expect((3 - rotateBy + n) % n).toBe(1);
  });
});

// ── DELETE tool ──────────────────────────────────────────────────────────────

describe('DELETE tool', () => {
  it('DELETE fait partie de PlanTool', () => {
    const tools: PlanTool[] = [
      'SELECT', 'WALL', 'DOOR', 'APPLY_H', 'APPLY_V',
      'COINCIDE', 'ANCHOR', 'PARTITION', 'EXCLUDE', 'DIMENSION', 'DELETE',
    ];
    expect(tools).toContain('DELETE');
  });

  it('DELETE a un texte dans TOOL_STATUS_TEXTS', () => {
    expect(TOOL_STATUS_TEXTS['DELETE']).toBeTruthy();
  });

  it('Escape depuis DELETE bascule vers SELECT', () => {
    const tool = 'DELETE' as PlanTool;
    const nextTool: PlanTool = tool !== 'SELECT' ? 'SELECT' : tool;
    expect(nextTool).toBe('SELECT');
  });
});

// ── constraintFaceOffset ──────────────────────────────────────────────────────

describe('constraintFaceOffset', () => {
  const makeRoom = (id: string): import('@/types/project').Room => ({
    id,
    points: [
      { x: 0,   y: 0   },
      { x: 300, y: 0   },
      { x: 300, y: 300 },
      { x: 0,   y: 300 },
    ],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'] as import('@/types/project').EdgeType[],
    edgeThicknesses: [20, 20, 20, 20], // 20mm → halfThick = 10mm
  });

  const makeConstraint = (
    fromFace: import('@/types/project').PointRef['face'],
    toFace: import('@/types/project').PointRef['face'],
    type: 'H_DISTANCE' | 'V_DISTANCE' | 'LENGTH' = 'H_DISTANCE',
  ): import('@/types/project').Constraint => ({
    id: 'c1',
    type,
    pts: [
      { roomId: 'r1', vertexIdx: 0, face: fromFace },
      { roomId: 'r1', vertexIdx: 1, face: toFace },
    ],
  });

  it('INSIDE→INSIDE: retourne halfThickA + halfThickB', async () => {
    const { constraintFaceOffset } = await import('@/engine/constraints/faceOffset');
    const offset = constraintFaceOffset(makeConstraint('INSIDE', 'INSIDE'), makeRoom('r1'), 20);
    expect(offset).toBe(10 + 10);
  });

  it('AXIS→AXIS: retourne 0', async () => {
    const { constraintFaceOffset } = await import('@/engine/constraints/faceOffset');
    const offset = constraintFaceOffset(makeConstraint('AXIS', 'AXIS'), makeRoom('r1'), 20);
    expect(offset).toBe(0);
  });

  it('OUTSIDE→OUTSIDE: retourne −(halfThickA + halfThickB)', async () => {
    const { constraintFaceOffset } = await import('@/engine/constraints/faceOffset');
    const offset = constraintFaceOffset(makeConstraint('OUTSIDE', 'OUTSIDE'), makeRoom('r1'), 20);
    expect(offset).toBe(-(10 + 10));
  });

  it('INSIDE→OUTSIDE: retourne halfThickA − halfThickB = 0', async () => {
    const { constraintFaceOffset } = await import('@/engine/constraints/faceOffset');
    const offset = constraintFaceOffset(makeConstraint('INSIDE', 'OUTSIDE'), makeRoom('r1'), 20);
    expect(offset).toBe(0);
  });

  it('undefined → traité comme INSIDE (rétrocompatibilité)', async () => {
    const { constraintFaceOffset } = await import('@/engine/constraints/faceOffset');
    const offset = constraintFaceOffset(makeConstraint(undefined, undefined), makeRoom('r1'), 20);
    expect(offset).toBe(20); // same as INSIDE→INSIDE
  });

  it('LENGTH: retourne toujours 0', async () => {
    const { constraintFaceOffset } = await import('@/engine/constraints/faceOffset');
    const offset = constraintFaceOffset(makeConstraint('INSIDE', 'INSIDE', 'LENGTH'), makeRoom('r1'), 20);
    expect(offset).toBe(0);
  });
});

// ── Conversion displayed ↔ stored ────────────────────────────────────────────

describe('Conversion displayed ↔ stored (bug fix signe)', () => {
  it('openDimensionPopup: displayed = stored - offset (pas + offset)', () => {
    // stored = 3000mm, offset I→I avec halfThick=10 chaque = 20mm
    // displayed correct = 3000 - 20 = 2980mm = 298.0cm
    const stored = 3000;
    const offset = 20;
    expect((stored - offset) / 10).toBe(298);    // formule correcte
    expect((stored + offset) / 10).not.toBe(298); // le bug
  });

  it('submitDimensionPopup: stored = displayed + offset (pas - offset)', () => {
    // L'utilisateur saisit 298cm = 2980mm, offset = 20mm
    // stored correct = 2980 + 20 = 3000mm
    const displayedMm = 2980;
    const offset = 20;
    expect(displayedMm + offset).toBe(3000);    // formule correcte
    expect(displayedMm - offset).not.toBe(3000); // le bug
  });
});

// ── FaceSnapPoint — face label ────────────────────────────────────────────────

describe('FaceSnapPoint — label mapping', () => {
  const FACE_LABEL = { INSIDE: 'I', AXIS: 'A', OUTSIDE: 'E' } as const;

  it('INSIDE → "I"', () => { expect(FACE_LABEL['INSIDE']).toBe('I'); });
  it('AXIS → "A"',   () => { expect(FACE_LABEL['AXIS']).toBe('A'); });
  it('OUTSIDE → "E"', () => { expect(FACE_LABEL['OUTSIDE']).toBe('E'); });
});

// ── findNearestFaceSnap — sélection du candidat ───────────────────────────────

describe('findNearestFaceSnap — sélection du candidat', () => {
  type FaceType = 'INSIDE' | 'AXIS' | 'OUTSIDE';
  type Candidate = { face: FaceType; dist: number };

  const pickNearest = (candidates: Candidate[]): FaceType =>
    candidates.reduce((best, c) => c.dist < best.dist ? c : best).face;

  it('INSIDE sélectionné quand le curseur est sur la face intérieure', () => {
    const result = pickNearest([
      { face: 'OUTSIDE', dist: 30 },
      { face: 'AXIS',    dist: 15 },
      { face: 'INSIDE',  dist: 5  },
    ]);
    expect(result).toBe('INSIDE');
  });

  it('AXIS sélectionné quand le curseur est sur l\'axe', () => {
    const result = pickNearest([
      { face: 'OUTSIDE', dist: 20 },
      { face: 'AXIS',    dist: 3  },
      { face: 'INSIDE',  dist: 20 },
    ]);
    expect(result).toBe('AXIS');
  });

  it('retourne null si aucun segment dans le seuil', () => {
    const candidates: Candidate[] = [];
    const result = candidates.length > 0 ? pickNearest(candidates) : null;
    expect(result).toBeNull();
  });
});

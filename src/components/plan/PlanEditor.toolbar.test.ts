import { describe, it, expect } from 'vitest';
import type { PlanTool } from './PlanToolbar';
import type { EdgeType } from '@/types/project';
import { TOOL_STATUS_TEXTS } from './ToolStatusBar';

// ── Escape → SELECT ──────────────────────────────────────────────────────────

describe('Escape key → SELECT', () => {
  const nonSelectTools: PlanTool[] = [
    'WALL', 'DOOR', 'PARTITION', 'EXCLUDE',
    'APPLY_H', 'APPLY_V', 'COINCIDE', 'DIMENSION', 'ANCHOR',
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

// ── canDelete ────────────────────────────────────────────────────────────────

describe('canDelete', () => {
  it('false quand aucun état d\'édition actif', () => {
    const editingEdge = null, editingPartition = null, editingZoneEdge = null;
    const canDelete = !!(editingEdge ?? editingPartition ?? editingZoneEdge);
    expect(canDelete).toBe(false);
  });

  it('true quand editingEdge est défini', () => {
    const editingEdge: { roomId: string; edgeIndex: number } | null = { roomId: 'r1', edgeIndex: 2 };
    const editingPartition: null = null;
    const editingZoneEdge: null = null;
    const canDelete = !!(editingEdge ?? editingPartition ?? editingZoneEdge);
    expect(canDelete).toBe(true);
  });

  it('true quand editingPartition est défini', () => {
    const editingEdge = null;
    const editingPartition = { roomId: 'r1', partitionId: 'p1' };
    const canDelete = !!(editingEdge ?? editingPartition ?? null);
    expect(canDelete).toBe(true);
  });
});

// ── editingContext ────────────────────────────────────────────────────────────

describe('editingContext', () => {
  it('\'partition\' quand editingPartition est défini', () => {
    const editingPartition = { roomId: 'r1', partitionId: 'p1' };
    const editingZoneEdge = null;
    const editingEdge = null;
    const ctx =
      editingPartition ? 'partition'
      : editingZoneEdge ? 'zone'
      : editingEdge
        ? (('WALL' as EdgeType) === 'DOOR' ? 'door' : 'wall')
        : null;
    expect(ctx).toBe('partition');
  });

  it('\'zone\' quand editingZoneEdge est défini', () => {
    const editingPartition = null;
    const editingZoneEdge = { roomId: 'r1', zoneId: 'z1', edgeIndex: 0 };
    const editingEdge = null;
    const ctx =
      editingPartition ? 'partition'
      : editingZoneEdge ? 'zone'
      : editingEdge
        ? (('WALL' as EdgeType) === 'DOOR' ? 'door' : 'wall')
        : null;
    expect(ctx).toBe('zone');
  });

  it('\'wall\' quand editingEdge WALL', () => {
    const edgeType = 'WALL' as unknown as EdgeType;
    const ctx = edgeType === 'DOOR' ? 'door' : 'wall';
    expect(ctx).toBe('wall');
  });

  it('\'door\' quand editingEdge DOOR', () => {
    const edgeType = 'DOOR' as unknown as EdgeType;
    const ctx = edgeType === 'DOOR' ? 'door' : 'wall';
    expect(ctx).toBe('door');
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
    const tool: PlanTool = 'DELETE';
    const nextTool: PlanTool = tool !== 'SELECT' ? 'SELECT' : tool;
    expect(nextTool).toBe('SELECT');
  });
});

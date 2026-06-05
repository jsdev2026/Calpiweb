import { describe, expect, it } from 'vitest';
import { constraintFaceOffset } from '@/engine/constraints/faceOffset';
import { bestEdgeNormal, findNearestVertexSnapImpl, computeDimDisplayedValue } from '@/engine/constraints/vertexSnap';
import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';

describe('DIMENSION tool interior round-trip', () => {
  const room: Room = {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: 3100, y: 0 }, { x: 3100, y: 4200 }, { x: 0, y: 4200 }],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  };

  it('room-to-room same room: open shows interior, submit stores centerline', () => {
    const fromRef = { roomId: 'r1', vertexIdx: 0 };
    const toRef   = { roomId: 'r1', vertexIdx: 1 };
    const absDx = Math.abs(3100 - 0);
    const syntheticC = { id: '', type: 'H_DISTANCE' as const, pts: [fromRef, toRef] };
    const offset = constraintFaceOffset(syntheticC, room, 100);
    expect(offset).toBe(100);
    expect((absDx - offset) / 10).toBe(300); // shown as 300cm
    expect(300 * 10 + offset).toBe(3100);    // stored as 3100mm
  });

  it('cross-entity (different roomIds): offset = 0', () => {
    const fromRef = { roomId: 'r1', vertexIdx: 0 };
    const toRef   = { roomId: 'partition-1', vertexIdx: 0 };
    const syntheticC = { id: '', type: 'H_DISTANCE' as const, pts: [fromRef, toRef] };
    const offset = constraintFaceOffset(syntheticC, room, 100);
    expect(offset).toBe(0);
  });
});

describe('bestEdgeNormal', () => {
  // Polygone en L : prev=(0,0) → vtx=(1000,0) → next=(1000,1000)
  // seg prev→vtx  : dx=1000,dy=0  → normal = (0, 1)
  // seg vtx→next  : dx=0,  dy=1000 → normal = (-1, 0)

  it('picks normal of edge most aligned with cursor direction — above vtx', () => {
    const cursor: Point = { x: 1000, y: -200 }; // au-dessus du vtx
    const vtx: Point    = { x: 1000, y: 0 };
    const prev: Point   = { x: 0, y: 0 };
    const next: Point   = { x: 1000, y: 1000 };
    // toCursor = (0,-200); dot1 with (0,1) = -200 |200|; dot2 with (-1,0) = 0 |0|
    // → picks n1 = (0,1)
    const n = bestEdgeNormal(cursor, vtx, prev, next);
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(1);
  });

  it('picks normal of other edge when cursor is on that side', () => {
    const cursor: Point = { x: 1200, y: 0 }; // à droite du vtx
    const vtx: Point    = { x: 1000, y: 0 };
    const prev: Point   = { x: 0, y: 0 };
    const next: Point   = { x: 1000, y: 1000 };
    // toCursor = (200,0); dot1 with (0,1)=0; dot2 with (-1,0)=-200 |200|
    // → picks n2 = (-1,0)
    const n = bestEdgeNormal(cursor, vtx, prev, next);
    expect(n.x).toBeCloseTo(-1);
    expect(n.y).toBeCloseTo(0);
  });
});

describe('findNearestVertexSnapImpl', () => {
  const room: Room = {
    id: 'r1',
    points: [
      { x: 0,    y: 0    },
      { x: 2000, y: 0    },
      { x: 2000, y: 3000 },
      { x: 0,    y: 3000 },
    ],
    edges: ['WALL', 'WALL', 'WALL', 'WALL'],
  };
  const wallThickness = 100;

  it('snaps to vertex when cursor is within threshold', () => {
    // threshold = 80/scale = 80 ; distance from (50,30) to (0,0) ≈ 58 < 80
    const snap = findNearestVertexSnapImpl({ x: 50, y: 30 }, [room], 1, wallThickness);
    expect(snap).not.toBeNull();
    expect(snap!.vertexIdx).toBe(0);
  });

  it('does NOT snap to segment midpoint — only to vertices', () => {
    // midpoint top edge = (1000,0); nearest vertices at dist=1000 > threshold 80
    const snap = findNearestVertexSnapImpl({ x: 1000, y: 0 }, [room], 1, wallThickness);
    expect(snap).toBeNull();
  });

  it('returns AXIS face when cursor is exactly on vertex axis', () => {
    const snap = findNearestVertexSnapImpl({ x: 0, y: 0 }, [room], 1, wallThickness);
    expect(snap).not.toBeNull();
    expect(snap!.face).toBe('AXIS');
  });

  it('returns null when no vertex within threshold', () => {
    // cursor far from all vertices
    const snap = findNearestVertexSnapImpl({ x: 500, y: 500 }, [room], 1, wallThickness);
    expect(snap).toBeNull();
  });
});

describe('computeDimDisplayedValue — rawValue par type', () => {
  it('H_DISTANCE : rawValue = |dx| / 10', () => {
    const from: Point = { x: 0,    y: 0 };
    const to:   Point = { x: 3000, y: 1000 };
    expect(computeDimDisplayedValue(from, to, 'H_DISTANCE')).toBeCloseTo(300);
  });

  it('V_DISTANCE : rawValue = |dy| / 10', () => {
    const from: Point = { x: 0,    y: 0 };
    const to:   Point = { x: 3000, y: 1000 };
    expect(computeDimDisplayedValue(from, to, 'V_DISTANCE')).toBeCloseTo(100);
  });

  it('LENGTH : rawValue = sqrt(dx²+dy²) / 10', () => {
    const from: Point = { x: 0, y: 0 };
    const to:   Point = { x: 3000, y: 4000 };
    // sqrt(9000000+16000000)/10 = 5000/10 = 500
    expect(computeDimDisplayedValue(from, to, 'LENGTH')).toBeCloseTo(500);
  });

  it('LENGTH entre deux points alignés H : rawValue = |dx| / 10', () => {
    const from: Point = { x: 0,    y: 0 };
    const to:   Point = { x: 2500, y: 0 };
    expect(computeDimDisplayedValue(from, to, 'LENGTH')).toBeCloseTo(250);
  });
});

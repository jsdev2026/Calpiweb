'use client';

import type { AutoCotation, Wall, WallNode } from '@/types/wall';
import type { Point } from '@/types/plan';

export function computeNewNode2(
  wall: Wall,
  nodes: WallNode[],
  newLabelMm: number,
  side: AutoCotation['side'],
): Point {
  const n1 = nodes.find((n) => n.id === wall.node1Id)!;
  const n2 = nodes.find((n) => n.id === wall.node2Id)!;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const dir: Point = len < 1e-10 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };

  const nodeDist =
    side === 'exterior' ? newLabelMm - wall.thickness :
    side === 'interior' ? newLabelMm + wall.thickness :
    newLabelMm;

  return { x: n1.x + dir.x * nodeDist, y: n1.y + dir.y * nodeDist };
}

// Composant UI — sera complété à la Task 2
export const AutoCotationPanel = () => null;

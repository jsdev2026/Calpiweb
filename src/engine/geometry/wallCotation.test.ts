import { describe, it, expect } from 'vitest';
import { detectClosedPolygons, computeAutoCotations } from './wallCotation';
import type { Wall, WallNode, AutoCotation } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }
function w(id: string, n1: string, n2: string, t = 10): Wall {
  return { id, node1Id: n1, node2Id: n2, thickness: t };
}

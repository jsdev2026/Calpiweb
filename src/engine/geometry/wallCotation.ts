import type { Wall, WallNode, AutoCotation } from '@/types/wall';
import type { Point } from '@/types/plan';
import { computeCornerGeometry } from './wallGeometry';
import { formatCm } from '@/utils/formatters';

// ── Constantes ────────────────────────────────────────────────────────────
const COTE_OFFSET_EXT = 400; // mm depuis la face extérieure
const COTE_OFFSET_INT = 200; // mm depuis la face intérieure, vers l'intérieur
const COTE_OFFSET_ISO = 300; // mm depuis l'axe, mur isolé

// ── Helpers géométriques ──────────────────────────────────────────────────

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function dist(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

function nodePos(id: string, nodes: WallNode[]): Point {
  const n = nodes.find((n) => n.id === id);
  return n ? { x: n.x, y: n.y } : { x: 0, y: 0 };
}

function wallDir(wall: Wall, nodes: WallNode[]): Point {
  const p1 = nodePos(wall.node1Id, nodes);
  const p2 = nodePos(wall.node2Id, nodes);
  const dx = p2.x - p1.x, dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return len < 1e-10 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };
}

// ── detectClosedPolygons ──────────────────────────────────────────────────

/**
 * Trouve les polygones fermés simples dans le graphe de murs.
 * Limitation MVP : abandonne si un nœud a plus d'une arête disponible (T-junction).
 */
export function detectClosedPolygons(
  walls: Wall[],
  nodes: WallNode[],
): Array<{ wallIds: string[]; nodeIds: string[] }> {
  // Adjacence : nodeId → [{wallId, otherNodeId}]
  const adj = new Map<string, { wallId: string; otherNodeId: string }[]>();
  for (const wall of walls) {
    for (const [from, to] of [[wall.node1Id, wall.node2Id], [wall.node2Id, wall.node1Id]] as [string, string][]) {
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from)!.push({ wallId: wall.id, otherNodeId: to });
    }
  }

  const result: Array<{ wallIds: string[]; nodeIds: string[] }> = [];
  const visitedWalls = new Set<string>();

  for (const wall of walls) {
    if (visitedWalls.has(wall.id)) continue;

    const startNodeId = wall.node1Id;
    const wallIds = [wall.id];
    const nodeIds = [startNodeId];
    let current = wall.node2Id;
    let prev = startNodeId;
    let valid = true;

    while (current !== startNodeId) {
      if (nodeIds.includes(current)) { valid = false; break; }
      nodeIds.push(current);

      const edges = (adj.get(current) ?? []).filter((e) => e.otherNodeId !== prev);
      if (edges.length !== 1 || visitedWalls.has(edges[0]!.wallId)) {
        valid = false; break;
      }

      wallIds.push(edges[0]!.wallId);
      prev = current;
      current = edges[0]!.otherNodeId;

      if (wallIds.length > walls.length) { valid = false; break; }
    }

    if (valid && wallIds.length >= 3) {
      for (const wId of wallIds) visitedWalls.add(wId);
      result.push({ wallIds, nodeIds });
    }
  }

  return result;
}

// ── computeAutoCotations ──────────────────────────────────────────────────
// Placeholder — implemented in Task 3
export function computeAutoCotations(
  _walls: Wall[],
  _nodes: WallNode[],
): AutoCotation[] {
  return [];
}

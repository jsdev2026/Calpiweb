import type { Point } from './plan';
import type { TilingConfig } from './tiling';

export type EdgeType = 'WALL' | 'DOOR';

export interface Room {
  id: string;
  name?: string;
  points: Point[];
  edges: EdgeType[];
}

// ── Constraint system ──────────────────────────────────────────────────────

export type ConstraintType =
  | 'FIX'           // anchor a vertex at a fixed position
  | 'COINCIDENT'    // two vertices must occupy the same point
  | 'HORIZONTAL'    // two vertices share the same Y
  | 'VERTICAL'      // two vertices share the same X
  | 'LENGTH'        // fixed Euclidean distance between two vertices
  | 'POINT_ON_LINE' // vertex projected onto a line (defined by two other vertices)

export interface PointRef {
  roomId: string;
  vertexIdx: number;
}

export interface Constraint {
  id: string;
  type: ConstraintType;
  // FIX: [p]  |  HORIZONTAL/VERTICAL/COINCIDENT/LENGTH: [p1, p2]  |  POINT_ON_LINE: [point, lineP1, lineP2]
  pts: PointRef[];
  value?: number | { x: number; y: number }; // LENGTH → mm distance; FIX → {x,y} anchor coords
}

// ── Project ────────────────────────────────────────────────────────────────

export type ProjectStatus = 'new' | 'wip' | 'done';

export interface ClientInfo {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface ProjectNote {
  id: string;
  text: string;
  createdAt: number;
  authorName: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  client?: ClientInfo;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  rooms: Room[];
  config: TilingConfig;
  wallThickness: number;
  constraints: Constraint[];
  notes: ProjectNote[];
}

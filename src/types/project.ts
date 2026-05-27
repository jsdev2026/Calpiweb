import type { Point } from './plan';
import type { TilingConfig } from './tiling';
import type { TilingDimension } from './tilingDimension';
import type { MyRole, ProjectLock } from './sharing';

export type { TilingDimension };

export type EdgeType = 'WALL' | 'DOOR';

export interface Partition {
  id: string;
  p1: Point;
  p2: Point;
  thickness: number;
}

export interface ExcludedZone {
  id: string;
  points: Point[];
  label?: string;
}

export interface Room {
  id: string;
  name?: string;
  points: Point[];
  edges: EdgeType[];
  edgeThicknesses?: (number | undefined)[];
  partitions?: Partition[];
  excludedZones?: ExcludedZone[];
}

// ── Constraint system ──────────────────────────────────────────────────────

export type ConstraintType =
  | 'FIX'           // anchor a vertex at a fixed position
  | 'COINCIDENT'    // two vertices must occupy the same point
  | 'HORIZONTAL'    // two vertices share the same Y
  | 'VERTICAL'      // two vertices share the same X
  | 'LENGTH'        // fixed Euclidean distance between two vertices
  | 'H_DISTANCE'    // fixed horizontal distance |x2 - x1|
  | 'V_DISTANCE'    // fixed vertical distance |y2 - y1|
  | 'POINT_ON_LINE' // vertex projected onto a line (defined by two other vertices)

export interface PointRef {
  roomId: string;
  vertexIdx: number;
  face?: 'INSIDE' | 'AXIS' | 'OUTSIDE';
  // absent / undefined → 'INSIDE' (backward compatible)
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
  tilingDimensions?: TilingDimension[];
  myRole?: MyRole;
  lock?: ProjectLock | null;
}

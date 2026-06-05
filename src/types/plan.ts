export interface Point {
  x: number;
  y: number;
}

export type Plan = Point[];

export interface FaceSnapPoint {
  roomId: string;
  vertexIdx: number;
  face: 'INSIDE' | 'AXIS' | 'OUTSIDE';
  worldPos: Point;
  wallNormal: Point; // unit vector perpendicular to wall segment, toward interior
}

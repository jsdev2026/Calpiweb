// src/engine/quantities/types.ts
import type { Tile } from '@/types/tiling';

export type TileEdgeSide = 'factory' | 'cut';

export interface PieceEdges {
  left: TileEdgeSide;
  right: TileEdgeSide;
  top: TileEdgeSide;
  bottom: TileEdgeSide;
}

export interface CutRecord {
  id: string;
  roomId: string;
  /** Dimensions réelles de la tuile source (orientation bâton rompu prise en compte) */
  tileW: number;
  tileH: number;
  /** Bounding box de la partie utilisée */
  usedW: number;
  usedH: number;
  pieceEdges: PieceEdges;
  /** Chute récupérable (0×0 si < MIN_CHUTE_MM sur un axe) */
  chuteW: number;
  chuteH: number;
  chuteEdges: PieceEdges;
  chuteArea: number;
  /** Centre de la pièce coupée pour annotation plan */
  clipCx: number;
  clipCy: number;
  /** Liens de réutilisation (remplis par assignOffcuts) */
  coveredById: string | null;
  reusedForId: string | null;
}

export interface CutGroup {
  usedW: number;
  usedH: number;
  pieceEdges: PieceEdges;
  chuteW: number;
  chuteH: number;
  chuteEdges: PieceEdges;
  totalCount: number;
  reuseCount: number;
  netTiles: number;
}

export interface ConsumableItem {
  total: number;       // quantité totale (kg pour colle/joint, unités pour croisillons)
  bags: number;        // nombre de conditionnements, arrondi au-dessus
  bagSize: number;     // taille d'un conditionnement (kg ou unités)
  rendement: number;   // rendement unitaire (kg/m² ou unités/carreau)
}

export interface Consumables {
  colle: ConsumableItem;
  joint: ConsumableItem;
  croisillons: ConsumableItem;
}

export interface QuantityResult {
  tileW: number;
  tileH: number;
  joint: number;
  wholeCount: number;
  cuts: CutRecord[];
  cutGroups: CutGroup[];
  totalReuseCount: number;
  tilesForCuts: number;
  totalTiles: number;
  toOrder: number;
  margin: number;          // marge appliquée, ex. 0.05 pour 5%
  roomArea: number;
  tiles: Tile[];
  consumables: Consumables;
}

import type { Point } from '@/types/plan';

export type TileLayout = 'STRAIGHT' | 'HERRINGBONE' | 'CHEVRON';

export interface ConsumableParams {
  tileThickness?: number; // mm, défaut 10
  colleRendement?: number; // kg/m², défaut 4
  colleBagSize?: number; // kg/sac, défaut 25
  jointRendement?: number; // kg/m², si défini = override ISO 13007
  jointBagSize?: number; // kg/sac, défaut 5
  croisillonsBagSize?: number; // unités/sachet, défaut 200
  /** Carreaux par carton (conditionnement du fabricant) : affiche le nombre de cartons */
  tilesPerBox?: number;
  /** Plinthes ajoutées à la commande */
  skirting?: boolean;
  /** Longueur d'une plinthe (mm), défaut 600 */
  skirtingPieceLength?: number;
}

export interface TilingConfig {
  width: number;
  height: number;
  joint: number;
  offsetX: number;
  offsetY: number;
  stagger: number;
  angle: number;
  chevronAngle: number;
  color: string;
  layout: TileLayout;
  marginOverride?: number; // si défini, remplace la marge auto-calibrée
  /** Affiche et cote le carreau de départ (repère de pose pour le chantier) */
  showStartTile?: boolean;
  /**
   * Carreau de départ choisi par l'utilisateur : centre du carreau dans le repère des
   * carreaux, moins le décalage de pose (le repère suit donc la pose quand on la fait glisser).
   * Absent → choix automatique dans l'angle haut-gauche de chaque pièce.
   */
  startTile?: { x: number; y: number };
  consumableParams?: ConsumableParams;
}

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TileType = 'WHOLE' | 'CUT' | 'OUTSIDE';

export interface Tile {
  id: string;
  rect: TileRect;
  type: TileType;
  points?: Point[];
}

export interface TilingStats {
  whole: number;
  cuts: number;
  total: number;
  toOrder: number;
  roomArea: number;
  wastePercent: number;
}

export interface TilingResult {
  tiles: Tile[];
  stats: TilingStats | null;
}

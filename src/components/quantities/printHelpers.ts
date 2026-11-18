// Fonctions pures du document imprimé (PDF du quantitatif).
import type { Project, Room } from '@/types/project';
import type { CutRecord, QuantityResult } from '@/engine/quantities/quantityEngine';
import {
  mergeSimilarCutGroups,
  type MergedCutGroup,
} from '@/engine/quantities/mergeSimilarCutGroups';
import { getBoundingBox, insetRoomPolygon } from '@/engine/geometry/polygon';
import type { Point } from '@/types/plan';

export const printCm = (mm: number) => `${(mm / 10).toFixed(1).replace('.', ',')} cm`;
export const printM2 = (mm2: number) => `${(mm2 / 1e6).toFixed(2).replace('.', ',')} m²`;
export const printNb = (n: number) => n.toLocaleString('fr-FR');

/** Libellé du type de pose */
export function poseLabel(config: Project['config']): string {
  if (config.layout === 'HERRINGBONE') return 'Bâton rompu';
  if (config.layout === 'CHEVRON') return 'Chevron';
  if (config.stagger >= 45) return 'Pose décalée 1/2';
  if (config.stagger >= 25) return 'Pose décalée 1/3';
  return 'Pose droite';
}

/** Référence du document : CP-<année de création>-<6 premiers caractères de l'identifiant> */
export function documentRef(project: Pick<Project, 'id' | 'createdAt'>, now = new Date()): string {
  const year = project.createdAt ? new Date(project.createdAt).getFullYear() : now.getFullYear();
  const code = project.id
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 6)
    .toUpperCase();
  return `CP-${year}-${code}`;
}

const edgeKey = (w: number, h: number, e: CutRecord['pieceEdges']) =>
  `${w}×${h}|${e.left}|${e.right}|${e.top}|${e.bottom}`;

/**
 * Repères des coupes (1, 2, …) : les groupes fusionnés du tableau, et pour chaque coupe du
 * plan le numéro de son groupe — le plan et le tableau affichent donc les mêmes numéros.
 */
export function cutNumbers(result: QuantityResult): {
  groups: MergedCutGroup[];
  numberOf: (cut: CutRecord) => number | undefined;
} {
  const groups = mergeSimilarCutGroups(result.cutGroups);
  const byOriginal = new Map<number, number>();
  groups.forEach((g, k) => g.originalIndices.forEach((o) => byOriginal.set(o, k + 1)));
  const byKey = new Map<string, number>();
  result.cutGroups.forEach((g, i) => {
    const n = byOriginal.get(i);
    if (n !== undefined) byKey.set(edgeKey(g.usedW, g.usedH, g.pieceEdges), n);
  });
  return { groups, numberOf: (c) => byKey.get(edgeKey(c.usedW, c.usedH, c.pieceEdges)) };
}

/** Nom du mur sur lequel tombe le pied d'une cote (côté le plus proche de la pièce). */
export function wallName(p: Point, room: Room, wallThickness: number): string {
  const b = getBoundingBox(insetRoomPolygon(room, wallThickness));
  const sides: [number, string][] = [
    [Math.abs(p.x - b.minX), 'mur de gauche'],
    [Math.abs(p.x - b.maxX), 'mur de droite'],
    [Math.abs(p.y - b.minY), 'mur du haut'],
    [Math.abs(p.y - b.maxY), 'mur du bas'],
  ];
  return sides.sort((a, c) => a[0] - c[0])[0]![1];
}

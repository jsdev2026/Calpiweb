import { mmToCm, mm2ToM2 } from './units';

export const formatCm = (mm: number): string => `${mmToCm(mm).toFixed(1)} cm`;

export const formatM2 = (mm2: number): string => `${mm2ToM2(mm2).toFixed(2)} m²`;

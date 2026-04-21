export const MM_PER_CM = 10;
export const MM_PER_M = 1000;
export const MM2_PER_M2 = 1_000_000;

export const cmToMm = (cm: number): number => cm * MM_PER_CM;
export const mmToCm = (mm: number): number => mm / MM_PER_CM;

export const mm2ToM2 = (mm2: number): number => mm2 / MM2_PER_M2;

export const worldToScreen = (world: number, scale: number, pan: number): number =>
  world * scale + pan;

export const screenToWorld = (screen: number, scale: number, pan: number): number =>
  (screen - pan) / scale;

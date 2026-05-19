// src/components/plan/useDraggableSnap.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

export type SnapZone = 'SIDE' | 'TOP' | 'BOTTOM';

function getZoneCenters(): Record<SnapZone, { x: number; y: number }> {
  const w = typeof window !== 'undefined' ? window.innerWidth  : 1280;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  return {
    SIDE:   { x: 80,    y: 160 },
    TOP:    { x: w / 2, y: 40 },
    BOTTOM: { x: w / 2, y: h - 40 },
  };
}

function computeNearestZone(x: number, y: number): SnapZone {
  const centers = getZoneCenters();
  let best: SnapZone = 'SIDE';
  let bestDist = Infinity;
  for (const [zone, c] of Object.entries(centers) as [SnapZone, { x: number; y: number }][]) {
    const d = Math.hypot(x - c.x, y - c.y);
    if (d < bestDist) { bestDist = d; best = zone; }
  }
  return best;
}

interface UseDraggableSnapOptions {
  storageKey: string;
  defaultZone: SnapZone;
}

export function useDraggableSnap({ storageKey, defaultZone }: UseDraggableSnapOptions) {
  const [zone, setZone] = useState<SnapZone>(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    return (stored as SnapZone | null) ?? defaultZone;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [nearestZone, setNearestZone] = useState<SnapZone | null>(null);
  const isDraggingRef = useRef(isDragging);
  useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);

  const handlePointerDown = useCallback((e: ReactPointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
  }, []);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    setNearestZone(computeNearestZone(e.clientX, e.clientY));
  }, []);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    const snapped = computeNearestZone(e.clientX, e.clientY);
    setZone(snapped);
    setNearestZone(null);
    setIsDragging(false);
    localStorage.setItem(storageKey, snapped);
  }, [storageKey]);

  useEffect(() => {
    if (!isDragging) return;
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup',   handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup',   handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  return { zone, isDragging, handlePointerDown, nearestZone };
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { Tile } from '@/types/tiling';
import type { DimDirection, TilingDimension } from '@/types/tilingDimension';
import { generateId } from '@/utils/id';
import { getBoundingBox } from '@/engine/geometry/polygon';
import { useProjectStore } from '@/store/projectStore';
import { snapToTiling, getParallelAngle } from '@/engine/tiling/snapTiling';
import type { SnapResult } from '@/engine/tiling/snapTiling';

type Phase = 'picking_start' | 'picking_end';
const PERP_OFFSET = 600;
const DIR_CYCLE: DimDirection[] = ['H', 'V', 'parallel'];

function computePerpOffset(
  rx1: number, ry1: number, rx2: number, ry2: number,
  rooms: Room[],
): number {
  const dx = rx2 - rx1;
  const dy = ry2 - ry1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return PERP_OFFSET;
  const nx = -dy / len;
  const ny = dx / len;
  const midX = (rx1 + rx2) / 2;
  const midY = (ry1 + ry2) / 2;
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  if (validRooms.length === 0) return PERP_OFFSET;
  let cx = 0, cy = 0;
  for (const r of validRooms) {
    const bb = getBoundingBox(r.points);
    cx += (bb.minX + bb.maxX) / 2;
    cy += (bb.minY + bb.maxY) / 2;
  }
  cx /= validRooms.length;
  cy /= validRooms.length;
  const dot = (cx - midX) * nx + (cy - midY) * ny;
  return dot > 0 ? -PERP_OFFSET : PERP_OFFSET;
}

export interface DimPreview {
  p1: Point;
  p2: Point;
  direction: DimDirection;
  parallelAngle?: number;
  perpOffset: number;
}

export function useTilingDimension(
  rooms: Room[],
  tiles: Tile[],
  wallThickness: number,
  scale: number,
  active: boolean,
): {
  hoverSnap: SnapResult | null;
  preview: DimPreview | null;
  onPointerMove: (worldPt: Point) => void;
  onClick: (worldPt: Point, ctrlHeld: boolean) => void;
  onContextMenu: (dimId: string) => void;
} {
  const addTilingDimension = useProjectStore((s) => s.addTilingDimension);
  const removeTilingDimension = useProjectStore((s) => s.removeTilingDimension);

  const [phase, setPhase] = useState<Phase>('picking_start');
  const [p1, setP1] = useState<Point | null>(null);
  const [hoverSnap, setHoverSnap] = useState<SnapResult | null>(null);
  const [autoDirection, setAutoDirection] = useState<DimDirection>('H');
  const [manualDirection, setManualDirection] = useState<DimDirection | null>(null);

  useEffect(() => {
    if (!active) {
      setPhase('picking_start');
      setP1(null);
      setHoverSnap(null);
      setAutoDirection('H');
      setManualDirection(null);
    }
  }, [active]);

  const effectiveDirection = manualDirection ?? autoDirection;

  const preview: DimPreview | null = (() => {
    if (phase !== 'picking_end' || p1 === null || hoverSnap === null) return null;
    const dir = effectiveDirection;
    const target = hoverSnap.point;
    const parallelAngle = dir === 'parallel' ? (getParallelAngle(p1, rooms, wallThickness) ?? 0) : undefined;

    let rx2: number, ry2: number;
    if (dir === 'H') {
      rx2 = target.x; ry2 = p1.y;
    } else if (dir === 'V') {
      rx2 = p1.x; ry2 = target.y;
    } else {
      const angle = parallelAngle ?? 0;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const proj = (target.x - p1.x) * cos + (target.y - p1.y) * sin;
      rx2 = p1.x + proj * cos;
      ry2 = p1.y + proj * sin;
    }

    return {
      p1,
      p2: target,
      direction: dir,
      parallelAngle,
      perpOffset: computePerpOffset(p1.x, p1.y, rx2, ry2, rooms),
    };
  })();

  const onPointerMove = useCallback(
    (worldPt: Point) => {
      if (!active) return;
      const snap = snapToTiling(worldPt, rooms, tiles, wallThickness, scale);
      setHoverSnap(snap);
      if (phase === 'picking_end' && snap && p1 !== null && manualDirection === null) {
        const dx = snap.point.x - p1.x;
        const dy = snap.point.y - p1.y;
        setAutoDirection(Math.abs(dx) >= Math.abs(dy) ? 'H' : 'V');
      }
    },
    [active, rooms, tiles, wallThickness, scale, phase, p1, manualDirection],
  );

  const onClick = useCallback(
    (worldPt: Point, ctrlHeld: boolean) => {
      if (!active) return;
      const snap = snapToTiling(worldPt, rooms, tiles, wallThickness, scale);
      const target = snap?.point ?? worldPt;

      if (phase === 'picking_start') {
        setP1(target);
        setPhase('picking_end');
        setManualDirection(null);
        setAutoDirection('H');
        return;
      }

      // picking_end
      if (ctrlHeld) {
        const current = manualDirection ?? autoDirection;
        const idx = DIR_CYCLE.indexOf(current);
        setManualDirection(DIR_CYCLE[(idx + 1) % DIR_CYCLE.length]!);
        return;
      }

      if (p1 === null) return;
      const dir = manualDirection ?? autoDirection;
      const parallelAngle =
        dir === 'parallel' ? (getParallelAngle(p1, rooms, wallThickness) ?? 0) : undefined;

      // Compute rendered line endpoints
      let rx2: number, ry2: number;
      if (dir === 'H') {
        rx2 = target.x; ry2 = p1.y;
      } else if (dir === 'V') {
        rx2 = p1.x; ry2 = target.y;
      } else {
        const angle = parallelAngle ?? 0;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const proj = (target.x - p1.x) * cos + (target.y - p1.y) * sin;
        rx2 = p1.x + proj * cos;
        ry2 = p1.y + proj * sin;
      }

      const perpOffset = computePerpOffset(p1.x, p1.y, rx2, ry2, rooms);

      const dim: TilingDimension = {
        id: generateId(),
        p1,
        p2: target,
        direction: dir,
        ...(parallelAngle !== undefined ? { parallelAngle } : {}),
        perpOffset,
      };

      addTilingDimension(dim);
      setPhase('picking_start');
      setP1(null);
      setHoverSnap(null);
      setManualDirection(null);
      setAutoDirection('H');
    },
    [active, rooms, tiles, wallThickness, scale, phase, p1, manualDirection, autoDirection, addTilingDimension],
  );

  const onContextMenu = useCallback(
    (dimId: string) => {
      removeTilingDimension(dimId);
    },
    [removeTilingDimension],
  );

  return { hoverSnap, preview, onPointerMove, onClick, onContextMenu };
}

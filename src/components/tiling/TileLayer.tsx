'use client';

import { useId } from 'react';
import type { Room } from '@/types/project';
import type { TilingConfig } from '@/types/tiling';
import type { DoorOpening } from '@/types/wall';
import type { CutRecord, QuantityResult } from '@/engine/quantities/quantityEngine';
import { getBoundingBox, insetRoomPolygon } from '@/engine/geometry/polygon';
import { partitionToPolygon } from '@/engine/tiling/tilingEngine';
import { GROUP_COLORS } from '@/components/quantities/CutGroupCard';

function doorRectPath(door: DoorOpening): string {
  const dx = door.to.x - door.from.x,
    dy = door.to.y - door.from.y;
  const L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1) return '';
  const px = (-dy / L) * (door.thickness / 2),
    py = (dx / L) * (door.thickness / 2);
  const pts = [
    { x: door.from.x + px, y: door.from.y + py },
    { x: door.to.x + px, y: door.to.y + py },
    { x: door.to.x - px, y: door.to.y - py },
    { x: door.from.x - px, y: door.from.y - py },
  ];
  return `M ${pts.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;
}

const cutKey = (c: Pick<CutRecord, 'usedW' | 'usedH' | 'pieceEdges'>) =>
  `${c.usedW}×${c.usedH}|${c.pieceEdges.left}|${c.pieceEdges.right}|${c.pieceEdges.top}|${c.pieceEdges.bottom}`;

export interface TileLayerProps {
  rooms: Room[];
  result: QuantityResult;
  config: TilingConfig;
  wallThickness: number;
  doorOpenings?: DoorOpening[];
  /** Mode quantitatif : numéros de groupes de coupe + mise en évidence. */
  showCutLabels?: boolean;
  highlightGroup?: number | null;
}

/**
 * Couche de carreaux en coordonnées monde (mm), à placer dans un <g> déjà
 * transformé (translate + scale) du plan 2D.
 */
export const TileLayer = ({
  rooms,
  result,
  config,
  wallThickness,
  doorOpenings = [],
  showCutLabels = false,
  highlightGroup = null,
}: TileLayerProps) => {
  const uid = useId().replace(/:/g, '');
  const clipId = `tile-layer-clip-${uid}`;
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  if (validRooms.length === 0) return null;

  const bbox = getBoundingBox(validRooms.flatMap((r) => r.points));
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const insets = validRooms.map((r) => insetRoomPolygon(r, wallThickness));

  const cutMap = new Map<string, CutRecord>(result.cuts.map((c) => [c.id, c]));
  const groupMap = new Map(
    result.cutGroups.map((g, i) => [
      cutKey(g),
      { index: i, color: GROUP_COLORS[i % GROUP_COLORS.length]! },
    ]),
  );
  const labelSize = Math.min(config.width, config.height) * 0.15;

  const clipD = [
    ...insets.map((pts) => `M ${pts.map((p) => `${p.x},${p.y}`).join(' L ')} Z`),
    ...validRooms.flatMap((r) =>
      (r.excludedZones ?? []).map((z) => `M ${z.points.map((p) => `${p.x},${p.y}`).join(' L ')} Z`),
    ),
    ...validRooms.flatMap((r) =>
      (r.partitions ?? []).map(
        (pt) =>
          `M ${partitionToPolygon(pt)
            .map((p) => `${p.x},${p.y}`)
            .join(' L ')} Z`,
      ),
    ),
    ...doorOpenings.map(doorRectPath).filter(Boolean),
  ].join(' ');

  return (
    <g className="pointer-events-none" data-testid="tile-layer">
      <defs>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path clipRule="evenodd" fillRule="evenodd" d={clipD} />
        </clipPath>
      </defs>

      {/* Fond = couleur des joints */}
      {insets.map((pts, i) => (
        <polygon
          key={`bg-${i}`}
          points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="var(--tile-joint)"
        />
      ))}
      {doorOpenings.map((door, i) => {
        const d = doorRectPath(door);
        return d ? <path key={`door-bg-${i}`} d={d} fill="var(--tile-joint)" /> : null;
      })}

      <g clipPath={`url(#${clipId})`}>
        <g transform={`rotate(${config.angle}, ${cx}, ${cy})`}>
          {result.tiles.map((tile) => {
            const isWhole = tile.type === 'WHOLE';
            const cut = showCutLabels ? cutMap.get(tile.id) : undefined;
            const group = cut ? groupMap.get(cutKey(cut)) : undefined;
            const groupNumber = group ? group.index + 1 : null;
            const isReused = cut ? cut.coveredById !== null : false;

            const fill = isWhole
              ? config.color
              : showCutLabels && isReused && group
                ? group.color
                : 'var(--tile-cut-bg)';
            const fillOpacity = showCutLabels ? (isWhole ? 0.7 : isReused ? 0.28 : 1) : 1;
            const opacity =
              highlightGroup !== null ? (!isWhole && groupNumber === highlightGroup ? 1 : 0.15) : 1;

            return (
              <g key={tile.id} opacity={opacity}>
                {tile.points ? (
                  <polygon
                    points={tile.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill={fill}
                    fillOpacity={fillOpacity}
                  />
                ) : (
                  <rect
                    x={tile.rect.x}
                    y={tile.rect.y}
                    width={tile.rect.w}
                    height={tile.rect.h}
                    fill={fill}
                    fillOpacity={fillOpacity}
                  />
                )}
                {cut && group && (
                  <>
                    <circle
                      cx={cut.clipCx}
                      cy={cut.clipCy}
                      r={labelSize * 0.62}
                      fill="rgba(0,0,0,0.50)"
                    />
                    <text
                      x={cut.clipCx}
                      y={cut.clipCy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={labelSize}
                      fontWeight="600"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      fill={group.color}
                      transform={`rotate(${-config.angle}, ${cut.clipCx}, ${cut.clipCy})`}
                    >
                      {isReused ? '↩' : group.index + 1}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </g>
    </g>
  );
};

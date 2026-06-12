'use client';
import { useId } from 'react';
import type { QuantityResult, CutRecord } from '@/engine/quantities/quantityEngine';
import type { Room } from '@/types/project';
import type { TilingConfig } from '@/types/tiling';
import type { DoorOpening } from '@/types/wall';
import type { WallPolygon } from '@/engine/geometry/wallGeometry';
import { getBoundingBox } from '@/engine/geometry/polygon';
import { GROUP_COLORS } from './CutGroupCard';

function doorRectPath(door: DoorOpening): string {
  const dx = door.to.x - door.from.x, dy = door.to.y - door.from.y;
  const L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1) return '';
  const px = (-dy / L) * (door.thickness / 2), py = (dx / L) * (door.thickness / 2);
  const pts = [
    { x: door.from.x + px, y: door.from.y + py },
    { x: door.to.x   + px, y: door.to.y   + py },
    { x: door.to.x   - px, y: door.to.y   - py },
    { x: door.from.x - px, y: door.from.y - py },
  ];
  return `M ${pts.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;
}

export interface QuantityPlanSvgProps {
  result: QuantityResult;
  config: TilingConfig;
  rooms: Room[];
  highlightGroup?: number | null;
  /** Prop viewBox externe (ex. état zoom/pan de QuantityPlanView). Si absent, calculé depuis le bounding box. */
  viewBox?: string;
  className?: string;
  style?: React.CSSProperties;
  /**
   * true = couleurs hex fixes (impression, jamais dark mode).
   * false (défaut) = utilise les CSS vars --tile-joint / --tile-cut-bg (suit le thème).
   */
  printMode?: boolean;
  /** Murs (géométrie de coin) — même rendu que les pages Plan/Calepinage. */
  wallPolygons?: WallPolygon[];
  /** Ouvertures de porte — même rendu que les pages Plan/Calepinage. */
  doorOpenings?: DoorOpening[];
}

export const QuantityPlanSvg = ({
  result,
  config,
  rooms,
  highlightGroup = null,
  viewBox: viewBoxProp,
  className = 'h-full w-full',
  style,
  printMode = false,
  wallPolygons = [],
  doorOpenings = [],
}: QuantityPlanSvgProps) => {
  const uid = useId().replace(/:/g, '');
  const clipId = `qty-svg-clip-${uid}`;

  const validRooms = rooms.filter((r) => r.points.length >= 3);
  const allPoints = validRooms.flatMap((r) => r.points);

  if (validRooms.length === 0 || result.tiles.length === 0) return null;

  const bbox = allPoints.length > 0
    ? getBoundingBox(allPoints)
    : { minX: 0, minY: 0, maxX: 1000, maxY: 1000 };
  const pad = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * 0.1;
  const initX = bbox.minX - pad;
  const initY = bbox.minY - pad;
  const initW = bbox.maxX - bbox.minX + pad * 2;
  const initH = bbox.maxY - bbox.minY + pad * 2;

  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;
  const viewBox = viewBoxProp ?? `${initX} ${initY} ${initW} ${initH}`;

  // Couleurs : CSS vars en mode interactif, hex fixes pour l'impression
  const jointColor = printMode ? '#94a3b8' : 'var(--tile-joint)';
  const cutBgColor = printMode ? '#cbd5e1' : 'var(--tile-cut-bg)';
  const wallColor = printMode ? '#64748b' : 'var(--canvas-wall)';

  const cutMap = new Map<string, CutRecord>(result.cuts.map((c) => [c.id, c]));
  const groupMap = new Map(
    result.cutGroups.map((g, i) => [
      `${g.usedW}×${g.usedH}|${g.pieceEdges.left}|${g.pieceEdges.right}|${g.pieceEdges.top}|${g.pieceEdges.bottom}`,
      { index: i, color: GROUP_COLORS[i % GROUP_COLORS.length]! },
    ]),
  );
  const labelSize = Math.min(config.width, config.height) * 0.15;

  return (
    <svg
      viewBox={viewBox}
      className={className}
      style={{ display: 'block', ...style }}
    >
      <defs>
        <clipPath id={clipId}>
          {validRooms.map((room) => (
            <polygon
              key={room.id}
              points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
            />
          ))}
        </clipPath>
      </defs>

      {/* Fond joint entre les carreaux */}
      {validRooms.map((room) => (
        <polygon
          key={`bg-${room.id}`}
          points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill={jointColor}
        />
      ))}

      <g clipPath={`url(#${clipId})`}>
        <g transform={`rotate(${config.angle}, ${cx}, ${cy})`}>
          {result.tiles.map((tile) => {
            const cut = cutMap.get(tile.id);
            const isWhole = tile.type === 'WHOLE';
            const isReused = cut ? cut.coveredById !== null : false;

            const groupInfo = cut
              ? groupMap.get(
                  `${cut.usedW}×${cut.usedH}|${cut.pieceEdges.left}|${cut.pieceEdges.right}|${cut.pieceEdges.top}|${cut.pieceEdges.bottom}`,
                )
              : undefined;
            const groupColor = groupInfo?.color;
            const groupNumber = groupInfo ? groupInfo.index + 1 : null;

            let dimOpacity = 1;
            if (highlightGroup !== null) {
              dimOpacity = !isWhole && groupNumber === highlightGroup ? 1 : 0.12;
            }
            const isHighlighted = highlightGroup !== null && !isWhole && groupNumber === highlightGroup;

            const fill = isWhole
              ? config.color
              : isReused && groupColor
                ? groupColor
                : cutBgColor;
            const fillOpacity = isWhole ? 0.7 : isReused ? 0.28 : 1;

            return (
              <g
                key={tile.id}
                style={{
                  opacity: dimOpacity,
                  transition: 'opacity 0.15s ease, filter 0.15s ease',
                  filter: isHighlighted && groupColor ? `drop-shadow(0 0 8px ${groupColor}88)` : undefined,
                }}
              >
                {tile.points ? (
                  <polygon
                    points={tile.points.map((p) => `${p.x},${p.y}`).join(' ')}
                    fill={fill}
                    fillOpacity={fillOpacity}
                    stroke={printMode ? '#ffffff' : undefined}
                    strokeWidth={printMode ? 1 : undefined}
                    vectorEffect={printMode ? 'non-scaling-stroke' : undefined}
                  />
                ) : (
                  <rect
                    x={tile.rect.x}
                    y={tile.rect.y}
                    width={tile.rect.w}
                    height={tile.rect.h}
                    fill={fill}
                    fillOpacity={fillOpacity}
                    stroke={printMode ? '#ffffff' : undefined}
                    strokeWidth={printMode ? 1 : undefined}
                    vectorEffect={printMode ? 'non-scaling-stroke' : undefined}
                  />
                )}
                {cut && groupInfo && (
                  <>
                    <circle cx={cut.clipCx} cy={cut.clipCy} r={labelSize * 0.62} fill="rgba(0,0,0,0.50)" />
                    <text
                      x={cut.clipCx}
                      y={cut.clipCy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={labelSize}
                      fontWeight="600"
                      fontFamily="system-ui, -apple-system, sans-serif"
                      fill={groupColor ?? '#a1a1aa'}
                    >
                      {isReused ? '↩' : groupInfo.index + 1}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      </g>

      {/* Murs — même géométrie que les pages Plan/Calepinage */}
      {wallPolygons.map((poly) => {
        if (!poly.points.length) return null;
        return (
          <polygon
            key={`wall-${poly.wallId}`}
            points={poly.points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill={wallColor}
          />
        );
      })}

      {/* Portes */}
      {doorOpenings.map((door, i) => {
        const path = doorRectPath(door);
        if (!path) return null;
        return <path key={`door-${i}`} d={path} fill={jointColor} />;
      })}
    </svg>
  );
};

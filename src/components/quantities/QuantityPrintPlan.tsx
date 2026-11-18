'use client';
// Plan d'une pièce pour le PDF : noir et gris, coupes hachurées et numérotées,
// carreau de départ en orange, cotes intérieures de la pièce.
import { useId } from 'react';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import type { Room } from '@/types/project';
import type { TilingConfig } from '@/types/tiling';
import type { DoorOpening } from '@/types/wall';
import type { WallPolygon } from '@/engine/geometry/wallGeometry';
import type { StartTileMark } from '@/engine/tiling/startTile';
import { getBoundingBox, insetRoomPolygon } from '@/engine/geometry/polygon';
import { cutNumbers, printCm } from './printHelpers';
import { PRINT } from './printTheme';

const pts = (p: { x: number; y: number }[]) => p.map((q) => `${q.x},${q.y}`).join(' ');

function doorPolygon(door: DoorOpening): string {
  const dx = door.to.x - door.from.x;
  const dy = door.to.y - door.from.y;
  const L = Math.hypot(dx, dy);
  if (L < 1) return '';
  const px = (-dy / L) * (door.thickness / 2 + 2);
  const py = (dx / L) * (door.thickness / 2 + 2);
  return pts([
    { x: door.from.x + px, y: door.from.y + py },
    { x: door.to.x + px, y: door.to.y + py },
    { x: door.to.x - px, y: door.to.y - py },
    { x: door.from.x - px, y: door.from.y - py },
  ]);
}

export interface QuantityPrintPlanProps {
  room: Room;
  result: QuantityResult;
  config: TilingConfig;
  wallThickness: number;
  /** Murs du moteur de murs (sinon : contour de la pièce à l'épaisseur des murs) */
  wallPolygons?: WallPolygon[];
  doorOpenings?: DoorOpening[];
  start?: StartTileMark;
}

export const QuantityPrintPlan = ({
  room,
  result,
  config,
  wallThickness,
  wallPolygons = [],
  doorOpenings = [],
  start,
}: QuantityPrintPlanProps) => {
  const uid = useId().replace(/:/g, '');
  if (room.points.length < 3 || result.tiles.length === 0) return null;

  const bb = getBoundingBox(room.points);
  const inner = getBoundingBox(insetRoomPolygon(room, wallThickness));
  const size = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY);
  const wt = Math.max(wallThickness, 60);
  const pad = wt + size * 0.11;
  const viewBox = `${bb.minX - pad} ${bb.minY - pad} ${bb.maxX - bb.minX + pad * 2} ${bb.maxY - bb.minY + pad * 2}`;
  const cx = (bb.minX + bb.maxX) / 2;
  const cy = (bb.minY + bb.maxY) / 2;
  const roomPts = pts(room.points);
  const { numberOf } = cutNumbers(result);
  const label = Math.min(config.width, config.height) * 0.26;
  const W = inner.maxX - inner.minX;
  const H = inner.maxY - inner.minY;
  const dimFont = size * 0.028;
  const dimOff = wt + size * 0.05;
  const tick = size * 0.012;
  const hair = { vectorEffect: 'non-scaling-stroke' as const };
  const textStyle = { fontFamily: PRINT.sans };

  return (
    <svg
      viewBox={viewBox}
      data-testid="print-plan"
      style={{ width: '100%', height: 'auto', maxHeight: '125mm', display: 'block' }}
    >
      <defs>
        <clipPath id={`pc-${uid}`}>
          <polygon points={roomPts} />
        </clipPath>
        <pattern
          id={`ph-${uid}`}
          width={60}
          height={60}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={60} height={60} fill="#ffffff" />
          <line x1={0} y1={0} x2={0} y2={60} stroke="#9ca3af" strokeWidth={14} />
        </pattern>
      </defs>

      {/* Joints */}
      <polygon points={roomPts} fill="#9ca3af" />
      <g clipPath={`url(#pc-${uid})`}>
        <g transform={`rotate(${config.angle}, ${cx}, ${cy})`}>
          {result.tiles.map((t) => {
            const fill = t.type === 'WHOLE' ? '#ffffff' : `url(#ph-${uid})`;
            const common = { fill, stroke: '#6b7280', strokeWidth: 0.6, ...hair };
            return t.points ? (
              <polygon key={t.id} points={pts(t.points)} {...common} />
            ) : (
              <rect
                key={t.id}
                x={t.rect.x}
                y={t.rect.y}
                width={t.rect.w}
                height={t.rect.h}
                {...common}
              />
            );
          })}
        </g>
      </g>

      {/* Murs, par-dessus le bord des carreaux */}
      {wallPolygons.length > 0 ? (
        wallPolygons
          .filter((w) => w.points.length)
          .map((w) => <polygon key={w.wallId} points={pts(w.points)} fill={PRINT.wall} />)
      ) : (
        <polygon
          points={roomPts}
          fill="none"
          stroke={PRINT.wall}
          strokeWidth={wt}
          strokeLinejoin="miter"
        />
      )}
      {doorOpenings.map((d, i) => {
        const p = doorPolygon(d);
        return p ? <polygon key={`door-${i}`} points={p} fill="#ffffff" /> : null;
      })}

      {/* Repères de coupe */}
      {result.cuts.map((c) => {
        const n = numberOf(c);
        if (!n) return null;
        return (
          <g key={`n-${c.id}`}>
            <circle
              cx={c.clipCx}
              cy={c.clipCy}
              r={label * 0.72}
              fill="#ffffff"
              stroke={PRINT.ink}
              strokeWidth={1}
              {...hair}
            />
            <text
              x={c.clipCx}
              y={c.clipCy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={label}
              fontWeight={600}
              fill={PRINT.ink}
              style={textStyle}
            >
              {n}
            </text>
          </g>
        );
      })}

      {/* Carreau de départ */}
      {start && (
        <g data-testid="print-start-tile">
          <polygon
            points={pts(start.tile)}
            fill={PRINT.brandLight}
            stroke={PRINT.brand}
            strokeWidth={2.2}
            {...hair}
          />
          {start.cotes.map((c, i) => (
            <line
              key={i}
              x1={c.from.x}
              y1={c.from.y}
              x2={c.to.x}
              y2={c.to.y}
              stroke={PRINT.brand}
              strokeWidth={1}
              strokeDasharray="3 2"
              {...hair}
            />
          ))}
          <text
            x={start.tile.reduce((s, p) => s + p.x, 0) / start.tile.length}
            y={start.tile.reduce((s, p) => s + p.y, 0) / start.tile.length}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={label * 1.1}
            fontWeight={700}
            fill={PRINT.brand}
            style={textStyle}
          >
            D
          </text>
        </g>
      )}

      {/* Cotes intérieures (largeur, profondeur) */}
      <g stroke={PRINT.text} strokeWidth={0.8} fill="none">
        <line
          x1={inner.minX}
          y1={bb.minY - dimOff}
          x2={inner.maxX}
          y2={bb.minY - dimOff}
          {...hair}
        />
        <line
          x1={inner.minX}
          y1={bb.minY - dimOff - tick}
          x2={inner.minX}
          y2={bb.minY - dimOff + tick}
          {...hair}
        />
        <line
          x1={inner.maxX}
          y1={bb.minY - dimOff - tick}
          x2={inner.maxX}
          y2={bb.minY - dimOff + tick}
          {...hair}
        />
        <line
          x1={bb.minX - dimOff}
          y1={inner.minY}
          x2={bb.minX - dimOff}
          y2={inner.maxY}
          {...hair}
        />
        <line
          x1={bb.minX - dimOff - tick}
          y1={inner.minY}
          x2={bb.minX - dimOff + tick}
          y2={inner.minY}
          {...hair}
        />
        <line
          x1={bb.minX - dimOff - tick}
          y1={inner.maxY}
          x2={bb.minX - dimOff + tick}
          y2={inner.maxY}
          {...hair}
        />
      </g>
      <g fontSize={dimFont} fill={PRINT.text} style={textStyle}>
        <text
          x={(inner.minX + inner.maxX) / 2}
          y={bb.minY - dimOff - dimFont * 0.45}
          textAnchor="middle"
        >
          {printCm(W)}
        </text>
        <text
          x={bb.minX - dimOff - dimFont * 0.45}
          y={(inner.minY + inner.maxY) / 2}
          textAnchor="middle"
          transform={`rotate(-90, ${bb.minX - dimOff - dimFont * 0.45}, ${(inner.minY + inner.maxY) / 2})`}
        >
          {printCm(H)}
        </text>
      </g>
    </svg>
  );
};

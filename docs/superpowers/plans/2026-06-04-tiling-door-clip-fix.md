# Calepinage — Fix clip SVG ouvertures de porte

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre visibles les carreaux de porte dans le calepinage en étendant le `<clipPath>` SVG pour inclure les rectangles des ouvertures de porte.

**Architecture:** Une seule tâche — 2 fichiers. `TilingCanvas` reçoit un nouveau prop `doorOpenings`, les rectangles d'ouverture sont ajoutés au `<clipPath>` (evenodd, non-chevauchants avec les pièces → rendus visibles). `TilingEditor` transmet le prop (les ouvertures sont déjà sélectionnées via `useShallow`).

**Tech Stack:** TypeScript, React, SVG.

---

## Fichiers

| Fichier | Action |
|---------|--------|
| `src/components/tiling/TilingCanvas.tsx` | Ajouter prop `doorOpenings`, helper `doorRectPath`, étendre le `<clipPath>` et le fond joint |
| `src/components/tiling/TilingEditor.tsx` | Passer `doorOpenings={doorOpenings}` à `<TilingCanvas>` |

---

## Task 1 : Étendre `TilingCanvas` + câbler `TilingEditor`

**Files:**
- Modify: `src/components/tiling/TilingCanvas.tsx`
- Modify: `src/components/tiling/TilingEditor.tsx`

### Contexte sur le code existant

`TilingCanvas.tsx` (lignes 12-26) — interface actuelle :
```ts
interface TilingCanvasProps {
  svgRef: RefObject<SVGSVGElement>;
  rooms: Room[];
  tiles: Tile[];
  config: TilingConfig;
  scale: number;
  pan: Point;
  activeTool: 'pan' | 'dimension';
  wallThickness: number;
  dimensionLayer: ReactNode;
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
  onClick: (e: MouseEvent<SVGSVGElement>) => void;
}
```

Le `<clipPath>` (lignes 66-87) construit son chemin `d` avec trois spread :
```ts
d={[
  ...validRooms.map((r) =>
    `M ${insetRoomPolygon(r, wallThickness).map((p) => `${p.x},${p.y}`).join(' L ')} Z`
  ),
  ...validRooms.flatMap((r) =>
    (r.excludedZones ?? []).map((z) =>
      `M ${z.points.map((p) => `${p.x},${p.y}`).join(' L ')} Z`
    )
  ),
  ...validRooms.flatMap((r) =>
    (r.partitions ?? []).map((pt) => {
      const poly = partitionToPolygon(pt);
      return `M ${poly.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;
    })
  ),
].join(' ')}
```

Le fond joint des pièces (lignes 90-96) :
```tsx
{validRooms.map((room) => (
  <polygon
    key={`bg-${room.id}`}
    points={insetRoomPolygon(room, wallThickness).map((p) => `${p.x},${p.y}`).join(' ')}
    fill="var(--tile-joint)"
  />
))}
```

`TilingEditor.tsx` ligne 87 :
```ts
const doorOpenings = useProjectStore(useShallow(selectDoorOpenings));
```

`TilingEditor.tsx` lignes 254-268 :
```tsx
<TilingCanvas
  svgRef={svgRef}
  rooms={rooms}
  tiles={result.tiles}
  config={config}
  scale={scale}
  pan={pan}
  activeTool={activeTool}
  wallThickness={wallThickness}
  dimensionLayer={dimensionLayer}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onClick={handleClick}
/>
```

---

- [ ] **Step 1 : Modifier `TilingCanvas.tsx`**

Remplacer le contenu de `src/components/tiling/TilingCanvas.tsx` par la version suivante. Les changements sont :
1. Ajout de l'import `DoorOpening` (ligne 7)
2. Ajout de `doorOpenings?: DoorOpening[]` dans l'interface (ligne 25)
3. Ajout de `doorOpenings = []` dans le destructuring (ligne 41)
4. Ajout de la fonction helper `doorRectPath` (après le destructuring)
5. Ajout des rectangles d'ouverture dans le `<clipPath>` (4ème spread)
6. Ajout du fond joint pour les ouvertures de porte (après les fonds des pièces)

```tsx
'use client';

import type { PointerEvent as ReactPointerEvent, RefObject, ReactNode, MouseEvent } from 'react';
import type { Room } from '@/types/project';
import type { Point } from '@/types/plan';
import type { Tile, TilingConfig } from '@/types/tiling';
import type { DoorOpening } from '@/types/wall';
import { getBoundingBox, insetRoomPolygon } from '@/engine/geometry/polygon';
import { formatCm } from '@/utils/formatters';
import { partitionToPolygon } from '@/engine/tiling/tilingEngine';
import { DimLine } from './DimLine';

interface TilingCanvasProps {
  svgRef: RefObject<SVGSVGElement>;
  rooms: Room[];
  tiles: Tile[];
  config: TilingConfig;
  scale: number;
  pan: Point;
  activeTool: 'pan' | 'dimension';
  wallThickness: number;
  dimensionLayer: ReactNode;
  doorOpenings?: DoorOpening[];
  onPointerDown: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerMove: (e: ReactPointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
  onClick: (e: MouseEvent<SVGSVGElement>) => void;
}

function doorRectPath(door: DoorOpening): string {
  const dx = door.to.x - door.from.x, dy = door.to.y - door.from.y;
  const L = Math.sqrt(dx * dx + dy * dy);
  if (L < 1) return '';
  const px = (-dy / L) * door.thickness, py = (dx / L) * door.thickness;
  const pts = [
    { x: door.from.x + px, y: door.from.y + py },
    { x: door.to.x   + px, y: door.to.y   + py },
    { x: door.to.x   - px, y: door.to.y   - py },
    { x: door.from.x - px, y: door.from.y - py },
  ];
  return `M ${pts.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;
}

export const TilingCanvas = ({
  svgRef,
  rooms,
  tiles,
  config,
  scale,
  pan,
  activeTool,
  wallThickness,
  dimensionLayer,
  doorOpenings = [],
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onClick,
}: TilingCanvasProps) => {
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  const allPoints = validRooms.flatMap((r) => r.points);
  const bbox = getBoundingBox(allPoints.length > 0 ? allPoints : [{ x: 0, y: 0 }]);
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;

  const canShowDims = activeTool === 'dimension' && config.angle === 0 && config.layout === 'STRAIGHT';
  const effectiveAngle = config.angle;

  return (
    <svg
      ref={svgRef}
      className={`h-full w-full ${activeTool === 'dimension' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onClick={onClick}
      onContextMenu={(e) => { if (activeTool === 'dimension') e.preventDefault(); }}
    >
      <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
        <defs>
          <clipPath id="tiledClip" clipPathUnits="userSpaceOnUse">
            <path
              clipRule="evenodd"
              fillRule="evenodd"
              d={[
                ...validRooms.map((r) =>
                  `M ${insetRoomPolygon(r, wallThickness).map((p) => `${p.x},${p.y}`).join(' L ')} Z`
                ),
                ...validRooms.flatMap((r) =>
                  (r.excludedZones ?? []).map((z) =>
                    `M ${z.points.map((p) => `${p.x},${p.y}`).join(' L ')} Z`
                  )
                ),
                ...validRooms.flatMap((r) =>
                  (r.partitions ?? []).map((pt) => {
                    const poly = partitionToPolygon(pt);
                    return `M ${poly.map((p) => `${p.x},${p.y}`).join(' L ')} Z`;
                  })
                ),
                ...doorOpenings.map(doorRectPath).filter(Boolean),
              ].join(' ')}
            />
          </clipPath>
        </defs>

        {validRooms.map((room) => (
          <polygon
            key={`bg-${room.id}`}
            points={insetRoomPolygon(room, wallThickness).map((p) => `${p.x},${p.y}`).join(' ')}
            fill="var(--tile-joint)"
          />
        ))}

        {doorOpenings.map((door, i) => {
          const path = doorRectPath(door);
          if (!path) return null;
          return <path key={`door-bg-${i}`} d={path} fill="var(--tile-joint)" />;
        })}

        <g clipPath="url(#tiledClip)">
          <g transform={`rotate(${effectiveAngle}, ${centerX}, ${centerY})`}>
            {tiles.map((tile) =>
              tile.points ? (
                <polygon
                  key={tile.id}
                  points={tile.points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill={tile.type === 'WHOLE' ? config.color : 'var(--tile-cut-bg)'}
                />
              ) : (
                <rect
                  key={tile.id}
                  x={tile.rect.x}
                  y={tile.rect.y}
                  width={tile.rect.w}
                  height={tile.rect.h}
                  fill={tile.type === 'WHOLE' ? config.color : 'var(--tile-cut-bg)'}
                />
              )
            )}
          </g>
        </g>

        {/* Excluded zones — amber outline */}
        {validRooms.map((room) =>
          (room.excludedZones ?? []).map((zone) => (
            <polygon
              key={`ez-${zone.id}`}
              points={zone.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="rgba(251,191,36,0.10)"
              stroke="#f59e0b"
              strokeWidth={40}
              strokeDasharray="120,80"
              className="pointer-events-none"
            />
          ))
        )}

        {/* Room walls and doors */}
        {validRooms.map((room) =>
          room.points.map((p, i) => {
            const nextP = room.points[(i + 1) % room.points.length]!;
            const isDoor = (room.edges[i] ?? 'WALL') === 'DOOR';
            const edgeThick = room.edgeThicknesses?.[i] ?? wallThickness;
            return (
              <line
                key={`edge-${room.id}-${i}`}
                x1={p.x} y1={p.y} x2={nextP.x} y2={nextP.y}
                stroke={isDoor ? '#f97316' : '#ea580c'}
                strokeWidth={isDoor ? edgeThick * 0.5 : edgeThick}
                strokeLinecap="round"
                strokeDasharray={isDoor ? `${edgeThick * 1.2},${edgeThick * 0.8}` : undefined}
              />
            );
          }),
        )}

        {/* Partitions — filled polygon showing actual thickness */}
        {validRooms.map((room) =>
          (room.partitions ?? []).map((pt) => {
            const poly = partitionToPolygon(pt);
            return (
              <polygon
                key={`part-${pt.id}`}
                points={poly.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="var(--canvas-wall-inact)"
                opacity={0.85}
                stroke="#a78bfa"
                strokeWidth={20}
                className="pointer-events-none"
              />
            );
          })
        )}

        {/* Reference dimensions */}
        {canShowDims && validRooms.map((room) => {
          const pts = room.points;
          if (pts.length < 3) return null;
          const rb = getBoundingBox(pts);
          const roomW = rb.maxX - rb.minX;
          const roomH = rb.maxY - rb.minY;
          const offset = 600;
          return (
            <g key={`dims-${room.id}`}>
              <DimLine
                x1={rb.minX} y1={rb.minY}
                x2={rb.maxX} y2={rb.minY}
                label={formatCm(roomW)}
                perpOffset={-offset}
              />
              <DimLine
                x1={rb.maxX} y1={rb.minY}
                x2={rb.maxX} y2={rb.maxY}
                label={formatCm(roomH)}
                perpOffset={offset}
              />
            </g>
          );
        })}
        {dimensionLayer}
      </g>
    </svg>
  );
};
```

- [ ] **Step 2 : Modifier `TilingEditor.tsx` — passer `doorOpenings`**

Dans `src/components/tiling/TilingEditor.tsx`, trouver le JSX `<TilingCanvas` (ligne ~254) et ajouter le prop `doorOpenings` :

```tsx
<TilingCanvas
  svgRef={svgRef}
  rooms={rooms}
  tiles={result.tiles}
  config={config}
  scale={scale}
  pan={pan}
  activeTool={activeTool}
  wallThickness={wallThickness}
  dimensionLayer={dimensionLayer}
  doorOpenings={doorOpenings}
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onClick={handleClick}
/>
```

- [ ] **Step 3 : TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 4 : Suite de tests**

```
npx vitest run
```

Attendu : 383 tests PASS (le changement est purement visuel/SVG — aucun test unitaire n'existe pour le rendu SVG, la vérification est manuelle).

- [ ] **Step 5 : Commit**

```
git add src/components/tiling/TilingCanvas.tsx src/components/tiling/TilingEditor.tsx
git commit -m "fix(tiling): étendre clipPath aux ouvertures de porte — carreaux visibles dans le passage"
```

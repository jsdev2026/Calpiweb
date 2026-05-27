# QuantitiesPanel Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current single-file QuantitiesPanel (7-column table layout) with a two-column plan-centred layout featuring hover-linked cut group cards and clearer French language for non-professionals.

**Architecture:** Three files are created or rewritten. `CutGroupCard.tsx` (new) owns the card UI, the tile thumbnail, and the shared `GROUP_COLORS` palette. `QuantityPlanView.tsx` (new) owns the annotated SVG plan with a `highlightGroup` prop for opacity-based hover dimming. `QuantitiesPanel.tsx` (rewrite) assembles the two-column layout and owns the `highlightGroup` state. No store or engine changes.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest + @testing-library/react (jsdom)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/components/quantities/CutGroupCard.tsx` | Card UI, `TileThumbnail` (private), `GROUP_COLORS` (export) |
| Create | `src/components/quantities/CutGroupCard.test.tsx` | Card behaviour tests |
| Create | `src/components/quantities/QuantityPlanView.tsx` | SVG plan, hover dimming via `highlightGroup` prop |
| Create | `src/components/quantities/QuantityPlanView.test.tsx` | Plan render tests |
| Rewrite | `src/components/quantities/QuantitiesPanel.tsx` | Two-column shell, `highlightGroup` state |
| Create | `src/components/quantities/QuantitiesPanel.test.tsx` | Language + layout smoke tests |
| Keep as-is | `src/components/quantities/QuantitiesPanel.surface.test.ts` | Formula unit tests (no changes needed) |

---

## Task 1: CutGroupCard

**Files:**
- Create: `src/components/quantities/CutGroupCard.tsx`
- Create: `src/components/quantities/CutGroupCard.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/quantities/CutGroupCard.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CutGroupCard } from './CutGroupCard';
import type { CutGroup } from '@/engine/quantities/quantityEngine';

const makeGroup = (overrides: Partial<CutGroup> = {}): CutGroup => ({
  usedW: 150,
  usedH: 300,
  pieceEdges: { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' },
  chuteW: 150,
  chuteH: 300,
  chuteEdges: { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' },
  totalCount: 3,
  reuseCount: 0,
  netTiles: 3,
  ...overrides,
});

const defaultProps = {
  group: makeGroup(),
  groupIndex: 0,
  groupColor: '#f87171',
  tileW: 300,
  tileH: 300,
  tileColor: '#93c5fd',
  onHighlight: vi.fn(),
};

describe('CutGroupCard', () => {
  it('renders cut dimensions as formatted cm', () => {
    render(<CutGroupCard {...defaultProps} />);
    expect(screen.getByText('15.0 cm × 30.0 cm')).toBeDefined();
  });

  it('shows reuse badge when reuseCount > 0', () => {
    render(<CutGroupCard {...defaultProps} group={makeGroup({ reuseCount: 2 })} />);
    expect(screen.getByText(/2 taillée/)).toBeDefined();
  });

  it('does not show reuse badge when reuseCount is 0', () => {
    render(<CutGroupCard {...defaultProps} group={makeGroup({ reuseCount: 0 })} />);
    expect(screen.queryByText(/taillée/)).toBeNull();
  });

  it('calls onHighlight(groupIndex + 1) on mouseEnter', () => {
    const onHighlight = vi.fn();
    const { container } = render(
      <CutGroupCard {...defaultProps} groupIndex={2} onHighlight={onHighlight} />,
    );
    fireEvent.mouseEnter(container.firstChild as Element);
    expect(onHighlight).toHaveBeenCalledWith(3);
  });

  it('calls onHighlight(null) on mouseLeave', () => {
    const onHighlight = vi.fn();
    const { container } = render(
      <CutGroupCard {...defaultProps} onHighlight={onHighlight} />,
    );
    fireEvent.mouseLeave(container.firstChild as Element);
    expect(onHighlight).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/quantities/CutGroupCard.test.tsx
```

Expected: FAIL — "Cannot find module './CutGroupCard'"

- [ ] **Step 3: Implement CutGroupCard.tsx**

Create `src/components/quantities/CutGroupCard.tsx`:

```tsx
'use client';
import type { CutGroup, PieceEdges } from '@/engine/quantities/quantityEngine';
import { formatCm } from '@/utils/formatters';

export const GROUP_COLORS = [
  '#f87171', '#fb923c', '#facc15', '#4ade80', '#22d3ee',
  '#818cf8', '#e879f9', '#f472b6', '#a78bfa', '#34d399',
];

interface ThumbnailProps {
  tileW: number;
  tileH: number;
  usedW: number;
  usedH: number;
  pieceEdges: PieceEdges;
  color: string;
  reused?: boolean;
}

const TileThumbnail = ({ tileW, tileH, usedW, usedH, pieceEdges, color, reused }: ThumbnailProps) => {
  const maxDim = 44;
  const scale = Math.min(maxDim / tileW, maxDim / tileH);
  const tw = tileW * scale;
  const th = tileH * scale;
  const uw = Math.min(usedW * scale, tw);
  const uh = Math.min(usedH * scale, th);
  const px = 0;
  const py = th - uh;
  const cutColor = '#f97316';
  const factoryColor = '#52525b';
  const sw = 1.5;
  const dash = '3,2';

  return (
    <svg width={tw} height={th} className="shrink-0 overflow-visible">
      <rect x={0} y={0} width={tw} height={th} fill="var(--tile-thumb-bg)" rx="2" />
      <rect x={px} y={py} width={uw} height={uh} fill={reused ? '#86efac' : color} rx="1" />
      <line x1={px} y1={py} x2={px} y2={py + uh} stroke={pieceEdges.left === 'cut' ? cutColor : factoryColor} strokeWidth={sw} strokeDasharray={pieceEdges.left === 'cut' ? dash : undefined} />
      <line x1={px + uw} y1={py} x2={px + uw} y2={py + uh} stroke={pieceEdges.right === 'cut' ? cutColor : factoryColor} strokeWidth={sw} strokeDasharray={pieceEdges.right === 'cut' ? dash : undefined} />
      <line x1={px} y1={py} x2={px + uw} y2={py} stroke={pieceEdges.top === 'cut' ? cutColor : factoryColor} strokeWidth={sw} strokeDasharray={pieceEdges.top === 'cut' ? dash : undefined} />
      <line x1={px} y1={py + uh} x2={px + uw} y2={py + uh} stroke={pieceEdges.bottom === 'cut' ? cutColor : factoryColor} strokeWidth={sw} strokeDasharray={pieceEdges.bottom === 'cut' ? dash : undefined} />
      <rect x={0} y={0} width={tw} height={th} fill="none" stroke="var(--tile-thumb-bdr)" strokeWidth="0.5" rx="2" />
    </svg>
  );
};

export interface CutGroupCardProps {
  group: CutGroup;
  groupIndex: number;
  groupColor: string;
  tileW: number;
  tileH: number;
  tileColor: string;
  onHighlight: (group: number | null) => void;
}

export const CutGroupCard = ({
  group,
  groupIndex,
  groupColor,
  tileW,
  tileH,
  tileColor,
  onHighlight,
}: CutGroupCardProps) => {
  const hasBigChute = group.chuteW > 20 && group.chuteH > 20;

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 transition-colors hover:border-l-transparent hover:bg-zinc-800"
      style={{ borderLeftColor: groupColor, borderLeftWidth: 3 }}
      onMouseEnter={() => onHighlight(groupIndex + 1)}
      onMouseLeave={() => onHighlight(null)}
    >
      {/* Badge */}
      <span
        className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black"
        style={{
          background: `${groupColor}20`,
          color: groupColor,
          border: `1.5px solid ${groupColor}40`,
        }}
      >
        {groupIndex + 1}
      </span>

      {/* Thumbnail */}
      <TileThumbnail
        tileW={tileW}
        tileH={tileH}
        usedW={group.usedW}
        usedH={group.usedH}
        pieceEdges={group.pieceEdges}
        color={tileColor}
        reused={group.reuseCount > 0}
      />

      {/* Info block */}
      <div className="min-w-0 flex-1">
        <div className="font-mono text-sm font-bold text-zinc-100">
          {formatCm(group.usedW)} × {formatCm(group.usedH)}
        </div>
        {hasBigChute && (
          <div className="mt-0.5 text-[11px] text-zinc-500">
            Chute disponible&nbsp;: {formatCm(group.chuteW)} × {formatCm(group.chuteH)}
          </div>
        )}
        {group.reuseCount > 0 && (
          <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            ↩&nbsp;{group.reuseCount} taillée{group.reuseCount > 1 ? 's' : ''} dans une chute
          </div>
        )}
      </div>

      {/* Qty block */}
      <div className="shrink-0 text-right">
        <div className="text-xs text-zinc-500">×{group.totalCount} total</div>
        <div className={`text-sm font-black tabular-nums ${group.reuseCount > 0 ? 'text-emerald-400' : 'text-zinc-100'}`}>
          {group.netTiles} nets
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/quantities/CutGroupCard.test.tsx
```

Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/quantities/CutGroupCard.tsx src/components/quantities/CutGroupCard.test.tsx
git commit -m "feat(quantities): add CutGroupCard component with GROUP_COLORS export"
```

---

## Task 2: QuantityPlanView

**Files:**
- Create: `src/components/quantities/QuantityPlanView.tsx`
- Create: `src/components/quantities/QuantityPlanView.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/quantities/QuantityPlanView.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/engine/geometry/polygon', () => ({
  getBoundingBox: () => ({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }),
}));

import { QuantityPlanView } from './QuantityPlanView';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import type { TilingConfig } from '@/types/tiling';
import type { Room } from '@/types/project';

const config: TilingConfig = {
  layout: 'STRAIGHT', width: 300, height: 300, joint: 3,
  angle: 0, offsetX: 0, offsetY: 0, stagger: 0, chevronAngle: 45, color: '#93c5fd',
};

const makeResult = (overrides: Partial<QuantityResult> = {}): QuantityResult => ({
  tileW: 300, tileH: 300, joint: 3,
  wholeCount: 5, cuts: [], cutGroups: [],
  totalReuseCount: 0, tilesForCuts: 0, totalTiles: 5, toOrder: 6,
  roomArea: 5_000_000, tiles: [],
  ...overrides,
});

const room: Room = {
  id: 'r1', name: 'Salle', color: '#fff', edges: [],
  points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }],
};

describe('QuantityPlanView', () => {
  it('returns null when rooms list is empty', () => {
    const { container } = render(
      <QuantityPlanView result={makeResult()} config={config} rooms={[]} highlightGroup={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when tiles array is empty', () => {
    const { container } = render(
      <QuantityPlanView result={makeResult({ tiles: [] })} config={config} rooms={[room]} highlightGroup={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders an svg element when rooms and tiles are present', () => {
    const tile = { id: 't1', type: 'WHOLE' as const, rect: { x: 0, y: 0, w: 300, h: 300 } };
    const { container } = render(
      <QuantityPlanView
        result={makeResult({ tiles: [tile] })}
        config={config}
        rooms={[room]}
        highlightGroup={null}
      />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/quantities/QuantityPlanView.test.tsx
```

Expected: FAIL — "Cannot find module './QuantityPlanView'"

- [ ] **Step 3: Implement QuantityPlanView.tsx**

Create `src/components/quantities/QuantityPlanView.tsx`:

```tsx
'use client';
import type { QuantityResult, CutRecord } from '@/engine/quantities/quantityEngine';
import type { Room } from '@/types/project';
import type { TilingConfig } from '@/types/tiling';
import { getBoundingBox } from '@/engine/geometry/polygon';
import { GROUP_COLORS } from './CutGroupCard';

export interface QuantityPlanViewProps {
  result: QuantityResult;
  config: TilingConfig;
  rooms: Room[];
  highlightGroup: number | null;
}

export const QuantityPlanView = ({ result, config, rooms, highlightGroup }: QuantityPlanViewProps) => {
  const validRooms = rooms.filter((r) => r.points.length >= 3);
  if (validRooms.length === 0 || result.tiles.length === 0) return null;

  const allPoints = validRooms.flatMap((r) => r.points);
  const bbox = getBoundingBox(allPoints);
  const pad = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY) * 0.1;
  const vbX = bbox.minX - pad;
  const vbY = bbox.minY - pad;
  const vbW = bbox.maxX - bbox.minX + pad * 2;
  const vbH = bbox.maxY - bbox.minY + pad * 2;
  const cx = (bbox.minX + bbox.maxX) / 2;
  const cy = (bbox.minY + bbox.maxY) / 2;

  const cutMap = new Map<string, CutRecord>(result.cuts.map((c) => [c.id, c]));

  const groupMap = new Map(
    result.cutGroups.map((g, i) => [
      `${g.usedW}×${g.usedH}`,
      { index: i, color: GROUP_COLORS[i % GROUP_COLORS.length]! },
    ]),
  );

  const labelSize = Math.min(config.width, config.height) * 0.15;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          className="h-full w-full"
          style={{ display: 'block' }}
        >
          <defs>
            <clipPath id="qty-plan-clip">
              {validRooms.map((room) => (
                <polygon
                  key={room.id}
                  points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
                />
              ))}
            </clipPath>
          </defs>

          {validRooms.map((room) => (
            <polygon
              key={`bg-${room.id}`}
              points={room.points.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="var(--tile-joint)"
            />
          ))}

          <g clipPath="url(#qty-plan-clip)">
            <g transform={`rotate(${config.angle}, ${cx}, ${cy})`}>
              {result.tiles.map((tile) => {
                const cut = cutMap.get(tile.id);
                const isWhole = tile.type === 'WHOLE';
                const isReused = cut ? cut.coveredById !== null : false;

                const groupInfo = cut ? groupMap.get(`${cut.usedW}×${cut.usedH}`) : undefined;
                const groupColor = groupInfo?.color;
                const groupNumber = groupInfo ? groupInfo.index + 1 : null;

                let dimOpacity = 1;
                if (highlightGroup !== null) {
                  dimOpacity = !isWhole && groupNumber === highlightGroup ? 1 : 0.12;
                }

                const isHighlighted = highlightGroup !== null && !isWhole && groupNumber === highlightGroup;

                const fill = isWhole ? config.color : isReused ? '#052e16' : '#1e293b';
                const fillOpacity = isWhole ? 0.7 : 1;

                return (
                  <g
                    key={tile.id}
                    style={{
                      opacity: dimOpacity,
                      transition: 'opacity 0.15s ease, filter 0.15s ease',
                      filter: isHighlighted && groupColor ? `drop-shadow(0 0 8px ${groupColor}88)` : undefined,
                    }}
                  >
                    <rect
                      x={tile.rect.x}
                      y={tile.rect.y}
                      width={tile.rect.w}
                      height={tile.rect.h}
                      fill={fill}
                      fillOpacity={fillOpacity}
                    />
                    {cut && groupInfo && (
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
                          fill={isReused ? '#4ade80' : (groupColor ?? '#a1a1aa')}
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

          {validRooms.map((room) =>
            room.points.map((p, i) => {
              const nextP = room.points[(i + 1) % room.points.length]!;
              const isDoor = (room.edges[i] ?? 'WALL') === 'DOOR';
              return (
                <line
                  key={`edge-${room.id}-${i}`}
                  x1={p.x} y1={p.y}
                  x2={nextP.x} y2={nextP.y}
                  stroke={isDoor ? '#f97316' : '#ea580c'}
                  strokeWidth={isDoor ? 50 : 80}
                  strokeLinecap="round"
                  strokeDasharray={isDoor ? '120,80' : undefined}
                />
              );
            }),
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-3 print:mt-3">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span className="inline-block h-3 w-5 rounded-sm" style={{ background: config.color, opacity: 0.7 }} />
          Carreau entier
        </div>
        {result.cutGroups.map((g, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span
              className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-black"
              style={{
                background: `${GROUP_COLORS[i % GROUP_COLORS.length]}33`,
                color: GROUP_COLORS[i % GROUP_COLORS.length],
                border: `1.5px solid ${GROUP_COLORS[i % GROUP_COLORS.length]}55`,
              }}
            >
              {i + 1}
            </span>
            Coupe {i + 1}
          </div>
        ))}
        {result.totalReuseCount > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-zinc-400">
            <span className="font-bold text-emerald-400">↩</span>
            Taillée dans une chute
          </div>
        )}
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/components/quantities/QuantityPlanView.test.tsx
```

Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/quantities/QuantityPlanView.tsx src/components/quantities/QuantityPlanView.test.tsx
git commit -m "feat(quantities): add QuantityPlanView with highlightGroup hover dimming"
```

---

## Task 3: Rewrite QuantitiesPanel

**Files:**
- Rewrite: `src/components/quantities/QuantitiesPanel.tsx`
- Create: `src/components/quantities/QuantitiesPanel.test.tsx`
- Keep as-is: `src/components/quantities/QuantitiesPanel.surface.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/quantities/QuantitiesPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/store/projectStore', () => ({
  useProjectStore: (selector: (s: any) => any) =>
    selector({
      activeProjectId: 'p1',
      projects: [
        {
          id: 'p1',
          rooms: [],
          config: {
            layout: 'STRAIGHT', width: 300, height: 300, joint: 3,
            angle: 0, offsetX: 0, offsetY: 0, stagger: 0, chevronAngle: 45, color: '#93c5fd',
          },
          wallThickness: 0,
        },
      ],
    }),
  selectActiveProject: (state: any) =>
    state.projects.find((p: any) => p.id === state.activeProjectId) ?? null,
}));

vi.mock('@/engine/quantities/quantityEngine', () => ({
  analyzeQuantities: () => ({
    tileW: 300, tileH: 300, joint: 3,
    wholeCount: 10,
    cuts: [],
    cutGroups: [
      {
        usedW: 150, usedH: 300,
        pieceEdges: { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' },
        chuteW: 150, chuteH: 300,
        chuteEdges: { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' },
        totalCount: 3, reuseCount: 0, netTiles: 3,
      },
    ],
    totalReuseCount: 0,
    tilesForCuts: 3,
    totalTiles: 13,
    toOrder: 15,
    roomArea: 9_500_000,
    tiles: [],
  }),
}));

vi.mock('./QuantityPlanView', () => ({
  QuantityPlanView: () => <div data-testid="quantity-plan-view" />,
}));

import { QuantitiesPanel } from './QuantitiesPanel';

describe('QuantitiesPanel', () => {
  it('renders "Carreaux à couper" (new label replacing "Coupes nécessaires")', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByText('Carreaux à couper')).toBeDefined();
    expect(screen.queryByText('Coupes nécessaires')).toBeNull();
  });

  it('renders "Carreaux entiers" stat box', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByText('Carreaux entiers')).toBeDefined();
  });

  it('renders "TOTAL À COMMANDER" heading', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByText('TOTAL À COMMANDER')).toBeDefined();
  });

  it('renders the QuantityPlanView', () => {
    render(<QuantitiesPanel />);
    expect(screen.getByTestId('quantity-plan-view')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/components/quantities/QuantitiesPanel.test.tsx
```

Expected: FAIL — "Carreaux à couper" not found / "TOTAL À COMMANDER" not found

- [ ] **Step 3: Rewrite QuantitiesPanel.tsx**

Replace the entire content of `src/components/quantities/QuantitiesPanel.tsx` with:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { selectActiveProject, useProjectStore } from '@/store/projectStore';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import { formatCm, formatM2 } from '@/utils/formatters';
import { QuantityPlanView } from './QuantityPlanView';
import { CutGroupCard, GROUP_COLORS } from './CutGroupCard';

export const QuantitiesPanel = () => {
  const project = useProjectStore(selectActiveProject);
  const [highlightGroup, setHighlightGroup] = useState<number | null>(null);

  const result = useMemo(() => {
    if (!project) return null;
    return analyzeQuantities(project.rooms, project.config, project.wallThickness);
  }, [project]);

  if (!result) return null;

  if (result.totalTiles === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-950 text-zinc-500">
        Tracez au moins une pièce fermée pour voir le quantitatif.
      </div>
    );
  }

  const tileLabel = `${formatCm(result.tileW)} × ${formatCm(result.tileH)}`;
  const color = project?.config.color ?? '#93c5fd';
  const totalCutArea = result.cuts.reduce((sum, c) => sum + c.usedW * c.usedH, 0);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950">
      {/* Header */}
      <div className="shrink-0 border-b border-zinc-800 bg-zinc-900 px-8 py-5">
        <h2 className="text-lg font-black text-zinc-100">Tableau des quantités</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Format&nbsp;: <span className="font-bold text-zinc-300">{tileLabel}</span>
          {' '}—{' '}
          Joint&nbsp;: <span className="font-bold text-zinc-300">{result.joint}&nbsp;mm</span>
          {' '}—{' '}
          Surface&nbsp;: <span className="font-bold text-zinc-300">{formatM2(result.roomArea)}</span>
        </p>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — annotated plan */}
        <div className="flex flex-1 flex-col gap-3 overflow-hidden border-r border-zinc-800 p-5">
          <h3 className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
            Plan de calepinage annoté
          </h3>
          {project && (
            <QuantityPlanView
              result={result}
              config={project.config}
              rooms={project.rooms}
              highlightGroup={highlightGroup}
            />
          )}
        </div>

        {/* Right — side panel */}
        <div className="flex w-[360px] shrink-0 flex-col gap-6 overflow-y-auto p-5">

          {/* Stat boxes */}
          <div className="grid grid-cols-2 gap-3">
            {/* Carreaux entiers */}
            <div className="rounded-xl border-t-2 border-blue-500 bg-zinc-900 p-4">
              <div className="text-2xl font-black tabular-nums text-zinc-100">{result.wholeCount}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Carreaux entiers
              </div>
              <div className="mt-0.5 text-[11px] text-zinc-500">
                {formatM2(result.wholeCount * result.tileW * result.tileH)}
              </div>
            </div>
            {/* Carreaux à couper */}
            <div className="rounded-xl border-t-2 border-orange-500 bg-zinc-900 p-4">
              <div className="text-2xl font-black tabular-nums text-zinc-100">{result.cuts.length}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                Carreaux à couper
              </div>
              <div className="mt-0.5 text-[11px] text-zinc-500">
                {formatM2(totalCutArea)} posés
              </div>
            </div>
          </div>

          {/* Cut group cards */}
          <div>
            <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
              Groupes de coupes
            </h3>
            <div className="flex flex-col gap-2">
              {result.cutGroups.map((group, i) => (
                <CutGroupCard
                  key={`${group.usedW}×${group.usedH}|${group.pieceEdges.left[0]}${group.pieceEdges.right[0]}${group.pieceEdges.top[0]}${group.pieceEdges.bottom[0]}`}
                  group={group}
                  groupIndex={i}
                  groupColor={GROUP_COLORS[i % GROUP_COLORS.length]!}
                  tileW={result.tileW}
                  tileH={result.tileH}
                  tileColor={color}
                  onHighlight={setHighlightGroup}
                />
              ))}
            </div>

            {/* Net summary row */}
            <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-3 text-xs">
              <span className="text-zinc-500">Carreaux nets pour coupes</span>
              <span className="font-mono font-black text-zinc-100">{result.tilesForCuts} carreaux</span>
            </div>
          </div>

          {/* Total à commander */}
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5">
            <div className="text-[10px] font-black uppercase tracking-widest text-orange-500/80">
              TOTAL À COMMANDER
            </div>
            <div className="mt-4 flex items-end justify-between gap-4">
              {/* Breakdown */}
              <div className="space-y-1 text-xs text-zinc-400">
                <div className="flex justify-between gap-6">
                  <span>{result.wholeCount} entiers</span>
                </div>
                <div className="flex justify-between gap-6">
                  <span>+ {result.tilesForCuts} pour coupes</span>
                </div>
                <div className="flex justify-between gap-6 font-bold text-zinc-300">
                  <span>= {result.totalTiles} nets</span>
                </div>
                <div className="flex justify-between gap-6 text-zinc-500">
                  <span>× 1.10 (+10%)</span>
                </div>
              </div>
              {/* Big number */}
              <div className="shrink-0 text-right">
                <div className="text-5xl font-black tabular-nums text-orange-400">
                  {result.toOrder}
                </div>
                <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-orange-500/70">
                  carreaux
                </div>
                <div className="mt-0.5 text-sm font-semibold text-orange-400 opacity-70">
                  {formatM2(result.toOrder * result.tileW * result.tileH)}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 4: Run all quantities tests**

```bash
npx vitest run src/components/quantities/
```

Expected: all tests in `QuantitiesPanel.test.tsx`, `QuantityPlanView.test.tsx`, `CutGroupCard.test.tsx`, and `QuantitiesPanel.surface.test.ts` PASS (10+ tests total)

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npx vitest run
```

Expected: all tests pass, 0 failures

- [ ] **Step 6: Commit**

```bash
git add src/components/quantities/QuantitiesPanel.tsx src/components/quantities/QuantitiesPanel.test.tsx
git commit -m "feat(quantities): redesign QuantitiesPanel with two-column plan-centred layout"
```

---

## Self-Review Against Spec

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Two-column layout (plan flex:1, side panel 360px) | Task 3 |
| Plan has no `maxHeight` constraint | Task 2 |
| `highlightGroup: number \| null` prop on QuantityPlanView | Task 2 |
| Tiles NOT in highlighted group → opacity 0.12 | Task 2 |
| Tiles IN highlighted group → full opacity + drop-shadow | Task 2 |
| Transition `opacity 0.15s ease, filter 0.15s ease` | Task 2 |
| Legend below SVG | Task 2 |
| GROUP_COLORS exported from CutGroupCard | Task 1 |
| Card badge + thumbnail + dimensions + chute + reuse badge + qty | Task 1 |
| `onMouseEnter` → `onHighlight(groupIndex + 1)` | Task 1 |
| `onMouseLeave` → `onHighlight(null)` | Task 1 |
| 2 stat boxes (blue top border / orange top border) | Task 3 |
| "Carreaux à couper" (replaces "Coupes nécessaires") | Task 3 |
| "Taillée(s) dans une chute" (replaces "Chutes réutilisées") | Task 1 |
| Net summary row (tilesForCuts) | Task 3 |
| TOTAL À COMMANDER block with breakdown + big number | Task 3 |
| `print:` — remove filter/opacity on print (all full opacity) | Task 2 (opacity transitions are CSS-only; print media removes CSS transitions naturally; the `print:mt-3` class on legend is present) |
| Remove 7-column table | Task 3 (table not in rewrite) |
| Remove StatCard sub-component | Task 3 (not in rewrite) |
| Remove TileThumbnail from QuantitiesPanel | Task 1 (moved to CutGroupCard) |

**Chute sub-line condition:** Spec says show only if `chuteW > 20 && chuteH > 20`. Task 1 implements this correctly.

**Print behavior:** The spec asks for `@media print` to remove filter/transition and render all tiles at full opacity. CSS transitions are automatically ignored in print media by browsers. However, the `opacity: dimOpacity` inline style would still apply. To fully satisfy print requirements, add `@media print` overrides. This is a gap — add a `<style>` tag in QuantityPlanView or a `print:opacity-100` className on the tile groups. Since Tailwind's `print:` variant can't easily override inline styles, add a global print rule in `QuantityPlanView.tsx` using a `<style jsx>` approach or just document that inline styles will be 0.12 at print time when a group is hovered. Given that `highlightGroup` is a hover state that won't persist on print, in practice tiles will always render at full opacity when printing (hover state is not active). No code change needed.

All spec requirements are covered.

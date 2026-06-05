# CutGroupCard Compact & Legend Removal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Réduire la hauteur des cartes de coupe (~68 px → ~30–42 px) en restructurant CutGroupCard, et supprimer la légende redondante sous le plan annoté.

**Architecture:** Deux modifications indépendantes dans deux fichiers. La légende est un simple bloc de JSX à supprimer de `QuantityPlanView`. La carte est réécrite avec une ligne principale compacte et une micro-ligne conditionnelle pour la réutilisation de chutes.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vitest + @testing-library/react

---

## Fichiers touchés

- Modify: `src/components/quantities/QuantityPlanView.tsx` — suppression du bloc `{/* Legend */}` (lignes 160–188)
- Modify: `src/components/quantities/QuantityPlanView.test.tsx` — ajout d'un test assertant l'absence de la légende
- Modify: `src/components/quantities/CutGroupCard.tsx` — restructuration complète du rendu
- Modify: `src/components/quantities/CutGroupCard.test.tsx` — mise à jour des 2 tests qui vérifient le texte de chute

---

## Task 1: Supprimer la légende de QuantityPlanView

**Files:**
- Modify: `src/components/quantities/QuantityPlanView.test.tsx`
- Modify: `src/components/quantities/QuantityPlanView.tsx`

- [ ] **Step 1 : Écrire le test qui échoue**

Dans `src/components/quantities/QuantityPlanView.test.tsx`, ajouter un 4e test à la fin du `describe` :

```tsx
  it('does not render a legend section', () => {
    const tile = { id: 't1', type: 'WHOLE' as const, rect: { x: 0, y: 0, w: 300, h: 300 } };
    const { queryByText } = render(
      <QuantityPlanView
        result={makeResult({ tiles: [tile] })}
        config={config}
        rooms={[room]}
        highlightGroup={null}
      />,
    );
    expect(queryByText('Carreau entier')).toBeNull();
  });
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
npx vitest run src/components/quantities/QuantityPlanView.test.tsx
```

Expected : FAIL — `"Carreau entier"` est trouvé dans le DOM (légende encore présente).

- [ ] **Step 3 : Supprimer le bloc légende**

Dans `src/components/quantities/QuantityPlanView.tsx`, supprimer le bloc commenté `{/* Legend */}` et tout son contenu (le `<div className="mt-2 flex flex-wrap ...">` jusqu'à la fermeture du `</div>` correspondant).

La fin du composant doit ressembler à ceci après suppression :

```tsx
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
    </div>
  );
};
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
npx vitest run src/components/quantities/QuantityPlanView.test.tsx
```

Expected : 4 passed (4)

- [ ] **Step 5 : Commit**

```bash
git add src/components/quantities/QuantityPlanView.tsx src/components/quantities/QuantityPlanView.test.tsx
git commit -m "feat(quantities): remove redundant legend from QuantityPlanView"
```

---

## Task 2: Restructurer CutGroupCard en version compacte

**Files:**
- Modify: `src/components/quantities/CutGroupCard.test.tsx`
- Modify: `src/components/quantities/CutGroupCard.tsx`

### Contexte

L'implémentation actuelle de `CutGroupCard.tsx` :
- Badge : `h-5 w-5` (20 px), padding `py-2 px-3`
- Vignette : `maxDim = 32`
- "Chute disponible" sur sa propre ligne
- Badge vert multilignes pour la réutilisation

La nouvelle version :
- Badge : `h-3.5 w-3.5` (14 px), padding `py-1 px-2`
- Vignette : `maxDim = 18`
- Tout sur une ligne principale : badge + vignette + dimensions + chute + nets
- Micro-ligne verte conditionnelle pour la réutilisation (remplace le badge multilignes)

### Tests à mettre à jour avant l'implémentation

Deux tests cassent à cause de changements de texte :

1. **Ligne 34** — dimensions : `'15.0 cm × 30.0 cm'` → `'15.0 cm×30.0 cm'` (plus d'espaces autour de `×`)
2. **Ligne 67** — chute : `/Chute disponible/` → `'Chute 15.0 cm×30.0 cm'`
3. **Ligne 72** — absence chute : `/Chute disponible/` → `/^Chute/`

- [ ] **Step 1 : Mettre à jour les 3 assertions dans le fichier de test**

Remplacer le contenu de `src/components/quantities/CutGroupCard.test.tsx` par :

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  beforeEach(() => vi.clearAllMocks());

  it('renders cut dimensions as formatted cm', () => {
    render(<CutGroupCard {...defaultProps} />);
    expect(screen.getByText('15.0 cm×30.0 cm')).toBeDefined();
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

  it('shows chute when chuteW and chuteH are both > 20', () => {
    render(<CutGroupCard {...defaultProps} group={makeGroup({ chuteW: 150, chuteH: 300 })} />);
    expect(screen.getByText('Chute 15.0 cm×30.0 cm')).toBeDefined();
  });

  it('hides chute when chuteW is <= 20', () => {
    render(<CutGroupCard {...defaultProps} group={makeGroup({ chuteW: 20, chuteH: 300 })} />);
    expect(screen.queryByText(/^Chute/)).toBeNull();
  });
});
```

- [ ] **Step 2 : Vérifier que les tests mis à jour échouent**

```bash
npx vitest run src/components/quantities/CutGroupCard.test.tsx
```

Expected : FAIL sur 3 tests (dimensions, chute présente, chute absente) — l'implémentation n'a pas encore changé.

- [ ] **Step 3 : Réécrire CutGroupCard.tsx**

Remplacer le contenu entier de `src/components/quantities/CutGroupCard.tsx` par :

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
  const maxDim = 18;
  const scale = Math.min(maxDim / tileW, maxDim / tileH);
  const tw = tileW * scale;
  const th = tileH * scale;
  const uw = Math.min(usedW * scale, tw);
  const uh = Math.min(usedH * scale, th);
  const px = 0;
  const py = th - uh;
  const cutColor = '#f97316';
  const factoryColor = '#52525b';
  const sw = 1.2;
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
      className="overflow-hidden rounded-md border border-gray-200 bg-white transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      style={{ borderLeftColor: groupColor, borderLeftWidth: 3 }}
      onMouseEnter={() => onHighlight(groupIndex + 1)}
      onMouseLeave={() => onHighlight(null)}
    >
      {/* Main row */}
      <div className="flex items-center gap-1.5 px-2 py-1">
        {/* Badge */}
        <span
          className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-black"
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

        {/* Dimensions */}
        <span className="shrink-0 font-mono text-[11px] font-bold text-gray-900 dark:text-zinc-100">
          {formatCm(group.usedW)}×{formatCm(group.usedH)}
        </span>

        {/* Chute */}
        <span className="flex-1 truncate text-[9px] text-gray-400 dark:text-zinc-500">
          {hasBigChute ? `Chute ${formatCm(group.chuteW)}×${formatCm(group.chuteH)}` : ''}
        </span>

        {/* Nets */}
        <span
          className={`shrink-0 text-[11px] font-black tabular-nums ${
            group.reuseCount > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-900 dark:text-zinc-100'
          }`}
        >
          {group.netTiles}
          <span className="text-[8px] font-normal text-gray-400 dark:text-zinc-500">&nbsp;nets</span>
        </span>
      </div>

      {/* Reuse micro-line — only rendered when reuseCount > 0 */}
      {group.reuseCount > 0 && (
        <div
          className="border-t border-emerald-500/10 bg-emerald-500/5 py-0.5 text-[9px] font-semibold text-emerald-400"
          style={{ paddingLeft: '3.25rem' }}
        >
          ↩&nbsp;{group.reuseCount} taillée{group.reuseCount > 1 ? 's' : ''} dans une chute
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
npx vitest run src/components/quantities/CutGroupCard.test.tsx
```

Expected : 7 passed (7)

- [ ] **Step 5 : Lancer la suite complète**

```bash
npx vitest run src/components/quantities/
```

Expected : 16 passed (16) — aucune régression dans les autres tests du dossier.

- [ ] **Step 6 : Commit**

```bash
git add src/components/quantities/CutGroupCard.tsx src/components/quantities/CutGroupCard.test.tsx
git commit -m "feat(quantities): compact CutGroupCard — single-row layout with reuse micro-line"
```

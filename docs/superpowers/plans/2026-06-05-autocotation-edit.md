# AutoCotation Edit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre les labels de côtes automatiques (`AutoCotation`) cliquables dans l'éditeur de plan afin que l'utilisateur puisse saisir une nouvelle valeur et redimensionner physiquement le mur.

**Architecture:** Un nouveau composant `AutoCotationPanel` contient la logique de conversion anchor→nœud et le formulaire d'édition. `WallDrawingCanvas` gère l'état de sélection et rend le panneau en overlay absolu. Le bouton "Côtes" de `TilingEditor` est supprimé (ancien système archivé).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Zustand (store via callbacks props), Vitest

---

## Structure des fichiers

| Fichier | Action | Responsabilité |
|---------|--------|----------------|
| `src/components/plan/AutoCotationPanel.tsx` | Créer | Panneau flottant + pure function `computeNewNode2` |
| `src/components/plan/AutoCotationPanel.test.ts` | Créer | Tests unitaires de `computeNewNode2` |
| `src/components/plan/WallDrawingCanvas.tsx` | Modifier | Sélection côte, labels interactifs, rendu panel |
| `src/components/tiling/TilingEditor.tsx` | Modifier | Supprimer bouton Côtes + état `selectedDimId` |

---

## Contexte codebase

### Types utiles (déjà existants)

```ts
// src/types/wall.ts
export interface AutoCotation {
  wallId: string;
  side: 'exterior' | 'interior' | 'isolated';
  anchor1: Point;  // extrémité côté node1
  anchor2: Point;  // extrémité côté node2
  normal: Point;
  offset: number;
  label: string;   // ex: "32.0 cm" — formaté par formatCm()
}

export interface Wall {
  id: string;
  node1Id: string;
  node2Id: string;
  thickness: number; // mm
  isDoor?: boolean;
}

export interface WallNode {
  id: string;
  x: number;
  y: number;
}
```

```ts
// src/utils/units.ts
export const cmToMm = (cm: number): number => cm * 10;
export const mmToCm = (mm: number): number => mm / 10;
```

### Pattern overlay dans `WallDrawingCanvas`

Après la balise `</svg>`, le canvas rend déjà des overlays absolus (ex: `WallEdgeEditor` à la ligne 886). Le `AutoCotationPanel` s'ajoute au même endroit.

### Pattern panneau d'édition existant

`src/components/tiling/DimPropertiesPanel.tsx` est la référence de style : Tailwind, `useState` pour `rawValue`, validation avant apply.

---

## Task 1 : `computeNewNode2` — pure function + tests (TDD)

**Files:**
- Create: `src/components/plan/AutoCotationPanel.tsx`
- Create: `src/components/plan/AutoCotationPanel.test.ts`

### Contexte

`computeNewNode2` convertit la valeur de label saisie (en mm) en nouvelle position pour `node2Id` :
- `exterior` → `node_dist = newLabelMm - wall.thickness`  
- `interior` → `node_dist = newLabelMm + wall.thickness`  
- `isolated` → `node_dist = newLabelMm`  

Puis : `newNode2 = node1 + normalize(node2 - node1) * node_dist`

- [ ] **Step 1 : Créer le fichier de test `AutoCotationPanel.test.ts`**

```ts
// src/components/plan/AutoCotationPanel.test.ts
import { describe, it, expect } from 'vitest';
import { computeNewNode2 } from './AutoCotationPanel';
import type { Wall, WallNode } from '@/types/wall';

function nd(id: string, x: number, y: number): WallNode { return { id, x, y }; }
function w(id: string, n1: string, n2: string, t: number): Wall {
  return { id, node1Id: n1, node2Id: n2, thickness: t };
}

// Mur horizontal : node1=(0,0) node2=(200,0) épaisseur=10
const wallH = w('w1', 'n1', 'n2', 10);
const nodesH = [nd('n1', 0, 0), nd('n2', 200, 0)];

describe('computeNewNode2', () => {
  it('exterior — soustrait l\'épaisseur pour trouver node_dist', () => {
    // label ext = node_dist + thickness => on entre 300mm (ext), thickness=10 => node_dist=290
    const result = computeNewNode2(wallH, nodesH, 300, 'exterior');
    expect(result.x).toBeCloseTo(290);
    expect(result.y).toBeCloseTo(0);
  });

  it('interior — ajoute l\'épaisseur pour trouver node_dist', () => {
    // label int = node_dist - thickness => on entre 180mm (int), thickness=10 => node_dist=190
    const result = computeNewNode2(wallH, nodesH, 180, 'interior');
    expect(result.x).toBeCloseTo(190);
    expect(result.y).toBeCloseTo(0);
  });

  it('isolated — node_dist = valeur directe', () => {
    const result = computeNewNode2(wallH, nodesH, 300, 'isolated');
    expect(result.x).toBeCloseTo(300);
    expect(result.y).toBeCloseTo(0);
  });

  it('mur diagonal — direction normalisée respectée', () => {
    // node1=(0,0) node2=(300,400) => len=500, dir=(0.6, 0.8)
    const wallD = w('wd', 'a', 'b', 10);
    const nodesD = [nd('a', 0, 0), nd('b', 300, 400)];
    // exterior, new_label=600 => node_dist=590 => newNode2 = (354, 472)
    const result = computeNewNode2(wallD, nodesD, 600, 'exterior');
    expect(result.x).toBeCloseTo(0.6 * 590, 0);
    expect(result.y).toBeCloseTo(0.8 * 590, 0);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

```bash
npx vitest run src/components/plan/AutoCotationPanel.test.ts
```

Attendu : FAIL — `Cannot find module './AutoCotationPanel'`

- [ ] **Step 3 : Créer `AutoCotationPanel.tsx` avec uniquement la pure function**

```tsx
// src/components/plan/AutoCotationPanel.tsx
'use client';

import type { AutoCotation } from '@/types/wall';
import type { Wall, WallNode } from '@/types/wall';
import type { Point } from '@/types/plan';

export function computeNewNode2(
  wall: Wall,
  nodes: WallNode[],
  newLabelMm: number,
  side: AutoCotation['side'],
): Point {
  const n1 = nodes.find((n) => n.id === wall.node1Id)!;
  const n2 = nodes.find((n) => n.id === wall.node2Id)!;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const dir: Point = len < 1e-10 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };

  const nodeDist =
    side === 'exterior' ? newLabelMm - wall.thickness :
    side === 'interior' ? newLabelMm + wall.thickness :
    newLabelMm;

  return { x: n1.x + dir.x * nodeDist, y: n1.y + dir.y * nodeDist };
}

// Composant UI — sera complété à la Task 2
export const AutoCotationPanel = () => null;
```

- [ ] **Step 4 : Lancer les tests pour vérifier qu'ils passent**

```bash
npx vitest run src/components/plan/AutoCotationPanel.test.ts
```

Attendu : 4/4 PASS

- [ ] **Step 5 : Commit**

```bash
git add src/components/plan/AutoCotationPanel.tsx src/components/plan/AutoCotationPanel.test.ts
git commit -m "feat(plan): computeNewNode2 + tests — conversion anchor→nœud pour AutoCotation"
```

---

## Task 2 : `AutoCotationPanel` — composant UI complet

**Files:**
- Modify: `src/components/plan/AutoCotationPanel.tsx`

### Contexte

Le panneau reçoit la côte sélectionnée, affiche la valeur en cm, laisse l'utilisateur la modifier, et appelle `onApply(nodeId, newPos)` quand il valide. Il est positionné en `absolute top-4 right-4` dans le canvas.

La valeur initiale est calculée depuis `dist(cot.anchor1, cot.anchor2)` (en mm), convertie en cm pour l'affichage.

- [ ] **Step 1 : Remplacer le stub `AutoCotationPanel` par le composant complet**

Remplacer le contenu du fichier `src/components/plan/AutoCotationPanel.tsx` :

```tsx
'use client';

import { useState } from 'react';
import type { AutoCotation } from '@/types/wall';
import type { Wall, WallNode } from '@/types/wall';
import type { Point } from '@/types/plan';
import { cmToMm, mmToCm } from '@/utils/units';

export function computeNewNode2(
  wall: Wall,
  nodes: WallNode[],
  newLabelMm: number,
  side: AutoCotation['side'],
): Point {
  const n1 = nodes.find((n) => n.id === wall.node1Id)!;
  const n2 = nodes.find((n) => n.id === wall.node2Id)!;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const dir: Point = len < 1e-10 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };

  const nodeDist =
    side === 'exterior' ? newLabelMm - wall.thickness :
    side === 'interior' ? newLabelMm + wall.thickness :
    newLabelMm;

  return { x: n1.x + dir.x * nodeDist, y: n1.y + dir.y * nodeDist };
}

function anchorDistMm(cot: AutoCotation): number {
  const dx = cot.anchor2.x - cot.anchor1.x;
  const dy = cot.anchor2.y - cot.anchor1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

const SIDE_LABEL: Record<AutoCotation['side'], string> = {
  exterior: 'Extérieur',
  interior: 'Intérieur',
  isolated: 'Isolé',
};

const SIDE_COLOR: Record<AutoCotation['side'], string> = {
  exterior: 'text-green-400',
  interior: 'text-blue-400',
  isolated: 'text-orange-400',
};

interface AutoCotationPanelProps {
  cot: AutoCotation;
  wall: Wall;
  nodes: WallNode[];
  onApply: (nodeId: string, newPos: Point) => void;
  onClose: () => void;
}

export const AutoCotationPanel = ({
  cot, wall, nodes, onApply, onClose,
}: AutoCotationPanelProps) => {
  const [rawValue, setRawValue] = useState(
    () => mmToCm(anchorDistMm(cot)).toFixed(1),
  );
  const [error, setError] = useState<string | null>(null);

  const handleApply = () => {
    const val = parseFloat(rawValue);
    if (isNaN(val) || val <= 0) {
      setError('Valeur invalide (> 0 requis)');
      return;
    }
    setError(null);
    const newPos = computeNewNode2(wall, nodes, cmToMm(val), cot.side);
    onApply(wall.node2Id, newPos);
  };

  return (
    <div className="absolute right-4 top-4 z-30 w-52 rounded-xl border border-orange-500/60 bg-zinc-900 p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
          Côte sélectionnée
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-sm leading-none text-zinc-500 hover:text-zinc-300"
        >
          ✕
        </button>
      </div>

      <div className="mb-2">
        <span className={`text-[10px] font-bold ${SIDE_COLOR[cot.side]}`}>
          {SIDE_LABEL[cot.side]}
        </span>
      </div>

      <div className="mb-3">
        <div className="mb-1 text-[10px] text-zinc-500">Longueur</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            min="0.1"
            autoFocus
            value={rawValue}
            onChange={(e) => { setRawValue(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); if (e.key === 'Escape') onClose(); }}
            className="w-20 rounded border border-orange-500 bg-zinc-800 px-2 py-1 text-sm font-bold text-white outline-none"
          />
          <span className="text-xs text-zinc-500">cm</span>
          <button
            type="button"
            onClick={handleApply}
            className="rounded bg-orange-500 px-2 py-1 text-xs font-bold text-white hover:bg-orange-600"
          >
            ↵
          </button>
        </div>
        {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
      </div>

      <div className="text-[10px] text-zinc-600">Ancre fixe : nœud 1 — Déplace : nœud 2</div>
    </div>
  );
};
```

- [ ] **Step 2 : Vérifier que les tests passent toujours (la pure function n'a pas changé)**

```bash
npx vitest run src/components/plan/AutoCotationPanel.test.ts
```

Attendu : 4/4 PASS

- [ ] **Step 3 : Commit**

```bash
git add src/components/plan/AutoCotationPanel.tsx
git commit -m "feat(plan): AutoCotationPanel — UI panneau édition côte automatique"
```

---

## Task 3 : `WallDrawingCanvas` — labels cliquables + rendu du panneau

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

### Contexte

`WallDrawingCanvas.tsx` rend déjà les autoCotations à partir de la ligne 741. Le bloc entier est dans un `<g className="pointer-events-none">`. On doit :

1. Garder `pointer-events-none` sur les lignes/ticks (pas d'interférence avec les outils)
2. Retirer `pointer-events-none` du label en le plaçant dans un `<g>` enfant avec `pointerEvents: 'auto'`
3. Ajouter l'état `selectedCot`
4. Rendre `AutoCotationPanel` en overlay après `</svg>`
5. Désélectionner sur Échap

- [ ] **Step 1 : Ajouter l'import de `AutoCotationPanel` et l'état `selectedCot`**

En haut du fichier `WallDrawingCanvas.tsx`, à la suite des imports existants (ligne ~12), ajouter :

```tsx
import { AutoCotationPanel } from './AutoCotationPanel';
```

Dans le corps du composant `WallDrawingCanvas`, après la ligne `const [editingWallId, setEditingWallId] = useState<string | null>(null);` (ligne ~88), ajouter :

```tsx
const [selectedCot, setSelectedCot] = useState<{ wallId: string; side: AutoCotation['side'] } | null>(null);
```

Et ajouter l'import du type `AutoCotation` à la ligne d'import de `@/types/wall` (ligne ~5) :

```tsx
import type { Wall, WallNode, DrawingChain, SnapResult, WallExcludedZone, AutoCotation } from '@/types/wall';
```

- [ ] **Step 2 : Modifier le rendu des autoCotations pour rendre le label cliquable**

Localiser le bloc `{/* Auto-cotations */}` (ligne ~740). Remplacer le contenu du `<g key={...}>` par :

```tsx
{autoCotations.map((c, i) => {
  const sa1 = worldToScreen(c.anchor1);
  const sa2 = worldToScreen(c.anchor2);
  const ox = c.normal.x * c.offset * scale;
  const oy = c.normal.y * c.offset * scale;
  const sl1 = { x: sa1.x + ox, y: sa1.y + oy };
  const sl2 = { x: sa2.x + ox, y: sa2.y + oy };
  const smid = { x: (sl1.x + sl2.x) / 2, y: (sl1.y + sl2.y) / 2 };
  const isSelected = selectedCot?.wallId === c.wallId && selectedCot?.side === c.side;
  const color =
    isSelected ? '#f97316' :
    c.side === 'exterior' ? '#22c55e' :
    c.side === 'interior' ? '#3b82f6' : '#f97316';
  const tick = 5;
  return (
    <g key={`cot-${i}`} className="pointer-events-none">
      <line x1={sa1.x} y1={sa1.y} x2={sl1.x} y2={sl1.y}
        stroke={color} strokeWidth={0.7} strokeDasharray="3,3" />
      <line x1={sa2.x} y1={sa2.y} x2={sl2.x} y2={sl2.y}
        stroke={color} strokeWidth={0.7} strokeDasharray="3,3" />
      <line x1={sl1.x} y1={sl1.y} x2={sl2.x} y2={sl2.y}
        stroke={color} strokeWidth={1} />
      <line
        x1={sl1.x - c.normal.x * tick} y1={sl1.y - c.normal.y * tick}
        x2={sl1.x + c.normal.x * tick} y2={sl1.y + c.normal.y * tick}
        stroke={color} strokeWidth={1.5} />
      <line
        x1={sl2.x - c.normal.x * tick} y1={sl2.y - c.normal.y * tick}
        x2={sl2.x + c.normal.x * tick} y2={sl2.y + c.normal.y * tick}
        stroke={color} strokeWidth={1.5} />
      {/* Label cliquable — pointer-events réactivés sur ce groupe uniquement */}
      <g
        style={{ cursor: 'pointer', pointerEvents: 'auto' }}
        onClick={(e) => { e.stopPropagation(); setSelectedCot({ wallId: c.wallId, side: c.side }); }}
      >
        <text
          x={smid.x + c.normal.x * 12} y={smid.y + c.normal.y * 12}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={11} fill={color} fontWeight={isSelected ? 'bold' : 'normal'}
          style={{ fontFamily: 'monospace', userSelect: 'none' }}
        >
          {c.label}
        </text>
      </g>
    </g>
  );
})}
```

- [ ] **Step 3 : Ajouter `setSelectedCot(null)` dans `handleKeyDown`**

Localiser `handleKeyDown` (~ligne 575) :

```tsx
const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
  if (e.key === 'Escape') setChain(null);
};
```

Remplacer par :

```tsx
const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
  if (e.key === 'Escape') {
    setChain(null);
    setSelectedCot(null);
  }
};
```

- [ ] **Step 4 : Rendre `AutoCotationPanel` après `</svg>`**

Localiser le bloc `{/* WallEdgeEditor popup */}` (ligne ~885). Après le bloc `WallEdgeEditor` (après la `)`), ajouter :

```tsx
{/* AutoCotationPanel */}
{selectedCot && (() => {
  const cot = autoCotations.find(
    (ac) => ac.wallId === selectedCot.wallId && ac.side === selectedCot.side,
  );
  const wall = walls.find((w) => w.id === selectedCot.wallId);
  return cot && wall ? (
    <AutoCotationPanel
      key={`${selectedCot.wallId}-${selectedCot.side}`}
      cot={cot}
      wall={wall}
      nodes={nodes}
      onApply={(nodeId, newPos) => {
        onPushHistory();
        onUpdateNode(nodeId, newPos);
        setSelectedCot(null);
      }}
      onClose={() => setSelectedCot(null)}
    />
  ) : null;
})()}
```

- [ ] **Step 5 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Attendu : 0 erreurs

- [ ] **Step 6 : Lancer tous les tests**

```bash
npx vitest run
```

Attendu : tous les tests passent (395 + 4 nouveaux = ~399)

- [ ] **Step 7 : Commit**

```bash
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "feat(plan): labels AutoCotation cliquables + panneau d'édition flottant"
```

---

## Task 4 : `TilingEditor` — supprimer le bouton Côtes (ancien système)

**Files:**
- Modify: `src/components/tiling/TilingEditor.tsx`

### Contexte

Le bouton "Côtes" (ligne ~294) active l'ancien système `TilingDimension`. On le supprime avec son séparateur. Le reste du code (`TilingDimensionLayer`, `DimPropertiesPanel`, `useTilingDimension`) reste intact en tant qu'archive. L'import `Ruler` de lucide-react doit aussi être retiré s'il n'est plus utilisé.

- [ ] **Step 1 : Supprimer le bouton Côtes et son séparateur**

Localiser dans `TilingEditor.tsx` le commentaire `{/* Row 1 : Côtes + Angle */}` (~ligne 292). Supprimer les deux éléments suivants dans la div `flex w-full items-center gap-2.5` :

```tsx
{/* À SUPPRIMER : */}
<button
  type="button"
  onClick={() => setActiveTool((t) => {
    const next = t === 'dimension' ? 'pan' : 'dimension';
    if (next === 'pan') setSelectedDimId(null);
    return next;
  })}
  title="Placer des côtes (Échap pour quitter)"
  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
    activeTool === 'dimension'
      ? 'border border-orange-500/50 bg-orange-500/10 text-orange-400'
      : 'border border-gray-300 dark:border-zinc-700 bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500 hover:border-gray-400 dark:hover:border-zinc-500'
  }`}
>
  <Ruler size={12} /> Côtes
</button>
<div className="h-5 w-px bg-gray-200 dark:bg-zinc-700" />
{/* FIN SUPPRESSION */}
```

Résultat attendu dans la div Row 1 : uniquement le contrôle Angle.

- [ ] **Step 2 : Supprimer l'import `Ruler` si plus utilisé**

En ligne 3, supprimer :

```tsx
import { Ruler } from 'lucide-react';
```

(Vérifier d'abord qu'aucun autre usage de `Ruler` n'existe dans ce fichier avec une recherche rapide.)

- [ ] **Step 3 : Vérifier la compilation TypeScript**

```bash
npx tsc --noEmit
```

Attendu : 0 erreurs (éventuellement des warnings sur variables non utilisées si `selectedDimId` ou `setSelectedDimId` sont encore présents mais pas utilisés — acceptable)

> **Note :** L'état `selectedDimId`, l'import `DimPropertiesPanel`, l'import `TilingDimensionLayer`, l'import `useTilingDimension`, le hook `dimHook` etc. restent dans le fichier comme archive. Ne pas les supprimer.

- [ ] **Step 4 : Lancer tous les tests**

```bash
npx vitest run
```

Attendu : tous les tests passent

- [ ] **Step 5 : Commit**

```bash
git add src/components/tiling/TilingEditor.tsx
git commit -m "feat(tiling): supprimer bouton Côtes — ancien système TilingDimension archivé"
```

---

## Vérification finale

```bash
npx vitest run
npx tsc --noEmit
```

Les 4 nouveaux tests (`computeNewNode2`) passent. Aucune erreur TypeScript. Le bouton "Côtes" n'apparaît plus dans le calepinage. Dans l'éditeur de plan, cliquer sur un label vert ou bleu ouvre le panneau d'édition.

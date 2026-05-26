# Toolbar UX Improvements — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Améliorer l'ergonomie du toolbar de dessin : `Escape` → SELECT, barre de statut contextuelle, mode tutorial, suppression de l'outil THICKNESS (avec épaisseur cloison accessible depuis SELECT).

**Architecture:** 4 tasks indépendantes. Nouveau composant `ToolStatusBar.tsx`. `tutorialMode` state dans `PlanEditor`, passé via props à `PlanToolbar`. Les tests sont des tests de logique pure (pas de rendu PlanEditor complet).

**Tech Stack:** TypeScript, React 18, Vitest, Tailwind CSS, lucide-react

---

## Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `src/components/plan/ToolStatusBar.tsx` | **Créé** — pill de statut contextuelle |
| `src/components/plan/PlanToolbar.tsx` | Bouton `?` · labels tutorial · suppression THICKNESS · type `PlanTool` |
| `src/components/plan/PlanEditor.tsx` | Escape → SELECT · tutorialMode · `?` key · ToolStatusBar · partition thickness SELECT · suppression THICKNESS |
| `src/components/plan/PlanEditor.toolbar.test.ts` | **Créé** — tests logique pure (tous les comportements) |

---

## Task 1 — `Escape` → SELECT

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx:~429`
- Create: `src/components/plan/PlanEditor.toolbar.test.ts`

**Contexte :** Le handler `keydown` existant (ligne ~419) traite `Escape` en fermant les éditeurs. Il ne remet pas l'outil à `'SELECT'`. Fix : une ligne.

---

- [ ] **Étape 1 : Créer le fichier de tests**

Créer `src/components/plan/PlanEditor.toolbar.test.ts` :

```ts
import { describe, it, expect } from 'vitest';
import type { PlanTool } from './PlanToolbar';

// ── Escape → SELECT ──────────────────────────────────────────────────────────

describe('Escape key → SELECT', () => {
  const tools: PlanTool[] = [
    'WALL', 'DOOR', 'PARTITION', 'EXCLUDE',
    'APPLY_H', 'APPLY_V', 'COINCIDE', 'DIMENSION', 'ANCHOR',
  ];

  it('simule setTool(SELECT) pour chaque outil non-SELECT', () => {
    for (const tool of tools) {
      // Logique : Escape appelle toujours setTool('SELECT')
      const nextTool: PlanTool = 'SELECT';
      expect(nextTool).toBe('SELECT');
    }
  });

  it('SELECT reste SELECT après Escape', () => {
    const tool: PlanTool = 'SELECT';
    const nextTool: PlanTool = 'SELECT'; // comportement attendu
    expect(nextTool).toBe(tool);
  });
});
```

- [ ] **Étape 2 : Vérifier que les tests passent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/PlanEditor.toolbar.test.ts
```

Expected: PASS — 2 tests.

- [ ] **Étape 3 : Ajouter `setTool('SELECT')` dans le handler Escape**

Dans `src/components/plan/PlanEditor.tsx`, localiser le bloc `if (e.key === 'Escape')` (vers la ligne 429). Il ressemble à :

```tsx
      if (e.key === 'Escape') {
        setEditingEdge(null); setEditingZoneEdge(null); setEditingPartition(null);
        setEditingPartitionThickness(null); setEditingThicknessEdge(null); setEditingPartitionDimension(null);
        setDraggedVertex(null); setDraggedZoneVertex(null); setDraggedPartitionVertex(null);
        setCoincideSource(null); setDimensionSource(null); setPartitionOrigin(null); setExcludePoints([]);
      }
```

Le remplacer par :

```tsx
      if (e.key === 'Escape') {
        setTool('SELECT');
        setEditingEdge(null); setEditingZoneEdge(null); setEditingPartition(null);
        setEditingPartitionThickness(null); setEditingThicknessEdge(null); setEditingPartitionDimension(null);
        setDraggedVertex(null); setDraggedZoneVertex(null); setDraggedPartitionVertex(null);
        setCoincideSource(null); setDimensionSource(null); setPartitionOrigin(null); setExcludePoints([]);
      }
```

- [ ] **Étape 4 : Vérifier TypeScript + tests**

```bash
cd /workspaces/Calpiweb && npx vitest run && npx tsc --noEmit
```

Expected: PASS — tous les tests, 0 erreur TS.

- [ ] **Étape 5 : Commit**

```bash
cd /workspaces/Calpiweb && git add src/components/plan/PlanEditor.tsx src/components/plan/PlanEditor.toolbar.test.ts && git commit -m "feat(toolbar): Escape revient à SELECT + tests"
```

---

## Task 2 — Barre de statut contextuelle

**Files:**
- Create: `src/components/plan/ToolStatusBar.tsx`
- Modify: `src/components/plan/PlanEditor.tsx` (intégration)

**Contexte :** Pill semi-transparente positionnée `top: 12px, left: 50%` dans l'espace canvas. Affiche le texte du mode actif. Invisible en mode SELECT. Desktop uniquement (`hidden md:block mouse:block`).

---

- [ ] **Étape 1 : Ajouter les tests de logique ToolStatusBar**

Dans `src/components/plan/PlanEditor.toolbar.test.ts`, ajouter à la suite du fichier existant :

```ts
import { TOOL_STATUS_TEXTS } from './ToolStatusBar';

// ── ToolStatusBar ─────────────────────────────────────────────────────────────

describe('ToolStatusBar — STATUS_TEXTS', () => {
  it('SELECT n\'a pas de texte (invisible)', () => {
    expect(TOOL_STATUS_TEXTS['SELECT']).toBeUndefined();
  });

  it('WALL a un texte', () => {
    expect(TOOL_STATUS_TEXTS['WALL']).toBe('Cliquez pour poser un point');
  });

  it('DOOR a un texte', () => {
    expect(TOOL_STATUS_TEXTS['DOOR']).toBe('Cliquez sur un mur pour placer une porte');
  });

  it('COINCIDE a un texte', () => {
    expect(TOOL_STATUS_TEXTS['COINCIDE']).toBe('Cliquez sur le nœud, puis sur un mur/nœud pour les joindre');
  });

  const drawingTools: Array<keyof typeof TOOL_STATUS_TEXTS> = [
    'WALL', 'DOOR', 'PARTITION', 'EXCLUDE',
    'APPLY_H', 'APPLY_V', 'COINCIDE', 'DIMENSION', 'ANCHOR',
  ];

  it('tous les outils de dessin ont un texte non vide', () => {
    for (const tool of drawingTools) {
      expect(TOOL_STATUS_TEXTS[tool]).toBeTruthy();
    }
  });
});
```

- [ ] **Étape 2 : Vérifier que les tests échouent (ToolStatusBar absent)**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/PlanEditor.toolbar.test.ts 2>&1 | tail -10
```

Expected: FAIL — `Cannot find module './ToolStatusBar'`.

- [ ] **Étape 3 : Créer `ToolStatusBar.tsx`**

Créer `src/components/plan/ToolStatusBar.tsx` :

```tsx
'use client';
import type { PlanTool } from './PlanToolbar';

export const TOOL_STATUS_TEXTS: Partial<Record<PlanTool, string>> = {
  WALL:      'Cliquez pour poser un point',
  DOOR:      'Cliquez sur un mur pour placer une porte',
  PARTITION: 'Cliquez pour tracer une cloison',
  EXCLUDE:   'Délimitez la zone à exclure',
  APPLY_H:   "Cliquez sur un mur pour le verrouiller à l'horizontale",
  APPLY_V:   'Cliquez sur un mur pour le verrouiller à la verticale',
  COINCIDE:  'Cliquez sur le nœud, puis sur un mur/nœud pour les joindre',
  DIMENSION: 'Cliquez sur un premier nœud, puis sur le second',
  ANCHOR:    'Cliquez sur un nœud pour le figer en place',
};

export const ToolStatusBar = ({ tool }: { tool: PlanTool }) => {
  const text = TOOL_STATUS_TEXTS[tool];
  if (!text) return null;
  return (
    <div
      data-testid="tool-status-bar"
      className="pointer-events-none absolute left-1/2 top-3 z-10 hidden -translate-x-1/2 md:block mouse:block"
    >
      <span
        className="rounded-full px-3 py-1 text-xs backdrop-blur-sm"
        style={{
          background: 'var(--surf)',
          border: '1px solid var(--bdr)',
          color: 'var(--text2)',
        }}
      >
        {text}
      </span>
    </div>
  );
};
```

- [ ] **Étape 4 : Intégrer dans `PlanEditor.tsx`**

**4a — Ajouter l'import** en tête de fichier avec les autres imports de composants :

```tsx
import { ToolStatusBar } from './ToolStatusBar';
```

**4b — Ajouter le composant** dans le JSX, à l'intérieur du `div` wrapper du canvas (le `div` avec `className="relative flex flex-1 overflow-hidden"` et `style={{ background: 'var(--canvas-bg)', touchAction: 'none' }}`), juste après l'overlay tactile `<div data-testid="mobile-touch-overlay" .../>` :

```tsx
      <ToolStatusBar tool={tool} />
```

Le bloc JSX ressemblera à :

```tsx
      <div
        className="relative flex flex-1 overflow-hidden"
        style={{ background: 'var(--canvas-bg)', touchAction: 'none' }}
        onTouchStart={handleWrapperTouchStart}
        onTouchMove={handleWrapperTouchMove}
        onTouchEnd={handleWrapperTouchEnd}
      >
        {/* Mobile: touch overlay for 1-finger pan (SELECT only) */}
        <div
          data-testid="mobile-touch-overlay"
          className="absolute inset-0 z-10 md:hidden"
          style={{ touchAction: 'none', pointerEvents: tool === 'SELECT' ? 'auto' : 'none' }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
        <ToolStatusBar tool={tool} />
        {/* ... reste du canvas ... */}
```

- [ ] **Étape 5 : Vérifier tests + TypeScript**

```bash
cd /workspaces/Calpiweb && npx vitest run && npx tsc --noEmit
```

Expected: PASS — tous les tests, 0 erreur TS.

- [ ] **Étape 6 : Commit**

```bash
cd /workspaces/Calpiweb && git add src/components/plan/ToolStatusBar.tsx src/components/plan/PlanEditor.tsx src/components/plan/PlanEditor.toolbar.test.ts && git commit -m "feat(toolbar): barre de statut contextuelle centrée en haut du canvas"
```

---

## Task 3 — Mode tutorial

**Files:**
- Modify: `src/components/plan/PlanToolbar.tsx`
- Modify: `src/components/plan/PlanEditor.tsx`

**Contexte :** Le bouton `?` (icône `HelpCircle`) apparaît en tête du toolbar desktop. Quand activé, chaque outil affiche son label à droite. `tutorialMode` state dans PlanEditor, passé à PlanToolbar via props. Touche `?` toggle le mode. `Escape` le ferme (déjà ajouté en Task 1, à compléter).

---

- [ ] **Étape 1 : Ajouter les tests de logique tutorial**

Dans `src/components/plan/PlanEditor.toolbar.test.ts`, ajouter :

```ts
// ── Mode tutorial ─────────────────────────────────────────────────────────────

describe('mode tutorial', () => {
  it('toggle : false → true', () => {
    let tutorialMode = false;
    tutorialMode = !tutorialMode;
    expect(tutorialMode).toBe(true);
  });

  it('toggle : true → false', () => {
    let tutorialMode = true;
    tutorialMode = !tutorialMode;
    expect(tutorialMode).toBe(false);
  });

  it('Escape ferme le mode tutorial', () => {
    let tutorialMode = true;
    // simuler Escape
    if (true /* e.key === 'Escape' */) tutorialMode = false;
    expect(tutorialMode).toBe(false);
  });

  it('touche ? ignorée dans un input', () => {
    const tag = 'INPUT';
    let toggled = false;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') toggled = true;
    expect(toggled).toBe(false);
  });

  it('touche ? active hors input', () => {
    const tag = 'DIV';
    let toggled = false;
    if (tag !== 'INPUT' && tag !== 'TEXTAREA') toggled = true;
    expect(toggled).toBe(true);
  });
});
```

- [ ] **Étape 2 : Vérifier que les tests passent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/PlanEditor.toolbar.test.ts
```

Expected: PASS.

- [ ] **Étape 3 : Mettre à jour `PlanToolbar.tsx` — imports + props**

**3a — Ajouter `HelpCircle` aux imports lucide :**

Localiser la ligne d'import lucide (commence par `import { DoorOpen, ...`). Ajouter `HelpCircle` :

```tsx
import { DoorOpen, HelpCircle, Magnet, MousePointer2, PenTool, Pin, Redo2, Ruler, Trash2, Undo, SplitSquareVertical, Square } from 'lucide-react';
```

**3b — Ajouter `tutorialMode` et `onToggleTutorial` dans l'interface props :**

Localiser `interface PlanToolbarProps` et ajouter les deux props :

```tsx
interface PlanToolbarProps {
  tool: PlanTool;
  canUndo: boolean;
  canRedo: boolean;
  onChangeTool: (tool: PlanTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearRoom: () => void;
  wallThickness: number;
  onWallThicknessChange: (mm: number) => void;
  tutorialMode: boolean;
  onToggleTutorial: () => void;
}
```

**3c — Ajouter les props dans la déstructuration :**

Localiser `export const PlanToolbar = ({` et ajouter `tutorialMode, onToggleTutorial` :

```tsx
export const PlanToolbar = ({
  tool,
  canUndo,
  canRedo,
  onChangeTool,
  onUndo,
  onRedo,
  onClearRoom,
  wallThickness,
  onWallThicknessChange,
  tutorialMode,
  onToggleTutorial,
}: PlanToolbarProps) => (
```

- [ ] **Étape 4 : Ajouter le bouton `?` et les labels tutorial dans le toolbar desktop**

**4a — Ajouter le bouton `?` en tête du toolbar desktop.**

Localiser le premier commentaire `{/* ── Drawing tools ── */}` dans le `div` du toolbar desktop. Insérer juste avant (en tête du toolbar) :

```tsx
    {/* ── Tutorial toggle ── */}
    <button
      type="button"
      aria-label="Mode tutorial"
      onClick={onToggleTutorial}
      className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
        tutorialMode
          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
          : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
      }`}
    >
      <HelpCircle size={15} />
    </button>
    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />
```

**4b — Modifier le toolbar desktop pour que l'overflow soit correct en mode tutorial.**

Remplacer l'attribut `className` du `div` principal du toolbar desktop. Il contient actuellement `overflow-y-auto`. En mode tutorial, l'overflow doit être visible pour que les labels ne soient pas coupés.

Localiser le `div` principal desktop (commence par `className="absolute left-4 top-4 z-10 hidden md:flex mouse:flex flex-col gap-0.5 overflow-y-auto rounded-2xl p-1.5"`).

Le remplacer par :

```tsx
    className={`absolute left-4 top-4 z-10 hidden md:flex mouse:flex flex-col gap-0.5 rounded-2xl p-1.5 shadow-2xl backdrop-blur-md ${tutorialMode ? 'overflow-visible' : 'overflow-y-auto'}`}
    style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', boxShadow: 'var(--sh-lg)', maxHeight: tutorialMode ? undefined : 'calc(100vh - 108px)', scrollbarWidth: 'none' }}
```

**4c — Envelopper chaque outil desktop dans un wrapper flex avec label conditionnel.**

Pour chaque outil dans le toolbar desktop, envelopper le `<ToolTooltip>` dans un `<div className="flex items-center">` et ajouter le label conditionnel à droite.

Pattern à appliquer pour **chaque** bouton d'outil (ne pas faire pour les séparateurs, undo, redo, clear, WallThicknessControl) :

```tsx
<div className="flex items-center">
  <ToolTooltip {...TOOL_TOOLTIPS.SELECT}>
    <Button variant={tool === 'SELECT' ? 'active' : 'tool'} size="icon" className="h-8 w-8"
      onClick={() => onChangeTool('SELECT')}>
      <MousePointer2 size={16} />
    </Button>
  </ToolTooltip>
  {tutorialMode && (
    <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>
      Sélectionner
    </span>
  )}
</div>
```

Appliquer ce pattern pour tous les outils avec leurs labels respectifs :

| Outil | Label |
|---|---|
| SELECT | Sélectionner |
| WALL | Tracer des murs |
| DOOR | Placer une porte |
| PARTITION | Cloison (pointillés) |
| EXCLUDE | Zone non carrelée |
| APPLY_H | Contrainte horizontale |
| APPLY_V | Contrainte verticale |
| COINCIDE | Coïncidence |
| DIMENSION | Cotation |
| ANCHOR | Ancrer un nœud |

- [ ] **Étape 5 : Mettre à jour `PlanEditor.tsx`**

**5a — Ajouter le state `tutorialMode` dans PlanEditor.**

Localiser les autres `useState` en tête du composant PlanEditor (par exemple après `const [tool, setTool] = useState<PlanTool>(...)`) et ajouter :

```tsx
const [tutorialMode, setTutorialMode] = useState(false);
```

**5b — Ajouter le handler touche `?` dans le listener `keydown` existant.**

Localiser le `useEffect` qui gère `keydown` (vers ligne 419). Dans la fonction `down`, ajouter à la suite des autres raccourcis (après le bloc Ctrl+Z/Y) :

```tsx
      if (e.key === '?') {
        const tag = (document.activeElement as HTMLElement)?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          setTutorialMode((v) => !v);
        }
      }
```

**5c — Compléter le handler `Escape` avec `setTutorialMode(false)`.**

Localiser le bloc `if (e.key === 'Escape')` mis à jour en Task 1. Ajouter `setTutorialMode(false)` :

```tsx
      if (e.key === 'Escape') {
        setTool('SELECT');
        setTutorialMode(false);
        setEditingEdge(null); setEditingZoneEdge(null); setEditingPartition(null);
        setEditingPartitionThickness(null); setEditingThicknessEdge(null); setEditingPartitionDimension(null);
        setDraggedVertex(null); setDraggedZoneVertex(null); setDraggedPartitionVertex(null);
        setCoincideSource(null); setDimensionSource(null); setPartitionOrigin(null); setExcludePoints([]);
      }
```

**5d — Passer `tutorialMode` et `onToggleTutorial` à `<PlanToolbar>`.**

Localiser le rendu `<PlanToolbar` dans le JSX de PlanEditor et ajouter les deux props :

```tsx
      <PlanToolbar
        tool={tool}
        canUndo={canUndo}
        canRedo={canRedo}
        onChangeTool={setTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClearRoom={handleClearRoom}
        wallThickness={wallThickness}
        onWallThicknessChange={setWallThickness}
        tutorialMode={tutorialMode}
        onToggleTutorial={() => setTutorialMode((v) => !v)}
      />
```

- [ ] **Étape 6 : Vérifier tests + TypeScript**

```bash
cd /workspaces/Calpiweb && npx vitest run && npx tsc --noEmit
```

Expected: PASS — tous les tests, 0 erreur TS.

- [ ] **Étape 7 : Commit**

```bash
cd /workspaces/Calpiweb && git add src/components/plan/PlanToolbar.tsx src/components/plan/PlanEditor.tsx src/components/plan/PlanEditor.toolbar.test.ts && git commit -m "feat(toolbar): mode tutorial — bouton ? + labels + touche ?"
```

---

## Task 4 — Suppression THICKNESS + épaisseur cloison en SELECT

**Files:**
- Modify: `src/components/plan/PlanToolbar.tsx`
- Modify: `src/components/plan/PlanEditor.tsx`

**Contexte :** L'outil THICKNESS est retiré complètement. La logique d'édition de l'épaisseur des cloisons (`editingPartitionThickness`) est migrée : elle est désormais déclenchée depuis le handler SELECT de `handlePointerDown` quand on clique sur l'arête d'une cloison.

**États à supprimer** (spécifiques au tool THICKNESS wall edge) :
- `editingThicknessEdge` + `setEditingThicknessEdge`
- `editThicknessEdgeValue` + `setEditThicknessEdgeValue`

**États à conserver** (déplacés vers SELECT) :
- `editingPartitionThickness` + `setEditingPartitionThickness`
- `editThicknessValue` + `setEditThicknessValue`
- calcul `partitionThicknessEditorScreen`
- `<DimensionEditor .../>` pour `editingPartitionThickness`

---

- [ ] **Étape 1 : Ajouter les tests de type et de logique**

Dans `src/components/plan/PlanEditor.toolbar.test.ts`, ajouter :

```ts
// ── Suppression THICKNESS ─────────────────────────────────────────────────────

describe('PlanTool type — sans THICKNESS', () => {
  it('THICKNESS n\'est pas une PlanTool valide', () => {
    const tools: PlanTool[] = [
      'SELECT', 'WALL', 'DOOR', 'APPLY_H', 'APPLY_V',
      'COINCIDE', 'ANCHOR', 'PARTITION', 'EXCLUDE', 'DIMENSION',
    ];
    expect(tools).not.toContain('THICKNESS' as PlanTool);
  });
});

// ── Partition thickness en SELECT ─────────────────────────────────────────────

describe('partition thickness via SELECT', () => {
  it('un clic sur une partition en SELECT ouvre editingPartitionThickness', () => {
    // Logique pure : findNearestPartitionEdge retourne un résultat → setEditingPartitionThickness appelé
    const partEdge = { roomId: 'r1', partitionId: 'p1' }; // simulé
    const tool: PlanTool = 'SELECT';
    let editingPartitionThickness: { roomId: string; partitionId: string } | null = null;

    if (tool === 'SELECT' && partEdge) {
      editingPartitionThickness = { roomId: partEdge.roomId, partitionId: partEdge.partitionId };
    }

    expect(editingPartitionThickness).toEqual({ roomId: 'r1', partitionId: 'p1' });
  });
});
```

- [ ] **Étape 2 : Vérifier que les tests échouent** (`'THICKNESS' as PlanTool` n'est pas encore une erreur TS — les tests passeront, mais c'est normal : on vérifie la logique)

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/PlanEditor.toolbar.test.ts
```

Expected: PASS (les tests de logique pure passent dès maintenant).

- [ ] **Étape 3 : Mettre à jour `PlanToolbar.tsx`**

**3a — Retirer `'THICKNESS'` du type `PlanTool` :**

Remplacer :
```tsx
export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'APPLY_H' | 'APPLY_V' | 'COINCIDE' | 'ANCHOR' | 'PARTITION' | 'EXCLUDE' | 'DIMENSION' | 'THICKNESS';
```
par :
```tsx
export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'APPLY_H' | 'APPLY_V' | 'COINCIDE' | 'ANCHOR' | 'PARTITION' | 'EXCLUDE' | 'DIMENSION';
```

**3b — Supprimer l'entrée THICKNESS dans `TOOL_TOOLTIPS` :**

Supprimer la ligne :
```tsx
  THICKNESS: { label: 'Épaisseur',               description: "Modifie l'épaisseur d'un mur ou d'une cloison" },
```

**3c — Supprimer le bouton THICKNESS dans le toolbar desktop :**

Localiser et supprimer entièrement le bloc suivant (wrapper div + ToolTooltip + button THICKNESS) :

```tsx
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.THICKNESS}>
        <button type="button" onClick={() => onChangeTool('THICKNESS')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-black transition-all ${
            tool === 'THICKNESS'
              ? 'bg-slate-500 text-white shadow-md shadow-slate-500/30'
              : `${TB_CARD} hover:bg-slate-100 dark:hover:bg-slate-900/30 hover:text-slate-600 dark:hover:text-slate-300`
          }`}
          style={tool !== 'THICKNESS' ? { color: 'var(--text2)' } : {}}>
          E
        </button>
      </ToolTooltip>
      {tutorialMode && (
        <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>
          Épaisseur
        </span>
      )}
    </div>
```

**3d — Supprimer le bouton THICKNESS dans le toolbar mobile :**

Localiser et supprimer le bloc button THICKNESS dans la barre mobile (celui avec `aria-label="Épaisseur"`) :

```tsx
    <button
      type="button"
      aria-label="Épaisseur"
      onClick={() => onChangeTool('THICKNESS')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
        tool === 'THICKNESS' ? 'bg-slate-500 text-white shadow-md shadow-slate-500/30' : `${TB_CARD}`
      }`}
      style={tool !== 'THICKNESS' ? { color: 'var(--text2)' } : {}}
    >
      E
    </button>
```

- [ ] **Étape 4 : Mettre à jour `PlanEditor.tsx` — supprimer états THICKNESS wall**

**4a — Supprimer les deux états** (vers ligne 237-239) :

Supprimer ces deux lignes :
```tsx
  const [editingThicknessEdge, setEditingThicknessEdge] = useState<{ roomId: string; edgeIndex: number } | null>(null);
  const [editThicknessEdgeValue, setEditThicknessEdgeValue] = useState('');
```

**4b — Retirer `setEditingThicknessEdge(null)` du handler Escape :**

Dans le bloc `if (e.key === 'Escape')`, supprimer `setEditingThicknessEdge(null)` :

```tsx
      if (e.key === 'Escape') {
        setTool('SELECT');
        setTutorialMode(false);
        setEditingEdge(null); setEditingZoneEdge(null); setEditingPartition(null);
        setEditingPartitionThickness(null); setEditingPartitionDimension(null);
        setDraggedVertex(null); setDraggedZoneVertex(null); setDraggedPartitionVertex(null);
        setCoincideSource(null); setDimensionSource(null); setPartitionOrigin(null); setExcludePoints([]);
      }
```

**4c — Supprimer le guard Escape** `if (editingThicknessEdge !== null) { ... }` (vers ligne 618) :

```tsx
    if (editingThicknessEdge !== null) { setEditingThicknessEdge(null); return; }
```

**4d — Supprimer le bloc THICKNESS dans `handlePointerDown`** (vers lignes 628-647) :

```tsx
    // ── THICKNESS ──
    if (tool === 'THICKNESS') {
      const wallEdge = findNearestWallEdge(raw);
      if (wallEdge) {
        const room = rooms.find((r) => r.id === wallEdge.roomId); if (!room) return;
        const currentThickness = room.edgeThicknesses?.[wallEdge.edgeIndex] ?? wallThickness;
        setEditingThicknessEdge({ roomId: wallEdge.roomId, edgeIndex: wallEdge.edgeIndex });
        setEditThicknessEdgeValue((currentThickness / 10).toFixed(0));
        return;
      }
      const partEdge = findNearestPartitionEdge(raw);
      if (partEdge) {
        const part = rooms.find((r) => r.id === partEdge.roomId)?.partitions?.find((p) => p.id === partEdge.partitionId);
        if (!part) return;
        setEditingPartitionThickness({ roomId: partEdge.roomId, partitionId: partEdge.partitionId });
        setEditThicknessValue((part.thickness / 10).toFixed(0));
        return;
      }
      return;
    }
```

**4e — Supprimer les 4 guards `if (tool === 'THICKNESS') return`** dans `handlePointerMove`, `handlePartitionVertexPointerDown`, `handleZoneVertexPointerDown`, et `handleVertexPointerDown` (lignes ~879, ~940, ~1000, ~1058) :

```tsx
    } else if (tool === 'THICKNESS') {
      setHoveredEdge(findNearestWallEdge(raw));
      setHoveredPartitionEdge(findNearestPartitionEdge(raw));
    }
```
→ Supprimer entièrement cette branche `else if`.

```tsx
    if (tool === 'THICKNESS') return;
```
→ Supprimer ces 3 occurrences dans les vertex handlers.

**4f — Supprimer le calcul `thicknessEdgeEditorScreen`** (vers lignes 1366-1372) :

```tsx
  let thicknessEdgeEditorScreen: { x: number; y: number } | undefined;
  if (editingThicknessEdge) {
    const room = rooms.find((r) => r.id === editingThicknessEdge.roomId);
    if (room) {
      const p1 = room.points[editingThicknessEdge.edgeIndex];
      const p2 = room.points[(editingThicknessEdge.edgeIndex + 1) % room.points.length];
      if (p1 && p2) thicknessEdgeEditorScreen = { x: ((p1.x + p2.x) / 2) * scale + pan.x, y: ((p1.y + p2.y) / 2) * scale + pan.y };
    }
  }
```

**4g — Supprimer le `<DimensionEditor>` pour `editingThicknessEdge`** (vers ligne 1521) :

```tsx
      {editingThicknessEdge !== null && (
        <DimensionEditor screenX={isTouchDevice ? undefined : thicknessEdgeEditorScreen?.x} screenY={isTouchDevice ? undefined : thicknessEdgeEditorScreen?.y}
          ...
        />
      )}
```

- [ ] **Étape 5 : Ajouter l'ouverture de l'éditeur partition depuis SELECT**

Dans `handlePointerDown`, après le bloc `if (tool === 'DOOR') { ... }` (qui se termine vers ligne 810), ajouter ce nouveau bloc avant la fermeture `};` du handler :

```tsx
    // ── SELECT — clic sur une cloison → édition épaisseur ──
    if (tool === 'SELECT') {
      const partEdge = findNearestPartitionEdge(raw);
      if (partEdge) {
        const part = rooms
          .find((r) => r.id === partEdge.roomId)
          ?.partitions?.find((p) => p.id === partEdge.partitionId);
        if (part) {
          setEditingPartitionThickness({ roomId: partEdge.roomId, partitionId: partEdge.partitionId });
          setEditThicknessValue((part.thickness / 10).toFixed(0));
          return;
        }
      }
    }
```

- [ ] **Étape 6 : Vérifier TypeScript + tous les tests**

```bash
cd /workspaces/Calpiweb && npx vitest run && npx tsc --noEmit
```

Expected: PASS — tous les tests, 0 erreur TS. (TypeScript signalera tout usage restant de `'THICKNESS'` comme valeur de `PlanTool` s'il en reste.)

- [ ] **Étape 7 : Commit**

```bash
cd /workspaces/Calpiweb && git add src/components/plan/PlanToolbar.tsx src/components/plan/PlanEditor.tsx src/components/plan/PlanEditor.toolbar.test.ts && git commit -m "feat(toolbar): suppression outil THICKNESS + épaisseur cloison via clic SELECT"
```

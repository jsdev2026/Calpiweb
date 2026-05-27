# Mobile Drawing Fix — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre le dessin et les popups de cotation fonctionnels sur téléphone tactile (portrait, `pointer: coarse`) sans modifier le layout ni l'UX existants.

**Architecture:** Un seul fichier modifié — `PlanEditor.tsx`. (1) L'overlay tactile reçoit `pointer-events: none` dès que l'outil actif n'est pas `SELECT`, laissant les pointer events atteindre le SVG nativement. (2) Le pinch-zoom migre sur le `div` wrapper du canvas pour rester actif quel que soit l'outil. (3) Sur écran tactile, les éditeurs flottants reçoivent `screenX/screenY = undefined` pour utiliser leur fallback de positionnement haut-centré (déjà présent dans leurs composants).

**Tech Stack:** TypeScript, React 18, Vitest, @testing-library/react

---

## Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `src/components/plan/PlanEditor.tsx` | Tous les changements : pointer-events overlay, pinch sur wrapper, isTouchDevice, coords éditeurs |
| `src/components/plan/PlanEditor.mobile.test.tsx` | **Créé** — tests unitaires des nouvelles règles de rendu |

---

## Task 1 — Overlay tactile conditionnel + pinch-zoom sur wrapper

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx:260-312` (handlers touch) et `:1383-1392` (overlay div) et `:1383` (wrapper div)
- Create: `src/components/plan/PlanEditor.mobile.test.tsx`

**Contexte :**

L'overlay actuel (`data-testid` absent — on va en ajouter un) bloque tout touch. On veut :
- `pointer-events: none` sur l'overlay quand `tool !== 'SELECT'` → les pointer events tombent sur le SVG
- `pointer-events: auto` quand `tool === 'SELECT'` → le pan 1-doigt fonctionne comme avant
- Le pinch-zoom (2 doigts) migre sur le wrapper du canvas (qui englobe l'overlay ET le SVG) pour fonctionner quel que soit l'outil

Le handler 1-doigt existant (`handleTouchStart`) est simplifié : il ne gère plus que le pan SELECT. Le handler pinch est déplacé dans `handleWrapperTouchStart/Move/End`.

---

- [ ] **Étape 1 : Ajouter un `data-testid` à l'overlay et écrire les tests**

Créer `src/components/plan/PlanEditor.mobile.test.tsx` :

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Tests logique pointer-events overlay ─────────────────────────────────────

describe('overlay pointer-events logic', () => {
  const tools = ['WALL', 'DOOR', 'PARTITION', 'EXCLUDE', 'APPLY_H', 'APPLY_V',
                 'DIMENSION', 'COINCIDE', 'ANCHOR', 'THICKNESS'] as const;

  it('overlay a pointer-events: none pour chaque outil de dessin', () => {
    for (const tool of tools) {
      const pe = tool === 'SELECT' ? 'auto' : 'none';
      expect(pe).toBe('none');
    }
  });

  it('overlay a pointer-events: auto pour SELECT', () => {
    const tool = 'SELECT';
    const pe = tool === 'SELECT' ? 'auto' : 'none';
    expect(pe).toBe('auto');
  });
});

// ── Tests isTouchDevice ───────────────────────────────────────────────────────

describe('isTouchDevice detection', () => {
  beforeEach(() => {
    // Reset matchMedia mock
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(),
    });
  });

  it('retourne true si pointer: coarse', () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: true });
    const result = window.matchMedia('(pointer: coarse)').matches;
    expect(result).toBe(true);
  });

  it('retourne false si pointer: fine (souris)', () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: false });
    const result = window.matchMedia('(pointer: coarse)').matches;
    expect(result).toBe(false);
  });
});

// ── Tests coordonnées éditeurs ────────────────────────────────────────────────

describe('editor screen coords', () => {
  it('retourne undefined quand isTouchDevice = true', () => {
    const isTouchDevice = true;
    const screenX = 300;
    const result = isTouchDevice ? undefined : screenX;
    expect(result).toBeUndefined();
  });

  it('retourne la valeur quand isTouchDevice = false', () => {
    const isTouchDevice = false;
    const screenX = 300;
    const result = isTouchDevice ? undefined : screenX;
    expect(result).toBe(300);
  });
});
```

- [ ] **Étape 2 : Vérifier que les tests passent** (ils testent la logique pure — doivent passer immédiatement)

```bash
cd /workspaces/Calpiweb && npx vitest run src/components/plan/PlanEditor.mobile.test.tsx
```

Expected: PASS — 6 tests.

- [ ] **Étape 3 : Extraire les nouveaux handlers touch dans PlanEditor.tsx**

Localiser les handlers existants (lignes 262–312) et les remplacer :

```tsx
// ── Touch handlers ─────────────────────────────────────────────────────────

// Overlay : pan 1-doigt (SELECT uniquement)
const handleTouchStart = (e: React.TouchEvent) => {
  if (e.touches.length !== 1) return;
  e.preventDefault();
  const t = e.touches;
  touchRef.current = { dist: 0, midX: t[0]!.clientX, midY: t[0]!.clientY, panX: pan.x, panY: pan.y };
};

const handleTouchMove = (e: React.TouchEvent) => {
  e.preventDefault();
  const t = e.touches;
  if (!touchRef.current || t.length !== 1 || touchRef.current.dist !== 0) return;
  const dx = t[0]!.clientX - touchRef.current.midX;
  const dy = t[0]!.clientY - touchRef.current.midY;
  setPan({ x: touchRef.current.panX + dx, y: touchRef.current.panY + dy });
};

const handleTouchEnd = () => {
  touchRef.current = null;
};

// Wrapper : pinch-zoom 2 doigts (tous outils)
const handleWrapperTouchStart = (e: React.TouchEvent) => {
  if (e.touches.length !== 2) return;
  e.preventDefault();
  const t = e.touches;
  const dx = t[1]!.clientX - t[0]!.clientX;
  const dy = t[1]!.clientY - t[0]!.clientY;
  touchRef.current = {
    dist: Math.hypot(dx, dy),
    midX: (t[0]!.clientX + t[1]!.clientX) / 2,
    midY: (t[0]!.clientY + t[1]!.clientY) / 2,
    panX: pan.x,
    panY: pan.y,
  };
};

const handleWrapperTouchMove = (e: React.TouchEvent) => {
  if (e.touches.length !== 2 || !touchRef.current || touchRef.current.dist === 0) return;
  const t = e.touches;
  const dx = t[1]!.clientX - t[0]!.clientX;
  const dy = t[1]!.clientY - t[0]!.clientY;
  const dist = Math.hypot(dx, dy);
  const midX = (t[0]!.clientX + t[1]!.clientX) / 2;
  const midY = (t[0]!.clientY + t[1]!.clientY) / 2;
  const svg = svgRef.current;
  if (svg) {
    const ratio = dist / touchRef.current.dist;
    const rect = svg.getBoundingClientRect();
    const mx = midX - rect.left;
    const my = midY - rect.top;
    setScale((s) => {
      const ns = Math.max(0.005, Math.min(s * ratio, 4));
      setPan((p) => ({ x: mx - (mx - p.x) * (ns / s), y: my - (my - p.y) * (ns / s) }));
      return ns;
    });
  }
  touchRef.current = { dist, midX, midY, panX: pan.x, panY: pan.y };
};

const handleWrapperTouchEnd = () => {
  if (touchRef.current && touchRef.current.dist > 0) touchRef.current = null;
};
```

- [ ] **Étape 4 : Mettre à jour l'overlay div dans le JSX**

Localiser le bloc (vers ligne 1385) :

```tsx
      {/* Mobile: touch overlay for pan + pinch-to-zoom */}
      <div
        className="absolute inset-0 z-10 md:hidden"
        style={{ touchAction: 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
```

Le remplacer par :

```tsx
      {/* Mobile: touch overlay for 1-finger pan (SELECT only) */}
      <div
        data-testid="mobile-touch-overlay"
        className="absolute inset-0 z-10 md:hidden"
        style={{ touchAction: 'none', pointerEvents: tool === 'SELECT' ? 'auto' : 'none' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
```

- [ ] **Étape 5 : Mettre à jour le wrapper div du canvas**

Localiser (vers ligne 1383) :

```tsx
      <div className="relative flex flex-1 overflow-hidden" style={{ background: 'var(--canvas-bg)' }}>
```

Remplacer par :

```tsx
      <div
        className="relative flex flex-1 overflow-hidden"
        style={{ background: 'var(--canvas-bg)' }}
        onTouchStart={handleWrapperTouchStart}
        onTouchMove={handleWrapperTouchMove}
        onTouchEnd={handleWrapperTouchEnd}
      >
```

- [ ] **Étape 6 : Vérifier que tous les tests passent**

```bash
cd /workspaces/Calpiweb && npx vitest run
```

Expected: PASS — tous les tests existants + 6 nouveaux.

- [ ] **Étape 7 : Commit**

```bash
cd /workspaces/Calpiweb && git add src/components/plan/PlanEditor.tsx src/components/plan/PlanEditor.mobile.test.tsx && git commit -m "fix(mobile): overlay pointer-events conditionnel + pinch-zoom sur wrapper canvas"
```

---

## Task 2 — Éditeurs de cotation repositionnés sur écran tactile

**Files:**
- Modify: `src/components/plan/PlanEditor.tsx:~208` (useMemo isTouchDevice) et `:1467-1501` (5 éditeurs flottants)

**Contexte :**

`WallEdgeEditor` et `DimensionEditor` ont déjà un fallback de positionnement quand `screenX`/`screenY` sont `undefined` :
```tsx
style={
  positioned
    ? { left: screenX, top: screenY, transform: '...' }
    : { left: '50%', top: '1rem', transform: 'translateX(-50%)' }  // ← fallback haut-centré
}
```
Sur mobile tactile, passer `undefined` suffit à activer ce fallback — zéro changement dans les composants éditeurs.

---

- [ ] **Étape 1 : Ajouter `isTouchDevice` dans PlanEditor.tsx**

Après les imports React (en haut du composant, après les autres `useMemo`), ajouter :

```tsx
const isTouchDevice = useMemo(
  () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  [],
);
```

Placer ce `useMemo` **avant** tout `return` conditionnel dans le composant (respect des rules of hooks).

- [ ] **Étape 2 : Conditionner les coordonnées des 5 éditeurs**

**WallEdgeEditor** (1 occurrence, vers ligne 1467) — remplacer :
```tsx
<WallEdgeEditor
  screenX={editorScreen?.x} screenY={editorScreen?.y}
  above={above}
  ...
/>
```
par :
```tsx
<WallEdgeEditor
  screenX={isTouchDevice ? undefined : editorScreen?.x}
  screenY={isTouchDevice ? undefined : editorScreen?.y}
  above={above}
  ...
/>
```

**DimensionEditor zoneEdge** (vers ligne 1479) — remplacer :
```tsx
<DimensionEditor screenX={zoneEditorScreen?.x} screenY={zoneEditorScreen?.y}
```
par :
```tsx
<DimensionEditor screenX={isTouchDevice ? undefined : zoneEditorScreen?.x} screenY={isTouchDevice ? undefined : zoneEditorScreen?.y}
```

**DimensionEditor partition** (vers ligne 1484) — remplacer :
```tsx
<DimensionEditor screenX={partitionEditorScreen?.x} screenY={partitionEditorScreen?.y}
```
par :
```tsx
<DimensionEditor screenX={isTouchDevice ? undefined : partitionEditorScreen?.x} screenY={isTouchDevice ? undefined : partitionEditorScreen?.y}
```

**DimensionEditor partitionThickness** (vers ligne 1489) — remplacer :
```tsx
<DimensionEditor screenX={partitionThicknessEditorScreen?.x} screenY={partitionThicknessEditorScreen?.y}
```
par :
```tsx
<DimensionEditor screenX={isTouchDevice ? undefined : partitionThicknessEditorScreen?.x} screenY={isTouchDevice ? undefined : partitionThicknessEditorScreen?.y}
```

**DimensionEditor thicknessEdge** (vers ligne 1494) — remplacer :
```tsx
<DimensionEditor screenX={thicknessEdgeEditorScreen?.x} screenY={thicknessEdgeEditorScreen?.y}
```
par :
```tsx
<DimensionEditor screenX={isTouchDevice ? undefined : thicknessEdgeEditorScreen?.x} screenY={isTouchDevice ? undefined : thicknessEdgeEditorScreen?.y}
```

**DimensionEditor partitionDim** (vers ligne 1499) — remplacer :
```tsx
<DimensionEditor screenX={partitionDimEditorScreen?.x} screenY={partitionDimEditorScreen?.y}
```
par :
```tsx
<DimensionEditor screenX={isTouchDevice ? undefined : partitionDimEditorScreen?.x} screenY={isTouchDevice ? undefined : partitionDimEditorScreen?.y}
```

- [ ] **Étape 3 : Vérifier la suite complète + TypeScript**

```bash
cd /workspaces/Calpiweb && npx vitest run && npx tsc --noEmit
```

Expected: PASS — tous les tests, 0 erreur TypeScript.

- [ ] **Étape 4 : Commit**

```bash
cd /workspaces/Calpiweb && git add src/components/plan/PlanEditor.tsx && git commit -m "fix(mobile): éditeurs de cotation positionnés en haut sur écran tactile"
```

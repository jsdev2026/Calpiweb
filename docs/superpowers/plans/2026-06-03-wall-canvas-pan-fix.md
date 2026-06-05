# Fix Pan WallDrawingCanvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rétablir le pan par clic droit et clic-glisser gauche sur zone vide en mode SELECT dans `WallDrawingCanvas`.

**Architecture:** 3 modifications ciblées dans `handlePointerDown` et le JSX du `<svg>` dans `WallDrawingCanvas.tsx`. Aucun autre fichier touché.

**Tech Stack:** TypeScript, React

**Spec:** `docs/superpowers/specs/2026-06-03-wall-canvas-pan-fix-design.md`

---

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `src/components/plan/WallDrawingCanvas.tsx` | **Modifier** — 3 micro-changements |

---

### Task 1 : Appliquer les 3 corrections de pan

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

- [ ] **Step 1.1 : Lire le fichier pour localiser les 3 endroits exacts**

Lire `src/components/plan/WallDrawingCanvas.tsx` et repérer :
1. La ligne `if (e.button === 1 || (e.button === 0 && e.altKey))` (autour de la ligne 221) — déclencheur du pan
2. Le bloc `tool === 'SELECT'` dans `handlePointerDown` — la branche `else` qui désélectionne sans panner
3. La balise `<svg` dans le `return` (vers la fin du fichier)

- [ ] **Step 1.2 : Correction 1 — ajouter le clic droit au déclencheur de pan**

Remplacer :
```typescript
if (e.button === 1 || (e.button === 0 && e.altKey)) {
```

Par :
```typescript
if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
```

- [ ] **Step 1.3 : Correction 2 — SELECT + clic gauche zone vide → pan**

Dans le bloc `if (tool === 'SELECT')`, trouver la branche `else` du `if (hit)` (elle contient actuellement `setEditingWallId(null)`) et la remplacer par :

```typescript
} else {
  setEditingWallId(null);
  setIsPanning(true);
  const sp = getSvgPos(e);
  panStart.current = { panX: pan.x, panY: pan.y, clientX: sp.x, clientY: sp.y };
  (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
}
```

- [ ] **Step 1.4 : Correction 3 — bloquer le menu contextuel navigateur**

Trouver la balise `<svg` dans le `return` et ajouter `onContextMenu` :

```typescript
<svg
  ref={svgRef}
  className="h-full w-full cursor-crosshair select-none"
  onPointerDown={handlePointerDown}
  onPointerMove={handlePointerMove}
  onPointerUp={handlePointerUp}
  onKeyDown={handleKeyDown}
  onContextMenu={(e) => e.preventDefault()}
  tabIndex={0}
>
```

- [ ] **Step 1.5 : Lancer les tests**

```
npx vitest run
```

Résultat attendu : **343 tests PASS, 0 failures**.

- [ ] **Step 1.6 : Commit**

```bash
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "fix(wall-canvas): pan — clic droit + SELECT zone vide déclenchent le pan"
```

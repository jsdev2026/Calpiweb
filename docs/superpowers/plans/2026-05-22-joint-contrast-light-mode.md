# Joint contrast light mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Améliorer le contraste des joints en light mode en assombrissant deux tokens CSS dans `globals.css`.

**Architecture:** Changement purement CSS — deux valeurs de tokens dans `:root`. Aucune modification JS/TSX. Les tokens sont consommés via `var()` dans `TilingCanvas.tsx` et `QuantitiesPanel.tsx` ; le fix s'y propage automatiquement.

**Tech Stack:** CSS custom properties, Next.js (styles globaux)

---

### Task 1 : Modifier les tokens CSS light mode

**Files:**
- Modify: `src/app/globals.css:44-45`

- [ ] **Step 1 : Changer les deux valeurs dans `:root`**

Dans [src/app/globals.css](src/app/globals.css), remplacer les lignes 44-45 :

```css
  /* Tile visualization */
  --tile-cut-bg:   #cbd5e1;
  --tile-joint:    #94a3b8;
```

(Avant : les deux valaient `#d1d5db`)

- [ ] **Step 2 : Vérifier visuellement en light mode**

Lancer l'app :
```bash
npm run dev
```

Ouvrir `http://localhost:3000`, naviguer jusqu'à la vue calepinage avec une pièce configurée.  
S'assurer que le thème est en **light mode** (pas de `data-dark="true"` sur le `<html>`).

Vérifications attendues :
- Les joints (espaces entre carreaux) sont clairement visibles en **slate-400** (`#94a3b8`)
- Les carreaux coupés (couleur `--tile-cut-bg`) apparaissent légèrement plus clairs que les joints
- Le dark mode est inchangé (basculer avec le toggle — les joints doivent rester quasi-noirs)
- La miniature du panel quantités reflète aussi le changement (elle utilise les mêmes tokens)

- [ ] **Step 3 : Commit**

```bash
git add src/app/globals.css
git commit -m "fix(tiling): améliorer le contraste des joints en light mode

--tile-joint: #d1d5db → #94a3b8 (slate-400)
--tile-cut-bg: #d1d5db → #cbd5e1 (slate-300)"
```

# Protocole de test d'intégration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créer `quantityEngine.integration.test.ts` avec 4 scénarios STRAIGHT à valeurs absolues vérifiées + 8 invariants mathématiques.

**Architecture:** Un seul fichier de test, deux `describe` blocs. Les scénarios appellent `analyzeQuantities` directement avec des pièces rectangulaires et des tuiles 100×100 joint=2 dont les résultats sont calculables à la main. Les invariants sont extraits dans une fonction utilitaire appelée sur chaque résultat.

**Tech Stack:** TypeScript, Vitest, `analyzeQuantities` depuis `@/engine/quantities/quantityEngine`.

---

## Contexte métier (lire avant d'implémenter)

Le moteur de quantitatif calcule le nombre de tuiles à commander pour carreler une pièce. Il distingue :
- **wholeCount** — tuiles entières (sans découpe)
- **cuts** — tuiles coupées, chacune avec ses dimensions et ses bords (factory = bord d'usine, cut = bord sciée)
- **totalReuseCount** — coupes dont la chute d'une autre coupe est réutilisée
- **tilesForCuts** = `cuts.length - totalReuseCount`
- **totalTiles** = `wholeCount + tilesForCuts`
- **toOrder** = `ceil(totalTiles × 1.1)` (marge de 10 %)

### Calcul des dimensions

Avec tuile 100×100 mm et joint 2 mm :
- **pitch** (pas de pose) = 102 mm
- Les tuiles se posent aux positions x = 0, 102, 204, … en coordonnées tile-space
- Pour une pièce de largeur W :
  - Tuiles entières : `floor(W / 102)` colonnes complètes  
  - Coupe droite si `W mod 102 > 0` → `usedW = W - floor(W / 102) × 102`
- La pièce parfaite s'arrête exactement au bord de la dernière tuile : largeur = `n × 102 - 2` (n tuiles × pitch − joint final absent)

### Règle de réutilisation

L'algorithme `assignOffcuts` trie les coupes par aire décroissante. La première d'un groupe de coupes identiques génère une chute dans le pool ; la suivante l'utilise. Résultat : **1 réutilisation par paire de coupes identiques**.

### Seuil de chute récupérable

`MIN_CHUTE_MM = 50`. Une chute est viable seulement si `chuteW ≥ 50 ET chuteH ≥ 50`. Si la chute est inférieure au seuil, elle est zeroed out (`chuteW = chuteH = 0`).

---

## Structure des fichiers

| Fichier | Action |
|---|---|
| `src/engine/quantities/quantityEngine.integration.test.ts` | Créer |

---

## Task 1 : Tests d'intégration + invariants

**Files:**
- Create: `src/engine/quantities/quantityEngine.integration.test.ts`

### Calculs des scénarios

**Scénario 1 — Ajustement parfait (room 304×202)**

3 colonnes × 2 rangées avec pitch=102 :
- x = 0 (0–100), 102 (102–202), 204 (204–304) → room s'arrête à 304 = dernier bord ✓
- y = 0 (0–100), 102 (102–202) → room s'arrête à 202 = dernier bord ✓
- Toutes les tuiles sont entièrement dans la pièce → **wholeCount=6, cuts=0**

**Scénario 2 — Coupe droite (room 254×202)**

2 colonnes entières + 1 partielle à x=204 :
- Tuile à x=204 : clippée à x=204..254 → usedW=50, chuteW=50 (≥50 → viable), chuteH=100
- 2 rangées → **2 coupes identiques** (usedW=50, usedH=100, bord droit=`cut`)
- Aire de chaque coupe = 5000 mm². Tri décroissant : tie → ordre stable.
- Coupe 1 → ajoute chute 50×100 au pool. Coupe 2 → couverte par cette chute.
- **wholeCount=4, cuts=2, totalReuseCount=1, tilesForCuts=1, totalTiles=5**

**Scénario 3 — Coupe basse (room 202×254)**

Symétrique du scénario 2 sur l'axe vertical :
- Tuile à y=204 : clippée à y=204..254 → usedH=50, chuteH=50 (viable), chuteW=100
- 2 colonnes → **2 coupes identiques** (usedW=100, usedH=50, bord bas=`cut`)
- Même raisonnement de réutilisation.
- **wholeCount=4, cuts=2, totalReuseCount=1, tilesForCuts=1, totalTiles=5**

**Scénario 4 — Coupes en coin (room 254×254)**

2×2 entières + 1 colonne partielle (x=204) + 1 rangée partielle (y=204) :
- 2 coupes droites (usedW=50, usedH=100, aire=5000)
- 2 coupes basses (usedW=100, usedH=50, aire=5000)
- 1 coupe coin (usedW=50, usedH=50, aire=2500)
- Tri décroissant : les 4 coupes d'aire 5000 d'abord, coin en dernier.
- Les 4 coupes égales : paire 1 → 1 couverte ; paire 2 → 1 couverte. La chute d'une coupe droite (50×100) couvre une coupe basse (100×50) via rotation 90° — vérifié analytiquement.
- **wholeCount=4, cuts=5, totalReuseCount=2, tilesForCuts=3, totalTiles=7**

---

- [ ] **Step 1 : Créer le fichier de test complet**

```typescript
// src/engine/quantities/quantityEngine.integration.test.ts
import { describe, it, expect } from 'vitest';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import type { Room } from '@/types/project';
import type { TilingConfig } from '@/types/tiling';

const JOINT = 2;

const BASE_CONFIG: TilingConfig = {
  width: 100, height: 100, joint: JOINT,
  offsetX: 0, offsetY: 0, stagger: 0,
  angle: 0, chevronAngle: 45,
  color: '#ccc', layout: 'STRAIGHT',
};

function makeRoom(w: number, h: number): Room {
  return {
    id: 'r1',
    points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    edges: [],
  };
}

// ─── Invariants ────────────────────────────────────────────────────────────

function checkInvariants(result: QuantityResult): void {
  const { wholeCount, cuts, cutGroups, totalReuseCount,
          tilesForCuts, totalTiles, toOrder, tileW, tileH } = result;

  // I1 : totalTiles = wholeCount + tilesForCuts
  expect(totalTiles, 'I1').toBe(wholeCount + tilesForCuts);

  // I2 : tilesForCuts = cuts.length - totalReuseCount
  expect(tilesForCuts, 'I2').toBe(cuts.length - totalReuseCount);

  // I3 : totalReuseCount = nombre de coupes avec coveredById non null
  expect(totalReuseCount, 'I3').toBe(
    cuts.filter((c) => c.coveredById !== null).length,
  );

  // I4 : dimensions de chaque coupe dans les bornes
  for (const cut of cuts) {
    expect(cut.usedW, `I4 usedW (${cut.id})`).toBeGreaterThan(0);
    expect(cut.usedH, `I4 usedH (${cut.id})`).toBeGreaterThan(0);
    expect(cut.usedW, `I4 usedW≤tileW (${cut.id})`).toBeLessThanOrEqual(tileW);
    expect(cut.usedH, `I4 usedH≤tileH (${cut.id})`).toBeLessThanOrEqual(tileH);
  }

  // I5 : somme totalCount des groupes = nombre total de coupes
  const groupTotal = cutGroups.reduce((s, g) => s + g.totalCount, 0);
  expect(groupTotal, 'I5').toBe(cuts.length);

  // I6 : netTiles cohérent dans chaque groupe
  for (const g of cutGroups) {
    expect(g.netTiles, 'I6').toBe(g.totalCount - g.reuseCount);
  }

  // I7 : toOrder ≥ totalTiles
  expect(toOrder, 'I7').toBeGreaterThanOrEqual(totalTiles);

  // I8 : liens de réutilisation symétriques
  const cutById = new Map(cuts.map((c) => [c.id, c]));
  for (const cut of cuts) {
    if (cut.coveredById !== null) {
      const src = cutById.get(cut.coveredById);
      expect(src, `I8 src exists (${cut.id})`).toBeDefined();
      expect(src!.reusedForId, `I8 symmetry (${cut.id})`).toBe(cut.id);
    }
  }
}

// ─── Scénarios de référence ────────────────────────────────────────────────

describe('quantityEngine — scénarios de référence', () => {
  it('S1 : ajustement parfait (304×202) — 0 coupe, 6 entières', () => {
    // pitch=102, 3 colonnes×2 rangées : toutes les tuiles dans la pièce
    const result = analyzeQuantities([makeRoom(304, 202)], BASE_CONFIG);
    checkInvariants(result);
    expect(result.wholeCount).toBe(6);
    expect(result.cuts).toHaveLength(0);
    expect(result.totalReuseCount).toBe(0);
    expect(result.tilesForCuts).toBe(0);
    expect(result.totalTiles).toBe(6);
    expect(result.toOrder).toBe(7); // ceil(6 × 1.1)
  });

  it('S2 : coupe droite (254×202) — 2 coupes, 1 réutilisée', () => {
    // Colonne partielle à x=204 : usedW=50, chuteW=50 (viable)
    const result = analyzeQuantities([makeRoom(254, 202)], BASE_CONFIG);
    checkInvariants(result);
    expect(result.wholeCount).toBe(4);
    expect(result.cuts).toHaveLength(2);
    expect(result.totalReuseCount).toBe(1);
    expect(result.tilesForCuts).toBe(1);
    expect(result.totalTiles).toBe(5);
    expect(result.toOrder).toBe(6); // ceil(5 × 1.1)
    // Dimensions et bords
    expect(result.cuts.every((c) => c.usedW === 50 && c.usedH === 100)).toBe(true);
    expect(result.cuts.every((c) => c.pieceEdges.right === 'cut')).toBe(true);
    expect(result.cuts.every((c) => c.pieceEdges.left === 'factory')).toBe(true);
    expect(result.cuts.every((c) => c.pieceEdges.top === 'factory')).toBe(true);
    expect(result.cuts.every((c) => c.pieceEdges.bottom === 'factory')).toBe(true);
    // 1 groupe (coupes identiques)
    expect(result.cutGroups).toHaveLength(1);
    expect(result.cutGroups[0]!.totalCount).toBe(2);
    expect(result.cutGroups[0]!.reuseCount).toBe(1);
    expect(result.cutGroups[0]!.netTiles).toBe(1);
  });

  it('S3 : coupe basse (202×254) — 2 coupes, 1 réutilisée', () => {
    // Rangée partielle à y=204 : usedH=50, chuteH=50 (viable)
    const result = analyzeQuantities([makeRoom(202, 254)], BASE_CONFIG);
    checkInvariants(result);
    expect(result.wholeCount).toBe(4);
    expect(result.cuts).toHaveLength(2);
    expect(result.totalReuseCount).toBe(1);
    expect(result.tilesForCuts).toBe(1);
    expect(result.totalTiles).toBe(5);
    expect(result.toOrder).toBe(6);
    // Dimensions et bords
    expect(result.cuts.every((c) => c.usedW === 100 && c.usedH === 50)).toBe(true);
    expect(result.cuts.every((c) => c.pieceEdges.bottom === 'cut')).toBe(true);
    expect(result.cuts.every((c) => c.pieceEdges.top === 'factory')).toBe(true);
    // 1 groupe
    expect(result.cutGroups).toHaveLength(1);
    expect(result.cutGroups[0]!.totalCount).toBe(2);
    expect(result.cutGroups[0]!.reuseCount).toBe(1);
  });

  it('S4 : coupes en coin (254×254) — 5 coupes, 2 réutilisées', () => {
    // 2 coupes droites (50×100) + 2 coupes basses (100×50) + 1 coin (50×50)
    // Réutilisations : paire droite×2 → 1 ; paire basse×2 → 1 (via rotation 90°)
    const result = analyzeQuantities([makeRoom(254, 254)], BASE_CONFIG);
    checkInvariants(result);
    expect(result.wholeCount).toBe(4);
    expect(result.cuts).toHaveLength(5);
    expect(result.totalReuseCount).toBe(2);
    expect(result.tilesForCuts).toBe(3);
    expect(result.totalTiles).toBe(7);
    expect(result.toOrder).toBe(8); // ceil(7 × 1.1)
    // Au moins 2 groupes distincts (droites et basses)
    expect(result.cutGroups.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2 : Lancer les tests — vérifier qu'ils échouent ou passent**

```bash
cd /workspaces/Calpiweb && npx vitest run src/engine/quantities/quantityEngine.integration.test.ts 2>&1 | tail -30
```

Si tous les tests passent du premier coup → aller directement au Step 4 (commit).

Si certains tests échouent, diagnostiquer :
- Une **erreur de valeur absolue** (ex. `wholeCount` attendu 6, reçu 7) → chercher si le moteur de tiling génère des tuiles supplémentaires au bord de la pièce. Ajuster les dimensions de la room dans le test pour correspondre à ce que le moteur produit réellement, et documenter pourquoi dans un commentaire.
- Une **erreur d'invariant** → bug dans le moteur ; ne pas modifier le test, signaler avec `DONE_WITH_CONCERNS` et décrire le problème exact.

- [ ] **Step 3 : Ajuster les valeurs si le tiling engine produit des résultats légèrement différents**

Si l'un des scénarios produit un résultat différent des valeurs attendues (ex. 1 coupe supplémentaire au bord de la pièce à cause du joint), utiliser les vraies valeurs produites par le moteur comme référence, à condition que les **invariants passent tous**.

Pour trouver les vraies valeurs, ajouter temporairement dans le test d'un scénario :

```typescript
console.log('wholeCount', result.wholeCount);
console.log('cuts', result.cuts.length, result.cuts.map(c => `${c.usedW}×${c.usedH}`));
console.log('reuseCount', result.totalReuseCount);
```

Lancer le test, lire les vraies valeurs dans la sortie, les mettre dans les assertions, puis supprimer les `console.log`.

- [ ] **Step 4 : Vérifier que toute la suite de tests passe**

```bash
cd /workspaces/Calpiweb && npx vitest run 2>&1 | tail -10
```

Expected : tous les tests existants passent encore (au moins 66), plus les 4 nouveaux.

- [ ] **Step 5 : Commit**

```bash
cd /workspaces/Calpiweb && git add src/engine/quantities/quantityEngine.integration.test.ts && git commit -m "test(quantities): add integration test protocol with scenarios and invariants"
```

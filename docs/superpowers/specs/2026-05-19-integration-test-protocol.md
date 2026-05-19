# Protocole de test d'intégration — Moteur de quantitatif

## Objectif

Vérifier la **pertinence des outputs** de `analyzeQuantities` via deux mécanismes complémentaires :

1. **Scénarios de référence** — 4 configurations STRAIGHT avec valeurs absolues calculées à la main
2. **Invariants mathématiques** — 8 propriétés vérifiées sur chaque scénario

---

## Fichier

`src/engine/quantities/quantityEngine.integration.test.ts`

---

## Paramètres communs

```typescript
const JOINT = 2;
const PITCH = 102; // tile (100) + joint (2)

const BASE_CONFIG: TilingConfig = {
  width: 100, height: 100, joint: JOINT,
  offsetX: 0, offsetY: 0, stagger: 0,
  angle: 0, chevronAngle: 45,
  color: '#ccc', layout: 'STRAIGHT',
};

function makeRoom(w: number, h: number): Room {
  return {
    id: 'r1', name: 'Test',
    points: [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    edges: [], edgeThicknesses: [],
  };
}
```

---

## Section 1 — Scénarios de référence

### Scénario 1 : Ajustement parfait (0 coupe)

**Dimensions :** room 306×204 mm (3 × PITCH × 2 × PITCH)

**Calcul à la main :**
- Colonnes : 3 tuiles entières (0–100, 102–202, 204–304), room se termine à 306 = 304 + 2mm joint → pas de dépassement
- Rangées : 2 tuiles entières (0–100, 102–202)
- **wholeCount = 6, cuts = [], totalReuseCount = 0, tilesForCuts = 0, totalTiles = 6**

```typescript
it('ajustement parfait : 0 coupe, 6 tuiles entières', () => {
  const result = analyzeQuantities([makeRoom(306, 204)], BASE_CONFIG);
  expect(result.wholeCount).toBe(6);
  expect(result.cuts).toHaveLength(0);
  expect(result.totalReuseCount).toBe(0);
  expect(result.tilesForCuts).toBe(0);
  expect(result.totalTiles).toBe(6);
});
```

### Scénario 2 : Coupe droite avec réutilisation

**Dimensions :** room 254×204 mm

**Calcul à la main :**
- Colonnes : 2 entières (0–100, 102–202) + 1 partielle (204–254)
  - usedW = 254 − 204 = 50 mm, chuteW = 50 mm (≥ MIN_CHUTE_MM=50 → viable)
- Rangées : 2 entières (0–100, 102–202)
- **wholeCount = 4, cuts = 2**
- Coupes identiques (usedW=50, usedH=100, bord droit=`cut`) → 1 groupe
- Assignation (aire décroissante) : 1ère coupe → chute 50×100 en pool ; 2ème → couverte
- **totalReuseCount = 1, tilesForCuts = 1, totalTiles = 5**

```typescript
it('coupe droite : 2 coupes, 1 réutilisée, totalTiles=5', () => {
  const result = analyzeQuantities([makeRoom(254, 204)], BASE_CONFIG);
  expect(result.wholeCount).toBe(4);
  expect(result.cuts).toHaveLength(2);
  expect(result.totalReuseCount).toBe(1);
  expect(result.tilesForCuts).toBe(1);
  expect(result.totalTiles).toBe(5);
  // Dimensions des coupes
  expect(result.cuts.every(c => c.usedW === 50 && c.usedH === 100)).toBe(true);
  // Bord droit coupé
  expect(result.cuts.every(c => c.pieceEdges.right === 'cut')).toBe(true);
  expect(result.cuts.every(c => c.pieceEdges.left === 'factory')).toBe(true);
});
```

### Scénario 3 : Coupe basse avec réutilisation

**Dimensions :** room 204×254 mm (symétrique du scénario 2, axe vertical)

**Calcul à la main :**
- Colonnes : 2 entières ; Rangées : 2 entières + 1 partielle (204–254)
  - usedH = 50 mm, chuteH = 50 mm (viable), chuteW = 100 mm
- **wholeCount = 4, cuts = 2, totalReuseCount = 1, tilesForCuts = 1, totalTiles = 5**
- Bord bas = `cut`

```typescript
it('coupe basse : 2 coupes, 1 réutilisée, bord bas cut', () => {
  const result = analyzeQuantities([makeRoom(204, 254)], BASE_CONFIG);
  expect(result.wholeCount).toBe(4);
  expect(result.cuts).toHaveLength(2);
  expect(result.totalReuseCount).toBe(1);
  expect(result.totalTiles).toBe(5);
  expect(result.cuts.every(c => c.usedW === 100 && c.usedH === 50)).toBe(true);
  expect(result.cuts.every(c => c.pieceEdges.bottom === 'cut')).toBe(true);
});
```

### Scénario 4 : Coupes en coin (deux axes)

**Dimensions :** room 254×254 mm

**Calcul à la main :**
- 2 colonnes entières + 1 partielle (usedW=50) ; 2 rangées entières + 1 partielle (usedH=50)
- Coupes générées :
  - 2 coupes droites (usedW=50, usedH=100) — col partielle, rangées entières
  - 2 coupes basses (usedW=100, usedH=50) — col entières, rangée partielle
  - 1 coupe coin (usedW=50, usedH=50)
- **wholeCount = 4, cuts = 5**
- Réutilisations :
  - Droite×2 : 1ère génère chute 50×100, 2ème couverte → reuseCount=1
  - Basse×2 : 1ère droite (50×100) peut couvrir la 1ère basse (100×50) via rotation 90° → reuseCount supplémentaire possible
  - **totalReuseCount ≥ 1** (au moins les 2 droites ; la rotation droite→basse dépend de l'ordre de traitement)
- **totalTiles ≤ 4 + 4 = 8** (borne haute sans réutilisation), **totalTiles ≥ 4 + 2 = 6** (borne basse)

> Note : le scénario 4 teste les bornes plutôt que des valeurs exactes, car l'ordre de tri à aire égale n'est pas déterministe pour les coupes de même surface.

```typescript
it('coupes en coin : 4 entières, 5 coupes, réutilisations au moins partielles', () => {
  const result = analyzeQuantities([makeRoom(254, 254)], BASE_CONFIG);
  expect(result.wholeCount).toBe(4);
  expect(result.cuts).toHaveLength(5);
  expect(result.totalReuseCount).toBeGreaterThanOrEqual(1);
  expect(result.totalTiles).toBeGreaterThanOrEqual(6);
  expect(result.totalTiles).toBeLessThanOrEqual(8);
  // Deux groupes distincts : coupes droites et coupes basses
  expect(result.cutGroups.length).toBeGreaterThanOrEqual(2);
});
```

---

## Section 2 — Invariants mathématiques

Ces propriétés sont vérifiées sur **chaque scénario** via une fonction utilitaire :

```typescript
function checkInvariants(result: QuantityResult) {
  const { wholeCount, cuts, cutGroups, totalReuseCount,
          tilesForCuts, totalTiles, toOrder, tileW, tileH } = result;

  // I1 : décomposition totale
  expect(totalTiles).toBe(wholeCount + tilesForCuts);

  // I2 : tilesForCuts cohérent avec totalReuseCount
  expect(tilesForCuts).toBe(cuts.length - totalReuseCount);

  // I3 : totalReuseCount = nombre de coupes avec coveredById
  expect(totalReuseCount).toBe(cuts.filter(c => c.coveredById !== null).length);

  // I4 : dimensions de chaque coupe dans les bornes
  for (const cut of cuts) {
    expect(cut.usedW).toBeGreaterThan(0);
    expect(cut.usedH).toBeGreaterThan(0);
    expect(cut.usedW).toBeLessThanOrEqual(tileW);
    expect(cut.usedH).toBeLessThanOrEqual(tileH);
  }

  // I5 : totalCount des groupes = nombre de coupes
  const groupTotal = cutGroups.reduce((s, g) => s + g.totalCount, 0);
  expect(groupTotal).toBe(cuts.length);

  // I6 : netTiles cohérent dans chaque groupe
  for (const g of cutGroups) {
    expect(g.netTiles).toBe(g.totalCount - g.reuseCount);
  }

  // I7 : toOrder ≥ totalTiles
  expect(toOrder).toBeGreaterThanOrEqual(totalTiles);

  // I8 : liens de réutilisation symétriques
  const cutById = new Map(cuts.map(c => [c.id, c]));
  for (const cut of cuts) {
    if (cut.coveredById !== null) {
      const src = cutById.get(cut.coveredById);
      expect(src).toBeDefined();
      expect(src!.reusedForId).toBe(cut.id);
    }
  }
}
```

---

## Ce qui ne change pas

- Aucune modification de `analyzeQuantities` ni des fichiers existants
- Les tests unitaires existants (buildCutTable, assignOffcuts, groupCuts) restent inchangés
- Aucune dépendance externe ajoutée (Vitest seul)

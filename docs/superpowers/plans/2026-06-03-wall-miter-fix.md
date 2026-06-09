# Wall Miter Fix — Angles Aigus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger `computeCornerGeometry` dans `wallGeometry.ts` pour que le coin intérieur (+n) de chaque tranche de jonction utilise `+t` au lieu de `−t`, produisant une coupe diagonale nette (onglet) au lieu d'un cap rectangulaire qui génère des overlaps aux angles aigus.

**Architecture:** Changement minimal de 2 signes dans le tableau `points` de `computeCornerGeometry`. Les coins extérieurs (−n) sont déjà corrects. Les tests existants qui vérifiaient le comportement bugué sont mis à jour pour refléter le comportement correct. `computeJointLines` n'est pas touché (déjà correct).

**Tech Stack:** TypeScript, Vitest

---

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `src/engine/geometry/wallGeometry.ts` | **Modifier** lignes 94–95 : inverser signe `dir` pour `pts[0]` et `pts[1]` |
| `src/engine/geometry/wallGeometry.test.ts` | **Modifier** : mettre à jour 3 tests `computeCornerGeometry` |

---

### Task 1 : Mettre à jour les tests pour refléter le comportement correct (TDD)

**Files:**
- Modify: `src/engine/geometry/wallGeometry.test.ts`

- [ ] **Step 1.1 : Ouvrir le fichier de test**

```
src/engine/geometry/wallGeometry.test.ts
```

- [ ] **Step 1.2 : Mettre à jour le test `two walls at 90°`**

Localiser le test `two walls at 90° — correct extensions` et remplacer les assertions concernant les coins de jonction :

```typescript
// AVANT (comportement bugué)
expect(near(p1.points[1]!, { x: 105, y: 5  })).toBe(true);  // +n, node2 de w1
expect(near(p2.points[0]!, { x: 95,  y: -5 })).toBe(true);  // +n, node1 de w2

// APRÈS (comportement correct — coin intérieur en retrait de P)
expect(near(p1.points[1]!, { x: 95,  y: 5  })).toBe(true);  // +n, node2 de w1 ← CHANGÉ
expect(near(p2.points[0]!, { x: 95,  y: 5  })).toBe(true);  // +n, node1 de w2 ← CHANGÉ
```

Les assertions sur `p1.points[0]`, `p1.points[2]`, `p1.points[3]`, `p2.points[3]` ne changent pas.

Le test complet devient :

```typescript
it('two walls at 90° — correct extensions', () => {
  const nodes = [nd('n1',0,0), nd('n2',100,0), nd('n3',100,100)];
  const walls: Wall[] = [
    { id:'w1', node1Id:'n1', node2Id:'n2', thickness:10 },
    { id:'w2', node1Id:'n2', node2Id:'n3', thickness:10 },
  ];
  const polys = computeCornerGeometry(walls, nodes);
  const p1 = polys.find(p => p.wallId==='w1')!;
  const p2 = polys.find(p => p.wallId==='w2')!;
  expect(near(p1.points[0]!, { x:0,   y:5  })).toBe(true);
  expect(near(p1.points[3]!, { x:0,   y:-5 })).toBe(true);
  expect(near(p1.points[1]!, { x:95,  y:5  })).toBe(true);   // ← 105→95
  expect(near(p1.points[2]!, { x:105, y:-5 })).toBe(true);
  expect(near(p2.points[0]!, { x:95,  y:5  })).toBe(true);   // ← -5→5
  expect(near(p2.points[3]!, { x:105, y:-5 })).toBe(true);
});
```

- [ ] **Step 1.3 : Mettre à jour le test `45° corner`**

Localiser `45° corner — correct extension (not T/2)` et remplacer les assertions :

```typescript
// AVANT (comportement bugué — extX positif, mauvais côté)
const extX = p1.points[1]!.x - 100;
expect(extX).toBeGreaterThan(0);
expect(extX).toBeLessThan(5);

// APRÈS (correct — le coin intérieur est en RETRAIT avant P, donc extX < 0)
const extX = p1.points[1]!.x - 100;
expect(extX).toBeLessThan(0);        // coin intérieur se rétracte avant P
expect(extX).toBeGreaterThan(-5);    // mais de moins d'un demi-épaisseur
```

- [ ] **Step 1.4 : Mettre à jour le test `120° corner`**

Localiser `120° corner — extension greater than T/2` et remplacer :

```typescript
// AVANT (comportement bugué — extX positif)
const extX = p1.points[1]!.x - 100;
expect(extX).toBeGreaterThan(5);

// APRÈS (correct — le coin intérieur se rétracte de plus d'un demi-épaisseur avant P)
const extX = p1.points[1]!.x - 100;
expect(extX).toBeLessThan(-5);       // rétraction > T/2 = 5
```

- [ ] **Step 1.5 : Lancer les tests pour confirmer qu'ils échouent**

```bash
npx vitest run src/engine/geometry/wallGeometry.test.ts
```

Résultat attendu : **3 tests FAIL** dans `computeCornerGeometry` (les 3 modifiés).  
Les tests `computeJointLines` doivent tous rester **PASS**.

---

### Task 2 : Appliquer le fix — inverser 2 signes dans `wallGeometry.ts`

**Files:**
- Modify: `src/engine/geometry/wallGeometry.ts:94-99`

- [ ] **Step 2.1 : Appliquer les 2 changements de signe**

Dans `computeCornerGeometry`, localiser le tableau `points` (lignes 94–99) et modifier exactement 2 caractères :

```typescript
// AVANT
return {
  wallId: wall.id,
  points: [
    { x: p1.x - dir.x * extN1 + n.x * h, y: p1.y - dir.y * extN1 + n.y * h },
    { x: p2.x + dir.x * extN2 + n.x * h, y: p2.y + dir.y * extN2 + n.y * h },
    { x: p2.x + dir.x * extN2 - n.x * h, y: p2.y + dir.y * extN2 - n.y * h },
    { x: p1.x - dir.x * extN1 - n.x * h, y: p1.y - dir.y * extN1 - n.y * h },
  ],
};

// APRÈS
return {
  wallId: wall.id,
  points: [
    { x: p1.x + dir.x * extN1 + n.x * h, y: p1.y + dir.y * extN1 + n.y * h },
    { x: p2.x - dir.x * extN2 + n.x * h, y: p2.y - dir.y * extN2 + n.y * h },
    { x: p2.x + dir.x * extN2 - n.x * h, y: p2.y + dir.y * extN2 - n.y * h },
    { x: p1.x - dir.x * extN1 - n.x * h, y: p1.y - dir.y * extN1 - n.y * h },
  ],
};
```

Seules les lignes **pts[0]** (node1 +n) et **pts[1]** (node2 +n) changent.  
`pts[2]` et `pts[3]` restent inchangés.

**Mémo :** `extN1 = t` et `extN2 = −t` (définis plus haut dans la fonction).  
Après fix : `+dir*extN1 = +dir*t` et `−dir*extN2 = +dir*t`.  
→ Les deux coins intérieurs utilisent désormais `P + dir*t + n*h` (en retrait avant P pour les angles obtus, au-delà pour les angles aigus).

- [ ] **Step 2.2 : Lancer les tests pour confirmer qu'ils passent**

```bash
npx vitest run src/engine/geometry/wallGeometry.test.ts
```

Résultat attendu : **tous les tests PASS**.

- [ ] **Step 2.3 : Lancer la suite complète pour détecter toute régression**

```bash
npx vitest run
```

Résultat attendu : tous les tests passent. Si des tests en dehors de `wallGeometry.test.ts` échouent, analyser si c'est lié au changement de géométrie (ex. tests qui consomment `WallPolygon.points`).

---

### Task 3 : Commit

**Files:**
- `src/engine/geometry/wallGeometry.ts`
- `src/engine/geometry/wallGeometry.test.ts`

- [ ] **Step 3.1 : Stager et committer**

```bash
git add src/engine/geometry/wallGeometry.ts src/engine/geometry/wallGeometry.test.ts
git commit -m "fix(wall-engine): onglet correct — inverser signe coin intérieur (+n) aux jonctions"
```

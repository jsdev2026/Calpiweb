# Cloison — Détection de pièce et cotation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger deux bugs liés aux cloisons (murs non fermés) : la pièce disparaît lors d'une jonction en T, et la cotation mesure depuis le mauvais point d'ancrage.

**Architecture:** Task 1 — leaf-pruning dans `wallFaceCycles` : avant la traversée half-edge, retirer itérativement tous les murs pendants (nœud de degré 1) jusqu'à ce qu'il n'en reste plus ; la traversée tourne sur le graphe nettoyé. Task 2 — cotation cloison dans `computeAutoCotations` : pour les murs hors pièce avec un bout libre, utiliser la face intérieure du mur de connexion comme ancre au lieu du centre de nœud.

**Tech Stack:** TypeScript, Vitest (tests), architecture fonctionnelle pure (pas de mutation d'état React).

---

## Fichiers

| Fichier | Rôle |
|---|---|
| `src/engine/geometry/wallFaces.ts` | Ajouter leaf-pruning dans `wallFaceCycles` |
| `src/engine/geometry/wallFaces.test.ts` | Tests T-junction |
| `src/engine/geometry/wallCotation.ts` | Remplacer la boucle "murs isolés" par logique cloison |
| `src/engine/geometry/wallCotation.test.ts` | Tests Cas 1 / Cas 2 |

---

## Task 1 : Leaf-pruning dans `wallFaceCycles`

**Files:**
- Modify: `src/engine/geometry/wallFaces.ts`
- Test: `src/engine/geometry/wallFaces.test.ts`

### Contexte

`wallFaceCycles` (dans `wallFaces.ts`) utilise une traversée half-edge pour trouver les cycles fermés (pièces). Quand un mur-cloison est connecté en jonction T (nœud de degré 3), l'algorithme peut suivre l'impasse de la cloison, marquer des demi-arêtes comme visitées, et la pièce ne peut plus être complétée → la pièce disparaît.

La signature actuelle :
```typescript
export function wallFaceCycles(walls: Wall[], nodes: WallNode[]): FaceCycle[]
```

Le fix : ajouter une fonction `pruneLeaves` appelée au début de `wallFaceCycles`.

- [ ] **Étape 1 : Écrire les tests qui échouent**

Ajouter à la fin de `src/engine/geometry/wallFaces.test.ts` :

```typescript
describe('wallFaceCycles — cloisons (T-junction)', () => {
  // Rectangle a(0,0) b(100,0) c(100,100) d(0,100)
  // Mur du haut splitté en a→m et m→b, avec m(50,0)
  // Cloison m→f, f(50,60) — pend dans la pièce
  const nodes = [
    nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100),
    nd('m', 50, 0),
    nd('f', 50, 60),
  ];
  const walls: Wall[] = [
    { id: 'w1a', node1Id: 'a', node2Id: 'm', thickness: 20 },
    { id: 'w1b', node1Id: 'm', node2Id: 'b', thickness: 20 },
    { id: 'w2',  node1Id: 'b', node2Id: 'c', thickness: 20 },
    { id: 'w3',  node1Id: 'c', node2Id: 'd', thickness: 20 },
    { id: 'w4',  node1Id: 'd', node2Id: 'a', thickness: 20 },
    { id: 'wC',  node1Id: 'm', node2Id: 'f', thickness: 15 }, // cloison
  ];

  it('pièce rectangulaire préservée quand une cloison pend depuis un nœud du contour', () => {
    const rooms = wallsToRooms(walls, nodes);
    expect(rooms).toHaveLength(1);
    // Le cycle inclut les 5 nœuds du contour (a, m, b, c, d)
    expect(rooms[0]!.points).toHaveLength(5);
  });

  it('cloison complètement libre ne crée pas de pièce', () => {
    const freeNodes = [nd('p', 0, 0), nd('q', 0, 100)];
    const freeWalls: Wall[] = [{ id: 'wF', node1Id: 'p', node2Id: 'q', thickness: 15 }];
    expect(wallsToRooms(freeWalls, freeNodes)).toHaveLength(0);
  });

  it('pièce + cloison connectée à un coin existant (degré 3)', () => {
    // Rectangle normal + cloison sortant du coin b
    const n2 = [
      nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100), nd('d', 0, 100),
      nd('e', 100, 50), // free end of cloison
    ];
    const w2: Wall[] = [
      { id: 'r1', node1Id: 'a', node2Id: 'b', thickness: 20 },
      { id: 'r2', node1Id: 'b', node2Id: 'c', thickness: 20 },
      { id: 'r3', node1Id: 'c', node2Id: 'd', thickness: 20 },
      { id: 'r4', node1Id: 'd', node2Id: 'a', thickness: 20 },
      { id: 'rC', node1Id: 'b', node2Id: 'e', thickness: 10 },
    ];
    const rooms = wallsToRooms(w2, n2);
    expect(rooms).toHaveLength(1);
    expect(rooms[0]!.points).toHaveLength(4); // a, b, c, d
  });
});
```

- [ ] **Étape 2 : Vérifier que les tests échouent**

```
npx vitest run src/engine/geometry/wallFaces.test.ts
```

Attendu : les 3 nouveaux tests FAIL (la pièce est perdue, 0 rooms au lieu de 1).

- [ ] **Étape 3 : Implémenter `pruneLeaves` et l'appeler dans `wallFaceCycles`**

Dans `src/engine/geometry/wallFaces.ts`, ajouter la fonction `pruneLeaves` juste avant `wallFaceCycles`, et modifier le début de `wallFaceCycles` :

```typescript
/** Retire itérativement les murs pendants (nœud de degré 1) jusqu'à stabilité. */
function pruneLeaves(walls: Wall[]): Wall[] {
  let current = walls;
  while (true) {
    const degree = new Map<string, number>();
    for (const w of current) {
      if (w.isDoor) continue;
      degree.set(w.node1Id, (degree.get(w.node1Id) ?? 0) + 1);
      degree.set(w.node2Id, (degree.get(w.node2Id) ?? 0) + 1);
    }
    const next = current.filter(
      (w) => w.isDoor || (degree.get(w.node1Id) !== 1 && degree.get(w.node2Id) !== 1),
    );
    if (next.length === current.length) return current;
    current = next;
  }
}

export function wallFaceCycles(walls: Wall[], nodes: WallNode[]): FaceCycle[] {
  if (walls.length === 0 || nodes.length === 0) return [];

  const coreWalls = pruneLeaves(walls);   // ← nouveau
  if (coreWalls.length === 0) return [];  // ← nouveau

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const validWalls = coreWalls.filter(w => nodeMap.has(w.node1Id) && nodeMap.has(w.node2Id));  // ← coreWalls au lieu de walls
  const getPos = (id: string) => nodeMap.get(id)!;
  // … reste de la fonction inchangé
```

> **Note :** Seules les deux premières lignes de `wallFaceCycles` et `validWalls` changent. Tout le code de traversée half-edge (halfEdges, out, nextHE, visited, cycles…) reste identique.

- [ ] **Étape 4 : Vérifier que tous les tests passent**

```
npx vitest run src/engine/geometry/wallFaces.test.ts
```

Attendu : tous les tests PASS (anciens + 3 nouveaux).

```
npx vitest run
```

Attendu : 419+ tests PASS, 0 failing.

- [ ] **Étape 5 : Commit**

```
git add src/engine/geometry/wallFaces.ts src/engine/geometry/wallFaces.test.ts
git commit -m "fix: leaf-pruning dans wallFaceCycles — cloisons en T ne détruisent plus la pièce"
```

---

## Task 2 : Cotation des cloisons dans `computeAutoCotations`

**Files:**
- Modify: `src/engine/geometry/wallCotation.ts`
- Test: `src/engine/geometry/wallCotation.test.ts`

### Contexte

`computeAutoCotations` (dans `wallCotation.ts`) génère les cotations automatiques. À la fin de la fonction, une boucle "murs isolés" traite tous les murs hors pièce avec `anchor1 = nodePos(node1)` et `anchor2 = nodePos(node2)` — mesure centre-à-centre.

Pour une cloison avec un bout connecté à un mur de pièce, le bon anchor pour le bout connecté est :
```
anchorConnecté = posNœudConnecté + (épaisseurMoyenneAdjacents / 2) × dirVersFree
```
où `dirVersFree = normalize(posNœudLibre − posNœudConnecté)`.

Types importants (définis dans `@/types/wall`) :
```typescript
interface AutoCotation {
  wallId: string;
  side: 'exterior' | 'interior' | 'isolated';
  anchor1: Point;
  anchor2: Point;
  normal: Point;
  offset: number;
  label: string;
}
```

Helpers déjà disponibles dans `wallCotation.ts` : `dist(a, b)`, `nodePos(id, nodes)`, `formatCm(mm)`.

Constante existante : `COTE_OFFSET_ISO = 50`.

- [ ] **Étape 1 : Écrire les tests qui échouent**

Ajouter à la fin de `src/engine/geometry/wallCotation.test.ts` :

```typescript
// Helpers déjà présents dans le fichier :
// function nd(id, x, y): WallNode
// function w(id, n1, n2, t): Wall

describe('computeAutoCotations — cloisons', () => {
  // Scénario : mur horizontal w1(a→b, t=20) + cloison wC(b→c, t=10) verticale
  // a(0,0) b(100,0) c(100,100)
  // degré : a=1, b=2, c=1
  // wC : p1=b(connecté, deg2), p2=c(libre, deg1)
  //   dir b→c = (0,1)  ;  adjWalls à b hors wC = [w1] t=20
  //   anchor1 = b + (20/2)*(0,1) = (100,10)
  //   anchor2 = c = (100,100)
  //   label = dist = 90mm = "9.0 cm"
  const nodes = [nd('a', 0, 0), nd('b', 100, 0), nd('c', 100, 100)];
  const walls = [w('w1', 'a', 'b', 20), w('wC', 'b', 'c', 10)];

  it('Cas 1 (deg2=1) — anchor1 ajusté à la face intérieure du mur de connexion', () => {
    const result = computeAutoCotations(walls, nodes);
    const cot = result.find((c) => c.wallId === 'wC')!;
    expect(cot).toBeDefined();
    expect(cot.side).toBe('isolated');
    expect(cot.anchor1.x).toBeCloseTo(100);
    expect(cot.anchor1.y).toBeCloseTo(10);  // b + (20/2)*(0,1)
    expect(cot.anchor2.x).toBeCloseTo(100);
    expect(cot.anchor2.y).toBeCloseTo(100);
    expect(cot.label).toBe('9.0 cm');
  });

  it('Cas 1 (deg1=1) — anchor2 ajusté quand le nœud1 est libre', () => {
    // w1 : a(libre,deg1) → b(connecté,deg2)
    // dir a→b = (1,0) ; adjWalls à b hors w1 = [wC] t=10
    // anchor1 = a = (0,0)   anchor2 = b - (10/2)*(1,0) = (95,0)
    // label = 95mm = "9.5 cm"
    const result = computeAutoCotations(walls, nodes);
    const cot = result.find((c) => c.wallId === 'w1')!;
    expect(cot).toBeDefined();
    expect(cot.side).toBe('isolated');
    expect(cot.anchor1.x).toBeCloseTo(0);
    expect(cot.anchor1.y).toBeCloseTo(0);
    expect(cot.anchor2.x).toBeCloseTo(95);  // b - (10/2)*(1,0)
    expect(cot.anchor2.y).toBeCloseTo(0);
    expect(cot.label).toBe('9.5 cm');
  });

  it('Cas 2 (deux bouts libres) — anchor inchangé', () => {
    // Mur isolé p(0,0)→q(150,0), t=10 — les deux bouts sont libres
    const freeNodes = [nd('p', 0, 0), nd('q', 150, 0)];
    const freeWalls = [w('wf', 'p', 'q', 10)];
    const result = computeAutoCotations(freeWalls, freeNodes);
    expect(result).toHaveLength(1);
    const cot = result[0]!;
    expect(cot.anchor1).toMatchObject({ x: 0, y: 0 });
    expect(cot.anchor2).toMatchObject({ x: 150, y: 0 });
    expect(cot.label).toBe('15.0 cm');
  });

  it('cloison dans une pièce — pas de cotation isolated pour les murs de pièce', () => {
    // Rectangle + cloison : les 4 murs de pièce ont ext+int, la cloison a isolated
    const rNodes = [
      nd('a', 0, 0), nd('b', 200, 0), nd('c', 200, 200), nd('d', 0, 200),
      nd('m', 100, 0), nd('f', 100, 100),
    ];
    const rWalls = [
      w('r1', 'a', 'm', 20), w('r2', 'm', 'b', 20),
      w('r3', 'b', 'c', 20), w('r4', 'c', 'd', 20), w('r5', 'd', 'a', 20),
      w('rC', 'm', 'f', 15),
    ];
    const result = computeAutoCotations(rWalls, rNodes);
    const isolated = result.filter((c) => c.side === 'isolated');
    expect(isolated).toHaveLength(1);
    expect(isolated[0]!.wallId).toBe('rC');
    // anchor1 = m(100,0) + (20/2)*(0,1) = (100,10)  [face du mur de pièce]
    expect(isolated[0]!.anchor1.y).toBeCloseTo(10);
    expect(isolated[0]!.anchor2).toMatchObject({ x: 100, y: 100 });
  });
});
```

- [ ] **Étape 2 : Vérifier que les tests échouent**

```
npx vitest run src/engine/geometry/wallCotation.test.ts
```

Attendu : les 4 nouveaux tests FAIL.

- [ ] **Étape 3 : Remplacer la boucle "murs isolés" dans `computeAutoCotations`**

Dans `src/engine/geometry/wallCotation.ts`, localiser le bloc commenté `// ── Murs isolés ───` (vers la fin de `computeAutoCotations`) et le remplacer entièrement :

```typescript
  // ── Degré des nœuds — pour détecter les cloisons ─────────────────────────
  const nodeDegree = new Map<string, number>();
  for (const wall of walls) {
    if (wall.isDoor) continue;
    nodeDegree.set(wall.node1Id, (nodeDegree.get(wall.node1Id) ?? 0) + 1);
    nodeDegree.set(wall.node2Id, (nodeDegree.get(wall.node2Id) ?? 0) + 1);
  }

  // ── Cloisons (murs hors pièce, au moins un bout libre) ───────────────────
  for (const wall of walls) {
    if (wallsInRooms.has(wall.id) || wall.isDoor) continue;
    const p1 = nodePos(wall.node1Id, nodes);
    const p2 = nodePos(wall.node2Id, nodes);
    const d  = dist(p1, p2);
    if (d < 1) continue;
    const dir: Point    = { x: (p2.x - p1.x) / d, y: (p2.y - p1.y) / d };
    const normal: Point = { x: -dir.y, y: dir.x };

    const deg1 = nodeDegree.get(wall.node1Id) ?? 0;
    const deg2 = nodeDegree.get(wall.node2Id) ?? 0;

    let anchor1: Point = p1;
    let anchor2: Point = p2;

    if (deg1 === 1 && deg2 > 1) {
      // p1 libre, p2 connecté → reculer anchor2 de tAdj/2 vers p1
      const adj = walls.filter(
        (w) => !w.isDoor && w.id !== wall.id &&
               (w.node1Id === wall.node2Id || w.node2Id === wall.node2Id),
      );
      const tAdj = adj.length > 0 ? adj.reduce((s, w) => s + w.thickness, 0) / adj.length : 0;
      anchor2 = { x: p2.x - dir.x * tAdj / 2, y: p2.y - dir.y * tAdj / 2 };
    } else if (deg2 === 1 && deg1 > 1) {
      // p2 libre, p1 connecté → avancer anchor1 de tAdj/2 vers p2
      const adj = walls.filter(
        (w) => !w.isDoor && w.id !== wall.id &&
               (w.node1Id === wall.node1Id || w.node2Id === wall.node1Id),
      );
      const tAdj = adj.length > 0 ? adj.reduce((s, w) => s + w.thickness, 0) / adj.length : 0;
      anchor1 = { x: p1.x + dir.x * tAdj / 2, y: p1.y + dir.y * tAdj / 2 };
    }
    // Cas 2 (deg1===1 && deg2===1) : anchor1=p1, anchor2=p2 — inchangé

    const anchorDist = dist(anchor1, anchor2);
    if (anchorDist < 1) continue;

    result.push({
      wallId: wall.id, side: 'isolated',
      anchor1, anchor2,
      normal, offset: COTE_OFFSET_ISO,
      label: formatCm(anchorDist),
    });
  }
```

- [ ] **Étape 4 : Vérifier que tous les tests passent**

```
npx vitest run src/engine/geometry/wallCotation.test.ts
```

Attendu : tous les tests PASS (anciens + 4 nouveaux).

```
npx vitest run
```

Attendu : 419+ tests PASS, 0 failing.

- [ ] **Étape 5 : Commit**

```
git add src/engine/geometry/wallCotation.ts src/engine/geometry/wallCotation.test.ts
git commit -m "fix: cotation cloison — anchor ajusté à la face intérieure du mur de connexion"
```

---

## Vérification finale

```
npx vitest run
git log --oneline -5
```

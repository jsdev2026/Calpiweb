# Wall Split Duplicate + Cotations T-junction Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger deux bugs : doublon de mur quand les deux nœuds d'une nouvelle pièce sont sur la même cloison, et cotations (auto-dimensions) cassées dès le premier face-snap.

**Architecture:** (1) Extraire `wallFaceCycles` de `wallsToRooms` — algorithme half-edge qui retourne des cycles avec wallIds, gère les T-junctions. (2) `computeAutoCotations` appelle `wallFaceCycles` au lieu de `detectClosedPolygons`. (3) Canvas : pré-vérifier si le split créera lui-même le mur de jonction avant d'appeler `onAddWall`.

**Tech Stack:** TypeScript, Vitest, React.

---

## Fichiers

| Fichier | Action |
|---------|--------|
| `src/engine/geometry/wallFaces.ts` | Extraire `wallFaceCycles`, refactorer `wallsToRooms` |
| `src/engine/geometry/wallFaces.test.ts` | Ajouter tests pour `wallFaceCycles` |
| `src/engine/geometry/wallCotation.ts` | Remplacer `detectClosedPolygons` par `wallFaceCycles`, supprimer `detectClosedPolygons` |
| `src/engine/geometry/wallCotation.test.ts` | Retirer tests `detectClosedPolygons`, ajouter test T-junction |
| `src/components/plan/WallDrawingCanvas.tsx` | Ajouter `splitWillCreateLink`, corriger condition `onAddWall` |

---

### Task 1 : `wallFaceCycles` — extraction + tests

**Files:**
- Modify: `src/engine/geometry/wallFaces.ts`
- Modify: `src/engine/geometry/wallFaces.test.ts`

- [ ] **Step 1 : Écrire les tests qui doivent échouer**

Dans `src/engine/geometry/wallFaces.test.ts`, ajouter après les imports existants (ligne 4) :

```ts
import { wallsToRooms, wallFaceCycles } from './wallFaces';
```

Et ajouter à la fin du fichier :

```ts
describe('wallFaceCycles', () => {
  it('retourne [] pour un graphe vide', () => {
    expect(wallFaceCycles([], [])).toEqual([]);
  });

  it('rectangle 4 murs → 1 cycle, 4 nodeIds, 4 wallIds', () => {
    const nodes = [nd('a',0,0), nd('b',200,0), nd('c',200,140), nd('d',0,140)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'a', node2Id:'b', thickness:10 },
      { id:'w2', node1Id:'b', node2Id:'c', thickness:10 },
      { id:'w3', node1Id:'c', node2Id:'d', thickness:10 },
      { id:'w4', node1Id:'d', node2Id:'a', thickness:10 },
    ];
    const result = wallFaceCycles(walls, nodes);
    expect(result).toHaveLength(1);
    expect(result[0]!.nodeIds).toHaveLength(4);
    expect(result[0]!.wallIds).toHaveLength(4);
    expect(new Set(result[0]!.wallIds)).toEqual(new Set(['w1','w2','w3','w4']));
  });

  it('wallIds[i] est le mur entre nodeIds[i] et nodeIds[(i+1)%n]', () => {
    const nodes = [nd('a',0,0), nd('b',200,0), nd('c',200,140), nd('d',0,140)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'a', node2Id:'b', thickness:10 },
      { id:'w2', node1Id:'b', node2Id:'c', thickness:10 },
      { id:'w3', node1Id:'c', node2Id:'d', thickness:10 },
      { id:'w4', node1Id:'d', node2Id:'a', thickness:10 },
    ];
    const [cycle] = wallFaceCycles(walls, nodes);
    for (let i = 0; i < cycle!.nodeIds.length; i++) {
      const n1 = cycle!.nodeIds[i]!;
      const n2 = cycle!.nodeIds[(i + 1) % cycle!.nodeIds.length]!;
      const wId = cycle!.wallIds[i]!;
      const wall = walls.find(w => w.id === wId)!;
      expect(
        (wall.node1Id === n1 && wall.node2Id === n2) ||
        (wall.node1Id === n2 && wall.node2Id === n1)
      ).toBe(true);
    }
  });

  it('T-junction (2 pièces partageant un mur) → 2 cycles', () => {
    // Pièce gauche a-b-e-f, pièce droite b-c-d-e, mur partagé e-b
    const nodes = [
      nd('a',0,0), nd('b',100,0), nd('c',200,0),
      nd('d',200,100), nd('e',100,100), nd('f',0,100),
    ];
    const walls: Wall[] = [
      { id:'w1', node1Id:'a', node2Id:'b', thickness:10 },
      { id:'w2', node1Id:'b', node2Id:'c', thickness:10 },
      { id:'w3', node1Id:'c', node2Id:'d', thickness:10 },
      { id:'w4', node1Id:'d', node2Id:'e', thickness:10 },
      { id:'w5', node1Id:'e', node2Id:'b', thickness:10 },
      { id:'w6', node1Id:'e', node2Id:'f', thickness:10 },
      { id:'w7', node1Id:'f', node2Id:'a', thickness:10 },
    ];
    const result = wallFaceCycles(walls, nodes);
    expect(result).toHaveLength(2);
    expect(result[0]!.nodeIds).toHaveLength(4);
    expect(result[1]!.nodeIds).toHaveLength(4);
  });

  it('chaîne ouverte → 0 cycles', () => {
    const nodes = [nd('a',0,0), nd('b',100,0), nd('c',200,0)];
    const walls: Wall[] = [
      { id:'w1', node1Id:'a', node2Id:'b', thickness:10 },
      { id:'w2', node1Id:'b', node2Id:'c', thickness:10 },
    ];
    expect(wallFaceCycles(walls, nodes)).toHaveLength(0);
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```
npx vitest run src/engine/geometry/wallFaces.test.ts
```

Attendu : FAIL — `wallFaceCycles is not exported`

- [ ] **Step 3 : Ajouter `FaceCycle` + `wallFaceCycles` dans `wallFaces.ts`**

Dans `src/engine/geometry/wallFaces.ts`, ajouter juste **avant** la fonction `wallsToRooms` (ligne 33) :

```ts
export interface FaceCycle {
  nodeIds: string[];
  wallIds: string[]; // wallIds[i] = mur entre nodeIds[i] et nodeIds[(i+1) % n]
}

/**
 * Retourne tous les cycles de faces intérieures du graphe de murs
 * en utilisant l'algorithme de traversée half-edge.
 * Gère les T-junctions (nœuds avec 3+ arêtes).
 */
export function wallFaceCycles(walls: Wall[], nodes: WallNode[]): FaceCycle[] {
  if (walls.length === 0 || nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const validWalls = walls.filter(w => nodeMap.has(w.node1Id) && nodeMap.has(w.node2Id));
  const getPos = (id: string) => nodeMap.get(id)!;

  type HE = { from: string; to: string };
  const halfEdges: HE[] = validWalls.flatMap(w => [
    { from: w.node1Id, to: w.node2Id },
    { from: w.node2Id, to: w.node1Id },
  ]);

  const out = new Map<string, HE[]>();
  for (const he of halfEdges) {
    if (!out.has(he.from)) out.set(he.from, []);
    out.get(he.from)!.push(he);
  }

  const nextHE = (he: HE): HE | null => {
    const u = getPos(he.from);
    const v = getPos(he.to);
    const θRev = Math.atan2(u.y - v.y, u.x - v.x);
    let best: HE | null = null;
    let bestCw = Infinity;
    for (const e of (out.get(he.to) ?? [])) {
      if (e.to === he.from) continue;
      const w = getPos(e.to);
      const θOut = Math.atan2(w.y - v.y, w.x - v.x);
      const cw = ((θRev - θOut) + 2 * Math.PI) % (2 * Math.PI);
      if (cw < bestCw) { bestCw = cw; best = e; }
    }
    return best;
  };

  // Lookup wallId depuis (from, to) en O(1)
  const wallLookup = new Map<string, string>();
  for (const wall of validWalls) {
    wallLookup.set(`${wall.node1Id}\x00${wall.node2Id}`, wall.id);
    wallLookup.set(`${wall.node2Id}\x00${wall.node1Id}`, wall.id);
  }

  const visited = new Set<string>();
  const key = (he: HE) => `${he.from}\x00${he.to}`;
  const cycles: FaceCycle[] = [];

  for (const start of halfEdges) {
    if (visited.has(key(start))) continue;
    const cycle: HE[] = [];
    let cur: HE | null = start;
    while (cur && !visited.has(key(cur))) {
      visited.add(key(cur));
      cycle.push(cur);
      cur = nextHE(cur);
    }
    if (cur && key(cur) === key(start) && cycle.length >= 3) {
      const pts = cycle.map(he => { const p = getPos(he.from); return { x: p.x, y: p.y }; });
      // Faces intérieures : aire de shoelace positive (SVG Y-down, sens horaire = positif)
      let s = 0;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        s += pts[i]!.x * pts[j]!.y - pts[j]!.x * pts[i]!.y;
      }
      if (s / 2 > 0) {
        cycles.push({
          nodeIds: cycle.map(he => he.from),
          wallIds: cycle.map(he => wallLookup.get(`${he.from}\x00${he.to}`) ?? ''),
        });
      }
    }
  }

  return cycles;
}
```

- [ ] **Step 4 : Refactorer `wallsToRooms` pour utiliser `wallFaceCycles`**

Remplacer **entièrement** la fonction `wallsToRooms` existante dans `src/engine/geometry/wallFaces.ts` par :

```ts
export function wallsToRooms(
  walls: Wall[],
  nodes: WallNode[],
  excludedZones: WallExcludedZone[] = [],
): Room[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const getPos = (id: string) => { const n = nodeMap.get(id)!; return { x: n.x, y: n.y }; };

  const cycles = wallFaceCycles(walls, nodes);

  // Tri top-left → bottom-right pour nommage stable
  cycles.sort((a, b) => {
    const ptsA = a.nodeIds.map(getPos);
    const ptsB = b.nodeIds.map(getPos);
    const cya = ptsA.reduce((s, p) => s + p.y, 0) / ptsA.length;
    const cyb = ptsB.reduce((s, p) => s + p.y, 0) / ptsB.length;
    if (Math.abs(cya - cyb) > 1) return cya - cyb;
    return (ptsA.reduce((s, p) => s + p.x, 0) / ptsA.length) -
           (ptsB.reduce((s, p) => s + p.x, 0) / ptsB.length);
  });

  return cycles.map((cycle, idx) => {
    const facePts = cycle.nodeIds.map(id => getPos(id));
    const roomZones = excludedZones.filter(zone => {
      if (zone.points.length < 3) return false;
      const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
      const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
      return pointInPolygon({ x: cx, y: cy }, facePts);
    });
    return {
      id: faceId(cycle.nodeIds),
      name: `Pièce ${idx + 1}`,
      points: facePts,
      edges: facePts.map(() => 'WALL' as EdgeType),
      partitions: [],
      excludedZones: roomZones,
    };
  });
}
```

Note : les fonctions internes `shoelaceArea`, `HE`, `out`, `nextHE`, `visited`, `key` sont maintenant dans `wallFaceCycles`. Supprimer `shoelaceArea` de l'ancienne `wallsToRooms` (elle n'est plus utilisée).

- [ ] **Step 5 : Vérifier que tous les tests passent**

```
npx vitest run src/engine/geometry/wallFaces.test.ts
```

Attendu : tous les tests PASS (anciens + nouveaux `wallFaceCycles`).

- [ ] **Step 6 : Vérifier TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 7 : Commit**

```
git add src/engine/geometry/wallFaces.ts src/engine/geometry/wallFaces.test.ts
git commit -m "feat(wallFaces): extraire wallFaceCycles — gère T-junctions, refactorer wallsToRooms"
```

---

### Task 2 : `computeAutoCotations` — remplacer `detectClosedPolygons` par `wallFaceCycles`

**Files:**
- Modify: `src/engine/geometry/wallCotation.ts`
- Modify: `src/engine/geometry/wallCotation.test.ts`

- [ ] **Step 1 : Ajouter un test qui doit échouer**

Dans `src/engine/geometry/wallCotation.test.ts`, remplacer la ligne 2 :

```ts
// Avant
import { detectClosedPolygons, computeAutoCotations } from './wallCotation';

// Après
import { computeAutoCotations } from './wallCotation';
```

Et supprimer le bloc `describe('detectClosedPolygons', ...)` (lignes 12-50) entièrement.

Puis ajouter à la fin du fichier (avant la fonction `dist`) :

```ts
describe('computeAutoCotations — T-junction (2 pièces adjacentes)', () => {
  // Pièce gauche a-b-e-f (100×100), pièce droite b-c-d-e (100×100)
  // Mur partagé e-b
  const nodes = [
    nd('a',0,0), nd('b',100,0), nd('c',200,0),
    nd('d',200,100), nd('e',100,100), nd('f',0,100),
  ];
  const walls = [
    w('w1','a','b'), w('w2','b','c'), w('w3','c','d'),
    w('w4','d','e'), w('w5','e','b'), w('w6','e','f'), w('w7','f','a'),
  ];

  it('retourne des cotations (non vide malgré la T-junction)', () => {
    const result = computeAutoCotations(walls, nodes);
    expect(result.length).toBeGreaterThan(0);
  });

  it('le mur partagé w5 a au moins une cotation', () => {
    const result = computeAutoCotations(walls, nodes);
    expect(result.some(c => c.wallId === 'w5')).toBe(true);
  });
});
```

- [ ] **Step 2 : Vérifier que les tests échouent**

```
npx vitest run src/engine/geometry/wallCotation.test.ts
```

Attendu : FAIL sur les 2 nouveaux tests T-junction (0 cotations retournées).

- [ ] **Step 3 : Mettre à jour `wallCotation.ts`**

Dans `src/engine/geometry/wallCotation.ts` :

**3a.** Changer l'import de `wallFaces` (ligne 1 ou 3) :

```ts
// Avant — pas d'import de wallFaces
// Après — ajouter :
import { wallFaceCycles } from './wallFaces';
```

**3b.** Dans `computeAutoCotations`, remplacer la ligne `const rooms = detectClosedPolygons(walls, nodes);` par :

```ts
const rooms = wallFaceCycles(walls, nodes);
```

**3c.** Supprimer la fonction `detectClosedPolygons` et son commentaire (lignes 34-89 de l'original). Le code de `computeAutoCotations` utilise `room.wallIds` et `room.nodeIds` — l'interface `FaceCycle` est identique à ce que retournait `detectClosedPolygons`, donc aucun autre changement n'est nécessaire.

- [ ] **Step 4 : Vérifier que les tests passent**

```
npx vitest run src/engine/geometry/wallCotation.test.ts
```

Attendu : tous les tests PASS, y compris les 2 nouveaux T-junction.

- [ ] **Step 5 : Vérifier TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 6 : Commit**

```
git add src/engine/geometry/wallCotation.ts src/engine/geometry/wallCotation.test.ts
git commit -m "fix(wallCotation): remplacer detectClosedPolygons par wallFaceCycles — cotations sur T-junctions"
```

---

### Task 3 : Canvas — `splitWillCreateLink` (doublon de mur)

**Files:**
- Modify: `src/components/plan/WallDrawingCanvas.tsx`

- [ ] **Step 1 : Localiser le bloc à modifier**

Dans `src/components/plan/WallDrawingCanvas.tsx`, trouver le bloc chain-extension `else` qui contient :

```ts
const alreadyConnected = walls.some(w =>
  (w.node1Id === prevNodeId && w.node2Id === targetNodeId) ||
  (w.node1Id === targetNodeId && w.node2Id === prevNodeId)
);

onPushHistory();

if (splitWallId !== null) {
  onSplitWall(splitWallId, { id: targetNodeId, x: pt.x, y: pt.y });
} else if (!(snap?.type === 'endpoint' && snap.nodeId)) {
  onAddNode({ id: targetNodeId, x: pt.x, y: pt.y });
}

if (!alreadyConnected) {
  onAddWall({ id: generateId(), node1Id: prevNodeId, node2Id: targetNodeId, thickness: chain.thickness });
}
```

- [ ] **Step 2 : Appliquer la correction**

Remplacer le bloc ci-dessus par :

```ts
const alreadyConnected = walls.some(w =>
  (w.node1Id === prevNodeId && w.node2Id === targetNodeId) ||
  (w.node1Id === targetNodeId && w.node2Id === prevNodeId)
);

// Quand le split crée lui-même le lien prevNodeId→targetNodeId, ne pas doubler le mur.
// splitWallInEngine crée toujours wall.node1Id→newNode et newNode→wall.node2Id.
// Si prevNodeId est l'une de ces extrémités, le lien est déjà créé par le split.
const snapWallObj = splitWallId !== null ? walls.find(w => w.id === splitWallId) : null;
const splitWillCreateLink =
  snapWallObj !== null &&
  (snapWallObj.node1Id === prevNodeId || snapWallObj.node2Id === prevNodeId);

onPushHistory();

if (splitWallId !== null) {
  onSplitWall(splitWallId, { id: targetNodeId, x: pt.x, y: pt.y });
} else if (!(snap?.type === 'endpoint' && snap.nodeId)) {
  onAddNode({ id: targetNodeId, x: pt.x, y: pt.y });
}

if (!alreadyConnected && !splitWillCreateLink) {
  onAddWall({ id: generateId(), node1Id: prevNodeId, node2Id: targetNodeId, thickness: chain.thickness });
}
```

- [ ] **Step 3 : Vérifier TypeScript**

```
npx tsc --noEmit
```

Attendu : 0 erreurs.

- [ ] **Step 4 : Lancer toute la suite de tests**

```
npx vitest run
```

Attendu : tous les tests passent.

- [ ] **Step 5 : Commit**

```
git add src/components/plan/WallDrawingCanvas.tsx
git commit -m "fix(wall-canvas): splitWillCreateLink — éviter doublon mur quand face-snap sur mur adjacent"
```

---

### Task 4 : Vérification manuelle

- [ ] **Lancer le serveur de développement**

```
npm run dev
```

- [ ] **Scénario 1 — Doublon de mur corrigé**
  1. Dessiner une pièce rectangulaire (4 murs, fermée)
  2. Face-snapper sur un mur → démarrer une chaîne au point M
  3. Face-snapper sur le mur ADJACENT à M (le mur créé par le premier split) → N
  4. Appuyer sur Entrée pour fermer
  5. Vérifier que **2 pièces** apparaissent dans le WallRoomPanel avec les bonnes surfaces

- [ ] **Scénario 2 — Cotations sur T-junction**
  1. Dessiner une première pièce fermée
  2. Connecter une deuxième pièce (endpoint ou face snap)
  3. Vérifier que les **cotations** (lignes bleues/vertes avec cm) apparaissent sur TOUTES les pièces

- [ ] **Scénario 3 — Régression : pièce unique**
  1. Dessiner une seule pièce rectangulaire
  2. Vérifier que les cotations apparaissent correctement (8 cotations : 2 par mur)

- [ ] **Scénario 4 — Régression : Ctrl+Z**
  1. Dessiner 2 pièces avec face-snap
  2. Ctrl+Z plusieurs fois → vérifier que l'état revient correctement

# Intégration moteur murs — Sous-projet 3 : Outils DOOR + EXCLUDE

**Date :** 2026-06-03
**Périmètre :** Sous-projet 3 de 5 — ajouter les outils DOOR (ouverture) et EXCLUDE (zone non carrelée) au moteur de murs.

---

## Problème

`WallDrawingCanvas` ne dispose que de trois outils (WALL, SELECT, DELETE). Les plans d'appartement nécessitent au minimum des ouvertures (portes, fenêtres) et la possibilité de délimiter des zones exclues du calepinage (sanitaires, baignoire, etc.).

---

## Décisions de design

### DOOR — Ouverture dans un mur

**Modèle de données :** ajouter `isDoor?: boolean` à l'interface `Wall`. Aucune nouvelle entité.

**Mécanique :** cliquer sur un mur en mode DOOR le découpe en trois segments :

```
Wall (u→v)
  →  Wall (u→d1)
  +  Wall (d1→d2, isDoor=true)   ← l'ouverture
  +  Wall (d2→v)
```

- Deux nœuds `d1` et `d2` sont créés à la position du clic ± demi-largeur par défaut (`DOOR_DEFAULT_WIDTH_MM = 900`).
- Si le mur est plus court que la largeur minimale (300mm), l'insertion est ignorée.
- Les nœuds `d1`/`d2` sont déplaçables en mode SELECT comme tous les autres nœuds.
- Cliquer sur un mur `isDoor` existant le supprime (retour à un seul mur).

**Rendu :** les murs `isDoor` ne sont PAS remplis (aucun polygone Wall, aucune geometry de coin). Une ligne fine dashed est affichée à la place.

**Impact bridge `wallsToRooms` :** les murs `isDoor` participent au graphe planaire normalement — ils ferment le contour de la pièce. La distinction `isDoor` est purement visuelle dans ce sous-projet.

### EXCLUDE — Zone non carrelée

**Modèle de données :**

```typescript
// src/types/wall.ts — nouvelle interface
export interface WallExcludedZone {
  id: string;
  points: Point[];
  label?: string;
}
```

```typescript
// src/types/project.ts — extension de wallEngine
wallEngine?: {
  nodes: WallNode[];
  walls: Wall[];
  excludedZones: WallExcludedZone[];  // NOUVEAU — auparavant absent
};
```

**Mécanique :** outil EXCLUDE dans `WallDrawingCanvas` — identique à l'outil legacy :
- Clic = ajouter un point au polygone en cours
- Double-clic = fermer et enregistrer
- Touche Enter = fermer et enregistrer (quand ≥ 3 points)
- Touche Escape = annuler

**Rendu :** polygones exclus affichés en overlay semi-transparent (couleur ambrée, identique au legacy).

**Impact bridge `wallsToRooms` :** la fonction accepte un troisième paramètre `excludedZones: WallExcludedZone[]`. Chaque zone est assignée à la pièce dont elle contient le centroïde via `pointInPolygon` (déjà exportée de `polygon.ts`). Si le centroïde est hors de toute pièce, la zone est ignorée.

```typescript
// Signature mise à jour
export function wallsToRooms(
  walls: Wall[],
  nodes: WallNode[],
  excludedZones?: WallExcludedZone[],
): Room[]
```

---

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `src/types/wall.ts` | Ajouter `isDoor?: boolean` à `Wall` ; ajouter `WallExcludedZone` |
| `src/types/project.ts` | Étendre `wallEngine` avec `excludedZones: WallExcludedZone[]` |
| `src/engine/geometry/wallFaces.ts` | `wallsToRooms` : 3e param `excludedZones?`, point-in-polygon assignment |
| `src/engine/geometry/wallFaces.test.ts` | Tests : zones assignées au bon room, centroïde hors pièce ignoré |
| `src/store/projectStore.ts` | Actions `addWallExcludedZone`, `removeWallExcludedZone` ; MAJ `initWallEngine` |
| `src/store/selectors.ts` / `projectStore.ts` | `selectRooms` passe `wallEngine.excludedZones` à `wallsToRooms` |
| `src/components/plan/WallDrawingCanvas.tsx` | Tool DOOR + EXCLUDE, props, rendu |
| `src/components/plan/PlanEditor.tsx` | Passer `excludedZones`, `onAddExcludedZone`, `onRemoveExcludedZone` |

---

## Détail par fichier

### `src/types/wall.ts`

```typescript
export interface Wall {
  id: string;
  node1Id: string;
  node2Id: string;
  thickness: number;
  isDoor?: boolean;  // NOUVEAU
}

export interface WallExcludedZone {  // NOUVEAU
  id: string;
  points: Point[];
  label?: string;
}
```

### `src/types/project.ts`

Changer la définition de `wallEngine` (ligne ~98) :

```typescript
wallEngine?: {
  nodes: WallNode[];
  walls: Wall[];
  excludedZones: WallExcludedZone[];
};
```

Ajouter `WallExcludedZone` aux imports depuis `@/types/wall`.

### `src/engine/geometry/wallFaces.ts`

Nouvelle signature :
```typescript
export function wallsToRooms(
  walls: Wall[],
  nodes: WallNode[],
  excludedZones: WallExcludedZone[] = [],
): Room[]
```

Logique d'assignation (à ajouter dans `interior.map(...)`) :
```typescript
import { pointInPolygon } from '@/engine/geometry/polygon';

// Dans le .map des faces intérieures :
const facePts = pts.map(p => ({ x: p.x, y: p.y }));
const roomZones = excludedZones.filter(zone => {
  if (zone.points.length < 3) return false;
  const cx = zone.points.reduce((s, p) => s + p.x, 0) / zone.points.length;
  const cy = zone.points.reduce((s, p) => s + p.y, 0) / zone.points.length;
  return pointInPolygon({ x: cx, y: cy }, facePts);
});
// roomZones va dans excludedZones du Room retourné
```

Les murs `isDoor` sont déjà exclus du rendu visuel dans `WallDrawingCanvas` — `wallsToRooms` les traite comme des murs normaux pour la détection de faces (ils ferment le contour).

### `src/store/projectStore.ts`

**Nouvelles actions :**
```typescript
addWallExcludedZone: (points: Point[]) => void;
removeWallExcludedZone: (id: string) => void;
```

Implémentation :
```typescript
addWallExcludedZone: (points) => {
  set(state => ({
    projects: state.projects.map(p =>
      p.id !== state.activeProjectId ? p : {
        ...p,
        updatedAt: Date.now(),
        wallEngine: p.wallEngine ? {
          ...p.wallEngine,
          excludedZones: [...(p.wallEngine.excludedZones ?? []), { id: generateId(), points }],
        } : p.wallEngine,
      }
    ),
  }));
},

removeWallExcludedZone: (id) => {
  set(state => ({
    projects: state.projects.map(p =>
      p.id !== state.activeProjectId ? p : {
        ...p,
        updatedAt: Date.now(),
        wallEngine: p.wallEngine ? {
          ...p.wallEngine,
          excludedZones: (p.wallEngine.excludedZones ?? []).filter(z => z.id !== id),
        } : p.wallEngine,
      }
    ),
  }));
},
```

**Mettre à jour `initWallEngine` :** ajouter `excludedZones: []` dans l'objet initial.

**Mettre à jour `selectRooms` :**
```typescript
export function selectRooms(s: ProjectState): Room[] {
  const project = selectActiveProject(s);
  if (!project) return [];
  const we = project.wallEngine;
  if (we !== undefined) return wallsToRooms(we.walls, we.nodes, we.excludedZones ?? []);
  return project.rooms;
}
```

### `src/components/plan/WallDrawingCanvas.tsx`

**Nouvelles props :**
```typescript
excludedZones: WallExcludedZone[];
onAddExcludedZone: (points: Point[]) => void;
onRemoveExcludedZone: (id: string) => void;
```

**PlanTool étendu :** `'WALL' | 'SELECT' | 'DELETE' | 'DOOR' | 'EXCLUDE'`

**Constante de largeur de porte :**
```typescript
const DOOR_DEFAULT_WIDTH_MM = 900;
const DOOR_MIN_WIDTH_MM     = 300;
```

**DOOR — handlePointerDown (outil DOOR) :**
```typescript
if (tool === 'DOOR') {
  // Trouver le mur le plus proche
  const hit = hitTestWall(world);
  if (!hit) return;
  const n1 = nodes.find(n => n.id === hit.node1Id)!;
  const n2 = nodes.find(n => n.id === hit.node2Id)!;

  // Si isDoor : supprimer le segment de porte (MVP — les stubs u→d1 et d2→v restent,
  // l'utilisateur les reconnecte en déplaçant d1/d2 jusqu'à leur voisin, ce qui déclenche mergeNodes)
  if (hit.isDoor) {
    onPushHistory();
    onRemoveWall(hit.id);
    return;
  }

  // Paramètre t du clic sur le segment
  const dx = n2.x - n1.x, dy = n2.y - n1.y;
  const len = Math.hypot(dx, dy);
  if (len < DOOR_MIN_WIDTH_MM * 2) return; // trop court

  const t = Math.max(0, Math.min(1,
    ((world.x - n1.x) * dx + (world.y - n1.y) * dy) / (len * len)
  ));
  const halfW = Math.min(DOOR_DEFAULT_WIDTH_MM / 2, (len * 0.4));
  const tCenter = Math.max(halfW / len, Math.min(1 - halfW / len, t));

  const d1: Point = { x: n1.x + dx * (tCenter - halfW / len), y: n1.y + dy * (tCenter - halfW / len) };
  const d2: Point = { x: n1.x + dx * (tCenter + halfW / len), y: n1.y + dy * (tCenter + halfW / len) };

  const id1 = generateId(), id2 = generateId();
  onPushHistory();
  onRemoveWall(hit.id);
  onAddNode({ id: id1, x: d1.x, y: d1.y });
  onAddNode({ id: id2, x: d2.x, y: d2.y });
  onAddWall({ id: generateId(), node1Id: hit.node1Id, node2Id: id1, thickness: hit.thickness });
  onAddWall({ id: generateId(), node1Id: id1,         node2Id: id2, thickness: hit.thickness, isDoor: true });
  onAddWall({ id: generateId(), node1Id: id2,         node2Id: hit.node2Id, thickness: hit.thickness });
}
```

**EXCLUDE — état + handlers :**
```typescript
const [excludePoints, setExcludePoints] = useState<Point[]>([]);
const lastClickRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

// Dans handlePointerDown (outil EXCLUDE) :
if (tool === 'EXCLUDE') {
  const now = Date.now(), last = lastClickRef.current;
  const isDouble = now - last.time < 350 && dist(world, { x: last.x, y: last.y }) < 30 / scale;
  lastClickRef.current = { time: now, x: world.x, y: world.y };
  if (isDouble) {
    if (excludePoints.length >= 3) {
      onPushHistory(); // via onAddExcludedZone qui pousse l'historique
      onAddExcludedZone([...excludePoints]);
      setExcludePoints([]);
    }
    return;
  }
  setExcludePoints(prev => [...prev, world]);
  return;
}
```

Mettre à jour le useEffect clavier pour gérer EXCLUDE :
```typescript
if (e.key === 'Escape') {
  setChain(null);
  setSelectedWallId(null);
  setEditingWallId(null);
  setExcludePoints([]);  // NOUVEAU
}
if (e.key === 'Enter') {
  tryCloseChain();
  // Fermer zone exclue si ≥ 3 points
  if (excludePoints.length >= 3) {
    onAddExcludedZone([...excludePoints]);
    setExcludePoints([]);
  }
}
```

**Rendu DOOR :** dans la boucle `wallPolygons.map(...)`, sauter les murs `isDoor` pour le polygone épais. Ajouter une ligne dashed à la place :
```typescript
// Après la boucle des wallPolygons :
{walls.filter(w => w.isDoor).map(w => {
  const n1 = nodes.find(n => n.id === w.node1Id);
  const n2 = nodes.find(n => n.id === w.node2Id);
  if (!n1 || !n2) return null;
  const s1 = worldToScreen({ x: n1.x, y: n1.y });
  const s2 = worldToScreen({ x: n2.x, y: n2.y });
  return (
    <line key={`door-${w.id}`}
      x1={s1.x} y1={s1.y} x2={s2.x} y2={s2.y}
      stroke="#e67e22" strokeWidth={2} strokeDasharray="8,4"
    />
  );
})}
```

Filtre dans `computeCornerGeometry` et `computeJointLines` — ces fonctions reçoivent `walls`. Passer `walls.filter(w => !w.isDoor)` pour exclure les ouvertures de la géométrie épaisse.

**Rendu EXCLUDE :**
```typescript
// Zones existantes
{excludedZones.map(zone => {
  if (zone.points.length < 3) return null;
  const pts = zone.points.map(p => worldToScreen(p));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';
  return (
    <path key={zone.id} d={path}
      fill="#f59e0b" fillOpacity={0.25}
      stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5,3"
    />
  );
})}
// Zone en cours de tracé
{tool === 'EXCLUDE' && excludePoints.length >= 1 && (() => {
  const pts = [...excludePoints, cursor ?? excludePoints[excludePoints.length - 1]!].map(p => worldToScreen(p));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  return <path d={path} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5,3" />;
})()}
```

### `src/components/plan/PlanEditor.tsx`

```typescript
const addWallExcludedZone = useProjectStore(s => s.addWallExcludedZone);
const removeWallExcludedZone = useProjectStore(s => s.removeWallExcludedZone);

// Dans le JSX <WallDrawingCanvas> :
excludedZones={wallEngine.excludedZones ?? []}
onAddExcludedZone={addWallExcludedZone}
onRemoveExcludedZone={removeWallExcludedZone}
```

Et passer `tool as 'WALL' | 'SELECT' | 'DELETE' | 'DOOR' | 'EXCLUDE'`.

---

## Tests

`src/engine/geometry/wallFaces.test.ts` — ajouter :

- Rectangle avec une zone exclue dont le centroïde est à l'intérieur → zone assignée au Room
- Rectangle avec une zone dont le centroïde est à l'extérieur → zone ignorée
- `wallsToRooms` sans argument `excludedZones` (paramètre optionnel) → rooms avec `excludedZones: []`

---

## Hors périmètre de ce sous-projet

- Reconstruction automatique du mur original après suppression d'une porte (stubs `u→d1` et `d2→v` restent — l'utilisateur les gère via drag-merge ou DELETE)
- PARTITION (cloison visuelle) — reportée
- Suppression interactive d'une zone exclue en cliquant dessus
- Rendu arc de porte (optionnel, esthétique uniquement)
- Gestion des pièces (SP4)

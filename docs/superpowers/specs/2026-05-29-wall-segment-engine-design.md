# Wall Segment Engine — Design Spec

> **Statut :** Approuvé (brainstorming 2026-05-29)

## Objectif

Refonte complète du moteur de dessin du plan pour adopter un modèle de murs-segments (parallelogrammes épais) inspiré de Kozikaza, avec cotations automatiques sur le périmètre intérieur et extérieur. Remplacement de l'ancien modèle polygon (`Room { points[], edges[] }`) par un modèle orienté mur (`walls: Wall[]`).

## Décisions de conception

| Sujet | Décision |
|---|---|
| Modèle de données | `Wall { id, p1, p2, thickness }` — store Zustand `walls[]` |
| Composant | `WallDrawingCanvas.tsx` nouveau, isolé (DrawingCanvas.tsx non touché) |
| Mode de dessin | Chaîne continue — chaque clic prolonge depuis le dernier point |
| Coins | Coupe en onglet (bissectrice) sur jonctions L |
| T-jonctions | Accrochage sur la face du mur hôte, sans scission du mur hôte |
| Cotations | `computeAutoCotations()` fonction pure, ext. + int., non éditables |
| Migration | Aucune — anciens projets non convertis |
| Livraison | 3 phases ordonnées (voir ci-dessous) |

---

## Modèle de données

### Type `Wall`

```typescript
interface Wall {
  id: string;
  p1: { x: number; y: number };  // extrémité A (ligne médiane)
  p2: { x: number; y: number };  // extrémité B (ligne médiane)
  thickness: number;              // épaisseur en cm, défaut 20
}
```

Les coordonnées `p1`/`p2` sont sur la **ligne médiane** du mur. Les faces intérieure et extérieure sont déduites à la volée : offset de `thickness / 2` perpendiculairement à la direction du mur.

Il n'y a pas de type `Room` en phase 1. Une "pièce" est implicitement un ensemble de murs dont les extrémités se rejoignent.

### Store Zustand — nouveau slice `walls`

```typescript
// Dans useProjectStore
walls: Wall[];                            // liste plate, ordre = ordre de création

// Actions
addWall(wall: Wall): void;
removeWall(id: string): void;
updateWall(id: string, patch: Partial<Wall>): void;
setWalls(walls: Wall[]): void;            // pour undo/redo batch
clearWalls(): void;
```

Les actions `addWall` / `removeWall` s'intègrent dans le stack d'historique Zustand existant (même mécanisme que les actions Room actuelles).

---

## Architecture des composants

```
PlanEditor.tsx
  └─ <WallDrawingCanvas />         ← nouveau (remplace DrawingCanvas pour les plans wall)
       ├─ rendu SVG des murs (polygones)
       ├─ rendu des cotations automatiques
       ├─ state local : drawingChain
       └─ handlers : pointerDown / pointerMove / pointerUp / keyDown

useProjectStore (Zustand)
  └─ walls: Wall[]

computeCornerGeometry(walls: Wall[]): WallPolygon[]   ← fonction pure
computeAutoCotations(walls: Wall[]): CotationLine[]   ← fonction pure
```

### `WallDrawingCanvas` — props

```typescript
interface WallDrawingCanvasProps {
  walls: Wall[];
  tool: 'WALL' | 'SELECT' | 'DELETE';
  scale: number;
  pan: { x: number; y: number };
  onAddWall: (wall: Wall) => void;
  onRemoveWall: (id: string) => void;
  onUpdateWall: (id: string, patch: Partial<Wall>) => void;
}
```

### `WallDrawingCanvas` — state local

```typescript
type DrawingChain = {
  points: { x: number; y: number }[];  // points validés (≥ 1)
  thickness: number;
} | null;

// State interne
const [drawingChain, setDrawingChain] = useState<DrawingChain>(null);
const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
```

---

## Logique de dessin — mode WALL

### Flow d'interaction

```
pointerDown sur canvas vide (outil = WALL)
  si drawingChain === null
    → démarrer chaîne : drawingChain = { points: [snapPoint], thickness: 20 }
  sinon
    → ajouter point :
        créer Wall { id: uuid(), p1: points[-1], p2: snapPoint, thickness }
        appeler onAddWall(wall)
        si snapPoint ≈ points[0] (fermeture) → reset drawingChain = null
        sinon → ajouter snapPoint à la chaîne

pointerMove
  → calculer snapPoint (voir priorités snap)
  → setCursorPos(snapPoint)
  → afficher preview wall (points[-1] → snapPoint, tirets + fill opacity 0.2)

Esc
  → reset drawingChain = null  (chaîne abandonnée, murs déjà créés conservés)

double-clic
  → terminaison de la chaîne sans fermeture
```

### Priorités de snap (pointerMove)

1. **Extrémité de mur existant** dans un rayon de 12px canvas → snap exact, indicateur : cercle orange
2. **Face de mur existant** (T-jonction) dans un rayon de 8px → snap sur la face, indicateur : carré
3. **Grille** (si active, espacement configurable)
4. **Position libre** du curseur

### Rendu preview

- Segment en tirets orange (`stroke-dasharray`)
- Parallélogramme fantôme avec `fill-opacity: 0.15`
- Indicateur de snap (cercle ou carré selon le type)

---

## Géométrie des coins en onglet (`computeCornerGeometry`)

### Principe

Pour chaque mur, on calcule son polygone SVG (4–6 points) en tenant compte des murs adjacents partageant une extrémité.

```typescript
interface WallPolygon {
  wallId: string;
  points: { x: number; y: number }[];  // polygone SVG
}

function computeCornerGeometry(walls: Wall[]): WallPolygon[]
```

### Calcul de l'onglet

```typescript
// Normale au mur (perpendiculaire à la direction)
const dir = normalize(p2 - p1);
const normal = { x: -dir.y, y: dir.x };
const half = thickness / 2;

// Extrémité sans voisin → coupe plate perpendiculaire (4 points)
// Extrémité avec voisin → coupe sur la bissectrice
function miterOffset(dir1: Vec2, dir2: Vec2, half: number): number {
  const bisector = normalize(add(dir1, dir2));
  // Offset = half / sin(α/2) où α = angle entre les deux murs
  // sin(α/2) = cross product des directions normalisées / 2
  return half / dot(normal1, bisector);
}
```

Les 4 coins du parallélogramme sont calculés à partir des offsets le long de la normale pour les deux extrémités.

---

## T-jonctions (accrochage sur face)

Quand le point de snap tombe sur la **face** d'un mur hôte (pas sur une extrémité) :

- Le nouveau mur (`mur entrant`) a son extrémité `p2` positionnée sur la face du mur hôte
- Le mur hôte reste **non modifié** (pas de scission en deux segments)
- La connexion est **visuelle uniquement** : le mur entrant s'arrête contre la face du mur hôte
- Pour les cotations, la jonction en T crée un segment de cotation de longueur zéro sur la face concernée (supprimé automatiquement)

---

## Moteur de cotations automatiques (`computeAutoCotations`)

Fonction pure appelée à chaque render — aucun state, aucune mutation.

```typescript
interface CotationLine {
  p1: { x: number; y: number };   // extrémité A de la face
  p2: { x: number; y: number };   // extrémité B de la face
  offset: number;                  // distance perpendiculaire (défaut 80px)
  valueCm: number;                 // longueur en cm
  side: 'ext' | 'int';
}

function computeAutoCotations(walls: Wall[]): CotationLine[]
```

### Algorithme

**Étape 1 — Faces visibles**  
Pour chaque mur, calculer deux segments : face extérieure (offset `+half`) et face intérieure (offset `−half`). Tronquer chaque face aux bissectrices des coins en onglet adjacents.

**Étape 2 — Faces exposées**  
Une face est exposée si aucun autre mur ne se trouve à moins de `tolerance = 2px`. Les faces accolées à un autre mur (T-jonction, mur parallèle proche) sont filtrées.

**Étape 3 — Génération des cotations**  
Chaque face exposée produit une `CotationLine`. La valeur en cm est calculée depuis la longueur SVG divisée par l'échelle courante.

### Rendu

Les cotations sont rendues avec :
- Ligne principale perpendiculaire à la face, décalée de `offset`
- Lignes d'extension en tirets (de la face à la ligne principale)
- Flèches aux extrémités
- Valeur numérique centrée sur la ligne principale
- Cotations extérieures : couleur verte (`#27ae60`)
- Cotations intérieures : couleur orange (`#e67e22`), style tirets

Les cotations automatiques ne sont **pas éditables** en phase 1 — elles sont purement informationnelles.

---

## Phases de livraison

### Phase 1 — Dessin

- Store `walls[]` avec actions add/remove/update
- `WallDrawingCanvas` : rendu des murs comme rectangles (pas encore d'onglets)
- Mode WALL : chaîne continue, snap sur extrémités, Esc pour terminer
- Mode SELECT : sélection d'un mur au clic, affichage `WallEdgeEditor` pour modifier l'épaisseur
- Mode DELETE : clic sur un mur → suppression immédiate
- Undo/redo fonctionnel
- `PlanEditor` rend `<WallDrawingCanvas />` si `walls.length > 0` (nouveau projet wall-engine), sinon `<DrawingCanvas />` (anciens projets inchangés — transition gracieuse)

### Phase 2 — Géométrie

- `computeCornerGeometry` : coins en onglet (bissectrice), rendu polygone correct
- T-jonctions : accrochage sur la face du mur hôte
- Rendu parallélogramme complet (pas de rectangles simples)

### Phase 3 — Cotations automatiques

- `computeAutoCotations` : cotations extérieures et intérieures générées à la volée
- Rendu des lignes de cotation dans `WallDrawingCanvas`
- Cotations non éditables (informationnelles)

---

## Hors périmètre (versions futures)

- Migration automatique des projets existants (polygon → wall segments)
- Murs à angles non orthogonaux (cotations angulaires)
- Cotation globale (largeur totale du plan)
- Cotations éditables / contraintes sur murs
- Reconnection des fonctionnalités existantes (calepinage, zones colorées, cloisons)
- T-jonctions avec scission du mur hôte

---

## Fichiers créés / modifiés

| Fichier | Action |
|---|---|
| `src/store/useProjectStore.ts` | Ajouter slice `walls[]` avec actions |
| `src/components/plan/WallDrawingCanvas.tsx` | Créer (nouveau) |
| `src/lib/geometry/cornerGeometry.ts` | Créer — `computeCornerGeometry()` |
| `src/lib/geometry/autoCotations.ts` | Créer — `computeAutoCotations()` |
| `src/components/plan/PlanEditor.tsx` | Brancher `<WallDrawingCanvas />` |
| `src/types/wall.ts` | Créer — type `Wall`, `WallPolygon`, `CotationLine` |

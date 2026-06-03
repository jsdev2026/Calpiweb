# WallDrawingCanvas — Redesign cohérence + light/dark mode

**Date :** 2026-06-03
**Fichiers :** `src/app/globals.css`, `src/components/plan/WallDrawingCanvas.tsx`

## Problème

`WallDrawingCanvas` utilise des couleurs hardcodées dark-only (`bg-[#1a1c24]`, `#272b38`, `#6b6056`, `#3d3830`). Le light mode n'existe pas. Il n'y a pas de fill des pièces détectées sur le canvas.

## Solution — Option B

### 1 — globals.css : 2 nouvelles CSS vars

```css
/* :root (light) */
--canvas-wall:       #64748b;
--canvas-wall-joint: #94a3b8;

/* [data-dark="true"] */
--canvas-wall:       #52525b;
--canvas-wall-joint: #3f3f46;
```

Vars existantes réutilisées sans modification :
- `--canvas-bg` : fond canvas
- `--canvas-dot` : points de grille
- `--canvas-poly-active` : fill semi-transparent des pièces (`rgba(226,232,240,0.95)` light / `#18181b` dark)
- `--canvas-name-active` : label texte des pièces (`#6B7280` light / `#71717a` dark)

### 2 — WallDrawingCanvas.tsx : 6 changements

#### 2.1 Fond du wrapper div

```typescript
// AVANT
className="relative h-full w-full overflow-hidden bg-[#1a1c24]"

// APRÈS
className="relative h-full w-full overflow-hidden"
style={{ background: 'var(--canvas-bg)', touchAction: 'none' }}
```

Note : retirer `touchAction: 'none'` du wrapper actuel si déjà présent — il est déjà défini sur le parent dans PlanEditor.

#### 2.2 Points de grille

```typescript
// AVANT
<circle cx={10 * scale} cy={10 * scale} r="0.8" fill="#272b38" />

// APRÈS
<circle cx={10 * scale} cy={10 * scale} r="0.8" fill="var(--canvas-dot)" />
```

#### 2.3 Couleur des murs

Remplacer la constante `WALL_COLOR = '#6b6056'` par une string CSS var :

```typescript
const WALL_COLOR = 'var(--canvas-wall)';
```

(Le composant utilise déjà `fill={color}` où `color` est `WALL_COLOR` ou `WALL_SELECTED_COLOR` — aucun autre changement requis.)

#### 2.4 Lignes de joint

```typescript
// AVANT
stroke="#3d3830"

// APRÈS
stroke="var(--canvas-wall-joint)"
```

#### 2.5 Fill des pièces détectées (NOUVEAU)

Ajouter un `useMemo` pour les rooms dérivées, et les rendre AVANT les polygones de murs dans le SVG :

```typescript
// Import à ajouter en haut
import { wallsToRooms } from '@/engine/geometry/wallFaces';
import type { Room } from '@/types/project';

// useMemo — après les useMemos de wallPolygons/jointLines
const detectedRooms: Room[] = useMemo(
  () => wallsToRooms(walls, nodes),
  [walls, nodes],
);
```

Rendu dans le SVG (AVANT `{wallPolygons.map(...)}`) :

```tsx
{/* Fill semi-transparent des pièces détectées */}
{detectedRooms.map((room) => {
  if (room.points.length < 3) return null;
  const pts = room.points
    .map((p) => worldToScreen(p))
    .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  const cx = room.points.reduce((s, p) => s + p.x, 0) / room.points.length;
  const cy = room.points.reduce((s, p) => s + p.y, 0) / room.points.length;
  const sc = worldToScreen({ x: cx, y: cy });
  return (
    <g key={`room-${room.id}`} className="pointer-events-none">
      <polygon points={pts} fill="var(--canvas-poly-active)" />
      <text
        x={sc.x} y={sc.y}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fill="var(--canvas-name-active)"
        style={{ fontFamily: 'system-ui', userSelect: 'none' }}
      >
        {room.name ?? ''}
      </text>
    </g>
  );
})}
```

#### 2.6 Couleur de l'aperçu de chaîne

Le chain preview utilise `fill={WALL_COLOR}` (déjà corrigé via 2.3) et `stroke="#e67e22"` pour la bordure — conserver `#e67e22` (accent, inchangé).

---

## Ce qui ne change pas

- `WALL_SELECTED_COLOR = '#e67e22'` — accent orange, inchangé
- Portes : `stroke="#e67e22"` dashed — inchangé
- Zones exclues : amber `#f59e0b` — inchangé
- Auto-cotations : vert/bleu/orange — inchangé
- Node handles SELECT : `stroke="#e67e22"` — inchangé

# Intégration moteur murs — Sous-projet 4 : WallRoomPanel

**Date :** 2026-06-03
**Périmètre :** Sous-projet 4 de 5 — afficher les pièces auto-détectées avec leur surface dans un panel read-only adapté au moteur de murs.

---

## Problème

Quand le moteur de murs est actif, `RoomPanel` (qui permet d'ajouter, renommer, supprimer des pièces legacy) n'est pas rendu. L'utilisateur n'a aucun retour visuel sur les pièces détectées ni sur leurs surfaces.

---

## Décision

Nouveau composant `WallRoomPanel` : même conteneur visuel que `RoomPanel` (border, backdrop blur, shadow, draggable via `useDraggableSnap`), lecture seule — affiche uniquement **nom de la pièce** et **surface en m²** pour chaque pièce auto-détectée.

`RoomPanel` continue d'être rendu en mode legacy. `WallRoomPanel` est rendu à la place quand `wallEngine !== undefined`.

---

## Composant `WallRoomPanel`

**Fichier :** `src/components/plan/WallRoomPanel.tsx`

### Props

```typescript
interface WallRoomPanelProps {
  zone: SnapZone;
  isDragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  tutorialMode?: boolean;
}
```

### Données

- Rooms : `useProjectStore(selectRooms)` — pièces auto-détectées depuis le graphe de murs
- Surface : `getPolygonArea(room.points)` depuis `@/engine/geometry/polygon` — retourne mm², diviser par `1_000_000` pour obtenir m²
- Formatage : `formatM2(getPolygonArea(room.points) * 1_000_000)` — utiliser la fonction existante `formatM2(mm2: number)` de `@/utils/formatters` qui formate avec 2 décimales + " m²"

Attendre : `formatM2` prend des mm² directement. `getPolygonArea` retourne mm². Donc : `formatM2(getPolygonArea(room.points))`.

### Structure JSX

```typescript
// Même conteneur que RoomPanel — copier getPanelStyle / getDropZoneStyle depuis RoomPanel
// (ou les extraire dans un module partagé si les deux composants les utilisent)

<>
  {isDragging && dropZone indicators} {/* identiques à RoomPanel */}
  <div className="group ..." style={getPanelStyle(zone, tutorialMode)}>
    {/* Poignée drag — identique à RoomPanel */}
    <div className="absolute -right-5 ..." onPointerDown={onPointerDown}>
      <GripVertical size={12} ... />
    </div>

    {/* Contenu */}
    <div className="flex flex-col gap-1 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-1.5 shadow-2xl backdrop-blur-md min-w-[140px]">
      <p className="px-3 pt-1 pb-0 text-[9px] font-black uppercase tracking-[0.15em]"
         style={{ color: 'var(--muted)' }}>
        Pièces
      </p>
      <div className="mx-2 h-px bg-gray-200 dark:bg-zinc-700" />

      {rooms.length === 0 ? (
        <p className="px-3 py-2 text-[11px] italic" style={{ color: 'var(--muted)' }}>
          Aucune pièce fermée
        </p>
      ) : (
        rooms.map(room => (
          <div key={room.id} className="rounded-xl px-3 py-1.5">
            <p className="text-[11px] font-bold text-orange-500">{room.name ?? 'Pièce'}</p>
            <p className="text-[10px]" style={{ color: 'var(--text2)' }}>
              {formatM2(getPolygonArea(room.points))}
            </p>
          </div>
        ))
      )}
    </div>
  </div>
</>
```

---

## Modifications dans `PlanEditor`

### Imports à ajouter

```typescript
import { WallRoomPanel } from './WallRoomPanel';
```

### Remplacement du RoomPanel

Localiser le bloc `<div className="hidden md:block mouse:block">` qui contient `<RoomPanel ...>` (ligne ~1774). Remplacer par :

```typescript
<div className="hidden md:block mouse:block">
  {wallEngine !== undefined ? (
    <WallRoomPanel
      zone={roomZone}
      isDragging={roomDragging}
      onPointerDown={handleRoomPointerDown}
      tutorialMode={tutorialMode}
    />
  ) : (
    <RoomPanel
      rooms={rooms}
      activeRoomId={activeRoomId}
      onSelectRoom={setActiveRoomId}
      onAddRoom={handleAddRoom}
      onRemoveRoom={handleRemoveRoom}
      onRenameRoom={renameRoom}
      onClearRoom={handleClearRoom}
      zone={roomZone}
      isDragging={roomDragging}
      onPointerDown={handleRoomPointerDown}
      tutorialMode={tutorialMode}
    />
  )}
</div>
```

---

## Fichiers concernés

| Fichier | Action |
|---------|--------|
| `src/components/plan/WallRoomPanel.tsx` | **Créer** |
| `src/components/plan/PlanEditor.tsx` | **Modifier** — conditionner RoomPanel / WallRoomPanel |

---

## Tests

Aucun test unitaire requis (composant UI pur). Vérifier :
- `npx vitest run` — 344 tests passent sans régression
- `npx tsc --noEmit` — 0 erreurs

### Validation manuelle
1. Mode legacy (sans moteur de murs) → `RoomPanel` visible comme avant
2. Activer le moteur de murs → `WallRoomPanel` s'affiche
3. Dessiner 1 rectangle fermé → "Pièce 1 / XX.XX m²" affiché
4. Dessiner 2 rectangles → 2 entrées affichées
5. Aucun mur fermé → "Aucune pièce fermée"
6. Panel draggable (poignée hover)

---

## Hors périmètre

- Rename des pièces depuis le panel
- Sélection active d'une pièce
- RoomTabs mobile (version mobile en bas) — reporté
- Nommage persistant personnalisé (noms auto uniquement pour SP4)

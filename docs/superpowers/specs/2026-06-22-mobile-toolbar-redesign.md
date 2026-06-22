# Mobile Toolbar Redesign — Design Spec

**Date:** 2026-06-22  
**Status:** Approved

## Problème

Sur smartphone, la toolbar de l'outil de dessin souffre de trois défauts :

1. **Position erronée** : `absolute bottom-20` (80px du bas) laisse un vide mort en bas du canvas — environ 80px de surface de dessin inaccessible sous la barre.
2. **Scroll horizontal** : 9 boutons dans une rangée débordent sur les petits écrans → certains outils sont hors champ sans scroll.
3. **WallThicknessControl absent** : aucun moyen de changer l'épaisseur de mur depuis mobile.
4. **ToolStatusBar absent** : le texte contextuel ("Cliquer pour poser un point") est masqué sur mobile.

## Modèle cible

```
┌─ canvas ─────────────────────────────────────────────────┐
│                                                          │
├──────────────────────────────────────────────────────────┤
│  [▶]  [✏]  [🚪]  [⬜]  [🔒]    │    [−] 10cm [+]       │
│  [↩]  [↪]  [🗑]    Cliquer pour poser un point          │
│ ░░░░░░░░░░░ env(safe-area-inset-bottom) ░░░░░░░░░░░░░░  │
└──────────────────────────────────────────────────────────┘
```

- **Ligne 1 (outils)** : SELECT, WALL, DOOR, EXCLUDE, LOCK | WallThicknessControl compact
- **Ligne 2 (actions)** : Undo, Redo, Delete | texte d'outil actif (status text)
- **Position** : `bottom-0`, `paddingBottom: env(safe-area-inset-bottom, 8px)`
- **Pas de scroll** : tout visible sans défilement horizontal

## Architecture

### Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `src/components/plan/PlanToolbar.tsx` | Restructurer le bloc mobile en deux lignes |
| `src/components/plan/WallThicknessControl.tsx` | Ajouter prop `compact` → stepper inline |

### WallThicknessControl — prop `compact`

Quand `compact={true}` (usage mobile uniquement) :

```tsx
// Rendu compact : stepper horizontal [−] 10cm [+]
<div className="flex items-center gap-1">
  <button onClick={() => onChange(Math.max(50, wallThickness - 5))}>−</button>
  <span>{Math.round(wallThickness / 10)}cm</span>
  <button onClick={() => onChange(wallThickness + 5)}>+</button>
</div>
```

- Pas de clavier virtuel (boutons +/−, pas d'`input`)
- Incrément : 5mm (0.5cm) par tap
- Min : 50mm (5cm), pas de max imposé
- Style cohérent avec les autres boutons de la toolbar mobile

### PlanToolbar — bloc mobile restructuré

Le bloc existant (`data-testid="plan-toolbar-mobile"`) est remplacé par deux lignes :

**Ligne 1** — `flex items-center gap-1 px-2 pt-2 pb-1`  
Ordre gauche → droite : SELECT · WALL · DOOR · EXCLUDE · LOCK · `ml-auto` · `WallThicknessControl compact`

**Ligne 2** — `flex items-center gap-1 px-2 pt-1 pb-[env(safe-area-inset-bottom,8px)]`  
Ordre gauche → droite : Undo · Redo · Delete · `ml-2` · texte d'outil actif (extrait de `TOOL_STATUS_TEXTS`)

**Position** : `absolute bottom-0 left-0 right-0` (supprime `bottom-20`)

Le `TOOL_STATUS_TEXTS` est déjà défini dans `ToolStatusBar.tsx` — l'importer dans `PlanToolbar.tsx` pour l'utiliser dans la ligne 2 mobile.

### ToolStatusBar — inchangé

Le composant `ToolStatusBar` reste en l'état (desktop uniquement, pill flottante en haut).  
Sur mobile, le texte contextuel est inliné dans la ligne 2 de la toolbar.

## Hors périmètre

- WallRoomPanel sur mobile — non demandé
- Tutoriel mobile — non demandé
- Refonte de la topbar mobile — non demandé
- Gestes tactiles — déjà traité dans la spec précédente

## Tests

- Test existant `data-testid="plan-toolbar-mobile"` : vérifier qu'il reste fonctionnel
- Vérifier que `WallThicknessControl` avec `compact={false}` (défaut) est inchangé côté desktop
- Snapshot ou test de rendu pour le stepper compact

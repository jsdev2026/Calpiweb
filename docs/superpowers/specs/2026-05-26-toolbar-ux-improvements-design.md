# Toolbar UX Improvements — Design Spec

## Goal

Améliorer l'ergonomie de la barre latérale de l'outil de dessin de plan sur trois axes : retour au mode sécurisé via `Escape`, barre de statut contextuelle, et mode tutorial de découverte. En parallèle, supprimer l'outil THICKNESS devenu redondant.

## Architecture

Quatre features indépendantes. Trois fichiers principaux modifiés : `PlanToolbar.tsx`, `PlanEditor.tsx`. Un nouveau composant : `ToolStatusBar.tsx`.

**Tech Stack :** TypeScript, React 18, Vitest, Tailwind CSS, lucide-react

---

## Feature 1 — `Escape` → SELECT

### Fichier

`src/components/plan/PlanEditor.tsx` — handler `keydown` existant (ligne ~429)

### Changement

Dans le bloc `if (e.key === 'Escape')`, ajouter `setTool('SELECT')` :

```tsx
if (e.key === 'Escape') {
  setTool('SELECT');                         // ← NEW
  setTutorialMode(false);                    // ← NEW (Feature 3)
  setEditingEdge(null);
  setEditingZoneEdge(null);
  setEditingPartition(null);
  setEditingPartitionThickness(null);
  setEditingThicknessEdge(null);
  setEditingPartitionDimension(null);
  setDraggedVertex(null);
  setDraggedZoneVertex(null);
  setDraggedPartitionVertex(null);
  setCoincideSource(null);
  setDimensionSource(null);
  setPartitionOrigin(null);
  setExcludePoints([]);
}
```

---

## Feature 2 — Barre de statut contextuelle

### Fichier créé

`src/components/plan/ToolStatusBar.tsx`

### Comportement

- Affichée dans l'espace canvas, centrée horizontalement, `top: 12px`
- `position: absolute`, `pointer-events: none`, `z-index: 10`
- Pill semi-transparente, `text-xs`, couleur `var(--text2)`
- Invisible (`return null`) quand `tool === 'SELECT'`
- Desktop uniquement : `hidden md:block mouse:block`

### Textes par outil

```ts
const STATUS_TEXTS: Partial<Record<PlanTool, string>> = {
  WALL:      'Cliquez pour poser un point',
  DOOR:      'Cliquez sur un mur pour placer une porte',
  PARTITION: 'Cliquez pour tracer une cloison',
  EXCLUDE:   'Délimitez la zone à exclure',
  APPLY_H:   'Cliquez sur un mur pour le verrouiller à l\'horizontale',
  APPLY_V:   'Cliquez sur un mur pour le verrouiller à la verticale',
  COINCIDE:  'Cliquez sur le nœud, puis sur un mur/nœud pour les joindre',
  DIMENSION: 'Cliquez sur un premier nœud, puis sur le second',
  ANCHOR:    'Cliquez sur un nœud pour le figer en place',
};
```

### JSX

```tsx
export const ToolStatusBar = ({ tool }: { tool: PlanTool }) => {
  const text = STATUS_TEXTS[tool];
  if (!text) return null;
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-3 z-10 hidden -translate-x-1/2 md:block mouse:block"
    >
      <span
        className="rounded-full px-3 py-1 text-xs backdrop-blur-sm"
        style={{
          background: 'var(--surf)',
          border: '1px solid var(--bdr)',
          color: 'var(--text2)',
        }}
      >
        {text}
      </span>
    </div>
  );
};
```

### Intégration dans PlanEditor.tsx

À l'intérieur du `div` wrapper du canvas (après l'overlay tactile), ajouter :

```tsx
<ToolStatusBar tool={tool} />
```

---

## Feature 3 — Mode tutorial

### État

Dans `PlanEditor.tsx`, ajouter :

```tsx
const [tutorialMode, setTutorialMode] = useState(false);
```

Passé à `PlanToolbar` via props :

```tsx
<PlanToolbar
  tutorialMode={tutorialMode}
  onToggleTutorial={() => setTutorialMode((v) => !v)}
  ...
/>
```

### Déclencheur clavier

Dans le handler `keydown` existant (à la suite des autres raccourcis) :

```tsx
if (e.key === '?') {
  const tag = (document.activeElement as HTMLElement)?.tagName;
  if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
    setTutorialMode((v) => !v);
  }
}
```

### Bouton `?` dans PlanToolbar.tsx

Ajouté **en tête** du toolbar desktop, avant le premier séparateur. Icône `HelpCircle` (lucide-react, déjà disponible comme dépendance).

```tsx
// Tout en haut, avant tous les outils
<button
  type="button"
  aria-label="Mode tutorial"
  onClick={onToggleTutorial}
  className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
    tutorialMode
      ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
      : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
  }`}
>
  <HelpCircle size={15} />
</button>

<div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />
```

### Affichage des labels

Quand `tutorialMode` est `true`, chaque bouton d'outil est enveloppé dans une row flex qui affiche le label à droite. Le toolbar passe de `overflow-y-auto` à `overflow-visible` et retire sa `maxHeight`.

Pattern pour chaque outil :

```tsx
<div className="flex items-center gap-2">
  <ToolTooltip {...TOOL_TOOLTIPS.WALL}>
    <Button ... />
  </ToolTooltip>
  {tutorialMode && (
    <span
      className="whitespace-nowrap text-xs transition-all animate-in fade-in slide-in-from-left-2 duration-200"
      style={{ color: 'var(--text2)' }}
    >
      Tracer des murs
    </span>
  )}
</div>
```

Labels à afficher (dans l'ordre du toolbar) :

| Outil | Label tutorial |
|---|---|
| SELECT | Sélectionner |
| WALL | Tracer des murs |
| DOOR | Placer une porte |
| PARTITION | Cloison (pointillés) |
| EXCLUDE | Zone non carrelée |
| APPLY_H | Contrainte horizontale |
| APPLY_V | Contrainte verticale |
| COINCIDE | Coïncidence |
| DIMENSION | Cotation |
| ANCHOR | Ancrer un nœud |

Les séparateurs et les actions (Undo / Redo / Effacer) n'affichent pas de label tutorial.

### Fermeture

- Clic sur le bouton `?` → toggle
- Touche `?` → toggle
- Touche `Escape` → `setTutorialMode(false)` (Feature 1)

### Desktop uniquement

Le mode tutorial n'affecte pas la barre mobile (déjà `aria-label` sur chaque bouton).

---

## Feature 4 — Suppression de l'outil THICKNESS

### Principe

L'outil THICKNESS disparaît complètement. L'édition de l'épaisseur d'un **mur** reste accessible via le `WallEdgeEditor` (clic sur la côte d'un mur en mode SELECT, comportement existant inchangé).

**Limitation connue :** l'édition de l'épaisseur des **cloisons** (partitions) via l'outil THICKNESS disparaît avec lui. Elle pourra être réintroduite dans le flow SELECT si nécessaire.

### Changements

**`src/components/plan/PlanToolbar.tsx`**
- Retirer `'THICKNESS'` de `PlanTool` → `export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'APPLY_H' | 'APPLY_V' | 'COINCIDE' | 'ANCHOR' | 'PARTITION' | 'EXCLUDE' | 'DIMENSION'`
- Supprimer `TOOL_TOOLTIPS.THICKNESS`
- Supprimer le bouton THICKNESS du toolbar desktop
- Supprimer le bouton THICKNESS du toolbar mobile

**`src/components/plan/PlanEditor.tsx`**

États à supprimer :
- `editingThicknessEdge` + `setEditingThicknessEdge`
- `editThicknessEdgeValue` + `setEditThicknessEdgeValue`

Blocs à supprimer :
- Handler Escape : `setEditingThicknessEdge(null)` (ligne ~618)
- Bloc `if (tool === 'THICKNESS')` dans `handlePointerDown` (ligne ~629–644)
- Guards `if (tool === 'THICKNESS') return` (lignes ~879, ~940, ~1000, ~1058)
- Calcul `thicknessEdgeEditorScreen` (lignes ~1367–1372)
- `{editingThicknessEdge !== null && <DimensionEditor .../>}` (ligne ~1521)

**Note :** `editingPartitionThickness` + `editThicknessValue` + leur DimensionEditor sont eux aussi uniquement alimentés par le tool THICKNESS → supprimer également.

---

## Fichiers modifiés/créés

| Fichier | Changement |
|---|---|
| `src/components/plan/ToolStatusBar.tsx` | **Créé** — composant barre de statut |
| `src/components/plan/PlanToolbar.tsx` | Bouton `?` en tête · labels tutorial · suppression THICKNESS · type `PlanTool` mis à jour |
| `src/components/plan/PlanEditor.tsx` | Escape → SELECT · `tutorialMode` state · `?` key handler · intégration `ToolStatusBar` · suppression THICKNESS |

## Tests à couvrir

- `Escape` en mode WALL → outil passe à SELECT
- `Escape` en mode SELECT → reste SELECT
- Barre de statut affiche le bon texte selon l'outil
- Barre de statut invisible en mode SELECT
- Mode tutorial : bouton `?` toggle l'état
- Mode tutorial : touche `?` toggle l'état (hors focus input)
- Mode tutorial : `Escape` ferme le mode tutorial
- Type `PlanTool` ne contient plus `'THICKNESS'`

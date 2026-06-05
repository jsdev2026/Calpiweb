# CutGroupCard Compact & Legend Removal — Design Spec

## Goal

Réduire la hauteur des cartes de coupe de ~68 px à ~30–42 px pour limiter le scroll dans le panneau droit, et supprimer la légende redondante sous le plan annoté.

## Architecture

Deux fichiers touchés, changements indépendants :

- **`src/components/quantities/CutGroupCard.tsx`** — restructuration complète du rendu de la carte
- **`src/components/quantities/QuantityPlanView.tsx`** — suppression du bloc légende

---

## 1. QuantityPlanView — Suppression de la légende

Le bloc `{/* Legend */}` (div `.mt-2 flex flex-wrap...`) est supprimé entièrement. Le composant retourne uniquement le `<div className="flex flex-1 flex-col overflow-hidden">` avec le SVG à l'intérieur.

Aucune nouvelle logique. Aucun nouveau prop.

---

## 2. CutGroupCard — Nouvelle structure

### Structure HTML

La carte passe d'un `<div>` avec padding uniforme à un conteneur avec `overflow:hidden` (nécessaire pour la micro-ligne conditionnelle) et deux zones :

```
┌─[left-border]──────────────────────────────────────────┐
│ [badge] [thumb] [dimensions]  [chute]          [N nets] │  ← ligne principale
│ ↩ N taillée(s) dans une chute                           │  ← micro-ligne (si reuseCount > 0)
└─────────────────────────────────────────────────────────┘
```

**Conteneur outer :**
```tsx
<div
  className="rounded-md border border-gray-200 bg-white overflow-hidden transition-colors hover:bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
  style={{ borderLeftColor: groupColor, borderLeftWidth: 3 }}
  onMouseEnter={() => onHighlight(groupIndex + 1)}
  onMouseLeave={() => onHighlight(null)}
>
```

**Ligne principale :**
```tsx
<div className="flex items-center gap-1.5 px-2 py-1">
  {/* Badge */}
  {/* Thumbnail */}
  {/* Dimensions */}
  {/* Chute (flex:1) */}
  {/* N nets */}
</div>
```

**Micro-ligne conditionnelle :**
```tsx
{group.reuseCount > 0 && (
  <div className="border-t border-emerald-500/10 bg-emerald-500/5 py-0.5 text-[9px] font-semibold text-emerald-400"
       style={{ paddingLeft: '3.25rem' }}>
    ↩&nbsp;{group.reuseCount} taillée{group.reuseCount > 1 ? 's' : ''} dans une chute
  </div>
)}
```

Le `paddingLeft: '3.25rem'` (52 px) aligne le texte sous les dimensions : `px-2` (8 px) + badge (14 px) + gap (6 px) + thumbnail (~18 px) + gap (6 px) = 52 px.

### Détail des éléments — ligne principale

**Badge :**
```tsx
<span
  className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[8px] font-black"
  style={{
    background: `${groupColor}20`,
    color: groupColor,
    border: `1.5px solid ${groupColor}40`,
  }}
>
  {groupIndex + 1}
</span>
```

**Thumbnail :** `maxDim = 18` dans `TileThumbnail` (au lieu de 32). Tous les calculs internes restent identiques, seul `maxDim` change.

**Dimensions :**
```tsx
<span className="shrink-0 font-mono text-[11px] font-bold text-gray-900 dark:text-zinc-100">
  {formatCm(group.usedW)}×{formatCm(group.usedH)}
</span>
```

**Chute (zone centrale flex-1) :**
```tsx
<span className="flex-1 truncate text-[9px] text-gray-400 dark:text-zinc-500">
  {hasBigChute ? `Chute ${formatCm(group.chuteW)}×${formatCm(group.chuteH)}` : ''}
</span>
```

`hasBigChute` conserve la même logique : `group.chuteW > 20 && group.chuteH > 20`.

"Chute disponible" est remplacé par "Chute" (sans le mot "disponible").

**Nets (droite) :**
```tsx
<span className={`shrink-0 text-[11px] font-black tabular-nums ${group.reuseCount > 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-gray-900 dark:text-zinc-100'}`}>
  {group.netTiles}<span className="text-[8px] font-normal text-gray-400 dark:text-zinc-500">&nbsp;nets</span>
</span>
```

### Ce qui est supprimé

- L'ancien bloc `{hasBigChute && <div className="mt-0.5 text-[11px]...">Chute disponible…</div>}`
- L'ancien badge vert `{group.reuseCount > 0 && <div className="mt-1 inline-flex...">↩ N taillées dans une chute</div>}`
- Le bloc `{/* Qty block */}` séparé (remplacé par le count inline)

---

## Comportement

| État | Hauteur approx. |
|------|----------------|
| Sans chute, sans réutilisation | ~30 px |
| Avec chute, sans réutilisation | ~30 px |
| Avec réutilisation (micro-ligne) | ~42 px |

Le hover et le highlight (`onHighlight`) restent inchangés.

---

## Tests à mettre à jour

**`CutGroupCard.test.tsx`** — Les sélecteurs de texte changent :
- `"Chute disponible"` → introuvable ; la chute s'affiche maintenant sous la forme `"Chute 15 × 30"` (via `formatCm`)
- Le badge vert multilignes `"taillée dans une chute"` disparaît ; remplacé par la micro-ligne `"taillées dans une chute"` (texte identique, structure différente)
- Vérifier que la micro-ligne n'apparaît pas quand `reuseCount === 0`

**`QuantityPlanView.test.tsx`** — Vérifier que les éléments de légende (`"Carreau entier"`, `"Coupe 1"`, etc.) ne sont plus présents dans le DOM après suppression.

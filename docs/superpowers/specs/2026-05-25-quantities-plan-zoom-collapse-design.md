# Quantities Panel — Bandeaux repliables + Zoom/Pan du plan

## Goal

Améliorer la visualisation du plan de calepinage annoté dans la page quantitatif en (1) permettant de masquer les bandeaux supérieurs pour agrandir la zone de travail, et (2) en rendant le plan zoomable et déplaçable.

## Architecture

Deux évolutions indépendantes sur deux composants distincts :
- `QuantitiesPanel` — gestion du repli des bandeaux (état React + handler scroll)
- `QuantityPlanView` — zoom/pan SVG natif via manipulation de viewBox

Aucune librairie externe n'est ajoutée. Aucune modification du moteur de calcul (`quantityEngine`).

## Tech Stack

React 18, TypeScript, Tailwind CSS, SVG natif, événements DOM (wheel, mouse, touch)

---

## Feature 1 — Bandeaux auto-repliables

### Comportement

Les deux bandeaux supérieurs de `QuantitiesPanel` — le header (titre + méta) et la stat strip (4 cartes) — se replient automatiquement quand l'utilisateur scrolle vers le bas dans le panel des groupes de coupes (colonne droite, `overflow-y-auto`).

**Déclencheur :** `onScroll` sur la `div` coupes → `collapsed = scrollTop > 20`

**État replié :**
- Les deux bandeaux disparaissent via transition `max-height` (0.25s ease)
- Un bandeau résiduel de 32px reste visible contenant :
  - Le titre "Tableau des quantités" (tronqué, style discret)
  - Un bouton **▲ Afficher** qui ouvre manuellement
  - Une icône épingle 📌 (toggle pinned)

**Restauration automatique :** quand `scrollTop` revient à 0, `collapsed` repasse à `false` — sauf si `pinned = true`.

**Épingle 📌 :**
- Quand `pinned = true`, le repli automatique au scroll est désactivé
- Les bandeaux restent toujours visibles
- L'épingle est indépendante de `collapsed` : elle empêche la prochaine mise à jour de `collapsed` depuis le scroll
- Visuellement : icône colorée (orange accent) quand active, grise quand inactive

### État React (dans `QuantitiesPanel`)

```ts
const [collapsed, setCollapsed] = useState(false);
const [pinned, setPinned] = useState(false);
```

Handler scroll sur la div coupes :
```ts
const handleCoupesScroll = (e: React.UIEvent<HTMLDivElement>) => {
  if (pinned) return;
  setCollapsed(e.currentTarget.scrollTop > 20);
};
```

### Structure JSX

```
<div> <!-- wrapper bandeaux avec transition max-height -->
  <!-- Header (titre + méta) -->
  <!-- Stat strip (4 cartes) -->
</div>

<!-- Bandeau résiduel (toujours visible quand collapsed) -->
<div collapsed-bar>
  <span>Tableau des quantités</span>
  <button onClick={() => setCollapsed(false)}>▲ Afficher</button>
  <button onClick={() => setPinned(p => !p)}>📌</button>
</div>

<!-- Bandeau résiduel doit avoir un bouton épingle aussi quand non collapsed,
     intégré dans le header existant (icône discrète à droite du titre) -->
```

L'épingle est accessible dans les deux états (replié et déployé). Dans l'état déployé, elle apparaît en icône discrète dans le header. Dans l'état replié, dans le bandeau résiduel.

### Animation

```css
/* wrapper bandeaux */
transition: max-height 0.25s ease, opacity 0.2s ease;
max-height: collapsed ? 0 : 300px;
opacity: collapsed ? 0 : 1;
overflow: hidden;
```

### Tests

- Rendu initial : bandeaux visibles, bandeau résiduel absent
- Scroll coupes > 20px : `collapsed = true`, bandeaux masqués, bandeau résiduel visible
- Bouton "▲ Afficher" : `collapsed = false`
- Épingle active + scroll : `collapsed` ne change pas
- Scroll retour à 0 (sans épingle) : `collapsed = false`

---

## Feature 2 — Zoom et déplacement du plan SVG

### Comportement

Le SVG du plan de calepinage annoté dans `QuantityPlanView` devient interactif :

| Interaction | Effet |
|---|---|
| Molette souris | Zoom centré sur le curseur |
| Drag souris (bouton gauche) | Panoramique |
| Pinch (2 doigts mobile) | Zoom |
| Drag 1 doigt mobile | Panoramique |
| Bouton ⊙ Ajuster | Reset viewBox à la valeur initiale |

### Approche technique — Manipulation du viewBox

Au lieu de CSS transform, on recalcule le `viewBox` SVG dynamiquement. Cela reste dans le système de coordonnées SVG et évite toute conversion pixel↔SVG complexe.

**État interne dans `QuantityPlanView` :**
```ts
const [vb, setVb] = useState({ x: vbX, y: vbY, w: vbW, h: vbH });
const isDirty = vb.x !== vbX || vb.y !== vbY || vb.w !== vbW || vb.h !== vbH;
```

**Zoom centré sur le curseur (wheel) :**
```ts
// factor = 0.9 (zoom in) ou 1.1 (zoom out), selon e.deltaY
const rect = svgRef.current.getBoundingClientRect();
const mx = e.clientX - rect.left; // position souris en px dans le container
const my = e.clientY - rect.top;
// point SVG sous le curseur
const svgMx = vb.x + mx * (vb.w / rect.width);
const svgMy = vb.y + my * (vb.h / rect.height);
// nouveau viewBox en gardant ce point fixe
const newW = vb.w * factor;
const newH = vb.h * factor;
const newX = svgMx - mx * (newW / rect.width);
const newY = svgMy - my * (newH / rect.height);
setVb({ x: newX, y: newY, w: newW, h: newH });
```

Limites de zoom : `w` clampé entre `originalW * 0.1` (zoom max ×10) et `originalW * 5` (dézoom max ×0.2).

**Panoramique (drag) :**
```ts
// Sur mousedown : mémoriser position de départ
// Sur mousemove (si dragging) :
const dx = e.movementX * (vb.w / rect.width);
const dy = e.movementY * (vb.h / rect.height);
setVb(v => ({ ...v, x: v.x - dx, y: v.y - dy }));
```

**Touch pinch :**
- `onTouchStart` : mémoriser distance entre 2 points → `startDist`, `startVb`
- `onTouchMove` : calculer nouvelle distance → `factor = startDist / newDist` → appliquer même formule que wheel, centrée sur le midpoint des 2 doigts

**Touch drag (1 doigt) :**
- `onTouchMove` avec 1 point : même logique que drag souris via `touch.clientX - prevTouch.clientX`

**Bouton ⊙ Ajuster :**
- `onClick={() => setVb({ x: vbX, y: vbY, w: vbW, h: vbH })}`
- Affiché uniquement si `isDirty` (zoom/pan actif)
- Position : overlay `absolute bottom-3 right-3` dans la zone plan
- Style : petit bouton discret `bg-white/80 border rounded px-2 py-1 text-xs`

**Curseur :** `cursor-grab` sur le wrapper, `cursor-grabbing` pendant le drag (classe conditionnelle).

**Prévenir le scroll page sur wheel :** `e.preventDefault()` dans le handler wheel (nécessite `{ passive: false }` via `useEffect` + `addEventListener`).

### Ref SVG

```ts
const svgRef = useRef<SVGSVGElement>(null);
```

Le SVG reçoit le `ref` et les gestionnaires d'événements mouse/touch. Le wheel est attaché via `useEffect` (passive: false).

### Tests

- Rendu : SVG présent avec viewBox initial correct
- Wheel event : viewBox modifié (w/h changent)
- Reset : clic ⊙ → viewBox revient à la valeur initiale
- Bouton ⊙ absent initialement, présent après un wheel event
- Clamp : zoom max/min respecté (w ne dépasse pas les limites)

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/components/quantities/QuantitiesPanel.tsx` | Ajout état `collapsed`/`pinned`, handler scroll, bandeau résiduel, icône épingle |
| `src/components/quantities/QuantityPlanView.tsx` | Ajout état `vb`, handlers wheel/mouse/touch, bouton ⊙, ref SVG |
| `src/components/quantities/QuantitiesPanel.test.tsx` | Tests repli/épingle |
| `src/components/quantities/QuantityPlanView.test.tsx` | Tests zoom/pan/reset |

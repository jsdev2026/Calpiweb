# Fix jointure en onglet — angles aigus wallGeometry

**Date :** 2026-06-03
**Fichier cible :** `src/engine/geometry/wallGeometry.ts`

---

## Problème

`computeCornerGeometry` calcule un seul paramètre `t` via `jointParam` et l'applique avec le même signe aux deux coins de la tranche d'extrémité d'un mur. Cela produit une tranche **perpendiculaire** (cap rectangulaire) au lieu d'une **coupe diagonale** (onglet). Aux angles aigus, les deux rectangles s'étendent massivement au-delà du nœud et se superposent.

### Ce que `jointParam` calcule

`t` est le paramètre tel que :

```
P + nA*hA + t*dA  =  P + nB*hB + s*dB
```

Soit l'intersection du **bord +n de A** avec le **bord +n de B** — le coin intérieur (concave) de la jointure.

Par symétrie (inversion des normales), le coin extérieur (convexe, la pointe vive) utilise **−t**.

### Bug exact

| Coin | Côté | Extension correcte | Extension actuelle |
|------|------|--------------------|-------------------|
| `pts[1]` node2 +n (intérieur) | concave | `p2 + dir * t` | `p2 + dir * (−t)` ← **mauvais signe** |
| `pts[2]` node2 −n (extérieur) | convexe | `p2 − dir * t` | `p2 + dir * (−t)` = `p2 − dir * t` ✓ |
| `pts[0]` node1 +n (intérieur) | concave | `p1 + dir * t` | `p1 − dir * t` ← **mauvais signe** |
| `pts[3]` node1 −n (extérieur) | convexe | `p1 − dir * t` | `p1 − dir * t` ✓ |

---

## Solution

Inverser le signe du composant `dir` pour les deux coins intérieurs (+n) dans `computeCornerGeometry`.

### Changement minimal — 2 signes dans le tableau `points`

**Avant :**
```typescript
{ x: p1.x - dir.x * extN1 + n.x * h, y: p1.y - dir.y * extN1 + n.y * h },  // pts[0]
{ x: p2.x + dir.x * extN2 + n.x * h, y: p2.y + dir.y * extN2 + n.y * h },  // pts[1]
{ x: p2.x + dir.x * extN2 - n.x * h, y: p2.y + dir.y * extN2 - n.y * h },  // pts[2] ✓
{ x: p1.x - dir.x * extN1 - n.x * h, y: p1.y - dir.y * extN1 - n.y * h },  // pts[3] ✓
```

**Après :**
```typescript
{ x: p1.x + dir.x * extN1 + n.x * h, y: p1.y + dir.y * extN1 + n.y * h },  // pts[0] ← signe dir inversé
{ x: p2.x - dir.x * extN2 + n.x * h, y: p2.y - dir.y * extN2 + n.y * h },  // pts[1] ← signe dir inversé
{ x: p2.x + dir.x * extN2 - n.x * h, y: p2.y + dir.y * extN2 - n.y * h },  // pts[2] inchangé
{ x: p1.x - dir.x * extN1 - n.x * h, y: p1.y - dir.y * extN1 - n.y * h },  // pts[3] inchangé
```

*(Rappel : `extN1 = t` et `extN2 = −t` avec `t` = résultat de `jointParam`. Donc `+dir*extN1 = +dir*t` et `−dir*extN2 = +dir*t` : les deux coins intérieurs utilisent désormais `+t`.)*

---

## Résultat visuel attendu

Pour deux murs formant un angle intérieur de α :

| Coin | Position |
|------|----------|
| **Pointe vive** (coin extérieur convexe) | `P + dir * |t| + (−n) * h` — au-delà de P, les deux bords extérieurs se rejoignent ici |
| **Coin intérieur** (concave) | `P − dir * |t| + n * h` — en deçà de P, les deux bords intérieurs se rejoignent ici |

Les deux murs partagent **exactement le même cap diagonal** — zéro superposition.  
La ligne de joint (`computeJointLines`) utilise déjà `±t` correctement ; elle sera naturellement alignée avec le cap.

---

## Tests à mettre à jour

`src/engine/geometry/wallGeometry.test.ts`

### `two walls at 90°`
- `pts[1]` : `(105, 5)` → `(95, 5)` (coin intérieur, en retrait de P)
- `pts[2]` : `(105, −5)` reste ✓ (coin extérieur, déjà correct)
- `pts[0]` de w2 : `(95, −5)` → `(95, 5)` (coin intérieur de w2)

### `45° corner`
- `extX = pts[1].x − 100` était > 0 (extension positive côté mauvais) → devient **< 0** (coin en retrait avant P)

### `120° corner`
- `extX` devra être **< −5** (côté intérieur en retrait de plus d'un demi-épaisseur)

> Les tests `computeJointLines` ne changent pas (déjà corrects).

---

## Hors périmètre

- Miter limit (seuil d'angle minimum) : non requis selon les exigences — la pointe vive est souhaitée même pour les angles très aigus.
- Union de polygones : non retenu (complexité inutile pour ce cas).
- Orientation de la direction du voisin (bug secondaire potentiel si `node2` du voisin est au nœud de jonction) : à adresser séparément si observé.

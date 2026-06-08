# Cloison — Détection de pièce et cotation — Design Spec

## Problème

Un mur tracé en cloison (mur libre, non fermé) provoque deux bugs :

1. **La pièce disparaît** quand la cloison est connectée à un nœud d'un mur de pièce (jonction en T). L'algorithme half-edge suit l'impasse de la cloison, marque les demi-arêtes comme visitées et ne peut plus compléter le cycle de pièce.

2. **La cotation est fausse** pour une cloison avec un bout connecté : la mesure actuelle va de nœud à nœud (centre d'axe), alors qu'elle doit aller de la **face intérieure** du mur de connexion jusqu'à l'extrémité libre.

---

## Section 1 — Détection de pièces : leaf-pruning

### Algorithme

Avant la traversée half-edge dans `wallFaceCycles`, ajouter une passe de nettoyage :

```
répéter :
  calculer le degré de chaque nœud (nb de murs non-isDoor connectés)
  retirer les murs dont l'un des bouts est de degré 1
jusqu'à ce qu'aucun nœud de degré 1 ne subsiste
```

La traversée half-edge tourne ensuite sur le graphe nettoyé. Les murs élagués (cloisons) sont ignorés pour la détection de pièces.

### Périmètre

- Modifié : `src/engine/geometry/wallFaces.ts` — fonction `wallFaceCycles`
- Aucun changement d'interface — tous les appelants (`wallsToRooms`, `computeAutoCotations`) bénéficient du fix automatiquement
- Les murs `isDoor` sont exclus du calcul de degré (ils n'affectent pas la topologie des pièces)

### Cas traités

| Configuration | Avant | Après |
|---|---|---|
| Cloison libre (2 bouts libres) | Pièce OK | Pièce OK |
| Cloison connectée en T (1 bout libre) | Pièce disparaît | Pièce détectée |
| Cloison connectée aux 2 bouts (pont) | Peut créer une pièce | Pièce détectée si cycle fermé |
| Pièce simple sans cloison | Pièce OK | Pièce OK (inchangé) |

---

## Section 2 — Cotation des cloisons

### Détection des cloisons

Dans `computeAutoCotations`, calculer les degrés sur l'ensemble des murs (même algorithme que le leaf-pruning). Un mur est une cloison si au moins l'un de ses deux nœuds a degré 1.

### Cas 1 — Un bout connecté, un bout libre

```
nodeLibre    = nœud de degré 1
nodeConnecté = nœud de degré ≥ 2
dir          = normalize(nodeLibre.pos − nodeConnecté.pos)

mursAdj      = murs connectés à nodeConnecté, hors cloison elle-même
tAdj         = moyenne des épaisseurs de mursAdj  (ou 0 si aucun)

anchor1      = nodeConnecté.pos + (tAdj / 2) × dir   ← face intérieure du mur de connexion
anchor2      = nodeLibre.pos                          ← extrémité libre
label        = dist(anchor1, anchor2)
```

### Cas 2 — Deux bouts libres

```
anchor1 = node1.pos
anchor2 = node2.pos
label   = dist(anchor1, anchor2)
```
Comportement identique à l'actuel — aucun changement.

### Affichage

- `side: 'isolated'` dans les deux cas (couleur orange existante)
- Normale : perpendiculaire à l'axe de la cloison (identique à l'actuel)
- Offset : `COTE_OFFSET_ISO = 50 mm`
- La cotation s'affiche des deux côtés possibles (les deux normales ±) — **non**, une seule normale est choisie (la gauche, `{ x: -dir.y, y: dir.x }`), identique au comportement actuel

---

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/engine/geometry/wallFaces.ts` | Ajouter leaf-pruning dans `wallFaceCycles` |
| `src/engine/geometry/wallCotation.ts` | Remplacer la boucle "murs isolés" par la logique cloison Cas 1 / Cas 2 |
| `src/engine/geometry/wallFaces.test.ts` | Tests : cloison en T ne supprime pas la pièce |
| `src/engine/geometry/wallCotation.test.ts` | Tests : Cas 1 anchor ajusté, Cas 2 inchangé |

---

## Hors périmètre

- Cloisons avec épaisseur variable aux deux bouts connectés (miter complexe)
- Affichage de la cloison comme élément sélectionnable distinct
- Snap ou contraintes spécifiques aux cloisons

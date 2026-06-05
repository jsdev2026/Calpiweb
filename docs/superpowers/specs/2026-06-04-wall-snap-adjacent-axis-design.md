# Snap axes adjacents — drag nœud

**Date :** 2026-06-04

## Problème

Pendant le drag d'un nœud N connecté aux murs N-A et N-B, l'intersection qui valide simultanément l'horizontalité de N-A ET la verticalité de N-B (point (B.x, A.y)) n'est pas détectée de façon fiable par le snap H/V général.

## Solution

Nouvelle fonction `adjacentAxisSnapForNode(cursor, adjacentNodes, scale, hvSnapPx)` dans `wallSnap.ts` :
- Cherche bestH parmi les Y des nœuds adjacents (A, B, …)
- Cherche bestV parmi les X des nœuds adjacents
- Si les deux → retourne intersection {x: bestV.x, y: bestH.y}
- Sinon → retourne single-axis ou null

Dans le drag, priorité juste après endpoint snap. Le cas intersection prend le dessus sur Thales.

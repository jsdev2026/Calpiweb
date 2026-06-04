# Snap intersection H/V — wallSnap

**Date :** 2026-06-04
**Fichier principal :** `src/engine/geometry/wallSnap.ts`

## Problème

Le snap H/V compare H et V dans une même boucle et retourne le seul gagnant (plus faible distance). Quand le curseur est simultanément dans le rayon H d'un nœud A et dans le rayon V d'un nœud B, les deux snaps alternent. Le point d'intersection (B.x, A.y) n'est jamais calculé.

## Solution

Séparer la collecte des candidats H et V, puis retourner leur intersection si les deux sont actifs.

```typescript
// Avant
for (const n of nodes) {
  if (dy < bestHvDist) { bestHvDist = dy; bestHv = { ..., axis: 'h' }; }
  if (dx < bestHvDist) { bestHvDist = dx; bestHv = { ..., axis: 'v' }; }
}
return bestHv;

// Après
let bestH: { y: number; dist: number } | null = null;
let bestV: { x: number; dist: number } | null = null;
for (const n of nodes) {
  if (dy < hvR && (!bestH || dy < bestH.dist)) bestH = { y: n.y, dist: dy };
  if (dx < hvR && (!bestV || dx < bestV.dist)) bestV = { x: n.x, dist: dx };
}
if (bestH && bestV) return { point: { x: bestV.x, y: bestH.y }, type: 'hv' }; // intersection
if (bestH) return { point: { x: cursor.x, y: bestH.y }, type: 'hv', axis: 'h' };
if (bestV) return { point: { x: bestV.x, y: cursor.y }, type: 'hv', axis: 'v' };
```

## Indicateur visuel

Quand `snapResult.type === 'hv' && !snapResult.axis` (intersection) : afficher les **deux** lignes guides (H + V) formant une croix au point de snap.

## Fichiers

| Fichier | Changement |
|---------|-----------|
| `src/engine/geometry/wallSnap.ts` | Refactorer le bloc H/V |
| `src/engine/geometry/wallSnap.test.ts` | Ajouter 3 tests intersection |
| `src/components/plan/WallDrawingCanvas.tsx` | Afficher les 2 lignes en mode intersection |

# Contribuer à TileLayout Pro

## Règles d'or

### 1. Unités — millimètres entiers partout

Toutes les données métier (positions, dimensions, aires) sont stockées en **mm entiers**.

- ✅ `const width = 600;` (600 mm = 60 cm)
- ❌ `const width = 60; // cm`
- ❌ `const width = 0.6; // m`

Les conversions se font **uniquement** dans :

- `src/utils/units.ts` — mm ↔ cm, mm² ↔ m², world ↔ screen
- `src/utils/formatters.ts` — formatage pour affichage

Si vous avez besoin d'une nouvelle conversion, ajoutez-la à `units.ts` — pas ailleurs.

### 2. `src/engine/` — pur TypeScript

Le moteur métier ne doit **jamais** :

- Importer React, un hook, ou un composant
- Toucher au DOM (`document`, `window`)
- Dépendre de Next.js, Zustand, ou de la couche de persistance

Il doit être exécutable dans un Node pur (c'est ce que vérifient les tests Vitest) et, à terme, dans un Web Worker.

### 3. Règles métier centralisées

Les constantes métier (tolérance de snap, marge de commande, seuil d'alerte, etc.) vivent dans `src/constants/businessRules.ts`. Ne pas les redéfinir ailleurs.

### 4. Composants : un dossier par feature

```
src/components/
├── plan/      → éditeur de plan 2D
├── tiling/    → éditeur de calepinage
├── results/   → panneau de résultats
├── home/      → page d'accueil
└── ui/        → primitives réutilisables (Button, Input, …)
```

Un composant client doit commencer par `'use client';`.

### 5. Tests

- Chaque nouveau module de `engine/` ou `utils/` doit avoir un fichier `*.test.ts` à côté.
- Les tests Vitest tournent en Node — pas d'API DOM dans le moteur.
- Pour les composants, utiliser React Testing Library (jsdom).

## Workflow

1. Partir d'une branche : `git checkout -b feat/ma-feature`
2. Développer + tester en local (`npm run test:watch`)
3. Avant push : `npm run typecheck && npm run lint && npm run test && npm run build`
4. Ouvrir une PR — la CI exécute ces mêmes checks

## Ajouter une amélioration

Le fichier `README.md` liste les améliorations planifiées. Pour en prendre une :

1. Créer une issue décrivant l'approche (si besoin de discussion)
2. Développer sur une branche dédiée
3. Cocher la ligne dans le `README.md` dans le même commit que l'implémentation

## Conventions de nommage

- Composants React : `PascalCase.tsx`
- Hooks : `useCamelCase.ts`
- Utilitaires et modules : `camelCase.ts`
- Types : interface `PascalCase`, exportés depuis `src/types/`

## Commit messages

Pas de format imposé, mais préférer des messages descriptifs du **pourquoi** :

- ✅ `fix(engine): correct stagger modulo for 1/3 offset`
- ❌ `update tilingEngine.ts`

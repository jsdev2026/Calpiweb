# TileLayout Pro

Application web de calepinage carrelage destinée aux professionnels du bâtiment. 100% client (IndexedDB), pensée pour desktop et tablette.

## Démarrage

```bash
npm install
npm run dev
```

L'app est disponible sur [http://localhost:3000](http://localhost:3000).

## Scripts

| Commande                | Rôle                                     |
| ----------------------- | ---------------------------------------- |
| `npm run dev`           | Serveur de développement Next.js         |
| `npm run build`         | Build de production                      |
| `npm run start`         | Sert le build de production              |
| `npm run lint`          | ESLint                                   |
| `npm run format`        | Formate le code avec Prettier            |
| `npm run format:check`  | Vérifie le formatage                     |
| `npm run typecheck`     | `tsc --noEmit` (TypeScript strict)       |
| `npm run test`          | Vitest — tests du moteur + utils         |
| `npm run test:watch`    | Vitest en watch                          |
| `npm run test:coverage` | Couverture v8                            |

## Stack

- **Framework** : Next.js 14 (App Router)
- **Langage** : TypeScript strict
- **Rendu** : SVG (⚠️ migration Konva prévue — voir [Améliorations](#améliorations-planifiées))
- **State** : Zustand
- **UI** : Tailwind CSS + composants `components/ui/` (socle pour shadcn/ui)
- **Persistance locale** : IndexedDB via `idb`
- **Tests** : Vitest + React Testing Library

## Architecture

```
src/
├── app/                      # Next.js App Router
│   ├── page.tsx              # Accueil — liste des projets
│   ├── layout.tsx
│   └── project/[id]/page.tsx # Workspace (stepper Plan / Calepinage)
├── components/
│   ├── plan/                 # Éditeur de plan 2D (SVG)
│   ├── tiling/               # Éditeur de calepinage
│   ├── results/              # Panneau de résultats
│   ├── home/                 # Cartes et liste de projets
│   └── ui/                   # Primitives UI (Button, Input, StepIndicator)
├── engine/                   # Moteur métier — pur TypeScript, pas de React
│   ├── geometry/             # polygon / grid / clipping
│   ├── tiling/               # tilingEngine, offsetCalculator, cutCalculator
│   └── export/               # Stub pour export PDF/DXF
├── store/                    # Stores Zustand
├── lib/                      # db (IndexedDB), cn
├── types/                    # Interfaces Project / Plan / Tiling
├── utils/                    # units, formatters, id
└── constants/                # tileDefaults, businessRules
```

## Principes

1. **Unités** : toutes les valeurs métier sont en **millimètres entiers**. La conversion mm ↔ cm ↔ px se fait uniquement dans `src/utils/units.ts` et `src/utils/formatters.ts`.
2. **Moteur découplé** : `src/engine/` n'importe **jamais** React ni le DOM. Il est 100% testable en Node pur.
3. **Pas de backend** : toute la persistance est locale (IndexedDB). L'app fonctionne hors ligne par défaut.
4. **Règles métier** centralisées dans `src/constants/businessRules.ts`.

## Améliorations planifiées

Liste des améliorations volontairement non faites lors de la mise en structure initiale — voir [CONTRIBUTING.md](./CONTRIBUTING.md) pour le workflow.

- [ ] Migration du rendu SVG vers **Konva.js + react-konva** (perf sur gros calepinages)
- [ ] Déplacer le moteur de calepinage dans un **Web Worker**
- [ ] Split du store unique en `planStore` / `tilingStore` (séparation des responsabilités)
- [ ] Export PDF / DXF (implémenter `engine/export/exportAdapter.ts`)
- [ ] **Corriger** le bug de stagger pour `stagger = 0.333` (modulo mal calculé)
- [ ] Centrage automatique ("Centrer") et alignement sur mur ("Aligner sur mur")
- [ ] Alerte chutes < ½ carreau en périphérie
- [ ] Support complet **Undo / Redo** (historique dans le store)
- [ ] PWA via `next-pwa` (installation tablette, offline-first)
- [ ] Intégration **shadcn/ui** en remplacement des primitives custom
- [ ] Tests composants (React Testing Library) sur PlanEditor et TilingEditor
- [ ] Dupliquer / renommer un projet depuis l'accueil

## Qualité

La CI GitHub Actions exécute sur chaque PR :

- `typecheck` (TypeScript strict)
- `lint` (ESLint)
- `format:check` (Prettier)
- `test` (Vitest — moteur géométrique et formatters)
- `build` (Next.js)

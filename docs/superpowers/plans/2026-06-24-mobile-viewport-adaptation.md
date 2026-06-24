# Mobile Viewport Adaptation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Empêcher la toolbar de dessin mobile d'être masquée par la barre du navigateur Safari iOS (et équivalents), en deux changements CSS ciblés.

**Architecture:** Remplacer `h-screen` (100vh) par `h-screen` + `style={{ height: '100svh' }}` sur le conteneur racine pour utiliser le viewport réduit en présence de chrome navigateur. Changer `absolute` en `fixed` sur la toolbar mobile pour l'ancrer au viewport visible plutôt qu'au conteneur CSS.

**Tech Stack:** Next.js 14 (App Router), React 18, Tailwind CSS v3, Vitest + Testing Library

---

## Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `src/components/plan/PlanToolbar.tsx` | Toolbar mobile — changer `absolute` → `fixed` |
| `src/components/plan/PlanToolbar.test.tsx` | Ajouter assertion sur la classe `fixed` |
| `src/app/project/[id]/page.tsx` | Conteneur racine — ajouter `style={{ height: '100svh' }}` |

---

## Task 1 : PlanToolbar — `absolute` → `fixed`

**Files:**
- Modify: `src/components/plan/PlanToolbar.tsx:128`
- Test: `src/components/plan/PlanToolbar.test.tsx:80-107`

### Contexte

Le div `data-testid="plan-toolbar-mobile"` est actuellement `absolute bottom-0`. En Safari iOS, quand la barre du navigateur est visible en bas, `position: absolute` positionne la toolbar relativement au conteneur CSS — qui peut dépasser la zone visible. Avec `position: fixed`, la toolbar s'ancre au viewport visible du navigateur, indépendamment de la hauteur du conteneur parent.

- [ ] **Step 1 : Écrire le test qui doit échouer**

Dans `src/components/plan/PlanToolbar.test.tsx`, dans le describe `'PlanToolbar mobile — deux lignes'` (à la suite des 4 tests existants, avant la dernière accolade `}`), ajouter :

```tsx
  it('toolbar mobile a la classe fixed (pas absolute)', () => {
    render(<PlanToolbar {...defaultProps} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    expect(toolbar.className).toContain('fixed');
    expect(toolbar.className).not.toContain('absolute');
  });
```

- [ ] **Step 2 : Vérifier que le test échoue**

```bash
npx vitest run src/components/plan/PlanToolbar.test.tsx
```

Résultat attendu : FAIL sur `toolbar mobile a la classe fixed (pas absolute)` — le className contient `absolute` pas `fixed`.

- [ ] **Step 3 : Appliquer le changement dans PlanToolbar.tsx**

Dans `src/components/plan/PlanToolbar.tsx`, trouver le div `data-testid="plan-toolbar-mobile"` (ligne ~128) :

```tsx
// AVANT
<div
  data-testid="plan-toolbar-mobile"
  className="absolute bottom-0 left-0 right-0 z-20 flex flex-col md:hidden mouse:hidden border-t border-gray-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md"
>
```

Remplacer `absolute` par `fixed` :

```tsx
// APRÈS
<div
  data-testid="plan-toolbar-mobile"
  className="fixed bottom-0 left-0 right-0 z-20 flex flex-col md:hidden mouse:hidden border-t border-gray-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md"
>
```

Un seul mot change. Tout le reste (`bottom-0`, `left-0`, `right-0`, `z-20`, padding safe-area dans les lignes intérieures) est inchangé.

- [ ] **Step 4 : Vérifier que tous les tests passent**

```bash
npx vitest run src/components/plan/PlanToolbar.test.tsx
```

Résultat attendu : 11/11 PASS (10 tests existants + le nouveau).

- [ ] **Step 5 : Lancer la suite complète**

```bash
npx vitest run
```

Résultat attendu : tous les tests passent.

- [ ] **Step 6 : Committer**

```bash
git add src/components/plan/PlanToolbar.tsx src/components/plan/PlanToolbar.test.tsx
git commit -m "fix(mobile): toolbar position fixed — reste visible sous la barre Safari"
```

---

## Task 2 : Root container — `100svh`

**Files:**
- Modify: `src/app/project/[id]/page.tsx:340`

### Contexte

Le conteneur racine de la page workspace utilise `h-screen` (= `100vh`). Sur Safari iOS, `100vh` représente la hauteur avec la barre du navigateur **cachée** — une valeur trop grande quand la barre est visible. `100svh` (Small Viewport Height) représente la hauteur avec la barre **visible**, ce qui garantit que le layout entier reste dans la zone visible.

La stratégie progressive : garder `h-screen` (fallback CSS, navigateurs anciens) et ajouter un `style` inline `height: '100svh'` (prioritaire en cascade CSS si `svh` est supporté, ignoré sinon).

Il n'existe pas de test unitaire pour `WorkspacePage` (dépendances complexes : stores Zustand, Next.js router, auth). La vérification se fait par les tests de rendu existants + contrôle manuel en DevTools.

- [ ] **Step 1 : Localiser la ligne cible dans page.tsx**

Dans `src/app/project/[id]/page.tsx`, trouver le `return` principal (~ligne 340) :

```tsx
<div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--bg)' }}>
```

- [ ] **Step 2 : Ajouter `height: '100svh'` au style inline**

```tsx
<div className="flex h-screen flex-col overflow-hidden" style={{ background: 'var(--bg)', height: '100svh' }}>
```

`height: '100svh'` s'ajoute à l'objet `style` existant. La classe `h-screen` reste (fallback pour navigateurs sans support `svh`). Les navigateurs modernes (Chrome 108+, Safari 16+, Firefox 101+) utilisent le `style` inline en priorité ; les anciens l'ignorent et gardent `100vh`.

- [ ] **Step 3 : Lancer la suite complète**

```bash
npx vitest run
```

Résultat attendu : tous les tests passent (aucun test existant ne vérifie le `style` de la page racine).

- [ ] **Step 4 : Vérification manuelle en DevTools**

Ouvrir Chrome DevTools → onglet Responsive → choisir "iPhone 14" ou "Galaxy S21". Basculer "Show device frame" si disponible. L'interface doit s'afficher sans débordement vertical visible. Sur Safari iOS (ou simulateur), vérifier que la toolbar de dessin reste au-dessus de la barre Safari.

- [ ] **Step 5 : Committer**

```bash
git add src/app/project/[id]/page.tsx
git commit -m "fix(mobile): hauteur conteneur racine 100svh — viewport avec chrome navigateur"
```

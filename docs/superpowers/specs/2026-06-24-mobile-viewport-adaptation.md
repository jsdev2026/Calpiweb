# Mobile Viewport Adaptation — Design Spec

**Date:** 2026-06-24
**Status:** Approved

## Problème

Sur mobile, le layout utilise `h-screen` (= `100vh`). Sur Safari iOS, `100vh` correspond à la hauteur du viewport lorsque la barre du navigateur est **cachée** — sa valeur maximale. Quand la barre Safari est **visible** (cas nominal), elle empiète sur le bas du layout. La toolbar de dessin (`absolute bottom-0`) se retrouve partiellement ou totalement masquée.

Scénarios affectés :
- **Safari iOS** (barre en bas, iOS 15+) : toolbar masquée sous la barre Safari
- **Chrome Android récent** (barre bas) : même problème via `100vh` trop grand
- **Autres navigateurs** : pas d'impact visible, mais `100vh` légèrement inexact

## Solution retenue (Approche A)

Deux changements CSS ciblés, aucun changement visuel :

### 1. Hauteur du conteneur racine : `100svh` avec fallback `100vh`

`svh` (Small Viewport Height) = hauteur du viewport lorsque le chrome du navigateur est **entièrement visible** — la valeur la plus petite, garantissant que le contenu reste dans la zone visible.

```
Anciens navigateurs  : height: 100vh   (inchangé, comportement actuel)
Navigateurs modernes : height: 100svh  (exact — hors barre navigateur)
```

Support : Chrome 108+, Safari 16+, Firefox 101+ (>95 % des appareils mobiles actifs en 2026).

### 2. Position de la toolbar mobile : `fixed` au lieu de `absolute`

`position: fixed` ancre l'élément au **viewport visible** (`window.visualViewport`), pas au conteneur CSS. Sur Safari iOS, quand la barre du navigateur est visible, un élément `fixed bottom-0` se positionne automatiquement au-dessus d'elle.

La combinaison des deux garantit le comportement correct même sur les navigateurs qui ne supportent pas `svh` : la toolbar `fixed` s'ancre toujours au viewport visible, indépendamment de `100vh` vs `100svh`.

## Architecture

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `src/app/project/[id]/page.tsx` | Ajouter `style={{ height: '100svh' }}` sur le div racine |
| `src/components/plan/PlanToolbar.tsx` | `absolute` → `fixed` sur le bloc mobile |

### Détail — page.tsx

Ligne concernée : `<div className="flex h-screen flex-col overflow-hidden">`.

Ajouter `style={{ height: '100svh' }}` en complément de la classe `h-screen` (qui reste comme fallback CSS — les navigateurs modernes appliquent l'inline style en priorité, les anciens ignorent `100svh` et conservent `100vh` via la classe).

```tsx
<div
  className="flex h-screen flex-col overflow-hidden"
  style={{ height: '100svh' }}
  ...
>
```

### Détail — PlanToolbar.tsx

Ligne concernée : le div `data-testid="plan-toolbar-mobile"`.

Remplacer `absolute` par `fixed` dans la className. Tous les autres attributs (`bottom-0 left-0 right-0 z-20`, padding safe-area) restent inchangés.

```tsx
<div
  data-testid="plan-toolbar-mobile"
  className="fixed bottom-0 left-0 right-0 z-20 flex flex-col md:hidden mouse:hidden ..."
>
```

## Ce qui ne change pas

- Apparence visuelle : identique sur tous les appareils
- Desktop/tablet : la modification `h-screen + style` affecte le layout, mais le résultat est équivalent — `100svh` ≈ `100vh` sur desktop (pas de barre navigateur mobile)
- La toolbar desktop (panneau vertical `left-4 top-4`) : inchangée, pas de `fixed`
- `max(env(safe-area-inset-bottom), 8px)` sur la ligne 2 de la toolbar mobile : inchangé (gère le home indicator iOS)
- WallRoomPanel : inchangé

## Hors périmètre

- `env(safe-area-inset-top)` sur le header : non nécessaire en mode navigateur (non PWA) — le navigateur gère automatiquement la zone sûre en haut
- Adaptation du header pour l'économiser de la hauteur verticale : non demandé
- Mode paysage (landscape) safe-area-inset-left/right : non demandé
- PWA / standalone mode : non demandé

## Tests

- Le test existant `data-testid="plan-toolbar-mobile"` doit rester fonctionnel (le testid est conservé)
- Vérifier que la classe `fixed` est présente (au lieu de `absolute`) dans le test PlanToolbar
- Vérification manuelle sur Safari iOS ou DevTools mode mobile avec barre du navigateur simulée

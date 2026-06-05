# Upgrade Modal — Design Spec

## Goal

When a free-plan user clicks "Nouveau projet" while already at the 1-project limit, show an upgrade modal instead of the creation form. The modal explains the Pro offer and links to `/account`.

## Architecture

**New file:** `src/components/home/UpgradeModal.tsx`
A self-contained modal component, controlled by a `showUpgradeModal` boolean state in `src/app/dashboard/page.tsx`.

**Modified file:** `src/app/dashboard/page.tsx`
- Add `showUpgradeModal` state (default `false`).
- Replace the "Nouveau projet" click handler logic:
  ```ts
  if (user?.plan === 'free' && projects.length >= 1) {
    setShowUpgradeModal(true);
  } else {
    setShowNewModal(true);
  }
  ```
- Render `<UpgradeModal>` conditionally when `showUpgradeModal === true`.

The existing upsell banner (`user.plan === 'free' && projects.length >= 1`) stays on the dashboard — it serves as a persistent reminder. The modal adds friction at the moment of intent.

## UpgradeModal component

**Props:**
```ts
interface UpgradeModalProps {
  onClose: () => void;
}
```

**Layout (overlay modal):**
- Full-screen semi-transparent backdrop (`rgba(0,0,0,0.45)`), `z-50`
- Centered card, max-width `400px`, background `var(--surf)`, rounded-2xl, shadow
- Close button (×) top-right corner

**Content:**
- Title: "Passez au plan Pro" (`var(--font-display)`, 20px bold)
- Subtitle: "Vous avez atteint la limite du plan gratuit (1 projet)."
- Feature list (3 items with checkmark icons):
  - Projets illimités
  - Sauvegarde cloud automatique
  - Accès depuis tous vos appareils
- Price line: "9 €/mois — annulation à tout moment"
- Primary CTA button: "Voir les offres Pro →" → `router.push('/account')` then `onClose()`
- Secondary link: "Continuer avec le plan gratuit" → `onClose()`

**Behavior:**
- Clicking the backdrop closes the modal (`onClose()`).
- Escape key closes the modal.
- `router` from `useRouter()` inside the component.

## Trigger points

The modal is triggered only from the "Nouveau projet" button in `dashboard/page.tsx`. No other entry points for now. The check is client-side: `user?.plan === 'free' && projects.length >= 1`.

The `PROJECT_LIMIT_REACHED` error path in `handleCreate` remains as a safety net (the store still enforces the limit server-side), but in practice the modal intercepts before the creation form is ever shown.

## Styling

Consistent with existing modals in the dashboard (same backdrop, card radius, button styles). Uses CSS variables (`var(--surf)`, `var(--bdr)`, `var(--accent)`, `var(--text)`, `var(--text2)`, `var(--muted)`). No new CSS classes needed.

## Testing

One test file: `src/components/home/UpgradeModal.test.tsx`
- Renders title and feature list
- Clicking backdrop calls `onClose`
- Pressing Escape calls `onClose`
- Clicking "Voir les offres Pro" calls `router.push('/account')` and `onClose`
- Clicking "Continuer avec le plan gratuit" calls `onClose`

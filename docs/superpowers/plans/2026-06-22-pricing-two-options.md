# Politique tarifaire — Deux options sans prix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer l'unique option "Pro à 9 €/mois" par deux options coexistantes (crédit unitaire + abonnement) sans afficher de prix, dans le modal d'upgrade, la page compte, et la bannière dashboard.

**Architecture:** Changements purement UI — aucune logique de store, de DB, ni de limite modifiée. Le modal d'upgrade affiche deux cartes côte à côte, la page compte idem, la bannière dashboard retire le prix. Les deux CTA du modal redirigent vers `/account`.

**Tech Stack:** Next.js 14 App Router, React, Tailwind CSS, Vitest + Testing Library

---

## Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `src/components/home/UpgradeModal.tsx` | Modal affiché quand un utilisateur Free crée un 2ᵉ projet |
| `src/components/home/UpgradeModal.test.tsx` | Tests du modal |
| `src/app/account/page.tsx` | Page compte — section "Plan actuel" |
| `src/app/dashboard/page.tsx` | Bannière upsell dashboard (ligne ~700) |

---

### Task 1 : UpgradeModal — deux options, sans prix

**Files:**
- Modify: `src/components/home/UpgradeModal.tsx`
- Modify: `src/components/home/UpgradeModal.test.tsx`

- [ ] **Step 1 : Mettre à jour les tests (ils doivent échouer)**

Remplacer le contenu de `src/components/home/UpgradeModal.test.tsx` par :

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import { UpgradeModal } from './UpgradeModal';

describe('UpgradeModal', () => {
  const onClose = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  it('renders title and both options', () => {
    render(<UpgradeModal onClose={onClose} />);
    expect(screen.getByText('Limite atteinte')).toBeDefined();
    expect(screen.getByText('+1 projet')).toBeDefined();
    expect(screen.getByText('Illimité')).toBeDefined();
    expect(screen.queryByText(/9 €/)).toBeNull();
  });

  it('calls onClose when backdrop is clicked', () => {
    render(<UpgradeModal onClose={onClose} />);
    fireEvent.click(screen.getByTestId('upgrade-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape is pressed', () => {
    render(<UpgradeModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('navigates to /account and calls onClose when Acheter is clicked', () => {
    render(<UpgradeModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Acheter →'));
    expect(mockPush).toHaveBeenCalledWith('/account');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("navigates to /account and calls onClose when S'abonner is clicked", () => {
    render(<UpgradeModal onClose={onClose} />);
    fireEvent.click(screen.getByText("S'abonner →"));
    expect(mockPush).toHaveBeenCalledWith('/account');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when secondary link is clicked', () => {
    render(<UpgradeModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Continuer avec le plan gratuit'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2 : Vérifier l'échec des tests**

```
npx vitest run src/components/home/UpgradeModal.test.tsx --reporter=verbose
```

Expected : 3–4 tests FAIL (libellés introuvables, `queryByText(/9 €/)` passe mais les autres pas).

- [ ] **Step 3 : Réécrire le composant UpgradeModal**

Remplacer le contenu de `src/components/home/UpgradeModal.tsx` par :

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UpgradeModalProps {
  onClose: () => void;
}

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleUpgrade = () => {
    router.push('/account');
    onClose();
  };

  return (
    <div
      data-testid="upgrade-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-modal-title"
        className="relative w-full max-w-sm rounded-2xl border p-7 shadow-2xl"
        style={{ background: 'var(--surf)', borderColor: 'var(--bdr)', margin: '0 16px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-[18px]"
          style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          ×
        </button>

        <h2 id="upgrade-modal-title" style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Limite atteinte
        </h2>

        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
          Vous avez utilisé votre projet inclus. Comment continuer ?
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <div style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 22 }}>📄</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>+1 projet</span>
            <span style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.4 }}>Un crédit projet, sans engagement.</span>
            <button
              type="button"
              onClick={handleUpgrade}
              style={{ marginTop: 'auto', padding: '7px 10px', background: 'transparent', border: '1px solid var(--bdr)', borderRadius: 7, color: 'var(--text)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Acheter →
            </button>
          </div>

          <div style={{ background: 'var(--surf2)', border: '1.5px solid var(--accent)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, position: 'relative' }}>
            <span style={{ position: 'absolute', top: -1, right: 8, background: 'var(--accent)', color: '#fff', fontSize: 8, fontWeight: 700, padding: '2px 6px', borderRadius: '0 0 4px 4px', letterSpacing: '0.5px' }}>
              RECOMMANDÉ
            </span>
            <span style={{ fontSize: 22 }}>♾️</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Illimité</span>
            <span style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.4 }}>Abonnement — projets, cloud, tous appareils.</span>
            <button
              type="button"
              onClick={handleUpgrade}
              className="btn-primary"
              style={{ marginTop: 'auto', padding: '7px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              S'abonner →
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full text-center text-[13px]"
          style={{ color: 'var(--muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 0' }}
        >
          Continuer avec le plan gratuit
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4 : Vérifier les tests**

```
npx vitest run src/components/home/UpgradeModal.test.tsx --reporter=verbose
```

Expected : 6/6 PASS.

- [ ] **Step 5 : Commit**

```
git add src/components/home/UpgradeModal.tsx src/components/home/UpgradeModal.test.tsx
git commit -m "feat(pricing): modal upgrade — deux options sans prix"
```

---

### Task 2 : Page /account — deux blocs dans la section plan

**Files:**
- Modify: `src/app/account/page.tsx` (lignes 58–70)

- [ ] **Step 1 : Repérer le bloc à remplacer**

Dans `src/app/account/page.tsx`, trouver ce bloc (lignes ~58–70) :

```tsx
{user?.plan !== 'pro' && (
  <div className="rounded-xl border p-4" style={{ background: 'var(--accent-l)', borderColor: 'var(--accent)' }}>
    <p className="mb-3 text-[13px] font-semibold" style={{ color: 'var(--accent)' }}>
      Passez Pro — 9 €/mois
    </p>
    <p className="mb-4 text-[12.5px]" style={{ color: 'var(--accent)' }}>
      Projets illimités + sauvegarde cloud. Annulation à tout moment.
    </p>
    <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
      Paiement disponible prochainement. Contactez-nous pour un accès anticipé.
    </p>
  </div>
)}
```

- [ ] **Step 2 : Remplacer par les deux blocs**

```tsx
{user?.plan !== 'pro' && (
  <div>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--bdr)' }}>
        <p className="mb-2 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>+1 projet</p>
        <p className="mb-3 text-[12px]" style={{ color: 'var(--text2)', lineHeight: 1.4 }}>
          Achetez un crédit pour débloquer un projet supplémentaire.
        </p>
        <p className="text-[11px]" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
          Disponible prochainement
        </p>
      </div>
      <div className="rounded-xl border p-4" style={{ borderColor: 'var(--accent)', background: 'var(--accent-l)' }}>
        <p className="mb-2 text-[13px] font-semibold" style={{ color: 'var(--text)' }}>Projets illimités</p>
        <p className="mb-3 text-[12px]" style={{ color: 'var(--text2)', lineHeight: 1.4 }}>
          Abonnement — accès illimité, sauvegarde cloud, tous appareils.
        </p>
        <p className="text-[11px]" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>
          Disponible prochainement
        </p>
      </div>
    </div>
    <p className="mt-3 text-center text-[11px]" style={{ color: 'var(--muted)' }}>
      Contactez-nous pour un accès anticipé.
    </p>
  </div>
)}
```

- [ ] **Step 3 : Vérifier le type check**

```
npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 4 : Commit**

```
git add src/app/account/page.tsx
git commit -m "feat(pricing): page compte — deux blocs sans prix"
```

---

### Task 3 : Bannière dashboard — supprimer le prix

**Files:**
- Modify: `src/app/dashboard/page.tsx` (ligne ~700)

Il n'y a pas de test à écrire ici (la bannière est du texte statique conditionnel).

- [ ] **Step 1 : Trouver et modifier la ligne**

Dans `src/app/dashboard/page.tsx`, trouver (ligne ~700) :

```tsx
<p className="text-[12px]" style={{ color: 'var(--accent)' }}>Passez Pro pour créer des projets illimités — 9 €/mois</p>
```

Remplacer par :

```tsx
<p className="text-[12px]" style={{ color: 'var(--accent)' }}>Passez à la formule supérieure pour des projets illimités</p>
```

- [ ] **Step 2 : Vérifier le type check**

```
npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 3 : Lancer les tests du dashboard**

```
npx vitest run src/app/dashboard --reporter=verbose
```

Expected : tous PASS (aucun test ne vérifie ce libellé).

- [ ] **Step 4 : Commit**

```
git add src/app/dashboard/page.tsx
git commit -m "feat(pricing): bannière dashboard sans prix"
```

---

## Self-Review

### Couverture spec

| Exigence spec | Tâche |
|---|---|
| Supprimer "9 €/mois" partout | Tasks 1, 2, 3 |
| UpgradeModal — deux options | Task 1 |
| /account — deux blocs | Task 2 |
| Bannière dashboard sans prix | Task 3 |
| CTA conservé vers /account | Task 1 (les deux boutons appellent `handleUpgrade`) |
| "Disponible prochainement" sur /account | Task 2 |
| Tests mis à jour | Task 1 |

### Hors périmètre (non traité)
- Stripe, paiement, schéma DB → aucun changement nécessaire ✓

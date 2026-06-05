# Upgrade Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show an upgrade modal when a free-plan user clicks "Nouveau projet" while already at the 1-project limit, instead of silently closing the creation form.

**Architecture:** A new `UpgradeModal` component intercepts the "Nouveau projet" click in `dashboard/page.tsx`. A `handleNewProject` helper checks `user.plan === 'free' && projects.length >= 1` client-side and either opens the upgrade modal or the creation form. The modal has a primary CTA that navigates to `/account` and a secondary dismiss link.

**Tech Stack:** Next.js 14 (`'use client'`), React 18, TypeScript, Tailwind CSS + CSS variables, Vitest + @testing-library/react.

---

## File map

| File | Action |
|------|--------|
| `src/components/home/UpgradeModal.tsx` | Create — modal component |
| `src/components/home/UpgradeModal.test.tsx` | Create — tests |
| `src/app/dashboard/page.tsx` | Modify — wire modal in |

---

### Task 1: UpgradeModal component + tests

**Files:**
- Create: `src/components/home/UpgradeModal.tsx`
- Create: `src/components/home/UpgradeModal.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/components/home/UpgradeModal.test.tsx`:

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

  it('renders title and feature list', () => {
    render(<UpgradeModal onClose={onClose} />);
    expect(screen.getByText('Passez au plan Pro')).toBeDefined();
    expect(screen.getByText('Projets illimités')).toBeDefined();
    expect(screen.getByText('Sauvegarde cloud automatique')).toBeDefined();
    expect(screen.getByText('Accès depuis tous vos appareils')).toBeDefined();
    expect(screen.getByText('9 €/mois — annulation à tout moment')).toBeDefined();
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

  it('navigates to /account and calls onClose when CTA is clicked', () => {
    render(<UpgradeModal onClose={onClose} />);
    fireEvent.click(screen.getByText('Voir les offres Pro →'));
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

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/components/home/UpgradeModal.test.tsx
```

Expected: FAIL — `Cannot find module './UpgradeModal'`

- [ ] **Step 3: Create the UpgradeModal component**

Create `src/components/home/UpgradeModal.tsx`:

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

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Passez au plan Pro
        </h2>

        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
          Vous avez atteint la limite du plan gratuit (1 projet).
        </p>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {['Projets illimités', 'Sauvegarde cloud automatique', 'Accès depuis tous vos appareils'].map((feat) => (
            <li key={feat} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13.5, color: 'var(--text)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 16 }}>✓</span>
              {feat}
            </li>
          ))}
        </ul>

        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 20 }}>
          9 €/mois — annulation à tout moment
        </p>

        <button
          type="button"
          onClick={handleUpgrade}
          className="btn-primary w-full py-3 text-[14px] font-semibold"
          style={{ marginBottom: 12 }}
        >
          Voir les offres Pro →
        </button>

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

- [ ] **Step 4: Run tests — expect all 5 to pass**

```bash
npx vitest run src/components/home/UpgradeModal.test.tsx
```

Expected: PASS — 5 tests

- [ ] **Step 5: Commit**

```bash
git add src/components/home/UpgradeModal.tsx src/components/home/UpgradeModal.test.tsx
git commit -m "feat(dashboard): add UpgradeModal component"
```

---

### Task 2: Wire UpgradeModal into dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx`

Context: `dashboard/page.tsx` has three "Nouveau projet" click handlers (grid card at ~line 724, list row at ~line 760, mobile FAB at ~line 778). All currently call `setShowNewModal(true)`. We replace them with a `handleNewProject` helper that checks the plan limit first.

- [ ] **Step 1: Add import and state in dashboard/page.tsx**

At the top of `src/app/dashboard/page.tsx`, add the import after the existing `SharePanel` import:

```tsx
import { UpgradeModal } from '@/components/home/UpgradeModal';
```

Then, inside the `DashboardPage` component, add the new state after the existing `sharingProjectId` state (around line 467):

```tsx
const [showUpgradeModal, setShowUpgradeModal] = useState(false);
```

- [ ] **Step 2: Add handleNewProject helper**

Add this function in the component body, after the `handleCreate` function (around line 497):

```tsx
const handleNewProject = () => {
  if (user?.plan === 'free' && projects.length >= 1) {
    setShowUpgradeModal(true);
  } else {
    setShowNewModal(true);
  }
};
```

- [ ] **Step 3: Replace the three onClick handlers**

Replace all three occurrences of `onClick={() => setShowNewModal(true)}` with `onClick={handleNewProject}`:

1. Grid card button (~line 724):
   - Old: `onClick={() => setShowNewModal(true)}`
   - New: `onClick={handleNewProject}`

2. List view button (~line 760):
   - Old: `onClick={() => setShowNewModal(true)}`
   - New: `onClick={handleNewProject}`

3. Mobile FAB (~line 778):
   - Old: `onClick={() => setShowNewModal(true)}`
   - New: `onClick={handleNewProject}`

- [ ] **Step 4: Render UpgradeModal conditionally**

After the `{showNewModal && <NewProjectModal ... />}` block (~line 786), add:

```tsx
{showUpgradeModal && (
  <UpgradeModal onClose={() => setShowUpgradeModal(false)} />
)}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass (including the 5 new UpgradeModal tests)

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "feat(dashboard): intercept new-project click with upgrade modal for free users"
```

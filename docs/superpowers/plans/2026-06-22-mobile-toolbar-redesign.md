# Mobile Toolbar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructurer la toolbar mobile de l'outil de dessin en deux lignes fixes collées au bas de l'écran, en corrigeant le positionnement `bottom-20` et en ajoutant le contrôle d'épaisseur de mur et le texte d'outil actif.

**Architecture:** Deux modifications ciblées — (1) `WallThicknessControl` reçoit une prop `compact` qui affiche un stepper `[−] Xcm [+]` sans clavier, (2) le bloc mobile de `PlanToolbar` est restructuré en deux lignes avec `bottom-0` + safe area iOS. `TOOL_STATUS_TEXTS` est déjà exporté de `ToolStatusBar.tsx` — aucune modification de ce fichier.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest + Testing Library

---

## Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `src/components/plan/WallThicknessControl.tsx` | Ajouter prop `compact` → stepper inline |
| `src/components/plan/WallThicknessControl.test.tsx` | Nouveaux tests mode compact |
| `src/components/plan/PlanToolbar.tsx` | Restructurer bloc mobile en deux lignes |
| `src/components/plan/PlanToolbar.test.tsx` | Mettre à jour mock + nouveaux tests |

---

### Task 1 : WallThicknessControl — prop `compact`

**Files:**
- Modify: `src/components/plan/WallThicknessControl.tsx`
- Modify: `src/components/plan/WallThicknessControl.test.tsx`

- [ ] **Step 1 : Ajouter les tests compact (TDD — échoueront d'abord)**

Dans `src/components/plan/WallThicknessControl.test.tsx`, ajouter ce bloc à la fin du fichier (après le describe existant) :

```tsx
describe('WallThicknessControl compact', () => {
  it('affiche un bouton "−" et un bouton "+"', () => {
    render(<WallThicknessControl wallThickness={100} onChange={() => {}} compact />);
    expect(screen.getByRole('button', { name: 'Réduire l\'épaisseur' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Augmenter l\'épaisseur' })).toBeDefined();
  });

  it('affiche la valeur en cm (100mm → "10cm")', () => {
    render(<WallThicknessControl wallThickness={100} onChange={() => {}} compact />);
    expect(screen.getByText('10cm')).toBeDefined();
  });

  it('clic "+" appelle onChange avec wallThickness + 5', () => {
    const onChange = vi.fn();
    render(<WallThicknessControl wallThickness={100} onChange={onChange} compact />);
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter l\'épaisseur' }));
    expect(onChange).toHaveBeenCalledWith(105);
  });

  it('clic "−" appelle onChange avec wallThickness - 5', () => {
    const onChange = vi.fn();
    render(<WallThicknessControl wallThickness={100} onChange={onChange} compact />);
    fireEvent.click(screen.getByRole('button', { name: 'Réduire l\'épaisseur' }));
    expect(onChange).toHaveBeenCalledWith(95);
  });

  it('clic "−" ne descend pas en dessous de 50mm', () => {
    const onChange = vi.fn();
    render(<WallThicknessControl wallThickness={50} onChange={onChange} compact />);
    fireEvent.click(screen.getByRole('button', { name: 'Réduire l\'épaisseur' }));
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it('le mode compact ne rend pas d\'input number (pas de clavier)', () => {
    render(<WallThicknessControl wallThickness={100} onChange={() => {}} compact />);
    expect(screen.queryByRole('spinbutton')).toBeNull();
  });
});
```

- [ ] **Step 2 : Vérifier que les nouveaux tests échouent**

```
npx vitest run src/components/plan/WallThicknessControl.test.tsx --reporter=verbose
```

Expected : les 4 tests existants PASS, les 6 nouveaux FAIL (`compact` prop inconnue).

- [ ] **Step 3 : Implémenter la prop `compact` dans WallThicknessControl**

Remplacer tout le contenu de `src/components/plan/WallThicknessControl.tsx` par :

```tsx
'use client';

interface WallThicknessControlProps {
  wallThickness: number;
  onChange: (mm: number) => void;
  compact?: boolean;
}

const BTN = 'flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold bg-gray-50 border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors';

export const WallThicknessControl = ({ wallThickness, onChange, compact = false }: WallThicknessControlProps) => {
  const cm = Math.round(wallThickness / 10);

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Réduire l'épaisseur"
          onClick={() => onChange(Math.max(50, wallThickness - 5))}
          className={BTN}
          style={{ color: 'var(--text2)' }}
        >
          −
        </button>
        <span className="w-10 text-center text-[12px] font-bold select-none" style={{ color: 'var(--text2)' }}>
          {cm}cm
        </span>
        <button
          type="button"
          aria-label="Augmenter l'épaisseur"
          onClick={() => onChange(wallThickness + 5)}
          className={BTN}
          style={{ color: 'var(--text2)' }}
        >
          +
        </button>
      </div>
    );
  }

  const commit = (raw: string) => {
    const v = parseFloat(raw);
    if (!isNaN(v) && v >= 5) onChange(Math.round(v * 10));
  };

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[9px] font-black uppercase tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
        ép.
      </span>
      <input
        key={wallThickness}
        type="number"
        step="0.5"
        min="5"
        defaultValue={cm}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
        className="h-8 w-8 rounded-xl text-center text-[11px] font-bold outline-none transition-colors bg-gray-50 border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-800"
        style={{ color: 'var(--text2)' }}
      />
      <span className="text-[9px] font-semibold" style={{ color: 'var(--muted)' }}>cm</span>
    </div>
  );
};
```

- [ ] **Step 4 : Vérifier que tous les tests passent**

```
npx vitest run src/components/plan/WallThicknessControl.test.tsx --reporter=verbose
```

Expected : 10/10 PASS.

- [ ] **Step 5 : Vérifier la suite complète**

```
npx vitest run --reporter=verbose 2>&1 | tail -10
```

Expected : aucune régression.

- [ ] **Step 6 : Commit**

```
git add src/components/plan/WallThicknessControl.tsx src/components/plan/WallThicknessControl.test.tsx
git commit -m "feat(mobile): WallThicknessControl — prop compact avec stepper +/−"
```

---

### Task 2 : PlanToolbar — restructure mobile deux lignes

**Files:**
- Modify: `src/components/plan/PlanToolbar.tsx`
- Modify: `src/components/plan/PlanToolbar.test.tsx`

**Contexte important :**
- `TOOL_STATUS_TEXTS` est déjà exporté de `src/components/plan/ToolStatusBar.tsx` — il suffit de l'importer.
- Le mock de `WallThicknessControl` dans `PlanToolbar.test.tsx` ignore tous les props — à mettre à jour pour capturer `compact`.
- Le `data-testid="plan-toolbar-mobile"` doit rester pour ne pas casser les tests existants.

- [ ] **Step 1 : Mettre à jour le mock WallThicknessControl et ajouter les nouveaux tests**

Dans `src/components/plan/PlanToolbar.test.tsx`, remplacer les lignes 7-9 (le mock WallThicknessControl) par :

```tsx
vi.mock('./WallThicknessControl', () => ({
  WallThicknessControl: ({ compact }: { compact?: boolean }) => (
    <div data-testid="wall-thickness-control" data-compact={compact ? 'true' : 'false'} />
  ),
}));
```

Puis ajouter ce bloc à la fin du fichier :

```tsx
describe('PlanToolbar mobile — deux lignes', () => {
  it('toolbar mobile a la classe bottom-0 (pas bottom-20)', () => {
    render(<PlanToolbar {...defaultProps} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    expect(toolbar.className).toContain('bottom-0');
    expect(toolbar.className).not.toContain('bottom-20');
  });

  it('WallThicknessControl est rendu en mode compact dans la toolbar mobile', () => {
    render(<PlanToolbar {...defaultProps} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    const ctrl = toolbar.querySelector('[data-testid="wall-thickness-control"]');
    expect(ctrl).not.toBeNull();
    expect(ctrl!.getAttribute('data-compact')).toBe('true');
  });

  it('texte d\'outil actif visible quand tool=WALL', () => {
    render(<PlanToolbar {...defaultProps} tool="WALL" />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    expect(toolbar.textContent).toContain('Cliquez pour poser un point');
  });

  it('pas de texte d\'outil actif quand tool=SELECT', () => {
    render(<PlanToolbar {...defaultProps} tool="SELECT" />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    expect(toolbar.textContent).not.toContain('Cliquez');
  });
});
```

- [ ] **Step 2 : Vérifier que les nouveaux tests échouent**

```
npx vitest run src/components/plan/PlanToolbar.test.tsx --reporter=verbose
```

Expected : les 7 tests existants PASS, les 4 nouveaux FAIL (`bottom-20` toujours présent, compact=false, pas de texte).

- [ ] **Step 3 : Ajouter l'import de TOOL_STATUS_TEXTS dans PlanToolbar.tsx**

Dans `src/components/plan/PlanToolbar.tsx`, ajouter cette ligne juste après les imports existants (après la ligne `import { WallThicknessControl } from './WallThicknessControl';`) :

```tsx
import { TOOL_STATUS_TEXTS } from './ToolStatusBar';
```

- [ ] **Step 4 : Remplacer le bloc mobile dans PlanToolbar.tsx**

Dans `src/components/plan/PlanToolbar.tsx`, localiser et remplacer TOUT le second `<div>` (celui qui commence par `data-testid="plan-toolbar-mobile"`, lignes 125–151) par :

```tsx
  <div
    data-testid="plan-toolbar-mobile"
    className="absolute bottom-0 left-0 right-0 z-20 flex flex-col md:hidden mouse:hidden border-t border-gray-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md"
  >
    {/* Ligne 1 : outils + épaisseur */}
    <div className="flex items-center gap-1 px-2 pt-2 pb-1">
      <button type="button" aria-label="Sélectionner" onClick={() => onChangeTool('SELECT')}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'SELECT' ? 'bg-orange-500 text-white shadow-md' : TB_CARD}`}
        style={tool !== 'SELECT' ? { color: 'var(--text2)' } : {}}><MousePointer2 size={18} /></button>
      <button type="button" aria-label="Tracer des murs" onClick={() => onChangeTool('WALL')}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'WALL' ? 'bg-orange-500 text-white shadow-md' : TB_CARD}`}
        style={tool !== 'WALL' ? { color: 'var(--text2)' } : {}}><PenTool size={18} /></button>
      <button type="button" aria-label="Porte" onClick={() => onChangeTool('DOOR')}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'DOOR' ? 'bg-orange-500 text-white shadow-md' : TB_CARD}`}
        style={tool !== 'DOOR' ? { color: 'var(--text2)' } : {}}><DoorOpen size={18} /></button>
      <button type="button" aria-label="Zone non carrelée" onClick={() => onChangeTool('EXCLUDE')}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'EXCLUDE' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : TB_CARD}`}
        style={tool !== 'EXCLUDE' ? { color: 'var(--text2)' } : {}}><Square size={18} /></button>
      <button type="button" aria-label="Verrouiller" onClick={() => onChangeTool('LOCK')}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'LOCK' ? 'text-white shadow-md' : TB_CARD}`}
        style={tool === 'LOCK' ? { background: '#27ae60', boxShadow: '0 4px 10px rgba(39,174,96,0.3)' } : { color: 'var(--text2)' }}><Lock size={18} /></button>
      <div className="ml-auto">
        <WallThicknessControl wallThickness={wallThickness} onChange={onWallThicknessChange} compact />
      </div>
    </div>
    {/* Ligne 2 : actions + texte d'outil actif */}
    <div className="flex items-center gap-1 px-2 pt-1" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onUndo} disabled={!canUndo}><Undo size={18} /></Button>
      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onRedo} disabled={!canRedo}><Redo2 size={18} /></Button>
      <button type="button" aria-label="Mode suppression" onClick={() => onChangeTool('DELETE')}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'DELETE' ? 'bg-red-500 text-white shadow-md shadow-red-500/30' : TB_CARD}`}
        style={tool !== 'DELETE' ? { color: 'var(--text2)' } : {}}><Trash2 size={18} /></button>
      {TOOL_STATUS_TEXTS[tool] && (
        <span className="ml-2 truncate text-[11px]" style={{ color: 'var(--text2)' }}>
          {TOOL_STATUS_TEXTS[tool]}
        </span>
      )}
    </div>
  </div>
```

- [ ] **Step 5 : Vérifier que tous les tests passent**

```
npx vitest run src/components/plan/PlanToolbar.test.tsx --reporter=verbose
```

Expected : 11/11 PASS.

- [ ] **Step 6 : Vérifier la suite complète**

```
npx vitest run --reporter=verbose 2>&1 | tail -10
```

Expected : aucune régression.

- [ ] **Step 7 : Vérifier TypeScript**

```
npx tsc --noEmit
```

Expected : 0 erreurs.

- [ ] **Step 8 : Commit**

```
git add src/components/plan/PlanToolbar.tsx src/components/plan/PlanToolbar.test.tsx
git commit -m "feat(mobile): toolbar deux lignes — bottom-0, safe area, épaisseur, texte outil"
```

---

## Self-Review

### Couverture spec

| Exigence spec | Tâche |
|---|---|
| `bottom-20` → `bottom-0` | Task 2 Step 4 |
| `paddingBottom: env(safe-area-inset-bottom)` | Task 2 Step 4 (ligne 2, style) |
| Ligne 1 : SELECT WALL DOOR EXCLUDE LOCK + épaisseur | Task 2 Step 4 |
| Ligne 2 : Undo Redo Delete + texte outil actif | Task 2 Step 4 |
| WallThicknessControl compact `[−] Xcm [+]` | Task 1 Step 3 |
| Pas de scroll horizontal | Résolu par `flex-col` + tous outils visibles sur 390px+ |
| Aucun changement ToolStatusBar.tsx | ✓ hors périmètre |
| Aucun changement WallRoomPanel | ✓ hors périmètre |

### Hors périmètre (non traité)

- WallRoomPanel mobile → non demandé ✓
- ToolStatusBar position desktop → inchangé ✓
- Topbar mobile → non demandé ✓

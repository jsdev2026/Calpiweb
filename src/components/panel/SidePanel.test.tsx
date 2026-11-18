import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { NAV_LEARNED_STORAGE_KEY, PANEL_STORAGE_KEY, usePanelStore } from '@/store/panelStore';
import { PanelChip, PanelSection, PanelToolButton, SidePanel, sectionDomId } from './SidePanel';

const Icon = () => <svg data-testid="mode-icon" />;

// Stockage en mémoire : indépendant de la version de Node (Node 26 masque celui de jsdom)
const memory = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, String(v)),
    removeItem: (k: string) => void memory.delete(k),
    clear: () => memory.clear(),
  },
});

beforeEach(() => {
  window.localStorage.clear();
  act(() => usePanelStore.setState({ collapsed: false, mobileOpen: false }));
});

describe('SidePanel', () => {
  it('affiche l’en-tête (titre, résumé) et marque le panneau pour le recentrage du plan', () => {
    render(
      <SidePanel testId="p" icon={<Icon />} title="Calepinage" summary="30 × 60 cm">
        <PanelSection title="Format">contenu</PanelSection>
      </SidePanel>,
    );
    const panel = screen.getByTestId('p');
    expect(panel.hasAttribute('data-canvas-overlay')).toBe(true);
    expect(screen.getByText('Calepinage')).toBeTruthy();
    expect(screen.getByText('30 × 60 cm')).toBeTruthy();
  });

  it('smartphone : l’en-tête déplie / replie le contenu, état partagé entre les modes', () => {
    const { rerender } = render(
      <SidePanel icon={<Icon />} title="Plan 2D">
        <PanelSection title="Pièces">liste</PanelSection>
      </SidePanel>,
    );
    const body = () => document.querySelector('[data-panel-body]')!;
    expect(body().getAttribute('data-open')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /Plan 2D/ }));
    expect(body().getAttribute('data-open')).toBe('true');
    // Changement d'onglet : un autre panneau garde le même état
    rerender(
      <SidePanel icon={<Icon />} title="Quantitatif">
        <PanelSection title="Coupes">liste</PanelSection>
      </SidePanel>,
    );
    expect(body().getAttribute('data-open')).toBe('true');
  });

  it('ordinateur : replier / déplier, état mémorisé', () => {
    render(
      <SidePanel icon={<Icon />} title="Plan 2D">
        <PanelSection title="Pièces">liste</PanelSection>
      </SidePanel>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Replier le panneau' }));
    expect(usePanelStore.getState().collapsed).toBe(true);
    expect(window.localStorage.getItem(PANEL_STORAGE_KEY)).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Déplier le panneau' }));
    expect(usePanelStore.getState().collapsed).toBe(false);
    expect(window.localStorage.getItem(PANEL_STORAGE_KEY)).toBe('false');
  });

  it('barre repliée : action directe ou dépliage sur la section visée', () => {
    act(() => usePanelStore.setState({ collapsed: true }));
    const onTool = vi.fn();
    const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    render(
      <SidePanel
        icon={<Icon />}
        title="Calepinage"
        railItems={[
          { id: 'tool', label: 'Murs', icon: <Icon />, onClick: onTool, active: true },
          { id: 'pose', label: 'Pose', icon: <Icon /> },
        ]}
      >
        <PanelSection id="pose" title="Pose">
          contenu
        </PanelSection>
      </SidePanel>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Murs' }));
    expect(onTool).toHaveBeenCalled();
    expect(usePanelStore.getState().collapsed).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Pose' }));
    expect(usePanelStore.getState().collapsed).toBe(false);
    expect(document.getElementById(sectionDomId('pose'))).toBeTruthy();
    expect(scroll).toHaveBeenCalled();
    raf.mockRestore();
  });
});

describe('liens précédent / suivant', () => {
  it('smartphone : restent visibles quand le panneau est replié', () => {
    const prev = vi.fn();
    const next = vi.fn();
    render(
      <SidePanel
        icon={<Icon />}
        title="Calepinage"
        prev={{ label: 'Plan 2D', onClick: prev }}
        next={{ label: 'Quantitatif', onClick: next }}
      >
        <PanelSection title="Format">contenu</PanelSection>
      </SidePanel>,
    );
    expect(usePanelStore.getState().mobileOpen).toBe(false);
    const row = document.querySelector('[data-panel-next]') as HTMLElement;
    expect(row.className).toMatch(/^flex /);
    expect(row.className).not.toMatch(/(^|s)hidden(s|$)/);
    fireEvent.click(within(row).getByRole('button', { name: 'Quantitatif' }));
    expect(next).toHaveBeenCalled();
  });
});

describe('aide à la découverte', () => {
  it('le lien suivant pulse jusqu’à sa première utilisation (mémorisé)', () => {
    act(() => usePanelStore.setState({ navLearned: [] }));
    const next = vi.fn();
    render(
      <SidePanel icon={<Icon />} title="Plan 2D" next={{ label: 'Calepinage', onClick: next }}>
        <PanelSection title="Pièces">liste</PanelSection>
      </SidePanel>,
    );
    const row = document.querySelector('[data-panel-next]') as HTMLElement;
    const btn = within(row).getByRole('button', { name: 'Calepinage' });
    expect(btn.className).toMatch(/nav-pulse/);
    fireEvent.click(btn);
    expect(next).toHaveBeenCalled();
    expect(usePanelStore.getState().navLearned).toEqual(['Plan 2D']);
    expect(JSON.parse(window.localStorage.getItem(NAV_LEARNED_STORAGE_KEY)!)).toEqual(['Plan 2D']);
    expect(btn.className).not.toMatch(/nav-pulse/);
  });

  it('chaque étape garde son propre clignotement : Calepinage et Quantitatif pulsent encore', () => {
    act(() => usePanelStore.setState({ navLearned: ['Plan 2D'] }));
    const { unmount } = render(
      <SidePanel
        icon={<Icon />}
        title="Calepinage"
        prev={{ label: 'Plan 2D', onClick: vi.fn() }}
        next={{ label: 'Quantitatif', onClick: vi.fn() }}
      />,
    );
    let row = document.querySelector('[data-panel-next]') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Quantitatif' }).className).toMatch(/nav-pulse/);
    // Revenir en arrière ne compte pas comme avoir appris le bouton « suivant »
    fireEvent.click(within(row).getByRole('button', { name: 'Plan 2D' }));
    expect(usePanelStore.getState().navLearned).toEqual(['Plan 2D']);
    unmount();
    render(
      <SidePanel
        icon={<Icon />}
        title="Quantitatif"
        next={{ label: 'Exporter en PDF', onClick: vi.fn() }}
      />,
    );
    row = document.querySelector('[data-panel-next]') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Exporter en PDF' }).className).toMatch(
      /nav-pulse/,
    );
  });

  it('boutons de navigation : « suivant » plein en couleur d’accent, assez grands pour le doigt', () => {
    render(
      <SidePanel
        icon={<Icon />}
        title="Calepinage"
        prev={{ label: 'Plan 2D', onClick: vi.fn() }}
        next={{ label: 'Quantitatif', onClick: vi.fn() }}
      />,
    );
    const row = document.querySelector('[data-panel-next]') as HTMLElement;
    const next = within(row).getByRole('button', { name: 'Quantitatif' });
    const prev = within(row).getByRole('button', { name: 'Plan 2D' });
    expect(next.style.background).toBe('var(--accent)');
    expect(prev.style.color).toBe('var(--accent)');
    for (const b of [next, prev]) expect(b.className).toMatch(/(^|\s)h-10(\s|$)/);
  });

  it('lien suivant grisé : pas de pulsation, le clic explique pourquoi', () => {
    act(() => usePanelStore.setState({ navLearned: [] }));
    const next = vi.fn();
    render(
      <SidePanel
        icon={<Icon />}
        title="Plan 2D"
        next={{ label: 'Calepinage', onClick: next, disabled: true }}
      />,
    );
    const row = document.querySelector('[data-panel-next]') as HTMLElement;
    const btn = within(row).getByRole('button', { name: 'Calepinage' });
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.className).not.toMatch(/nav-pulse/);
    fireEvent.click(btn);
    expect(next).toHaveBeenCalled();
    expect(usePanelStore.getState().navLearned).toEqual([]);
  });
});

describe('éléments communs', () => {
  it('PanelChip et PanelToolButton exposent l’état actif', () => {
    const onClick = vi.fn();
    render(
      <>
        <PanelChip active onClick={onClick}>
          30 × 60
        </PanelChip>
        <PanelToolButton label="Supprimer" icon={<Icon />} tone="danger" onClick={onClick} />
      </>,
    );
    expect(screen.getByRole('button', { name: '30 × 60' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const del = screen.getByRole('button', { name: 'Supprimer' });
    expect(del.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(del);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

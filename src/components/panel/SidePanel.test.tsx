import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PANEL_STORAGE_KEY, usePanelStore } from '@/store/panelStore';
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

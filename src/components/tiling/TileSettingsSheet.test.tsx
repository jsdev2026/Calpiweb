import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { usePanelStore } from '@/store/panelStore';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import { TileSettingsSheet, tileSummary } from './TileSettingsSheet';
import { parseDecimal } from './NumberStepper';

const result = { roomArea: 12_000_000, toOrder: 80 } as unknown as QuantityResult;

// Panneau déplié (smartphone) par défaut dans ces tests
beforeEach(() => {
  act(() => usePanelStore.setState({ collapsed: false, mobileOpen: true }));
});

const setup = (overrides: Partial<React.ComponentProps<typeof TileSettingsSheet>> = {}) => {
  const onChange = vi.fn();
  render(
    <TileSettingsSheet
      config={DEFAULT_TILING_CONFIG}
      onChange={onChange}
      result={result}
      onOrigin={() => {}}
      onShowQuantities={() => {}}
      {...overrides}
    />,
  );
  return { onChange };
};

describe('tileSummary', () => {
  it('résume le carreau en cm', () => {
    expect(tileSummary(DEFAULT_TILING_CONFIG)).toBe('30 × 60 cm · joint 3 mm · Décalé 1/3');
  });
});

describe('parseDecimal', () => {
  it('accepte la virgule', () => {
    expect(parseDecimal('2,5')).toBe(2.5);
    expect(parseDecimal(' 12.5 ')).toBe(12.5);
  });
});

describe('TileSettingsSheet', () => {
  it('applique un format courant en mm', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Format 60 par 120 cm' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ width: 600, height: 1200 }));
  });

  it('accepte une largeur saisie avec une virgule', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByRole('textbox', { name: 'Largeur' }), {
      target: { value: '22,5' },
    });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ width: 225 }));
  });

  it('choisit la pose bâton rompu', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Bâton rompu/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ layout: 'HERRINGBONE' }));
  });

  it('ne modifie rien en lecture seule', () => {
    const { onChange } = setup({ readOnly: true });
    fireEvent.click(screen.getByRole('button', { name: 'Format 60 par 120 cm' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('replié, affiche seulement le résumé', () => {
    act(() => usePanelStore.setState({ mobileOpen: false }));
    setup();
    expect(screen.getByText(/30 × 60 cm/)).toBeTruthy();
    expect(screen.getByText('Format (cm)').closest('[data-open]')?.className).toMatch(
      /(^|\s)hidden(\s|$)/,
    );
  });

  it('active la cotation du carreau de départ', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: /Coter le carreau de départ/ }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ showStartTile: true }));
  });

  it('choix du carreau de départ : bouton « Choisir » puis retour en automatique', () => {
    const onPickStart = vi.fn();
    const { onChange } = setup({
      config: { ...DEFAULT_TILING_CONFIG, showStartTile: true, startTile: { x: 10, y: 20 } },
      onPickStart,
    });
    fireEvent.click(screen.getByRole('button', { name: /Choisir le carreau/ }));
    expect(onPickStart).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Automatique' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ startTile: undefined }));
  });

  it('règle la rotation par bouton rapide et par curseur', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Rotation 45°' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ angle: 45 }));
    fireEvent.change(screen.getByRole('slider', { name: 'Rotation libre' }), {
      target: { value: '12' },
    });
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ angle: 12 }));
  });

  it("n'affiche plus de bouton pour déplacer la pose", () => {
    setup();
    expect(screen.queryByText(/Déplacer la pose/)).toBeNull();
  });

  it('panneau commun : titre du mode, raccourcis de la barre repliée', () => {
    act(() => usePanelStore.setState({ collapsed: true }));
    setup();
    expect(screen.getByTestId('tile-settings-sheet').getAttribute('data-collapsed')).toBe('true');
    for (const name of ['Format', 'Joint', 'Pose', 'Rotation', 'Départ de la pose']) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
  });

  it('formats courants en grille (sans défilement) et lien « Quantitatif → » en haut', () => {
    const onShowQuantities = vi.fn();
    setup({ onShowQuantities });
    const format = screen.getByRole('button', { name: 'Format 30 par 30 cm' });
    expect(format.parentElement?.className).toMatch(/grid-cols-4/);
    const row = document.querySelector('[data-panel-next]') as HTMLElement;
    expect(row.compareDocumentPosition(format) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(within(row).getByRole('button', { name: /^Quantitatif$/ }));
    expect(onShowQuantities).toHaveBeenCalled();
  });

  it('lien « ← Plan 2D » en haut du panneau et dans la barre repliée', () => {
    const onShowPlan = vi.fn();
    setup({ onShowPlan });
    const row = document.querySelector('[data-panel-next]') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Plan 2D' }));
    expect(onShowPlan).toHaveBeenCalledTimes(1);
    // Le bandeau ne contient que les actions (précédent / suivant), en couleur d'accent
    expect(row.textContent).toBe('Plan 2DQuantitatif');
    for (const b of within(row).getAllByRole('button')) expect(b.style.color).toBe('var(--accent)');
    const rail = screen.getByRole('navigation', { name: /Calepinage/ });
    fireEvent.click(within(rail).getByRole('button', { name: 'Plan 2D' }));
    expect(onShowPlan).toHaveBeenCalledTimes(2);
  });

  it('affiche la rotation dans le résumé quand elle est non nulle', () => {
    expect(tileSummary({ ...DEFAULT_TILING_CONFIG, angle: 45 })).toMatch(/· 45°$/);
  });
});

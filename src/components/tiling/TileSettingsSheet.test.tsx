import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import { TileSettingsSheet, tileSummary } from './TileSettingsSheet';
import { parseDecimal } from './NumberStepper';

const result = { roomArea: 12_000_000, toOrder: 80 } as unknown as QuantityResult;

const setup = (overrides: Partial<React.ComponentProps<typeof TileSettingsSheet>> = {}) => {
  const onChange = vi.fn();
  render(
    <TileSettingsSheet
      config={DEFAULT_TILING_CONFIG}
      onChange={onChange}
      result={result}
      open
      onOpenChange={() => {}}
      moveMode={false}
      onMoveModeChange={() => {}}
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
    setup({ open: false });
    expect(screen.getByText(/30 × 60 cm/)).toBeTruthy();
    // Le corps est masqué sur mobile (classe hidden), toujours visible sur ordinateur via md:flex
    expect(screen.getByText('Format du carreau').closest('[data-open]')?.className).toMatch(
      /(^|\s)hidden(\s|$)/,
    );
  });
});

import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WallThicknessControl } from './WallThicknessControl';

describe('WallThicknessControl', () => {
  it('displays wallThickness in cm (100mm → "10")', () => {
    render(<WallThicknessControl wallThickness={100} onChange={() => {}} />);
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.defaultValue).toBe('10');
  });

  it('calls onChange with mm value on blur (type "15" → 150mm)', () => {
    const onChange = vi.fn();
    render(<WallThicknessControl wallThickness={100} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '15' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith(150);
  });

  it('does not call onChange for invalid value on blur', () => {
    const onChange = vi.fn();
    render(<WallThicknessControl wallThickness={100} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange on Enter key', () => {
    const onChange = vi.fn();
    render(<WallThicknessControl wallThickness={100} onChange={onChange} />);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '20' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(200);
  });
});

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

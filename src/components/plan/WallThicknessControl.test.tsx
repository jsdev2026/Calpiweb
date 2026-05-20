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

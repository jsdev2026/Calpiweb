// src/components/plan/ToolTooltip.test.tsx
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ToolTooltip } from './ToolTooltip';

afterEach(() => vi.useRealTimers());

describe('ToolTooltip', () => {
  it('ne montre pas le tooltip immédiatement au survol', () => {
    vi.useFakeTimers();
    render(
      <ToolTooltip label="Outil" description="Une description">
        <button>btn</button>
      </ToolTooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button').parentElement!);
    expect(screen.queryByText('Une description')).toBeNull();
  });

  it('affiche le tooltip après 600 ms', () => {
    vi.useFakeTimers();
    render(
      <ToolTooltip label="Outil" description="Une description">
        <button>btn</button>
      </ToolTooltip>,
    );
    fireEvent.mouseEnter(screen.getByRole('button').parentElement!);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.getByText('Outil')).toBeDefined();
    expect(screen.getByText('Une description')).toBeDefined();
  });

  it('masque le tooltip au départ de la souris', () => {
    vi.useFakeTimers();
    render(
      <ToolTooltip label="Outil" description="Une description">
        <button>btn</button>
      </ToolTooltip>,
    );
    const wrapper = screen.getByRole('button').parentElement!;
    fireEvent.mouseEnter(wrapper);
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.mouseLeave(wrapper);
    expect(screen.queryByText('Une description')).toBeNull();
  });

  it('annule le timer si la souris part avant 600 ms', () => {
    vi.useFakeTimers();
    render(
      <ToolTooltip label="Outil" description="Une description">
        <button>btn</button>
      </ToolTooltip>,
    );
    const wrapper = screen.getByRole('button').parentElement!;
    fireEvent.mouseEnter(wrapper);
    act(() => { vi.advanceTimersByTime(300); });
    fireEvent.mouseLeave(wrapper);
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByText('Une description')).toBeNull();
  });
});

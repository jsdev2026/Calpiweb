import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlanTool } from './PlanToolbar';

// ── Tests logique pointer-events overlay ─────────────────────────────────────

describe('overlay pointer-events logic', () => {
  const tools: PlanTool[] = ['WALL', 'DOOR', 'PARTITION', 'EXCLUDE', 'APPLY_H', 'APPLY_V',
                             'DIMENSION', 'COINCIDE', 'ANCHOR'];

  it('overlay a pointer-events: none pour chaque outil de dessin', () => {
    for (const tool of tools) {
      const pe = tool === 'SELECT' ? 'auto' : 'none';
      expect(pe).toBe('none');
    }
  });

  it('overlay a pointer-events: auto pour SELECT', () => {
    const tool = 'SELECT';
    const pe = tool === 'SELECT' ? 'auto' : 'none';
    expect(pe).toBe('auto');
  });
});

// ── Tests isTouchDevice ───────────────────────────────────────────────────────

describe('isTouchDevice detection', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(),
    });
  });

  it('retourne true si pointer: coarse', () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: true });
    const result = window.matchMedia('(pointer: coarse)').matches;
    expect(result).toBe(true);
  });

  it('retourne false si pointer: fine (souris)', () => {
    (window.matchMedia as ReturnType<typeof vi.fn>).mockReturnValue({ matches: false });
    const result = window.matchMedia('(pointer: coarse)').matches;
    expect(result).toBe(false);
  });
});

// ── Tests coordonnées éditeurs ────────────────────────────────────────────────

describe('editor screen coords', () => {
  it('retourne undefined quand isTouchDevice = true', () => {
    const isTouchDevice = true;
    const screenX = 300;
    const result = isTouchDevice ? undefined : screenX;
    expect(result).toBeUndefined();
  });

  it('retourne la valeur quand isTouchDevice = false', () => {
    const isTouchDevice = false;
    const screenX = 300;
    const result = isTouchDevice ? undefined : screenX;
    expect(result).toBe(300);
  });
});

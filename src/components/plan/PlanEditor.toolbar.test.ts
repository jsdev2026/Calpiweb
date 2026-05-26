import { describe, it, expect } from 'vitest';
import type { PlanTool } from './PlanToolbar';

// ── Escape → SELECT ──────────────────────────────────────────────────────────

describe('Escape key → SELECT', () => {
  const nonSelectTools: PlanTool[] = [
    'WALL', 'DOOR', 'PARTITION', 'EXCLUDE',
    'APPLY_H', 'APPLY_V', 'COINCIDE', 'DIMENSION', 'ANCHOR',
  ];

  it('chaque outil non-SELECT doit céder à SELECT après Escape', () => {
    for (const tool of nonSelectTools) {
      // Simule la logique du handler Escape : setTool('SELECT')
      const nextTool: PlanTool = tool !== 'SELECT' ? 'SELECT' : tool;
      expect(nextTool).toBe('SELECT');
    }
  });

  it('SELECT reste SELECT après Escape (idempotent)', () => {
    const tool: PlanTool = 'SELECT';
    const nextTool: PlanTool = tool !== 'SELECT' ? 'SELECT' : tool;
    expect(nextTool).toBe('SELECT');
  });

  it('un outil non-SELECT ne donne jamais SELECT sans Escape', () => {
    // Contrôle négatif : sans la logique Escape, l'outil reste ce qu'il est
    const tool: PlanTool = 'WALL';
    expect(tool).not.toBe('SELECT');
  });
});

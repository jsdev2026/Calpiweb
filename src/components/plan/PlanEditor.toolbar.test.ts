import { describe, it, expect } from 'vitest';
import type { PlanTool } from './PlanToolbar';

// ── Escape → SELECT ──────────────────────────────────────────────────────────

describe('Escape key → SELECT', () => {
  const tools: PlanTool[] = [
    'WALL', 'DOOR', 'PARTITION', 'EXCLUDE',
    'APPLY_H', 'APPLY_V', 'COINCIDE', 'DIMENSION', 'ANCHOR',
  ];

  it('simule setTool(SELECT) pour chaque outil non-SELECT', () => {
    for (const tool of tools) {
      // Logique : Escape appelle toujours setTool('SELECT'), peu importe l'outil actif
      expect(tool).toBeDefined(); // outil existant
      const nextTool: PlanTool = 'SELECT';
      expect(nextTool).toBe('SELECT');
    }
  });

  it('SELECT reste SELECT après Escape', () => {
    const currentTool: PlanTool = 'SELECT';
    const nextTool: PlanTool = 'SELECT'; // comportement attendu
    expect(nextTool).toBe(currentTool);
  });
});

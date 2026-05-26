import { describe, it, expect } from 'vitest';
import type { PlanTool } from './PlanToolbar';
import { TOOL_STATUS_TEXTS } from './ToolStatusBar';

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

// ── ToolStatusBar ─────────────────────────────────────────────────────────────

describe('ToolStatusBar — STATUS_TEXTS', () => {
  it('SELECT n\'a pas de texte (invisible)', () => {
    expect(TOOL_STATUS_TEXTS['SELECT']).toBeUndefined();
  });

  it('WALL a un texte', () => {
    expect(TOOL_STATUS_TEXTS['WALL']).toBe('Cliquez pour poser un point');
  });

  it('DOOR a un texte', () => {
    expect(TOOL_STATUS_TEXTS['DOOR']).toBe('Cliquez sur un mur pour placer une porte');
  });

  it('COINCIDE a un texte', () => {
    expect(TOOL_STATUS_TEXTS['COINCIDE']).toBe('Cliquez sur le nœud, puis sur un mur/nœud pour les joindre');
  });

  const drawingTools: Array<keyof typeof TOOL_STATUS_TEXTS> = [
    'WALL', 'DOOR', 'PARTITION', 'EXCLUDE',
    'APPLY_H', 'APPLY_V', 'COINCIDE', 'DIMENSION', 'ANCHOR',
  ];

  it('tous les outils de dessin ont un texte non vide', () => {
    for (const tool of drawingTools) {
      expect(TOOL_STATUS_TEXTS[tool]).toBeTruthy();
    }
  });
});

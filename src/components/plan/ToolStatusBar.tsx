'use client';
import type { PlanTool } from './PlanToolbar';

export const TOOL_STATUS_TEXTS: Partial<Record<PlanTool, string>> = {
  WALL:      'Cliquez pour poser un point',
  DOOR:      'Cliquez sur un mur pour placer une porte',
  PARTITION: 'Cliquez pour tracer une cloison',
  EXCLUDE:   'Délimitez la zone à exclure',
  APPLY_H:   "Cliquez sur un mur pour le verrouiller à l'horizontale",
  APPLY_V:   'Cliquez sur un mur pour le verrouiller à la verticale',
  COINCIDE:  'Cliquez sur le nœud, puis sur un mur/nœud pour les joindre',
  DIMENSION: 'Cliquez sur un premier nœud, puis sur le second',
  ANCHOR:    'Cliquez sur un nœud pour le figer en place',
};

export const ToolStatusBar = ({ tool }: { tool: PlanTool }) => {
  const text = TOOL_STATUS_TEXTS[tool];
  if (!text) return null;
  return (
    <div
      data-testid="tool-status-bar"
      className="pointer-events-none absolute left-1/2 top-3 z-10 hidden -translate-x-1/2 md:block mouse:block"
    >
      <span
        className="rounded-full px-3 py-1 text-xs backdrop-blur-sm"
        style={{
          background: 'var(--surf)',
          border: '1px solid var(--bdr)',
          color: 'var(--text2)',
        }}
      >
        {text}
      </span>
    </div>
  );
};

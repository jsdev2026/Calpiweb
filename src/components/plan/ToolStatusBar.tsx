'use client';
import type { PlanTool } from './PlanToolbar';

export const TOOL_STATUS_TEXTS: Partial<Record<PlanTool, string>> = {
  WALL:    'Cliquez pour poser un point',
  DOOR:    'Cliquez sur un mur pour placer une porte',
  EXCLUDE: 'Délimitez la zone à exclure du carrelage',
  DELETE:  'Cliquez sur un élément pour le supprimer — Échap pour quitter',
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

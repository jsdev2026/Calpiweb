'use client';
import type { PlanTool } from './PlanToolbar';
import { CanvasHint } from '@/components/panel/CanvasHint';

export const TOOL_STATUS_TEXTS: Partial<Record<PlanTool, string>> = {
  WALL: 'Cliquez pour poser un point',
  DOOR: 'Cliquez sur un mur pour placer une porte',
  EXCLUDE: 'Délimitez la zone à exclure du carrelage',
  DELETE: 'Cliquez sur un élément pour le supprimer — Échap pour quitter',
};

export const ToolStatusBar = ({ tool }: { tool: PlanTool }) => {
  const text = TOOL_STATUS_TEXTS[tool];
  if (!text) return null;
  // Sur smartphone, le texte de l'outil est dans l'en-tête du panneau
  return (
    <CanvasHint testId="tool-status-bar" desktopOnly>
      {text}
    </CanvasHint>
  );
};

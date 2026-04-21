'use client';

import { Hand, PenTool, Trash2, Undo } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export type PlanTool = 'draw' | 'pan';

interface PlanToolbarProps {
  tool: PlanTool;
  canUndo: boolean;
  onChangeTool: (tool: PlanTool) => void;
  onUndo: () => void;
  onClearAll: () => void;
}

export const PlanToolbar = ({
  tool,
  canUndo,
  onChangeTool,
  onUndo,
  onClearAll,
}: PlanToolbarProps) => (
  <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 rounded-lg bg-white p-2 shadow-md">
    <Button
      variant={tool === 'draw' ? 'primary' : 'ghost'}
      size="icon"
      onClick={() => onChangeTool('draw')}
      title="Dessiner (Murs)"
    >
      <PenTool size={20} />
    </Button>
    <Button
      variant={tool === 'pan' ? 'primary' : 'ghost'}
      size="icon"
      onClick={() => onChangeTool('pan')}
      title="Déplacer (Pan)"
    >
      <Hand size={20} />
    </Button>
    <div className="my-1 h-px w-full bg-slate-200" />
    <Button
      variant="ghost"
      size="icon"
      onClick={onUndo}
      disabled={!canUndo}
      title="Annuler le dernier point"
    >
      <Undo size={20} />
    </Button>
    <Button variant="danger" size="icon" onClick={onClearAll} title="Effacer tout">
      <Trash2 size={20} />
    </Button>
  </div>
);

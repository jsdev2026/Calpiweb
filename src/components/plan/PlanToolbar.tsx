'use client';

import { DoorOpen, Magnet, MousePointer2, PenTool, Pin, Trash2, Undo } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'APPLY_H' | 'APPLY_V' | 'COINCIDE' | 'ANCHOR';

interface PlanToolbarProps {
  tool: PlanTool;
  canUndo: boolean;
  wallThickness: number;
  onChangeTool: (tool: PlanTool) => void;
  onUndo: () => void;
  onClearRoom: () => void;
  onWallThicknessChange: (mm: number) => void;
}

export const PlanToolbar = ({
  tool,
  canUndo,
  wallThickness,
  onChangeTool,
  onUndo,
  onClearRoom,
  onWallThicknessChange,
}: PlanToolbarProps) => (
  <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-2 shadow-2xl backdrop-blur-md">
    {/* ── Drawing tools ── */}
    <p className="text-center text-[7px] font-black uppercase tracking-widest text-zinc-600">Dessin</p>
    <Button variant={tool === 'SELECT' ? 'active' : 'tool'} size="icon"
      onClick={() => onChangeTool('SELECT')} title="Sélectionner / Déplacer">
      <MousePointer2 size={18} />
    </Button>
    <Button variant={tool === 'WALL' ? 'active' : 'tool'} size="icon"
      onClick={() => onChangeTool('WALL')} title="Tracer des murs">
      <PenTool size={18} />
    </Button>
    <Button variant={tool === 'DOOR' ? 'active' : 'tool'} size="icon"
      onClick={() => onChangeTool('DOOR')} title="Placer une porte">
      <DoorOpen size={18} />
    </Button>

    <div className="mx-auto my-1 h-px w-8 bg-zinc-800" />

    {/* ── Constraint tools ── */}
    <p className="text-center text-[7px] font-black uppercase tracking-widest text-zinc-600">Contr.</p>
    <button type="button" onClick={() => onChangeTool('APPLY_H')}
      title="Contrainte Horizontale — cliquer un mur"
      className={`flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
        tool === 'APPLY_H'
          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
          : 'text-blue-400/70 hover:bg-blue-900/30 hover:text-blue-300'
      }`}>
      H
    </button>
    <button type="button" onClick={() => onChangeTool('APPLY_V')}
      title="Contrainte Verticale — cliquer un mur"
      className={`flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
        tool === 'APPLY_V'
          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50'
          : 'text-blue-400/70 hover:bg-blue-900/30 hover:text-blue-300'
      }`}>
      V
    </button>
    <button type="button" onClick={() => onChangeTool('COINCIDE')}
      title="Coïncidence nœud-nœud ou nœud-mur"
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
        tool === 'COINCIDE'
          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50'
          : 'text-emerald-400/70 hover:bg-emerald-900/30 hover:text-emerald-300'
      }`}>
      <Magnet size={18} />
    </button>
    <button type="button" onClick={() => onChangeTool('ANCHOR')}
      title="Ancrer / Désancrer un nœud (FIX)"
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
        tool === 'ANCHOR'
          ? 'bg-violet-600 text-white shadow-md shadow-violet-900/50'
          : 'text-violet-400/70 hover:bg-violet-900/30 hover:text-violet-300'
      }`}>
      <Pin size={18} />
    </button>

    <div className="mx-auto my-1 h-px w-8 bg-zinc-800" />

    {/* ── Actions ── */}
    <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
      <Undo size={18} />
    </Button>
    <Button variant="danger" size="icon" onClick={onClearRoom} title="Effacer la pièce active">
      <Trash2 size={18} />
    </Button>

    <div className="mx-auto my-1 h-px w-8 bg-zinc-800" />

    {/* ── Wall thickness ── */}
    <div className="flex flex-col items-center gap-1" title="Épaisseur murs (mm)">
      <span className="text-[7px] font-black uppercase tracking-widest text-zinc-600">Mur</span>
      <input type="number" min="10" max="500" step="10" value={wallThickness}
        onChange={(e) => onWallThicknessChange(parseInt(e.target.value, 10) || 100)}
        className="w-9 rounded bg-zinc-800 text-center text-[10px] font-bold text-zinc-300 outline-none hover:bg-zinc-700 focus:text-orange-400"
        title="Épaisseur des murs (mm)" />
    </div>
  </div>
);

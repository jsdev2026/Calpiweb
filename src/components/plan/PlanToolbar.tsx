'use client';

import { DoorOpen, Magnet, MousePointer2, PenTool, Pin, Ruler, Trash2, Undo, SplitSquareVertical, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'APPLY_H' | 'APPLY_V' | 'COINCIDE' | 'ANCHOR' | 'PARTITION' | 'EXCLUDE' | 'DIMENSION' | 'THICKNESS';

interface PlanToolbarProps {
  tool: PlanTool;
  canUndo: boolean;
  onChangeTool: (tool: PlanTool) => void;
  onUndo: () => void;
  onClearRoom: () => void;
}

export const PlanToolbar = ({
  tool,
  canUndo,
  onChangeTool,
  onUndo,
  onClearRoom,
}: PlanToolbarProps) => (
  <div
    className="absolute left-4 top-4 z-10 flex flex-col gap-1.5 overflow-y-auto rounded-2xl p-2 shadow-2xl backdrop-blur-md"
    style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', boxShadow: 'var(--sh-lg)', maxHeight: 'calc(100vh - 120px)', scrollbarWidth: 'none' }}>

    {/* ── Drawing tools ── */}
    <p className="text-center text-[7px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Dessin</p>
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

    <div className="mx-auto h-px w-8" style={{ background: 'var(--bdr)' }} />

    {/* ── Zone tools ── */}
    <p className="text-center text-[7px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Zones</p>
    <button type="button" onClick={() => onChangeTool('PARTITION')}
      title="Tracer une cloison (pointillés)"
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
        tool === 'PARTITION'
          ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
          : 'hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-300'
      }`}
      style={tool !== 'PARTITION' ? { color: 'var(--text2)' } : {}}>
      <SplitSquareVertical size={18} />
    </button>
    <button type="button" onClick={() => onChangeTool('EXCLUDE')}
      title="Délimiter une zone non carrelée"
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
        tool === 'EXCLUDE'
          ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
          : 'hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-300'
      }`}
      style={tool !== 'EXCLUDE' ? { color: 'var(--text2)' } : {}}>
      <Square size={18} />
    </button>

    <div className="mx-auto h-px w-8" style={{ background: 'var(--bdr)' }} />

    {/* ── Constraint tools ── */}
    <p className="text-center text-[7px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Contr.</p>
    <button type="button" onClick={() => onChangeTool('APPLY_H')}
      title="Contrainte Horizontale — cliquer un mur"
      className={`flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
        tool === 'APPLY_H'
          ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
          : 'hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300'
      }`}
      style={tool !== 'APPLY_H' ? { color: 'var(--text2)' } : {}}>
      H
    </button>
    <button type="button" onClick={() => onChangeTool('APPLY_V')}
      title="Contrainte Verticale — cliquer un mur"
      className={`flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
        tool === 'APPLY_V'
          ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
          : 'hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300'
      }`}
      style={tool !== 'APPLY_V' ? { color: 'var(--text2)' } : {}}>
      V
    </button>
    <button type="button" onClick={() => onChangeTool('COINCIDE')}
      title="Coïncidence nœud-nœud ou nœud-mur"
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
        tool === 'COINCIDE'
          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
          : 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-300'
      }`}
      style={tool !== 'COINCIDE' ? { color: 'var(--text2)' } : {}}>
      <Magnet size={18} />
    </button>
    <button type="button" onClick={() => onChangeTool('DIMENSION')}
      title="Cotation — cliquer deux nœuds pour mesurer/contraindre la distance"
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
        tool === 'DIMENSION'
          ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
          : 'hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-300'
      }`}
      style={tool !== 'DIMENSION' ? { color: 'var(--text2)' } : {}}>
      <Ruler size={16} />
    </button>
    <button type="button" onClick={() => onChangeTool('THICKNESS')}
      title="Épaisseur — cliquer un mur ou une cloison pour modifier son épaisseur"
      className={`flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
        tool === 'THICKNESS'
          ? 'bg-slate-500 text-white shadow-md shadow-slate-500/30'
          : 'hover:bg-slate-100 dark:hover:bg-slate-900/30 hover:text-slate-600 dark:hover:text-slate-300'
      }`}
      style={tool !== 'THICKNESS' ? { color: 'var(--text2)' } : {}}>
      E
    </button>
    <button type="button" onClick={() => onChangeTool('ANCHOR')}
      title="Ancrer / Désancrer un nœud (FIX)"
      className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
        tool === 'ANCHOR'
          ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
          : 'hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-300'
      }`}
      style={tool !== 'ANCHOR' ? { color: 'var(--text2)' } : {}}>
      <Pin size={18} />
    </button>

    <div className="mx-auto h-px w-8" style={{ background: 'var(--bdr)' }} />

    {/* ── Actions ── */}
    <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
      <Undo size={18} />
    </Button>
    <Button variant="danger" size="icon" onClick={onClearRoom} title="Effacer la pièce active">
      <Trash2 size={18} />
    </Button>

  </div>
);

'use client';

import { DoorOpen, Magnet, MousePointer2, PenTool, Pin, Redo2, Ruler, Trash2, Undo, SplitSquareVertical, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ToolTooltip } from './ToolTooltip';

export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'APPLY_H' | 'APPLY_V' | 'COINCIDE' | 'ANCHOR' | 'PARTITION' | 'EXCLUDE' | 'DIMENSION' | 'THICKNESS';

interface PlanToolbarProps {
  tool: PlanTool;
  canUndo: boolean;
  canRedo: boolean;
  onChangeTool: (tool: PlanTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearRoom: () => void;
}

const TOOL_TOOLTIPS = {
  SELECT:    { label: 'Sélectionner',           description: 'Déplacer un nœud ou un segment' },
  WALL:      { label: 'Tracer des murs',         description: 'Cliquez pour poser des points, Entrée pour fermer' },
  DOOR:      { label: 'Placer une porte',        description: 'Cliquez sur un mur pour y insérer une ouverture' },
  PARTITION: { label: 'Cloison (pointillés)',    description: 'Trace une séparation visuelle non porteuse' },
  EXCLUDE:   { label: 'Zone non carrelée',       description: 'Délimite une surface à exclure du carrelage' },
  APPLY_H:   { label: 'Contrainte horizontale',  description: "Fixe la distance horizontale d'un mur" },
  APPLY_V:   { label: 'Contrainte verticale',    description: "Fixe la distance verticale d'un mur" },
  COINCIDE:  { label: 'Coïncidence',             description: 'Aligne deux nœuds ou colle un nœud à un mur' },
  DIMENSION: { label: 'Cotation',                description: 'Mesure ou contraint la distance entre deux nœuds' },
  THICKNESS: { label: 'Épaisseur',               description: "Modifie l'épaisseur d'un mur ou d'une cloison" },
  ANCHOR:    { label: 'Ancrer un nœud',          description: "Fige un point pour qu'il ne soit pas déplacé" },
  undo:      { label: 'Annuler',                 description: "Ctrl+Z — revenir à l'état précédent" },
  redo:      { label: 'Rétablir',                description: 'Ctrl+Y — rétablir l\'action annulée' },
  clear:     { label: 'Effacer la pièce',        description: 'Supprime tous les points de la pièce active' },
} as const;

export const PlanToolbar = ({
  tool,
  canUndo,
  canRedo,
  onChangeTool,
  onUndo,
  onRedo,
  onClearRoom,
}: PlanToolbarProps) => (
  <div
    className="absolute left-4 top-4 z-10 hidden md:flex flex-col gap-1.5 overflow-y-auto rounded-2xl p-2 shadow-2xl backdrop-blur-md"
    style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', boxShadow: 'var(--sh-lg)', maxHeight: 'calc(100vh - 120px)', scrollbarWidth: 'none' }}>

    {/* ── Drawing tools ── */}
    <p className="text-center text-[7px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Dessin</p>
    <ToolTooltip {...TOOL_TOOLTIPS.SELECT}>
      <Button variant={tool === 'SELECT' ? 'active' : 'tool'} size="icon"
        onClick={() => onChangeTool('SELECT')}>
        <MousePointer2 size={18} />
      </Button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.WALL}>
      <Button variant={tool === 'WALL' ? 'active' : 'tool'} size="icon"
        onClick={() => onChangeTool('WALL')}>
        <PenTool size={18} />
      </Button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.DOOR}>
      <Button variant={tool === 'DOOR' ? 'active' : 'tool'} size="icon"
        onClick={() => onChangeTool('DOOR')}>
        <DoorOpen size={18} />
      </Button>
    </ToolTooltip>

    <div className="mx-auto h-px w-8" style={{ background: 'var(--bdr)' }} />

    {/* ── Zone tools ── */}
    <p className="text-center text-[7px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Zones</p>
    <ToolTooltip {...TOOL_TOOLTIPS.PARTITION}>
      <button type="button" onClick={() => onChangeTool('PARTITION')}
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
          tool === 'PARTITION'
            ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
            : 'hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-300'
        }`}
        style={tool !== 'PARTITION' ? { color: 'var(--text2)' } : {}}>
        <SplitSquareVertical size={18} />
      </button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.EXCLUDE}>
      <button type="button" onClick={() => onChangeTool('EXCLUDE')}
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
          tool === 'EXCLUDE'
            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
            : 'hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-300'
        }`}
        style={tool !== 'EXCLUDE' ? { color: 'var(--text2)' } : {}}>
        <Square size={18} />
      </button>
    </ToolTooltip>

    <div className="mx-auto h-px w-8" style={{ background: 'var(--bdr)' }} />

    {/* ── Constraint tools ── */}
    <p className="text-center text-[7px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Contr.</p>
    <ToolTooltip {...TOOL_TOOLTIPS.APPLY_H}>
      <button type="button" onClick={() => onChangeTool('APPLY_H')}
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
          tool === 'APPLY_H'
            ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
            : 'hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300'
        }`}
        style={tool !== 'APPLY_H' ? { color: 'var(--text2)' } : {}}>
        H
      </button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.APPLY_V}>
      <button type="button" onClick={() => onChangeTool('APPLY_V')}
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
          tool === 'APPLY_V'
            ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
            : 'hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300'
        }`}
        style={tool !== 'APPLY_V' ? { color: 'var(--text2)' } : {}}>
        V
      </button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.COINCIDE}>
      <button type="button" onClick={() => onChangeTool('COINCIDE')}
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
          tool === 'COINCIDE'
            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
            : 'hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-300'
        }`}
        style={tool !== 'COINCIDE' ? { color: 'var(--text2)' } : {}}>
        <Magnet size={18} />
      </button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.DIMENSION}>
      <button type="button" onClick={() => onChangeTool('DIMENSION')}
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
          tool === 'DIMENSION'
            ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
            : 'hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-300'
        }`}
        style={tool !== 'DIMENSION' ? { color: 'var(--text2)' } : {}}>
        <Ruler size={16} />
      </button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.THICKNESS}>
      <button type="button" onClick={() => onChangeTool('THICKNESS')}
        className={`flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
          tool === 'THICKNESS'
            ? 'bg-slate-500 text-white shadow-md shadow-slate-500/30'
            : 'hover:bg-slate-100 dark:hover:bg-slate-900/30 hover:text-slate-600 dark:hover:text-slate-300'
        }`}
        style={tool !== 'THICKNESS' ? { color: 'var(--text2)' } : {}}>
        E
      </button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.ANCHOR}>
      <button type="button" onClick={() => onChangeTool('ANCHOR')}
        className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
          tool === 'ANCHOR'
            ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
            : 'hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-300'
        }`}
        style={tool !== 'ANCHOR' ? { color: 'var(--text2)' } : {}}>
        <Pin size={18} />
      </button>
    </ToolTooltip>

    <div className="mx-auto h-px w-8" style={{ background: 'var(--bdr)' }} />

    {/* ── Actions ── */}
    <ToolTooltip {...TOOL_TOOLTIPS.undo}>
      <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo}>
        <Undo size={18} />
      </Button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.redo}>
      <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo}>
        <Redo2 size={18} />
      </Button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.clear}>
      <Button variant="danger" size="icon" onClick={onClearRoom}>
        <Trash2 size={18} />
      </Button>
    </ToolTooltip>

  </div>
);

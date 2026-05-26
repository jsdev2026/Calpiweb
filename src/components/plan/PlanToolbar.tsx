'use client';

import { DoorOpen, HelpCircle, Magnet, MousePointer2, PenTool, Pin, Redo2, Ruler, Trash2, Undo, SplitSquareVertical, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ToolTooltip } from './ToolTooltip';
import { WallThicknessControl } from './WallThicknessControl';

export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'APPLY_H' | 'APPLY_V' | 'COINCIDE' | 'ANCHOR' | 'PARTITION' | 'EXCLUDE' | 'DIMENSION' | 'DELETE';

interface PlanToolbarProps {
  tool: PlanTool;
  canUndo: boolean;
  canRedo: boolean;
  onChangeTool: (tool: PlanTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  canDelete: boolean;
  deleteTooltipLabel: string;
  wallThickness: number;
  onWallThicknessChange: (mm: number) => void;
  tutorialMode: boolean;
  onToggleTutorial: () => void;
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
  ANCHOR:    { label: 'Ancrer un nœud',          description: "Fige un point pour qu'il ne soit pas déplacé" },
  undo:      { label: 'Annuler',                 description: "Ctrl+Z — revenir à l'état précédent" },
  redo:      { label: 'Rétablir',                description: 'Ctrl+Y — rétablir l\'action annulée' },
  clear:     { label: 'Supprimer l\'élément', description: 'Supprime le mur, porte, cloison ou zone sélectionné' },
} as const;

const TB_CARD = 'bg-gray-50 border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800';

export const PlanToolbar = ({
  tool,
  canUndo,
  canRedo,
  onChangeTool,
  onUndo,
  onRedo,
  onDelete,
  canDelete,
  deleteTooltipLabel,
  wallThickness,
  onWallThicknessChange,
  tutorialMode,
  onToggleTutorial,
}: PlanToolbarProps) => (
  <>
  <div
    className={`absolute left-4 top-4 z-10 hidden md:flex mouse:flex flex-col gap-0.5 rounded-2xl p-1.5 shadow-2xl backdrop-blur-md ${tutorialMode ? 'overflow-visible' : 'overflow-y-auto'}`}
    style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', boxShadow: 'var(--sh-lg)', maxHeight: tutorialMode ? undefined : 'calc(100vh - 108px)', scrollbarWidth: 'none' }}>

    {/* ── Tutorial toggle ── */}
    <button
      type="button"
      aria-label="Mode tutorial"
      onClick={onToggleTutorial}
      className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
        tutorialMode
          ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
          : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
      }`}
    >
      <HelpCircle size={15} />
    </button>
    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />

    {/* ── Drawing tools ── */}
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.SELECT}>
        <Button variant={tool === 'SELECT' ? 'active' : 'tool'} size="icon" className="h-8 w-8"
          onClick={() => onChangeTool('SELECT')}>
          <MousePointer2 size={16} />
        </Button>
      </ToolTooltip>
      {tutorialMode && (
        <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>
          Sélectionner
        </span>
      )}
    </div>
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.WALL}>
        <Button variant={tool === 'WALL' ? 'active' : 'tool'} size="icon" className="h-8 w-8"
          onClick={() => onChangeTool('WALL')}>
          <PenTool size={16} />
        </Button>
      </ToolTooltip>
      {tutorialMode && (
        <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>
          Tracer des murs
        </span>
      )}
    </div>

    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />

    {/* ── Openings & zone tools ── */}
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.DOOR}>
        <Button variant={tool === 'DOOR' ? 'active' : 'tool'} size="icon" className="h-8 w-8"
          onClick={() => onChangeTool('DOOR')}>
          <DoorOpen size={16} />
        </Button>
      </ToolTooltip>
      {tutorialMode && (
        <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>
          Placer une porte
        </span>
      )}
    </div>
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.PARTITION}>
        <button type="button" onClick={() => onChangeTool('PARTITION')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
            tool === 'PARTITION'
              ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
              : `${TB_CARD} hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-300`
          }`}
          style={tool !== 'PARTITION' ? { color: 'var(--text2)' } : {}}>
          <SplitSquareVertical size={16} />
        </button>
      </ToolTooltip>
      {tutorialMode && (
        <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>
          Cloison (pointillés)
        </span>
      )}
    </div>
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.EXCLUDE}>
        <button type="button" onClick={() => onChangeTool('EXCLUDE')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
            tool === 'EXCLUDE'
              ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
              : `${TB_CARD} hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-300`
          }`}
          style={tool !== 'EXCLUDE' ? { color: 'var(--text2)' } : {}}>
          <Square size={16} />
        </button>
      </ToolTooltip>
      {tutorialMode && (
        <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>
          Zone non carrelée
        </span>
      )}
    </div>

    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />

    {/* ── Constraint tools ── */}
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.APPLY_H}>
        <button type="button" onClick={() => onChangeTool('APPLY_H')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-black transition-all ${
            tool === 'APPLY_H'
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
              : `${TB_CARD} hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300`
          }`}
          style={tool !== 'APPLY_H' ? { color: 'var(--text2)' } : {}}>
          H
        </button>
      </ToolTooltip>
      {tutorialMode && (
        <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>
          Contrainte horizontale
        </span>
      )}
    </div>
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.APPLY_V}>
        <button type="button" onClick={() => onChangeTool('APPLY_V')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl text-[12px] font-black transition-all ${
            tool === 'APPLY_V'
              ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30'
              : `${TB_CARD} hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-300`
          }`}
          style={tool !== 'APPLY_V' ? { color: 'var(--text2)' } : {}}>
          V
        </button>
      </ToolTooltip>
      {tutorialMode && (
        <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>
          Contrainte verticale
        </span>
      )}
    </div>
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.COINCIDE}>
        <button type="button" onClick={() => onChangeTool('COINCIDE')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
            tool === 'COINCIDE'
              ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
              : `${TB_CARD} hover:bg-emerald-100 dark:hover:bg-emerald-900/30 hover:text-emerald-600 dark:hover:text-emerald-300`
          }`}
          style={tool !== 'COINCIDE' ? { color: 'var(--text2)' } : {}}>
          <Magnet size={16} />
        </button>
      </ToolTooltip>
      {tutorialMode && (
        <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>
          Coïncidence
        </span>
      )}
    </div>
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.DIMENSION}>
        <button type="button" onClick={() => onChangeTool('DIMENSION')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
            tool === 'DIMENSION'
              ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
              : `${TB_CARD} hover:bg-orange-100 dark:hover:bg-orange-900/30 hover:text-orange-600 dark:hover:text-orange-300`
          }`}
          style={tool !== 'DIMENSION' ? { color: 'var(--text2)' } : {}}>
          <Ruler size={15} />
        </button>
      </ToolTooltip>
      {tutorialMode && (
        <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>
          Cotation
        </span>
      )}
    </div>
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.ANCHOR}>
        <button type="button" onClick={() => onChangeTool('ANCHOR')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${
            tool === 'ANCHOR'
              ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30'
              : `${TB_CARD} hover:bg-violet-100 dark:hover:bg-violet-900/30 hover:text-violet-600 dark:hover:text-violet-300`
          }`}
          style={tool !== 'ANCHOR' ? { color: 'var(--text2)' } : {}}>
          <Pin size={16} />
        </button>
      </ToolTooltip>
      {tutorialMode && (
        <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>
          Ancrer un nœud
        </span>
      )}
    </div>

    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />

    {/* ── Actions ── */}
    <ToolTooltip {...TOOL_TOOLTIPS.undo}>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo} disabled={!canUndo}>
        <Undo size={16} />
      </Button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.redo}>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo} disabled={!canRedo}>
        <Redo2 size={16} />
      </Button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.clear} description={deleteTooltipLabel}>
      <Button variant="danger" size="icon" className="h-8 w-8" onClick={onDelete} disabled={!canDelete}>
        <Trash2 size={16} />
      </Button>
    </ToolTooltip>

    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />
    <WallThicknessControl wallThickness={wallThickness} onChange={onWallThicknessChange} />

  </div>

  {/* Mobile: horizontal scrollable toolbar at bottom of canvas */}
  <div
    data-testid="plan-toolbar-mobile"
    className="absolute bottom-20 md:bottom-0 left-0 right-0 z-20 flex md:hidden mouse:hidden items-center gap-1 overflow-x-auto border-t border-gray-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 px-2 py-2 backdrop-blur-md"
    style={{ scrollbarWidth: 'none' }}
  >
    {/* Drawing tools */}
    <button
      type="button"
      aria-label="Sélectionner"
      onClick={() => onChangeTool('SELECT')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
        tool === 'SELECT' ? 'bg-orange-500 text-white shadow-md' : `${TB_CARD}`
      }`}
      style={tool !== 'SELECT' ? { color: 'var(--text2)' } : {}}
    >
      <MousePointer2 size={18} />
    </button>
    <button
      type="button"
      aria-label="Tracer des murs"
      onClick={() => onChangeTool('WALL')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
        tool === 'WALL' ? 'bg-orange-500 text-white shadow-md' : `${TB_CARD}`
      }`}
      style={tool !== 'WALL' ? { color: 'var(--text2)' } : {}}
    >
      <PenTool size={18} />
    </button>
    <button
      type="button"
      aria-label="Placer une porte"
      onClick={() => onChangeTool('DOOR')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
        tool === 'DOOR' ? 'bg-orange-500 text-white shadow-md' : `${TB_CARD}`
      }`}
      style={tool !== 'DOOR' ? { color: 'var(--text2)' } : {}}
    >
      <DoorOpen size={18} />
    </button>
    <button
      type="button"
      aria-label="Cloison (pointillés)"
      onClick={() => onChangeTool('PARTITION')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
        tool === 'PARTITION' ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30' : `${TB_CARD}`
      }`}
      style={tool !== 'PARTITION' ? { color: 'var(--text2)' } : {}}
    >
      <SplitSquareVertical size={18} />
    </button>
    <button
      type="button"
      aria-label="Zone non carrelée"
      onClick={() => onChangeTool('EXCLUDE')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
        tool === 'EXCLUDE' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : `${TB_CARD}`
      }`}
      style={tool !== 'EXCLUDE' ? { color: 'var(--text2)' } : {}}
    >
      <Square size={18} />
    </button>

    <div className="mx-1 h-6 w-px shrink-0 bg-gray-200 dark:bg-zinc-700" />

    {/* Constraint tools */}
    <button
      type="button"
      aria-label="Contrainte horizontale"
      onClick={() => onChangeTool('APPLY_H')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
        tool === 'APPLY_H' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30' : `${TB_CARD}`
      }`}
      style={tool !== 'APPLY_H' ? { color: 'var(--text2)' } : {}}
    >
      H
    </button>
    <button
      type="button"
      aria-label="Contrainte verticale"
      onClick={() => onChangeTool('APPLY_V')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-black transition-all ${
        tool === 'APPLY_V' ? 'bg-blue-500 text-white shadow-md shadow-blue-500/30' : `${TB_CARD}`
      }`}
      style={tool !== 'APPLY_V' ? { color: 'var(--text2)' } : {}}
    >
      V
    </button>
    <button
      type="button"
      aria-label="Cotation"
      onClick={() => onChangeTool('DIMENSION')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
        tool === 'DIMENSION' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30' : `${TB_CARD}`
      }`}
      style={tool !== 'DIMENSION' ? { color: 'var(--text2)' } : {}}
    >
      <Ruler size={18} />
    </button>
    <button
      type="button"
      aria-label="Coïncidence"
      onClick={() => onChangeTool('COINCIDE')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
        tool === 'COINCIDE' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : `${TB_CARD}`
      }`}
      style={tool !== 'COINCIDE' ? { color: 'var(--text2)' } : {}}
    >
      <Magnet size={18} />
    </button>
    <button
      type="button"
      aria-label="Ancrer un nœud"
      onClick={() => onChangeTool('ANCHOR')}
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
        tool === 'ANCHOR' ? 'bg-violet-500 text-white shadow-md shadow-violet-500/30' : `${TB_CARD}`
      }`}
      style={tool !== 'ANCHOR' ? { color: 'var(--text2)' } : {}}
    >
      <Pin size={18} />
    </button>
    {/* Actions — pinned right */}
    <div className="ml-auto mx-1 h-6 w-px shrink-0 bg-gray-200 dark:bg-zinc-700" />
    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onUndo} disabled={!canUndo}>
      <Undo size={18} />
    </Button>
    <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onRedo} disabled={!canRedo}>
      <Redo2 size={18} />
    </Button>
    <Button variant="danger" size="icon" className="h-10 w-10 shrink-0" onClick={onDelete} disabled={!canDelete}>
      <Trash2 size={18} />
    </Button>
  </div>
  </>
);

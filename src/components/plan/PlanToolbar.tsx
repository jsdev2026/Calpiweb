'use client';

import { DoorOpen, HelpCircle, Lock, MousePointer2, PenTool, Redo2, Square, Trash2, Undo } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ToolTooltip } from './ToolTooltip';
import { WallThicknessControl } from './WallThicknessControl';
import { TOOL_STATUS_TEXTS } from './ToolStatusBar';

export type PlanTool = 'SELECT' | 'WALL' | 'DOOR' | 'EXCLUDE' | 'DELETE' | 'LOCK';

interface PlanToolbarProps {
  tool: PlanTool;
  canUndo: boolean;
  canRedo: boolean;
  onChangeTool: (tool: PlanTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  wallThickness: number;
  onWallThicknessChange: (mm: number) => void;
  tutorialMode: boolean;
  onToggleTutorial: () => void;
}

const TOOL_TOOLTIPS = {
  SELECT:  { label: 'Sélectionner',      description: 'Déplacer un nœud ou un mur — Double-clic sur un mur pour modifier son épaisseur' },
  WALL:    { label: 'Tracer des murs',    description: 'Cliquez pour poser des points' },
  DOOR:    { label: 'Porte / Ouverture',  description: 'Cliquez sur un mur pour y insérer une ouverture' },
  EXCLUDE: { label: 'Zone non carrelée',  description: 'Délimitez la surface à exclure du carrelage' },
  undo:    { label: 'Annuler',            description: "Ctrl+Z — revenir à l'état précédent" },
  redo:    { label: 'Rétablir',           description: "Ctrl+Y — rétablir l'action annulée" },
  DELETE:  { label: 'Mode suppression',   description: 'Cliquez un élément pour le supprimer — Échap pour quitter' },
  LOCK:    { label: 'Verrouiller',         description: 'Cliquer un nœud ou un mur pour verrouiller / libérer sa position' },
} as const;

const TB_CARD = 'bg-gray-50 border border-gray-200 dark:bg-zinc-900 dark:border-zinc-800';

export const PlanToolbar = ({
  tool, canUndo, canRedo, onChangeTool, onUndo, onRedo,
  wallThickness, onWallThicknessChange, tutorialMode, onToggleTutorial,
}: PlanToolbarProps) => (
  <>
  <div
    className={`absolute left-4 top-4 z-10 hidden md:flex mouse:flex flex-col gap-0.5 rounded-2xl p-1.5 shadow-2xl backdrop-blur-md ${tutorialMode ? 'overflow-visible' : 'overflow-y-auto'}`}
    style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', boxShadow: 'var(--sh-lg)', maxHeight: tutorialMode ? undefined : 'calc(100vh - 108px)', scrollbarWidth: 'none' }}>

    <button type="button" aria-label="Mode tutorial" onClick={onToggleTutorial}
      className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${tutorialMode ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30' : 'text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`}>
      <HelpCircle size={15} />
    </button>
    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />

    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.SELECT}>
        <Button variant={tool === 'SELECT' ? 'active' : 'tool'} size="icon" className="h-8 w-8" onClick={() => onChangeTool('SELECT')}>
          <MousePointer2 size={16} />
        </Button>
      </ToolTooltip>
      {tutorialMode && <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>Sélectionner</span>}
    </div>
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.WALL}>
        <Button variant={tool === 'WALL' ? 'active' : 'tool'} size="icon" className="h-8 w-8" onClick={() => onChangeTool('WALL')}>
          <PenTool size={16} />
        </Button>
      </ToolTooltip>
      {tutorialMode && <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>Tracer des murs</span>}
    </div>

    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />

    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.DOOR}>
        <Button variant={tool === 'DOOR' ? 'active' : 'tool'} size="icon" className="h-8 w-8" onClick={() => onChangeTool('DOOR')}>
          <DoorOpen size={16} />
        </Button>
      </ToolTooltip>
      {tutorialMode && <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>Porte / Ouverture</span>}
    </div>
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.EXCLUDE}>
        <button type="button" onClick={() => onChangeTool('EXCLUDE')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${tool === 'EXCLUDE' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : `${TB_CARD} hover:bg-amber-100 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-300`}`}
          style={tool !== 'EXCLUDE' ? { color: 'var(--text2)' } : {}}>
          <Square size={16} />
        </button>
      </ToolTooltip>
      {tutorialMode && <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>Zone non carrelée</span>}
    </div>
    <div className="flex items-center">
      <ToolTooltip {...TOOL_TOOLTIPS.LOCK}>
        <button type="button" onClick={() => onChangeTool('LOCK')}
          className={`flex h-8 w-8 items-center justify-center rounded-xl transition-all ${tool === 'LOCK' ? 'text-white shadow-md' : `${TB_CARD} hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-600 dark:hover:text-green-300`}`}
          style={tool === 'LOCK' ? { background: '#27ae60', boxShadow: '0 4px 10px rgba(39,174,96,0.3)' } : { color: 'var(--text2)' }}>
          <Lock size={16} />
        </button>
      </ToolTooltip>
      {tutorialMode && <span className="ml-2 whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>Verrouiller</span>}
    </div>

    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />

    <ToolTooltip {...TOOL_TOOLTIPS.undo}>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onUndo} disabled={!canUndo}><Undo size={16} /></Button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.redo}>
      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRedo} disabled={!canRedo}><Redo2 size={16} /></Button>
    </ToolTooltip>
    <ToolTooltip {...TOOL_TOOLTIPS.DELETE}>
      <Button variant={tool === 'DELETE' ? 'danger' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => onChangeTool('DELETE')}>
        <Trash2 size={16} />
      </Button>
    </ToolTooltip>

    <div className="mx-auto h-px w-6" style={{ background: 'var(--bdr)' }} />
    <div className="flex items-center">
      <WallThicknessControl wallThickness={wallThickness} onChange={onWallThicknessChange} />
      {tutorialMode && (
        <div className="ml-2">
          <div className="whitespace-nowrap text-xs" style={{ color: 'var(--text2)' }}>Épaisseur</div>
          <div className="whitespace-nowrap text-[9px]" style={{ color: 'var(--muted)' }}>dbl-clic sur mur</div>
        </div>
      )}
    </div>
  </div>

  <div
    data-testid="plan-toolbar-mobile"
    className="fixed bottom-0 left-0 right-0 z-20 flex flex-col md:hidden mouse:hidden border-t border-gray-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md"
  >
    {/* Ligne 1 : outils + épaisseur */}
    <div className="flex items-center gap-1 px-2 pt-2 pb-1">
      <button type="button" aria-label="Sélectionner" onClick={() => onChangeTool('SELECT')}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'SELECT' ? 'bg-orange-500 text-white shadow-md' : TB_CARD}`}
        style={tool !== 'SELECT' ? { color: 'var(--text2)' } : {}}><MousePointer2 size={18} /></button>
      <button type="button" aria-label="Tracer des murs" onClick={() => onChangeTool('WALL')}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'WALL' ? 'bg-orange-500 text-white shadow-md' : TB_CARD}`}
        style={tool !== 'WALL' ? { color: 'var(--text2)' } : {}}><PenTool size={18} /></button>
      <button type="button" aria-label="Porte" onClick={() => onChangeTool('DOOR')}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'DOOR' ? 'bg-orange-500 text-white shadow-md' : TB_CARD}`}
        style={tool !== 'DOOR' ? { color: 'var(--text2)' } : {}}><DoorOpen size={18} /></button>
      <button type="button" aria-label="Zone non carrelée" onClick={() => onChangeTool('EXCLUDE')}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'EXCLUDE' ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30' : TB_CARD}`}
        style={tool !== 'EXCLUDE' ? { color: 'var(--text2)' } : {}}><Square size={18} /></button>
      <button type="button" aria-label="Verrouiller" onClick={() => onChangeTool('LOCK')}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'LOCK' ? 'text-white shadow-md' : TB_CARD}`}
        style={tool === 'LOCK' ? { background: '#27ae60', boxShadow: '0 4px 10px rgba(39,174,96,0.3)' } : { color: 'var(--text2)' }}><Lock size={18} /></button>
      <div className="ml-auto">
        <WallThicknessControl wallThickness={wallThickness} onChange={onWallThicknessChange} compact />
      </div>
    </div>
    {/* Ligne 2 : actions + texte d'outil actif */}
    <div className="flex items-center gap-1 px-2 pt-1" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}>
      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onUndo} disabled={!canUndo}><Undo size={18} /></Button>
      <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={onRedo} disabled={!canRedo}><Redo2 size={18} /></Button>
      <button type="button" aria-label="Mode suppression" onClick={() => onChangeTool('DELETE')}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${tool === 'DELETE' ? 'bg-red-500 text-white shadow-md shadow-red-500/30' : TB_CARD}`}
        style={tool !== 'DELETE' ? { color: 'var(--text2)' } : {}}><Trash2 size={18} /></button>
      {TOOL_STATUS_TEXTS[tool] && (
        <span className="ml-2 truncate text-[11px]" style={{ color: 'var(--text2)' }}>
          {TOOL_STATUS_TEXTS[tool]}
        </span>
      )}
    </div>
  </div>
  </>
);

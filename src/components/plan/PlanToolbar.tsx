'use client';

import {
  DoorOpen,
  Home,
  Lock,
  MousePointer2,
  PenTool,
  PencilRuler,
  Redo2,
  Square,
  Trash2,
  Undo,
  Layers,
} from 'lucide-react';
import {
  IconToolButton,
  PanelSection,
  PanelToolButton,
  SidePanel,
  type RailItem,
} from '@/components/panel/SidePanel';
import { WallThicknessControl } from './WallThicknessControl';
import { TOOL_STATUS_TEXTS } from './ToolStatusBar';
import { PlanRoomsList } from './PlanRoomsList';
import { selectRooms, useProjectStore } from '@/store/projectStore';
import { getPolygonArea } from '@/engine/geometry/polygon';
import { formatM2 } from '@/utils/formatters';

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
  readOnly?: boolean;
  /** Passe au Calepinage (présent dès qu'une pièce est fermée) */
  onNext?: () => void;
}

const TOOLS: {
  id: Exclude<PlanTool, 'DELETE'>;
  label: string;
  description: string;
  Icon: typeof PenTool;
}[] = [
  {
    id: 'SELECT',
    label: 'Sélectionner',
    description: 'Déplacer un nœud ou un mur — double-clic sur un mur pour modifier son épaisseur',
    Icon: MousePointer2,
  },
  {
    id: 'WALL',
    label: 'Tracer des murs',
    description: 'Cliquez pour poser des points',
    Icon: PenTool,
  },
  {
    id: 'DOOR',
    label: 'Porte / Ouverture',
    description: 'Cliquez sur un mur pour y insérer une ouverture',
    Icon: DoorOpen,
  },
  {
    id: 'EXCLUDE',
    label: 'Zone non carrelée',
    description: 'Délimitez la surface à exclure du carrelage',
    Icon: Square,
  },
  {
    id: 'LOCK',
    label: 'Verrouiller',
    description: 'Cliquer un nœud ou un mur pour verrouiller / libérer sa position',
    Icon: Lock,
  },
];

const SHORT: Record<PlanTool, string> = {
  SELECT: 'Sélection',
  WALL: 'Murs',
  DOOR: 'Porte',
  EXCLUDE: 'Zone exclue',
  LOCK: 'Verrouiller',
  DELETE: 'Supprimer',
};

const ICON = 16;

/** Panneau du mode Plan 2D : outils, historique, épaisseur des murs, pièces. */
export const PlanToolbar = ({
  tool,
  canUndo,
  canRedo,
  onChangeTool,
  onUndo,
  onRedo,
  wallThickness,
  onWallThicknessChange,
  readOnly = false,
  onNext,
}: PlanToolbarProps) => {
  const rooms = useProjectStore(selectRooms).filter((r) => r.points.length >= 3);
  const totalArea = rooms.reduce((a, r) => a + getPolygonArea(r.points), 0);
  const toolLabel = tool === 'DELETE' ? 'Supprimer' : TOOLS.find((t) => t.id === tool)!.label;
  const summary = TOOL_STATUS_TEXTS[tool] ?? `Outil : ${toolLabel.toLowerCase()}`;

  const railItems: RailItem[] = [
    ...TOOLS.map((t) => ({
      id: `tool-${t.id}`,
      label: t.label,
      description: t.description,
      icon: <t.Icon size={ICON} />,
      active: tool === t.id,
      onClick: () => onChangeTool(t.id),
    })),
    {
      id: 'undo',
      label: 'Annuler',
      description: 'Ctrl+Z — revenir à l’état précédent',
      icon: <Undo size={ICON} />,
      disabled: !canUndo,
      onClick: onUndo,
      divider: true,
    },
    {
      id: 'redo',
      label: 'Rétablir',
      description: 'Ctrl+Y — rétablir l’action annulée',
      icon: <Redo2 size={ICON} />,
      disabled: !canRedo,
      onClick: onRedo,
    },
    {
      id: 'tool-DELETE',
      label: 'Mode suppression',
      description: 'Cliquez un élément pour le supprimer — Échap pour quitter',
      icon: <Trash2 size={ICON} />,
      active: tool === 'DELETE',
      tone: 'danger',
      onClick: () => onChangeTool('DELETE'),
    },
    {
      id: 'epaisseur',
      label: 'Épaisseur des murs',
      icon: <Layers size={ICON} />,
      divider: true,
    },
    { id: 'pieces', label: 'Pièces', icon: <Home size={ICON} /> },
  ];

  const bar = (
    <>
      {/* Smartphone : une rangée d'icônes, toujours visible */}
      <div className="flex items-center justify-between gap-0.5 mouse:hidden md:hidden">
        {TOOLS.map((t) => (
          <IconToolButton
            key={t.id}
            label={t.label}
            icon={<t.Icon size={18} />}
            active={tool === t.id}
            onClick={() => onChangeTool(t.id)}
          />
        ))}
        <span className="mx-0.5 h-6 w-px shrink-0" style={{ background: 'var(--bdr)' }} />
        <IconToolButton
          label="Annuler"
          icon={<Undo size={18} />}
          disabled={!canUndo}
          onClick={onUndo}
        />
        <IconToolButton
          label="Rétablir"
          icon={<Redo2 size={18} />}
          disabled={!canRedo}
          onClick={onRedo}
        />
        <IconToolButton
          label="Mode suppression"
          icon={<Trash2 size={18} />}
          active={tool === 'DELETE'}
          tone="danger"
          onClick={() => onChangeTool('DELETE')}
        />
      </div>

      {/* Ordinateur : outils avec libellé */}
      <div className="hidden w-full flex-col gap-1.5 mouse:flex md:flex">
        <div className="grid grid-cols-2 gap-1.5">
          {TOOLS.map((t) => (
            <PanelToolButton
              key={t.id}
              label={SHORT[t.id]}
              icon={<t.Icon size={ICON} />}
              active={tool === t.id}
              onClick={() => onChangeTool(t.id)}
            />
          ))}
          <PanelToolButton
            label={SHORT.DELETE}
            icon={<Trash2 size={ICON} />}
            active={tool === 'DELETE'}
            tone="danger"
            onClick={() => onChangeTool('DELETE')}
          />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <PanelToolButton
            label="Annuler"
            icon={<Undo size={ICON} />}
            disabled={!canUndo}
            onClick={onUndo}
          />
          <PanelToolButton
            label="Rétablir"
            icon={<Redo2 size={ICON} />}
            disabled={!canRedo}
            onClick={onRedo}
          />
        </div>
      </div>
    </>
  );

  return (
    <SidePanel
      testId="plan-toolbar"
      icon={<PencilRuler size={18} />}
      title="Plan 2D"
      summary={summary}
      context={
        rooms.length > 0
          ? `${rooms.length} pièce${rooms.length > 1 ? 's' : ''} · ${formatM2(totalArea)}`
          : 'Aucune pièce fermée'
      }
      next={onNext ? { label: 'Calepinage', onClick: onNext } : undefined}
      bar={readOnly ? undefined : bar}
      railItems={readOnly ? [railItems[railItems.length - 1]!] : railItems}
    >
      {!readOnly && (
        <PanelSection id="epaisseur" title="Épaisseur des murs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px]" style={{ color: 'var(--text2)' }}>
              Nouveaux murs · double-clic sur un mur pour le modifier
            </span>
            <WallThicknessControl
              wallThickness={wallThickness}
              onChange={onWallThicknessChange}
              compact
            />
          </div>
        </PanelSection>
      )}
      <PanelSection id="pieces" title="Pièces">
        <PlanRoomsList readOnly={readOnly} />
      </PanelSection>
    </SidePanel>
  );
};

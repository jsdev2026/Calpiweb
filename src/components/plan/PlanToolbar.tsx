'use client';

import { DoorOpen, MousePointer2, PenTool, Plus, Trash2, Undo } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { Room } from '@/types/project';

export type PlanTool = 'SELECT' | 'WALL' | 'DOOR';

interface PlanToolbarProps {
  tool: PlanTool;
  canUndo: boolean;
  rooms: Room[];
  activeRoomId: string | null;
  wallThickness: number;
  onChangeTool: (tool: PlanTool) => void;
  onUndo: () => void;
  onClearRoom: () => void;
  onAddRoom: () => void;
  onRemoveRoom: (roomId: string) => void;
  onSelectRoom: (roomId: string) => void;
  onRenameRoom: (roomId: string, name: string) => void;
  onWallThicknessChange: (mm: number) => void;
}

export const PlanToolbar = ({
  tool,
  canUndo,
  rooms,
  activeRoomId,
  wallThickness,
  onChangeTool,
  onUndo,
  onClearRoom,
  onAddRoom,
  onRemoveRoom,
  onSelectRoom,
  onRenameRoom,
  onWallThicknessChange,
}: PlanToolbarProps) => {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef<HTMLInputElement>(null);

  const startRename = (room: Room) => {
    setRenamingId(room.id);
    setRenameValue(room.name ?? '');
    setTimeout(() => renameRef.current?.select(), 10);
  };

  const commitRename = () => {
    if (renamingId) {
      onRenameRoom(renamingId, renameValue.trim());
      setRenamingId(null);
    }
  };

  return (
    <div className="absolute left-4 top-4 z-10 flex flex-col gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-2 shadow-2xl backdrop-blur-md">
      <Button
        variant={tool === 'SELECT' ? 'active' : 'tool'}
        size="icon"
        onClick={() => onChangeTool('SELECT')}
        title="Sélectionner / Déplacer"
      >
        <MousePointer2 size={20} />
      </Button>
      <Button
        variant={tool === 'WALL' ? 'active' : 'tool'}
        size="icon"
        onClick={() => onChangeTool('WALL')}
        title="Tracer des murs"
      >
        <PenTool size={20} />
      </Button>
      <Button
        variant={tool === 'DOOR' ? 'active' : 'tool'}
        size="icon"
        onClick={() => onChangeTool('DOOR')}
        title="Placer une porte"
      >
        <DoorOpen size={20} />
      </Button>

      <div className="mx-auto my-1 h-px w-8 bg-zinc-800" />

      <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
        <Undo size={20} />
      </Button>
      <Button variant="danger" size="icon" onClick={onClearRoom} title="Effacer la pièce active">
        <Trash2 size={20} />
      </Button>

      <div className="mx-auto my-1 h-px w-8 bg-zinc-800" />

      {/* Wall thickness */}
      <div className="flex flex-col items-center gap-1" title="Épaisseur murs (mm)">
        <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-600">Mur</span>
        <input
          type="number"
          min="10"
          max="500"
          step="10"
          value={wallThickness}
          onChange={(e) => onWallThicknessChange(parseInt(e.target.value, 10) || 100)}
          className="w-8 rounded bg-zinc-800 text-center text-[10px] font-bold text-zinc-300 outline-none hover:bg-zinc-700 focus:text-orange-400"
          title="Épaisseur des murs (mm)"
        />
      </div>

      <div className="mx-auto my-1 h-px w-8 bg-zinc-800" />

      {/* Room list */}
      <div className="flex flex-col gap-1">
        {rooms.map((room, i) => (
          <div key={room.id} className="group relative">
            {renamingId === room.id ? (
              <input
                ref={renameRef}
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingId(null);
                }}
                className="h-8 w-8 rounded-lg bg-zinc-700 text-center text-[9px] font-bold text-orange-400 outline-none"
              />
            ) : (
              <button
                type="button"
                title={room.name ? `${room.name} (double-clic pour renommer)` : `Pièce ${i + 1} — double-clic pour nommer`}
                onClick={() => onSelectRoom(room.id)}
                onDoubleClick={() => startRename(room)}
                className={`flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg text-[10px] font-black transition-all ${
                  room.id === activeRoomId
                    ? 'bg-orange-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {room.name ? room.name.slice(0, 2).toUpperCase() : i + 1}
              </button>
            )}
            {rooms.length > 1 && (
              <button
                type="button"
                title="Supprimer la pièce"
                onClick={() => onRemoveRoom(room.id)}
                className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-900 text-[8px] text-red-300 group-hover:flex"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <Button variant="ghost" size="icon" onClick={onAddRoom} title="Ajouter une pièce" className="mt-1">
          <Plus size={18} />
        </Button>
      </div>
    </div>
  );
};

'use client';

import { Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import type { Room } from '@/types/project';

interface RoomTabsProps {
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
  onAddRoom: () => void;
  onRemoveRoom: (id: string) => void;
  onRenameRoom: (id: string, name: string) => void;
}

export const RoomTabs = ({
  rooms,
  activeRoomId,
  onSelectRoom,
  onAddRoom,
  onRemoveRoom,
  onRenameRoom,
}: RoomTabsProps) => {
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
    <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-1.5 shadow-2xl backdrop-blur-md">
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
              className="h-8 w-28 rounded-lg bg-zinc-700 px-3 text-center text-[11px] font-bold text-orange-400 outline-none"
            />
          ) : (
            <button
              type="button"
              title={room.name ? `${room.name} (double-clic pour renommer)` : `Pièce ${i + 1} — double-clic pour nommer`}
              onClick={() => onSelectRoom(room.id)}
              onDoubleClick={() => startRename(room)}
              className={`flex h-8 min-w-[2.5rem] items-center justify-center rounded-xl px-3 text-[11px] font-bold transition-all ${
                room.id === activeRoomId
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
              }`}
            >
              {room.name ? room.name : `Pièce ${i + 1}`}
            </button>
          )}
          {rooms.length > 1 && (
            <button
              type="button"
              title="Supprimer la pièce"
              onClick={() => onRemoveRoom(room.id)}
              className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-red-900 text-[9px] text-red-300 group-hover:flex"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <div className="mx-1 h-5 w-px bg-zinc-700" />
      <button
        type="button"
        onClick={onAddRoom}
        title="Ajouter une pièce"
        className="flex h-8 w-8 items-center justify-center rounded-xl text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
      >
        <Plus size={16} />
      </button>
    </div>
  );
};

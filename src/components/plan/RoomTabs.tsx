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
  onClearRoom?: () => void;
  vertical?: boolean;
}

export const RoomTabs = ({
  rooms,
  activeRoomId,
  onSelectRoom,
  onAddRoom,
  onRemoveRoom,
  onRenameRoom,
  onClearRoom,
  vertical = false,
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
    <div className={`${vertical ? 'flex-col' : 'flex items-center'} flex gap-1 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-1.5 shadow-2xl backdrop-blur-md`}>
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
              className="h-8 w-28 rounded-lg bg-gray-100 dark:bg-zinc-700 px-3 text-center text-[11px] font-bold text-orange-600 dark:text-orange-400 outline-none"
            />
          ) : (
            <button
              type="button"
              title={room.name ? `${room.name} (double-clic pour renommer)` : `Pièce ${i + 1} — double-clic pour nommer`}
              onClick={() => onSelectRoom(room.id)}
              onDoubleClick={() => startRename(room)}
              onContextMenu={room.id === activeRoomId && onClearRoom ? (e) => { e.preventDefault(); onClearRoom(); } : undefined}
              className={`flex h-8 min-w-[2.5rem] items-center justify-center rounded-xl px-3 text-[11px] font-bold transition-all ${
                room.id === activeRoomId
                  ? 'bg-orange-600 text-white shadow-md'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
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
      <div className={vertical ? 'my-0.5 h-px w-full bg-gray-200 dark:bg-zinc-700' : 'mx-1 h-5 w-px bg-gray-200 dark:bg-zinc-700'} />
      <button
        type="button"
        onClick={onAddRoom}
        title="Ajouter une pièce"
        className="flex h-8 w-8 items-center justify-center rounded-xl text-gray-400 dark:text-zinc-500 transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800 hover:text-gray-700 dark:hover:text-zinc-300"
      >
        <Plus size={16} />
      </button>
    </div>
  );
};

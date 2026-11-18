'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { selectRooms, useProjectStore } from '@/store/projectStore';
import { getPolygonArea } from '@/engine/geometry/polygon';
import { formatM2 } from '@/utils/formatters';
import type { Room } from '@/types/project';

/** Liste des pièces fermées (section « Pièces » du panneau Plan 2D), renommables. */
export const PlanRoomsList = ({ readOnly = false }: { readOnly?: boolean }) => {
  const rooms = useProjectStore(selectRooms);
  const renameWallRoom = useProjectStore((s) => s.renameWallRoom);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = (room: Room) => {
    if (readOnly) return;
    setRenamingId(room.id);
    setRenameValue(room.name ?? '');
  };

  const commitRename = () => {
    if (renamingId) {
      renameWallRoom(renamingId, renameValue.trim());
      setRenamingId(null);
    }
  };

  useEffect(() => {
    if (renamingId) inputRef.current?.select();
  }, [renamingId]);

  if (rooms.length === 0) {
    return (
      <p className="text-[12px]" style={{ color: 'var(--muted)' }}>
        Aucune pièce fermée — tracez des murs jusqu’à refermer une pièce.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {rooms.map((room) => (
        <li
          key={room.id}
          className="flex min-h-[36px] items-center gap-2 border-b last:border-b-0"
          style={{ borderColor: 'var(--bdr)' }}
        >
          {renamingId === room.id ? (
            <input
              ref={inputRef}
              aria-label="Nom de la pièce"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setRenamingId(null);
              }}
              className="h-8 min-w-0 flex-1 rounded-lg border px-2 text-[12.5px] font-semibold outline-none"
              style={{
                borderColor: 'var(--accent)',
                background: 'var(--surf)',
                color: 'var(--text)',
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => startRename(room)}
              disabled={readOnly}
              title={readOnly ? undefined : 'Renommer'}
              className="group flex min-w-0 flex-1 items-center gap-1.5 text-left text-[12.5px] font-semibold"
              style={{ color: 'var(--text)' }}
            >
              <span className="truncate">{room.name}</span>
              {!readOnly && (
                <Pencil
                  size={12}
                  aria-hidden
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: 'var(--muted)' }}
                />
              )}
            </button>
          )}
          <span className="shrink-0 text-[12px] tabular-nums" style={{ color: 'var(--text2)' }}>
            {formatM2(getPolygonArea(room.points))}
          </span>
        </li>
      ))}
    </ul>
  );
};

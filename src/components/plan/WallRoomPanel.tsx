// src/components/plan/WallRoomPanel.tsx
'use client';

import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { GripVertical } from 'lucide-react';
import { useProjectStore } from '@/store/projectStore';
import { selectRooms } from '@/store/projectStore';
import { getPolygonArea } from '@/engine/geometry/polygon';
import { formatM2 } from '@/utils/formatters';
import type { SnapZone } from './useDraggableSnap';
import type { Room } from '@/types/project';

interface WallRoomPanelProps {
  zone: SnapZone;
  isDragging: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
  tutorialMode?: boolean;
}

const CANVAS_TOP_PX      = 92;
const SIDE_LEFT_NORMAL   = 72;
const SIDE_LEFT_TUTORIAL = 216;

const getPanelStyle = (zone: SnapZone, tutorialMode: boolean): React.CSSProperties => {
  if (zone === 'SIDE') return { position: 'fixed', left: tutorialMode ? SIDE_LEFT_TUTORIAL : SIDE_LEFT_NORMAL, top: CANVAS_TOP_PX + 16, zIndex: 10 };
  if (zone === 'TOP')  return { position: 'fixed', top: CANVAS_TOP_PX + 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 };
  return { position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 };
};

const getDropZoneStyle = (zone: SnapZone, tutorialMode: boolean): React.CSSProperties => {
  if (zone === 'SIDE') {
    const left = (tutorialMode ? SIDE_LEFT_TUTORIAL : SIDE_LEFT_NORMAL) - 8;
    return { position: 'fixed', left, top: CANVAS_TOP_PX + 8, width: 140, height: 200, zIndex: 9, borderRadius: 16 };
  }
  if (zone === 'TOP')  return { position: 'fixed', left: '25%', top: CANVAS_TOP_PX + 4, width: '50%', height: 56, zIndex: 9, borderRadius: 16 };
  return { position: 'fixed', left: '25%', bottom: 4, width: '50%', height: 56, zIndex: 9, borderRadius: 16 };
};

export const WallRoomPanel = ({
  zone,
  isDragging,
  onPointerDown,
  tutorialMode = false,
}: WallRoomPanelProps) => {
  const rooms = useProjectStore(selectRooms);
  const renameWallRoom = useProjectStore((s) => s.renameWallRoom);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = (room: Room) => {
    setRenamingId(room.id);
    setRenameValue(room.name ?? '');
    setTimeout(() => inputRef.current?.select(), 10);
  };

  const commitRename = () => {
    if (renamingId) {
      renameWallRoom(renamingId, renameValue.trim());
      setRenamingId(null);
    }
  };

  return (
    <>
      {isDragging && (['SIDE', 'TOP', 'BOTTOM'] as SnapZone[]).map((z) => (
        <div
          key={z}
          className="pointer-events-none"
          style={{
            ...getDropZoneStyle(z, tutorialMode),
            border: '2px dashed rgba(249,115,22,0.4)',
            background: 'rgba(249,115,22,0.06)',
          }}
        />
      ))}

      <div
        className={`group ${isDragging ? '' : 'transition-all duration-150 ease-out'}`}
        style={getPanelStyle(zone, tutorialMode)}
      >
        <div
          className="absolute -right-5 top-1/2 -translate-y-1/2 flex h-8 w-5 cursor-grab items-center justify-center rounded-r-lg opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
          style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}
          onPointerDown={onPointerDown}
        >
          <GripVertical size={12} style={{ color: 'var(--muted)' }} />
        </div>

        <div
          className="flex flex-col gap-1 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 p-1.5 shadow-2xl backdrop-blur-md"
          style={{ minWidth: 140 }}
        >
          <p
            className="px-3 pt-1 pb-0 text-[9px] font-black uppercase tracking-[0.15em]"
            style={{ color: 'var(--muted)' }}
          >
            Pièces
          </p>
          <div className="mx-2 h-px bg-gray-200 dark:bg-zinc-700" />

          {rooms.length === 0 ? (
            <p className="px-3 py-2 text-[11px] italic" style={{ color: 'var(--muted)' }}>
              Aucune pièce fermée
            </p>
          ) : (
            rooms.map((room) => (
              <div key={room.id} className="rounded-xl px-3 py-1.5">
                {renamingId === room.id ? (
                  <input
                    ref={inputRef}
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    className="w-full rounded bg-zinc-800 px-1 text-[11px] font-bold text-orange-400 outline-none"
                  />
                ) : (
                  <p
                    className="text-[11px] font-bold text-orange-500 dark:text-orange-400 cursor-pointer select-none"
                    title="Double-clic pour renommer"
                    onDoubleClick={() => startRename(room)}
                  >
                    {room.name}
                  </p>
                )}
                <p className="text-[10px]" style={{ color: 'var(--text2)' }}>
                  {formatM2(getPolygonArea(room.points))}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};

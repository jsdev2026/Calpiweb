// src/components/plan/RoomPanel.tsx
'use client';

import type { PointerEvent as ReactPointerEvent } from 'react';
import { GripVertical } from 'lucide-react';
import { RoomTabs } from './RoomTabs';
import type { SnapZone } from './useDraggableSnap';
import type { Room } from '@/types/project';

interface RoomPanelProps {
  rooms: Room[];
  activeRoomId: string | null;
  onSelectRoom: (id: string) => void;
  onAddRoom: () => void;
  onRemoveRoom: (id: string) => void;
  onRenameRoom: (id: string, name: string) => void;
  zone: SnapZone;
  isDragging: boolean;
  onPointerDown: (e: ReactPointerEvent) => void;
}

// topbar (48px) + tabs (44px) = canvas starts at 92px from viewport top
const CANVAS_TOP_PX = 92;

const PANEL_STYLE: Record<SnapZone, React.CSSProperties> = {
  SIDE:   { position: 'fixed', left: 72, top: CANVAS_TOP_PX + 16, zIndex: 10 },
  TOP:    { position: 'fixed', top: CANVAS_TOP_PX + 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 },
  BOTTOM: { position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 },
};

const DROP_ZONE_STYLE: Record<SnapZone, React.CSSProperties> = {
  SIDE:   { position: 'fixed', left: 64,   top: CANVAS_TOP_PX + 8, width: 140, height: 200, zIndex: 9, borderRadius: 16 },
  TOP:    { position: 'fixed', left: '25%', top: CANVAS_TOP_PX + 4, width: '50%', height: 56, zIndex: 9, borderRadius: 16 },
  BOTTOM: { position: 'fixed', left: '25%', bottom: 4, width: '50%', height: 56, zIndex: 9, borderRadius: 16 },
};

export const RoomPanel = ({
  rooms,
  activeRoomId,
  onSelectRoom,
  onAddRoom,
  onRemoveRoom,
  onRenameRoom,
  zone,
  isDragging,
  onPointerDown,
}: RoomPanelProps) => (
  <>
    {isDragging && (['SIDE', 'TOP', 'BOTTOM'] as SnapZone[]).map((z) => (
      <div
        key={z}
        className="pointer-events-none"
        style={{
          ...DROP_ZONE_STYLE[z],
          border: '2px dashed rgba(249,115,22,0.4)',
          background: 'rgba(249,115,22,0.06)',
        }}
      />
    ))}

    <div
      className={`group ${isDragging ? '' : 'transition-all duration-150 ease-out'}`}
      style={PANEL_STYLE[zone]}
    >
      <div
        className="absolute -left-5 top-1/2 -translate-y-1/2 flex h-8 w-5 cursor-grab items-center justify-center rounded-l-lg opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}
        onPointerDown={onPointerDown}
      >
        <GripVertical size={12} style={{ color: 'var(--muted)' }} />
      </div>

      <RoomTabs
        rooms={rooms}
        activeRoomId={activeRoomId}
        onSelectRoom={onSelectRoom}
        onAddRoom={onAddRoom}
        onRemoveRoom={onRemoveRoom}
        onRenameRoom={onRenameRoom}
      />
    </div>
  </>
);

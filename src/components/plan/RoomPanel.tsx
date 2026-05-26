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
  tutorialMode?: boolean;
}

// topbar (48px) + tabs (44px) = canvas starts at 92px from viewport top
const CANVAS_TOP_PX = 92;

// In tutorial mode the toolbar expands with labels (~198px right edge).
// SIDE_LEFT_NORMAL : right of collapsed toolbar (w-8 button + p-1.5 padding + left-4 offset)
// SIDE_LEFT_TUTORIAL: right of expanded toolbar (button + gap + longest label "Contrainte horizontale")
const SIDE_LEFT_NORMAL   = 72;
const SIDE_LEFT_TUTORIAL = 216;

const getPanelStyle = (zone: SnapZone, tutorialMode: boolean): React.CSSProperties => {
  if (zone === 'SIDE') {
    return { position: 'fixed', left: tutorialMode ? SIDE_LEFT_TUTORIAL : SIDE_LEFT_NORMAL, top: CANVAS_TOP_PX + 16, zIndex: 10 };
  }
  if (zone === 'TOP')    return { position: 'fixed', top: CANVAS_TOP_PX + 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 };
  return { position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10 };
};

const getDropZoneStyle = (zone: SnapZone, tutorialMode: boolean): React.CSSProperties => {
  if (zone === 'SIDE') {
    const left = (tutorialMode ? SIDE_LEFT_TUTORIAL : SIDE_LEFT_NORMAL) - 8;
    return { position: 'fixed', left, top: CANVAS_TOP_PX + 8, width: 140, height: 200, zIndex: 9, borderRadius: 16 };
  }
  if (zone === 'TOP')    return { position: 'fixed', left: '25%', top: CANVAS_TOP_PX + 4, width: '50%', height: 56, zIndex: 9, borderRadius: 16 };
  return { position: 'fixed', left: '25%', bottom: 4, width: '50%', height: 56, zIndex: 9, borderRadius: 16 };
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
  tutorialMode = false,
}: RoomPanelProps) => (
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

      <RoomTabs
        rooms={rooms}
        activeRoomId={activeRoomId}
        onSelectRoom={onSelectRoom}
        onAddRoom={onAddRoom}
        onRemoveRoom={onRemoveRoom}
        onRenameRoom={onRenameRoom}
        vertical={zone === 'SIDE'}
      />
    </div>
  </>
);

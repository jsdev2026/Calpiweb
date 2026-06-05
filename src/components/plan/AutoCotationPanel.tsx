'use client';

import React, { useState } from 'react';
import type { AutoCotation, Wall, WallNode } from '@/types/wall';
import type { Point } from '@/types/plan';
import { cmToMm, mmToCm } from '@/utils/units';

export function computeNewNode2(
  wall: Wall,
  nodes: WallNode[],
  newLabelMm: number,
  side: AutoCotation['side'],
): Point {
  const n1 = nodes.find((n) => n.id === wall.node1Id)!;
  const n2 = nodes.find((n) => n.id === wall.node2Id)!;
  const dx = n2.x - n1.x;
  const dy = n2.y - n1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const dir: Point = len < 1e-10 ? { x: 1, y: 0 } : { x: dx / len, y: dy / len };

  const nodeDist =
    side === 'exterior' ? newLabelMm - wall.thickness :
    side === 'interior' ? newLabelMm + wall.thickness :
    newLabelMm;

  return { x: n1.x + dir.x * nodeDist, y: n1.y + dir.y * nodeDist };
}

function anchorDistMm(cot: AutoCotation): number {
  const dx = cot.anchor2.x - cot.anchor1.x;
  const dy = cot.anchor2.y - cot.anchor1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

const SIDE_LABEL: Record<AutoCotation['side'], string> = {
  exterior: 'Extérieur',
  interior: 'Intérieur',
  isolated: 'Isolé',
};

const SIDE_COLOR: Record<AutoCotation['side'], string> = {
  exterior: 'text-green-400',
  interior: 'text-blue-400',
  isolated: 'text-orange-400',
};

interface AutoCotationPanelProps {
  cot: AutoCotation;
  wall: Wall;
  nodes: WallNode[];
  screenX: number;
  screenY: number;
  onApply: (nodeId: string, newPos: Point) => void;
  onClose: () => void;
}

export const AutoCotationPanel = ({
  cot, wall, nodes, screenX, screenY, onApply, onClose,
}: AutoCotationPanelProps) => {
  const [rawValue, setRawValue] = useState(
    () => mmToCm(anchorDistMm(cot)).toFixed(1),
  );
  const [error, setError] = useState<string | null>(null);

  const handleApply = () => {
    const val = parseFloat(rawValue);
    if (isNaN(val) || val <= 0) {
      setError('Valeur invalide (> 0 requis)');
      return;
    }
    setError(null);
    const newPos = computeNewNode2(wall, nodes, cmToMm(val), cot.side);
    onApply(wall.node2Id, newPos);
    onClose();
  };

  const above = screenY > 160;
  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    left: screenX,
    top: above ? screenY - 10 : screenY + 10,
    transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
    zIndex: 30,
  };

  return (
    <div style={panelStyle} className="w-52 rounded-xl border border-orange-500/60 bg-zinc-900 p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
          Côte sélectionnée
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-sm leading-none text-zinc-500 hover:text-zinc-300"
        >
          ✕
        </button>
      </div>

      <div className="mb-2">
        <span className={`text-[10px] font-bold ${SIDE_COLOR[cot.side]}`}>
          {SIDE_LABEL[cot.side]}
        </span>
      </div>

      <div className="mb-3">
        <div className="mb-1 text-[10px] text-zinc-500">Longueur</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            min="0.1"
            autoFocus
            value={rawValue}
            onChange={(e) => { setRawValue(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); if (e.key === 'Escape') onClose(); }}
            className="w-20 rounded border border-orange-500 bg-zinc-800 px-2 py-1 text-sm font-bold text-white outline-none"
          />
          <span className="text-xs text-zinc-500">cm</span>
          <button
            type="button"
            onClick={handleApply}
            className="rounded bg-orange-500 px-2 py-1 text-xs font-bold text-white hover:bg-orange-600"
          >
            ↵
          </button>
        </div>
        {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
      </div>

      <div className="text-[10px] text-zinc-600">Ancre fixe : nœud 1 — Déplace : nœud 2</div>
    </div>
  );
};

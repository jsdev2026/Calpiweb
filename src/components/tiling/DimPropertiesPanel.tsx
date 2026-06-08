'use client';

import { useState } from 'react';
import type { TilingDimension } from '@/types/tilingDimension';
import { mmToCm, cmToMm } from '@/utils/units';
import { useProjectStore } from '@/store/projectStore';

interface DimPropertiesPanelProps {
  dim: TilingDimension;
  onClose: () => void;
}

function projectedLengthMm(dim: TilingDimension): number {
  if (dim.direction === 'H') return Math.abs(dim.p2.x - dim.p1.x);
  if (dim.direction === 'V') return Math.abs(dim.p2.y - dim.p1.y);
  const angle = dim.parallelAngle ?? 0;
  return Math.abs(
    (dim.p2.x - dim.p1.x) * Math.cos(angle) +
    (dim.p2.y - dim.p1.y) * Math.sin(angle),
  );
}

export function computeNewP2(
  dim: TilingDimension,
  newDistMm: number,
): { x: number; y: number } {
  if (dim.direction === 'H') {
    return {
      x: dim.p1.x + Math.sign(dim.p2.x - dim.p1.x) * newDistMm,
      y: dim.p2.y,
    };
  }
  if (dim.direction === 'V') {
    return {
      x: dim.p2.x,
      y: dim.p1.y + Math.sign(dim.p2.y - dim.p1.y) * newDistMm,
    };
  }
  const angle = dim.parallelAngle ?? 0;
  return {
    x: dim.p1.x + Math.cos(angle) * newDistMm,
    y: dim.p1.y + Math.sin(angle) * newDistMm,
  };
}

function dirLabel(dir: TilingDimension['direction']): string {
  if (dir === 'H') return 'Horizontal (H)';
  if (dir === 'V') return 'Vertical (V)';
  return 'Parallèle au mur';
}

export const DimPropertiesPanel = ({ dim, onClose }: DimPropertiesPanelProps) => {
  const [rawValue, setRawValue] = useState(
    () => mmToCm(projectedLengthMm(dim)).toFixed(1),
  );
  const [error, setError] = useState<string | null>(null);

  const updateNode = useProjectStore((s) => s.updateNode);
  const updateTilingDimension = useProjectStore((s) => s.updateTilingDimension);

  const canEdit = Boolean(dim.p2NodeId);

  const handleApply = () => {
    const val = parseFloat(rawValue);
    if (isNaN(val) || val <= 0) {
      setError('Valeur invalide (> 0 requis)');
      return;
    }
    setError(null);
    const newP2 = computeNewP2(dim, cmToMm(val));
    if (dim.p2NodeId) {
      updateNode(dim.p2NodeId, { x: newP2.x, y: newP2.y });
    }
    updateTilingDimension(dim.id, { p2: newP2 });
    onClose();
  };

  return (
    <div className="border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
          Côte sélectionnée
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-sm leading-none text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
        >
          ✕
        </button>
      </div>

      <div className="mb-2">
        <div className="mb-1 text-[10px] text-gray-500 dark:text-zinc-500">Longueur</div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={rawValue}
            disabled={!canEdit}
            onChange={(e) => { setRawValue(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleApply(); }}
            className="w-20 rounded border border-orange-500 bg-gray-50 dark:bg-zinc-800 px-2 py-1 text-sm font-bold disabled:border-gray-300 dark:disabled:border-zinc-700 disabled:cursor-not-allowed disabled:text-gray-400"
          />
          <span className="text-xs text-gray-500 dark:text-zinc-500">cm</span>
          {canEdit && (
            <button
              type="button"
              onClick={handleApply}
              className="rounded bg-orange-500 px-2 py-1 text-xs font-bold text-white hover:bg-orange-600"
            >
              ↵
            </button>
          )}
        </div>
        {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
        {!canEdit && (
          <p className="mt-1 text-[10px] text-gray-400 dark:text-zinc-600">
            Ancrez p2 sur un nœud de mur pour éditer
          </p>
        )}
      </div>

      <div className="mb-1.5">
        <div className="text-[10px] text-gray-500 dark:text-zinc-500">Direction</div>
        <div className="text-xs text-gray-700 dark:text-zinc-300">{dirLabel(dim.direction)}</div>
      </div>

      <div>
        <div className="text-[10px] text-gray-500 dark:text-zinc-500">Ancre fixe</div>
        <div className="text-xs text-gray-700 dark:text-zinc-300">p1 (première ancre placée)</div>
      </div>
    </div>
  );
};

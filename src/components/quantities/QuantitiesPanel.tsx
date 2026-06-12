'use client';

import { useMemo, useState } from 'react';
import type { ConsumableParams } from '@/types/tiling';
import { selectActiveProject, selectDoorOpenings, selectRooms, useProjectStore } from '@/store/projectStore';
import { useShallow } from 'zustand/react/shallow';
import { computeCornerGeometry } from '@/engine/geometry/wallGeometry';
import { analyzeQuantities } from '@/engine/quantities/quantityEngine';
import { mergeSimilarCutGroups } from '@/engine/quantities/mergeSimilarCutGroups';
import { formatCm, formatM2 } from '@/utils/formatters';
import { QuantityPlanView } from './QuantityPlanView';
import { CutGroupCardCompact } from './CutGroupCardCompact';
import { GROUP_COLORS } from './CutGroupCard';
import { QuantitiesRecapColumn } from './QuantitiesRecapColumn';

export const QuantitiesPanel = () => {
  const project = useProjectStore(selectActiveProject);
  const rooms = useProjectStore(selectRooms);
  const doorOpenings = useProjectStore(useShallow(selectDoorOpenings));
  const setConfig = useProjectStore((s) => s.setConfig);
  const [highlightGroup, setHighlightGroup] = useState<number | null>(null);

  const result = useMemo(() => {
    if (!project) return null;
    return analyzeQuantities(rooms, project.config, project.wallThickness, doorOpenings);
  }, [project, rooms, doorOpenings]);

  const wallEngine = project?.wallEngine;
  const wallPolygons = useMemo(
    () => computeCornerGeometry((wallEngine?.walls ?? []).filter((w) => !w.isDoor), wallEngine?.nodes ?? []),
    [wallEngine],
  );

  const mergedCutGroups = useMemo(
    () => (result ? mergeSimilarCutGroups(result.cutGroups) : []),
    [result],
  );

  if (!project || !result) return null;

  if (result.totalTiles === 0) {
    return (
      <div className="flex flex-1 items-center justify-center bg-gray-50 dark:bg-zinc-950 text-gray-400 dark:text-zinc-500">
        Tracez au moins une pièce fermée pour voir le quantitatif.
      </div>
    );
  }

  const tileLabel = `${formatCm(result.tileW)} × ${formatCm(result.tileH)}`;
  const color = project.config.color;

  const handleMarginCommit = (pct: number) => {
    setConfig({ ...project.config, marginOverride: pct / 100 });
  };

  const handleMarginReset = () => {
    setConfig({ ...project.config, marginOverride: undefined });
  };

  const updateConsumableParam = (patch: Partial<ConsumableParams>) => {
    setConfig({
      ...project.config,
      consumableParams: { ...(project.config.consumableParams ?? {}), ...patch },
    });
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-gray-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2 border-b border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-5 md:px-8 py-3">
        <h2 className="text-lg font-black text-gray-900 dark:text-zinc-100">Tableau des quantités</h2>
        <div className="flex flex-wrap gap-x-3 text-xs text-gray-400 dark:text-zinc-500">
          <span>Format&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{tileLabel}</span></span>
          <span>Joint&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{result.joint}&nbsp;mm</span></span>
          <span>Surface&nbsp;: <span className="font-bold text-gray-700 dark:text-zinc-300">{formatM2(result.roomArea)}</span></span>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden md:flex-row">
        <QuantitiesRecapColumn
          result={result}
          marginOverride={project.config.marginOverride}
          onMarginCommit={handleMarginCommit}
          onMarginReset={handleMarginReset}
          consumableParams={project.config.consumableParams}
          onConsumableParamChange={updateConsumableParam}
        />

        {/* Main area — plan + cuts band */}
        <div className="order-2 flex flex-1 flex-col gap-3 overflow-hidden p-5 md:order-1">
          <div data-testid="plan-section" className="flex flex-1 flex-col gap-2 overflow-hidden">
            <h3 className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
              Plan de calepinage annoté
            </h3>
            <QuantityPlanView
              result={result}
              config={project.config}
              rooms={rooms}
              highlightGroup={highlightGroup}
              wallPolygons={wallPolygons}
              doorOpenings={doorOpenings}
            />
          </div>

          <div data-testid="cuts-band" className="flex shrink-0 flex-col gap-2">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 dark:text-zinc-500">
              Groupes de coupes ({mergedCutGroups.length})
            </h3>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {mergedCutGroups.map((group, i) => (
                <CutGroupCardCompact
                  key={group.originalIndices.join(',')}
                  group={group}
                  groupIndex={i}
                  groupColor={GROUP_COLORS[i % GROUP_COLORS.length]!}
                  tileW={result.tileW}
                  tileH={result.tileH}
                  tileColor={color}
                  onHighlight={(n) => setHighlightGroup(
                    n === null ? null : group.originalIndices[0]! + 1,
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

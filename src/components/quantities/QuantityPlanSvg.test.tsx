import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/engine/geometry/polygon', () => ({
  getBoundingBox: () => ({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }),
}));

import { QuantityPlanSvg } from './QuantityPlanSvg';
import type { QuantityResult } from '@/engine/quantities/quantityEngine';
import type { TilingConfig } from '@/types/tiling';
import type { Room } from '@/types/project';

const config: TilingConfig = {
  layout: 'STRAIGHT', width: 300, height: 300, joint: 3,
  angle: 0, offsetX: 0, offsetY: 0, stagger: 0, chevronAngle: 45, color: '#93c5fd',
};

const makeResult = (overrides: Partial<QuantityResult> = {}): QuantityResult => ({
  tileW: 300, tileH: 300, joint: 3,
  wholeCount: 5, cuts: [], cutGroups: [],
  totalReuseCount: 0, tilesForCuts: 0, totalTiles: 5, toOrder: 6,
  roomArea: 5_000_000, tiles: [],
  ...overrides,
});

const room: Room = {
  id: 'r1', name: 'Salle', edges: [],
  points: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }, { x: 0, y: 1000 }],
};

const wholeTile = { id: 't1', type: 'WHOLE' as const, rect: { x: 0, y: 0, w: 300, h: 300 } };

describe('QuantityPlanSvg', () => {
  it('returns null when no valid rooms', () => {
    const { container } = render(
      <QuantityPlanSvg result={makeResult({ tiles: [wholeTile] })} config={config} rooms={[]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when tiles array is empty', () => {
    const { container } = render(
      <QuantityPlanSvg result={makeResult({ tiles: [] })} config={config} rooms={[room]} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders an svg element when rooms and tiles are present', () => {
    const { container } = render(
      <QuantityPlanSvg result={makeResult({ tiles: [wholeTile] })} config={config} rooms={[room]} />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('uses provided viewBox prop when given', () => {
    const { container } = render(
      <QuantityPlanSvg
        result={makeResult({ tiles: [wholeTile] })}
        config={config}
        rooms={[room]}
        viewBox="10 20 500 400"
      />,
    );
    expect(container.querySelector('svg')!.getAttribute('viewBox')).toBe('10 20 500 400');
  });

  it('computes viewBox from bounding box when viewBox prop is absent', () => {
    // getBoundingBox mock returns { minX:0, minY:0, maxX:1000, maxY:1000 }
    // pad = max(1000,1000)*0.1 = 100 → viewBox = "-100 -100 1200 1200"
    const { container } = render(
      <QuantityPlanSvg result={makeResult({ tiles: [wholeTile] })} config={config} rooms={[room]} />,
    );
    const vb = container.querySelector('svg')!.getAttribute('viewBox')!;
    expect(vb).toBe('-100 -100 1200 1200');
  });
});

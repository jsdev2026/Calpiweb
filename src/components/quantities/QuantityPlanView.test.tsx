import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/engine/geometry/polygon', () => ({
  getBoundingBox: () => ({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 }),
}));

import { QuantityPlanView } from './QuantityPlanView';
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

describe('QuantityPlanView', () => {
  it('returns null when rooms list is empty', () => {
    const { container } = render(
      <QuantityPlanView result={makeResult()} config={config} rooms={[]} highlightGroup={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when tiles array is empty', () => {
    const { container } = render(
      <QuantityPlanView result={makeResult({ tiles: [] })} config={config} rooms={[room]} highlightGroup={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders an svg element when rooms and tiles are present', () => {
    const tile = { id: 't1', type: 'WHOLE' as const, rect: { x: 0, y: 0, w: 300, h: 300 } };
    const { container } = render(
      <QuantityPlanView
        result={makeResult({ tiles: [tile] })}
        config={config}
        rooms={[room]}
        highlightGroup={null}
      />,
    );
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('does not render a legend section', () => {
    const tile = { id: 't1', type: 'WHOLE' as const, rect: { x: 0, y: 0, w: 300, h: 300 } };
    const { queryByText } = render(
      <QuantityPlanView
        result={makeResult({ tiles: [tile] })}
        config={config}
        rooms={[room]}
        highlightGroup={null}
      />,
    );
    expect(queryByText('Carreau entier')).toBeNull();
  });
});

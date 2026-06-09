import { render, fireEvent } from '@testing-library/react';
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
  margin: 0.05,
  consumables: {
    colle: { total: 0, bags: 0, bagSize: 25, rendement: 4 },
    joint: { total: 0, bags: 0, bagSize: 5, rendement: 0 },
    croisillons: { total: 0, bags: 0, bagSize: 200, rendement: 1.2 },
  },
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

  it('plan-wrapper has data-testid and cursor-grab class', () => {
    const tile = { id: 't1', type: 'WHOLE' as const, rect: { x: 0, y: 0, w: 300, h: 300 } };
    const { container } = render(
      <QuantityPlanView result={makeResult({ tiles: [tile] })} config={config} rooms={[room]} highlightGroup={null} />,
    );
    const wrapper = container.querySelector('[data-testid="plan-wrapper"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toContain('cursor-grab');
  });

  it('⊙ Ajuster button is absent by default', () => {
    const tile = { id: 't1', type: 'WHOLE' as const, rect: { x: 0, y: 0, w: 300, h: 300 } };
    const { queryByLabelText } = render(
      <QuantityPlanView result={makeResult({ tiles: [tile] })} config={config} rooms={[room]} highlightGroup={null} />,
    );
    expect(queryByLabelText('Ajuster la vue')).toBeNull();
  });

  it('⊙ Ajuster button appears after wheel event changes viewBox', () => {
    const tile = { id: 't1', type: 'WHOLE' as const, rect: { x: 0, y: 0, w: 300, h: 300 } };
    const { container, getByLabelText } = render(
      <QuantityPlanView result={makeResult({ tiles: [tile] })} config={config} rooms={[room]} highlightGroup={null} />,
    );
    const wrapper = container.querySelector('[data-testid="plan-wrapper"]')!;
    Object.defineProperty(wrapper, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    fireEvent.wheel(wrapper, { deltaY: 100 });
    expect(getByLabelText('Ajuster la vue')).toBeDefined();
  });

  it('clicking ⊙ Ajuster resets viewBox (button disappears)', () => {
    const tile = { id: 't1', type: 'WHOLE' as const, rect: { x: 0, y: 0, w: 300, h: 300 } };
    const { container, getByLabelText, queryByLabelText } = render(
      <QuantityPlanView result={makeResult({ tiles: [tile] })} config={config} rooms={[room]} highlightGroup={null} />,
    );
    const wrapper = container.querySelector('[data-testid="plan-wrapper"]')!;
    Object.defineProperty(wrapper, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) }),
      configurable: true,
    });
    fireEvent.wheel(wrapper, { deltaY: 100 });
    fireEvent.click(getByLabelText('Ajuster la vue'));
    expect(queryByLabelText('Ajuster la vue')).toBeNull();
  });
});

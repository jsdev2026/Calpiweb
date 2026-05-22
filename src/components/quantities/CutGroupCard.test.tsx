import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CutGroupCard } from './CutGroupCard';
import type { CutGroup } from '@/engine/quantities/quantityEngine';

const makeGroup = (overrides: Partial<CutGroup> = {}): CutGroup => ({
  usedW: 150,
  usedH: 300,
  pieceEdges: { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' },
  chuteW: 150,
  chuteH: 300,
  chuteEdges: { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' },
  totalCount: 3,
  reuseCount: 0,
  netTiles: 3,
  ...overrides,
});

const defaultProps = {
  group: makeGroup(),
  groupIndex: 0,
  groupColor: '#f87171',
  tileW: 300,
  tileH: 300,
  tileColor: '#93c5fd',
  onHighlight: vi.fn(),
};

describe('CutGroupCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders cut dimensions as formatted cm', () => {
    render(<CutGroupCard {...defaultProps} />);
    expect(screen.getByText('15.0 cm × 30.0 cm')).toBeDefined();
  });

  it('shows reuse badge when reuseCount > 0', () => {
    render(<CutGroupCard {...defaultProps} group={makeGroup({ reuseCount: 2 })} />);
    expect(screen.getByText(/2 taillée/)).toBeDefined();
  });

  it('does not show reuse badge when reuseCount is 0', () => {
    render(<CutGroupCard {...defaultProps} group={makeGroup({ reuseCount: 0 })} />);
    expect(screen.queryByText(/taillée/)).toBeNull();
  });

  it('calls onHighlight(groupIndex + 1) on mouseEnter', () => {
    const onHighlight = vi.fn();
    const { container } = render(
      <CutGroupCard {...defaultProps} groupIndex={2} onHighlight={onHighlight} />,
    );
    fireEvent.mouseEnter(container.firstChild as Element);
    expect(onHighlight).toHaveBeenCalledWith(3);
  });

  it('calls onHighlight(null) on mouseLeave', () => {
    const onHighlight = vi.fn();
    const { container } = render(
      <CutGroupCard {...defaultProps} onHighlight={onHighlight} />,
    );
    fireEvent.mouseLeave(container.firstChild as Element);
    expect(onHighlight).toHaveBeenCalledWith(null);
  });

  it('shows chute sub-line when chuteW and chuteH are both > 20', () => {
    render(<CutGroupCard {...defaultProps} group={makeGroup({ chuteW: 150, chuteH: 300 })} />);
    expect(screen.getByText(/Chute disponible/)).toBeDefined();
  });

  it('hides chute sub-line when chuteW is <= 20', () => {
    render(<CutGroupCard {...defaultProps} group={makeGroup({ chuteW: 20, chuteH: 300 })} />);
    expect(screen.queryByText(/Chute disponible/)).toBeNull();
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CutGroupCardCompact } from './CutGroupCardCompact';
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

describe('CutGroupCardCompact', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders cut dimensions as formatted cm', () => {
    render(<CutGroupCardCompact {...defaultProps} />);
    expect(screen.getByText('15.0 cm×30.0 cm')).toBeDefined();
  });

  it('shows chute when chuteW and chuteH are both > 20', () => {
    render(<CutGroupCardCompact {...defaultProps} />);
    expect(screen.getByText('Chute 15.0 cm×30.0 cm')).toBeDefined();
  });

  it('shows reuse note when reuseCount > 0 and there is no big chute', () => {
    render(
      <CutGroupCardCompact
        {...defaultProps}
        group={makeGroup({ reuseCount: 2, chuteW: 0, chuteH: 0 })}
      />,
    );
    expect(screen.getByText(/2 taillées dans une chute/)).toBeDefined();
  });

  it('renders the net tile count', () => {
    render(<CutGroupCardCompact {...defaultProps} group={makeGroup({ netTiles: 5 })} />);
    expect(screen.getByText('5')).toBeDefined();
  });

  it('calls onHighlight(groupIndex + 1) on mouseEnter', () => {
    const onHighlight = vi.fn();
    const { container } = render(
      <CutGroupCardCompact {...defaultProps} groupIndex={2} onHighlight={onHighlight} />,
    );
    fireEvent.mouseEnter(container.firstChild as Element);
    expect(onHighlight).toHaveBeenCalledWith(3);
  });

  it('calls onHighlight(null) on mouseLeave', () => {
    const onHighlight = vi.fn();
    const { container } = render(
      <CutGroupCardCompact {...defaultProps} onHighlight={onHighlight} />,
    );
    fireEvent.mouseLeave(container.firstChild as Element);
    expect(onHighlight).toHaveBeenCalledWith(null);
  });
});

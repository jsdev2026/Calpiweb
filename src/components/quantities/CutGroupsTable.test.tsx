import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CutGroupsTable } from './CutGroupsTable';
import type { MergedCutGroup } from '@/engine/quantities/mergeSimilarCutGroups';

const makeGroup = (overrides: Partial<MergedCutGroup> = {}): MergedCutGroup => ({
  usedW: 150,
  usedH: 300,
  pieceEdges: { left: 'cut', right: 'factory', top: 'factory', bottom: 'factory' },
  chuteW: 150,
  chuteH: 300,
  chuteEdges: { left: 'factory', right: 'cut', top: 'factory', bottom: 'factory' },
  totalCount: 3,
  reuseCount: 0,
  netTiles: 3,
  originalIndices: [0],
  ...overrides,
});

const defaultProps = {
  groups: [makeGroup()],
  tileW: 300,
  tileH: 300,
  tileColor: '#93c5fd',
  onHighlight: vi.fn(),
};

describe('CutGroupsTable', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders one row per group plus a header row', () => {
    render(
      <CutGroupsTable
        {...defaultProps}
        groups={[makeGroup(), makeGroup({ originalIndices: [1] })]}
      />,
    );
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('renders cut dimensions as formatted cm', () => {
    render(<CutGroupsTable {...defaultProps} />);
    expect(screen.getByText('15.0 cm×30.0 cm')).toBeDefined();
  });

  it('shows chute when chuteW and chuteH are both > 20', () => {
    render(<CutGroupsTable {...defaultProps} />);
    expect(screen.getByText('Chute 15.0 cm×30.0 cm')).toBeDefined();
  });

  it('shows reuse note when reuseCount > 0 and there is no big chute', () => {
    render(
      <CutGroupsTable
        {...defaultProps}
        groups={[makeGroup({ reuseCount: 2, chuteW: 0, chuteH: 0 })]}
      />,
    );
    expect(screen.getByText(/2 taillées dans une chute/)).toBeDefined();
  });

  it('renders the net tile count, styled green when reuseCount > 0', () => {
    render(<CutGroupsTable {...defaultProps} groups={[makeGroup({ netTiles: 5, reuseCount: 2 })]} />);
    const cell = screen.getByText('5');
    expect(cell.className).toContain('text-emerald-500');
  });

  it('calls onHighlight(originalIndices[0] + 1) on row mouseEnter', () => {
    const onHighlight = vi.fn();
    render(
      <CutGroupsTable
        {...defaultProps}
        groups={[makeGroup({ originalIndices: [2] })]}
        onHighlight={onHighlight}
      />,
    );
    const row = screen.getAllByRole('row')[1]!;
    fireEvent.mouseEnter(row);
    expect(onHighlight).toHaveBeenCalledWith(3);
  });

  it('calls onHighlight(null) on row mouseLeave', () => {
    const onHighlight = vi.fn();
    render(<CutGroupsTable {...defaultProps} onHighlight={onHighlight} />);
    const row = screen.getAllByRole('row')[1]!;
    fireEvent.mouseLeave(row);
    expect(onHighlight).toHaveBeenCalledWith(null);
  });
});

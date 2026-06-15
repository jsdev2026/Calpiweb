import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { WallDrawingCanvas } from './WallDrawingCanvas';
import type { Wall, WallNode } from '@/types/wall';

function Harness() {
  const [nodes, setNodes] = useState<WallNode[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  return (
    <WallDrawingCanvas
      walls={walls}
      nodes={nodes}
      tool="WALL"
      onAddWall={(w) => setWalls((prev) => [...prev, w])}
      onRemoveWall={() => {}}
      onUpdateWall={() => {}}
      onAddNode={(n) => setNodes((prev) => [...prev, n])}
      onUpdateNode={() => {}}
      onMergeNodes={() => {}}
      onPushHistory={() => {}}
      scale={1}
      pan={{ x: 0, y: 0 }}
      onScaleChange={() => {}}
      onPanChange={() => {}}
      wallThickness={100}
      excludedZones={[]}
      onAddExcludedZone={() => {}}
      onRemoveExcludedZone={() => {}}
      onUpdateExcludeZoneNode={() => {}}
      onSplitWall={() => {}}
      onConnectNodeToWall={() => {}}
    />
  );
}

describe('WallDrawingCanvas — live wall length label', () => {
  it('shows no length label before drawing starts', () => {
    render(<Harness />);
    expect(screen.queryByText(/cm$/)).not.toBeInTheDocument();
  });

  it('shows the live length while drawing a wall segment', () => {
    render(<Harness />);
    const svg = document.querySelector('svg')!;

    // Place the first point at world (100, 100) — scale=1, pan={0,0} so screen == world
    fireEvent.pointerDown(svg, { button: 0, clientX: 100, clientY: 100 });

    // Move the cursor 200mm away horizontally
    fireEvent.pointerMove(svg, { button: 0, clientX: 300, clientY: 100 });

    expect(screen.getByText('20.0 cm')).toBeInTheDocument();
  });
});

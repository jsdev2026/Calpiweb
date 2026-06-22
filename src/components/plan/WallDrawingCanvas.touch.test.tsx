import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WallDrawingCanvas } from './WallDrawingCanvas';

function renderCanvas(opts: { onPanChange?: ReturnType<typeof vi.fn>; onScaleChange?: ReturnType<typeof vi.fn> } = {}) {
  const onPanChange = opts.onPanChange ?? vi.fn();
  const onScaleChange = opts.onScaleChange ?? vi.fn();
  const { container } = render(
    <WallDrawingCanvas
      walls={[]}
      nodes={[]}
      tool="SELECT"
      onAddWall={() => {}}
      onRemoveWall={() => {}}
      onUpdateWall={() => {}}
      onAddNode={() => {}}
      onUpdateNode={() => {}}
      onMergeNodes={() => {}}
      onPushHistory={() => {}}
      scale={1}
      pan={{ x: 0, y: 0 }}
      onScaleChange={onScaleChange}
      onPanChange={onPanChange}
      wallThickness={100}
      excludedZones={[]}
      onAddExcludedZone={() => {}}
      onRemoveExcludedZone={() => {}}
      onUpdateExcludeZoneNode={() => {}}
      onSplitWall={() => {}}
      onConnectNodeToWall={() => {}}
    />,
  );
  const div = container.firstChild as HTMLElement;
  return { div, onPanChange, onScaleChange };
}

describe('Touch gesture model', () => {
  it('1-doigt touchmove ne déclenche pas de pan (pointer events gèrent)', () => {
    const { div, onPanChange } = renderCanvas();

    fireEvent.touchStart(div, {
      touches: [{ clientX: 100, clientY: 100 }],
    });
    fireEvent.touchMove(div, {
      touches: [{ clientX: 150, clientY: 150 }],
    });

    expect(onPanChange).not.toHaveBeenCalled();
  });

  it('2-doigts touchmove déclenche onScaleChange (pinch-to-zoom conservé)', () => {
    const { div, onScaleChange } = renderCanvas();

    fireEvent.touchStart(div, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ],
    });
    fireEvent.touchMove(div, {
      touches: [
        { clientX: 50, clientY: 100 },
        { clientX: 250, clientY: 100 },
      ],
    });

    expect(onScaleChange).toHaveBeenCalled();
    const newScale = (onScaleChange.mock.calls[0] as [number])[0];
    expect(newScale).toBeGreaterThan(1);
  });

  it('2-doigts touchmove déclenche onPanChange (pan 2 doigts conservé)', () => {
    const { div, onPanChange } = renderCanvas();

    fireEvent.touchStart(div, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ],
    });
    fireEvent.touchMove(div, {
      touches: [
        { clientX: 50, clientY: 100 },
        { clientX: 250, clientY: 100 },
      ],
    });

    expect(onPanChange).toHaveBeenCalled();
  });
});

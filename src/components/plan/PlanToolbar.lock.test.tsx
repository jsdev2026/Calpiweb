import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PlanToolbar } from './PlanToolbar';

const BASE_PROPS = {
  tool: 'SELECT' as const,
  canUndo: false,
  canRedo: false,
  onChangeTool: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  wallThickness: 100,
  onWallThicknessChange: vi.fn(),
  tutorialMode: false,
  onToggleTutorial: vi.fn(),
};

describe('PlanToolbar — LOCK tool', () => {
  it('renders the LOCK button', () => {
    render(<PlanToolbar {...BASE_PROPS} />);
    expect(screen.getByRole('button', { name: /Verrouiller/i })).toBeInTheDocument();
  });

  it('calls onChangeTool("LOCK") on click', async () => {
    const onChangeTool = vi.fn();
    render(<PlanToolbar {...BASE_PROPS} onChangeTool={onChangeTool} />);
    await userEvent.click(screen.getByRole('button', { name: /Verrouiller/i }));
    expect(onChangeTool).toHaveBeenCalledWith('LOCK');
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./ToolTooltip', () => ({
  ToolTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./WallThicknessControl', () => ({
  WallThicknessControl: () => <div data-testid="wall-thickness-control" />,
}));

import { PlanToolbar } from './PlanToolbar';

const defaultProps = {
  tool: 'SELECT' as const,
  canUndo: false,
  canRedo: false,
  onChangeTool: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  onClearRoom: vi.fn(),
  wallThickness: 100,
  onWallThicknessChange: vi.fn(),
  tutorialMode: false,
  onToggleTutorial: vi.fn(),
};

describe('PlanToolbar mobile', () => {
  it('renders the mobile horizontal toolbar', () => {
    render(<PlanToolbar {...defaultProps} />);
    expect(screen.getByTestId('plan-toolbar-mobile')).toBeDefined();
  });

  it('mobile toolbar contains a SELECT tool button', () => {
    render(<PlanToolbar {...defaultProps} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    // SELECT tool button has aria-label "Sélectionner"
    const selectBtn = toolbar.querySelector('[aria-label="Sélectionner"]');
    expect(selectBtn).not.toBeNull();
  });

  it('clicking SELECT in mobile toolbar calls onChangeTool with SELECT', () => {
    const onChangeTool = vi.fn();
    render(<PlanToolbar {...defaultProps} onChangeTool={onChangeTool} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    const selectBtn = toolbar.querySelector('[aria-label="Sélectionner"]') as HTMLButtonElement;
    fireEvent.click(selectBtn);
    expect(onChangeTool).toHaveBeenCalledWith('SELECT');
  });

  it('clicking WALL in mobile toolbar calls onChangeTool with WALL', () => {
    const onChangeTool = vi.fn();
    render(<PlanToolbar {...defaultProps} onChangeTool={onChangeTool} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    const wallBtn = toolbar.querySelector('[aria-label="Tracer des murs"]') as HTMLButtonElement;
    fireEvent.click(wallBtn);
    expect(onChangeTool).toHaveBeenCalledWith('WALL');
  });
});

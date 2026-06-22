import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./ToolTooltip', () => ({
  ToolTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('./WallThicknessControl', () => ({
  WallThicknessControl: ({ compact }: { compact?: boolean }) => (
    <div data-testid="wall-thickness-control" data-compact={compact ? 'true' : 'false'} />
  ),
}));

import { PlanToolbar } from './PlanToolbar';

const defaultProps = {
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

describe('PlanToolbar — bouton DELETE', () => {
  it('clicking Trash in mobile toolbar calls onChangeTool with DELETE', () => {
    const onChangeTool = vi.fn();
    render(<PlanToolbar {...defaultProps} onChangeTool={onChangeTool} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    const trashBtn = toolbar.querySelector('[aria-label="Mode suppression"]') as HTMLButtonElement;
    expect(trashBtn).not.toBeNull();
    fireEvent.click(trashBtn);
    expect(onChangeTool).toHaveBeenCalledWith('DELETE');
  });

  it('Trash button is always enabled (no disabled attr)', () => {
    render(<PlanToolbar {...defaultProps} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    const trashBtn = toolbar.querySelector('[aria-label="Mode suppression"]') as HTMLButtonElement;
    expect(trashBtn.disabled).toBe(false);
  });
});

describe('PlanToolbar mobile — deux lignes', () => {
  it('toolbar mobile a la classe bottom-0 (pas bottom-20)', () => {
    render(<PlanToolbar {...defaultProps} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    expect(toolbar.className).toContain('bottom-0');
    expect(toolbar.className).not.toContain('bottom-20');
  });

  it('WallThicknessControl est rendu en mode compact dans la toolbar mobile', () => {
    render(<PlanToolbar {...defaultProps} />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    const ctrl = toolbar.querySelector('[data-testid="wall-thickness-control"]');
    expect(ctrl).not.toBeNull();
    expect(ctrl!.getAttribute('data-compact')).toBe('true');
  });

  it('texte d\'outil actif visible quand tool=WALL', () => {
    render(<PlanToolbar {...defaultProps} tool="WALL" />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    expect(toolbar.textContent).toContain('Cliquez pour poser un point');
  });

  it('pas de texte d\'outil actif quand tool=SELECT', () => {
    render(<PlanToolbar {...defaultProps} tool="SELECT" />);
    const toolbar = screen.getByTestId('plan-toolbar-mobile');
    expect(toolbar.textContent).not.toContain('Cliquez');
  });
});

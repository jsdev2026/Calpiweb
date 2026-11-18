import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ProjectHeader, type ProjectHeaderProps } from './ProjectHeader';
import { modeFromParam, modeHref } from './workspaceMode';

const setup = (overrides: Partial<ProjectHeaderProps> = {}) => {
  const props: ProjectHeaderProps = {
    projectName: 'Salle de bain',
    onRename: vi.fn(),
    status: 'wip',
    onStatusChange: vi.fn(),
    clientName: 'Dupont',
    updatedAt: '2026-11-18T10:00:00Z',
    readOnly: false,
    user: { name: 'Jean Dupont', email: 'jean@exemple.fr', plan: 'pro' },
    darkMode: false,
    onToggleDarkMode: vi.fn(),
    onBack: vi.fn(),
    onOpenProjectSettings: vi.fn(),
    onPrint: vi.fn(),
    onOpenAccount: vi.fn(),
    onOpenPlan: vi.fn(),
    onLogout: vi.fn(),
    ...overrides,
  };
  render(<ProjectHeader {...props} />);
  return props;
};

describe('workspaceMode', () => {
  it('lit et écrit le mode dans l’adresse', () => {
    expect(modeFromParam(null)).toBe('PLAN');
    expect(modeFromParam('calepinage')).toBe('TILING');
    expect(modeFromParam('quantitatif')).toBe('QUANTITIES');
    expect(modeFromParam('nimporte')).toBe('PLAN');
    expect(modeHref('p1', 'PLAN')).toBe('/project/p1');
    expect(modeHref('p1', 'TILING')).toBe('/project/p1?mode=calepinage');
  });
});

describe('ProjectHeader', () => {
  it('affiche le nom du projet (aussi sur smartphone), renommable', () => {
    const p = setup();
    const name = screen.getByRole('textbox', { name: 'Nom du projet' });
    expect((name as HTMLInputElement).value).toBe('Salle de bain');
    expect(name.className).not.toMatch(/(^|\s)hidden(\s|$)/);
    fireEvent.change(name, { target: { value: 'Cuisine' } });
    expect(p.onRename).toHaveBeenCalledWith('Cuisine');
  });

  it('statut : liste déroulante au lieu du clic en boucle', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Statut : En cours' }));
    const menu = screen.getByRole('menu');
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Terminé' }));
    expect(p.onStatusChange).toHaveBeenCalledWith('done');
  });

  it('client et date avec libellé « modifié le »', () => {
    setup();
    expect(screen.getByText('Dupont · modifié le 18/11/2026')).toBeTruthy();
  });

  it('thème dans le menu du compte', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Thème sombre' }));
    expect(p.onToggleDarkMode).toHaveBeenCalled();
  });

  it('smartphone : le menu ⋯ regroupe toutes les actions', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Plus d’actions' }));
    const menu = screen.getByRole('menu');
    for (const name of [
      'Renommer',
      'Paramètres du projet',
      'Exporter en PDF',
      'Thème sombre',
      'Mon compte Pro',
      'Se déconnecter',
    ]) {
      expect(within(menu).getByRole('menuitem', { name })).toBeTruthy();
    }
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Exporter en PDF' }));
    expect(p.onPrint).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('lecture seule : pas de renommage ni de changement de statut', () => {
    setup({ readOnly: true });
    expect(
      (screen.getByRole('textbox', { name: 'Nom du projet' }) as HTMLInputElement).readOnly,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Statut : En cours' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Plus d’actions' }));
    expect(screen.queryByRole('menuitem', { name: 'Renommer' })).toBeNull();
  });
});

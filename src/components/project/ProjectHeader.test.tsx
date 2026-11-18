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
    notesCount: 2,
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
    onOpenTutorial: vi.fn(),
    onLogout: vi.fn(),
    ...overrides,
  };
  render(<ProjectHeader {...props} />);
  return props;
};

const openProject = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Projet : Salle de bain' }));
  return screen.getByRole('dialog', { name: 'Projet' });
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

describe('ProjectHeader — bouton Projet', () => {
  it('résume le projet : nom, statut et client', () => {
    setup();
    const btn = screen.getByRole('button', { name: 'Projet : Salle de bain' });
    expect(btn.textContent).toContain('Salle de bain');
    expect(btn.textContent).toContain('En cours · Dupont');
    // Plus d'actions de projet isolées dans le bandeau
    expect(screen.queryByRole('button', { name: /PDF/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Paramètres du projet' })).toBeNull();
  });

  it('regroupe tout le projet : nom, statut, client, notes, PDF, date', () => {
    const p = setup();
    const menu = openProject();
    const name = within(menu).getByRole('textbox', { name: 'Nom du projet' });
    fireEvent.change(name, { target: { value: 'Cuisine' } });
    expect(p.onRename).toHaveBeenCalledWith('Cuisine');

    const statut = within(menu).getByRole('radiogroup', { name: 'Statut' });
    expect(
      within(statut).getByRole('radio', { name: 'En cours' }).getAttribute('aria-checked'),
    ).toBe('true');
    fireEvent.click(within(statut).getByRole('radio', { name: 'Terminé' }));
    expect(p.onStatusChange).toHaveBeenCalledWith('done');

    expect(within(menu).getByText('Modifié le 18/11/2026')).toBeTruthy();
    expect(within(menu).getByRole('menuitem', { name: /Notes du projet.*2 notes/ })).toBeTruthy();
  });

  it('client et notes ouvrent le bon onglet des informations du projet', () => {
    const p = setup();
    fireEvent.click(within(openProject()).getByRole('menuitem', { name: /Client : Dupont/ }));
    expect(p.onOpenProjectSettings).toHaveBeenLastCalledWith('info');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(within(openProject()).getByRole('menuitem', { name: /Notes du projet/ }));
    expect(p.onOpenProjectSettings).toHaveBeenLastCalledWith('notes');
  });

  it('export PDF depuis le menu Projet', () => {
    const p = setup();
    fireEvent.click(within(openProject()).getByRole('menuitem', { name: 'Exporter en PDF' }));
    expect(p.onPrint).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('se ferme avec Échap', () => {
    setup();
    openProject();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lecture seule : consultation et PDF seulement', () => {
    setup({ readOnly: true });
    const menu = openProject();
    expect(
      (within(menu).getByRole('textbox', { name: 'Nom du projet' }) as HTMLInputElement).readOnly,
    ).toBe(true);
    expect(
      (within(menu).getByRole('radio', { name: 'Terminé' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(within(menu).queryByRole('menuitem', { name: /Client/ })).toBeNull();
    expect(within(menu).getByRole('menuitem', { name: 'Exporter en PDF' })).toBeTruthy();
    expect(within(menu).getByText(/Lecture seule/)).toBeTruthy();
  });
});

describe('ProjectHeader — compte', () => {
  it('le menu du compte ne contient que le compte', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }));
    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((m) => m.textContent),
    ).toEqual(['Thème sombre', 'Paramètres', 'Changer de forfait', 'Tutoriel', 'Se déconnecter']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Tutoriel' }));
    expect(p.onOpenTutorial).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('thème depuis le menu du compte', () => {
    const p = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Mon compte' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Thème sombre' }));
    expect(p.onToggleDarkMode).toHaveBeenCalled();
  });

  it('un seul menu de compte, aussi sur smartphone (plus de menu ⋯)', () => {
    setup();
    expect(screen.getAllByRole('button', { name: 'Mon compte' }).length).toBe(1);
    expect(screen.queryByRole('button', { name: 'Plus d’actions' })).toBeNull();
  });
});

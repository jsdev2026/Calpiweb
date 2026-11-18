import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ConfirmDeleteDialog, ProjectActionsMenu, StatusFilterTiles } from './ProjectListParts';

describe('Compteurs-filtres', () => {
  it('chaque case affiche son nombre et filtre sur son statut', () => {
    const onChange = vi.fn();
    render(
      <StatusFilterTiles
        counts={{ all: 12, new: 3, wip: 5, done: 4 }}
        value="all"
        onChange={onChange}
      />,
    );
    const group = screen.getByRole('group', { name: 'Filtrer par statut' });
    const tiles = within(group).getAllByRole('button');
    expect(tiles.map((t) => t.textContent)).toEqual([
      '12Tous',
      '3Nouveaux',
      '5En cours',
      '4Terminés',
    ]);
    expect(tiles[0]!.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(group).getByRole('button', { name: /Terminés/ }));
    expect(onChange).toHaveBeenCalledWith('done');
  });

  it('la case « Terminés » a bien son cadre (plus de classe collée)', () => {
    render(
      <StatusFilterTiles
        counts={{ all: 1, new: 0, wip: 0, done: 1 }}
        value="done"
        onChange={vi.fn()}
      />,
    );
    const done = screen.getByRole('button', { name: /Terminés/ });
    expect(done.getAttribute('aria-pressed')).toBe('true');
    expect(done.className).toMatch(/(^|\s)border(\s|$)/);
    expect(done.style.borderColor).toBe('var(--accent)');
  });
});

describe('Menu ⋯ d’un projet', () => {
  const setup = (canShare = true) => {
    const h = { onOpen: vi.fn(), onSettings: vi.fn(), onShare: vi.fn(), onDelete: vi.fn() };
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <ProjectActionsMenu projectName="Cuisine" canShare={canShare} {...h} />
      </div>,
    );
    return { ...h, parentClick };
  };

  it('regroupe ouvrir, paramètres, partager et supprimer', () => {
    const h = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Actions du projet Cuisine' }));
    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((m) => m.textContent),
    ).toEqual(['Ouvrir', 'Paramètres du projet', 'Partager', 'Supprimer…']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Partager' }));
    expect(h.onShare).toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
    // Les clics dans le menu n'ouvrent pas le projet
    expect(h.parentClick).not.toHaveBeenCalled();
  });

  it('projet partagé avec moi : pas de « Partager »', () => {
    setup(false);
    fireEvent.click(screen.getByRole('button', { name: 'Actions du projet Cuisine' }));
    expect(screen.queryByRole('menuitem', { name: 'Partager' })).toBeNull();
  });

  it('Échap ferme le menu', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Actions du projet Cuisine' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('Confirmation de suppression', () => {
  it('nomme le projet, prévient que c’est irréversible ; Annuler ou Supprimer', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDeleteDialog projectName="Cuisine" onConfirm={onConfirm} onCancel={onCancel} />);
    const dialog = screen.getByRole('alertdialog', { name: 'Supprimer « Cuisine » ?' });
    expect(dialog.textContent).toMatch(/irréversible/);
    expect(document.activeElement?.textContent).toBe('Annuler');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Annuler' }));
    expect(onCancel).toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

import { describe, expect, it } from 'vitest';
import { relativeDate, statusCounts, visibleProjects } from './projectList';
import type { ProjectStatus } from '@/types/project';

const p = (name: string, status: ProjectStatus, updatedAt: number, client?: string) => ({
  name,
  status,
  updatedAt,
  client: client ? { name: client } : undefined,
});

const projects = [
  p('Salle de bain', 'wip', 3, 'Dupont'),
  p('Cuisine', 'done', 5, 'Hélène Martin'),
  p('Entrée', 'new', 1),
  p('Terrasse', 'wip', 9),
];

describe('Mes projets — liste', () => {
  it('compte les projets par statut', () => {
    expect(statusCounts(projects)).toEqual({ all: 4, new: 1, wip: 2, done: 1 });
  });

  it('filtre par statut, plus récents d’abord', () => {
    expect(
      visibleProjects(projects, { filter: 'wip', search: '', sort: 'recent' }).map((x) => x.name),
    ).toEqual(['Terrasse', 'Salle de bain']);
    expect(
      visibleProjects(projects, { filter: 'done', search: '', sort: 'recent' }).map((x) => x.name),
    ).toEqual(['Cuisine']);
  });

  it('recherche sur le nom et le client, sans tenir compte des accents', () => {
    const names = (search: string) =>
      visibleProjects(projects, { filter: 'all', search, sort: 'recent' }).map((x) => x.name);
    expect(names('helene')).toEqual(['Cuisine']);
    expect(names('ENTREE')).toEqual(['Entrée']);
    expect(names('dupont')).toEqual(['Salle de bain']);
    expect(names('zzz')).toEqual([]);
  });

  it('tri par nom ou par statut (en cours, nouveaux, terminés)', () => {
    expect(
      visibleProjects(projects, { filter: 'all', search: '', sort: 'name' }).map((x) => x.name),
    ).toEqual(['Cuisine', 'Entrée', 'Salle de bain', 'Terrasse']);
    expect(
      visibleProjects(projects, { filter: 'all', search: '', sort: 'status' }).map((x) => x.status),
    ).toEqual(['wip', 'wip', 'new', 'done']);
  });

  it('dates relatives', () => {
    const now = new Date(2026, 10, 18, 15).getTime();
    expect(relativeDate(new Date(2026, 10, 18, 9).getTime(), now)).toBe('aujourd’hui');
    expect(relativeDate(new Date(2026, 10, 17, 23).getTime(), now)).toBe('hier');
    expect(relativeDate(new Date(2026, 10, 15).getTime(), now)).toBe('il y a 3 j');
    expect(relativeDate(new Date(2026, 9, 2).getTime(), now)).toBe('2 oct.');
    expect(relativeDate(new Date(2025, 9, 2).getTime(), now)).toBe('2 oct. 2025');
  });
});

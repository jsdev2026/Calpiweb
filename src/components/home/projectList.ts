// Liste « Mes projets » : filtre par statut, recherche (nom ou client) et tri — fonctions pures.
import type { Project, ProjectStatus } from '@/types/project';

export type StatusFilter = 'all' | ProjectStatus;
export type ProjectSort = 'recent' | 'name' | 'status';

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  new: 'Nouveau',
  wip: 'En cours',
  done: 'Terminé',
};
/** Couleur du point de statut (même code couleur que le bandeau du projet) */
export const STATUS_DOT: Record<ProjectStatus, string> = {
  new: '#8b5cf6',
  wip: '#f59e0b',
  done: '#10b981',
};
export const SORT_LABELS: Record<ProjectSort, string> = {
  recent: 'Récents',
  name: 'Nom',
  status: 'Statut',
};

const STATUS_ORDER: Record<ProjectStatus, number> = { wip: 0, new: 1, done: 2 };

// Sans accents : « Cafe » trouve « Café » (\p{M} = signes diacritiques après NFD)
const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export function statusCounts(projects: Pick<Project, 'status'>[]): Record<StatusFilter, number> {
  const c: Record<StatusFilter, number> = { all: projects.length, new: 0, wip: 0, done: 0 };
  for (const p of projects) c[p.status] += 1;
  return c;
}

/** Projets visibles : statut choisi, recherche sur le nom et le client (sans accents), tri. */
export function visibleProjects<
  P extends Pick<Project, 'name' | 'status' | 'updatedAt' | 'client'>,
>(
  projects: P[],
  { filter, search, sort }: { filter: StatusFilter; search: string; sort: ProjectSort },
): P[] {
  const q = norm(search);
  const list = projects.filter((p) => {
    if (filter !== 'all' && p.status !== filter) return false;
    if (!q) return true;
    return norm(p.name).includes(q) || norm(p.client?.name ?? '').includes(q);
  });
  const byName = (a: P, b: P) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
  return [...list].sort((a, b) => {
    if (sort === 'name') return byName(a, b);
    if (sort === 'status')
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.updatedAt - a.updatedAt;
    return b.updatedAt - a.updatedAt;
  });
}

/** « aujourd'hui », « hier », « il y a 3 j », puis la date (« 2 nov. », « 2 nov. 2025 »). */
export function relativeDate(ts: number, now = Date.now()): string {
  const day = (t: number) => {
    const d = new Date(t);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  };
  const diff = day(now) - day(ts);
  if (diff <= 0) return 'aujourd’hui';
  if (diff === 1) return 'hier';
  if (diff < 7) return `il y a ${diff} j`;
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

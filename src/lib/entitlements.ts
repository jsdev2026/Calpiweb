import type { Project } from '@/types/project';

/** Nombre de projets inclus dans le forfait gratuit. Doit rester aligné avec can_create_project() en base. */
export const FREE_PROJECT_LIMIT = 1;

export interface PlanInfo {
  plan: 'free' | 'pro';
  /** Crédits « +1 projet » achetés. */
  projectCredits: number;
}

/** Projets dont l'utilisateur est propriétaire — les projets partagés avec lui ne comptent pas. */
export function ownedProjects<T extends Pick<Project, 'myRole'>>(projects: T[]): T[] {
  return projects.filter((p) => p.myRole === undefined || p.myRole === 'owner');
}

export function projectLimit(info: PlanInfo): number {
  return info.plan === 'pro'
    ? Infinity
    : FREE_PROJECT_LIMIT + Math.max(0, info.projectCredits || 0);
}

/**
 * Même règle que la politique RLS « projects_insert_within_limit » :
 * l'interface l'utilise pour afficher le paywall avant d'essayer, la base la garantit.
 */
export function canCreateProject(info: PlanInfo, projects: Pick<Project, 'myRole'>[]): boolean {
  return ownedProjects(projects).length < projectLimit(info);
}

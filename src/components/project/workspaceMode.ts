import type { WorkspaceMode } from '@/components/plan/PlanEditor';

/**
 * Mode affiché (Plan 2D / Calepinage / Quantitatif) dans l'adresse de la page :
 * /project/<id>?mode=calepinage — un rechargement garde le mode, le bouton retour
 * du navigateur revient à l'étape précédente.
 */
const PARAM: Record<WorkspaceMode, string | null> = {
  PLAN: null,
  TILING: 'calepinage',
  QUANTITIES: 'quantitatif',
};

export function modeFromParam(value: string | null | undefined): WorkspaceMode {
  if (value === 'calepinage') return 'TILING';
  if (value === 'quantitatif') return 'QUANTITIES';
  return 'PLAN';
}

export function modeHref(projectId: string, mode: WorkspaceMode): string {
  const p = PARAM[mode];
  return `/project/${projectId}${p ? `?mode=${p}` : ''}`;
}

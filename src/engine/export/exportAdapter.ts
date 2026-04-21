import type { TilingResult } from '@/types/tiling';
import type { Project } from '@/types/project';

/**
 * Stub pour futurs exports (PDF, DXF, CSV). Chaque format implémentera ce contrat.
 */
export interface ExportAdapter {
  readonly format: 'pdf' | 'dxf' | 'csv';
  export(project: Project, result: TilingResult): Promise<Blob>;
}

export const exportAdapters: ExportAdapter[] = [];

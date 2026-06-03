import type { Project, Room, EdgeType, ProjectStatus, ClientInfo, Constraint, ProjectNote, Partition, ExcludedZone, TilingDimension } from '@/types/project';
import type { Wall, WallNode, WallExcludedZone } from '@/types/wall';
import type { MyRole, ShareRole } from '@/types/sharing';
import type { Point } from '@/types/plan';
import type { TilingConfig } from '@/types/tiling';
import { createClient } from './client';
import { generateId } from '@/utils/id';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';
import { WALL_THICKNESS_MM } from '@/constants/businessRules';

function migrateProject(raw: unknown): Project {
  const p = raw as Record<string, unknown>;

  let rooms: Room[];
  if (Array.isArray(p.rooms)) {
    rooms = (p.rooms as Array<Record<string, unknown>>).map((r) => ({
      id: r.id as string,
      name: r.name as string | undefined,
      points: (r.points as Point[]) ?? [],
      edges: (r.edges as EdgeType[]) ?? new Array<EdgeType>(((r.points as Point[]) ?? []).length).fill('WALL'),
      edgeThicknesses: (r.edgeThicknesses as (number | undefined)[] | undefined) ?? [],
      partitions: ((r.partitions as Partition[] | undefined) ?? []).map((pt) => ({ ...pt, thickness: pt.thickness ?? 100 })),
      excludedZones: (r.excludedZones as ExcludedZone[] | undefined) ?? [],
    }));
  } else {
    const legacyPoints = (p.plan as Point[] | undefined) ?? [];
    rooms = [{ id: generateId(), points: legacyPoints, edges: new Array<EdgeType>(legacyPoints.length).fill('WALL'), partitions: [], excludedZones: [] }];
  }

  const rawConfig = (p.config as TilingConfig | undefined) ?? { ...DEFAULT_TILING_CONFIG };
  const config: TilingConfig = {
    ...rawConfig,
    stagger: rawConfig.stagger < 2 ? Math.round(rawConfig.stagger * 100) : rawConfig.stagger,
    layout: rawConfig.layout ?? 'STRAIGHT',
  };

  return {
    id: p.id as string,
    name: p.name as string,
    client: (() => {
      const raw = p.client;
      if (!raw) return undefined;
      if (typeof raw === 'string') return raw ? { name: raw } : undefined;
      return raw as ClientInfo;
    })(),
    status: (p.status as ProjectStatus | undefined) ?? 'new',
    createdAt: p.createdAt as number,
    updatedAt: p.updatedAt as number,
    rooms,
    config,
    wallThickness: (p.wallThickness as number | undefined) ?? WALL_THICKNESS_MM,
    constraints: (p.constraints as Constraint[] | undefined) ?? [],
    description: p.description as string | undefined,
    notes: (p.notes as ProjectNote[] | undefined) ?? [],
    tilingDimensions: p.tilingDimensions as TilingDimension[] | undefined,
    wallEngine: (() => {
      // New format: { nodes: WallNode[], walls: Wall[] }
      if (p.wallEngine && typeof p.wallEngine === 'object' && !Array.isArray(p.wallEngine)) {
        const we = p.wallEngine as { nodes: WallNode[]; walls: Wall[]; excludedZones?: WallExcludedZone[] };
        return { nodes: we.nodes, walls: we.walls, excludedZones: we.excludedZones ?? [] };
      }
      // Old format (p1/p2 arrays) or absent → table rase, treat as not initialized
      return undefined;
    })(),
  };
}

export const supabaseDb = {
  async getAll(): Promise<Project[]> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data: rows, error } = await supabase
      .from('projects')
      .select('id, user_id, data')
      .order('updated_at', { ascending: false });
    if (error) throw new Error(`[${error.code}] ${error.message}`);

    const { data: shares } = await supabase
      .from('project_shares')
      .select('project_id, role')
      .order('created_at', { ascending: true });

    const projectIds = (rows ?? []).map((r) => r.id as string);
    const { data: locks } = projectIds.length > 0
      ? await supabase
          .from('project_locks')
          .select('project_id, locked_by, expires_at, profiles(display_name, email)')
          .in('project_id', projectIds)
          .gt('expires_at', new Date().toISOString())
      : { data: [] };

    const shareMap = new Map(
      (shares ?? []).map((s) => [s.project_id as string, s.role as ShareRole]),
    );
    const lockMap = new Map(
      (locks ?? []).map((l) => {
        const profile = l.profiles as unknown as { display_name: string | null; email: string } | null;
        return [l.project_id as string, {
          projectId: l.project_id as string,
          lockedBy: l.locked_by as string,
          lockedByDisplayName: profile?.display_name ?? profile?.email ?? 'Autre utilisateur',
          expiresAt: l.expires_at as string,
        }];
      }),
    );

    return (rows ?? []).map((row) => {
      const project = migrateProject(row.data);
      const isOwner = (row.user_id as string) === user.id;
      const myRole: MyRole = isOwner ? 'owner' : (shareMap.get(row.id as string) ?? 'viewer');
      const lock = lockMap.get(row.id as string) ?? null;
      return { ...project, myRole, lock };
    });
  },

  async get(id: string): Promise<Project | undefined> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('projects')
      .select('data')
      .eq('id', id)
      .single();
    if (error) return undefined;
    return data?.data as Project | undefined;
  },

  async save(project: Project): Promise<void> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('NOT_AUTHENTICATED');
    const { error } = await supabase.from('projects').upsert({
      id: project.id,
      user_id: user.id,
      name: project.name,
      data: { ...project, updatedAt: Date.now() },
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`[${error.code}] ${error.message}`);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw new Error(`[${error.code}] ${error.message}`);
  },

  async getProfile(): Promise<{ plan: 'free' | 'pro' }> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { plan: 'free' };
    const { data, error } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw new Error(`[${error.code}] ${error.message}`);
    return (data as { plan: 'free' | 'pro' } | null) ?? { plan: 'free' };
  },
};

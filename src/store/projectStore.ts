import { create } from 'zustand';
import type { Project, Room, EdgeType, ProjectStatus, ClientInfo, Constraint, ProjectNote, TilingDimension } from '@/types/project';
import type { Plan, Point } from '@/types/plan';
import type { TilingConfig } from '@/types/tiling';
import { supabaseDb } from '@/lib/supabase/db';
import { generateId } from '@/utils/id';
import { DEFAULT_TILING_CONFIG } from '@/constants/tileDefaults';
import { WALL_THICKNESS_MM } from '@/constants/businessRules';

interface ProjectState {
  projects: Project[];
  activeProjectId: string | null;
  hydrated: boolean;

  hydrate: () => Promise<void>;
  create: (data?: { name?: string; client?: ClientInfo }) => Promise<Project>;
  rename: (id: string, name: string) => void;
  remove: (id: string) => Promise<void>;
  setActive: (id: string | null) => void;
  updateActive: (updater: (project: Project) => Project) => void;

  addRoom: () => string;
  removeRoom: (roomId: string) => void;
  updateRoom: (roomId: string, points: Plan, edges: EdgeType[]) => void;
  renameRoom: (roomId: string, name: string) => void;

  setConfig: (config: TilingConfig) => void;
  setWallThickness: (mm: number) => void;
  setStatus: (status: ProjectStatus) => void;
  setClient: (client: ClientInfo) => void;
  setProjectInfo: (info: { name?: string; description?: string; client?: ClientInfo }) => void;

  addNote: (text: string, authorName: string) => void;
  removeNote: (noteId: string) => void;
  updateNote: (noteId: string, text: string) => void;

  // Constraint actions
  addConstraint: (c: Constraint) => void;
  removeConstraint: (id: string) => void;
  updateConstraintValue: (id: string, value: Constraint['value']) => void;
  /** Shift vertex indices for a given room when vertices are inserted/removed. */
  shiftConstraintIndices: (roomId: string, afterIdx: number, delta: number) => void;

  restoreSnapshot: (rooms: Room[], constraints: Constraint[]) => void;

  // Partition actions
  addPartition: (roomId: string, p1: Point, p2: Point, thickness: number) => void;
  updatePartition: (roomId: string, partitionId: string, p1: Point, p2: Point) => void;
  removePartition: (roomId: string, partitionId: string) => void;
  updatePartitionThickness: (roomId: string, partitionId: string, thickness: number) => void;
  setEdgeThickness: (roomId: string, edgeIdx: number, thickness: number) => void;

  // Excluded zone actions
  addExcludedZone: (roomId: string, points: Point[]) => void;
  removeExcludedZone: (roomId: string, zoneId: string) => void;
  updateExcludedZonePoints: (roomId: string, zoneId: string, points: Point[]) => void;

  clearPartitionsAndZones: (roomId: string) => void;

  // Tiling dimension actions
  addTilingDimension: (dim: TilingDimension) => void;
  removeTilingDimension: (id: string) => void;
  updateTilingDimensionPerpOffset: (id: string, perpOffset: number) => void;
}

const sortByUpdatedDesc = (a: Project, b: Project) => b.updatedAt - a.updatedAt;

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const all = await supabaseDb.getAll();
    set({ projects: all.sort(sortByUpdatedDesc), hydrated: true });
  },

  create: async (data) => {
    const profile = await supabaseDb.getProfile();
    if (profile.plan === 'free' && get().projects.length >= 1) {
      throw new Error('PROJECT_LIMIT_REACHED');
    }
    const now = Date.now();
    const newProject: Project = {
      id: generateId(),
      name: data?.name ?? `Nouveau projet ${get().projects.length + 1}`,
      client: data?.client,
      status: 'new',
      createdAt: now,
      updatedAt: now,
      rooms: [{ id: generateId(), points: [], edges: [], partitions: [], excludedZones: [] }],
      config: { ...DEFAULT_TILING_CONFIG },
      wallThickness: WALL_THICKNESS_MM,
      constraints: [],
      notes: [],
    };
    await supabaseDb.save(newProject);
    set({ projects: [newProject, ...get().projects], activeProjectId: newProject.id });
    return newProject;
  },

  rename: (id, name) => {
    set({ projects: get().projects.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p)) });
    const target = get().projects.find((p) => p.id === id);
    if (target) void supabaseDb.save(target);
  },

  remove: async (id) => {
    await supabaseDb.delete(id);
    set({
      projects: get().projects.filter((p) => p.id !== id),
      activeProjectId: get().activeProjectId === id ? null : get().activeProjectId,
    });
  },

  setActive: (id) => set({ activeProjectId: id }),

  updateActive: (updater) => {
    const id = get().activeProjectId;
    if (!id) return;
    const next = get().projects.map((p) =>
      p.id === id ? { ...updater(p), updatedAt: Date.now() } : p,
    );
    set({ projects: next });
    const updated = next.find((p) => p.id === id);
    if (updated) void supabaseDb.save(updated);
  },

  addRoom: () => {
    const id = generateId();
    get().updateActive((p) => ({ ...p, rooms: [...p.rooms, { id, points: [], edges: [], partitions: [], excludedZones: [] }] }));
    return id;
  },

  removeRoom: (roomId) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.filter((r) => r.id !== roomId),
      constraints: p.constraints.filter((c) => c.pts.every((ref) => ref.roomId !== roomId)),
    }));
  },

  updateRoom: (roomId, points, edges) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) => (r.id === roomId ? { ...r, points, edges } : r)),
    }));
  },

  renameRoom: (roomId, name) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) => (r.id === roomId ? { ...r, name } : r)),
    }));
  },

  setConfig: (config) => get().updateActive((p) => ({ ...p, config })),
  setWallThickness: (mm) => get().updateActive((p) => ({ ...p, wallThickness: mm })),
  setStatus: (status) => get().updateActive((p) => ({ ...p, status })),
  setClient: (client) => get().updateActive((p) => ({ ...p, client })),
  setProjectInfo: ({ name, description, client }) => {
    get().updateActive((p) => ({
      ...p,
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(client !== undefined ? { client } : {}),
    }));
  },

  addNote: (text, authorName) => {
    const note: ProjectNote = { id: generateId(), text, createdAt: Date.now(), authorName };
    get().updateActive((p) => ({ ...p, notes: [note, ...p.notes] }));
  },
  removeNote: (noteId) => {
    get().updateActive((p) => ({ ...p, notes: p.notes.filter((n) => n.id !== noteId) }));
  },
  updateNote: (noteId: string, text: string) => {
    get().updateActive((p) => ({
      ...p,
      notes: p.notes.map((n) => (n.id === noteId ? { ...n, text } : n)),
    }));
  },

  addConstraint: (c) => {
    get().updateActive((p) => ({ ...p, constraints: [...p.constraints, c] }));
  },

  removeConstraint: (id) => {
    get().updateActive((p) => ({ ...p, constraints: p.constraints.filter((c) => c.id !== id) }));
  },

  updateConstraintValue: (id, value) => {
    get().updateActive((p) => ({
      ...p,
      constraints: p.constraints.map((c) => (c.id === id ? { ...c, value } : c)),
    }));
  },

  shiftConstraintIndices: (roomId, afterIdx, delta) => {
    get().updateActive((p) => ({
      ...p,
      constraints: p.constraints.map((c) => ({
        ...c,
        pts: c.pts.map((ref) =>
          ref.roomId === roomId && ref.vertexIdx > afterIdx
            ? { ...ref, vertexIdx: ref.vertexIdx + delta }
            : ref,
        ),
      })),
    }));
  },

  restoreSnapshot: (rooms, constraints) => {
    get().updateActive((p) => ({ ...p, rooms, constraints }));
  },

  addPartition: (roomId, p1, p2, thickness) => {
    const id = generateId();
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId ? { ...r, partitions: [...(r.partitions ?? []), { id, p1, p2, thickness }] } : r,
      ),
    }));
  },

  updatePartition: (roomId, partitionId, p1, p2) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId ? { ...r, partitions: (r.partitions ?? []).map((pt) => pt.id === partitionId ? { ...pt, p1, p2 } : pt) } : r,
      ),
    }));
  },

  removePartition: (roomId, partitionId) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId ? { ...r, partitions: (r.partitions ?? []).filter((pt) => pt.id !== partitionId) } : r,
      ),
    }));
  },

  setEdgeThickness: (roomId, edgeIdx, thickness) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) => {
        if (r.id !== roomId) return r;
        const thicknesses = [...(r.edgeThicknesses ?? new Array(r.edges.length).fill(undefined) as (number | undefined)[])];
        thicknesses[edgeIdx] = thickness;
        return { ...r, edgeThicknesses: thicknesses };
      }),
    }));
  },

  updatePartitionThickness: (roomId, partitionId, thickness) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId
          ? { ...r, partitions: (r.partitions ?? []).map((pt) => pt.id === partitionId ? { ...pt, thickness } : pt) }
          : r,
      ),
    }));
  },

  addExcludedZone: (roomId, points) => {
    const id = generateId();
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId ? { ...r, excludedZones: [...(r.excludedZones ?? []), { id, points }] } : r,
      ),
    }));
  },

  removeExcludedZone: (roomId, zoneId) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId ? { ...r, excludedZones: (r.excludedZones ?? []).filter((z) => z.id !== zoneId) } : r,
      ),
      constraints: p.constraints.filter((c) => !c.pts.some((pt) => pt.roomId === zoneId)),
    }));
  },

  updateExcludedZonePoints: (roomId, zoneId, points) => {
    get().updateActive((p) => ({
      ...p,
      rooms: p.rooms.map((r) =>
        r.id === roomId
          ? { ...r, excludedZones: (r.excludedZones ?? []).map((z) => (z.id === zoneId ? { ...z, points } : z)) }
          : r,
      ),
    }));
  },

  clearPartitionsAndZones: (roomId) => {
    get().updateActive((p) => {
      const zoneIds = new Set((p.rooms.find((r) => r.id === roomId)?.excludedZones ?? []).map((z) => z.id));
      return {
        ...p,
        rooms: p.rooms.map((r) => (r.id === roomId ? { ...r, partitions: [], excludedZones: [] } : r)),
        constraints: p.constraints.filter((c) => !c.pts.some((pt) => zoneIds.has(pt.roomId))),
      };
    });
  },

  addTilingDimension: (dim) => get().updateActive((p) => ({
    ...p,
    tilingDimensions: [...(p.tilingDimensions ?? []), dim],
  })),

  removeTilingDimension: (id) => get().updateActive((p) => ({
    ...p,
    tilingDimensions: (p.tilingDimensions ?? []).filter((d) => d.id !== id),
  })),

  updateTilingDimensionPerpOffset: (id, perpOffset) => get().updateActive((p) => ({
    ...p,
    tilingDimensions: (p.tilingDimensions ?? []).map((d) =>
      d.id === id ? { ...d, perpOffset } : d,
    ),
  })),
}));

export const selectActiveProject = (state: ProjectState): Project | null =>
  state.projects.find((p) => p.id === state.activeProjectId) ?? null;

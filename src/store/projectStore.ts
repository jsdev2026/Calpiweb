import { create } from 'zustand';
import type { Project, Room, EdgeType, ProjectStatus, ClientInfo, Constraint } from '@/types/project';
import type { Plan, Point } from '@/types/plan';
import type { TilingConfig } from '@/types/tiling';
import { projectsDb } from '@/lib/db';
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
    }));
  } else {
    const legacyPoints = (p.plan as Point[] | undefined) ?? [];
    rooms = [{ id: generateId(), points: legacyPoints, edges: new Array<EdgeType>(legacyPoints.length).fill('WALL') }];
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
  };
}

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

  // Constraint actions
  addConstraint: (c: Constraint) => void;
  removeConstraint: (id: string) => void;
  updateConstraintValue: (id: string, value: Constraint['value']) => void;
  /** Shift vertex indices for a given room when vertices are inserted/removed. */
  shiftConstraintIndices: (roomId: string, afterIdx: number, delta: number) => void;

  restoreSnapshot: (rooms: Room[], constraints: Constraint[]) => void;
}

const sortByUpdatedDesc = (a: Project, b: Project) => b.updatedAt - a.updatedAt;

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  activeProjectId: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const all = await projectsDb.getAll();
    set({ projects: all.map(migrateProject).sort(sortByUpdatedDesc), hydrated: true });
  },

  create: async (data) => {
    const now = Date.now();
    const newProject: Project = {
      id: generateId(),
      name: data?.name ?? `Nouveau projet ${get().projects.length + 1}`,
      client: data?.client,
      status: 'new',
      createdAt: now,
      updatedAt: now,
      rooms: [{ id: generateId(), points: [], edges: [] }],
      config: { ...DEFAULT_TILING_CONFIG },
      wallThickness: WALL_THICKNESS_MM,
      constraints: [],
    };
    await projectsDb.save(newProject);
    set({ projects: [newProject, ...get().projects], activeProjectId: newProject.id });
    return newProject;
  },

  rename: (id, name) => {
    set({ projects: get().projects.map((p) => (p.id === id ? { ...p, name, updatedAt: Date.now() } : p)) });
    const target = get().projects.find((p) => p.id === id);
    if (target) void projectsDb.save(target);
  },

  remove: async (id) => {
    await projectsDb.delete(id);
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
    if (updated) void projectsDb.save(updated);
  },

  addRoom: () => {
    const id = generateId();
    get().updateActive((p) => ({ ...p, rooms: [...p.rooms, { id, points: [], edges: [] }] }));
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
}));

export const selectActiveProject = (state: ProjectState): Project | null =>
  state.projects.find((p) => p.id === state.activeProjectId) ?? null;
